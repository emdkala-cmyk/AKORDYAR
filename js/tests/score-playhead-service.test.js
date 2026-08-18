const assert = require('node:assert/strict');
const ScorePlayhead = require('../core/ScorePlayheadService');
const MusicXmlParser = require('../core/MusicXmlScoreParser');
const MusicXmlModel = require('../core/MusicXmlScoreModel');

const score = MusicXmlModel.normalize(MusicXmlParser.parse(
  `<score-partwise><part-list><score-part id="P1"><part-name>Flute</part-name></score-part></part-list>` +
  `<part id="P1"><measure number="1"><attributes><divisions>480</divisions>` +
  `<time><beats>6</beats><beat-type>8</beat-type></time></attributes>` +
  `<direction><direction-type><metronome><beat-unit>eighth</beat-unit><per-minute>120</per-minute></metronome></direction-type></direction>` +
  `<note><pitch><step>C</step><octave>4</octave></pitch><duration>240</duration><type>eighth</type></note>` +
  `</measure></part></score-partwise>`,
  { fileName: 'clock.musicxml' }
));

const clock = ScorePlayhead.create({ musicXmlScore: score });
assert.equal(clock.secondsToTick(0.25), 120);
assert.equal(clock.tickToSeconds(120), 0.25);
assert.equal(clock.tickToMeasureBeat(240, 'P1').beat, 2);

console.log('ScorePlayheadService tests passed');
