/**
 * ArchivePublicApi
 *
 * Keeps archive actions behind one explicit, frozen namespace. ArchiveModule
 * remains a classic script for now, but its implementation details are not
 * part of the application-wide global surface.
 */
(function attachArchivePublicApi(globalScope) {
  'use strict';

  function create({
    target = globalScope,
    namespace = 'AkordyarArchiveApi'
  } = {}) {
    if (!target || typeof target !== 'object') {
      throw new TypeError('ArchivePublicApi target must be an object');
    }

    const published = Object.create(null);

    function publish(bindings = {}) {
      if (!bindings || typeof bindings !== 'object') {
        throw new TypeError('ArchivePublicApi bindings must be an object');
      }

      Object.entries(bindings).forEach(([name, value]) => {
        if (!name || typeof value !== 'function') {
          throw new TypeError(
            `ArchivePublicApi binding "${name}" must be a function`
          );
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

  const api = Object.freeze({ create });
  globalScope.ArchivePublicApi = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
