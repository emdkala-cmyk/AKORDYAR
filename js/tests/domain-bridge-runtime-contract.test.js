const assert = require('node:assert/strict');

const calls = [];
globalThis.RuntimeStateAdapter = {
  getPerformanceStore: () => globalThis.PerformanceStore || null
};
globalThis.EditorRuntimeAdapter = {
  getSong: () => ({ id: 'song-1' })
};
globalThis.rebuildPerformanceSongDocument = () => calls.push('rebuild');
globalThis.syncViewStylesFromSong = () => calls.push('styles');
globalThis.publishPerformanceState = () => calls.push('publish');
globalThis.PerformanceStore = {
  resetStore: () => calls.push('reset')
};

const bridge = require('../core/DomainBridge.js');

assert.equal(bridge.getSong().id, 'song-1');
assert.equal(bridge.getPerformanceStore(), globalThis.PerformanceStore);
bridge.onSongChanged();
bridge.onKeyOrTransposeChanged();
bridge.onProjectLoaded();
assert.deepEqual(calls, [
  'rebuild', 'styles',
  'rebuild', 'publish',
  'reset', 'rebuild', 'styles'
]);

delete globalThis.rebuildPerformanceSongDocument;
delete globalThis.syncViewStylesFromSong;
delete globalThis.publishPerformanceState;
delete globalThis.PerformanceStore;
assert.doesNotThrow(() => bridge.onContentChanged());

console.log('DomainBridge runtime contract tests passed');
