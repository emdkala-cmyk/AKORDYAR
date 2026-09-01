const assert = require('node:assert/strict');
const FreeWarp = require('../core/FreeWarpEngine.js');
const RuntimeService = require('../editor/EditorHitpointRuntimeService.js');

const clip = {
  id: 'clip-1',
  type: 'audio',
  name: 'test-audio',
  start: 2,
  duration: 2,
  offset: 0,
  sourceDuration: 2,
  hitpoints: [
    { id: 'hp_1', sourceTime: 0.5, sourceSample: 500, strength: 0.9, enabled: true },
    { id: 'hp_2', sourceTime: 1.5, sourceSample: 1500, strength: 0.8, enabled: true }
  ],
  hitpointAnalysis: {
    sourceRate: 1000,
    rawHitpoints: []
  }
};

const daw = {
  clips: [clip],
  selectedIds: new Set([clip.id]),
  bufferCache: new Map()
};
const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      value: '',
      textContent: '',
      style: {},
      classList: { toggle() {} },
      setAttribute() {},
      checked: true
    });
  }
  return elements.get(id);
}
element('hitpointModal').querySelectorAll = () => [];

const warpService = {
  ensureWarpMarkers() {
    if (!clip.warpMarkers) {
      clip.warpMarkers = FreeWarp.defaultMarkers(
        clip.start,
        clip.duration,
        0,
        clip.offset
      );
    }
  },
  renderWarpAudio() {}
};

let warpMode = false;
const runtime = RuntimeService.create({
  FreeWarp,
  getDAW: () => daw,
  getSelectedClips: () => [clip],
  getClip: id => daw.clips.find(item => item.id === id),
  getWarpService: () => warpService,
  getElement: id => element(id),
  setWarpMode: active => { warpMode = active; },
  syncWarpMode: () => {},
  saveState: () => {},
  saveSong: () => {},
  refreshClipWaveImage: () => {},
  renderClips: () => {}
});

const inserted = runtime.createWarpMarkersFromHitpoints();
assert.equal(inserted, 2, 'two hitpoints become warp markers');
assert.equal(
  clip.warpMarkers.filter(marker => marker.id.startsWith('hpwm_')).length,
  2,
  'generated markers are identifiable'
);
assert.equal(warpMode, true, 'warp mode activates after conversion');

console.log('editor-hitpoint-runtime-service.test.js — all assertions passed.');
