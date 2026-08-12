const assert = require('node:assert/strict');

globalThis.RuntimeStateAdapter = {
  getDAW: () => globalThis.DAW || null,
  getPERF: () => globalThis.PERF || null,
  getPerformanceStore: () => globalThis.PerformanceStore || null
};
globalThis.EdCurAdapter = {
  getEdCur: () => globalThis.edCur || null,
  setEdCur: value => {
    globalThis.edCur = value;
  }
};
globalThis.DAW = { clips: [] };
globalThis.PERF = { lastSerializedState: '' };
globalThis.PerformanceStore = { id: 'store' };

const adapter = require('../core/EditorRuntimeAdapter.js');
const song = { id: 'song-1' };

assert.equal(adapter.getDAW().clips.length, 0);
assert.equal(adapter.getDAWOrThrow(), globalThis.DAW);
assert.equal(adapter.getPERFOrThrow(), globalThis.PERF);
assert.equal(adapter.getPerformanceStore(), globalThis.PerformanceStore);
assert.equal(adapter.setSong(song), song);
assert.equal(adapter.getSong(), song);

const listeners = new Map();
const pointerTarget = {
  style: {},
  addEventListener(type, handler) {
    listeners.set(type, handler);
  },
  removeEventListener(type, handler) {
    if (listeners.get(type) === handler) listeners.delete(type);
  },
  setPointerCapture() {},
  releasePointerCapture() {}
};
let moveCalls = 0;
let endCalls = 0;
adapter.startPointerDrag(
  pointerTarget,
  { pointerId: 3 },
  () => { moveCalls++; },
  () => { endCalls++; }
);
listeners.get('pointermove')({ pointerId: 3 });
listeners.get('pointerup')({ pointerId: 3 });
assert.equal(moveCalls, 1);
assert.equal(endCalls, 1);
assert.equal(listeners.size, 0);
assert.equal(pointerTarget.style.touchAction, '');

delete globalThis.DAW;
delete globalThis.PERF;
assert.throws(() => adapter.getDAWOrThrow(), /DAW is unavailable/);
assert.throws(() => adapter.getPERFOrThrow(), /PERF is unavailable/);

console.log('EditorRuntimeAdapter contract tests passed');
