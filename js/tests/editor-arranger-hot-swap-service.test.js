const assert = require('node:assert/strict');
const HotSwapService = require(
  '../editor/EditorArrangerHotSwapService.js'
);

const calls = [];
const scheduled = [];
const performanceState = {
  active: true,
  pauseMode: true,
  index: 0,
  nextState: {
    idx: 1,
    song: { title: 'Next song' },
    clips: [{ id: 'clip-2' }],
    sections: [{ id: 'section-2' }],
    tracks: [{ id: 'track-2' }],
    playbackStart: 4,
    playbackEnd: 18,
    selectionEnd: 18,
    loopState: { loopEnabled: true, loopA: 4, loopB: 18 },
    arrangerMarkers: { enabled: true, start: 4, end: 18 }
  },
  hasLoggedNoNextSong: true,
  prepStartedForIndex: 0
};
const daw = { id: 'daw' };
const playButton = { textContent: '⏸' };
let selectionEnd = null;
let preparedPayload = null;
let mirrored = 0;
let recordingReset = 0;

const service = HotSwapService.create({
  getPerformanceState: () => performanceState,
  updatePerformanceState: patch => Object.assign(performanceState, patch),
  getArrangement: () => ({ items: ['current', 'next', 'later'] }),
  stopAllVoices: () => calls.push('stop-voices'),
  applyPreparedState: payload => {
    preparedPayload = payload;
    calls.push('apply-state');
    return {
      audio: {
        loaded: 2,
        total: 3,
        missing: 1,
        missingNames: ['missing.wav']
      }
    };
  },
  getDAW: () => daw,
  getPlaybackPolicy: () => ({
    applyToDAW: target => {
      assert.equal(target, daw);
      calls.push('apply-boundary');
    }
  }),
  setSelectionEnd: value => {
    selectionEnd = value;
  },
  resetRecording: () => {
    recordingReset += 1;
  },
  seekTransport: (...args) => calls.push(['seek', ...args]),
  resetHistory: () => calls.push('reset-history'),
  syncToolbar: () => calls.push('sync-toolbar'),
  renderEditor: value => calls.push(`render-editor:${value}`),
  renderAll: () => calls.push('render-all'),
  saveState: () => calls.push('save-state'),
  initHighlightEffect: () => calls.push('highlight'),
  renderPerfUI: () => calls.push('render-perf'),
  toast: message => calls.push(`toast:${message}`),
  translate: key => key,
  pauseTransport: () => calls.push('pause'),
  getElement: id => id === 'perfPlayBtn' ? playButton : null,
  prepareNextSong: () => calls.push('prepare-next'),
  syncUIAfterSongChange: () => calls.push('sync-ui'),
  mirrorTimeline: () => {
    mirrored += 1;
    calls.push('mirror');
  },
  schedule: (callback, delay) => {
    scheduled.push({ callback, delay });
  },
  logger: {
    log: (...args) => calls.push(['log', ...args]),
    error: (...args) => calls.push(['error', ...args])
  }
});

assert.equal(service.hotSwapToNextSong(), true);
assert.equal(performanceState.nextState, null);
assert.equal(performanceState.index, 1);
assert.equal(performanceState.hasLoggedNoNextSong, false);
assert.equal(performanceState.prepStartedForIndex, -1);
assert.deepEqual(preparedPayload, {
  song: { title: 'Next song' },
  clips: [{ id: 'clip-2' }],
  sections: [{ id: 'section-2' }],
  tracks: [{ id: 'track-2' }],
  loopState: { loopEnabled: true, loopA: 4, loopB: 18 },
  arrangerMarkers: { enabled: true, start: 4, end: 18 }
});
assert.equal(selectionEnd, 18);
assert.equal(recordingReset, 1);
assert.equal(playButton.textContent, '▶');
assert.deepEqual(
  calls.find(call => Array.isArray(call) && call[0] === 'seek'),
  ['seek', 4, true, true]
);
assert.ok(calls.includes('stop-voices'));
assert.ok(calls.includes('apply-boundary'));
assert.ok(calls.includes('reset-history'));
assert.ok(calls.includes('sync-toolbar'));
assert.ok(calls.includes('render-editor:true'));
assert.ok(calls.includes('render-all'));
assert.ok(calls.includes('save-state'));
assert.ok(calls.includes('highlight'));
assert.ok(calls.includes('render-perf'));
assert.ok(calls.includes('pause'));
assert.ok(calls.includes('prepare-next'));
assert.ok(calls.includes('sync-ui'));
assert.equal(scheduled.length, 1);
assert.equal(scheduled[0].delay, 1000);
scheduled[0].callback();
assert.equal(mirrored, 1);

assert.equal(service.hotSwapToNextSong(), false);

const unavailableState = {
  active: false,
  pauseMode: false,
  nextState: {
    idx: 0,
    song: { title: 'Unavailable transition' }
  }
};
const unavailable = HotSwapService.create({
  getPerformanceState: () => unavailableState,
  updatePerformanceState: patch => Object.assign(unavailableState, patch),
  applyPreparedState: () => null
});
assert.equal(unavailable.hotSwapToNextSong(), false);
assert.equal(unavailableState.nextState, null);

console.log('EditorArrangerHotSwapService tests passed');
