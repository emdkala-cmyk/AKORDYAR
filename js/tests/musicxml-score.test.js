const assert = require('node:assert/strict');
const Parser = require('../core/MusicXmlScoreParser');
const Model = require('../core/MusicXmlScoreModel');
const Renderer = require('../core/MusicXmlScoreRenderer');
const Transposition = require('../core/InstrumentTranspositionService');
const Mapping = require('../core/ScorePartMappingService');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Live Score Fixture</work-title></work>
  <part-list>
    <score-part id="P1">
      <part-name>Alto Saxophone</part-name>
      <part-abbreviation>A. Sax.</part-abbreviation>
      <score-instrument id="P1-I1"><instrument-name>Alto Saxophone</instrument-name></score-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>-3</fifths><mode>minor</mode></key>
        <time><beats>6</beats><beat-type>8</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
        <transpose><diatonic>-5</diatonic><chromatic>-9</chromatic></transpose>
      </attributes>
      <direction><direction-type><metronome><beat-unit>eighth</beat-unit><per-minute>120</per-minute></metronome></direction-type></direction>
      <note>
        <pitch><step>C</step><alter>1</alter><octave>4</octave></pitch>
        <duration>2</duration><type>eighth</type><voice>1</voice><beam number="1">begin</beam>
        <notations><tied type="start"/><slur type="start" number="1"/></notations>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>2</duration><type>eighth</type><voice>1</voice><beam number="1">end</beam>
        <notations><tied type="stop"/><slur type="stop" number="1"/></notations>
      </note>
      <note><rest/><duration>8</duration><type>quarter</type><voice>1</voice></note>
      <barline location="right"><bar-style>light-heavy</bar-style></barline>
    </measure>
  </part>
</score-partwise>`;

const parsed = Parser.parse(xml, { fileName: 'fixture.musicxml' });
assert.equal(parsed.title, 'Live Score Fixture');
assert.equal(parsed.parts.length, 1);
assert.equal(parsed.parts[0].name, 'Alto Saxophone');
assert.deepEqual(parsed.parts[0].measures[0].time.beatType, 8);
assert.equal(parsed.parts[0].measures[0].notes[0].pitch.midi, 61);
assert.equal(parsed.parts[0].measures[0].notes[0].durationTicks, 240);
assert.equal(parsed.parts[0].measures[0].notes[0].notations.slurs[0].type, 'start');
assert.equal(parsed.parts[0].measures[0].notes[2].rest, true);
assert.equal(parsed.tempoMap.events[0].beatUnit, 'eighth');
assert.equal(parsed.endTick, 1440);

const score = Model.normalize(parsed);
assert.equal(Model.timeSignatureAtTick(score, 0).beatTicks, 240);
assert.equal(Model.tickToMeasureBeat(score, 240).beat, 2);
assert.equal(Model.keyAtTick(score, 0).fifths, -3);
assert.equal(Model.getSummary(score).noteCount, 3);

const layout = Renderer.buildLayout(score, 'P1');
assert.ok(layout.width >= 720);
const svg = Renderer.renderSvg(score, 'P1', { activeTick: 120 });
assert.match(svg, /midi-score-staff-line/);
assert.match(svg, /midi-score-clef/);
assert.match(svg, /midi-score-key-symbol/);
assert.match(svg, /midi-score-time-signature/);
assert.match(svg, /midi-score-notehead/);
assert.match(svg, /midi-score-rest/);
assert.match(svg, /midi-score-playhead/);

const transpose = Transposition.resolve(score.parts[0]);
assert.equal(transpose.semitones, -9);
assert.equal(Transposition.writtenToSounding(60, transpose), 51);

const mappings = Mapping.autoMap(score, {
  parts: [{ id: 'midi-part-1', name: 'Alto Saxophone', role: 'saxophone', trackId: 'track-1' }],
  tracks: [{ id: 'track-1', name: 'Alto Saxophone', notes: [] }]
});
assert.equal(mappings[0].musicXmlPartId, 'P1');
assert.equal(mappings[0].midiPartId, 'midi-part-1');

console.log('MusicXmlScoreParser/Model/Renderer tests passed');
