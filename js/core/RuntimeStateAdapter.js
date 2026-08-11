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
    }
  });

  globalScope.RuntimeStateAdapter = RuntimeStateAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
