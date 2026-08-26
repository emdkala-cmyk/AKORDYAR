const assert = require('node:assert/strict');
const LoadService = require(
  '../editor/EditorArrangerSongLoadService.js'
);

const calls = [];
const scheduled = [];
const performanceState = {
  active: true,
  index: -1,
  pauseMode: false,
  perfModeActive: true,
  nextState: null,
  preparePending: false,
  waitPollActive: true,
  hasLoggedNoNextSong: true,
  prepStartedForIndex: 9
};
const daw = {
  clips: [{ id: 'clip-1', start: 0, duration: 6 }],
  sections: [{ id: 'section-1', start: 1, duration: 3 }],
  loopA: 2,
  loopB: 8,
  isPlaying: false
};
const song = {
  id: 'song-2',
  title: 'Loaded song',
  _arrangerMarkers: { enabled: true, start: 3, end: 12 },
  _dawLoop: { loopEnabled: true, loopA: 20, loopB: 30 }
};
let loadedOptions = null;
let selectionEnd = null;
let prepared = 0;
let mirrored = 0;

const service = LoadService.create({
  getArrangement: () => ({
    items: ['missing-song', 'song-2', 'next-song']
  }),
  getPerformanceState: () => ({ ...performanceState }),
  updatePerformanceState: patch => Object.assign(performanceState, patch),
  getAllSongs: () => [song],
  getItemSetting: (arrangement, songId) => {
    assert.equal(arrangement.items.length, 3);
    assert.equal(songId, 'song-2');
    return { transpose: 2 };
  },
  getDAW: () => daw,
  loadSong: async (loadedSong, options) => {
    calls.push(`load:${loadedSong.id}`);
    loadedOptions = options;
    return {
      restoreResult: {
        missing: 0,
        loaded: 2,
        missingNames: []
      }
    };
  },
  getPlaybackPolicy: () => ({
    createBoundary: options => {
      assert.deepEqual(options.clips, daw.clips);
      assert.deepEqual(options.sections, daw.sections);
      assert.deepEqual(options.arrangerMarkers, song._arrangerMarkers);
      assert.deepEqual(options.legacyLoopState, song._dawLoop);
      return {
        start: 3,
        end: 12,
        selectionEnd: 12,
        markers: { start: 3, end: 12 }
      };
    },
    applyToDAW: target => {
      assert.equal(target, daw);
      target.loopEnabled = false;
      calls.push('apply-boundary');
    }
  }),
  getProjectEnd: () => 99,
  pauseTransport: () => calls.push('pause'),
  stopAllVoices: () => calls.push('stop-voices'),
  setSelectionEnd: value => {
    selectionEnd = value;
  },
  resetRecording: () => calls.push('reset-recording'),
  resetHistory: () => calls.push('reset-history'),
  syncToolbar: () => calls.push('sync-toolbar'),
  renderEditor: value => calls.push(`render-editor:${value}`),
  renderAll: () => calls.push('render-all'),
  saveState: () => calls.push('save-state'),
  initHighlightEffect: () => calls.push('highlight'),
  syncUIAfterSongChange: () => calls.push('sync-ui'),
  toast: message => calls.push(`toast:${message}`),
  translate: key => key,
  seekTransport: (...args) => calls.push(['seek', ...args]),
  ensureAudioCtx: () => calls.push('ensure-audio'),
  startTransport: () => calls.push('start-transport'),
  prepareNextSong: async () => {
    prepared += 1;
    calls.push('prepare-next');
  },
  renderPerfUI: () => calls.push('render-perf'),
  mirrorTimeline: () => {
    mirrored += 1;
    calls.push('mirror');
  },
  schedule: (callback, delay) => {
    scheduled.push({ callback, delay });
  },
  logger: {
    log: (...args) => calls.push(['log', ...args]),
    warn: (...args) => calls.push(['warn', ...args]),
    error: (...args) => calls.push(['error', ...args])
  }
});

(async () => {
  await service.load(0);

  assert.equal(performanceState.index, 1);
  assert.equal(performanceState.nextState, null);
  assert.equal(performanceState.preparePending, false);
  assert.equal(performanceState.waitPollActive, false);
  assert.equal(performanceState.hasLoggedNoNextSong, false);
  assert.equal(performanceState.prepStartedForIndex, -1);
  assert.equal(selectionEnd, 12);
  assert.equal(daw.loopEnabled, false);
  assert.equal(loadedOptions.transpose, 2);
  assert.equal(loadedOptions.styleDefaults.tFont, 'Vazirmatn');
  assert.equal(loadedOptions.styleDefaults.cFont, 'JetBrains Mono');
  assert.deepEqual(calls.filter(call => typeof call === 'string').slice(0, 5), [
    'pause',
    'stop-voices',
    'reset-recording',
    'load:song-2',
    'apply-boundary'
  ]);
  assert.ok(calls.includes('reset-history'));
  assert.ok(calls.includes('sync-toolbar'));
  assert.ok(calls.includes('render-editor:true'));
  assert.ok(calls.includes('render-all'));
  assert.ok(calls.includes('save-state'));
  assert.ok(calls.includes('highlight'));
  assert.ok(calls.includes('sync-ui'));
  assert.ok(calls.includes('render-perf'));
  assert.ok(calls.includes('start-transport'));
  assert.deepEqual(
    calls.find(call => Array.isArray(call) && call[0] === 'seek'),
    ['seek', 3, false, true]
  );
  assert.equal(
    scheduled.filter(item => item.delay === 500).length,
    1
  );
  assert.equal(
    scheduled.filter(item => item.delay === 1000).length,
    1
  );

  const prepSchedule = scheduled.find(item => item.delay === 500);
  prepSchedule.callback();
  await Promise.resolve();
  assert.equal(prepared, 1);
  assert.equal(performanceState.preparePending, false);

  const mirrorSchedule = scheduled.find(item => item.delay === 1000);
  mirrorSchedule.callback();
  assert.equal(mirrored, 1);

  const finishState = { active: true, nextState: { id: 'next' } };
  const finishToasts = [];
  const finishService = LoadService.create({
    getArrangement: () => ({ items: [] }),
    getPerformanceState: () => finishState,
    updatePerformanceState: patch => Object.assign(finishState, patch),
    toast: message => finishToasts.push(message),
    translate: key => key
  });
  await finishService.load(0);
  assert.equal(finishState.active, false);
  assert.equal(finishState.nextState, null);
  assert.deepEqual(finishToasts, ['arrangerFinished']);

  console.log('EditorArrangerSongLoadService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
