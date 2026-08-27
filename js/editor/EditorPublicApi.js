/**
 * EditorPublicApi
 *
 * Publishes editor actions through one explicit namespace. The editor script
 * can register its public surface incrementally without copying individual
 * functions onto the global object.
 */
(function attachEditorPublicApi(globalScope) {
  'use strict';

  function create({
    target = globalScope,
    namespace = 'AkordyarEditorApi'
  } = {}) {
    if (!target || typeof target !== 'object') {
      throw new TypeError('EditorPublicApi requires a target object');
    }

    const published = Object.create(null);

    function publish(bindings = {}) {
      if (!bindings || typeof bindings !== 'object') {
        throw new TypeError('EditorPublicApi.publish requires an object');
      }

      Object.entries(bindings).forEach(([name, value]) => {
        if (!name || typeof value !== 'function') {
          throw new TypeError(`EditorPublicApi only publishes functions: ${name}`);
        }
        published[name] = value;
      });

      const api = Object.freeze({ ...published });
      target[namespace] = api;
      return api;
    }

    return Object.freeze({
      publish,
      get: name => published[name] || null,
      has: name => typeof published[name] === 'function',
      snapshot: () => Object.freeze({ ...published })
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorPublicApi = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
