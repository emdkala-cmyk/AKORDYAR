/*
 * EditorArrangerControllerService
 *
 * Builds the editor-facing arranger runtime from modern performance state and
 * injected editor operations. The controller owns the translation between the
 * shared state shape and the two focused arranger workflows.
 */
(function attachEditorArrangerControllerService(globalScope) {
  'use strict';

  function requireRuntimeService(runtimeService) {
    if (typeof runtimeService?.create !== 'function') {
      throw new Error(
        'EditorArrangerRuntimeService must be loaded before EditorArrangerControllerService.'
      );
    }
    return runtimeService;
  }

  function create({
    performanceState = {},
    arrangement = {},
    actions = {},
    ui = {},
    scheduling = {},
    logger = console,
    runtimeService = globalScope.EditorArrangerRuntimeService
  } = {}) {
    const getPerformanceState =
      performanceState.get || (() => ({}));
    const updatePerformanceState =
      performanceState.update || (() => {});

    function readPerformanceState() {
      return getPerformanceState?.() || {};
    }

    function getHotSwapPerformanceState() {
      const state = readPerformanceState();
      return {
        active: Boolean(state.active),
        pauseMode: Boolean(state.pauseMode),
        nextState: state.nextState || null
      };
    }

    function getSongLoadPerformanceState() {
      const state = readPerformanceState();
      return {
        active: Boolean(state.active),
        index: state.index ?? -1,
        pauseMode: Boolean(state.pauseMode),
        perfModeActive: Boolean(state.modeActive),
        nextState: state.nextState || null,
        preparePending: Boolean(state.preparePending),
        waitPollActive: Boolean(state.waitPollActive),
        hasLoggedNoNextSong: Boolean(state.hasLoggedNoNextSong),
        prepStartedForIndex: state.prepStartedForIndex ?? -1
      };
    }

    const runtime = requireRuntimeService(runtimeService).create({
      state: {
        getHotSwapPerformanceState,
        updateHotSwapPerformanceState: updatePerformanceState,
        getSongLoadPerformanceState,
        updateSongLoadPerformanceState: updatePerformanceState,
        ...arrangement
      },
      actions,
      ui,
      scheduling,
      logger
    });

    if (!runtime) {
      throw new Error('EditorArrangerRuntimeService failed to initialize.');
    }

    return Object.freeze({
      ...runtime,
      runtime,
      getHotSwapPerformanceState,
      getSongLoadPerformanceState
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorArrangerControllerService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
