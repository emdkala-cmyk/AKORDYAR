/**
 * RuntimeStateAdapter — نقطه دسترسی کنترل‌شده به stateهای runtime
 *
 * مصرف‌کننده‌های مستقل از این adapter استفاده می‌کنند تا به bindingهای
 * داخلی app/core.js وابسته نباشند.
 */

(function attachRuntimeStateAdapter(globalScope) {
  let dawRuntime = null;
  let performanceRuntime = null;

  function getDAWRuntime() {
    if (
      !dawRuntime &&
      globalScope.DAWRuntimeAdapter?.create &&
      globalScope.DAW
    ) {
      dawRuntime = globalScope.DAWRuntimeAdapter.create(globalScope.DAW);
    }
    return dawRuntime;
  }

  function getPerformanceRuntime() {
    if (
      !performanceRuntime &&
      globalScope.PerformanceRuntimeAdapter?.create &&
      globalScope.PERF
    ) {
      performanceRuntime =
        globalScope.PerformanceRuntimeAdapter.create(globalScope.PERF);
    }
    return performanceRuntime;
  }

  const RuntimeStateAdapter = Object.freeze({
    getDAW() {
      return getDAWRuntime()?.getState?.() || globalScope.DAW || null;
    },

    getDAWAdapter() {
      return getDAWRuntime();
    },

    getPERF() {
      return getPerformanceRuntime()?.getState?.() || globalScope.PERF || null;
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
