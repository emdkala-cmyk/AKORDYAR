const assert = require('node:assert/strict');

globalThis.RuntimeStateAdapter = {
  getDAW: () => globalThis.__daw || null,
  getPERF: () => globalThis.__perf || null,
  getPerformanceStore: () => globalThis.PerformanceStore || null
};
globalThis.__daw = { clips: [] };
globalThis.__perf = { lastSerializedState: '' };
globalThis.PerformanceStore = { id: 'store' };

const adapter = require('../core/EditorRuntimeAdapter.js');
const song = { id: 'song-1' };

assert.equal(globalThis.getEditorDAW, undefined);
assert.equal(globalThis.getEditorPERF, undefined);
assert.equal(globalThis.getEditorSong, undefined);
assert.equal(globalThis.startEditorPointerDrag, undefined);
assert.equal(adapter.getDAW().clips.length, 0);
assert.equal(adapter.getDAWOrThrow(), globalThis.__daw);
assert.equal(adapter.getPERFOrThrow(), globalThis.__perf);
assert.equal(adapter.getPerformanceStore(), globalThis.PerformanceStore);
let songChange = null;
const unsubscribeSong = adapter.onSongChange(value => {
  songChange = value;
});
assert.equal(adapter.setSong(song), song);
assert.equal(adapter.getSong(), song);
assert.equal(songChange, song);
unsubscribeSong();

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

delete globalThis.__daw;
delete globalThis.__perf;
assert.throws(() => adapter.getDAWOrThrow(), /DAW is unavailable/);
assert.throws(() => adapter.getPERFOrThrow(), /PERF is unavailable/);

console.log('EditorRuntimeAdapter contract tests passed');
