const assert = require('node:assert/strict');
const EditorArrangerControllerService = require(
  '../editor/EditorArrangerControllerService.js'
);

let runtimeOptions = null;
const runtime = {
  hotSwapToNextSong() {},
  loadArrSong() {}
};
const runtimeService = {
  create(options) {
    runtimeOptions = options;
    return runtime;
  }
};

const state = {
  active: true,
  index: 2,
  modeActive: true,
  pauseMode: false,
  nextState: { idx: 3 },
  data: { items: ['song-1', 'song-2'] },
  preparePending: true,
  waitPollActive: true,
  hasLoggedNoNextSong: true,
  prepStartedForIndex: 2
};
const updateState = patch => Object.assign(state, patch);
const arrangement = {
  getArrangement: () => state.data,
  getAllSongs: () => [],
  getItemSetting: () => ({}),
  getDAW: () => ({}),
  getPlaybackPolicy: () => null,
  getProjectEnd: () => 10
};
const actions = { pauseTransport() {} };
const ui = { renderAll() {} };

const controller = EditorArrangerControllerService.create({
  runtimeService,
  performanceState: {
    get: () => state,
    update: updateState
  },
  arrangement,
  actions,
  ui,
  scheduling: { schedule() {} },
  logger: { log() {} }
});

assert.equal(controller.runtime, runtime);
assert.equal(
  runtimeOptions.state.getHotSwapPerformanceState().nextState,
  state.nextState
);
assert.deepEqual(
  runtimeOptions.state.getSongLoadPerformanceState(),
  {
    active: true,
    index: 2,
    pauseMode: false,
    perfModeActive: true,
    nextState: state.nextState,
    preparePending: true,
    waitPollActive: true,
    hasLoggedNoNextSong: true,
    prepStartedForIndex: 2
  }
);
assert.equal(runtimeOptions.state.getArrangement(), state.data);
assert.equal(runtimeOptions.actions, actions);
assert.equal(runtimeOptions.ui, ui);

runtimeOptions.state.updateSongLoadPerformanceState({
  index: 4,
  preparePending: false
});
assert.equal(state.index, 4);
assert.equal(state.preparePending, false);

console.log('EditorArrangerControllerService tests passed');
