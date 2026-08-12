const assert = require('node:assert/strict');

const calls = [];
globalThis.RuntimeStateAdapter = {
  getPerformanceStore: () => globalThis.PerformanceStore || null
};
globalThis.EdCurAdapter = {
  getEdCur: () => ({ id: 'song-1' })
};
globalThis.rebuildSongDocumentFromEdCur = () => calls.push('rebuild');
globalThis.syncViewStylesFromEdCur = () => calls.push('styles');
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

delete globalThis.rebuildSongDocumentFromEdCur;
delete globalThis.syncViewStylesFromEdCur;
delete globalThis.publishPerformanceState;
delete globalThis.PerformanceStore;
assert.doesNotThrow(() => bridge.onContentChanged());

console.log('DomainBridge runtime contract tests passed');
