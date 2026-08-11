const assert = require('node:assert/strict');
const ClipboardService = require('../editor/ClipboardService.js');

const DAW = {
  clips: [
    { id: 'audio-1', type: 'audio' },
    { id: 'chord-1', type: 'chord' }
  ],
  sections: [{ id: 'section-1' }],
  selectedIds: new Set(['audio-1', 'chord-1']),
  selectedSectionIds: new Set(['section-1']),
  isPlaying: false
};

let stopCalls = 0;
let saveCalls = 0;
let renderCalls = 0;
const toasts = [];

const service = new ClipboardService({
  DAW,
  stopAllVoices: () => { stopCalls++; },
  saveState: () => { saveCalls++; },
  renderAll: () => { renderCalls++; },
  scheduleAllFromPlayhead: () => {
    throw new Error('schedule should not run while stopped');
  },
  toast: (message) => toasts.push(message),
  t: (key) => key
});

service.deleteSelected();

assert.equal(stopCalls, 1);
assert.deepEqual(DAW.clips, []);
assert.deepEqual(DAW.sections, []);
assert.equal(DAW.selectedIds.size, 0);
assert.equal(DAW.selectedSectionIds.size, 0);
assert.equal(saveCalls, 1);
assert.equal(renderCalls, 1);
assert.deepEqual(toasts, ['deleted']);

const serviceWithoutStop = new ClipboardService({
  DAW: {
    clips: [{ id: 'clip-2' }],
    sections: [],
    selectedIds: new Set(['clip-2']),
    selectedSectionIds: new Set(),
    isPlaying: false
  },
  saveState() {},
  renderAll() {},
  toast() {},
  t: (key) => key
});

assert.doesNotThrow(() => serviceWithoutStop.deleteSelected());

console.log('ClipboardService tests passed');
