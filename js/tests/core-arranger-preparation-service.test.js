const assert = require('node:assert/strict');
const CoreArrangerPreparationService = require(
  '../app/CoreArrangerPreparationService.js'
);

const state = {
  arranger: {
    items: ['song-1', 'song-2'],
    settings: {
      'song-2': { transpose: 2 }
    }
  },
  currentIndex: 0,
  active: true,
  loggedNoNextSong: false,
  nextState: null
};

const buffer = { duration: 4.5 };
const bufferCache = new Map([['ready.wav', buffer]]);
const calls = [];
let preloadCalls = 0;

const song = {
  id: 'song-2',
  title: 'Song Two',
  _dawTracks: [{ type: 'audio', transpose: 1 }, { type: 'chord' }],
  _dawClips: [
    { id: 'section-1', type: 'section', name: 'Verse', start: 3, duration: 5 },
    { id: 'audio-1', type: 'audio', bufferKey: 'ready.wav' },
    { id: 'audio-2', type: 'audio', bufferKey: 'missing.wav', fileName: 'missing.wav' }
  ],
  _dawSections: [{ id: 'saved-section', start: 0 }],
  _arrangerMarkers: { enabled: true, start: 1, end: 8 },
  _dawLoop: { enabled: false }
};

const runtime = CoreArrangerPreparationService.create({
  getArranger: () => state.arranger,
  getCurrentIndex: () => state.currentIndex,
  isActive: () => state.active,
  hasLoggedNoNextSong: () => state.loggedNoNextSong,
  setHasLoggedNoNextSong: value => {
    state.loggedNoNextSong = value;
  },
  setNextState: value => {
    state.nextState = value;
  },
  getAllSongs: () => [song],
  preloadAudioForSong: async () => {
    preloadCalls += 1;
    return { loaded: 2, missing: 0, missingNames: [] };
  },
  getDAW: () => ({ bufferCache }),
  createPlaybackBoundary: input => {
    calls.push(['boundary', input]);
    return { start: 1, end: 12, selectionEnd: 10 };
  },
  getArrangerMarkers: () => ({ enabled: true, start: 2, end: 9 }),
  getItemSetting: (arr, id) => arr.settings[id] || {},
  peaksFromBuffer: (value, buckets) => {
    calls.push(['peaks', value, buckets]);
    return [0.2, 0.8];
  },
  restoreAudioForProjectSilently: (...args) => {
    calls.push(['restore', ...args]);
    return Promise.resolve();
  },
  wait: async delay => {
    calls.push(['wait', delay]);
  },
  logger: {
    log: (...args) => calls.push(['log', ...args]),
    warn: (...args) => calls.push(['warn', ...args]),
    error: (...args) => calls.push(['error', ...args])
  }
});

(async () => {
  await runtime.prepare();

  assert.equal(preloadCalls, 1);
  assert.equal(state.nextState.idx, 1);
  assert.equal(state.nextState.song.styles.tSize, 23);
  assert.equal(state.nextState.clips.length, 2);
  assert.equal(state.nextState.sections.length, 2);
  assert.equal(state.nextState.tracks[0].transpose, 3);
  assert.equal(state.nextState.playbackStart, 1);
  assert.equal(state.nextState.playbackEnd, 12);
  assert.deepEqual(state.nextState.arrangerMarkers, {
    enabled: true,
    start: 2,
    end: 9
  });
  assert.equal(state.nextState.clips[0].sourceDuration, 4.5);
  assert.deepEqual(state.nextState.clips[0]._peaks, [0.2, 0.8]);
  assert.ok(calls.some(call => call[0] === 'restore'));

  state.currentIndex = 1;
  state.nextState = { stale: true };
  await runtime.prepare();
  assert.equal(state.nextState, null);
  assert.equal(state.loggedNoNextSong, true);

  console.log('CoreArrangerPreparationService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
