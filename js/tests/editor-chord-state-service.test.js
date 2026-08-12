const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorChordStateService.js'),
  'utf8'
);
const context = {};
vm.runInNewContext(source, context);

const service = context.EditorChordStateService.create({
  baseNameFromDisplayed: (name, song) =>
    song.transpose ? `${name}@${song.transpose}` : name
});

const song = {
  transpose: 2,
  chords: [
    { name: 'D', lineIndex: 0 },
    { name: '', lineIndex: 1 },
    { name: 'E', lineIndex: -1 }
  ],
  baseChordNames: ['C', '', 'E']
};

service.syncBaseChordName(song, 0);
assert.equal(song.baseChordNames[0], 'D@2');

service.filterChordsWithBase(song, chord => chord.lineIndex >= 0);
assert.equal(song.chords.length, 2);
assert.deepEqual(Array.from(song.baseChordNames), ['D@2', '']);

service.ensureBaseChordNamesAligned(song);
assert.equal(song.baseChordNames.length, 2);

service.removeChordAt(song, 0);
assert.equal(song.chords.length, 1);
assert.deepEqual(Array.from(song.baseChordNames), ['']);

console.log('EditorChordStateService tests passed');
