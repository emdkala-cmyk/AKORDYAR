const assert = require('node:assert/strict');
const MidiFileParser = require('../core/MidiFileParser');
const MidiScoreModel = require('../core/MidiScoreModel');

function vlq(value) {
  let buffer = Number(value) & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function ascii(value) {
  return Array.from(Buffer.from(value, 'utf8'));
}

function chunk(type, data) {
  return [
    ...ascii(type),
    (data.length >>> 24) & 0xff,
    (data.length >>> 16) & 0xff,
    (data.length >>> 8) & 0xff,
    data.length & 0xff,
    ...data
  ];
}

function makeFixture() {
  const conductor = [
    ...vlq(0), 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
    ...vlq(0), 0xff, 0x58, 0x04, 0x06, 0x03, 0x18, 0x08,
    ...vlq(0), 0xff, 0x06, 0x05, ...ascii('Intro'),
    ...vlq(480), 0xff, 0x51, 0x03, 0x0f, 0x42, 0x40,
    ...vlq(0), 0xff, 0x2f, 0x00
  ];
  const notes = [
    ...vlq(0), 0xff, 0x03, 0x05, ...ascii('Piano'),
    ...vlq(0), 0xc0, 0x00,
    ...vlq(0), 0x90, 0x3c, 0x64,
    ...vlq(480), 0x80, 0x3c, 0x40,
    ...vlq(0), 0x90, 0x3e, 0x64,
    ...vlq(480), 0x90, 0x3e, 0x00,
    ...vlq(0), 0xff, 0x2f, 0x00
  ];
  return Uint8Array.from([
    ...ascii('MThd'), 0, 0, 0, 6,
    0, 1, 0, 2, 0x01, 0xe0,
    ...chunk('MTrk', conductor),
    ...chunk('MTrk', notes)
  ]);
}

const parsed = MidiFileParser.parse(makeFixture(), {
  fileName: 'fixture.mid',
  lastModified: 123
});

assert.equal(parsed.format, 1);
assert.equal(parsed.trackCount, 2);
assert.equal(parsed.division.type, 'ppqn');
assert.equal(parsed.division.ticksPerQuarter, 480);
assert.equal(parsed.endTick, 960);
assert.equal(parsed.tempoMap.events[0].bpm, 120);
assert.equal(parsed.tempoMap.events[1].bpm, 60);
assert.deepEqual(parsed.meterMap.events[0], {
  tick: 0,
  numerator: 6,
  denominator: 8,
  clocksPerClick: 24,
  notated32ndNotesPerQuarter: 8
});
assert.equal(parsed.markers[0].text, 'Intro');

const piano = parsed.tracks[1];
assert.equal(piano.name, 'Piano');
assert.equal(piano.programs[0].instrumentName, 'Acoustic Grand Piano');
assert.equal(piano.notes.length, 2);
assert.equal(piano.notes[0].startTick, 0);
assert.equal(piano.notes[0].durationTicks, 480);
assert.equal(piano.notes[0].durationSeconds, 0.5);
assert.equal(piano.notes[1].startSeconds, 0.5);
assert.equal(piano.notes[1].durationSeconds, 1);

assert.equal(parsed.conversions.tickToSeconds(480), 0.5);
assert.equal(parsed.conversions.tickToSeconds(960), 1.5);
assert.deepEqual(parsed.conversions.tickToBarBeat(0), {
  bar: 1,
  beat: 1,
  tickInBeat: 0,
  numerator: 6,
  denominator: 8,
  beatTicks: 240,
  measureTicks: 1440
});
assert.equal(parsed.conversions.gridStepTicks(0, '1/4'), 240);
assert.equal(parsed.conversions.quantizeTick(119, '1/4'), 0);
assert.equal(parsed.conversions.quantizeTick(130, '1/4'), 240);

const score = MidiScoreModel.fromParsed(parsed);
assert.equal(score.parts.length, 2);
assert.equal(score.activePartId, score.parts[1].id);
assert.equal(score.parts[1].role, 'piano');
assert.equal(MidiScoreModel.getPartTrack(score, score.parts[1].id).name, 'Piano');
assert.equal(MidiScoreModel.getSummary(score).noteCount, 2);
assert.equal(typeof score.conversions.secondsToTick, 'function');
const serialized = MidiScoreModel.serialize(score);
assert.equal(serialized.conversions, undefined);
assert.equal(serialized.source.fileName, 'fixture.mid');

console.log('MidiFileParser/MidiScoreModel tests passed');
