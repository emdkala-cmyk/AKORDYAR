const assert = require('node:assert/strict');
require('../app/CoreClipDragService.js');
const Drag = global.CoreClipDragService;

const calls = [];
let snapEnabled = false;
const laneTarget = {
  closest: () => ({ dataset: { trackId: 't2' } })
};
const sameLaneTarget = {
  closest: () => ({ dataset: { trackId: 't1' } })
};
let pointerTarget = laneTarget;
const daw = {
  tracks: [
    { id: 't1', type: 'audio' },
    { id: 't2', type: 'audio' },
    { id: 't3', type: 'audio' }
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
  documentRef: { elementFromPoint: () => pointerTarget },
  getDAW: () => daw,
  getClip: id => daw.clips.find(clip => clip.id === id),
  xToTime: value => value / 10,
  snapTime: value => Math.round(value * 2) / 2,
  isSnapEnabled: () => snapEnabled,
  roundMs: value => Math.round(value * 100) / 100,
  ensureTimelineFits: value => calls.push(['fit', value]),
  saveState: () => calls.push('save'),
  scheduleAllFromPlayhead: () => calls.push('schedule'),
  renderAll: () => calls.push('render')
});

assert.equal(service.update({ clientX: 30, clientY: 4, target: laneTarget }), true);
assert.equal(daw.clips[0].start, 3);
assert.equal(daw.clips[0].trackId, 't2');
assert.deepEqual(calls, [['fit', 10]]);
assert.equal(service.finish(), true);
assert.equal(daw.clips[0].trackId, 't2');
assert.equal(daw.drag, null);
assert.deepEqual(calls, [['fit', 10], 'save', 'schedule', 'render']);

const secondClip = {
  id: 'c2',
  type: 'audio',
  trackId: 't2',
  start: 3,
  duration: 2,
  offset: 0,
  sourceDuration: 10
};
daw.clips.push(secondClip);
daw.clips[0].trackId = 't1';
daw.clips[0].start = 1;
daw.drag = {
  type: 'move',
  edge: null,
  primaryId: 'c1',
  startX: 10,
  items: [
    {
      id: 'c1',
      origStart: 1,
      origDur: 2,
      origOffset: 0,
      origTrackId: 't1'
    },
    {
      id: 'c2',
      origStart: 3,
      origDur: 2,
      origOffset: 0,
      origTrackId: 't2'
    }
  ]
};
assert.equal(service.update({ clientX: 20, clientY: 4, target: laneTarget }), true);
assert.equal(service.finish(), true);
assert.equal(daw.clips[0].trackId, 't2');
assert.equal(daw.clips[1].trackId, 't3');

daw.clips[0].trackId = 't1';
daw.clips[0].start = 1;
daw.drag = {
  type: 'move',
  edge: null,
  primaryId: 'c1',
  startX: 10,
  items: [{
    id: 'c1',
    origStart: 1,
    origDur: 2,
    origOffset: 0,
    origTrackId: 't1'
  }]
};
pointerTarget = sameLaneTarget;
snapEnabled = true;
assert.equal(
  service.update({
    clientX: 23,
    clientY: 4,
    target: sameLaneTarget,
    ctrlKey: true
  }),
  true
);
assert.equal(daw.clips[0].start, 2.3);
assert.equal(daw.clips[0].trackId, 't1');
assert.equal(service.finish(), true);

daw.clips[0].trackId = 't1';
daw.clips[0].start = 1;
daw.drag = {
  type: 'move',
  edge: null,
  primaryId: 'c1',
  startX: 10,
  items: [{
    id: 'c1',
    origStart: 1,
    origDur: 2,
    origOffset: 0,
    origTrackId: 't1'
  }]
};
assert.equal(
  service.update({
    clientX: 23,
    clientY: 4,
    target: sameLaneTarget,
    ctrlKey: false
  }),
  true
);
assert.equal(daw.clips[0].start, 2.5);
assert.equal(service.finish(), true);

pointerTarget = laneTarget;
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
