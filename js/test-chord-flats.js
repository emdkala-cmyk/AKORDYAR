/**
 * Test: Flat-note handling in chord editor, transpose, and chord-name parsing.
 *
 * These tests verify the fixes for supporting flat notes (Bb, Eb, Ab, Db, Gb)
 * in the chord editor, transpose logic, and chord-name parsing regexes.
 *
 * Run with: node test-chord-flats.js
 */

// ============================================================
// Replicate the pure notation logic (no DOM dependencies)
// ============================================================

// NOTE_SEMITONE (chord editor piano preview)
const NOTE_SEMITONE = { 'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11 };

// ED_SEMITONE (lyrics editor transpose)
const ED_SEMITONE = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11};

// ED_FLAT_MAP (used by edShiftNote to preserve flat spelling)
const ED_FLAT_MAP = { 1:'Db', 3:'Eb', 6:'Gb', 8:'Ab', 10:'Bb' };

// ED_FLAT_NOTES
const ED_FLAT_NOTES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const ED_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// edShiftNote — preserves flat/sharp spelling
function edShiftNote(n, semi) {
  const map = ED_SEMITONE;
  if (!(n in map)) return n;
  const sharp = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const flat = ED_FLAT_MAP;
  const idx = (map[n] + semi%12 + 12) % 12;
  // اگر ورودی بمل باشد، خروجی بمل بماند؛ اگر دیز باشد، خروجی دیز بماند
  if (n.includes('b')) return flat[idx] || sharp[idx];
  return sharp[idx];
}

// edTransposeChord
function edTransposeChord(name, semi) {
  if (!semi || !name) return name;
  return name.split('/').map(part => part.replace(/^([A-G][b#]?)/, (_,root) => edShiftNote(root,semi))).join('/');
}

// edTransposeKeyName — preserves flat spelling for keys
function edTransposeKeyName(key, semitones) {
  if (!key || !semitones) return key;
  const idx = ED_SEMITONE[key];
  if (idx == null) return key;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  if (key.includes('b')) {
    return ED_FLAT_NOTES[newIdx] || ED_NOTES[newIdx];
  }
  return ED_NOTES[newIdx];
}

// Chord-name parsing regex used in the timeline chord editor
// and edOpenChordModal (lyrics editor chord modal). Both use the same pattern.
const CHORD_NAME_REGEX = /^([A-G][#b]?)(maj|m(?:in)?|dim|aug|sus2|sus4)?(M7|7|9|b9|#9|11|#11|13|6)?(?:\/([A-G][#b]?))?$/;

// ============================================================
// Test helpers
// ============================================================
let passed = 0, failed = 0;

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

function assertTrue(actual, label) {
  if (actual) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}\n    expected: true\n    actual:   ${JSON.stringify(actual)}`);
  }
}

// ============================================================
// Test 1: NOTE_SEMITONE maps flats correctly
// ============================================================
console.log('\nTest 1: NOTE_SEMITONE flat mapping');
assertEqual(NOTE_SEMITONE['Db'], 1, 'Db = 1');
assertEqual(NOTE_SEMITONE['Eb'], 3, 'Eb = 3');
assertEqual(NOTE_SEMITONE['Gb'], 6, 'Gb = 6');
assertEqual(NOTE_SEMITONE['Ab'], 8, 'Ab = 8');
assertEqual(NOTE_SEMITONE['Bb'], 10, 'Bb = 10');
assertEqual(NOTE_SEMITONE['Db'], NOTE_SEMITONE['C#'], 'Db == C# (enharmonic)');
assertEqual(NOTE_SEMITONE['Bb'], NOTE_SEMITONE['A#'], 'Bb == A# (enharmonic)');

// ============================================================
// Test 2: edShiftNote preserves flat spelling
// ============================================================
console.log('\nTest 2: edShiftNote preserves flat spelling');
assertEqual(edShiftNote('Bb', 2), 'C', 'Bb +2 = C');
assertEqual(edShiftNote('Bb', -1), 'A', 'Bb -1 = A');
assertEqual(edShiftNote('Eb', 2), 'F', 'Eb +2 = F');
assertEqual(edShiftNote('Ab', 1), 'A', 'Ab +1 = A');
assertEqual(edShiftNote('Db', 1), 'D', 'Db +1 = D');
assertEqual(edShiftNote('Gb', 1), 'G', 'Gb +1 = G');
assertEqual(edShiftNote('Bb', 1), 'B', 'Bb +1 = B');
assertEqual(edShiftNote('Bb', 3), 'Db', 'Bb +3 = Db (flat preserved, enharmonic D)');
assertEqual(edShiftNote('Eb', 3), 'Gb', 'Eb +3 = Gb (flat preserved, enharmonic G)');
assertEqual(edShiftNote('Ab', 3), 'B', 'Ab +3 = B (sharp, no flat equivalent exists)');
assertEqual(edShiftNote('Db', 3), 'E', 'Db +3 = E (sharp, no flat equivalent exists)');
assertEqual(edShiftNote('Gb', 3), 'A', 'Gb +3 = A (sharp, no flat equivalent exists)');
assertEqual(edShiftNote('C#', 1), 'D', 'C# +1 = D (sharp preserved)');
assertEqual(edShiftNote('F#', 1), 'G', 'F# +1 = G (sharp preserved)');

// ============================================================
// Test 3: edTransposeChord handles flat roots
// ============================================================
console.log('\nTest 3: edTransposeChord with flat roots');
assertEqual(edTransposeChord('Bbm', 2), 'Cm', 'Bbm +2 = Cm');
assertEqual(edTransposeChord('Bbm', -1), 'Am', 'Bbm -1 = Am');
assertEqual(edTransposeChord('Ebmaj7', 2), 'Fmaj7', 'Ebmaj7 +2 = Fmaj7');
assertEqual(edTransposeChord('Ab', 1), 'A', 'Ab +1 = A');
assertEqual(edTransposeChord('Db7', 1), 'D7', 'Db7 +1 = D7');
assertEqual(edTransposeChord('Gb', 3), 'A', 'Gb +3 = A ');
assertEqual(edTransposeChord('Bbm7', 3), 'Dbm7', 'Bbm7 +3 = Dbm7 (flat preserved)');
assertEqual(edTransposeChord('Ab/C', 1), 'A/C#', 'Ab/C +1 = A/C# (bass transposed)');
assertEqual(edTransposeChord('Ebm/G', 2), 'Fm/A', 'Ebm/G +2 = Fm/A (bass transposed)');
assertEqual(edTransposeChord('Bbm', 0), 'Bbm', 'Bbm +0 unchanged');
assertEqual(edTransposeChord('C', 2), 'D', 'C +2 = D (sharp path)');

// ============================================================
// Test 4: edTransposeKeyName preserves flat spelling
// ============================================================
console.log('\nTest 4: edTransposeKeyName preserves flat spelling');
assertEqual(edTransposeKeyName('Bb', 2), 'C', 'Key Bb +2 = C');
assertEqual(edTransposeKeyName('Eb', 2), 'F', 'Key Eb +2 = F');
assertEqual(edTransposeKeyName('Ab', 1), 'A', 'Key Ab +1 = A');
assertEqual(edTransposeKeyName('Db', 1), 'D', 'Key Db +1 = D');
assertEqual(edTransposeKeyName('Gb', 3), 'A', 'Key Gb +3 = A ');
assertEqual(edTransposeKeyName('C', 2), 'D', 'Key C +2 = D (sharp path)');
assertEqual(edTransposeKeyName('F#', 1), 'G', 'Key F# +1 = G (sharp preserved)');

// ============================================================
// Test 5: Chord-name parsing regex supports flats
// ============================================================
console.log('\nTest 5: Chord-name parsing regex supports flats');

function parseChordName(name) {
  const m = name.match(CHORD_NAME_REGEX);
  if (!m) return null;
  let tp = m[2] || 'None';
  if (tp === 'm') tp = 'min';
  return { root: m[1] || 'None', type: tp, tension: m[3] || '', bass: m[4] || 'None' };
}

// Flat roots
let p = parseChordName('Bbm');
assertEqual(p.root, 'Bb', 'Bbm → root Bb');
assertEqual(p.type, 'min', 'Bbm → type min');

p = parseChordName('Ebmaj7');
assertEqual(p.root, 'Eb', 'Ebmaj7 → root Eb');
assertEqual(p.type, 'maj', 'Ebmaj7 → type maj');
assertEqual(p.tension, '7', 'Ebmaj7 → tension 7 (maj7 → maj + 7 in this app convention)');

p = parseChordName('Ab');
assertEqual(p.root, 'Ab', 'Ab → root Ab');
assertEqual(p.type, 'None', 'Ab → type None');

p = parseChordName('Db7');
assertEqual(p.root, 'Db', 'Db7 → root Db');
assertEqual(p.tension, '7', 'Db7 → tension 7');

p = parseChordName('Gb');
assertEqual(p.root, 'Gb', 'Gb → root Gb');

// Flat root with bass
p = parseChordName('Ab/C');
assertEqual(p.root, 'Ab', 'Ab/C → root Ab');
assertEqual(p.bass, 'C', 'Ab/C → bass C');

p = parseChordName('Ebm/G');
assertEqual(p.root, 'Eb', 'Ebm/G → root Eb');
assertEqual(p.type, 'min', 'Ebm/G → type min');
assertEqual(p.bass, 'G', 'Ebm/G → bass G');

// Sharp roots still work
p = parseChordName('F#m');
assertEqual(p.root, 'F#', 'F#m → root F#');
assertEqual(p.type, 'min', 'F#m → type min');

p = parseChordName('C#m7');
assertEqual(p.root, 'C#', 'C#m7 → root C#');
assertEqual(p.tension, '7', 'C#m7 → tension 7');

// Natural roots still work
p = parseChordName('Cmaj7');
assertEqual(p.root, 'C', 'Cmaj7 → root C');
assertEqual(p.type, 'maj', 'Cmaj7 → type maj');
assertEqual(p.tension, '7', 'Cmaj7 → tension 7 (maj7 → maj + 7 in this app convention)');

p = parseChordName('Dm');
assertEqual(p.root, 'D', 'Dm → root D');
assertEqual(p.type, 'min', 'Dm → type min');

// ============================================================
// Test 6: updateChordPreview root index uses NOTE_SEMITONE
// ============================================================
console.log('\nTest 6: updateChordPreview root index uses NOTE_SEMITONE');
// This replicates the fix: rootIdx = NOTE_SEMITONE[root] != null ? NOTE_SEMITONE[root] : NOTES.indexOf(root)
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function getRootIdx(root) {
  return NOTE_SEMITONE[root] != null ? NOTE_SEMITONE[root] : NOTES.indexOf(root);
}
assertEqual(getRootIdx('Bb'), 10, 'Bb root index = 10 (was -1 before fix)');
assertEqual(getRootIdx('Eb'), 3, 'Eb root index = 3 (was -1 before fix)');
assertEqual(getRootIdx('Ab'), 8, 'Ab root index = 8 (was -1 before fix)');
assertEqual(getRootIdx('Db'), 1, 'Db root index = 1 (was -1 before fix)');
assertEqual(getRootIdx('Gb'), 6, 'Gb root index = 6 (was -1 before fix)');
assertEqual(getRootIdx('C'), 0, 'C root index = 0');
assertEqual(getRootIdx('F#'), 6, 'F# root index = 6');

// ============================================================
// Test 7: updateChordPreview bass note converts flats to sharps
// ============================================================
console.log('\nTest 7: updateChordPreview bass note converts flats to sharps');
const NOTE_TO_SHARP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
function getBassSharp(bass) {
  return NOTE_TO_SHARP[bass] || bass;
}
assertEqual(getBassSharp('Bb'), 'A#', 'Bass Bb → A# for piano key lookup');
assertEqual(getBassSharp('Eb'), 'D#', 'Bass Eb → D# for piano key lookup');
assertEqual(getBassSharp('Ab'), 'G#', 'Bass Ab → G# for piano key lookup');
assertEqual(getBassSharp('Db'), 'C#', 'Bass Db → C# for piano key lookup');
assertEqual(getBassSharp('Gb'), 'F#', 'Bass Gb → F# for piano key lookup');
assertEqual(getBassSharp('C'), 'C', 'Bass C unchanged');
assertEqual(getBassSharp('F#'), 'F#', 'Bass F# unchanged');

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('❌ Some tests FAILED');
  process.exit(1);
} else {
  console.log('✅ All tests passed');
}
