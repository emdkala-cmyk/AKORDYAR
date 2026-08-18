const assert = require('node:assert/strict');
const MidiFileParser = require('../core/MidiFileParser');
const MidiScoreModel = require('../core/MidiScoreModel');
const MidiScoreRenderer = require('../core/MidiScoreRenderer');

const parsed = MidiFileParser.parse(Uint8Array.from([
  0x4d,0x54,0x68,0x64, 0,0,0,6, 0,0, 0,1, 0x01,0xe0,
  0x4d,0x54,0x72,0x6b, 0,0,0,21,
  0,0xff,0x58,4,6,3,24,8,
  0,0x90,60,100,
  0x83,0x60,0x80,60,0,
  0,0xff,0x2f,0
]));
const score = MidiScoreModel.fromParsed(parsed);
const partId = score.parts[0].id;
const layout = MidiScoreRenderer.buildLayout(score, partId);

assert.equal(layout.measures[0].numerator, 6);
assert.equal(layout.measures[0].denominator, 8);
assert.equal(layout.measures[0].endTick, 480);
assert.equal(layout.measures[0].notes.length, 1);
assert.equal(layout.measures[0].notes[0].durationType, 'quarter');
const svg = MidiScoreRenderer.renderSvg(score, partId, { activeTime: 0 });
assert.match(svg, /midi-score-playhead/);
assert.equal((svg.match(/midi-score-staff-line/g) || []).length, 5);
assert.match(svg, /midi-score-clef/);
assert.match(svg, /midi-score-time-signature/);
assert.match(svg, /midi-score-notehead/);
assert.ok(MidiScoreRenderer.getPlayheadX(score, partId, 0.25) > 0);
const explicitPosition = MidiScoreRenderer.getPlayheadPosition(score, partId, 0, {
  activeTick: 240
});
assert.equal(explicitPosition.tick, 240);
assert.equal(explicitPosition.systemIndex, 0);

console.log('MidiScoreRenderer tests passed');
