/*
 * CorePopupWindowBridgeService
 *
 * Owns popup lifecycle helpers while exposing the low-level WindowBridge to
 * core popup renderers that still need metadata/message operations.
 */
(function attachCorePopupWindowBridgeService(globalScope) {
  'use strict';

  function create({
    windowRef = globalScope,
    windowBridge = globalScope.WindowBridge,
    popupServiceFactory = () => globalScope.PopupWindowService?.create
  } = {}) {
    const createPopupService = popupServiceFactory?.();
    const popupWindowService =
      typeof createPopupService === 'function'
        ? createPopupService({ windowRef, windowBridge })
        : null;

    function isPopupOpen(popup) {
      return (
        popupWindowService?.isOpen?.(popup) ??
        Boolean(popup && !popup.closed)
      );
    }

    function popupDocument(popup) {
      return popupWindowService?.getDocument?.(popup) || null;
    }

    function openPopupWindow(name, features) {
      if (popupWindowService?.open) {
        return popupWindowService.open({
          url: '',
          name,
          features
        }) || null;
      }
      return windowBridge?.open?.({
        windowRef,
        url: '',
        name,
        features
      }) || null;
    }

    function focusPopupWindow(popup) {
      if (popupWindowService?.focus) {
        return popupWindowService.focus(popup);
      }
      return windowBridge?.focus?.(popup) ?? false;
    }

    return Object.freeze({
      windowBridge,
      isPopupOpen,
      popupDocument,
      openPopupWindow,
      focusPopupWindow
    });
  }

  const service = Object.freeze({ create });
  globalScope.CorePopupWindowBridgeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
