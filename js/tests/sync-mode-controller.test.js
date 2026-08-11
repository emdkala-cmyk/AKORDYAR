/**
 * تست‌های Commit 2a — SyncModeController
 *
 * اجرا: node js/tests/sync-mode-controller.test.js
 */
const assert = require('assert');

const SyncModeController = require('../editor/SyncModeController.js');

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

function createController(overrides = {}) {
  const state = {
    active: false,
    cursor: 0,
    history: [],
    redoHistory: [],
    watch: null,
    tapKeyHandler: null,
    lastActiveLi: -999
  };

  const DAW = { playhead: 0, isPlaying: false };
  const edCur = { lyrics: '', syncTimes: [] };

  const calls = {
    toast: [],
    edSaveSong: 0,
    pauseTransport: 0,
    startTransport: 0
  };

  const controller = new SyncModeController({
    state,
    DAW,
    getEdCur: () => edCur,
    $: () => null,
    t: (key) => key,
    toast: (msg) => calls.toast.push(msg),
    edSaveSong: () => { calls.edSaveSong++; },
    startTransport: () => { calls.startTransport++; },
    pauseTransport: () => { calls.pauseTransport++; },
    seekTransport: () => {},
    getProjectEnd: () => 100,
    getLyricPopup: () => null,
    getLyricOnlyPopup: () => null,
    getChordLinePopup: () => null,
    logger: { warn() {}, error() {} },
    ...overrides
  });

  return { controller, state, DAW, edCur, calls };
}

test('formatSyncTime: NaN و مقادیر معتبر', () => {
  const { controller } = createController();

  assert.strictEqual(controller.formatSyncTime(NaN), '--:--.-');
  assert.strictEqual(controller.formatSyncTime(0), '00:00.0');
  assert.strictEqual(controller.formatSyncTime(61.5), '01:01.5');
  assert.strictEqual(controller.formatSyncTime(125), '02:05.0');
});

test('syncTap: غیرفعال بودن sync هیچ کاری نمی‌کند', () => {
  const { controller, edCur, calls } = createController();

  controller.syncTap();

  assert.deepStrictEqual(edCur.syncTimes, []);
  assert.strictEqual(calls.edSaveSong, 0);
});

test('syncTap: زمان ثبت، خطوط خالی رد می‌شوند و history پر می‌شود', () => {
  const { controller, state, DAW, edCur, calls } = createController();

  state.active = true;
  state.cursor = 0;
  DAW.playhead = 4.25;
  edCur.lyrics = 'خط اول\n\nخط سوم';
  edCur.syncTimes = [1.5];

  controller.syncTap();

  assert.strictEqual(edCur.syncTimes[0], 4.25);
  assert.strictEqual(edCur.syncTimes[1], 4.25); // خط خالی با همان زمان
  assert.strictEqual(state.cursor, 2);
  assert.strictEqual(state.history.length, 1);
  assert.deepStrictEqual(state.redoHistory, []);
  assert.strictEqual(calls.edSaveSong, 1);
});

test('syncTap: مسیر پایان — toast، توقف پخش و ذخیره (اصلاح shadowing متغیر t)', () => {
  const { controller, state, DAW, edCur, calls } = createController();

  state.active = true;
  state.cursor = 1;
  DAW.playhead = 7;
  DAW.isPlaying = true;
  edCur.lyrics = 'a\nb';
  edCur.syncTimes = [1];

  controller.syncTap();

  assert.strictEqual(state.cursor, 2);
  assert.deepStrictEqual(calls.toast, ['syncFinished']);
  assert.strictEqual(calls.pauseTransport, 1);
  assert.strictEqual(calls.edSaveSong, 1);
});

test('updateSyncHighlight: lastActiveLi از playhead و syncTimes محاسبه می‌شود', () => {
  const { controller, state, DAW, edCur } = createController();

  DAW.playhead = 3;
  edCur.syncTimes = [0, 2, 5];

  controller.updateSyncHighlight();
  assert.strictEqual(state.lastActiveLi, 1);

  DAW.playhead = 6;
  controller.updateSyncHighlight();
  assert.strictEqual(state.lastActiveLi, 2);

  DAW.playhead = 0;
  DAW.isPlaying = false;
  edCur.syncTimes = [];
  controller.updateSyncHighlight();
  assert.strictEqual(state.lastActiveLi, -1);
});

test('renderSyncLyrics: نبود پنل syncLyrics بدون خطا no-op است', () => {
  const { controller } = createController();
  controller.renderSyncLyrics(); // $ همیشه null برمی‌گرداند
});

test('state accessor: نوشتن کنترلر روی state مشترک دیده می‌شود', () => {
  const { controller, state } = createController();

  state.active = true;
  assert.strictEqual(controller.state.active, true);

  controller.state.cursor = 7;
  assert.strictEqual(state.cursor, 7);
});

process.on('beforeExit', () => {
  if (!process.exitCode) {
    console.log(`\n${testCount} passed, 0 failed`);
  }
});
