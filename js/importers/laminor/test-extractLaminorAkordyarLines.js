/**
 * تست و Debug برای Akordyar Laminor Extractor — V5 Reference Port
 *
 * دو حالت:
 * 1. تست Node.js — تست توابع پردازش بدون نیاز به DOM
 * 2. تست مرورگر — تست extractLaminorAkordyarLines با root واقعی (#main-chord)
 *
 * اجرا در Node:
 *   node js/importers/laminor/test-extractLaminorAkordyarLines.js
 *
 * اجرا در مرورگر (Console):
 *   AkordyarLaminorExtractorDebug.debugFromMainChord()
 *
 * نکته:
 *   هستهٔ extractV5 نیاز به DOM رندر شده دارد (getBoundingClientRect + caretPosition).
 *   برای مقایسهٔ دقیق charIndex با خروجی Console V5، تست مرورگر را روی صفحهٔ
 *   واقعی Laminor اجرا کنید.
 */

'use strict';

/* ═══════════════════════════════════════════════
   تست‌های بدون DOM (Node)
   ═══════════════════════════════════════════════ */

function runPureFunctionTests() {
  const extractor = global.AkordyarLaminorExtractor;

  if (!extractor) {
    console.error('AkordyarLaminorExtractor پیدا نشد. ابتدا extractLaminorAkordyarLines.js را لود کنید.');
    return false;
  }

  const {
    buildPreviewLine,
    processV5Line,
    isOnlyChordLine,
    normalizeSpaces,
    cleanOutputText
  } = extractor;

  const tests = [
    /* ─── buildPreviewLine: درج آکورد در محل charIndex ─── */
    {
      name: 'buildPreviewLine: یک chrord-line و یک chord-text — آکورد وسط',
      input: { text: 'سلام دنیا', chords: [{ symbol: 'Am', charIndex: 5 }] },
      expected: 'سلام [Am]دنیا',
      fn: (line) => buildPreviewLine(line)
    },
    {
      name: 'buildPreviewLine: آکورد در ابتدای خط (charIndex 0)',
      input: { text: 'سلام دنیا', chords: [{ symbol: 'Am', charIndex: 0 }] },
      expected: '[Am]سلام دنیا',
      fn: (line) => buildPreviewLine(line)
    },
    {
      name: 'buildPreviewLine: آکورد در انتهای خط (charIndex = length)',
      input: { text: 'سلام دنیا', chords: [{ symbol: 'Am', charIndex: 9 }] },
      expected: 'سلام دنیا[Am]',
      fn: (line) => buildPreviewLine(line)
    },
    {
      name: 'buildPreviewLine: چند آکورد — بدون جابه‌جایی، ترتیب charIndex حفظ شود',
      input: {
        text: 'سلام دنیای قشنگ',
        chords: [
          { symbol: 'Am', charIndex: 0 },
          { symbol: 'G', charIndex: 6 },
          { symbol: 'Dm', charIndex: 12 }
        ]
      },
      expected: '[Am]سلام د[G]نیای ق[Dm]شنگ',
      fn: (line) => buildPreviewLine(line)
    },
    {
      name: 'buildPreviewLine: خط فقط‌آکوردی (text خالی)',
      input: { text: '', chords: [{ symbol: 'Am', charIndex: 0 }] },
      expected: '[Am]',
      fn: (line) => buildPreviewLine(line)
    },

    /* ─── processV5Line: فقط نرمال‌سازی فاصله، هیچ جابه‌جایی آکورد ─── */
    {
      name: 'processV5Line: آکورد انتهای خط — تغییر نکند (V5 behavior)',
      input: 'غم میون دو تا چشمون قشنگت[Am]',
      expected: 'غم میون دو تا چشمون قشنگت[Am]',
      fn: processV5Line
    },
    {
      name: 'processV5Line: آکورد ابتدای خط — تغییر نکند (V5 behavior)',
      input: '[Am]غم میون دو تا چشمون قشنگت',
      expected: '[Am]غم میون دو تا چشمون قشنگت',
      fn: processV5Line
    },
    {
      name: 'processV5Line: چند آکورد — تغییر نکند',
      input: 'غم میون [Am]دو تا [G]چشمون قشنگت[Dm]',
      expected: 'غم میون [Am]دو تا [G]چشمون قشنگت[Dm]',
      fn: processV5Line
    },
    {
      name: 'processV5Line: فاصله‌های اضافه حذف شود + trim',
      input: '  سلام    دنیا  ',
      expected: 'سلام دنیا',
      fn: processV5Line
    },
    {
      name: 'processV5Line: خط فقط آکورد — تغییر نکند',
      input: '[Am] [G] [Dm]',
      expected: '[Am] [G] [Dm]',
      fn: processV5Line
    },

    /* ─── isOnlyChordLine ─── */
    {
      name: 'isOnlyChordLine: خط فقط آکوردی → true',
      input: '[Am] [G] [Dm]',
      expected: true,
      fn: (line) => isOnlyChordLine(line) === true
    },
    {
      name: 'isOnlyChordLine: خط با متن → false',
      input: 'سلام دنیا[Am]',
      expected: true,
      fn: (line) => isOnlyChordLine(line) === false
    },
    {
      name: 'isOnlyChordLine: خط فقط یک آکورد → true',
      input: '[Am]',
      expected: true,
      fn: (line) => isOnlyChordLine(line) === true
    },

    /* ─── normalizeSpaces ─── */
    {
      name: 'normalizeSpaces: فاصله‌های متوالی → یک فاصله',
      input: 'سلام    دنیا',
      expected: 'سلام دنیا',
      fn: normalizeSpaces
    },
    {
      name: 'normalizeSpaces: trim سمت‌ها',
      input: '  سلام دنیا  ',
      expected: 'سلام دنیا',
      fn: normalizeSpaces
    },

    /* ─── cleanOutputText: کشیده و trim ─── */
    {
      name: 'cleanOutputText: حذف کشیده و trim',
      input: '  ســلامــ دنیا  ',
      expected: 'سلام دنیا',
      fn: cleanOutputText
    },
    {
      name: 'cleanOutputText: نیم‌فاصله حفظ شود (حذف نشود)',
      input: 'می‌روم به خانه',
      expected: 'می‌روم به خانه',
      fn: cleanOutputText
    }
  ];

  let passed = 0;
  let failed = 0;

  console.log('========================================');
  console.log('🧪 تست‌های Pure Functions — V5 Reference');
  console.log('========================================');

  for (const test of tests) {
    let actual;
    let ok;

    try {
      actual = test.fn(test.input);
      ok = actual === test.expected;
    } catch (e) {
      actual = `ERROR: ${e.message}`;
      ok = false;
    }

    if (ok) {
      passed++;
      console.log('✅ ' + test.name);
    } else {
      failed++;
      console.log('❌ ' + test.name);
      console.log('   Input:    ' + JSON.stringify(test.input));
      console.log('   Expected: ' + JSON.stringify(test.expected));
      console.log('   Actual:   ' + JSON.stringify(actual));
    }
  }

  console.log('========================================');
  console.log('نتیجه: ' + passed + ' موفق، ' + failed + ' ناموفق');
  console.log('========================================');

  return failed === 0;
}

/* ═══════════════════════════════════════════════
   تست مرورگر — استخراج از #main-chord
   ═══════════════════════════════════════════════ */

function debugFromMainChord() {
  const extractor = global.AkordyarLaminorExtractor;

  if (!extractor) {
    console.error('AkordyarLaminorExtractor پیدا نشد.');
    return null;
  }

  const root = document.querySelector('#main-chord');

  if (!root) {
    console.error('#main-chord پیدا نشد. مطمئن شو داخل صفحهٔ آهنگ لامینور هستی.');
    return null;
  }

  const result = extractor.extractLaminorAkordyarLines(root);

  console.group('🎵 Akordyar Laminor Extractor V5 — Debug');
  console.log('final (با مختصات خام):', result.final);
  console.log('rawLines (قبل از normalize):', result.rawLines);
  console.log('lines (خروجی نهایی):', result.lines);
  console.log('برای کپی:', 'copy(JSON.stringify(result.lines, null, 2))');
  console.groupEnd();

  return result;
}

/* ═══════════════════════════════════════════════
   اجرا در Node.js
   ═══════════════════════════════════════════════ */

if (typeof module !== 'undefined' && module.exports) {
  const extractor = require('./extractLaminorAkordyarLines.js');
  global.AkordyarLaminorExtractor = extractor;

  const allPassed = runPureFunctionTests();

  if (!allPassed) {
    process.exit(1);
  }
}

/* ═══════════════════════════════════════════════
   Exports برای مرورگر
   ═══════════════════════════════════════════════ */

if (typeof window !== 'undefined') {
  window.AkordyarLaminorExtractorDebug = {
    runPureFunctionTests: runPureFunctionTests,
    debugFromMainChord: debugFromMainChord
  };
}