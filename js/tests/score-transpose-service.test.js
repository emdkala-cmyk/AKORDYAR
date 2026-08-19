const assert = require('node:assert/strict');
const Transpose = require('../core/ScoreTransposeService');
const { JSDOM } = require('jsdom');

const midi = {
  keySignatures: [{ tick: 0, sharpsFlats: 4, minor: false }],
  parts: [
    { id: 'bass-part', trackId: 'bass', role: 'bass' },
    { id: 'drum-part', trackId: 'drums', role: 'drums' }
  ],
  tracks: [
    { id: 'bass', notes: [{ id: 'b1', pitch: 64, startTick: 0, endTick: 480 }] },
    { id: 'drums', channel: 9, notes: [{ id: 'd1', pitch: 36, startTick: 0, endTick: 480 }] }
  ]
};

const shiftedMidi = Transpose.transposeMidiScore(midi, 'C', 'major');
assert.equal(shiftedMidi.tracks[0].notes[0].pitch, 60, 'E4 must become C4');
assert.equal(shiftedMidi.tracks[1].notes[0].pitch, 36, 'drums must not transpose');
assert.equal(shiftedMidi.keySignatures[0].sharpsFlats, 0);
assert.equal(shiftedMidi.keySignatures[0].minor, false);
assert.equal(midi.tracks[0].notes[0].pitch, 64, 'source score must remain untouched');

const musicXml = {
  keyMap: { events: [{ tick: 0, fifths: 4, mode: 'major' }] },
  parts: [{
    id: 'bass-part',
    role: 'bass',
    measures: [{
      number: '1',
      startTick: 0,
      endTick: 1920,
      key: { fifths: 4, mode: 'major' },
      notes: [{
        id: 'x1',
        rest: false,
        pitch: { step: 'E', alter: 0, octave: 4, midi: 64 }
      }]
    }]
  }]
};

const shiftedXml = Transpose.transposeMusicXmlScore(musicXml, 'C', 'major');
assert.deepEqual(shiftedXml.parts[0].measures[0].notes[0].pitch, {
  step: 'C', alter: 0, octave: 4, midi: 60
});
assert.equal(shiftedXml.parts[0].measures[0].key.fifths, 0);
assert.equal(shiftedXml.keyMap.events[0].fifths, 0);

const dom = new JSDOM('');
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;
const sourceXml =
  '<score-partwise version="3.1">' +
  '<part-list><score-part id="P1"><part-name>Bass</part-name></score-part></part-list>' +
  '<part id="P1"><measure number="1">' +
  '<attributes><divisions>1</divisions><key><fifths>4</fifths><mode>major</mode></key></attributes>' +
  '<note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>' +
  '</measure></part></score-partwise>';
const sourceScore = {
  source: { data: sourceXml },
  parts: [{
    id: 'P1',
    role: 'bass',
    measures: [{ key: { fifths: 4, mode: 'major' }, notes: [] }]
  }]
};
const shiftedSourceScore = Transpose.transposeMusicXmlScore(sourceScore, 'C', 'major');
assert.match(shiftedSourceScore.source.data, /<step>C<\/step>/);
assert.match(shiftedSourceScore.source.data, /<fifths>0<\/fifths>/);
assert.doesNotMatch(shiftedSourceScore.source.data, /<step>E<\/step>/);

const midiWithoutKeyMeta = {
  tracks: [{
    id: 'bass',
    notes: [
      { pitch: 52, durationTicks: 960 }, // E
      { pitch: 54, durationTicks: 480 }, // F#
      { pitch: 56, durationTicks: 480 }, // G#
      { pitch: 57, durationTicks: 480 }, // A
      { pitch: 59, durationTicks: 480 }, // B
      { pitch: 61, durationTicks: 480 }, // C#
      { pitch: 63, durationTicks: 480 }  // D#
    ]
  }]
};
const inferredSource = Transpose.inferKeyFromPitches(midiWithoutKeyMeta.tracks[0].notes);
assert.equal(inferredSource.mode, 'major');
assert.equal(inferredSource.semitone, 4);
const shiftedWithoutKeyMeta = Transpose.transposeMidiScore(
  midiWithoutKeyMeta, 'C', 'maj'
);
assert.equal(shiftedWithoutKeyMeta.tracks[0].notes[0].pitch, 48);
assert.equal(shiftedWithoutKeyMeta.keySignatures[0].sharpsFlats, 0);

console.log('Score transpose service tests passed');
