/**
 * EditorArrangerHotSwapService
 *
 * Owns the synchronous hand-off from a prepared arranger state to the
 * active editor/DAW state. Runtime state, rendering and transport operations
 * are injected so editor.js keeps only the compatibility wrapper.
 */
(function attachEditorArrangerHotSwapService(globalScope) {
  'use strict';

  function create({
    getPerformanceState = () => ({}),
    updatePerformanceState = () => {},
    getArrangement = () => null,
    stopAllVoices = () => {},
    applyPreparedState = () => null,
    getDAW = () => null,
    getPlaybackPolicy = () => null,
    setSelectionEnd = () => {},
    resetRecording = () => {},
    seekTransport = () => {},
    resetHistory = () => {},
    syncToolbar = () => {},
    renderEditor = () => {},
    renderAll = () => {},
    saveState = () => {},
    initHighlightEffect = () => {},
    renderPerfUI = () => {},
    toast = () => {},
    translate = key => key,
    pauseTransport = () => {},
    getElement = () => null,
    prepareNextSong = () => {},
    syncUIAfterSongChange = () => {},
    mirrorTimeline = () => {},
    schedule = (...args) => globalScope.setTimeout?.(...args),
    logger = console
  } = {}) {
    function getItems() {
      const arrangement = getArrangement?.();
      return Array.isArray(arrangement?.items) ? arrangement.items : [];
    }

    function resetPreparedState(nextState) {
      updatePerformanceState?.({
        nextState: null,
        index: nextState.idx,
        hasLoggedNoNextSong: false,
        prepStartedForIndex: -1
      });
    }

    function applyPlaybackBoundary(nextState, active, nextEnd) {
      if (active) {
        getPlaybackPolicy?.()?.applyToDAW?.(getDAW?.());
        setSelectionEnd(nextEnd);
        return;
      }
      setSelectionEnd(nextState.selectionEnd);
    }

    function updatePauseModeUi() {
      const button = getElement?.('perfPlayBtn');
      if (button) button.textContent = '▶';
    }

    function hotSwapToNextSong() {
      const performanceState = getPerformanceState?.() || {};
      const nextState = performanceState.nextState;
      if (!nextState) return false;

      resetPreparedState(nextState);
      logger?.log?.(
        `[Arranger] Hot-swapping to song ${nextState.idx + 1}: ` +
        `"${nextState.song?.title || 'Untitled'}"`
      );

      stopAllVoices();
      const transition = applyPreparedState?.({
        song: nextState.song,
        clips: nextState.clips,
        sections: nextState.sections,
        tracks: nextState.tracks,
        loopState: nextState.loopState,
        arrangerMarkers: nextState.arrangerMarkers
      });
      if (!transition) {
        logger?.error?.(
          '[Arranger] Song transition service is unavailable'
        );
        return false;
      }

      const active = Boolean(
        (getPerformanceState?.() || performanceState).active
      );
      const nextStart = Math.max(
        0,
        Number(nextState.playbackStart ?? nextState.arrangerMarkers?.start) || 0
      );
      const requestedEnd = Number(
        nextState.playbackEnd ??
        nextState.selectionEnd ??
        nextState.arrangerMarkers?.end ??
        nextState.loopState?.loopB
      );
      const nextEnd = Number.isFinite(requestedEnd) &&
        requestedEnd > nextStart
        ? requestedEnd
        : nextStart + 10;

      applyPlaybackBoundary(nextState, active, nextEnd);
      resetRecording();

      const audio = transition.audio || {
        loaded: 0,
        total: 0,
        missing: 0,
        missingNames: []
      };
      logger?.log?.(
        `[Arranger] Audio clips: ${audio.loaded}/${audio.total} loaded` +
        (audio.missing > 0
          ? `, ${audio.missing} missing: ` +
            `${(audio.missingNames || []).join(', ')}`
          : '')
      );

      seekTransport(active ? nextStart : 0, true, true);
      resetHistory();
      syncToolbar();
      renderEditor(true);
      renderAll();
      saveState();
      initHighlightEffect();
      renderPerfUI();

      const items = getItems();
      toast(
        `${translate('songN')} ${nextState.idx + 1}/${items.length}: ` +
        `${nextState.song?.title || translate('untitled')}`
      );

      const currentState = getPerformanceState?.() || performanceState;
      if (currentState.pauseMode) {
        pauseTransport();
        updatePauseModeUi();
      }

      if (active && nextState.idx + 1 < items.length) {
        prepareNextSong();
      }
      syncUIAfterSongChange();
      schedule?.(() => mirrorTimeline(), 1000);
      return true;
    }

    return Object.freeze({
      hotSwapToNextSong,
      hotSwap: hotSwapToNextSong
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorArrangerHotSwapService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
