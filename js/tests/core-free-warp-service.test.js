const assert = require('node:assert/strict');
const FreeWarp = require('../core/FreeWarpEngine.js');
global.FreeWarpEngine = FreeWarp;
const Warp = require('../app/CoreFreeWarpService.js');

const clips = [
  {
    id: 'c1',
    type: 'audio',
    start: 0,
    duration: 4,
    offset: 0,
    sourceDuration: 4,
    _peaks: new Float32Array([0, 1, 0, 1])
  },
  {
    id: 'c2',
    type: 'audio',
    start: 5,
    duration: 4,
    offset: 0,
    sourceDuration: 4,
    _peaks: new Float32Array([1, 0, 1, 0])
  }
];
const daw = {
  clips,
  selectedIds: new Set(['c1', 'c2']),
  isPlaying: true
};
const renderCalls = [];
const refreshCalls = [];
const renderClipCalls = [];
const scheduleCalls = [];
const renderer = {
  ensureWarpedBuffer(clip, { onDone }) {
    renderCalls.push(clip.id);
    onDone({ id: clip.id });
  },
  getWarpedBuffer: () => null
};
const service = Warp.create({
  getDAW: () => daw,
  getClip: clipId => clips.find(clip => clip.id === clipId),
  FreeWarp,
  getWarpAudioRenderer: () => renderer,
  refreshClipWaveImage: clip => refreshCalls.push(clip.id),
  renderClips: options => renderClipCalls.push(options),
  saveState: () => {},
  scheduleAllFromPlayhead: () => scheduleCalls.push('schedule')
});

const markerId = service.insertWarpMarker('c1', 2);
assert.ok(markerId);
service.moveWarpMarker('c1', markerId, 3);

const primaryMarkers = service.getWarpMarkers('c1');
const secondaryMarkers = service.getWarpMarkers('c2');
const primaryMarker = primaryMarkers.find(marker => marker.id === markerId);
const secondaryMarker = secondaryMarkers.find(
  marker => marker.id === `group_${markerId}`
);
assert.equal(primaryMarker.timelineTime, 3);
assert.ok(secondaryMarker);
assert.equal(secondaryMarker.timelineTime, 8);
assert.equal(secondaryMarkers[0].timelineTime, 5);
assert.equal(secondaryMarkers[secondaryMarkers.length - 1].timelineTime, 9);
assert.deepEqual(refreshCalls, ['c2']);

service.commitWarp('c1', {
  markerId,
  timelineTime: primaryMarker.timelineTime
});
assert.deepEqual(renderCalls.sort(), ['c1', 'c2']);
assert.equal(refreshCalls.includes('c1'), true);
assert.equal(refreshCalls.includes('c2'), true);
assert.equal(scheduleCalls.length, 1);
assert.equal(
  renderClipCalls.some(options => options?.preserveWaveforms === true),
  true
);

console.log('CoreFreeWarpService tests passed');
