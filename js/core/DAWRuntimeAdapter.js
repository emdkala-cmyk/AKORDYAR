/**
 * DAWRuntimeAdapter
 *
 * Controlled access to the legacy DAW object. The adapter is intentionally
 * small: core still owns the mutable state, while consumers receive it
 * lazily through this boundary.
 */
(function attachDAWRuntimeAdapter(globalScope) {
  function create(state = globalScope.DAW) {
    const runtimeState = state && typeof state === 'object' ? state : null;

    return Object.freeze({
      getState: () => runtimeState,
      read: key => runtimeState?.[key],
      write: (key, value) => {
        if (runtimeState) runtimeState[key] = value;
        return value;
      },
      update: values => {
        if (runtimeState && values && typeof values === 'object') {
          Object.assign(runtimeState, values);
        }
        return runtimeState;
      }
    });
  }

  globalScope.DAWRuntimeAdapter = Object.freeze({ create });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.DAWRuntimeAdapter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
