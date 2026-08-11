/**
 * RuntimeStateAdapter — نقطه دسترسی کنترل‌شده به stateهای runtime
 *
 * مصرف‌کننده‌های مستقل از این adapter استفاده می‌کنند تا به bindingهای
 * داخلی app/core.js وابسته نباشند.
 */

(function attachRuntimeStateAdapter(globalScope) {
  const RuntimeStateAdapter = Object.freeze({
    getDAW() {
      return globalScope.DAW || null;
    },

    getPERF() {
      return globalScope.PERF || null;
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
