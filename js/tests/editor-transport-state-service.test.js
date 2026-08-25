const assert = require('node:assert/strict');
const EditorTransportStateService = require(
  '../core/EditorTransportStateService.js'
);

const state = EditorTransportStateService.create();
assert.deepEqual(state, {
  metroActive: false,
  metroTimer: null,
  countInBars: 0,
  snapEnabled: true,
  snapValue: 0.5,
  snapPreset: '1/4',
  returnToStartOnPause: true
});

state.metroActive = true;
state.metroTimer = true;
state.countInBars = 2;
state.snapEnabled = false;
state.snapValue = 0.25;
state.snapPreset = '1/8';
state.returnToStartOnPause = false;
assert.equal(state.metroActive, true);
assert.equal(state.countInBars, 2);
assert.equal(state.snapPreset, '1/8');
assert.equal(state.returnToStartOnPause, false);

const overridden = EditorTransportStateService.create({
  countInBars: 1,
  snapPreset: '1/2'
});
assert.equal(overridden.countInBars, 1);
assert.equal(overridden.snapPreset, '1/2');
assert.equal(overridden.metroActive, false);

console.log('EditorTransportStateService tests passed');
