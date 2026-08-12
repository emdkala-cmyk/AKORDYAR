const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorMutationService.js'),
  'utf8'
);

const context = {};
vm.runInNewContext(source, context);
const service = context.EditorMutationService.create({
  baseNameFromDisplayed: name => `base:${name || ''}`
});

const song = {
  lyrics: '*a**b\ncd',
  chords: [
    { lineIndex: 0, charIndex: 4, anchorType: 'OnCharacter', name: 'C' },
    { lineIndex: 0, charIndex: 1, anchorType: 'OnCharacter', name: 'G' },
    { lineIndex: 1, charIndex: 1, anchorType: 'OnCharacter', name: 'Am' }
  ],
  baseChordNames: ['C', 'G', 'Am']
};

const removed = service.removeAsterisks(song);
assert.equal(removed.changed, true);
assert.equal(removed.removed, 3);
assert.equal(song.lyrics, 'ab\ncd');
assert.equal(song.chords[0].charIndex, 1);
assert.equal(song.chords[1].charIndex, 0);

const reversed = service.reverseChords(song);
assert.equal(reversed.changed, true);
assert.equal(song.chords[0].charIndex, 0);
assert.equal(song.chords[1].charIndex, 1);

const moved = service.moveChords(
  song,
  [0, 2],
  'right',
  lineIndex => (lineIndex === 0 ? 2 : 2)
);
assert.equal(moved.changed, true);
assert.equal(song.chords[0].charIndex, 1);
assert.equal(song.chords[0].anchorType, 'OnCharacter');
assert.equal(song.chords[2].charIndex, 2);

const copied = service.moveChordsByDelta(
  song,
  [1],
  -1,
  () => 2,
  { copy: true }
);
assert.equal(JSON.stringify(copied.added), JSON.stringify([3]));
assert.equal(song.chords[3].charIndex, 0);
assert.equal(song.baseChordNames[3], 'base:G');

const deleted = service.deleteChords(song, [3, 1]);
assert.equal(deleted.changed, true);
assert.equal(JSON.stringify(deleted.deleted), JSON.stringify([3, 1]));
assert.equal(song.chords.length, 2);
assert.equal(song.baseChordNames.length, 2);

console.log('EditorMutationService tests passed');
