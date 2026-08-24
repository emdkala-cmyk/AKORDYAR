/**
 * CorePublicApi
 *
 * Publishes the small set of legacy-compatible core functions through one
 * explicit registry while keeping direct global aliases available.
 */
(function attachCorePublicApi(globalScope) {
  'use strict';

  function create({
    target = globalScope,
    namespace = 'AkordyarCoreApi'
  } = {}) {
    if (!target || typeof target !== 'object') {
      throw new TypeError('CorePublicApi requires a target object');
    }

    const published = Object.create(null);

    function publish(bindings = {}) {
      if (!bindings || typeof bindings !== 'object') {
        throw new TypeError('CorePublicApi.publish requires an object');
      }

      Object.entries(bindings).forEach(([name, value]) => {
        if (!name || typeof value !== 'function') {
          throw new TypeError(`CorePublicApi only publishes functions: ${name}`);
        }
        published[name] = value;
        target[name] = value;
      });

      const api = Object.freeze({ ...published });
      target[namespace] = api;
      return api;
    }

    function get(name) {
      return published[name] || null;
    }

    function has(name) {
      return typeof published[name] === 'function';
    }

    function snapshot() {
      return Object.freeze({ ...published });
    }

    return Object.freeze({
      publish,
      get,
      has,
      snapshot
    });
  }

  const service = Object.freeze({ create });
  globalScope.CorePublicApi = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
