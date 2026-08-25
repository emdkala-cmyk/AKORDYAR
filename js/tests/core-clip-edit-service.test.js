const assert = require('node:assert/strict');
const ClipEditService = require('../app/CoreClipEditService.js');

const daw = {
  isPlaying: true,
  selectedIds: new Set(['old']),
  clips: [
    { id: 'audio-left', type: 'audio', trackId: 't1', start: 0, duration: 8 },
    { id: 'chord-left', type: 'chord', trackId: 't1', start: 1, duration: 6 },
    { id: 'other-track', type: 'audio', trackId: 't2', start: 0, duration: 8 }
  ]
};
const calls = [];
const splitCalls = [];
let nextId = 1;

const service = ClipEditService.create({
  getDAW: () => daw,
  roundMs: value => Math.round(value * 100) / 100,
  splitClipAt: (clip, time) => {
    splitCalls.push([clip.id, time]);
    const right = {
      ...clip,
      id: `right-${nextId++}`,
      start: time,
      duration: clip.start + clip.duration - time
    };
    clip.duration = time - clip.start;
    daw.clips.push(right);
    return right;
  },
  seekTransport: (time, keepPlaying) => calls.push(['seek', time, keepPlaying]),
  saveState: () => calls.push('save'),
  renderAll: () => calls.push('render'),
  scheduleAllFromPlayhead: () => calls.push('schedule'),
  toast: message => calls.push(['toast', message]),
  translate: key => `tr:${key}`
});

assert.equal(service.cutAtTime(4.126, 't1'), true);
assert.deepEqual(splitCalls, [
  ['audio-left', 4.13],
  ['chord-left', 4.13]
]);
assert.deepEqual(daw.selectedIds, new Set(['right-1', 'right-2']));
assert.deepEqual(calls, [
  ['seek', 4.13, true],
  'save',
  'render',
  'schedule',
  ['toast', 'tr:clipsCut: 2']
]);

const noHitCalls = [];
const noHitService = ClipEditService.create({
  getDAW: () => daw,
  roundMs: value => value,
  seekTransport: (...args) => noHitCalls.push(['seek', ...args]),
  toast: message => noHitCalls.push(['toast', message]),
  translate: key => `tr:${key}`
});
assert.equal(noHitService.cutAtTime(20, 't1'), false);
assert.deepEqual(noHitCalls, [
  ['seek', 20, true],
  ['toast', 'tr:noClipToCut']
]);
assert.equal(noHitService.cutAtTime(2, null), false);

console.log('CoreClipEditService tests passed');
