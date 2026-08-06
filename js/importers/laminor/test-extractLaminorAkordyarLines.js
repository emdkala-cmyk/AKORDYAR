/**
 * تست و Debug برای Akordyar Laminor Extractor V6.2
 *
 * دو حالت:
 * 1. تست Node.js — تست توابع post processor بدون نیاز به DOM
 * 2. تست مرورگر — تست extractLaminorAkordyarLines با root واقعی
 *
 * اجرا در Node:
 *   node js/importers/laminor/test-extractLaminorAkordyarLines.js
 *
 * اجرا در مرورگر (Console):
 *   AkordyarLaminorExtractorDebug.debugFromMainChord()
 */

(function (global) {
  'use strict';

  // ===============================
  // تست‌های Post Processor (بدون نیاز به DOM)
  // ===============================

  function runPostProcessorTests() {
    const extractor = global.AkordyarLaminorExtractor;

    if (!extractor) {
      console.error('AkordyarLaminorExtractor پیدا نشد. ابتدا extractLaminorAkordyarLines.js را لود کنید.');
      return false;
    }

    const {
      processV62Line,
      fixEndingChordToStart,
      fixSingleChordPosition,
      fixChordInsidePersianWord,
      normalizeSpaces
    } = extractor;

    const tests = [
      {
        name: 'V7: آکورد انتهای خط در جای خود بماند (تغییر نکند)',
        input: 'غم میون دو تا چشمون قشنگت[Am]',
        expected: 'غم میون دو تا چشمون قشنگت[Am]',
        fn: fixEndingChordToStart
      },
      {
        name: 'V7.1: آکورد انتهای خط تک‌آکوردی در processV62Line به ابتدا منتقل شود',
        input: 'غم میون دو تا چشمون قشنگت[Am]',
        expected: '[Am]غم میون دو تا چشمون قشنگت',
        fn: processV62Line
      },
      {
        name: 'نمونه 2: آکورد وسط کلمه فارسی به ابتدای کلمه منتقل شود',
        input: 'لونه ک[Am]رده',
        expected: 'لونه [Am]کرده',
        fn: fixChordInsidePersianWord
      },
      {
        name: 'V7: ترکیبی — آکورد انتها حفظ شود و وسط کلمه اصلاح شود',
        input: 'غم میون دو تا چش[G]مون قشنگت[Am]',
        expected: 'غم میون دو تا [G]چشمون قشنگت[Am]',
        fn: processV62Line
      },
      {
        name: 'خط فقط آکورد — تغییر نکند',
        input: '[Am] [G] [Dm]',
        expected: '[Am] [G] [Dm]',
        fn: fixEndingChordToStart
      },
      {
        name: 'خط فقط آکورد — fixChordInsidePersianWord تغییر ندهد',
        input: '[Am] [G] [Dm]',
        expected: '[Am] [G] [Dm]',
        fn: fixChordInsidePersianWord
      },
      {
        name: 'normalizeSpaces — فاصله‌های اضافه حذف شود',
        input: '  سلام    دنیا  ',
        expected: 'سلام دنیا',
        fn: normalizeSpaces
      },
      {
        name: 'آکورد در ابتدای خط — تغییر نکند',
        input: '[Am]غم میون دو تا چشمون قشنگت',
        expected: '[Am]غم میون دو تا چشمون قشنگت',
        fn: fixEndingChordToStart
      },
      {
        name: 'آکورد وسط کلمه با حروف فارسی قبل و بعد',
        input: 'چش[G]مون',
        expected: '[G]چشمون',
        fn: fixChordInsidePersianWord
      },
      {
        name: 'آکورد بعد از حرف فارسی و قبل از فاصله — تغییر نکند',
        input: 'سلام[Am] دنیا',
        expected: 'سلام[Am] دنیا',
        fn: fixChordInsidePersianWord
      },
      {
        name: 'آکورد بعد از فاصله و قبل از حرف فارسی — تغییر نکند',
        input: 'سلام [Am]دنیا',
        expected: 'سلام [Am]دنیا',
        fn: fixChordInsidePersianWord
      },
      {
        name: 'V7: چند آکورد پشت سر هم در انتهای خط حفظ شوند',
        input: 'سلام دنیا[Am][G][Dm]',
        expected: 'سلام دنیا[Am][G][Dm]',
        fn: processV62Line
      },
      {
        name: 'V7: چند آکورد پشت سر هم در ابتدای خط حفظ شوند',
        input: '[Am][G][Dm]سلام دنیا',
        expected: '[Am][G][Dm]سلام دنیا',
        fn: processV62Line
      },
      {
        name: 'V7.1: تک‌آکورد انتهای خط به ابتدای خط منتقل شود',
        input: 'غم میون دو تا چشمون قشنگت[Am]',
        expected: '[Am]غم میون دو تا چشمون قشنگت',
        fn: fixSingleChordPosition
      },
      {
        name: 'V7.1: تک‌آکورد ابتدای خط به انتهای خط منتقل شود',
        input: '[Am]غم میون دو تا چشمون قشنگت',
        expected: 'غم میون دو تا چشمون قشنگت[Am]',
        fn: fixSingleChordPosition
      },
      {
        name: 'V7.1: تک‌آکورد وسط خط — تغییر نکند',
        input: 'غم میون [Am]دو تا چشمون',
        expected: 'غم میون [Am]دو تا چشمون',
        fn: fixSingleChordPosition
      },
      {
        name: 'V7.1: چند آکورد — تغییر نکند',
        input: 'غم میون [Am]دو تا [G]چشمون',
        expected: 'غم میون [Am]دو تا [G]چشمون',
        fn: fixSingleChordPosition
      },
      {
        name: 'V7.1: خط فقط آکورد — تغییر نکند',
        input: '[Am]',
        expected: '[Am]',
        fn: fixSingleChordPosition
      },
      {
        name: 'V7.1: processV62Line — چند آکورد تغییر نکند (نمونه ترکیبی)',
        input: 'غم میون دو تا چش[G]مون قشنگت[Am]',
        expected: 'غم میون دو تا [G]چشمون قشنگت[Am]',
        fn: processV62Line
      },
      {
        name: 'V7.1: processV62Line — تک‌آکورد ابتدای خط به انتها منتقل شود',
        input: '[Am]غم میون دو تا چشمون قشنگت',
        expected: 'غم میون دو تا چشمون قشنگت[Am]',
        fn: processV62Line
      },
      {
        name: 'V7.1: processV62Line — چند آکورد تغییر نکند',
        input: 'غم میون [Am]دو تا [G]چشمون قشنگت[Dm]',
        expected: 'غم میون [Am]دو تا [G]چشمون قشنگت[Dm]',
        fn: processV62Line
      }
    ];

    let passed = 0;
    let failed = 0;

    console.log('========================================');
    console.log('🧪 تست‌های Post Processor V6.2');
    console.log('========================================');

    for (const test of tests) {
      const actual = test.fn(test.input);
      const ok = actual === test.expected;

      if (ok) {
        passed++;
        console.log('✅ ' + test.name);
      } else {
        failed++;
        console.log('❌ ' + test.name);
        console.log('   Input:    "' + test.input + '"');
        console.log('   Expected: "' + test.expected + '"');
        console.log('   Actual:   "' + actual + '"');
      }
    }

    console.log('========================================');
    console.log('نتیجه: ' + passed + ' موفق، ' + failed + ' ناموفق');
    console.log('========================================');

    return failed === 0;
  }

  // ===============================
  // تست مرورگر — استخراج از #main-chord
  // ===============================

  function debugFromMainChord() {
    const extractor = global.AkordyarLaminorExtractor;

    if (!extractor) {
      console.error('AkordyarLaminorExtractor پیدا نشد.');
      return null;
    }

    const root = document.querySelector('#main-chord');

    if (!root) {
      console.error('#main-chord پیدا نشد. مطمئن شو داخل صفحه آهنگ لامینور هستی.');
      return null;
    }

    const result = extractor.extractLaminorAkordyarLines(root);

    console.group('🎵 Akordyar Laminor Extractor V6.2 — Debug');
    console.log('final (برای debug):', result.final);
    console.log('rawLines (قبل از فیکس):', result.rawLines);
    console.log('lines (خروجی نهایی):', result.lines);
    console.log('برای کپی:', 'copy(JSON.stringify(result.lines, null, 2))');
    console.groupEnd();

    return result;
  }

  // ===============================
  // اجرا در Node.js
  // ===============================

  if (typeof module !== 'undefined' && module.exports) {
    const extractor = require('./extractLaminorAkordyarLines.js');
    global.AkordyarLaminorExtractor = extractor;

    const allPassed = runPostProcessorTests();

    if (!allPassed) {
      process.exit(1);
    }
  }

  // ===============================
  // Exports برای مرورگر
  // ===============================

  if (typeof window !== 'undefined') {
    window.AkordyarLaminorExtractorDebug = {
      runPostProcessorTests: runPostProcessorTests,
      debugFromMainChord: debugFromMainChord
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);