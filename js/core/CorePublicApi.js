/**
 * CorePublicApi
 *
 * Publishes the small set of core functions through one explicit namespace.
 * Direct globals remain opt-in during the migration away from legacy callers.
 */
(function attachCorePublicApi(globalScope) {
  'use strict';

  function create({
    target = globalScope,
    namespace = 'AkordyarCoreApi',
    exposeGlobals = true
  } = {}) {
    if (!target || typeof target !== 'object') {
      throw new TypeError('CorePublicApi requires a target object');
    }

    const published = Object.create(null);

    function publish(
      bindings = {},
      publishOptions = {}
    ) {
      if (!bindings || typeof bindings !== 'object') {
        throw new TypeError('CorePublicApi.publish requires an object');
      }
      const shouldExposeGlobals =
        typeof publishOptions.exposeGlobals === 'boolean'
          ? publishOptions.exposeGlobals
          : exposeGlobals;

      Object.entries(bindings).forEach(([name, value]) => {
        if (!name || typeof value !== 'function') {
          throw new TypeError(`CorePublicApi only publishes functions: ${name}`);
        }
        published[name] = value;
        if (shouldExposeGlobals) target[name] = value;
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
