/*
 * CoreSyncModeBridgeService
 *
 * Owns the lazy SyncModeController bridge and keeps the legacy wrapper names
 * available to the editor, transport and inline command paths.
 */
(function attachCoreSyncModeBridgeService(globalScope) {
  'use strict';

  const METHOD_NAMES = Object.freeze([
    'renderSyncLyrics',
    'selectSyncLine',
    'syncTap',
    'updateSyncHighlight',
    'syncTick',
    'enterSyncMode',
    'exitSyncMode',
    'edToggleSeqMode',
    'edStartSeqChording',
    'edSeqNavigate',
    'edUpdateClCount',
    'edRenderClMarkers',
    'edSetSeqMode',
    'edToggleClTap',
    'edClTap',
    'edClUndoMarker',
    'edClClearMarkers',
    'edClApplyMarkers',
    'initSyncUI'
  ]);

  function create({
    controllerClass = globalScope.SyncModeController,
    state,
    seqState,
    getDAW,
    songState,
    getElement,
    translate,
    toast,
    saveSong,
    startTransport,
    pauseTransport,
    seekTransport,
    getProjectEnd,
    getLyricPopup,
    getLyricOnlyPopup,
    getChordLinePopup,
    renderChords,
    commit,
    saveState,
    renderAll,
    uid,
    roundMs,
    ensureTimelineFits,
    timeToX,
    formatTime,
    openChordLinePopup,
    getPerformanceStore,
    applyHighlightClassToEditor,
    windowRef = globalScope,
    windowBridge = globalScope.WindowBridge,
    logger = console
  } = {}) {
    let controller = null;

    function createSyncModeControllerBridge() {
      if (controller) return controller;
      if (typeof controllerClass !== 'function') return null;

      controller = new controllerClass({
        state,
        seqState,
        getDAW,
        songState,
        $: getElement,
        t: translate,
        toast,
        edSaveSong: saveSong,
        startTransport,
        pauseTransport,
        seekTransport,
        getProjectEnd,
        getLyricPopup,
        getLyricOnlyPopup,
        getChordLinePopup,
        edRenderChords: renderChords,
        edCommit: commit,
        saveState,
        renderAll,
        uid,
        roundMs,
        ensureTimelineFits,
        timeToX,
        formatTime,
        openChordLinePopup,
        getPerformanceStore,
        applyHighlightClassToEditor,
        windowRef,
        windowBridge,
        logger
      });
      return controller;
    }

    function requireSyncModeController() {
      const runtime = createSyncModeControllerBridge();
      if (!runtime) {
        throw new Error(
          'SyncModeController در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.'
        );
      }
      return runtime;
    }

    const runtime = {
      createSyncModeControllerBridge,
      requireSyncModeController
    };

    METHOD_NAMES.forEach(methodName => {
      runtime[methodName] = (...args) =>
        requireSyncModeController()[methodName](...args);
    });

    return Object.freeze(runtime);
  }

  const service = Object.freeze({ create });
  globalScope.CoreSyncModeBridgeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
