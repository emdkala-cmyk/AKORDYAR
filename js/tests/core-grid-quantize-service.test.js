const assert = require('node:assert/strict');
const GridQuantizeService = require('../app/CoreGridQuantizeService.js');

const classes = () => {
  const values = new Set();
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    toggle: (value, force) => {
      const next = force === undefined ? !values.has(value) : force;
      if (next) values.add(value);
      else values.delete(value);
      return next;
    },
    contains: value => values.has(value)
  };
};

const elements = {
  snapBtn: { classList: classes() },
  quantizeModal: { classList: classes() }
};
const preset = {
  classList: classes(),
  closest: () => preset
};
const state = {
  snapEnabled: false,
  snapPreset: '1/4',
  snapValue: 0.5
};
const daw = {
  clips: [{ id: 'c1', type: 'chord', start: 0.63 }],
  selectedIds: new Set(['c1'])
};
const changes = [];
const messages = [];
const service = GridQuantizeService.create({
  documentRef: {
    querySelectorAll: () => [preset],
    querySelector: () => preset,
    addEventListener: () => {}
  },
  getElement: id => elements[id] || null,
  getTransportState: () => state,
  getSongState: () => ({
    getTimingContext: () => ({ timeSignature: '4/4', tempo: 120 })
  }),
  getDAW: () => daw,
  timelineGrid: {
    getTimeSignatureGridConfig: () => ({
      beatDuration: 0.5,
      measureDuration: 2
    })
  },
  meter: {
    snapTimeToGrid: (time, step) => Math.round(time / step) * step
  },
  quantizer: {
    gridStepForPreset: () => 0.5,
    quantizeSelectedChords: (clips, selectedIds, step, options) => {
      const clip = clips.find(item => selectedIds.has(item.id));
      clip.start = options.round(Math.round(clip.start / step) * step);
      return { changed: true, count: 1 };
    }
  },
  saveState: () => changes.push('save'),
  renderClips: () => changes.push('clips'),
  renderRuler: () => changes.push('ruler'),
  toast: message => messages.push(message),
  round: value => Math.round(value * 1000) / 1000
});

assert.deepEqual(
  service.getTimeSignatureGridConfig('4/4', 120),
  { beatDuration: 0.5, measureDuration: 2 }
);
assert.equal(service.toggleSnap(), true);
assert.equal(elements.snapBtn.classList.contains('active'), true);
assert.equal(service.snapTime(0.63), 0.5);
assert.equal(state.snapValue, 0.5);
assert.equal(service.showQuantizeModal(), true);
assert.equal(elements.quantizeModal.classList.contains('show'), true);
service.applyQuantize('1/4', preset);
assert.equal(state.snapPreset, '1/4');
assert.equal(state.snapEnabled, true);
assert.equal(elements.quantizeModal.classList.contains('show'), false);
assert.equal(service.quantizeSelectedChords().changed, true);
assert.deepEqual(changes, ['save', 'clips', 'ruler']);
assert.equal(daw.clips[0].start, 0.5);
assert.match(messages.at(-1), /کوانتایز شد/);

console.log('CoreGridQuantizeService tests passed');
