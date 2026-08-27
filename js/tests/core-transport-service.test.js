const assert = require('node:assert/strict');
const CoreTransportService = require('../app/CoreTransportService.js');

function element() {
  const classes = new Set();
  return {
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    },
    style: {},
    children: [],
    setAttribute(name, value) {
      this[name] = value;
    }
  };
}

const elements = {
  returnToStartBtn: element(),
  'play-btn': element(),
  perfPlayBtn: element(),
  editor: element(),
  edTempo: { value: '120' },
  edTimeSig: { value: '4/4' }
};
elements.editor.children = [
  { classList: { remove: (...names) => names.forEach(() => {}) } }
];

const daw = {
  playhead: 2,
  isPlaying: false,
  isScrubbing: false,
  isRecording: false,
  rafId: null,
  loopEnabled: false,
  loopA: 0,
  loopB: 0,
  clips: [{ start: 0, duration: 6 }],
  sections: [{ start: 6, duration: 2 }],
  playOriginAudio: 123
};

const transportState = {
  returnToStartOnPause: false,
  metroActive: false,
  metroTimer: null,
  countInBars: 0
};

let rafCallback = null;
let arranger = {
  active: false,
  data: null,
  index: -1,
  selectionEnd: 0,
  nextState: null,
  preparePending: false,
  prepStartedForIndex: -1,
  waitPollActive: false,
  isCrossfading: false,
  perfModeActive: false,
  perfPauseMode: false,
  playbackPolicy: null
};
const calls = [];
const documentRef = {
  body: { tagName: 'BODY' },
  documentElement: { tagName: 'HTML' },
  activeElement: null,
  getSelection: () => null
};

const runtime = CoreTransportService.create({
  getDAW: () => daw,
  getElement: id => elements[id],
  documentRef,
  getTransportState: () => transportState,
  ensureAudioCtx: () => calls.push('audio'),
  cancelCountIn: () => calls.push('cancel-count-in'),
  isCountInRunning: () => false,
  getProjectEnd: () => 20,
  snapTime: value => Math.round(value),
  playheadMath: {
    clamp: (value, end) => Math.max(0, Math.min(value, end)),
    applyLoop: () => ({ playhead: 5 })
  },
  setTransportOrigin: (...args) => calls.push(['origin', ...args]),
  getTransportPlayhead: () => daw._clockPlayhead ?? 3,
  updatePlayheadUI: () => calls.push('ui'),
  scheduleAllFromPlayhead: options => calls.push(['schedule', options]),
  stopAllVoices: () => calls.push('stop-voices'),
  startMetronome: () => calls.push('metro-start'),
  stopMetronome: () => calls.push('metro-stop'),
  getMetronomeSchedulerBridge: () => null,
  checkMetronomeTick: value => calls.push(['metro-tick', value]),
  getCountInScheduler: () => null,
  getTimeSignatureGridConfig: () => ({ measureDuration: 2 }),
  getRecordingRuntime: () => ({ endRec: () => calls.push('end-rec') }),
  getAudioContextService: () => ({ stopAll: () => calls.push('audio-stop') }),
  getArrangerState: () => arranger,
  setArrangerPreparePending: value => {
    arranger.preparePending = value;
  },
  setArrangerPrepStartedForIndex: value => {
    arranger.prepStartedForIndex = value;
  },
  setArrangerWaitPollActive: value => {
    arranger.waitPollActive = value;
  },
  prepareNextArrSong: () => {
    calls.push('prepare');
    return Promise.resolve();
  },
  loadArrSong: index => calls.push(['load', index]),
  hotSwapToNextSong: () => calls.push('hot-swap'),
  arrCrossfadeSwap: () => calls.push('crossfade'),
  renderPerfUI: () => calls.push('perf-ui'),
  publishPlaybackSync: () => calls.push('sync'),
  updateSyncHighlight: () => calls.push('highlight'),
  isSyncActive: () => false,
  isLyricPopupOpen: () => false,
  requestAnimationFrameRef: callback => {
    rafCallback = callback;
    return 1;
  },
  cancelAnimationFrameRef: () => calls.push('cancel-raf'),
  performanceRef: { now: () => 100 },
  toast: message => calls.push(['toast', message]),
  logger: { log: () => {}, warn: () => {}, error: () => {} }
});

const editorTextTarget = {
  tagName: 'SPAN',
  closest: selector =>
    selector === '[contenteditable]'
      ? { tagName: 'DIV', contentEditable: 'true' }
      : null
};
assert.equal(
  runtime.togglePlay({
    type: 'keydown',
    key: ' ',
    target: editorTextTarget
  }),
  false
);
assert.equal(daw.isPlaying, false);

documentRef.activeElement = {
  tagName: 'DIV',
  contentEditable: 'true'
};
assert.equal(
  runtime.togglePlay({
    type: 'keydown',
    code: 'Space',
    target: documentRef.body
  }),
  false
);
assert.equal(daw.isPlaying, false);
documentRef.activeElement = null;

runtime.seekTransport(30);
assert.equal(daw.playhead, 20);
assert.ok(calls.includes('stop-voices'));

runtime.toggleReturnToStart();
assert.equal(transportState.returnToStartOnPause, true);
assert.equal(elements.returnToStartBtn['aria-pressed'], 'true');
assert.equal(elements.returnToStartBtn.classList.contains('active'), true);

daw.playhead = 2;
daw.isPlaying = false;
runtime.startTransport();
assert.equal(daw.isPlaying, true);
assert.equal(typeof rafCallback, 'function');
assert.ok(calls.includes('audio'));

daw.loopEnabled = true;
daw.loopA = 5;
daw.loopB = 10;
daw._clockPlayhead = 12;
rafCallback(100);
assert.equal(daw.playhead, 5);
assert.ok(
  calls.some(
    call => Array.isArray(call) && call[0] === 'schedule' && call[1]?.loopOnly
  )
);

daw.isRecording = true;
daw._clockPlayhead = 3;
runtime.pauseTransport();
assert.equal(daw.isPlaying, false);
assert.equal(daw.playhead, 3);
assert.equal(daw.playOriginAudio, null);
assert.ok(calls.includes('end-rec'));
assert.ok(calls.includes('audio-stop'));

arranger = {
  active: true,
  data: { crossfade: 0 },
  index: 0,
  selectionEnd: 8,
  nextState: null,
  preparePending: false,
  prepStartedForIndex: -1,
  waitPollActive: false,
  isCrossfading: false,
  perfModeActive: false,
  perfPauseMode: false,
  playbackPolicy: null
};
assert.equal(runtime.getArrangerEnd(), 8);

daw.isRecording = false;
daw.loopEnabled = false;
daw.isPlaying = false;
daw.playhead = 2;
runtime.startTransport();
rafCallback(200);
assert.ok(calls.includes('prepare'));

arranger.nextState = { ready: true };
daw.isPlaying = true;
daw.playhead = 8;
daw._clockPlayhead = 8;
runtime.startTransport();
rafCallback(300);
assert.ok(calls.includes('hot-swap'));

runtime.stopTransport();
assert.equal(daw.playhead, 0);

console.log('CoreTransportService tests passed');
