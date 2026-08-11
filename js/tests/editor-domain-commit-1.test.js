/**
 * تست‌های Commit 1 — Editor Domain Extraction
 * LyricsParser + LyricPositionMapper + ChordLineSyncService + Transpose delegation
 *
 * اجرا: node js/tests/editor-domain-commit-1.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const LyricsParser = require('../editor/LyricsParser.js');
const LyricPositionMapper = require('../editor/LyricPositionMapper.js');
const ChordLineSyncService = require('../editor/ChordLineSyncService.js');

// TransposeService فایل browser-first است (بدون module.exports) اما Node-safe؛
// با eval غیرمستقیم در global scope لود می‌شود تا همان قراردادی تست شود که
// edShiftNote/edTransposeChord در app.js به آن delegate می‌کنند.
(0, eval)(fs.readFileSync(path.join(__dirname, '../core/TransposeService.js'), 'utf8'));
const TransposeService = globalThis.TransposeService;

let testCount = 0;

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => { testCount++; console.log(`✅ ${name}`); })
    .catch((error) => {
      console.error(`❌ ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

/* ─── LyricsParser ─── */

test('parser: خط آکورد ساده تشخیص و استخراج می‌شود', () => {
  const r = LyricsParser.parseChordLyricText('C  G  Am');
  assert.strictEqual(r.sections.length, 1);
  assert.strictEqual(r.sections[0].type, 'chord');
  assert.deepStrictEqual(r.sections[0].chords, ['C', 'G', 'Am']);
  assert.ok(r.allChords.has('Am'));
});

test('parser: slash chord پشتیبانی می‌شود', () => {
  const r = LyricsParser.parseChordLyricText('C/G  Am');
  assert.strictEqual(r.sections[0].type, 'chord');
  assert.deepStrictEqual(r.sections[0].chords, ['C/G', 'Am']);
});

test('parser: sharp و flat پشتیبانی می‌شوند', () => {
  const r = LyricsParser.parseChordLyricText('C#  Bb');
  assert.deepStrictEqual(r.sections[0].chords, ['C#', 'Bb']);
});

test('parser: qualityهای maj/min/dim/aug/sus/add', () => {
  // ⚠️ قفل رفتار موجود: در regex استخراج، `m` قبل از `maj`/`min` در alternation
  // آماده است، پس 'Cmaj' به 'Cm' و 'Dmin' به 'Dm' استخراج می‌شود (quirky legacy —
  // کاندیدای اصلاح عمدی در آینده، نه در این commit).
  const r = LyricsParser.parseChordLyricText('Cmaj  Dmin  Edim  Faug  Gsus4  Aadd9');
  assert.strictEqual(r.sections[0].type, 'chord');
  assert.deepStrictEqual(
    r.sections[0].chords,
    ['Cm', 'Dm', 'Edim', 'Faug', 'Gsus4', 'Aadd9']
  );
});

test('parser: خط با عدد (Cmaj7) آکوردی تشخیص داده می‌شود', () => {
  // تشخیص خط آکوردی است؛ استخراج طبق رفتار موجود 'Cm' برمی‌گرداند (همان quirk بالا)
  const r = LyricsParser.parseChordLyricText('Cmaj7');
  assert.strictEqual(r.sections[0].type, 'chord');
  assert.deepStrictEqual(r.sections[0].chords, ['Cm']);
});

test('parser: متن فارسی به‌عنوان lyric عبور می‌کند', () => {
  const r = LyricsParser.parseChordLyricText('سلام دنیا\nC  G');
  assert.strictEqual(r.sections[0].type, 'lyric');
  assert.strictEqual(r.sections[0].text, 'سلام دنیا');
  assert.strictEqual(r.sections[1].type, 'chord');
});

test('parser: خطوط خالی نادیده گرفته می‌شوند', () => {
  const r = LyricsParser.parseChordLyricText('C\n\n\n   \nG');
  assert.strictEqual(r.sections.length, 2);
});

/* ─── LyricPositionMapper ─── */

test('mapper: lineCharToAbs متن تک‌خطی و چندخطی', () => {
  assert.strictEqual(LyricPositionMapper.lineCharToAbs('abc', 0, 2), 2);
  assert.strictEqual(LyricPositionMapper.lineCharToAbs('abc\ndef', 1, 1), 5);
});

test('mapper: absToLineChar صفر، انتهای متن و خارج از محدوده', () => {
  assert.deepStrictEqual(
    LyricPositionMapper.absToLineChar('abc\ndef', 0),
    { lineIndex: 0, charIndex: 0 }
  );
  assert.deepStrictEqual(
    LyricPositionMapper.absToLineChar('abc\ndef', 7),
    { lineIndex: 1, charIndex: 3 }
  );
  assert.deepStrictEqual(
    LyricPositionMapper.absToLineChar('abc\ndef', 100),
    { lineIndex: 1, charIndex: 3 }
  );
});

test('mapper: خط خالی وسط متن', () => {
  assert.deepStrictEqual(
    LyricPositionMapper.absToLineChar('a\n\nb', 2),
    { lineIndex: 1, charIndex: 0 }
  );
});

test('mapper: کاراکتر فارسی در محاسبه offset', () => {
  assert.strictEqual(
    LyricPositionMapper.lineCharToAbs('سلام\nدنیا', 1, 2),
    7
  );
});

test('mapper: نگاشت LTR — startColumn مستقیم', () => {
  const r = LyricPositionMapper.mapChordColumnsToLyricIndices(
    'C       G',
    'hello world',
    [
      { name: 'C', startColumn: 0, endColumn: 1 },
      { name: 'G', startColumn: 8, endColumn: 9 }
    ]
  );
  assert.deepStrictEqual(r, [
    { name: 'C', charIndex: 0 },
    { name: 'G', charIndex: 8 }
  ]);
});

test('mapper: نگاشت RTL — endColumn از سمت راست', () => {
  const lyric = 'سلام دنیا'; // 9 کاراکتر
  const r = LyricPositionMapper.mapChordColumnsToLyricIndices(
    'C',
    lyric,
    [{ name: 'C', startColumn: 0, endColumn: 2 }]
  );
  assert.deepStrictEqual(r, [{ name: 'C', charIndex: 7 }]);
});

test('mapper: متن lyric خالی خروجی خالی دارد', () => {
  assert.deepStrictEqual(
    LyricPositionMapper.mapChordColumnsToLyricIndices('C', '', [{ name: 'C', startColumn: 0, endColumn: 1 }]),
    []
  );
});

test('mapper: remapAnchorToNewText لنگر OnCharacter و LineStart', () => {
  const onChar = { lineIndex: 0, charIndex: 1, anchorType: 'OnCharacter' };
  LyricPositionMapper.remapAnchorToNewText(onChar, 'abc', 'abc');
  assert.deepStrictEqual(
    { li: onChar.lineIndex, ci: onChar.charIndex },
    { li: 0, ci: 1 }
  );

  const lineStart = { lineIndex: 5, charIndex: 3, anchorType: 'LineStart' };
  LyricPositionMapper.remapAnchorToNewText(lineStart, 'a\nb\nc\nd\ne\nf', 'x\ny');
  assert.strictEqual(lineStart.lineIndex, 1);
  assert.strictEqual(lineStart.charIndex, 0);
});

/* ─── ChordLineSyncService ─── */

test('sync: مرتب‌سازی بر اساس lineIndex سپس charIndex', () => {
  const chords = [
    { lineIndex: 1, charIndex: 0, name: 'G' },
    { lineIndex: 0, charIndex: 5, name: 'C' },
    { lineIndex: 0, charIndex: 2, name: 'Am' }
  ];
  const sorted = ChordLineSyncService.sortLyricsChordsForSync(chords);
  assert.deepStrictEqual(sorted.map(c => c.name), ['Am', 'C', 'G']);
});

test('sync: آرایهٔ ورودی mutate نمی‌شود', () => {
  const chords = [
    { lineIndex: 1, charIndex: 0, name: 'G' },
    { lineIndex: 0, charIndex: 2, name: 'Am' }
  ];
  ChordLineSyncService.sortLyricsChordsForSync(chords);
  assert.deepStrictEqual(chords.map(c => c.name), ['G', 'Am']);
});

test('sync: اعمال نام‌ها روی clipها با تعداد clip کمتر از chord', () => {
  const chords = [{ name: 'C' }, { name: 'G' }, { name: 'Am' }];
  const clips = [{ name: 'X' }, { name: 'Y' }];
  const applied = ChordLineSyncService.applyChordNamesToClips(chords, clips);
  assert.strictEqual(applied, 2);
  assert.strictEqual(clips[0].name, 'C');
  assert.strictEqual(clips[1].name, 'G');
  assert.strictEqual(clips.length, 2);
});

/* ─── Transpose delegation ───
   edShiftNote/edTransposeChord در app.js به TransposeService delegate می‌کنند؛
   fallback legacy در app.js باقی است و در characterization tests مرورگر پوشش داده می‌شود. */

test('transpose: root ساده و wraparound دوازده نیم‌پرده‌ای', () => {
  assert.strictEqual(TransposeService.transposeNote('C', 2, true), 'D');
  assert.strictEqual(TransposeService.transposeNote('B', 1, true), 'C');
});

test('transpose: slash chord root و bass با هم جابه‌جا می‌شوند', () => {
  assert.strictEqual(TransposeService.transposeChordName('Am/G', 2, true), 'Bm/A');
});

test('transpose: ترجیح sharp/flat', () => {
  assert.strictEqual(TransposeService.transposeNote('C', 1, true), 'C#');
  assert.strictEqual(TransposeService.transposeNote('C', 1, false), 'Db');
});

test('transpose: semitone صفر نام را تغییر نمی‌دهد', () => {
  assert.strictEqual(TransposeService.transposeChordName('Am', 0, true), 'Am');
});

process.on('beforeExit', () => {
  if (!process.exitCode) {
    console.log(`\n${testCount} passed, 0 failed`);
  }
});
