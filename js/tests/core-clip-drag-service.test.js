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

const chordTrack = { id: 'tc', type: 'chord' };
const chordLaneTarget = {
  closest: () => ({ dataset: { trackId: chordTrack.id } })
};
const groupedChords = [
  { id: 'chord-a', type: 'chord', trackId: 'tc', start: 0.1, duration: 0.2 },
  { id: 'chord-b', type: 'chord', trackId: 'tc', start: 0.4, duration: 0.2 },
  { id: 'chord-c', type: 'chord', trackId: 'tc', start: 0.7, duration: 0.2 }
];
daw.tracks.push(chordTrack);
daw.clips.push(...groupedChords);
daw.selectedIds = new Set(groupedChords.map(clip => clip.id));
pointerTarget = chordLaneTarget;
snapEnabled = true;
daw.drag = {
  type: 'move',
  edge: null,
  primaryId: 'chord-a',
  startX: 10,
  items: groupedChords.map(clip => ({
    id: clip.id,
    origStart: clip.start,
    origDur: clip.duration,
    origTrackId: clip.trackId
  }))
};
assert.equal(
  service.update({ clientX: 12, clientY: 4, target: chordLaneTarget }),
  true
);
assert.deepEqual(
  groupedChords.map(clip => clip.start),
  [0.5, 0.8, 1.1]
);
assert.equal(service.finish(), true);

const collisionTrack = { id: 'tc2', type: 'chord' };
const collisionChords = [
  { id: 'chord-prev', type: 'chord', trackId: 'tc2', start: 0, duration: 1 },
  { id: 'chord-solo', type: 'chord', trackId: 'tc2', start: 1.5, duration: 0.5 },
  { id: 'chord-next', type: 'chord', trackId: 'tc2', start: 3, duration: 1 }
];
daw.tracks.push(collisionTrack);
daw.clips.push(...collisionChords);
daw.selectedIds = new Set(['chord-solo']);
pointerTarget = {
  closest: () => ({ dataset: { trackId: collisionTrack.id } })
};
snapEnabled = false;
daw.drag = {
  type: 'move',
  edge: null,
  primaryId: 'chord-solo',
  startX: 10,
  items: [{
    id: 'chord-solo',
    origStart: 1.5,
    origDur: 0.5,
    origTrackId: collisionTrack.id
  }]
};
assert.equal(
  service.update({ clientX: 30, clientY: 4, target: pointerTarget }),
  true
);
assert.equal(collisionChords[1].start, 2.47);
assert.ok(
  collisionChords[1].start + collisionChords[1].duration <
    collisionChords[2].start
);
assert.equal(service.finish(), true);

console.log('CoreClipDragService tests passed');
