const assert = require('node:assert/strict');
const ClipService = require('../app/CoreClipService.js');

const daw = {
  playhead: 2,
  isPlaying: true,
  selectedIds: new Set(['a']),
  clips: [
    {
      id: 'a',
      type: 'audio',
      start: 0,
      duration: 4,
      offset: 1,
      sourceDuration: 8
    },
    { id: 'chord', type: 'chord', start: 8, duration: 2 }
  ]
};
const refreshed = [];
const calls = [];
let nextId = 10;

const service = ClipService.create({
  getDAW: () => daw,
  uid: prefix => `${prefix}${nextId++}`,
  roundMs: value => Math.round(value * 100) / 100,
  refreshClipWaveImage: clip => refreshed.push({
    id: clip.id,
    duration: clip.duration,
    offset: clip.offset
  }),
  saveState: () => calls.push('save'),
  renderAll: () => calls.push('render'),
  scheduleAllFromPlayhead: () => calls.push('schedule'),
  toast: message => calls.push(['toast', message]),
  translate: value => `tr:${value}`
});

assert.equal(service.getClip('a'), daw.clips[0]);
assert.deepEqual(service.selectedClips(), [daw.clips[0]]);
assert.equal(service.getClip('missing'), undefined);

const right = service.splitClipAt(daw.clips[0], 1.25);
assert.equal(right.id, 'c10');
assert.equal(daw.clips.length, 3);
assert.equal(daw.clips[0].duration, 1.25);
assert.equal(right.start, 1.25);
assert.equal(right.duration, 2.75);
assert.equal(right.offset, 2.25);
assert.deepEqual(refreshed, [
  { id: 'a', duration: 1.25, offset: 1 },
  { id: 'c10', duration: 2.75, offset: 2.25 }
]);

daw.selectedIds = new Set(['chord']);
daw.playhead = 9;
service.splitSelectedAtPlayhead();
assert.deepEqual(daw.selectedIds, new Set(['c11']));
assert.equal(daw.clips.find(clip => clip.id === 'chord').duration, 1);
assert.equal(daw.clips.find(clip => clip.id === 'c11').start, 9);
assert.deepEqual(calls, ['save', 'render', 'schedule', ['toast', 'tr:splitDone']]);

daw.selectedIds.clear();
service.splitSelectedAtPlayhead();
assert.deepEqual(calls.at(-1), ['toast', 'tr:nothingSelected']);

assert.equal(service.splitClipAt(null, 1), null);
assert.equal(service.splitClipAt(daw.clips[1], 8), null);

console.log('CoreClipService tests passed');
