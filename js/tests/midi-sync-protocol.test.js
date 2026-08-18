const assert = require('node:assert/strict');
const Protocol = require('../sync/protocol');

const request = Protocol.pack(
  Protocol.MSG.MIDI_SCORE_REQUEST,
  { partId: 'part-midi-track-2', scoreVersion: 1 },
  { requesterId: 'slave_1' }
);
const unpackedRequest = Protocol.unpack(JSON.stringify(request));
assert.equal(unpackedRequest.ok, true);
assert.equal(unpackedRequest.message.t, Protocol.MSG.MIDI_SCORE_REQUEST);
assert.equal(unpackedRequest.message.p.partId, 'part-midi-track-2');

const targeted = Protocol.pack(
  Protocol.MSG.MIDI_SCORE,
  { score: { tracks: [{ id: 'midi-track-2' }] }, activePartId: 'part-midi-track-2' },
  { targetPeerId: 'slave_1' }
);
const unpackedTarget = Protocol.unpack(JSON.stringify(targeted));
assert.equal(unpackedTarget.ok, true);
assert.equal(unpackedTarget.message.t, Protocol.MSG.MIDI_SCORE);
assert.equal(unpackedTarget.message.m.targetPeerId, 'slave_1');

console.log('MIDI sync protocol tests passed');
