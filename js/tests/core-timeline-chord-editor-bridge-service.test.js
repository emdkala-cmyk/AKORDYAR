const assert = require('node:assert/strict');
const ChordEditorBridgeService = require(
  '../app/CoreTimelineChordEditorBridgeService.js'
);

const chordClip = { id: 'chord-1', type: 'chord' };
const audioClip = { id: 'audio-1', type: 'audio' };
const calls = [];
let timestamp = 1000;
const runtime = ChordEditorBridgeService.create({
  getClip: id => id === chordClip.id ? chordClip : audioClip,
  openChordEditor: id => calls.push(id),
  now: () => timestamp
});

runtime.openTimelineChordEditor('missing');
runtime.openTimelineChordEditor(audioClip.id);
assert.deepEqual(calls, []);

runtime.openTimelineChordEditor(chordClip.id);
assert.deepEqual(calls, ['chord-1']);
assert.equal(chordClip._lastModalOpenAt, 1000);

timestamp = 1050;
runtime.openTimelineChordEditor(chordClip.id);
assert.deepEqual(calls, ['chord-1']);

timestamp = 1120;
runtime.openTimelineChordEditor(chordClip.id);
assert.deepEqual(calls, ['chord-1', 'chord-1']);

const unavailable = ChordEditorBridgeService.create({
  getClip: () => chordClip,
  openChordEditor: null
});
unavailable.openTimelineChordEditor(chordClip.id);
assert.deepEqual(calls, ['chord-1', 'chord-1']);

console.log('CoreTimelineChordEditorBridgeService tests passed');
