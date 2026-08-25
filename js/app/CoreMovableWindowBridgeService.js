/*
 * CoreMovableWindowBridgeService
 *
 * Lazily owns the editor-facing bridge to EditorMovableWindowService while
 * keeping the legacy get/init aliases available to the application.
 */
(function attachCoreMovableWindowBridgeService(globalScope) {
  'use strict';

  function create({
    movableWindowFactory = () =>
      globalScope.EditorMovableWindowService?.create,
    documentRef = globalScope.document,
    windowRef = globalScope,
    startPointerDrag = (...args) =>
      globalScope.startEditorPointerDrag?.(...args)
  } = {}) {
    let movableWindowService = null;

    function getEditorMovableWindowService() {
      if (movableWindowService) return movableWindowService;
      const createService = movableWindowFactory?.();
      if (typeof createService !== 'function') {
        throw new Error(
          'EditorMovableWindowService is not loaded. Check script order.'
        );
      }
      movableWindowService = createService({
        documentRef,
        windowRef,
        startPointerDrag
      });
      return movableWindowService;
    }

    function initMovableWindows() {
      return getEditorMovableWindowService().bind();
    }

    return Object.freeze({
      getEditorMovableWindowService,
      initMovableWindows
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreMovableWindowBridgeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
