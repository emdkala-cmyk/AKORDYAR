const assert = require('node:assert/strict');

const song = { id: 'song-1' };
const daw = { clips: [] };
const perf = { lastSerializedState: 'stale' };
let currentSong = null;

globalThis.EdCurAdapter = {
  getEdCur: () => currentSong,
  setEdCur: value => {
    currentSong = value;
  }
};
globalThis.RuntimeStateAdapter = {
  getDAW: () => daw,
  getPERF: () => perf
};

const adapter = require('../archive/ArchiveRuntimeAdapter.js');

assert.equal(adapter.getSong(), null);
assert.equal(adapter.setSong(song), song);
assert.equal(adapter.getSong(), song);
assert.equal(adapter.getDAW(), daw);
assert.equal(adapter.getPERF(), perf);

adapter.resetPerformanceSerialization();
assert.equal(perf.lastSerializedState, '');

console.log('ArchiveRuntimeAdapter contract tests passed');
