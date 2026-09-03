/*
 * CorePerformanceRuntimeService
 *
 * Composes the performance-mode, preparation, preload, crossfade and
 * performance-dashboard runtimes. The application entrypoint supplies state
 * accessors and domain operations; the individual services stay isolated.
 */
(function attachCorePerformanceRuntimeService(globalScope) {
  'use strict';

  function requireService(service, name) {
    if (typeof service?.create !== 'function') {
      throw new Error(
        `${name} باید قبل از CorePerformanceRuntimeService بارگذاری شود.`
      );
    }
    return service;
  }

  function create({
    state = {},
    actions = {},
    ui = {},
    timing = {},
    services = {},
    logger = console
  } = {}) {
    const {
      getPerformanceState = () => ({}),
      updatePerformanceState = () => {},
      getArranger = () => null,
      getPreparationArranger = getArranger,
      getPreloadArranger = getArranger,
      getCurrentIndex = () => -1,
      isActive = () => false,
      hasLoggedNoNextSong = () => false,
      setHasLoggedNoNextSong = () => {},
      setNextState = () => {},
      getBackgroundActive = () => false,
      setBackgroundActive = () => {},
      getPreloadedIds = () => new Set(),
      setPreloadedIds = () => {},
      getCrossfadeDuration = () => 0,
      setIsCrossfading = () => {}
    } = state;

    const {
      getDAW = () => null,
      getEditingArr = () => null,
      getAllSongs = () => [],
      getItemSetting = () => ({}),
      getPerformanceMarkers = () => null,
      getSongMarkers = () => null,
      createPlaybackBoundary = () => null,
      preloadAudioForSong = async () => ({}),
      peaksFromBuffer = () => [],
      restoreAudioForProjectSilently = async () => ({}),
      loadArrSong = () => Promise.resolve(),
      hotSwapToNextSong = () => {},
      stopAllVoices = () => {},
      pauseTransport = () => {},
      startTransport = () => {},
      seekTransport = () => {},
      ensureAudioCtx = () => {},
      scheduleAllFromPlayhead = () => {},
      saveArrangers = () => {},
      getSongState = () => null,
      getTimingContext = () =>
        getSongState?.()?.getTimingContext?.() || {},
      saveSong = () => {},
      handleTimingChange = () => {},
      getArrangerEnd = () => 0,
      getCurrentSong = () => null,
      ensureArrItem = () => ({}),
      closeArrangerModal = () => {},
      openLyricOnlyPopup = () => {},
      openLyricPopup = () => {},
      startPointerDrag = () => {}
    } = actions;

    const {
      documentRef = globalScope.document,
      getElement = id => documentRef?.getElementById?.(id),
      getActiveElement = () => documentRef?.activeElement
    } = ui;

    const {
      clamp = (value, min, max) => Math.max(min, Math.min(max, value)),
      translate = key => key,
      toast = () => {},
      schedule = (...args) => globalScope.setTimeout?.(...args),
      setIntervalRef = (...args) => globalScope.setInterval?.(...args),
      clearIntervalRef = (...args) => globalScope.clearInterval?.(...args),
      now = () => Date.now(),
      wait = delay => new Promise(resolve => setTimeout(resolve, delay))
    } = timing;

    const {
      performanceModeService = globalScope.CorePerformanceModeService,
      preparationService = globalScope.CoreArrangerPreparationService,
      backgroundPreloadService =
        globalScope.CoreArrangerBackgroundPreloadService,
      crossfadeService = globalScope.CoreArrangerCrossfadeService,
      performanceUiService = globalScope.CorePerformanceUiService
    } = services;

    let backgroundPreloadRuntime = null;
    let performanceUiRuntime = null;

    function renderPerfUI(...args) {
      return performanceUiRuntime?.render?.(...args);
    }

    function startBackgroundPreload(...args) {
      return backgroundPreloadRuntime?.start?.(...args);
    }

    const preparationRuntime = requireService(
      preparationService,
      'CoreArrangerPreparationService'
    ).create({
      getArranger: getPreparationArranger,
      getCurrentIndex,
      isActive,
      hasLoggedNoNextSong,
      setHasLoggedNoNextSong,
      setNextState,
      getAllSongs,
      preloadAudioForSong,
      getDAW,
      createPlaybackBoundary,
      getArrangerMarkers: getSongMarkers,
      getItemSetting,
      peaksFromBuffer,
      restoreAudioForProjectSilently,
      wait,
      logger
    });

    const performanceModeRuntime = requireService(
      performanceModeService,
      'CorePerformanceModeService'
    ).create({
      getElement,
      getActiveElement,
      getEditingArr,
      getPerformanceState,
      updatePerformanceState,
      getDAW,
      getArrangerMarkers: getPerformanceMarkers,
      ensureArrItem,
      loadArrSong,
      renderPerfUI,
      startBackgroundPreload,
      closeArrangerModal,
      openLyricOnlyPopup,
      openLyricPopup,
      pauseTransport,
      startTransport,
      seekTransport,
      ensureAudioCtx,
      scheduleAllFromPlayhead,
      saveArrangers,
      getSongState,
      getTimingContext,
      saveSong,
      handleTimingChange,
      startPointerDrag,
      clamp,
      translate,
      toast,
      schedule,
      setIntervalRef,
      clearIntervalRef,
      now,
      logger
    });

    backgroundPreloadRuntime = requireService(
      backgroundPreloadService,
      'CoreArrangerBackgroundPreloadService'
    ).create({
      getArranger: getPreloadArranger,
      getActive: getBackgroundActive,
      setActive: setBackgroundActive,
      getPreloadedIds,
      setPreloadedIds,
      getAllSongs,
      getDAW,
      preloadAudioForSong,
      wait,
      logger
    });

    const crossfadeRuntime = requireService(
      crossfadeService,
      'CoreArrangerCrossfadeService'
    ).create({
      getCrossfadeDuration,
      hasNextState: () => Boolean(getPerformanceState?.().nextState),
      setIsCrossfading,
      ensureAudioCtx,
      getDAW,
      stopAllVoices,
      hotSwapToNextSong,
      schedule,
      logger
    });

    performanceUiRuntime = requireService(
      performanceUiService,
      'CorePerformanceUiService'
    ).create({
      documentRef,
      getElement,
      getPerformanceState,
      getAllSongs,
      getItemSetting,
      getCurrentSong,
      getDAW,
      getArrangerEnd,
      jumpToSong: index => performanceModeRuntime.perfJumpToSong(index),
      saveArrangers,
      seekTransport,
      ensureAudioCtx,
      startTransport
    });

    const publicApi = Object.freeze({
      openPerfMode: performanceModeRuntime.openPerfMode,
      perfStop: performanceModeRuntime.perfStop,
      perfTogglePauseMode: performanceModeRuntime.perfTogglePauseMode,
      perfTogglePlay: performanceModeRuntime.perfTogglePlay,
      perfRestartSong: performanceModeRuntime.perfRestartSong,
      perfPrevSong: performanceModeRuntime.perfPrevSong,
      perfNextSong: performanceModeRuntime.perfNextSong,
      perfTranspose: performanceModeRuntime.perfTranspose,
      perfTempoChange: performanceModeRuntime.perfTempoChange,
      perfJumpToSong: performanceModeRuntime.perfJumpToSong,
      startPerfTimer: performanceModeRuntime.startPerfTimer,
      stopPerfTimer: performanceModeRuntime.stopPerfTimer,
      startArrangerPerform: performanceModeRuntime.startArrangerPerform,
      startBackgroundPreload,
      renderPerfUI,
      prepareNextArrSong: (...args) =>
        preparationRuntime?.prepare?.(...args),
      arrCrossfadeSwap: (...args) =>
        crossfadeRuntime?.swap?.(...args)
    });

    return Object.freeze({
      ...publicApi,
      performanceModeRuntime,
      preparationRuntime,
      backgroundPreloadRuntime,
      crossfadeRuntime,
      performanceUiRuntime,
      publicApi,
      runtimes: Object.freeze({
        performanceMode: performanceModeRuntime,
        preparation: preparationRuntime,
        backgroundPreload: backgroundPreloadRuntime,
        crossfade: crossfadeRuntime,
        performanceUi: performanceUiRuntime
      })
    });
  }

  const service = Object.freeze({ create });
  globalScope.CorePerformanceRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
