const assert = require('node:assert/strict');

delete globalThis.DAW;
delete globalThis.PERF;
delete globalThis.PerformanceStore;
delete globalThis.electronAPI;

require('../core/RuntimeStateAdapter.js');

assert.equal(globalThis.RuntimeStateAdapter.getDAW(), null);
assert.equal(globalThis.RuntimeStateAdapter.getPERF(), null);
assert.equal(globalThis.RuntimeStateAdapter.getPerformanceStore(), null);
assert.equal(globalThis.RuntimeStateAdapter.getElectronAPI(), null);
assert.throws(
  () => globalThis.RuntimeStateAdapter.getDAWOrThrow(),
  /DAW is unavailable/
);
assert.throws(
  () => globalThis.RuntimeStateAdapter.getPERFOrThrow(),
  /PERF is unavailable/
);

const daw = { id: 'daw' };
const perf = { id: 'perf' };
const electronAPI = { isElectron: true };
globalThis.DAW = daw;
globalThis.PERF = perf;
globalThis.electronAPI = electronAPI;

assert.equal(globalThis.RuntimeStateAdapter.getDAWOrThrow(), daw);
assert.equal(globalThis.RuntimeStateAdapter.getPERFOrThrow(), perf);
assert.equal(globalThis.RuntimeStateAdapter.getElectronAPI(), electronAPI);

console.log('RuntimeStateAdapter contract tests passed');
