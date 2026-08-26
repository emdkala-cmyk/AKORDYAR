/**
 * CoreArrangerMarkerBridgeService
 *
 * Creates and exposes the editor-owned arranger marker controller without
 * making core responsible for its implementation or lifecycle wiring.
 */
(function attachCoreArrangerMarkerBridgeService(globalScope) {
  'use strict';

  function create({
    controllerFactory = () =>
      globalScope.EditorArrangerMarkerControllerService?.create,
    getDAW = () => globalScope.getEditorDAW?.() || globalScope.DAW,
    markerService = globalScope.ArrangerMarkerService,
    getProjectEnd = () => globalScope.getProjectEnd?.() || 0,
    timeToX = value => value,
    xToTime = value => value,
    clamp = (value, minimum, maximum) =>
      Math.max(minimum, Math.min(maximum, value)),
    getElement = id => globalScope.document?.getElementById?.(id),
    documentRef = globalScope.document,
    isPerforming = () => false,
    startPointerDrag = () => {},
    saveState = () => {},
    saveSong = () => {},
    toast = () => {},
    formatTime = value => String(value)
  } = {}) {
    const createController = controllerFactory?.();
    if (typeof createController !== 'function') return null;

    const controller = createController({
      getDAW,
      markerService,
      getProjectEnd,
      timeToX,
      xToTime,
      clamp,
      getElement,
      documentRef,
      isPerforming,
      startPointerDrag,
      saveState,
      saveSong,
      toast,
      formatTime
    });
    if (!controller) return null;
    controller.bindDrag?.();

    return Object.freeze({
      getArrangerMarkers: (...args) =>
        controller.getArrangerMarkers?.(...args),
      persistArrangerMarkers: (...args) =>
        controller.persistArrangerMarkers?.(...args),
      setArrangerA: (...args) => controller.setArrangerA?.(...args),
      setArrangerB: (...args) => controller.setArrangerB?.(...args),
      clearArrangerMarkers: (...args) =>
        controller.clearArrangerMarkers?.(...args),
      toggleArrangerMarkers: (...args) =>
        controller.toggleArrangerMarkers?.(...args),
      renderArrangerMarkers: (...args) =>
        controller.renderArrangerMarkers?.(...args)
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerMarkerBridgeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
