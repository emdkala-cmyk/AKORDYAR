/*
 * CorePerformanceModeService
 *
 * Owns the live performance dashboard controls while keeping arranger data
 * and transport state in the existing core/editor runtime. The service only
 * coordinates injected operations, so legacy global handlers keep their names.
 */
(function attachCorePerformanceModeService(globalScope) {
  'use strict';

  function create({
    getElement = id => globalScope.document?.getElementById?.(id),
    getActiveElement = () => globalScope.document?.activeElement,
    isTextEditingEvent = event =>
      globalScope.EditorKeyboardService?.isTextEditingEvent?.(event) ||
      false,
    getEditingArr = () => null,
    getPerformanceState = () => ({}),
    updatePerformanceState = () => {},
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getArrangerMarkers = () => ({ enabled: false, start: 0, end: 0 }),
    ensureArrItem = () => ({}),
    loadArrSong = () => Promise.resolve(),
    renderPerfUI = () => {},
    renderPerformancePanel = () => {},
    startBackgroundPreload = () => {},
    closeArrangerModal = () => {},
    openLyricOnlyPopup = () => {},
    openLyricPopup = () => {},
    pauseTransport = () => {},
    startTransport = () => {},
    seekTransport = () => {},
    ensureAudioCtx = () => {},
    scheduleAllFromPlayhead = () => {},
    saveArrangers = () => {},
    getSongState = () => null,
    saveSong = () => {},
    handleTimingChange = () => {},
    startPointerDrag = () => {},
    clamp = (value, min, max) => Math.max(min, Math.min(max, value)),
    translate = key => key,
    toast = () => {},
    schedule = (...args) => globalScope.setTimeout?.(...args),
    setIntervalRef = (...args) => globalScope.setInterval?.(...args),
    clearIntervalRef = (...args) => globalScope.clearInterval?.(...args),
    now = () => Date.now(),
    logger = globalScope.console || console
  } = {}) {
    let performanceTimer = null;
    let performanceStartTime = 0;

    function state() {
      return getPerformanceState?.() || {};
    }

    function patch(patchValue) {
      updatePerformanceState?.(patchValue);
    }

    function blurActiveElement() {
      getActiveElement?.()?.blur?.();
    }

    async function openPerfMode() {
      const editingArr = getEditingArr?.();
      if (!editingArr || !editingArr.items.length) {
        toast(translate('emptySetlist'));
        return false;
      }

      patch({
        arrPerformData: editingArr,
        arrPerformIdx: 0,
        arrPerformActive: true,
        perfModeActive: true,
        perfLiveTranspose: 0,
        perfPauseMode: Boolean(editingArr.pauseBetween),
        arrNextState: null
      });

      const panel = getElement('arrPerfOverlay');
      if (panel) panel.style.display = 'flex';
      const nameElement = getElement('perfArrangerName');
      if (nameElement) {
        nameElement.textContent = '🎤 ' + (editingArr.name || 'اجرا');
      }
      getElement('perfPauseModeBtn')?.classList.toggle(
        'arr-stl-active',
        Boolean(editingArr.pauseBetween)
      );

      setupPerformancePanelDrag(panel);
      closeArrangerModal();
      renderPerfUI();
      // Build and render the first song while transport is paused. Starting
      // before opening Player View made the popup appear several lines late.
      const shouldStartPlayback = !Boolean(editingArr.pauseBetween);
      await loadArrSong(0, { startAt: 0, startPlayback: false });
      renderPerfUI();
      startPerfTimer();
      startBackgroundPreload();

      openLyricOnlyPopup();
      schedule(() => {
        if (!state().perfModeActive) return;
        openLyricPopup();
        if (shouldStartPlayback && !getDAW?.()?.isPlaying) {
          // The first Player View frame must always start from the song head.
          seekTransport(0, false, true);
          ensureAudioCtx();
          startTransport();
        }
      }, 300);
      return true;
    }

    function setupPerformancePanelDrag(panel) {
      const handle = getElement('arrPerfDragHandle');
      if (!handle || !panel || handle._dragSetup) return;
      handle._dragSetup = true;

      let dragging = false;
      let startX;
      let startY;
      let originX;
      let originY;

      const move = event => {
        if (!dragging) return;
        panel.style.left = `${originX + event.clientX - startX}px`;
        panel.style.top = `${originY + event.clientY - startY}px`;
        panel.style.right = 'auto';
      };

      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target?.tagName === 'BUTTON') return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        originX = rect.left;
        originY = rect.top;
        event.preventDefault();
        startPointerDrag(
          handle,
          event,
          move,
          () => {
            dragging = false;
          }
        );
      });
    }

    function perfStop() {
      patch({
        arrPerformActive: false,
        perfModeActive: false,
        arrNextState: null,
        bgPreloadActive: false,
        arrWaitPollActive: false,
        arrPreparePending: false,
        arrHasLoggedNoNextSong: false,
        arrPrepStartedForIndex: -1
      });
      pauseTransport();
      const panel = getElement('arrPerfOverlay');
      if (panel) panel.style.display = 'none';
      stopPerfTimer();
    }

    function perfTogglePauseMode() {
      blurActiveElement();
      const nextValue = !Boolean(state().perfPauseMode);
      patch({ perfPauseMode: nextValue });
      getElement('perfPauseModeBtn')?.classList.toggle(
        'arr-stl-active',
        nextValue
      );
    }

    function perfTogglePlay(event) {
      if (isTextEditingEvent?.(event)) return false;

      blurActiveElement();
      const daw = getDAW?.();
      if (!daw) return false;

      if (daw.isPlaying) {
        pauseTransport();
        const button = getElement('perfPlayBtn');
        if (button) button.textContent = '▶';
        return true;
      }

      ensureAudioCtx();
      if (daw.playhead <= 0) {
        const markers = getArrangerMarkers() || {};
        const start = state().arrPerformActive && markers.enabled === true
          ? markers.start || 0
          : 0;
        seekTransport(start, false, true);
      }
      startTransport();
      const button = getElement('perfPlayBtn');
      if (button) button.textContent = '⏸';
      return true;
    }

    function perfRestartSong() {
      blurActiveElement();
      const markers = getArrangerMarkers() || {};
      const start = state().arrPerformActive && markers.enabled === true
        ? markers.start || 0
        : 0;
      seekTransport(start, false, true);
      ensureAudioCtx();
      startTransport();
      const button = getElement('perfPlayBtn');
      if (button) button.textContent = '⏸';
    }

    function perfPrevSong() {
      blurActiveElement();
      const currentIndex = Number(state().arrPerformIdx);
      if (currentIndex > 0) {
        patch({ arrPerformActive: true });
        loadArrSong(currentIndex - 1);
        renderPerfUI();
      }
    }

    function perfNextSong() {
      blurActiveElement();
      const currentState = state();
      const arr = currentState.arrPerformData;
      const currentIndex = Number(currentState.arrPerformIdx);
      if (arr && currentIndex < arr.items.length - 1) {
        patch({ arrPerformActive: true });
        loadArrSong(currentIndex + 1);
        renderPerfUI();
      }
    }

    function perfTranspose(semitones) {
      blurActiveElement();
      const currentState = state();
      const arr = currentState.arrPerformData;
      if (!arr) return;

      const setting = ensureArrItem(arr, currentState.arrPerformIdx);
      setting.transpose = (setting.transpose || 0) + semitones;
      const daw = getDAW?.();
      daw?.tracks?.forEach(track => {
        if (track.type === 'audio') {
          track.transpose = (track.transpose || 0) + semitones;
        }
      });
      if (daw?.isPlaying) scheduleAllFromPlayhead();
      saveArrangers();
      patch({
        perfLiveTranspose:
          (Number(currentState.perfLiveTranspose) || 0) + semitones
      });
      renderPerfUI();
    }

    function perfTempoChange(delta) {
      const tempoElement = getElement('edTempo');
      const currentTempo = parseInt(tempoElement?.value, 10) || 120;
      const nextTempo = clamp(currentTempo + delta, 20, 300);
      if (tempoElement) tempoElement.value = nextTempo;

      if (getSongState()?.setTempo?.(nextTempo)) {
        saveSong();
        handleTimingChange();
      }
      renderPerfUI();
    }

    function perfJumpToSong(index) {
      const currentState = state();
      const arr = currentState.arrPerformData;
      if (
        index < 0 ||
        !arr ||
        index >= arr.items.length
      ) {
        return;
      }
      patch({ arrPerformActive: true });
      loadArrSong(index);
      renderPerfUI();
    }

    function startPerfTimer() {
      stopPerfTimer();
      performanceStartTime = now();
      performanceTimer = setIntervalRef(() => {
        if (!state().perfModeActive) return;
        const elapsed = now() - performanceStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const timeElement = getElement('perfTime');
        if (timeElement) {
          timeElement.textContent =
            `${String(minutes).padStart(2, '0')}:` +
            `${String(seconds).padStart(2, '0')}`;
        }
      }, 1000);
    }

    function stopPerfTimer() {
      if (performanceTimer == null) return;
      clearIntervalRef(performanceTimer);
      performanceTimer = null;
    }

    async function startArrangerPerform() {
      return openPerfMode();
    }

    return Object.freeze({
      openPerfMode,
      perfStop,
      perfTogglePauseMode,
      perfTogglePlay,
      perfRestartSong,
      perfPrevSong,
      perfNextSong,
      perfTranspose,
      perfTempoChange,
      perfJumpToSong,
      startPerfTimer,
      stopPerfTimer,
      startArrangerPerform
    });
  }

  const service = Object.freeze({ create });
  globalScope.CorePerformanceModeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
