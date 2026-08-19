const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorKeyCommandService.js'),
  'utf8'
);

const context = {};
vm.runInNewContext(source, context);

const ensuredSongs = [];
const service = context.EditorKeyCommandService.create({
  transposeChord: (name, semitones) => semitones ? `${name}+${semitones}` : name,
  transposeKey: (key, semitones) => semitones ? `${key}+${semitones}` : key,
  keyDelta: (fromKey, toKey) => ({ C: 0, D: 2 }[toKey] - { C: 0, D: 2 }[fromKey]),
  ensureBaseChordNamesAligned: song => {
    ensuredSongs.push(song);
    if (!Array.isArray(song.baseChordNames)) song.baseChordNames = [];
    song.chords.forEach((chord, index) => {
      if (song.baseChordNames[index] === undefined) {
        song.baseChordNames[index] = chord.name;
      }
    });
    return song.baseChordNames;
  }
});

assert.equal(service.keyToSemi('Bb'), 10);
assert.equal(service.keyToSemi('unknown'), -1);
assert.equal(service.keyDelta('C', 'D'), 2);
assert.equal(service.keyDelta('D', 'C'), -2);
assert.equal(service.transposeKeyName('C', 2, true), 'C+2');

const song = {
  originalKey: 'C',
  originalKeyMode: 'maj',
  key: 'C',
  keyMode: 'maj',
  transpose: 0,
  chords: [{ name: 'C' }, { name: 'Am' }],
  baseChordNames: ['C', 'Am']
};

assert.equal(service.applyTranspose(song, 2).changed, true);
assert.equal(song.chords[0].name, 'C+2');
assert.equal(song.chords[1].name, 'Am+2');
assert.equal(song.key, 'C+2');
assert.equal(song.transpose, 2);

assert.equal(service.applyKeyChange(song, 'D', 'maj').delta, 2);
assert.equal(song.chords[0].name, 'C+2');
assert.equal(song.key, 'D');
assert.equal(song.transpose, 0);
assert.equal(song.originalKey, 'C');

assert.equal(service.applyOriginalKeyChange(song, 'D', 'maj').delta, 2);
assert.equal(song.baseChordNames[0], 'C+2');
assert.equal(song.originalKey, 'D');
assert.equal(song.chords[0].name, 'C+2');
assert.equal(song.key, 'D');
assert.equal(song.transpose, 0);

assert.equal(service.resetToOriginalKey(song).changed, true);
assert.equal(song.chords[0].name, 'C+2');
assert.equal(song.key, 'D');
assert.equal(song.transpose, 0);
assert.ok(ensuredSongs.length >= 3);

const editableSong = {
  originalKey: 'C',
  originalKeyMode: 'maj',
  key: 'D',
  keyMode: 'maj',
  transpose: 0,
  chords: [{ name: 'D' }, { name: 'Bm' }],
  baseChordNames: ['C', 'Am']
};

assert.equal(service.applyOriginalKeyChange(editableSong, 'E', 'min').changed, true);
assert.equal(editableSong.originalKey, 'E');
assert.equal(editableSong.originalKeyMode, 'min');
assert.equal(editableSong.key, 'D');
assert.equal(editableSong.keyMode, 'maj');
assert.equal(editableSong.chords[0].name, 'D');
assert.equal(editableSong.chords[1].name, 'Bm');
assert.equal(editableSong.baseChordNames[0], 'C+4');
assert.equal(editableSong.baseChordNames[1], 'Am+4');
assert.equal(editableSong.transpose, 0);

const syncedSong = {
  originalKey: 'E',
  originalKeyMode: 'min',
  key: 'D',
  keyMode: 'maj',
  transpose: 3,
  chords: [{ name: 'D+4' }, { name: 'B+4m' }],
  baseChordNames: ['C+4', 'A+4m']
};

assert.equal(service.syncProjectKeyToOriginal(syncedSong).changed, true);
assert.equal(syncedSong.originalKey, 'E');
assert.equal(syncedSong.originalKeyMode, 'min');
assert.equal(syncedSong.key, 'E');
assert.equal(syncedSong.keyMode, 'min');
assert.equal(syncedSong.chords[0].name, 'C+4');
assert.equal(syncedSong.chords[1].name, 'A+4m');
assert.equal(syncedSong.transpose, 0);

assert.equal(service.applyKeyChange(editableSong, 'F', 'maj').changed, true);
assert.equal(editableSong.originalKey, 'E');
assert.equal(editableSong.originalKeyMode, 'min');
assert.equal(editableSong.key, 'F');
assert.equal(editableSong.transpose, 0);

const lockedSong = { editorLocked: true, chords: [{ name: 'C' }] };
assert.equal(service.applyTranspose(lockedSong, 1).changed, false);
assert.equal(service.applyOriginalKeyChange(lockedSong, 'D', 'maj').changed, false);

console.log('EditorKeyCommandService tests passed');
