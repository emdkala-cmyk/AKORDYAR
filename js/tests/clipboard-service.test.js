const assert = require('node:assert/strict');
const ClipboardService = require('../editor/ClipboardService.js');

let deleteDelegated = 0;

const service = new ClipboardService({
  deleteSelected: () => {
    deleteDelegated++;
    return true;
  }
});

assert.equal(service.deleteSelected(), undefined);
assert.equal(deleteDelegated, 1);

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
