/**
 * WindowBridge
 *
 * A small, testable boundary for popup creation and cross-document messages.
 * Popup consumers may still use the returned Window/document during the
 * migration, but opening, lifecycle checks and message filtering live here.
 */
(function attachWindowBridge(globalScope) {
  function isOpen(popup) {
    if (!popup) return false;
    try {
      return popup.closed !== true;
    } catch (_) {
      return false;
    }
  }

  function getDocument(popup) {
    if (!isOpen(popup)) return null;
    try {
      return popup.document || null;
    } catch (_) {
      return null;
    }
  }

  function open({
    windowRef = globalScope,
    url = '',
    name = '',
    features = ''
  } = {}) {
    if (typeof windowRef?.open !== 'function') return null;
    return windowRef.open(url, name, features);
  }

  function focus(popup) {
    if (!isOpen(popup)) return false;
    try {
      popup.focus?.();
      return true;
    } catch (_) {
      return false;
    }
  }

  function close(popup) {
    if (!isOpen(popup)) return false;
    try {
      popup.close?.();
      return true;
    } catch (_) {
      return false;
    }
  }

  function onMessage({
    windowRef = globalScope,
    getSource = () => null,
    type = null,
    origin = '*',
    handler = () => {}
  } = {}) {
    if (!windowRef?.addEventListener || typeof handler !== 'function') {
      return () => {};
    }

    const listener = event => {
      if (origin !== '*' && event.origin !== origin) return;
      const source = typeof getSource === 'function' ? getSource() : getSource;
      if (source && event.source !== source) return;
      if (type && event.data?.type !== type) return;
      handler(event);
    };

    windowRef.addEventListener('message', listener);
    return () => windowRef.removeEventListener?.('message', listener);
  }

  function postMessage(popup, payload, targetOrigin = '*') {
    if (!isOpen(popup) || typeof popup.postMessage !== 'function') return false;
    popup.postMessage(payload, targetOrigin);
    return true;
  }

  function get(popup, property) {
    if (!isOpen(popup) || !property) return undefined;
    try {
      return popup[property];
    } catch (_) {
      return undefined;
    }
  }

  function set(popup, property, value) {
    if (!isOpen(popup) || !property) return false;
    try {
      popup[property] = value;
      return true;
    } catch (_) {
      return false;
    }
  }

  function call(popup, method, ...args) {
    if (!isOpen(popup) || !method) return false;
    try {
      const callback = popup[method];
      if (typeof callback !== 'function') return false;
      callback.apply(popup, args);
      return true;
    } catch (_) {
      return false;
    }
  }

  function dispatch(popup, event) {
    if (!isOpen(popup) || !event) return false;
    try {
      if (typeof popup.dispatchEvent !== 'function') return false;
      popup.dispatchEvent(event);
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearManagedNodes(popup, registryNames = []) {
    if (!isOpen(popup) || !Array.isArray(registryNames)) return false;
    let cleared = false;

    registryNames.forEach(name => {
      let registry;
      try {
        registry = popup[name];
      } catch (_) {
        registry = null;
      }
      if (!registry || typeof registry !== 'object') return;

      Object.keys(registry).forEach(key => {
        const element = registry[key];
        try {
          element?.remove?.();
        } catch (_) {}
        try {
          delete registry[key];
        } catch (_) {}
        cleared = true;
      });
    });

    return cleared;
  }

  const WindowBridge = Object.freeze({
    isOpen,
    getDocument,
    open,
    focus,
    close,
    onMessage,
    postMessage,
    get,
    set,
    call,
    dispatch,
    clearManagedNodes
  });

  globalScope.WindowBridge = WindowBridge;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WindowBridge;
  }
})(typeof window !== 'undefined' ? window : globalThis);
