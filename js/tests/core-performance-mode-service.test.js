const assert = require('node:assert/strict');
const CorePerformanceModeService = require(
  '../app/CorePerformanceModeService.js'
);

function element() {
  const classes = new Set();
  return {
    style: {},
    textContent: '',
    value: '120',
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    }
  };
}

const elements = {
  arrPerfOverlay: element(),
  perfArrangerName: element(),
  perfPauseModeBtn: element(),
  perfPlayBtn: element(),
  perfTime: element(),
  edTempo: element()
};

const editingArr = {
  name: 'اجرای تست',
  pauseBetween: true,
  items: ['song-1', 'song-2'],
  settings: {}
};

const state = {
  arrPerformData: null,
  arrPerformIdx: -1,
  arrPerformActive: false,
  perfModeActive: false,
  perfStageMode: false,
  perfPauseMode: false,
  perfLiveTranspose: 0,
  arrNextState: null,
  bgPreloadActive: false,
  arrWaitPollActive: false,
  arrPreparePending: false,
  arrHasLoggedNoNextSong: true,
  arrPrepStartedForIndex: 4
};

const daw = {
  playhead: 0,
  isPlaying: false,
  tracks: [{ type: 'audio', transpose: 0 }, { type: 'chord' }]
};

const calls = [];
let timerCallback = null;
let timerToken = 0;
let clock = 0;
let scheduledPopup = null;
let firstLoadOptions = null;

const runtime = CorePerformanceModeService.create({
  getElement: id => elements[id],
  getActiveElement: () => ({ blur: () => calls.push('blur') }),
  isTextEditingEvent: event =>
    event?.target?.contentEditable === 'true',
  getEditingArr: () => editingArr,
  getPerformanceState: () => ({ ...state }),
  updatePerformanceState: patch => Object.assign(state, patch),
  getDAW: () => daw,
  getArrangerMarkers: () => ({ enabled: true, start: 1, end: 8 }),
  ensureArrItem: (arr, index) => {
    arr.settings[index] ||= { transpose: 0 };
    return arr.settings[index];
  },
  loadArrSong: (index, options) => {
    calls.push(['load', index]);
    firstLoadOptions = options;
    return Promise.resolve();
  },
  renderPerfUI: () => calls.push('render'),
  renderPerformancePanel: () => calls.push('render-panel'),
  startBackgroundPreload: () => calls.push('preload'),
  closeArrangerModal: () => calls.push('close-modal'),
  openLyricOnlyPopup: () => calls.push('lyric-only'),
  openLyricPopup: () => calls.push('lyric-popup'),
  pauseTransport: () => {
    calls.push('pause');
    daw.isPlaying = false;
  },
  startTransport: () => {
    calls.push('start');
    daw.isPlaying = true;
  },
  seekTransport: (...args) => calls.push(['seek', ...args]),
  ensureAudioCtx: () => calls.push('audio'),
  scheduleAllFromPlayhead: () => calls.push('schedule'),
  saveArrangers: () => calls.push('save-arrangers'),
  getSongState: () => ({
    setTempo: value => {
      calls.push(['tempo', value]);
      return true;
    }
  }),
  saveSong: () => calls.push('save-song'),
  handleTimingChange: () => calls.push('timing'),
  startPointerDrag: () => calls.push('drag'),
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  translate: key => `translated:${key}`,
  toast: message => calls.push(['toast', message]),
  schedule: callback => {
    scheduledPopup = callback;
    return 1;
  },
  setIntervalRef: callback => {
    timerCallback = callback;
    timerToken += 1;
    return timerToken;
  },
  clearIntervalRef: token => calls.push(['clear-timer', token]),
  now: () => clock,
  logger: { log() {}, warn() {}, error() {} }
});

(async () => {
  const opened = await runtime.openPerfMode();
  assert.equal(opened, true);
  assert.equal(state.arrPerformData, editingArr);
  assert.equal(state.arrPerformIdx, 0);
  assert.equal(state.arrPerformActive, true);
  assert.equal(state.perfModeActive, true);
  assert.equal(state.perfPauseMode, true);
  assert.equal(elements.arrPerfOverlay.style.display, 'flex');
  assert.equal(elements.perfArrangerName.textContent, '🎤 اجرای تست');
  assert.ok(calls.includes('preload'));
  assert.equal(typeof scheduledPopup, 'function');
  scheduledPopup();
  assert.ok(calls.includes('lyric-popup'));

  clock = 61000;
  timerCallback();
  assert.equal(elements.perfTime.textContent, '01:01');

  runtime.perfTogglePauseMode();
  assert.equal(state.perfPauseMode, false);
  assert.equal(elements.perfPauseModeBtn.classList.contains('arr-stl-active'), false);

  const callsBeforeBlockedSpace = calls.length;
  assert.equal(
    runtime.perfTogglePlay({
      type: 'keydown',
      key: ' ',
      target: { contentEditable: 'true' }
    }),
    false
  );
  assert.equal(daw.isPlaying, false);
  assert.equal(calls.length, callsBeforeBlockedSpace);

  daw.playhead = 0;
  runtime.perfTogglePlay();
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'seek'));
  assert.ok(calls.includes('start'));
  assert.equal(elements.perfPlayBtn.textContent, '⏸');

  runtime.perfTogglePlay();
  assert.ok(calls.includes('pause'));
  assert.equal(elements.perfPlayBtn.textContent, '▶');

  runtime.perfRestartSong();
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'seek'));
  assert.ok(calls.includes('start'));

  runtime.perfTranspose(2);
  assert.equal(editingArr.settings[0].transpose, 2);
  assert.equal(daw.tracks[0].transpose, 2);
  assert.ok(calls.includes('schedule'));
  assert.ok(calls.includes('save-arrangers'));

  runtime.perfTempoChange(10);
  assert.equal(elements.edTempo.value, 130);
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'tempo'));
  assert.ok(calls.includes('save-song'));
  assert.ok(calls.includes('timing'));

  runtime.perfPrevSong();
  runtime.perfNextSong();
  runtime.perfJumpToSong(1);
  assert.deepEqual(
    calls.filter(call => Array.isArray(call) && call[0] === 'load').map(call => call[1]),
    [0, 1, 1]
  );

  runtime.perfStop();
  assert.equal(state.arrPerformActive, false);
  assert.equal(state.perfModeActive, false);
  assert.equal(elements.arrPerfOverlay.style.display, 'none');
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'clear-timer'));

  console.log('CorePerformanceModeService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
