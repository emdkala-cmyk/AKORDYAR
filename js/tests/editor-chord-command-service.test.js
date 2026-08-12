const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorChordCommandService.js'),
  'utf8'
);

const context = {};
vm.runInNewContext(source, context);
const baseNames = [];
const service = context.EditorChordCommandService.create({
  baseNameFromDisplayed: name => {
    baseNames.push(name);
    return `base:${name}`;
  }
});

assert.equal(service.normalizeName(' Am7 '), 'Am7');
assert.equal(service.normalizeName('Cmaj'), 'C');
assert.equal(service.normalizeName('Dmin'), 'Dm');

const parsed = service.parseName('Bbmin7/Eb');
assert.equal(parsed.root, 'Bb');
assert.equal(parsed.type, 'min');
assert.equal(parsed.tension, '7');
assert.equal(parsed.bass, 'Eb');
assert.equal(service.parseName('not-a-chord'), null);

const song = { chords: [], baseChordNames: [] };
const added = service.applyName(
  song,
  null,
  { lineIndex: 0, charIndex: 2, anchorType: 'OnCharacter' },
  ' Cmaj '
);
assert.equal(added.changed, true);
assert.equal(added.added, true);
assert.equal(added.index, 0);
assert.equal(song.chords[0].name, 'C');
assert.equal(song.baseChordNames[0], 'base:C');

const updated = service.applyName(song, 0, null, 'Dmin');
assert.equal(updated.changed, true);
assert.equal(updated.added, false);
assert.equal(song.chords[0].name, 'Dm');
assert.equal(song.baseChordNames[0], 'base:Dm');

const unchanged = service.applyName(song, 99, null, 'E');
assert.equal(unchanged.changed, false);
assert.equal(song.chords.length, 1);
assert.equal(baseNames.length, 2);

console.log('EditorChordCommandService tests passed');
