/**
 * CoreTimelineSectionBridgeService
 *
 * Lazily wires the existing TimelineSectionRendererService to core-owned
 * geometry, selection, drag, and persistence callbacks.
 */
(function attachCoreTimelineSectionBridgeService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    rendererFactory = () =>
      globalScope.TimelineSectionRendererService?.create,
    getDAW = () => globalScope.getEditorDAW?.() || globalScope.DAW,
    timeToX = value => value,
    xToTime = value => value,
    snapTime = value => value,
    roundMs = value => value,
    renderClips = () => {},
    selectedClips = () => [],
    startPointerDrag = () => {},
    getTimelineInner = () =>
      documentRef?.getElementById?.('tl-inner'),
    onDocumentMouseMove = () => {},
    onDocumentMouseUp = () => {},
    saveState = () => {}
  } = {}) {
    let renderer = null;

    function getTimelineSectionRendererService() {
      if (renderer) return renderer;
      const createRenderer = rendererFactory?.();
      if (typeof createRenderer !== 'function') return null;

      renderer = createRenderer({
        documentRef,
        windowRef,
        getDAW,
        timeToX,
        xToTime,
        snapTime,
        roundMs,
        renderClips,
        selectedClips,
        startPointerDrag,
        getTimelineInner,
        onDocumentMouseMove,
        onDocumentMouseUp,
        saveState
      });
      return renderer;
    }

    return Object.freeze({ getTimelineSectionRendererService });
  }

  const service = Object.freeze({ create });
  globalScope.CoreTimelineSectionBridgeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
