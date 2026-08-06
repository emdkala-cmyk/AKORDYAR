/**
 * تست تشخیص گام اصلی (original key) و ریتم/امضای زمان (signature) از صفحهٔ لامینور
 *
 * ⚠️ این فایل فقط در محیط Node.js اجرا می‌شود (با دستور node):
 *    node js/importers/laminor/test-extractLaminorAkordyarLines.js
 *
 * چون این فایل توسط Akordyar.html (مرورگر/الکترون) هم load می‌شود،
 * تمام بدنهٔ تست داخل یک گارد Node-only قرار گرفته تا هیچ
 * require/global‌ای در renderer اجرا نشود و با app.js تداخل نکند.
 */

'use strict';

// ─── گارد: فقط اگر در Node.js هستیم و مستقیم این فایل اجرا شده، تست را اجرا کن ───
const isNodeMain =
  typeof module !== 'undefined' &&
  typeof module.parent !== 'undefined' &&
  !module.parent;

if (!isNodeMain) {
  // وقتی از طریق <script> در مرورگر/الکترون load می‌شود، کاری نکنید.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
  }
} else {
  const { JSDOM } = require('jsdom');
  const fs = require('fs');
  const path = require('path');

  function loadExtractor(html) {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const win = dom.window;
    win.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    // document.fonts و document.images در jsdom فقط getter هستند؛
    // waitForStableLayout با بررسی وجودشان به‌صورت ایمن کار می‌کند.
    const code = fs.readFileSync(path.join(__dirname, '..', '..', 'laminor-extractor.js'), 'utf8');
    win.eval(code);
    return win;
  }

  let passed = 0;
  let failed = 0;
  function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.error('  ✗ ' + msg); }
  }

  // گام اصلی از #main-scale
  {
    const win = loadExtractor('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div class="text-center"><span id="main-scale" class="badge">گام اصلی: Dm</span></div></body></html>');
    const key = win.extractLaminorKey(win.document);
    console.log('[گام اصلی از #main-scale]');
    assert(key === 'Dm', `انتظار 'Dm' بود ولی '${key}' دریافت شد`);
  }

  // گام ماژور
  {
    const win = loadExtractor('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><span id="main-scale">گام اصلی: G</span></body></html>');
    const key = win.extractLaminorKey(win.document);
    console.log('[گام ماژور]');
    assert(key === 'G', `انتظار 'G' بود ولی '${key}' دریافت شد`);
  }

  // گام دیز
  {
    const win = loadExtractor('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><span id="main-scale">گام اصلی: C#m</span></body></html>');
    const key = win.extractLaminorKey(win.document);
    console.log('[گام دیز]');
    assert(key === 'C#m', `انتظار 'C#m' بود ولی '${key}' دریافت شد`);
  }

  // ریتم از لینک rhythms/4-4
  {
    const win = loadExtractor('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><a href="https://laminor.org/rhythms/4-4" class="color-light-blue text-bold font-16">4/4</a></body></html>');
    const rhythm = win.extractLaminorRhythm(win.document);
    console.log('[ریتم از لینک rhythms/4-4]');
    assert(rhythm === '4/4', `انتظار '4/4' بود ولی '${rhythm}' دریافت شد`);
  }

  // ریتم 12/8
  {
    const win = loadExtractor('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><a href="https://laminor.org/rhythms/12-8">12/8</a></body></html>');
    const rhythm = win.extractLaminorRhythm(win.document);
    console.log('[ریتم 12/8]');
    assert(rhythm === '12/8', `انتظار '12/8' بود ولی '${rhythm}' دریافت شد`);
  }

  // تست یکپارچه گام + ریتم
  {
    const win = loadExtractor('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div class="text-center"><span id="main-scale" class="badge">گام اصلی: Dm</span></div><a href="https://laminor.org/rhythms/4-4">4/4</a></body></html>');
    const key = win.extractLaminorKey(win.document);
    const rhythm = win.extractLaminorRhythm(win.document);
    console.log('[تست یکپارچه گام + ریتم]');
    assert(key === 'Dm', `گام: انتظار 'Dm' بود ولی '${key}' دریافت شد`);
    assert(rhythm === '4/4', `ریتم: انتظار '4/4' بود ولی '${rhythm}' دریافت شد`);
  }

  // نرمال‌سازی گام
  {
    const win = loadExtractor('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
    console.log('[نرمال‌سازی گام]');
    assert(win.normalizeLaminorKey('Dm') === 'Dm', "normalizeLaminorKey('Dm') === 'Dm'");
    assert(win.normalizeLaminorKey('D minor') === 'Dm', "normalizeLaminorKey('D minor') === 'Dm'");
    assert(win.normalizeLaminorKey('Dm (ری مینور)') === 'Dm', "normalizeLaminorKey('Dm (ری مینور)') === 'Dm'");
    assert(win.normalizeLaminorKey('گام اصلی: G') === 'G', "normalizeLaminorKey('گام اصلی: G') === 'G'");
    assert(win.normalizeLaminorKey('C#m') === 'C#m', "normalizeLaminorKey('C#m') === 'C#m'");
    assert(win.normalizeLaminorKey('Eb') === 'Eb', "normalizeLaminorKey('Eb') === 'Eb'");
    assert(win.normalizeLaminorKey('H') === 'B', "normalizeLaminorKey('H') === 'B' (نگاشت H -> B)");
    assert(win.normalizeLaminorKey('') === '', "normalizeLaminorKey('') === ''");
  }

  console.log('\n══════════════════════════════════');
  console.log(`نتیجه: ${passed} پاس‌شده، ${failed} ناموفق`);
  if (failed > 0) process.exitCode = 1;
}