const assert = require('node:assert/strict');
const Adapter = require('../core/DAWRuntimeAdapter.js');

const state = { playhead: 2, clips: [] };
const adapter = Adapter.create(state);

assert.equal(adapter.getState(), state);
assert.equal(adapter.read('playhead'), 2);
adapter.write('playhead', 4);
assert.equal(state.playhead, 4);
adapter.update({ isPlaying: true });
assert.equal(state.isPlaying, true);

console.log('DAWRuntimeAdapter tests passed');
