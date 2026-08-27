/*
 * CoreHistoryBridgeService
 *
 * Wires the legacy HistoryService to the shared editor runtime without
 * owning editor state.
 */
(function attachCoreHistoryBridgeService(globalScope) {
  'use strict';

  function create({
    isAttached = () => Boolean(globalScope.__historyAttached),
    setAttached = value => {
      globalScope.__historyAttached = value;
    },
    getHistoryService = () => globalScope.requireHistoryService?.(),
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getPERF = () => globalScope.RuntimeStateAdapter?.getPERF?.() || null,
    getSongState = () => globalScope.requireEditorSongStateService?.(),
    setSong = song => globalScope.EditorRuntimeAdapter?.setSong?.(song),
    repairSong = song =>
      globalScope.TextEncodingService?.repairSong?.(song) || song,
    getSeqPoints = () => [],
    setSeqPoints = () => {},
    clearEditorTimers = () => {},
    saveSong = () => {},
    syncToolbar = () => {},
    renderEditor = () => {},
    updateNextIdFromClips = () => {},
    ensureAudioCtx = () => {},
    updateTrackMix = () => {},
    peaksFromBuffer = () => [],
    refreshClipWaveImage = () => {},
    renderAll = () => {},
    scheduleAllFromPlayhead = () => {},
    flushPendingCommit = () => {},
    getCommitTimer = () => null,
    toast = () => {},
    translate = key => key,
    logger = console
  } = {}) {
    function attach() {
      if (isAttached?.()) return;
      const historyService = getHistoryService?.();
      historyService.init({
        getDAW,
        getPERF,
        getSong: () => getSongState?.()?.currentSong?.(),
        setSong: song => setSong?.(song),
        repairSong,
        getEdSeqPoints: () => getSeqPoints?.(),
        setEdSeqPoints: value => setSeqPoints?.(value),
        clearEdTimers: () => clearEditorTimers?.(),
        edSaveSong: (...args) => saveSong?.(...args),
        edSyncToolbar: (...args) => syncToolbar?.(...args),
        edRenderEditor: (...args) => renderEditor?.(...args),
        updateNextIdFromClips: (...args) =>
          updateNextIdFromClips?.(...args),
        ensureAudioCtx: (...args) => ensureAudioCtx?.(...args),
        updateTrackMix: (...args) => updateTrackMix?.(...args),
        peaksFromBuffer: (...args) => peaksFromBuffer?.(...args),
        refreshClipWaveImage: (...args) =>
          refreshClipWaveImage?.(...args),
        renderAll: (...args) => renderAll?.(...args),
        scheduleAllFromPlayhead: (...args) =>
          scheduleAllFromPlayhead?.(...args),
        edFlushPendingCommit: (...args) =>
          flushPendingCommit?.(...args),
        edCommitTimerRef: () => getCommitTimer?.(),
        toast: (...args) => toast?.(...args),
        t: (...args) => translate?.(...args),
        logger
      });
      setAttached?.(true);
      return historyService;
    }

    return Object.freeze({ attach });
  }

  const service = Object.freeze({ create });
  globalScope.CoreHistoryBridgeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
