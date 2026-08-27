/**
 * CoreMixerBridgeService
 *
 * Keeps the application-facing mixer wiring outside core.js. The existing
 * EditorMixerService remains the owner of volume, pan, mute, solo and mixer
 * DOM behavior; this bridge only provides lazy construction and legacy names.
 */
(function attachCoreMixerBridgeService(globalScope) {
  'use strict';

  function create({
    mixerFactory = () => globalScope.EditorMixerService?.create,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getElement = id => globalScope.document?.getElementById?.(id),
    documentRef = globalScope.document,
    windowRef = globalScope,
    saveState = () => {},
    renderTracks = () => {},
    renderClips = () => {},
    scheduleAllFromPlayhead = () => {},
    startPointerDrag = (...args) =>
      globalScope.EditorRuntimeAdapter?.startPointerDrag?.(...args)
  } = {}) {
    let mixer = null;

    function getEditorMixerService() {
      if (mixer) return mixer;
      const factory = mixerFactory();
      if (typeof factory !== 'function') return null;

      mixer = factory({
        getDAW,
        getElement,
        documentRef,
        windowRef,
        saveState,
        renderTracks,
        renderClips,
        scheduleAllFromPlayhead,
        startPointerDrag
      });
      return mixer;
    }

    function updateTrackMix(trackId) {
      return getEditorMixerService()?.updateTrackMix?.(trackId);
    }

    function toggleMixer() {
      return getEditorMixerService()?.toggle?.();
    }

    function renderMixer() {
      return getEditorMixerService()?.render?.();
    }

    function initMixerDrag() {
      return getEditorMixerService()?.initDrag?.();
    }

    return Object.freeze({
      getEditorMixerService,
      updateTrackMix,
      toggleMixer,
      renderMixer,
      initMixerDrag
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreMixerBridgeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
