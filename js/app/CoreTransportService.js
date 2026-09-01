/*
 * CoreTransportService
 *
 * Owns the editor transport facade: seek, play/pause/stop, count-in,
 * playhead ticking and the arranger boundary hand-off. The service does not
 * own DAW state; all stateful operations are injected so legacy callers keep
 * using the same public functions.
 */
(function attachCoreTransportService(globalScope) {
  'use strict';

  function normalizeElement(target) {
    if (target?.nodeType === 3) {
      return target.parentElement || target.parentNode;
    }
    return target;
  }

  function isNodeLike(target) {
    return Boolean(target && typeof target.nodeType === 'number');
  }

  function isEditorTarget(
    target,
    documentRef = globalScope.document
  ) {
    const element = normalizeElement(target);
    const editor = documentRef?.getElementById?.('editor');
    if (!element || !editor) return false;
    if (element === editor) return true;
    if (!isNodeLike(element)) return false;
    return editor.contains?.(element) === true;
  }

  function isTextEditingTarget(target) {
    let element = normalizeElement(target);
    const tagName = String(element?.tagName || '').toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') return true;
    if (tagName === 'SELECT') return false;

    const editableAncestor = element?.closest?.('[contenteditable]');
    if (editableAncestor) {
      const contentEditableAttribute =
        editableAncestor.getAttribute?.('contenteditable');
      if (contentEditableAttribute != null) {
        return (
          String(contentEditableAttribute).toLowerCase() !== 'false'
        );
      }
      if (editableAncestor.isContentEditable === true) return true;

      const contentEditable = String(
        editableAncestor.contentEditable || ''
      ).toLowerCase();
      if (
        contentEditable === 'true' ||
        contentEditable === 'plaintext-only'
      ) {
        return true;
      }
    }

    while (element) {
      const contentEditableAttribute =
        element.getAttribute?.('contenteditable');
      if (contentEditableAttribute != null) {
        return (
          String(contentEditableAttribute).toLowerCase() !== 'false'
        );
      }
      if (element.isContentEditable === true) return true;

      const contentEditable = String(
        element.contentEditable || ''
      ).toLowerCase();
      if (
        contentEditable === 'true' ||
        contentEditable === 'plaintext-only'
      ) {
        return true;
      }

      const next = element.parentElement || element.parentNode;
      if (next === element) break;
      element = next;
    }
    return false;
  }

  function isDocumentLikeTarget(target, documentRef) {
    const element = normalizeElement(target);
    if (!element) return true;
    if (element === documentRef || element?.nodeType === 9) return true;
    if (element === documentRef?.body) return true;
    if (element === documentRef?.documentElement) return true;

    const tagName = String(element?.tagName || '').toUpperCase();
    return tagName === 'BODY' || tagName === 'HTML';
  }

  function isTextEditingEventFallback(event, documentRef) {
    if (!event) return false;

    const composedPath = event.composedPath?.();
    if (
      Array.isArray(composedPath) &&
      composedPath.some(
        target =>
          isEditorTarget(target, documentRef) ||
          isTextEditingTarget(target)
      )
    ) {
      return true;
    }

    if (
      isEditorTarget(event.target, documentRef) ||
      isTextEditingTarget(event.target)
    ) {
      return true;
    }
    if (!isDocumentLikeTarget(event.target, documentRef)) return false;
    if (
      isEditorTarget(documentRef?.activeElement, documentRef) ||
      isTextEditingTarget(documentRef?.activeElement)
    ) {
      return true;
    }

    const selection = documentRef?.getSelection?.() ||
      globalScope.getSelection?.();
    return (
      isEditorTarget(selection?.anchorNode, documentRef) ||
      isTextEditingTarget(selection?.anchorNode)
    );
  }

  function isSpaceEvent(event) {
    return (
      event?.code === 'Space' ||
      event?.key === ' ' ||
      event?.key === 'Spacebar' ||
      Number(event?.keyCode) === 32 ||
      Number(event?.which) === 32
    );
  }

  function create({
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getElement = id => globalScope.document?.getElementById?.(id),
    documentRef = globalScope.document,
    isTextEditingEvent: isTextEditingEventRef = null,
    getTransportState = () => ({}),
    ensureAudioCtx = () => {},
    cancelCountIn = () => {},
    isCountInRunning = () => false,
    getProjectEnd = () => 0,
    snapTime = value => value,
    playheadMath = globalScope.PlayheadMath,
    setTransportOrigin = () => {},
    getTransportPlayhead = () => 0,
    updatePlayheadUI = () => {},
    scheduleAllFromPlayhead = () => {},
    stopAllVoices = () => {},
    startMetronome = () => {},
    stopMetronome = () => {},
    getMetronomeSchedulerBridge = () => null,
    checkMetronomeTick = () => {},
    getCountInScheduler = () =>
      globalScope.countInSchedulerBridge || null,
    alignPlayheadToNearestMeasure = () => {},
    getTimeSignatureGridConfig = () => ({}),
    getAppSettings = () => ({}),
    getRecordingRuntime = () => null,
    getAudioContextService = () => null,
    getArrangerState = () => ({}),
    setArrangerPreparePending = () => {},
    setArrangerPrepStartedForIndex = () => {},
    setArrangerWaitPollActive = () => {},
    clearArrangerNextState = () => {},
    prepareNextArrSong = () => Promise.resolve(),
    loadArrSong = () => Promise.resolve(),
    hotSwapToNextSong = () => {},
    arrCrossfadeSwap = () => {},
    renderPerfUI = () => {},
    publishPlaybackSync = () => {},
    updateSyncHighlight = () => {},
    isSyncActive = () => false,
    isLyricPopupOpen = () => false,
    requestAnimationFrameRef = (...args) =>
      globalScope.requestAnimationFrame?.(...args),
    cancelAnimationFrameRef = (...args) =>
      globalScope.cancelAnimationFrame?.(...args),
    performanceRef = globalScope.performance || { now: () => Date.now() },
    toast = () => {},
    logger = globalScope.console || console
  } = {}) {
    let playStartPos = 0;

    function isTextEditingEvent(event) {
      if (!event) return false;
      if (typeof isTextEditingEventRef === 'function') {
        return Boolean(isTextEditingEventRef(event, documentRef));
      }

      const keyboardServiceCheck =
        globalScope.EditorKeyboardService?.isTextEditingEvent;
      if (typeof keyboardServiceCheck === 'function') {
        return Boolean(keyboardServiceCheck(event, documentRef));
      }

      return isTextEditingEventFallback(event, documentRef);
    }

    function shouldBlockEditableSpace(event) {
      return isSpaceEvent(event) && isTextEditingEvent(event);
    }

    function readDAW() {
      return getDAW?.();
    }

    function readTransportState() {
      return getTransportState?.() || {};
    }

    function readArrangerState() {
      return getArrangerState?.() || {};
    }

    function getArrangerEnd() {
      const arranger = readArrangerState();
      const selectionEnd = Number(arranger.selectionEnd) || 0;
      if (arranger.active && selectionEnd > 0) return selectionEnd;

      if (arranger.active && arranger.playbackPolicy?.getTimelineEnd) {
        const contentEnd = arranger.playbackPolicy.getTimelineEnd({
          clips: readDAW()?.clips || [],
          sections: readDAW()?.sections || []
        });
        if (contentEnd > 0) return contentEnd;
      }

      if (selectionEnd > 0) return selectionEnd;

      const daw = readDAW();
      let end = 0;
      (daw?.clips || []).forEach(clip => {
        end = Math.max(end, clip.start + clip.duration);
      });
      (daw?.sections || []).forEach(section => {
        end = Math.max(end, section.start + section.duration);
      });
      return end > 0 ? end : getProjectEnd();
    }

    function seekTransport(time, keepPlaying = true, noSnap = false) {
      if (isCountInRunning()) cancelCountIn();
      const daw = readDAW();
      if (!daw) return;

      const nextTime = noSnap ? time : snapTime(time);
      daw.playhead = playheadMath?.clamp
        ? playheadMath.clamp(nextTime, getProjectEnd())
        : Math.max(0, Math.min(nextTime, getProjectEnd()));

      if (daw.isPlaying) setTransportOrigin(daw.playhead);
      updatePlayheadUI();

      if (daw.isPlaying && !daw.isScrubbing) {
        scheduleAllFromPlayhead();
        const transportState = readTransportState();
        if (transportState.metroActive) startMetronome();
      } else {
        stopAllVoices();
      }
      publishPlaybackSync();
    }

    function updateReturnToStartButton() {
      const button = getElement('returnToStartBtn');
      if (!button) return;
      const enabled = Boolean(readTransportState().returnToStartOnPause);
      button.classList.toggle('active', enabled);
      button.style.background = enabled ? 'var(--accent-teal)' : '';
      button.style.color = enabled ? '#000' : '';
      button.style.borderColor = enabled ? 'var(--accent-teal)' : '';
      button.setAttribute('aria-pressed', String(enabled));
    }

    function toggleReturnToStart() {
      const state = readTransportState();
      state.returnToStartOnPause = !state.returnToStartOnPause;
      updateReturnToStartButton();
      toast(
        state.returnToStartOnPause
          ? 'برگشت به ابتدا فعال شد'
          : 'برگشت به ابتدا غیرفعال شد'
      );
    }

    function setPlayButtonColor(color) {
      const button = getElement('play-btn');
      if (button) button.style.color = color;
    }

    function setPerformancePlayButton(value) {
      if (!readArrangerState().perfModeActive) return;
      const button = getElement('perfPlayBtn');
      if (button) button.textContent = value;
    }

    function togglePlay(event) {
      if (shouldBlockEditableSpace(event)) return false;

      const daw = readDAW();
      if (!daw) return false;

      if (daw.isPlaying) {
        const state = readTransportState();
        if (state.returnToStartOnPause) {
          const savedPos = playStartPos;
          pauseTransport();
          seekTransport(savedPos, false);
        } else {
          pauseTransport();
        }
      } else if (isCountInRunning()) {
        pauseTransport();
      } else {
        playStartPos = daw.playhead;
        startTransport();
      }
      return true;
    }

    function runArrangerPreparation() {
      setArrangerPreparePending(true);
      let preparation;
      try {
        preparation = prepareNextArrSong();
      } catch (error) {
        logger?.error?.('[Arranger] Prep failed:', error);
        setArrangerPreparePending(false);
        return;
      }
      Promise.resolve(preparation)
        .then(() => setArrangerPreparePending(false))
        .catch(error => {
          logger?.error?.('[Arranger] Prep failed:', error);
          setArrangerPreparePending(false);
          clearArrangerNextState();
        });
    }

    function runArrangerFallbackLoad() {
      const arranger = readArrangerState();
      const nextIndex =
        (Number.isFinite(arranger.index) ? arranger.index : -1) + 1;
      setArrangerPreparePending(true);
      let loading;
      try {
        loading = loadArrSong(nextIndex);
      } catch (error) {
        logger?.error?.('[Arranger] Fallback loadArrSong failed:', error);
        setArrangerPreparePending(false);
        return;
      }
      Promise.resolve(loading)
        .then(() => setArrangerPreparePending(false))
        .catch(error => {
          logger?.error?.('[Arranger] Fallback loadArrSong failed:', error);
          setArrangerPreparePending(false);
        });
    }

    function waitForArrangerPreparation() {
      const arranger = readArrangerState();
      if (!arranger.active) {
        setArrangerWaitPollActive(false);
        return;
      }

      if (arranger.nextState) {
        logger?.log?.(
          '[Arranger] Prep finished during wait — hot-swapping now'
        );
        setArrangerWaitPollActive(false);
        if ((arranger.data?.crossfade || 0) > 0) arrCrossfadeSwap();
        else hotSwapToNextSong();
        return;
      }

      if (!arranger.preparePending) {
        logger?.warn?.(
          '[Arranger] Prep finished but no next state — fallback to loadArrSong'
        );
        setArrangerWaitPollActive(false);
        runArrangerFallbackLoad();
        return;
      }

      globalScope.setTimeout?.(waitForArrangerPreparation, 100);
    }

    function handleTransportBoundary() {
      const arranger = readArrangerState();
      if (!arranger.active) {
        stopTransport();
        return true;
      }

      if (arranger.nextState && !arranger.isCrossfading) {
        const crossfadeDuration = arranger.data?.crossfade || 0;
        if (crossfadeDuration > 0) arrCrossfadeSwap();
        else hotSwapToNextSong();
        return false;
      }

      if (arranger.isCrossfading) return false;

      if (arranger.preparePending) {
        logger?.log?.(
          '[Arranger] Reached end but prep still running. Entering wait mode...'
        );
        stopAllVoices();
        const daw = readDAW();
        if (daw) daw.isPlaying = false;

        if (!arranger.waitPollActive) {
          setArrangerWaitPollActive(true);
          globalScope.setTimeout?.(waitForArrangerPreparation, 100);
        }
        return true;
      }

      logger?.warn?.(
        '[Arranger] Next song not ready and no prep running — fallback to loadArrSong'
      );
      runArrangerFallbackLoad();
      return true;
    }

    function startTransport() {
      const audioContext = ensureAudioCtx();
      cancelCountIn();

      const beginPlayback = (transportStartAudioTime = null) => {
        const daw = readDAW();
        if (!daw) return;
        daw.isScrubbing = false;
        const startTime = Number.isFinite(Number(daw.playhead))
          ? Math.max(0, Number(daw.playhead))
          : 0;
        // Anchor the clock before popup rAF loops can observe isPlaying.
        setTransportOrigin(startTime, transportStartAudioTime);
        daw.playhead = startTime;
        daw.isPlaying = true;
        publishPlaybackSync();
        setPlayButtonColor('var(--accent-neon-pink)');
        scheduleAllFromPlayhead();
        setPerformancePlayButton('⏸');

        const transportState = readTransportState();
        if (transportState.metroActive && !transportState.metroTimer) {
          startMetronome();
        }
      };

      const tick = rafTimestamp => {
        const daw = readDAW();
        if (!daw?.isPlaying) return;
        if (!daw.isScrubbing) daw.playhead = getTransportPlayhead();

        const arranger = readArrangerState();
        if (
          daw.loopEnabled &&
          !arranger.active &&
          !daw.isRecording &&
          daw.playhead >= daw.loopB
        ) {
          const looped = playheadMath?.applyLoop
            ? playheadMath.applyLoop(
                daw.playhead,
                daw.loopEnabled,
                daw.loopA,
                daw.loopB
              )
            : { playhead: daw.playhead };
          daw.playhead = looped.playhead;
          setTransportOrigin(daw.playhead);
          scheduleAllFromPlayhead({
            preserveVoices: true,
            loopOnly: true
          });
        }

        updatePlayheadUI({
          performanceTime: Number.isFinite(rafTimestamp)
            ? rafTimestamp
            : performanceRef.now()
        });
        if (!getMetronomeSchedulerBridge()) {
          checkMetronomeTick(daw.playhead);
        }

        const currentArranger = readArrangerState();
        if (
          currentArranger.active &&
          !currentArranger.nextState &&
          !currentArranger.preparePending
        ) {
          const end = getArrangerEnd();
          if (end > 0 && daw.playhead >= end - 15) {
            const nextIndex =
              (Number.isFinite(currentArranger.index)
                ? currentArranger.index
                : -1) + 1;
            if (currentArranger.prepStartedForIndex !== nextIndex) {
              setArrangerPrepStartedForIndex(nextIndex);
              logger?.log?.(
                `[Arranger] Starting prep at ${daw.playhead.toFixed(
                  1
                )}s (end: ${end.toFixed(1)}s)`
              );
            }
            runArrangerPreparation();
          }
        }

        const boundary = currentArranger.active
          ? getArrangerEnd()
          : getProjectEnd();
        if (daw.playhead >= boundary) {
          if (handleTransportBoundary()) {
            return;
          }
        }

        // Player View owns its own popup-side highlight loop. Calling the
        // cross-window sync controller on every transport frame duplicates
        // all DOM work and is especially expensive in Electron.
        if (isSyncActive()) updateSyncHighlight();
        daw.rafId = requestAnimationFrameRef(tick);
      };

      const beginTransport = () => {
        const transportState = readTransportState();
      const countInScheduler = getCountInScheduler();
      if (transportState.countInBars > 0 && countInScheduler) {
        const bpm = parseInt(getElement('edTempo')?.value, 10) || 120;
        const timeSignature = getElement('edTimeSig')?.value || '4/4';
        const config = getTimeSignatureGridConfig(timeSignature, bpm);
        alignPlayheadToNearestMeasure(config);

        const daw = readDAW();
        if (daw) {
          daw.isPlaying = false;
          daw.isScrubbing = false;
          if (daw.rafId) {
            cancelAnimationFrameRef(daw.rafId);
            daw.rafId = null;
          }
        }
        stopAllVoices();
        if (readTransportState().metroTimer) stopMetronome();
        setPlayButtonColor('var(--accent-cyan-glow)');
        toast('🔢 شمارش: ' + transportState.countInBars + ' میزان');

        const scheduledCountIn = countInScheduler.start({
          bars: transportState.countInBars,
          bpm,
          timeSignature,
          soundType: getAppSettings().metroSound || 'classic',
          onComplete: ({ endTime }) => {
            beginPlayback(endTime);
            const currentDaw = readDAW();
            if (currentDaw?.rafId) cancelAnimationFrameRef(currentDaw.rafId);
            if (currentDaw) currentDaw.rafId = requestAnimationFrameRef(tick);
          }
        });
        if (scheduledCountIn) return;

        toast('مترونوم در دسترس نیست؛ پخش بدون کانتین شروع شد');
      }

      beginPlayback();
      const daw = readDAW();
      if (daw?.rafId) cancelAnimationFrameRef(daw.rafId);
        if (daw) daw.rafId = requestAnimationFrameRef(tick);
      };

      if (
        audioContext?.state === 'suspended' &&
        typeof audioContext.resume === 'function'
      ) {
        const resumeResult = audioContext.resume();
        if (resumeResult && typeof resumeResult.then === 'function') {
          resumeResult.then(beginTransport, beginTransport);
          return;
        }
      }

      beginTransport();
    }

    function pauseTransport() {
      cancelCountIn();
      const daw = readDAW();
      if (!daw) return;

      if (daw.isRecording) getRecordingRuntime()?.endRec?.();
      if (daw.isPlaying && !daw.isScrubbing) {
        daw.playhead = getTransportPlayhead();
      }
      daw.isPlaying = false;
      daw.isScrubbing = false;
      if (daw.rafId) cancelAnimationFrameRef(daw.rafId);
      daw.rafId = null;
      stopAllVoices();
      setPlayButtonColor('var(--accent-cyan-glow)');
      updatePlayheadUI();
      daw.playOriginAudio = null;
      getAudioContextService()?.stopAll?.();

      const transportState = readTransportState();
      if (transportState.metroTimer) stopMetronome();

      const editor = getElement('editor');
      if (editor?.children) {
        [...editor.children].forEach(element => {
          element.classList.remove('sync-playing', 'sync-done');
        });
      }

      setPerformancePlayButton('▶');
      publishPlaybackSync();
    }

    function stopTransport() {
      pauseTransport();
      const daw = readDAW();
      if (!daw) return;
      daw.playhead = 0;
      updatePlayheadUI();
      publishPlaybackSync();

      const arranger = readArrangerState();
      if (arranger.active && arranger.data) {
        if (arranger.perfPauseMode && arranger.perfModeActive) {
          renderPerfUI();
          return;
        }
        const nextIndex =
          (Number.isFinite(arranger.index) ? arranger.index : -1) + 1;
        loadArrSong(nextIndex);
      }
      setPerformancePlayButton('▶');
      if (arranger.perfModeActive) renderPerfUI();
    }

    function transportToStart() {
      seekTransport(0);
    }

    function transportToEnd() {
      const daw = readDAW();
      let end = 0;
      (daw?.clips || []).forEach(clip => {
        end = Math.max(end, clip.start + clip.duration);
      });
      seekTransport(end);
    }

    return Object.freeze({
      seekTransport,
      updateReturnToStartButton,
      toggleReturnToStart,
      togglePlay,
      startTransport,
      pauseTransport,
      stopTransport,
      getArrangerEnd,
      transportToStart,
      transportToEnd
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreTransportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
