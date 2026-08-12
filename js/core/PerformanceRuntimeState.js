/**
 * PerformanceRuntimeState
 *
 * Factory for the legacy PERF compatibility state. The runtime adapter owns
 * access; app/core.js remains the mutation/orchestration owner for now.
 */
(function attachPerformanceRuntimeState(globalScope) {
  function create(overrides = {}) {
    return Object.assign({
      lastSerializedState: '',
      lastSyncActiveLi: -2,
      lastSyncDoneKey: '',
      lastPopupActiveLi: -2,
      lastPopupDoneKey: '',
      lastEditorScrollTarget: -1,
      lastPopupScrollTarget: -1,
      lastSyncTimelinePct: -1,
      lastSyncTimeText: '',
      syncLinesCache: [],
      syncPanelNodes: [],
      rulerMajor: null,
      rulerTotal: -1,
      rulerWidth: -1,
      clipsVersion: 0,
      tracksVersion: 0,
      pendingRenderAll: false,
      pendingSyncPanelRender: false
    }, overrides && typeof overrides === 'object' ? overrides : {});
  }

  globalScope.PerformanceRuntimeState = Object.freeze({ create });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.PerformanceRuntimeState;
  }
})(typeof window !== 'undefined' ? window : globalThis);
