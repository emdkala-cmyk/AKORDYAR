const assert = require('node:assert/strict');
const ArrangerRuntimeService = require(
  '../editor/EditorArrangerRuntimeService.js'
);

let hotSwapOptions = null;
let songLoadOptions = null;
const hotSwapService = {
  create: options => {
    hotSwapOptions = options;
    return { hotSwapToNextSong: (...args) => ['hot', ...args] };
  }
};
const songLoadService = {
  create: options => {
    songLoadOptions = options;
    return { load: (...args) => ['load', ...args] };
  }
};

const state = {
  getHotSwapPerformanceState: () => ({ nextState: { idx: 1 } }),
  updateHotSwapPerformanceState: () => {},
  getSongLoadPerformanceState: () => ({ index: 1 }),
  updateSongLoadPerformanceState: () => {},
  getArrangement: () => ({ items: ['song-1'] }),
  getAllSongs: () => [{ id: 'song-1' }],
  getItemSetting: () => ({ transpose: 0 }),
  getDAW: () => ({ isPlaying: false }),
  getPlaybackPolicy: () => ({}),
  getProjectEnd: () => 10
};
const actions = {
  applyPreparedState: () => ({}),
  loadSong: async () => ({}),
  pauseTransport: () => {},
  stopAllVoices: () => {},
  setSelectionEnd: () => {},
  resetRecording: () => {},
  seekTransport: () => {},
  ensureAudioCtx: () => {},
  startTransport: () => {},
  prepareNextSong: () => Promise.resolve()
};
const ui = {
  resetHistory: () => {},
  syncToolbar: () => {},
  renderEditor: () => {},
  renderAll: () => {},
  saveState: () => {},
  initHighlightEffect: () => {},
  syncUIAfterSongChange: () => {},
  renderPerfUI: () => {},
  toast: () => {},
  translate: key => key,
  getElement: () => null,
  mirrorTimeline: () => {}
};

const runtime = ArrangerRuntimeService.create({
  hotSwapService,
  songLoadService,
  state,
  actions,
  ui,
  scheduling: { schedule: () => {} },
  logger: { log: () => {}, error: () => {} }
});

assert.equal(hotSwapOptions.getPerformanceState, state.getHotSwapPerformanceState);
assert.equal(
  hotSwapOptions.updatePerformanceState,
  state.updateHotSwapPerformanceState
);
assert.equal(songLoadOptions.getPerformanceState, state.getSongLoadPerformanceState);
assert.equal(
  songLoadOptions.updatePerformanceState,
  state.updateSongLoadPerformanceState
);
assert.equal(hotSwapOptions.getArrangement, state.getArrangement);
assert.equal(songLoadOptions.getArrangement, state.getArrangement);
assert.equal(hotSwapOptions.renderAll, ui.renderAll);
assert.equal(songLoadOptions.renderAll, ui.renderAll);
assert.deepEqual(runtime.hotSwapToNextSong('x'), ['hot', 'x']);
assert.deepEqual(runtime.loadArrSong(2), ['load', 2]);

assert.equal(
  ArrangerRuntimeService.create({
    hotSwapService: {},
    songLoadService: {}
  }).hotSwapToNextSong(),
  undefined
);

console.log('EditorArrangerRuntimeService tests passed');
