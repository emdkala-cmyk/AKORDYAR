/**
 * PerformanceRuntimeAdapter
 *
 * Gives the performance runtime a controlled state boundary. The owner is
 * registered by RuntimeStateAdapter and is never published as a raw global.
 */
(function attachPerformanceRuntimeAdapter(globalScope) {
  function create(state = {}) {
    const runtimeState = state && typeof state === 'object' ? state : {};

    return Object.freeze({
      getState: () => runtimeState,
      read: key => runtimeState[key],
      write: (key, value) => {
        runtimeState[key] = value;
        return value;
      },
      update: values => {
        if (values && typeof values === 'object') {
          Object.assign(runtimeState, values);
        }
        return runtimeState;
      },
      reset: () => {
        Object.keys(runtimeState).forEach(key => delete runtimeState[key]);
        return runtimeState;
      }
    });
  }

  globalScope.PerformanceRuntimeAdapter = Object.freeze({ create });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.PerformanceRuntimeAdapter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
