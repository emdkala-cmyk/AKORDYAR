const assert = require('node:assert/strict');
const CorePerformanceControllerService = require(
  '../app/CorePerformanceControllerService.js'
);

let runtimeOptions = null;
const runtime = {
  openPerfMode() {},
  perfStop() {},
  prepareNextArrSong() {},
  startBackgroundPreload() {},
  arrCrossfadeSwap() {},
  renderPerfUI() {}
};

const runtimeService = {
  create(options) {
    runtimeOptions = options;
    return runtime;
  }
};

const editingArr = { id: 'editing' };
const controller = CorePerformanceControllerService.create({
  runtimeService,
  actions: { getEditingArr: () => editingArr },
  ui: { documentRef: {} },
  timing: { now: () => 123 },
  logger: { log() {} }
});

assert.equal(controller.runtime, runtime);
assert.equal(controller.state.index, -1);
assert.equal(controller.state.active, false);
assert.equal(
  runtimeOptions.state.getArranger(),
  editingArr
);
assert.equal(
  runtimeOptions.state.getPreparationArranger(),
  editingArr
);
assert.equal(runtimeOptions.state.getCurrentIndex(), -1);
assert.equal(runtimeOptions.state.isActive(), false);
assert.deepEqual(runtimeOptions.state.getPerformanceState(), {
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
  arrHasLoggedNoNextSong: false,
  arrPrepStartedForIndex: -1
});

controller.updateState({
  index: 2,
  active: true,
  data: { id: 'performance' },
  modeActive: true,
  pauseMode: true,
  liveTranspose: -2
});
assert.equal(controller.state.index, 2);
assert.equal(controller.state.active, true);
assert.equal(controller.state.data.id, 'performance');
assert.equal(controller.state.modeActive, true);
assert.equal(controller.state.pauseMode, true);
assert.equal(controller.state.liveTranspose, -2);

runtimeOptions.state.updatePerformanceState({
  arrPerformIdx: 3,
  arrPerformActive: false,
  arrPreparePending: true,
  arrNextState: { id: 'next' }
});
assert.equal(controller.state.index, 3);
assert.equal(controller.state.active, false);
assert.equal(controller.state.preparePending, true);
assert.deepEqual(controller.state.nextState, { id: 'next' });

runtimeOptions.state.setPreloadedIds(new Set(['song-1']));
runtimeOptions.state.setIsCrossfading(true);
assert.deepEqual([...controller.state.preloadedSongIds], ['song-1']);
assert.equal(controller.state.crossfading, true);

console.log('CorePerformanceControllerService tests passed');
