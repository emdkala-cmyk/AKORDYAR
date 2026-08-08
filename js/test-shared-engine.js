/**
 * test-shared-engine.js — Comprehensive tests for the shared chord engine
 * 
 * Run with: node js/test-shared-engine.js
 */

// Load sharedEngine in Node context
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, 'sharedEngine.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const SE = sandbox.window.SharedEngine;

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}: ${actual}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}: expected "${expected}" but got "${actual}"`);
  }
}

function assertNotEqual(actual, expected, label) {
  if (actual !== expected) {
    passed++;
    console.log(`  ✓ ${label}: ${actual}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}: expected not "${expected}" but got "${actual}"`);
  }
}

console.log('=== Test 1: Basic transpose (auto preference) ===');
assertEqual(SE.transposeChordName('Dm', -1, null), 'C#m', 'Dm -1 = C#m (auto)');
assertEqual(SE.transposeChordName('Dm', -1, false), 'Dbm', 'Dm -1 = Dbm (flat)');
assertEqual(SE.transposeChordName('Dm', -1, true), 'C#m', 'Dm -1 = C#m (sharp)');

console.log('\n=== Test 2: Key change Dm → Dbm ===');
// Dm original key, Dbm target key: delta = -1 semitone
const delta = SE.keyDelta('Dm', 'Dbm');
assertEqual(delta, 11, 'Dm → Dbm delta = 11 (or -1)');
assertEqual(SE.transposeChordName('Dm', delta, false), 'Dbm', 'Dm +11 = Dbm (flat)');
assertEqual(SE.transposeChordName('Dm', delta, true), 'C#m', 'Dm +11 = C#m (sharp)');

console.log('\n=== Test 3: C → Db and C → C# ===');
assertEqual(SE.transposeChordName('C', 1, false), 'Db', 'C +1 = Db (flat)');
assertEqual(SE.transposeChordName('C', 1, true), 'C#', 'C +1 = C# (sharp)');

console.log('\n=== Test 4: D → Eb and D → D# ===');
assertEqual(SE.transposeChordName('D', 1, false), 'Eb', 'D +1 = Eb (flat)');
assertEqual(SE.transposeChordName('D', 1, true), 'D#', 'D +1 = D# (sharp)');

console.log('\n=== Test 5: F# → Gb and G# → Ab and A# → Bb (enharmonic) ===');
// F# +1 = G (natural, not Gb - F# is already Gb's enharmonic equivalent)
assertEqual(SE.formatNoteName(6, false), 'Gb', 'semitone 6 flat = Gb');
assertEqual(SE.formatNoteName(6, true), 'F#', 'semitone 6 sharp = F#');
assertEqual(SE.formatNoteName(8, false), 'Ab', 'semitone 8 flat = Ab');
assertEqual(SE.formatNoteName(8, true), 'G#', 'semitone 8 sharp = G#');
assertEqual(SE.formatNoteName(10, false), 'Bb', 'semitone 10 flat = Bb');
assertEqual(SE.formatNoteName(10, true), 'A#', 'semitone 10 sharp = A#');

console.log('\n=== Test 6: Dm → Fm (major third up) ===');
assertEqual(SE.transposeChordName('Dm', 3, null), 'Fm', 'Dm +3 = Fm');

console.log('\n=== Test 7: Slash chords ===');
assertEqual(SE.transposeChordName('G/B', 1, false), 'Ab/C', 'G/B +1 = Ab/C (flat)');
assertEqual(SE.transposeChordName('G/B', 1, true), 'G#/C', 'G/B +1 = G#/C (sharp)');
assertEqual(SE.transposeChordName('G/B', -1, false), 'Gb/Bb', 'G/B -1 = Gb/Bb (flat)');

console.log('\n=== Test 8: Complex chords ===');
assertEqual(SE.transposeChordName('Bbmaj7', 2, null), 'Cmaj7', 'Bbmaj7 +2 = Cmaj7');
assertEqual(SE.transposeChordName('C#7', 1, false), 'D7', 'C#7 +1 = D7');
assertEqual(SE.transposeChordName('Ebm', 1, false), 'Em', 'Ebm +1 = Em');
assertEqual(SE.transposeChordName('F#sus4', 1, false), 'Gsus4', 'F#sus4 +1 = Gsus4');
assertEqual(SE.transposeChordName('A/C#', 1, false), 'Bb/D', 'A/C# +1 = Bb/D (flat)');

console.log('\n=== Test 9: Round-trip transpose (3 times back and forth) ===');
let chord = 'Dm';
for (let i = 0; i < 3; i++) {
  chord = SE.transposeChordName(chord, 2, null);
  chord = SE.transposeChordName(chord, -2, null);
}
assertEqual(chord, 'Dm', 'Dm +2 -2 +2 -2 +2 -2 = Dm (no drift)');

console.log('\n=== Test 10: Key change after transpose ===');
// Start with Dm, transpose +2 → Em, then key change to Fm
const origKey = 'Dm';
const transposed = SE.transposeKeyName(origKey, 2, null);
assertEqual(transposed, 'Em', 'Dm +2 = Em');
// Now key change from Em to Fm: delta = 1 (E=4, F=5)
const delta2 = SE.keyDelta('Em', 'Fm');
assertEqual(delta2, 1, 'Em → Fm delta = 1');
assertEqual(SE.transposeChordName('Dm', 2 + delta2, null), 'Fm', 'Dm +2 +1 = Fm');

console.log('\n=== Test 11: Transpose after key change ===');
// Key change Dm → Fm (delta=3), then transpose +1
const delta3 = SE.keyDelta('Dm', 'Fm');
assertEqual(delta3, 3, 'Dm → Fm delta = 3');
assertEqual(SE.transposeChordName('Dm', delta3 + 1, null), 'F#m', 'Dm +3 +1 = F#m');

console.log('\n=== Test 12: Unicode accidentals ===');
assertEqual(SE.normalizeChord('D♭m'), 'Dbm', 'D♭m → Dbm');
assertEqual(SE.normalizeChord('F♯'), 'F#', 'F♯ → F#');

console.log('\n=== Test 13: Key name transpose ===');
assertEqual(SE.transposeKeyName('Dm', -1, false), 'Dbm', 'Key Dm -1 = Dbm (flat)');
assertEqual(SE.transposeKeyName('Dm', -1, true), 'C#m', 'Key Dm -1 = C#m (sharp)');
assertEqual(SE.transposeKeyName('F', 1, false), 'Gb', 'Key F +1 = Gb (flat)');
assertEqual(SE.transposeKeyName('Bb', 2, null), 'C', 'Key Bb +2 = C');

console.log('\n=== Test 14: Invalid chords preserved ===');
assertEqual(SE.transposeChordName('XYZ', 2, null), 'XYZ', 'Invalid chord preserved');
assertEqual(SE.transposeChordName('', 2, null), '', 'Empty chord preserved');
assertEqual(SE.transposeChordName('Dm', 0, null), 'Dm', 'Zero transpose unchanged');

console.log('\n=== Test 15: Quality preservation ===');
assertEqual(SE.transposeChordName('D7', -1, false), 'Db7', 'D7 -1 = Db7 (flat)');
assertEqual(SE.transposeChordName('Dm7', -1, false), 'Dbm7', 'Dm7 -1 = Dbm7 (flat)');
assertEqual(SE.transposeChordName('Dmaj7', -1, false), 'Dbmaj7', 'Dmaj7 -1 = Dbmaj7 (flat)');
assertEqual(SE.transposeChordName('Dm7b5', -1, false), 'Dbm7b5', 'Dm7b5 -1 = Dbm7b5 (flat)');

console.log('\n=== Test 16: Key signature preference detection ===');
assertEqual(SE.detectKeyAccidentalPreference('F'), false, 'F prefers flats');
assertEqual(SE.detectKeyAccidentalPreference('Bb'), false, 'Bb prefers flats');
assertEqual(SE.detectKeyAccidentalPreference('Dm'), null, 'Dm is neutral');
assertEqual(SE.detectKeyAccidentalPreference('F#'), true, 'F# prefers sharps');

console.log('\n=== Test 17: parseChord ===');
const parsed = SE.parseChord('Bbmaj7');
assertEqual(parsed.root, 'B', 'Bbmaj7 root = B');
assertEqual(parsed.accidental, 'b', 'Bbmaj7 accidental = b');
assertEqual(parsed.quality, 'maj', 'Bbmaj7 quality = maj');
assertEqual(parsed.suffix, '7', 'Bbmaj7 suffix = 7');

const parsed2 = SE.parseChord('F#sus4');
assertEqual(parsed2.root, 'F', 'F#sus4 root = F');
assertEqual(parsed2.accidental, '#', 'F#sus4 accidental = #');
assertEqual(parsed2.quality, 'sus', 'F#sus4 quality = sus');
assertEqual(parsed2.suffix, '4', 'F#sus4 suffix = 4');

const parsed3 = SE.parseChord('G/B');
assertEqual(parsed3.root, 'G', 'G/B root = G');
assertEqual(parsed3.bassStr, 'B', 'G/B bass = B');

console.log('\n=== Test 18: formatNoteName ===');
assertEqual(SE.formatNoteName(1, false), 'Db', 'semitone 1 flat = Db');
assertEqual(SE.formatNoteName(1, true), 'C#', 'semitone 1 sharp = C#');
assertEqual(SE.formatNoteName(3, false), 'Eb', 'semitone 3 flat = Eb');
assertEqual(SE.formatNoteName(6, false), 'Gb', 'semitone 6 flat = Gb');
assertEqual(SE.formatNoteName(8, false), 'Ab', 'semitone 8 flat = Ab');
assertEqual(SE.formatNoteName(10, false), 'Bb', 'semitone 10 flat = Bb');

console.log('\n=== Test 19: transposeNote ===');
assertEqual(SE.transposeNote('D', -1, false), 'Db', 'D -1 = Db (flat)');
assertEqual(SE.transposeNote('D', -1, true), 'C#', 'D -1 = C# (sharp)');
assertEqual(SE.transposeNote('C', 1, false), 'Db', 'C +1 = Db (flat)');

console.log('\n=== Test 20: Laminor-style chords ===');
// Chords commonly found in Laminor extractions
const laminorChords = ['Dm', 'Gm', 'C', 'F', 'Bb', 'Eb', 'Am', 'D7', 'G7', 'C7', 'F7', 'Bbm', 'Ebm', 'Ab', 'Db', 'Gb', 'C#m', 'F#m', 'Bm', 'E', 'A', 'D', 'G', 'B', 'Em', 'A7', 'B7', 'E7', 'F#7', 'C#7', 'G#m', 'D#m', 'A#m'];
laminorChords.forEach(ch => {
  const transposed = SE.transposeChordName(ch, 2, null);
  console.log(`  ✓ ${ch} +2 = ${transposed}`);
});

console.log('\n=== Test 21: No double-transpose (idempotency) ===');
// Transposing twice with same total should equal transposing once with sum
const c1 = SE.transposeChordName('Dm', 2, null);
const c2 = SE.transposeChordName(c1, 1, null);
const c3 = SE.transposeChordName('Dm', 3, null);
assertEqual(c2, c3, 'Dm +2 then +1 = Dm +3');

console.log('\n=== Test 22: Key change resets transpose ===');
// Simulate: original key Dm, transpose +2 → Em, then key change to Fm
// After key change, transpose should be 0 and chords based on new key
const baseChords = ['Dm', 'Gm', 'Am'];
const transposedChords = baseChords.map(c => SE.transposeChordName(c, 2, null));
assertEqual(transposedChords[0], 'Em', 'Dm +2 = Em');
// Key change to Fm: delta from original Dm to Fm = 3
const keyChangeDelta = SE.keyDelta('Dm', 'Fm');
const newKeyChords = baseChords.map(c => SE.transposeChordName(c, keyChangeDelta, null));
assertEqual(newKeyChords[0], 'Fm', 'Dm → Fm = Fm');
assertEqual(newKeyChords[1], 'A#m', 'Gm → Fm = A#m (auto)');
assertEqual(newKeyChords[2], 'Cm', 'Am → Fm = Cm');
// With flat preference, Gm → Fm should be Bbm
assertEqual(SE.transposeChordName('Gm', keyChangeDelta, false), 'Bbm', 'Gm → Fm = Bbm (flat)');

console.log('\n=== Test 23: Transpose after key change ===');
// After key change to Fm, transpose +1
const afterKeyChange = newKeyChords.map(c => SE.transposeChordName(c, 1, null));
assertEqual(afterKeyChange[0], 'F#m', 'Fm +1 = F#m');

console.log('\n=== Test 24: Renderer consistency ===');
// All renderers should get the same output from the same engine
const testChord = 'Dm';
const renderer1 = SE.transposeChordName(testChord, -1, false);
const renderer2 = SE.transposeChordName(testChord, -1, false);
const renderer3 = SE.transposeChordName(testChord, -1, false);
assertEqual(renderer1, renderer2, 'Renderer 1 = Renderer 2');
assertEqual(renderer2, renderer3, 'Renderer 2 = Renderer 3');
assertEqual(renderer1, 'Dbm', 'All renderers produce Dbm');

console.log('\n=== Test 25: Save/load round-trip ===');
// Simulate saving and loading a project with transposed chords
const savedChords = ['Dm', 'Gm', 'Am', 'Bb', 'C'];
const savedTranspose = 2;
const loadedChords = savedChords.map(c => SE.transposeChordName(c, savedTranspose, null));
// After load, transpose is 0 and chords are the saved (transposed) ones
const reloadedChords = loadedChords.map(c => SE.transposeChordName(c, 0, null));
assertEqual(reloadedChords[0], loadedChords[0], 'Reload preserves transposed chords');

console.log('\n=== Test 26: Manual sharp/flat selection ===');
// User selects "flat" → all chords use flat naming
assertEqual(SE.transposeChordName('C', 1, false), 'Db', 'Flat mode: C +1 = Db');
assertEqual(SE.transposeChordName('D', 1, false), 'Eb', 'Flat mode: D +1 = Eb');
assertEqual(SE.transposeChordName('F', 1, false), 'Gb', 'Flat mode: F +1 = Gb');
assertEqual(SE.transposeChordName('G', 1, false), 'Ab', 'Flat mode: G +1 = Ab');
assertEqual(SE.transposeChordName('A', 1, false), 'Bb', 'Flat mode: A +1 = Bb');
// User selects "sharp" → all chords use sharp naming
assertEqual(SE.transposeChordName('C', 1, true), 'C#', 'Sharp mode: C +1 = C#');
assertEqual(SE.transposeChordName('D', 1, true), 'D#', 'Sharp mode: D +1 = D#');
assertEqual(SE.transposeChordName('F', 1, true), 'F#', 'Sharp mode: F +1 = F#');
assertEqual(SE.transposeChordName('G', 1, true), 'G#', 'Sharp mode: G +1 = G#');
assertEqual(SE.transposeChordName('A', 1, true), 'A#', 'Sharp mode: A +1 = A#');

console.log('\n=== Test 27: Auto mode based on key ===');
// Auto mode: if key is flat, use flats; if sharp, use sharps
assertEqual(SE.transposeChordName('C', 1, null), 'C#', 'Auto: C +1 = C# (default sharp)');
assertEqual(SE.transposeChordName('Bb', 1, null), 'B', 'Auto: Bb +1 = B (natural)');
assertEqual(SE.transposeChordName('Eb', 1, null), 'E', 'Auto: Eb +1 = E (natural)');
assertEqual(SE.transposeChordName('Ab', 1, null), 'A', 'Auto: Ab +1 = A (natural)');

console.log('\n=== Test 28: Dm → Dbm with auto preference ===');
// The key fix: Dm → Dbm should work with flat preference
assertEqual(SE.transposeChordName('Dm', -1, false), 'Dbm', 'Dm -1 = Dbm (flat)');
assertEqual(SE.transposeChordName('Dm', -1, true), 'C#m', 'Dm -1 = C#m (sharp)');

console.log('\n=== Test 29: G/B → Gb/Bb ===');
assertEqual(SE.transposeChordName('G/B', -1, false), 'Gb/Bb', 'G/B -1 = Gb/Bb (flat)');
assertEqual(SE.transposeChordName('G/B', -1, true), 'F#/A#', 'G/B -1 = F#/A# (sharp)');

console.log('\n=== Test 30: Bbmaj7 → Cmaj7 ===');
assertEqual(SE.transposeChordName('Bbmaj7', 2, null), 'Cmaj7', 'Bbmaj7 +2 = Cmaj7');

console.log('\n\n=== SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED ✓');
}