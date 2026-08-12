const assert = require('node:assert/strict');
const importModule = require('../editor/EditorSongImportService.js');

let currentSong = {
  id: 'song-1',
  key: 'C',
  keyMode: 'maj',
  chordLineClips: undefined,
  hasManualChordLineEdits: undefined
};
let setCalls = 0;

const service = importModule.create({
  getSong: () => currentSong,
  setSong: song => {
    currentSong = song;
    setCalls += 1;
  },
  createBlankSong: () => ({
    id: 'blank',
    key: 'C',
    keyMode: 'maj'
  }),
  isValidNote: note => ['C', 'D', 'F#'].includes(note)
});

const result = service.applyParsedResult({
  lyrics: 'سلام دنیا',
  chords: [{ name: 'C', lineIndex: 0, charIndex: 0 }],
  title: 'ترانه',
  artist: 'خواننده',
  key: 'F#m',
  keyMode: 'min',
  timeSignature: '6/8'
});

assert.equal(result.song, currentSong);
assert.equal(setCalls, 0);
assert.equal(currentSong.lyrics, 'سلام دنیا');
assert.equal(currentSong.title, 'ترانه');
assert.equal(currentSong.artist, 'خواننده');
assert.equal(currentSong.key, 'F#');
assert.equal(currentSong.keyMode, 'min');
assert.equal(currentSong.timeSignature, '6/8');
assert.equal(currentSong.originalKey, 'F#');
assert.equal(currentSong.originalKeyMode, 'min');
assert.equal(currentSong.transpose, 0);
assert.deepEqual(currentSong.baseChordNames, ['C']);
assert.deepEqual(currentSong.chordLineClips, []);
assert.equal(currentSong.hasManualChordLineEdits, false);
assert.equal(result.chordCount, 1);

let blankSong = null;
const blankService = importModule.create({
  getSong: () => blankSong,
  setSong: song => {
    blankSong = song;
  },
  createBlankSong: () => ({ key: 'D', keyMode: 'maj' }),
  isValidNote: () => true
});

const blankResult = blankService.applyParsedResult({
  lyrics: '',
  chords: [],
  title: ''
});
assert.equal(blankResult.song, blankSong);
assert.equal(blankSong.originalKey, 'D');

assert.equal(service.applyParsedResult(null), null);

console.log('EditorSongImportService tests passed');
