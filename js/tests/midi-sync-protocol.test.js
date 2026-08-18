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

const musicXmlRequest = Protocol.pack(
  Protocol.MSG.MUSICXML_SCORE_REQUEST,
  { partId: 'P2', scoreVersion: 3 },
  { requesterId: 'slave_2' }
);
const unpackedMusicXmlRequest = Protocol.unpack(JSON.stringify(musicXmlRequest));
assert.equal(unpackedMusicXmlRequest.ok, true);
assert.equal(unpackedMusicXmlRequest.message.t, Protocol.MSG.MUSICXML_SCORE_REQUEST);
assert.equal(unpackedMusicXmlRequest.message.p.partId, 'P2');

const musicXmlTarget = Protocol.pack(
  Protocol.MSG.MUSICXML_SCORE,
  { score: { parts: [{ id: 'P2', measures: [{ notes: [] }] }] }, activePartId: 'P2' },
  { targetPeerId: 'slave_2' }
);
const unpackedMusicXmlTarget = Protocol.unpack(JSON.stringify(musicXmlTarget));
assert.equal(unpackedMusicXmlTarget.ok, true);
assert.equal(unpackedMusicXmlTarget.message.t, Protocol.MSG.MUSICXML_SCORE);

console.log('MIDI/MusicXML sync protocol tests passed');
