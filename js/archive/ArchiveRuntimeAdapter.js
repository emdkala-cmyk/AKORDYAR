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

  getSongOrThrow() {
    const song = this.getSong();
    if (!song) {
      throw new Error('ArchiveRuntimeAdapter: editor song is unavailable');
    }
    return song;
  },

  setSong(song) {
    const setEdCur = archiveRuntimeGlobal.EdCurAdapter?.setEdCur;
    if (typeof setEdCur !== 'function') {
      throw new Error('ArchiveRuntimeAdapter: EdCurAdapter.setEdCur is unavailable');
    }
    setEdCur(song);
    return song;
  },

  getDAW() {
    return archiveRuntimeGlobal.RuntimeStateAdapter?.getDAW?.() || null;
  },

  getDAWOrThrow() {
    const daw = this.getDAW();
    if (!daw) {
      throw new Error('ArchiveRuntimeAdapter: DAW state is unavailable');
    }
    return daw;
  },

  getPERF() {
    return archiveRuntimeGlobal.RuntimeStateAdapter?.getPERF?.() || null;
  },

  getPERFOrThrow() {
    const perf = this.getPERF();
    if (!perf) {
      throw new Error('ArchiveRuntimeAdapter: PERF state is unavailable');
    }
    return perf;
  },

  getPerformanceStore() {
    return archiveRuntimeGlobal.RuntimeStateAdapter?.getPerformanceStore?.()
      || this.getPERF();
  },

  resetPerformanceSerialization() {
    const perf = this.getPerformanceStore();
    if (perf) perf.lastSerializedState = '';
  }
});

archiveRuntimeGlobal.ArchiveRuntimeAdapter = ArchiveRuntimeAdapter;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArchiveRuntimeAdapter;
}
