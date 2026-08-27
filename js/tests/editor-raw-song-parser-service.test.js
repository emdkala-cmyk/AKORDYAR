const assert = require('node:assert/strict');
const ParserService = require('../editor/EditorRawSongParserService.js');
const PositionMapper = require('../editor/LyricPositionMapper.js');

const parser = ParserService.create({
  positionMapper: PositionMapper,
  logger: { log() {}, warn() {} }
});

assert.equal(
  parser.normalizeRawText('\r\n\r\nC  G\r\nhello world\r\n'),
  'C  G\nhello world'
);

const ltr = parser.parseRawSong({
  title: 'Test',
  artist: 'Artist',
  key: 'Am',
  rhythm: '4/4',
  rawText: '\nC    G\nhello world\n'
});
assert.equal(ltr.title, 'Test');
assert.equal(ltr.artist, 'Artist');
assert.equal(ltr.key, 'A');
assert.equal(ltr.keyMode, 'min');
assert.equal(ltr.timeSignature, '4/4');
assert.equal(ltr.lyrics, 'hello world');
assert.deepEqual(
  ltr.chords.map(chord => [chord.name, chord.lineIndex, chord.charIndex]),
  [['C', 0, 0], ['G', 0, 5]]
);
assert.deepEqual(ltr.warnings, []);

const explicit = parser.parseRawSong({
  rawText: 'C  G\n*سلام*'
});
assert.equal(explicit.lyrics, 'سلام');
assert.deepEqual(
  explicit.chords.map(chord => [chord.name, chord.charIndex, chord.anchorType]),
  [
    ['C', 0, 'LineStart'],
    ['G', 4, 'LineEnd']
  ]
);

const rtl = parser.parseRawSong({
  rawText: 'C\nسلام دنیا'
});
assert.equal(rtl.lyrics, 'سلام دنیا');
assert.deepEqual(
  rtl.chords.map(chord => [chord.name, chord.charIndex, chord.anchorType]),
  [['C', 8, 'OnCharacter']]
);

assert.equal(parser.isChordOnlyLine('C  G  Am'), true);
assert.equal(parser.isChordOnlyLine('hello world'), false);
assert.equal(parser.hasPersian('سلام'), true);
assert.equal(parser.hasPersian('hello'), false);

assert.deepEqual(
  parser.validateParsedSong({
    lyrics: 'abc',
    chords: [{
      name: 'C',
      lineIndex: 0,
      charIndex: 3,
      anchorType: 'LineEnd'
    }]
  }),
  []
);

console.log('EditorRawSongParserService tests passed');
