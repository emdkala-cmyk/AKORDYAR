const assert = require('node:assert/strict');
const CorePerformanceRuntimeService = require(
  '../app/CorePerformanceRuntimeService.js'
);

const order = [];
const calls = [];
const performanceState = {
  arrPerformData: { items: ['song-1', 'song-2'] },
  arrPerformIdx: 0,
  arrPerformActive: true,
  perfModeActive: true,
  nextState: null
};

const makeService = (name, runtime) => ({
  create(options) {
    order.push(name);
    calls.push([name, options]);
    return runtime;
  }
});

const performanceMode = {
  openPerfMode: () => calls.push('open'),
  perfStop: () => calls.push('stop'),
  perfTogglePauseMode: () => calls.push('pause-mode'),
  perfTogglePlay: () => calls.push('play'),
  perfRestartSong: () => calls.push('restart'),
  perfPrevSong: () => calls.push('prev'),
  perfNextSong: () => calls.push('next'),
  perfTranspose: () => calls.push('transpose'),
  perfTempoChange: () => calls.push('tempo'),
  perfJumpToSong: index => calls.push(['jump', index]),
  startPerfTimer: () => calls.push('timer-start'),
  stopPerfTimer: () => calls.push('timer-stop'),
  startArrangerPerform: () => calls.push('perform')
};

const preparation = {
  prepare: () => calls.push('prepare')
};

const preload = {
  start: () => calls.push('preload')
};

const crossfade = {
  swap: () => calls.push('crossfade')
};

const performanceUi = {
  render: () => calls.push('render')
};

const runtime = CorePerformanceRuntimeService.create({
  state: {
    getPerformanceState: () => ({
      arrPerformData: performanceState.arrPerformData,
      arrPerformIdx: performanceState.arrPerformIdx,
      arrPerformActive: performanceState.arrPerformActive,
      perfModeActive: performanceState.perfModeActive,
      nextState: performanceState.nextState
    }),
    updatePerformanceState: patch => Object.assign(performanceState, patch),
    getArranger: () => performanceState.arrPerformData,
    getPreparationArranger: () => performanceState.arrPerformData,
    getPreloadArranger: () => performanceState.arrPerformData,
    getCurrentIndex: () => performanceState.arrPerformIdx,
    isActive: () => performanceState.arrPerformActive,
    getCrossfadeDuration: () => 1,
    setNextState: value => {
      performanceState.nextState = value;
    }
  },
  actions: {
    getEditingArr: () => performanceState.arrPerformData,
    getPerformanceMarkers: () => ({ enabled: false, start: 0, end: 10 }),
    getSongMarkers: () => ({ enabled: false, start: 0, end: 10 }),
    getArrangerEnd: () => 10,
    getCurrentSong: () => ({ id: 'song-1' })
  },
  services: {
    performanceModeService: makeService('performance-mode', performanceMode),
    preparationService: makeService('preparation', preparation),
    backgroundPreloadService: makeService('preload', preload),
    crossfadeService: makeService('crossfade', crossfade),
    performanceUiService: makeService('performance-ui', performanceUi)
  },
  ui: {
    documentRef: {},
    getElement: () => null
  },
  timing: {
    schedule: () => {},
    setIntervalRef: () => 1,
    clearIntervalRef: () => {},
    wait: async () => {}
  },
  logger: { log() {}, warn() {}, error() {} }
});

assert.deepEqual(order, [
  'preparation',
  'performance-mode',
  'preload',
  'crossfade',
  'performance-ui'
]);
assert.equal(typeof runtime.openPerfMode, 'function');
assert.equal(typeof runtime.prepareNextArrSong, 'function');
assert.equal(typeof runtime.startBackgroundPreload, 'function');
assert.equal(typeof runtime.arrCrossfadeSwap, 'function');
assert.equal(typeof runtime.renderPerfUI, 'function');

runtime.perfNextSong();
runtime.prepareNextArrSong();
runtime.startBackgroundPreload();
runtime.arrCrossfadeSwap();
runtime.renderPerfUI();
assert.ok(calls.includes('next'));
assert.ok(calls.includes('prepare'));
assert.ok(calls.includes('preload'));
assert.ok(calls.includes('crossfade'));
assert.ok(calls.includes('render'));

console.log('CorePerformanceRuntimeService tests passed');
