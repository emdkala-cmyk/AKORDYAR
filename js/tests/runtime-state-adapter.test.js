const assert = require('node:assert/strict');

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
assert.equal(globalThis.DAW, undefined);
assert.equal(globalThis.PERF, undefined);
globalThis.RuntimeStateAdapter.setDAW(daw);
globalThis.RuntimeStateAdapter.setPERF(perf);
globalThis.electronAPI = electronAPI;

assert.equal(globalThis.RuntimeStateAdapter.getDAWOrThrow(), daw);
assert.equal(globalThis.RuntimeStateAdapter.getPERFOrThrow(), perf);
assert.equal(globalThis.RuntimeStateAdapter.getElectronAPI(), electronAPI);
assert.equal(globalThis.DAW, undefined);
assert.equal(globalThis.PERF, undefined);

console.log('RuntimeStateAdapter contract tests passed');
