/**
 * تست‌های Commit 2a + 2b — SyncModeController (sync UI + seq/CL)
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

// المان ساختگی برای تست‌هایی که متدهای controller به classList/style دسترسی دارند
function fakeEl() {
  return {
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: {},
    dataset: {},
    textContent: '',
    innerHTML: '',
    children: [],
    appendChild() {}
  };
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

  const seqState = {
    seqModeActive: false,
    seqPoints: [],
    chordingActive: false,
    seqCursor: 0,
    clMode: false,
    clTapActive: false,
    clMarkers: []
  };

  const DAW = {
    playhead: 0,
    isPlaying: false,
    tracks: [],
    clips: [],
    timelineDuration: 120,
    pxPerSecond: 70
  };

  const edCur = { lyrics: '', syncTimes: [], chords: [] };

  const calls = {
    toast: [],
    edSaveSong: 0,
    pauseTransport: 0,
    startTransport: 0,
    edRenderChords: 0,
    edCommit: 0,
    saveState: 0,
    renderAll: 0,
    ensureTimelineFits: [],
    openChordLinePopup: 0
  };

  let uidCounter = 0;

  const controller = new SyncModeController({
    state,
    seqState,
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
    edRenderChords: () => { calls.edRenderChords++; },
    edCommit: () => { calls.edCommit++; },
    saveState: () => { calls.saveState++; },
    renderAll: () => { calls.renderAll++; },
    uid: (p) => `${p}_${++uidCounter}`,
    roundMs: (v) => Math.round(v * 1000) / 1000,
    ensureTimelineFits: (v) => { calls.ensureTimelineFits.push(v); },
    timeToX: (v) => v * 70,
    formatTime: () => '00:00.000',
    openChordLinePopup: () => { calls.openChordLinePopup++; },
    logger: { warn() {}, error() {} },
    ...overrides
  });

  return { controller, state, seqState, DAW, edCur, calls };
}

/* ─── Commit 2a: sync UI ─── */

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

/* ─── Commit 2b: seq/CL ─── */

test('edToggleSeqMode: فعال‌سازی نقاط را ریست می‌کند و غیرفعال‌سازی commit می‌کند', () => {
  const { controller, seqState, edCur, calls } = createController({ $: () => fakeEl() });

  controller.edToggleSeqMode();
  assert.strictEqual(seqState.seqModeActive, true);
  assert.deepStrictEqual(edCur.seqPoints, []);
  assert.deepStrictEqual(calls.toast, ['selectPointsActive']);

  seqState.seqPoints = [{ lineIndex: 0, charIndex: 2, anchorType: 'OnCharacter' }];
  controller.edToggleSeqMode();
  assert.strictEqual(seqState.seqModeActive, false);
  assert.strictEqual(edCur.seqPoints.length, 1);
  assert.strictEqual(calls.edRenderChords, 1);
  assert.strictEqual(calls.edCommit, 1);
});

test('edStartSeqChording: بدون نقطه toast می‌دهد و با نقطه آکورد خالی می‌سازد', () => {
  const { controller, seqState, edCur, calls } = createController({ $: () => fakeEl() });

  controller.edStartSeqChording();
  assert.deepStrictEqual(calls.toast, ['selectPointsFirst']);
  assert.strictEqual(seqState.chordingActive, false);

  seqState.seqPoints = [
    { lineIndex: 0, charIndex: 0, anchorType: 'LineStart' },
    { lineIndex: 1, charIndex: 3, anchorType: 'OnCharacter' }
  ];
  controller.edStartSeqChording();

  assert.strictEqual(seqState.chordingActive, true);
  assert.strictEqual(seqState.seqModeActive, false);
  assert.strictEqual(edCur.chords.length, 2);
  assert.strictEqual(edCur.chords[0].name, '');
  assert.strictEqual(calls.edCommit, 1);
});

test('edSeqNavigate: cursor در محدوده باقی می‌ماند', () => {
  const { controller, seqState } = createController();

  seqState.chordingActive = true;
  seqState.seqPoints = [{}, {}, {}];
  seqState.seqCursor = 2;

  controller.edSeqNavigate(1);
  assert.strictEqual(seqState.seqCursor, 2); // clamp بالا

  controller.edSeqNavigate(-1);
  assert.strictEqual(seqState.seqCursor, 1);

  seqState.chordingActive = false;
  controller.edSeqNavigate(-1);
  assert.strictEqual(seqState.seqCursor, 1); // غیرفعال: بدون تغییر
});

test('edClTap: غیرفعال toast می‌دهد؛ فعال نقطه با زمان گردشده ثبت می‌کند', () => {
  const { controller, seqState, DAW, calls } = createController();

  controller.edClTap();
  assert.strictEqual(calls.toast.length, 1);
  assert.strictEqual(seqState.clMarkers.length, 0);

  seqState.clTapActive = true;
  DAW.playhead = 12.34567;
  controller.edClTap();

  assert.strictEqual(seqState.clMarkers.length, 1);
  assert.strictEqual(seqState.clMarkers[0].time, 12.346);
  assert.deepStrictEqual(calls.ensureTimelineFits, [18.346]);
});

test('edClApplyMarkers: عدم تطابق تعداد، فقط هشدار می‌دهد', () => {
  const { controller, seqState, edCur, DAW, calls } = createController();

  seqState.clMarkers = [{ time: 1 }, { time: 2 }];
  edCur.chords = [{ name: 'C' }];

  controller.edClApplyMarkers();

  assert.ok(calls.toast[0].includes('یکی نیست'));
  assert.strictEqual(DAW.clips.length, 0);
  assert.strictEqual(calls.saveState, 0);
});

test('edClApplyMarkers: مسیر موفق clip می‌سازد و state پاک می‌شود', () => {
  const { controller, seqState, edCur, DAW, calls } = createController();

  DAW.tracks.push({ id: 'tr_chord', type: 'chord' });
  seqState.clTapActive = true;
  seqState.clMarkers = [{ time: 1.5 }, { time: 4 }];
  edCur.chords = [{ name: 'C' }, { name: 'G' }, { name: ' ' }]; // سومی فیلتر می‌شود

  controller.edClApplyMarkers();

  assert.strictEqual(DAW.clips.length, 2);
  assert.strictEqual(DAW.clips[0].name, 'C');
  assert.strictEqual(DAW.clips[0].trackId, 'tr_chord');
  assert.strictEqual(DAW.clips[0].start, 1.5);
  assert.strictEqual(DAW.clips[1].name, 'G');
  assert.strictEqual(seqState.clMarkers.length, 0);
  assert.strictEqual(seqState.clTapActive, false);
  assert.strictEqual(calls.saveState, 1);
  assert.strictEqual(calls.renderAll, 1);
  assert.strictEqual(calls.edSaveSong, 1);
});

test('edSetSeqMode: رفتن به حالت chord، حالت انتخاب نقطه را می‌بندد و پاپ‌اپ را باز می‌کند', () => {
  const { controller, seqState, calls } = createController({ $: () => fakeEl() });

  seqState.seqModeActive = true;
  controller.edSetSeqMode('chord');

  assert.strictEqual(seqState.clMode, true);
  assert.strictEqual(seqState.seqModeActive, false); // از طریق edToggleSeqMode داخلی
  assert.strictEqual(calls.openChordLinePopup, 1);
});

test('edClUndoMarker و edClClearMarkers', () => {
  const { controller, seqState, calls } = createController();

  controller.edClUndoMarker();
  assert.deepStrictEqual(calls.toast, ['نقطه‌ای برای حذف نیست']);

  seqState.clMarkers = [{ time: 1 }, { time: 2 }];
  controller.edClUndoMarker();
  assert.strictEqual(seqState.clMarkers.length, 1);

  controller.edClClearMarkers();
  assert.strictEqual(seqState.clMarkers.length, 0);
  assert.ok(calls.toast.includes('همه نقاط پاک شد'));
});

process.on('beforeExit', () => {
  if (!process.exitCode) {
    console.log(`\n${testCount} passed, 0 failed`);
  }
});
