/*
 * CorePerformanceControllerService
 *
 * Owns performance-mode state and composes the performance runtime. The
 * application entrypoint supplies domain actions; this controller keeps the
 * state boundary modern and leaves the runtime services independently tested.
 */
(function attachCorePerformanceControllerService(globalScope) {
  'use strict';

  const hasOwn = (value, key) =>
    Object.prototype.hasOwnProperty.call(value, key);

  function requireRuntimeService(runtimeService) {
    if (typeof runtimeService?.create !== 'function') {
      throw new Error(
        'CorePerformanceRuntimeService must be loaded before CorePerformanceControllerService.'
      );
    }
    return runtimeService;
  }

  function create({
    actions = {},
    ui = {},
    timing = {},
    services = {},
    logger = console,
    runtimeService = globalScope.CorePerformanceRuntimeService
  } = {}) {
    const performanceState = {
      index: -1,
      active: false,
      data: null,
      preparePending: false,
      nextState: null,
      hasLoggedNoNextSong: false,
      prepStartedForIndex: -1,
      modeActive: false,
      stageMode: false,
      pauseMode: false,
      liveTranspose: 0,
      crossfading: false,
      backgroundPreloadActive: false,
      preloadedSongIds: new Set(),
      waitPollActive: false
    };

    const updateField = (patch, modernKey, legacyKey) => {
      if (hasOwn(patch, modernKey)) {
        performanceState[modernKey] = patch[modernKey];
      } else if (legacyKey && hasOwn(patch, legacyKey)) {
        performanceState[modernKey] = patch[legacyKey];
      }
    };

    function updateState(patch = {}) {
      if (!patch || typeof patch !== 'object') return;

      updateField(patch, 'index', 'arrPerformIdx');
      updateField(patch, 'active', 'arrPerformActive');
      updateField(patch, 'data', 'arrPerformData');
      updateField(patch, 'preparePending', 'arrPreparePending');
      updateField(patch, 'nextState', 'arrNextState');
      updateField(
        patch,
        'hasLoggedNoNextSong',
        'arrHasLoggedNoNextSong'
      );
      updateField(
        patch,
        'prepStartedForIndex',
        'arrPrepStartedForIndex'
      );
      updateField(patch, 'modeActive', 'perfModeActive');
      updateField(patch, 'stageMode', 'perfStageMode');
      updateField(patch, 'pauseMode', 'perfPauseMode');
      updateField(patch, 'liveTranspose', 'perfLiveTranspose');
      updateField(
        patch,
        'backgroundPreloadActive',
        'bgPreloadActive'
      );
      updateField(patch, 'preloadedSongIds', 'preloadedIds');
      updateField(patch, 'waitPollActive', 'arrWaitPollActive');
      updateField(patch, 'crossfading', 'isCrossfading');
    }

    function getState() {
      return {
        index: performanceState.index,
        active: performanceState.active,
        data: performanceState.data,
        preparePending: performanceState.preparePending,
        nextState: performanceState.nextState,
        hasLoggedNoNextSong: performanceState.hasLoggedNoNextSong,
        prepStartedForIndex: performanceState.prepStartedForIndex,
        modeActive: performanceState.modeActive,
        stageMode: performanceState.stageMode,
        pauseMode: performanceState.pauseMode,
        liveTranspose: performanceState.liveTranspose,
        crossfading: performanceState.crossfading,
        backgroundPreloadActive: performanceState.backgroundPreloadActive,
        preloadedSongIds: performanceState.preloadedSongIds,
        waitPollActive: performanceState.waitPollActive
      };
    }

    const getEditingArr = actions.getEditingArr || (() => null);
    const getPerformanceState = () => ({
      arrPerformData: performanceState.data,
      arrPerformIdx: performanceState.index,
      arrPerformActive: performanceState.active,
      perfModeActive: performanceState.modeActive,
      perfStageMode: performanceState.stageMode,
      perfPauseMode: performanceState.pauseMode,
      perfLiveTranspose: performanceState.liveTranspose,
      arrNextState: performanceState.nextState,
      bgPreloadActive: performanceState.backgroundPreloadActive,
      arrWaitPollActive: performanceState.waitPollActive,
      arrPreparePending: performanceState.preparePending,
      arrHasLoggedNoNextSong: performanceState.hasLoggedNoNextSong,
      arrPrepStartedForIndex: performanceState.prepStartedForIndex
    });

    const runtime = requireRuntimeService(runtimeService).create({
      state: {
        getPerformanceState,
        updatePerformanceState: updateState,
        getArranger: () => performanceState.data || getEditingArr(),
        getPreparationArranger: () =>
          performanceState.data || getEditingArr(),
        getPreloadArranger: () => performanceState.data,
        getCurrentIndex: () => performanceState.index,
        isActive: () => performanceState.active,
        hasLoggedNoNextSong: () =>
          performanceState.hasLoggedNoNextSong,
        setHasLoggedNoNextSong: value => {
          performanceState.hasLoggedNoNextSong = value;
        },
        setNextState: value => {
          performanceState.nextState = value;
        },
        getBackgroundActive: () =>
          performanceState.backgroundPreloadActive,
        setBackgroundActive: value => {
          performanceState.backgroundPreloadActive = value;
        },
        getPreloadedIds: () => performanceState.preloadedSongIds,
        setPreloadedIds: value => {
          performanceState.preloadedSongIds = value;
        },
        getCrossfadeDuration: () =>
          performanceState.data?.crossfade || 0,
        setIsCrossfading: value => {
          performanceState.crossfading = value;
        }
      },
      actions,
      ui,
      timing,
      services,
      logger
    });

    if (!runtime) {
      throw new Error('CorePerformanceRuntimeService failed to initialize.');
    }

    const state = Object.freeze({
      get index() {
        return performanceState.index;
      },
      get active() {
        return performanceState.active;
      },
      get data() {
        return performanceState.data;
      },
      get preparePending() {
        return performanceState.preparePending;
      },
      get nextState() {
        return performanceState.nextState;
      },
      get hasLoggedNoNextSong() {
        return performanceState.hasLoggedNoNextSong;
      },
      get prepStartedForIndex() {
        return performanceState.prepStartedForIndex;
      },
      get modeActive() {
        return performanceState.modeActive;
      },
      get stageMode() {
        return performanceState.stageMode;
      },
      get pauseMode() {
        return performanceState.pauseMode;
      },
      get liveTranspose() {
        return performanceState.liveTranspose;
      },
      get crossfading() {
        return performanceState.crossfading;
      },
      get backgroundPreloadActive() {
        return performanceState.backgroundPreloadActive;
      },
      get preloadedSongIds() {
        return performanceState.preloadedSongIds;
      },
      get waitPollActive() {
        return performanceState.waitPollActive;
      }
    });

    return Object.freeze({
      ...runtime,
      runtime,
      state,
      getState,
      updateState
    });
  }

  const service = Object.freeze({ create });
  globalScope.CorePerformanceControllerService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
