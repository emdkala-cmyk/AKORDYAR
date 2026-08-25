/**
 * EditorTransportStateService
 *
 * Owns small transport-control state that is independent from DAW clips,
 * audio nodes and scheduler implementation.
 */
(function attachEditorTransportStateService(globalScope) {
  function create(overrides = {}) {
    const state = Object.assign({
      metroActive: false,
      metroTimer: null,
      countInBars: 0,
      snapEnabled: true,
      snapValue: 0.5,
      snapPreset: '1/4',
      returnToStartOnPause: true
    }, overrides && typeof overrides === 'object' ? overrides : {});

    return state;
  }

  const service = Object.freeze({ create });
  globalScope.EditorTransportStateService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
