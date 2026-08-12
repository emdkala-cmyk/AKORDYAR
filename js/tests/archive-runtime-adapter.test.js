const assert = require('node:assert/strict');

const song = { id: 'song-1' };
const daw = { clips: [] };
const perf = { lastSerializedState: 'stale' };
const performanceStore = { lastSerializedState: 'stale-store' };
let currentSong = null;

globalThis.EdCurAdapter = {
  getEdCur: () => currentSong,
  setEdCur: value => {
    currentSong = value;
  }
};
globalThis.RuntimeStateAdapter = {
  getDAW: () => daw,
  getPERF: () => perf,
  getPerformanceStore: () => performanceStore
};

const adapter = require('../archive/ArchiveRuntimeAdapter.js');

assert.equal(adapter.getSong(), null);
assert.equal(adapter.setSong(song), song);
assert.equal(adapter.getSong(), song);
assert.equal(adapter.getSongOrThrow(), song);
assert.equal(adapter.getDAW(), daw);
assert.equal(adapter.getDAWOrThrow(), daw);
assert.equal(adapter.getPERF(), perf);
assert.equal(adapter.getPERFOrThrow(), perf);
assert.equal(adapter.getPerformanceStore(), performanceStore);

adapter.resetPerformanceSerialization();
assert.equal(performanceStore.lastSerializedState, '');

const originalRuntimeStateAdapter = globalThis.RuntimeStateAdapter;
globalThis.RuntimeStateAdapter = {};
assert.throws(() => adapter.getDAWOrThrow(), /DAW state is unavailable/);
assert.throws(() => adapter.getPERFOrThrow(), /PERF state is unavailable/);
globalThis.RuntimeStateAdapter = originalRuntimeStateAdapter;

console.log('ArchiveRuntimeAdapter contract tests passed');
