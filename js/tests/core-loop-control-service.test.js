const assert = require('node:assert/strict');
const LoopControlService = require('../app/CoreLoopControlService.js');

function createClassList() {
  const values = new Set();
  return {
    values,
    toggle(name, force) {
      const shouldAdd = force === undefined ? !values.has(name) : force;
      if (shouldAdd) values.add(name);
      else values.delete(name);
    },
    add(name) {
      values.add(name);
    },
    contains(name) {
      return values.has(name);
    }
  };
}

const button = { classList: createClassList() };
const daw = {
  loopEnabled: false,
  loopA: 0,
  loopB: 10,
  playhead: 4,
  isPlaying: false,
  rafId: 22
};
const selected = [
  { start: 8, duration: 3 },
  { start: 2, duration: 4 }
];
const calls = [];
let selectionEnd = 99;
let performing = false;
let snapEnabled = false;
let snapCalls = 0;

const service = LoopControlService.create({
  getDAW: () => daw,
  getElement: id => id === 'loopToggleBtn' ? button : null,
  isPerforming: () => performing,
  getSelectedClips: () => selected,
  setSelectionEnd: value => {
    selectionEnd = value;
  },
  renderLoopRegion: () => calls.push('render'),
  updatePlayheadUI: () => calls.push('playhead'),
  startTransport: () => calls.push('start'),
  stopAllVoices: () => calls.push('stopVoices'),
  cancelAnimationFrame: value => calls.push(['cancel', value]),
  isSnapEnabled: () => snapEnabled,
  snapTime: value => {
    snapCalls += 1;
    return Math.round(value * 2) / 2;
  },
  toast: value => calls.push(['toast', value]),
  formatTime: value => `t${value}`
});

service.toggleLoop();
assert.equal(daw.loopEnabled, true);
assert.equal(button.classList.contains('loop-active'), true);
assert.deepEqual(calls.slice(-2), ['render', ['toast', 'Loop ON']]);

daw.playhead = 12;
service.setLoopA();
assert.equal(daw.loopA, 12);
assert.equal(daw.loopB, 17);

daw.playhead = 3;
service.setLoopB();
assert.equal(daw.loopB, 3);
assert.equal(daw.loopA, 0);

service.clearLoop();
assert.deepEqual([daw.loopA, daw.loopB, selectionEnd], [0, 10, 0]);

service.setLoopFromSelection();
assert.deepEqual(
  [daw.loopA, daw.loopB, daw.loopEnabled, selectionEnd],
  [2, 11, false, 11]
);

const callsBeforePlay = calls.length;
service.setLoopFromSelectionAndPlay();
assert.deepEqual(
  [daw.loopA, daw.loopB, daw.loopEnabled, daw.playhead],
  [2, 11, true, 2]
);
assert.deepEqual(calls.slice(callsBeforePlay), [
  'render',
  'playhead',
  'start',
  ['toast', 'Loop ON: t2 → t11']
]);

performing = true;
service.toggleLoop();
assert.equal(daw.loopEnabled, true);
assert.deepEqual(calls.at(-1), ['toast', 'لوپ در حالت ارنجر غیرفعال است']);

console.log('CoreLoopControlService tests passed');
