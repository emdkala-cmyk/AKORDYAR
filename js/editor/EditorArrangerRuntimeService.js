/**
 * EditorArrangerRuntimeService
 *
 * Composes the arranger loading and hot-swap workflows. The application
 * entrypoint supplies grouped runtime dependencies while the workflow
 * implementations remain isolated and testable.
 */
(function attachEditorArrangerRuntimeService(globalScope) {
  'use strict';

  function create({
    hotSwapService = globalScope.EditorArrangerHotSwapService,
    songLoadService = globalScope.EditorArrangerSongLoadService,
    state = {},
    actions = {},
    ui = {},
    scheduling = {},
    logger = console
  } = {}) {
    const {
      getHotSwapPerformanceState = () => ({}),
      updateHotSwapPerformanceState = () => {},
      getSongLoadPerformanceState = () => ({}),
      updateSongLoadPerformanceState = () => {},
      getArrangement = () => null,
      getAllSongs = () => [],
      getItemSetting = () => ({}),
      getDAW = () => null,
      getPlaybackPolicy = () => null,
      getProjectEnd = () => 0
    } = state;

    const {
      applyPreparedState = () => null,
      loadSong = async () => null,
      pauseTransport = () => {},
      stopAllVoices = () => {},
      setSelectionEnd = () => {},
      resetRecording = () => {},
      seekTransport = () => {},
      ensureAudioCtx = () => {},
      startTransport = () => {},
      prepareNextSong = () => Promise.resolve()
    } = actions;

    const {
      resetHistory = () => {},
      syncToolbar = () => {},
      renderEditor = () => {},
      renderAll = () => {},
      saveState = () => {},
      initHighlightEffect = () => {},
      syncUIAfterSongChange = () => {},
      renderPerfUI = () => {},
      toast = () => {},
      translate = key => key,
      getElement = () => null,
      mirrorTimeline = () => {}
    } = ui;

    const {
      schedule = (...args) => globalScope.setTimeout?.(...args)
    } = scheduling;

    const commonDependencies = {
      getArrangement,
      getDAW,
      getPlaybackPolicy,
      pauseTransport,
      stopAllVoices,
      setSelectionEnd,
      resetRecording,
      resetHistory,
      syncToolbar,
      renderEditor,
      renderAll,
      saveState,
      initHighlightEffect,
      syncUIAfterSongChange,
      renderPerfUI,
      toast,
      translate,
      seekTransport,
      prepareNextSong,
      mirrorTimeline,
      schedule,
      logger
    };

    const hotSwapRuntime =
      typeof hotSwapService?.create === 'function'
        ? hotSwapService.create({
            ...commonDependencies,
            getPerformanceState: getHotSwapPerformanceState,
            updatePerformanceState: updateHotSwapPerformanceState,
            applyPreparedState,
            getElement
          })
        : null;

    const songLoadRuntime =
      typeof songLoadService?.create === 'function'
        ? songLoadService.create({
            ...commonDependencies,
            getPerformanceState: getSongLoadPerformanceState,
            updatePerformanceState: updateSongLoadPerformanceState,
            getAllSongs,
            getItemSetting,
            loadSong,
            getProjectEnd,
            ensureAudioCtx,
            startTransport
          })
        : null;

    return Object.freeze({
      hotSwapToNextSong: (...args) =>
        hotSwapRuntime?.hotSwapToNextSong?.(...args),
      loadArrSong: (...args) => songLoadRuntime?.load?.(...args)
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorArrangerRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
