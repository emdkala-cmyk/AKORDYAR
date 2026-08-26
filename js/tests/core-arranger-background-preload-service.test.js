const assert = require('node:assert/strict');
const CoreArrangerBackgroundPreloadService = require(
  '../app/CoreArrangerBackgroundPreloadService.js'
);

const state = {
  active: false,
  preloadedIds: new Set()
};
const calls = [];
const songs = [
  { id: 'silent', title: 'Silent', _dawClips: [{ type: 'chord' }] },
  {
    id: 'needs-load',
    title: 'Needs Load',
    _dawClips: [{ type: 'audio', bufferKey: 'voice.wav' }]
  },
  {
    id: 'already-loaded',
    title: 'Already Loaded',
    _dawClips: [{ type: 'audio', bufferKey: 'ready.wav' }]
  }
];
const bufferCache = new Map([['ready.wav', {}]]);

const runtime = CoreArrangerBackgroundPreloadService.create({
  getArranger: () => ({
    items: ['silent', 'needs-load', 'already-loaded']
  }),
  getActive: () => state.active,
  setActive: value => {
    state.active = value;
  },
  getPreloadedIds: () => state.preloadedIds,
  setPreloadedIds: value => {
    state.preloadedIds = value;
  },
  getAllSongs: () => songs,
  getDAW: () => ({ bufferCache }),
  preloadAudioForSong: async song => calls.push(['preload', song.id]),
  wait: async delay => calls.push(['wait', delay]),
  logger: {
    log: (...args) => calls.push(['log', ...args]),
    warn: (...args) => calls.push(['warn', ...args])
  }
});

(async () => {
  runtime.start();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(state.active, false);
  assert.deepEqual([...state.preloadedIds], [
    'silent',
    'needs-load',
    'already-loaded'
  ]);
  assert.deepEqual(
    calls.filter(call => call[0] === 'preload'),
    [['preload', 'needs-load']]
  );
  assert.ok(calls.some(call => call[0] === 'wait' && call[1] === 50));
  assert.ok(calls.some(call => call[0] === 'log' && /Complete/.test(call[1])));

  console.log('CoreArrangerBackgroundPreloadService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
