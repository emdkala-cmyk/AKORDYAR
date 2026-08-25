const assert = require('node:assert/strict');
require('../app/CoreClipDragService.js');
const Drag = global.CoreClipDragService;

const calls = [];
const laneTarget = {
  closest: () => ({ dataset: { trackId: 't2' } })
};
const daw = {
  tracks: [
    { id: 't1', type: 'audio' },
    { id: 't2', type: 'audio' }
  ],
  clips: [{
    id: 'c1',
    type: 'audio',
    trackId: 't1',
    start: 1,
    duration: 2,
    offset: 0,
    sourceDuration: 10
  }],
  sections: [],
  isPlaying: true,
  drag: {
    type: 'move',
    edge: null,
    primaryId: 'c1',
    startX: 10,
    items: [{
      id: 'c1',
      origStart: 1,
      origDur: 2,
      origOffset: 0
    }]
  }
};
const service = Drag.create({
  documentRef: { elementFromPoint: () => laneTarget },
  getDAW: () => daw,
  getClip: id => daw.clips.find(clip => clip.id === id),
  xToTime: value => value / 10,
  snapTime: value => value,
  roundMs: value => Math.round(value * 100) / 100,
  ensureTimelineFits: value => calls.push(['fit', value]),
  saveState: () => calls.push('save'),
  scheduleAllFromPlayhead: () => calls.push('schedule'),
  renderAll: () => calls.push('render')
});

assert.equal(service.update({ clientX: 30, clientY: 4, target: laneTarget }), true);
assert.equal(daw.clips[0].start, 3);
assert.deepEqual(calls, [['fit', 10]]);
assert.equal(service.finish(), true);
assert.equal(daw.clips[0].trackId, 't2');
assert.equal(daw.drag, null);
assert.deepEqual(calls, [['fit', 10], 'save', 'schedule', 'render']);

daw.clips[0].trackId = 't1';
daw.clips[0].start = 1;
daw.clips[0].duration = 2;
daw.clips[0].offset = 0;
daw.drag = {
  type: 'resize',
  edge: 'left',
  primaryId: 'c1',
  startX: 10,
  items: [{
    id: 'c1',
    origStart: 1,
    origDur: 2,
    origOffset: 0
  }]
};
assert.equal(service.update({ clientX: 5, clientY: 4, target: laneTarget }), true);
assert.equal(daw.clips[0].start, 1);
assert.equal(daw.clips[0].offset, 0);
assert.equal(daw.clips[0].duration, 2);
assert.equal(service.finish(), true);

console.log('CoreClipDragService tests passed');
