/**
 * ArchiveRuntimeAdapter — runtime contract for archive workflows.
 *
 * ArchiveModule should use this boundary instead of reaching into app/core
 * globals directly. The adapter keeps legacy globals behind the existing
 * EdCurAdapter and RuntimeStateAdapter contracts.
 */
const archiveRuntimeGlobal = typeof window !== 'undefined' ? window : globalThis;

const ArchiveRuntimeAdapter = Object.freeze({
  getSong() {
    return archiveRuntimeGlobal.EdCurAdapter?.getEdCur?.() || null;
  },

  setSong(song) {
    archiveRuntimeGlobal.EdCurAdapter?.setEdCur?.(song);
    return song;
  },

  getDAW() {
    return archiveRuntimeGlobal.RuntimeStateAdapter?.getDAW?.() || null;
  },

  getPERF() {
    return archiveRuntimeGlobal.RuntimeStateAdapter?.getPERF?.() || null;
  },

  resetPerformanceSerialization() {
    const perf = this.getPERF();
    if (perf) perf.lastSerializedState = '';
  }
});

archiveRuntimeGlobal.ArchiveRuntimeAdapter = ArchiveRuntimeAdapter;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArchiveRuntimeAdapter;
}
