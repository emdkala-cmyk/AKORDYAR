/**
 * PopupWindowService
 *
 * A small lifecycle adapter shared by core.js and editor.js. The low-level
 * cross-window properties remain in WindowBridge; this service only provides
 * one stable contract for opening and checking popup windows.
 */
(function attachPopupWindowService(globalScope) {
  function fallbackIsOpen(popup) {
    if (!popup) return false;
    try {
      return popup.closed !== true;
    } catch (_) {
      return false;
    }
  }

  function fallbackGetDocument(popup) {
    if (!fallbackIsOpen(popup)) return null;
    try {
      return popup.document || null;
    } catch (_) {
      return null;
    }
  }

  function fallbackOpen(windowRef, { url = '', name = '', features = '' } = {}) {
    if (typeof windowRef?.open !== 'function') return null;
    return windowRef.open(url, name, features);
  }

  function fallbackFocus(popup) {
    if (!fallbackIsOpen(popup)) return false;
    try {
      popup.focus?.();
      return true;
    } catch (_) {
      return false;
    }
  }

  function fallbackClose(popup) {
    if (!fallbackIsOpen(popup)) return false;
    try {
      popup.close?.();
      return true;
    } catch (_) {
      return false;
    }
  }

  function create({
    windowRef = globalScope,
    windowBridge = globalScope.WindowBridge
  } = {}) {
    const bridge = windowBridge || {};

    const isOpen = popup => {
      if (typeof bridge.isOpen === 'function') {
        return bridge.isOpen(popup);
      }
      return fallbackIsOpen(popup);
    };

    const getDocument = popup => {
      if (!isOpen(popup)) return null;
      if (typeof bridge.getDocument === 'function') {
        return bridge.getDocument(popup) || null;
      }
      return fallbackGetDocument(popup);
    };

    const open = ({ url = '', name = '', features = '' } = {}) => {
      if (typeof bridge.open === 'function') {
        return bridge.open({ windowRef, url, name, features });
      }
      return fallbackOpen(windowRef, { url, name, features });
    };

    const focus = popup => {
      if (typeof bridge.focus === 'function') {
        return bridge.focus(popup);
      }
      return fallbackFocus(popup);
    };

    const close = popup => {
      if (typeof bridge.close === 'function') {
        return bridge.close(popup);
      }
      return fallbackClose(popup);
    };

    return Object.freeze({
      isOpen,
      getDocument,
      open,
      focus,
      close
    });
  }

  const PopupWindowService = Object.freeze({ create });
  globalScope.PopupWindowService = PopupWindowService;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PopupWindowService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
