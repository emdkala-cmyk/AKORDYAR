const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorNotationService.js'),
  'utf8'
);

const context = {
  TransposeService: {
    transposeNote: (note, semitones, preferSharp) =>
      `${note}:${semitones}:${preferSharp}`,
    transposeChordName: (name, semitones, preferSharp) =>
      `${name}:${semitones}:${preferSharp}`,
    transposeKeyName: (key, semitones, preferSharp) =>
      `${key}:${semitones}:${preferSharp}`,
    keyDelta: (fromKey, toKey) => `${fromKey}->${toKey}`
  }
};
vm.runInNewContext(source, context);

assert.equal(
  context.EditorNotationService.transposeNote('C', 2, true),
  'C:2:true'
);
assert.equal(
  context.EditorNotationService.transposeChord('Am7', 2, false),
  'Am7:2:false'
);
assert.equal(
  context.EditorNotationService.transposeKey('C', 2, null),
  'C:2:null'
);
assert.equal(
  context.EditorNotationService.keyDelta('C', 'D'),
  'C->D'
);

console.log('EditorNotationService tests passed');
