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

const serviceWithInvalidStop = new ClipboardService({
  DAW: {
    clips: [{ id: 'clip-3' }],
    sections: [],
    selectedIds: new Set(['clip-3']),
    selectedSectionIds: new Set(),
    isPlaying: false
  },
  stopAllVoices: null,
  saveState() {},
  renderAll() {},
  toast() {},
  t: (key) => key
});

assert.doesNotThrow(() => serviceWithInvalidStop.deleteSelected());

const buffer = { duration: 3 };
const serviceWithMapCache = new ClipboardService({
  DAW: {
    clips: [{ id: 'clip-4', type: 'audio', start: 0, duration: 1, bufferKey: 'buf-1' }],
    sections: [],
    selectedIds: new Set(['clip-4']),
    selectedSectionIds: new Set(),
    isPlaying: false,
    playhead: 2,
    bufferCache: new Map([['buf-1', buffer]]),
    clipboard: []
  },
  selectedClips() { return this.DAW.clips.filter(c => this.DAW.selectedIds.has(c.id)); },
  uid: () => 'clip-5',
  roundMs: value => value,
  peaksFromBuffer: value => ({ duration: value.duration }),
  refreshClipWaveImage: () => 'wave',
  ensureTimelineFits() {},
  saveState() {},
  renderAll() {},
  scheduleAllFromPlayhead() {},
  toast() {},
  t: key => key,
  edSaveSong() {}
});
serviceWithMapCache.copySelected();
serviceWithMapCache.pasteClipboard();
assert.equal(serviceWithMapCache.getDAW().clips.length, 2);
assert.deepEqual(serviceWithMapCache.getDAW().clips[1]._peaks, { duration: 3 });

console.log('ClipboardService tests passed');
