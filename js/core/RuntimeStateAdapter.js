/**
 * RuntimeStateAdapter — نقطه دسترسی کنترل‌شده به stateهای runtime
 *
 * مصرف‌کننده‌های مستقل از این adapter استفاده می‌کنند تا به bindingهای
 * داخلی app/core.js وابسته نباشند.
 */

(function attachRuntimeStateAdapter(globalScope) {
  let dawRuntime = null;
  let performanceRuntime = null;
  let dawState = null;
  let performanceState = null;

  function setDAW(state) {
    dawState = state && typeof state === 'object' ? state : null;
    dawRuntime = dawState && globalScope.DAWRuntimeAdapter?.create
      ? globalScope.DAWRuntimeAdapter.create(dawState)
      : null;
    return dawState;
  }

  function setPERF(state) {
    performanceState = state && typeof state === 'object' ? state : null;
    performanceRuntime =
      performanceState && globalScope.PerformanceRuntimeAdapter?.create
        ? globalScope.PerformanceRuntimeAdapter.create(performanceState)
        : null;
    return performanceState;
  }

  function getDAWRuntime() {
    return dawRuntime;
  }

  function getPerformanceRuntime() {
    return performanceRuntime;
  }

  const RuntimeStateAdapter = Object.freeze({
    setDAW,

    getDAW() {
      return getDAWRuntime()?.getState?.() || dawState || null;
    },

    getDAWAdapter() {
      return getDAWRuntime();
    },

    setPERF,

    getPERF() {
      return getPerformanceRuntime()?.getState?.() || performanceState || null;
    },

    getPERFAdapter() {
      return getPerformanceRuntime();
    },

    getPerformanceStore() {
      return globalScope.PerformanceStore || null;
    },

    getElectronAPI() {
      return globalScope.electronAPI || null;
    },

    getDAWOrThrow() {
      const daw = this.getDAW();
      if (!daw) throw new Error('RuntimeStateAdapter: DAW is unavailable');
      return daw;
    },

    getPERFOrThrow() {
      const perf = this.getPERF();
      if (!perf) throw new Error('RuntimeStateAdapter: PERF is unavailable');
      return perf;
    }
  });

  globalScope.RuntimeStateAdapter = RuntimeStateAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
