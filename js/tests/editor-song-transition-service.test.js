const assert = require('node:assert/strict');

const hydration = require('../editor/EditorHydrationService.js');
const transitionModule = require('../editor/EditorSongTransitionService.js');

const disconnected = [];
const audioContext = {
  createStereoPanner() {
    return {
      connect() {},
      disconnect() {
        disconnected.push('panner');
      }
    };
  },
  createGain() {
    return {
      connect() {},
      disconnect() {
        disconnected.push('gain');
      }
    };
  }
};

const oldTrack = {
  id: 'old-audio',
  type: 'audio',
  _pannerNode: audioContext.createStereoPanner(),
  _gainNode: audioContext.createGain()
};
const daw = {
  tracks: [oldTrack],
  clips: [{ id: 'old-clip', type: 'audio', bufferKey: 'old' }],
  sections: [],
  selectedIds: new Set(['old-clip']),
  selectedSectionIds: new Set(),
  bufferCache: new Map(),
  waveCache: new Map([['old', {}]]),
  tempoMap: { baseTempo: 140, events: [{ time: 0, tempo: 140 }] },
  audioCtx: audioContext,
  masterGain: { connect() {} }
};

let currentSong = null;
let audioContextEnsured = 0;
let mixesUpdated = 0;
let restoredProjectId = null;

const service = transitionModule.create({
  getDAW: () => daw,
  setSong: song => {
    currentSong = song;
  },
  repairSong: song => ({ ...song, repaired: true }),
  hydrationService: hydration,
  ensureAudioCtx: () => {
    audioContextEnsured += 1;
  },
  updateTrackMix: () => {
    mixesUpdated += 1;
  },
  restoreAudio: async projectId => {
    restoredProjectId = projectId;
    return { loaded: 1, missing: 0, missingNames: [] };
  }
});

(async () => {
  const preparedSong = { id: 'prepared' };
  const preparedTrack = { id: 'prepared-audio', type: 'audio' };
  const prepared = service.applyPreparedState({
    song: preparedSong,
    tracks: [preparedTrack],
    clips: [{ id: 'prepared-clip', type: 'audio', bufferKey: 'prepared' }],
    sections: [{ id: 'section-1' }],
    loopState: { loopEnabled: true, loopA: 2, loopB: 8 },
    arrangerMarkers: { enabled: true, start: 4, end: 12 }
  });

  assert.equal(prepared.song.repaired, true);
  assert.equal(currentSong, prepared.song);
  assert.equal(daw.tracks[0], preparedTrack);
  assert.equal(daw.loopEnabled, true);
  assert.equal(daw.loopA, 2);
  assert.equal(daw.loopB, 8);
  assert.deepEqual(daw.arrangerMarkers, { enabled: true, start: 4, end: 12 });
  assert.equal(daw.tempoMap, null);
  assert.equal(preparedTrack.transpose, 0);
  assert.ok(preparedTrack._pannerNode);
  assert.ok(preparedTrack._gainNode);
  assert.ok(disconnected.includes('panner'));
  assert.ok(disconnected.includes('gain'));

  const loaded = await service.loadSong({
    id: 'loaded',
    tempoMap: {
      baseTempo: 110,
      events: [{ time: 0, tempo: 110 }, { time: 3, tempo: 150 }]
    },
    _dawTracks: [{ id: 'loaded-audio', type: 'audio' }],
    _dawClips: [{ id: 'loaded-clip', type: 'audio', bufferKey: 'loaded' }],
    _dawSections: []
  }, { transpose: 2 });

  assert.equal(loaded.song.id, 'loaded');
  assert.equal(loaded.song.repaired, true);
  assert.equal(currentSong, loaded.song);
  assert.equal(daw.tracks[0].transpose, 2);
  assert.equal(daw.clips[0].id, 'loaded-clip');
  assert.equal(daw.waveCache.size, 0);
  assert.deepEqual(daw.tempoMap, {
    baseTempo: 110,
    events: [{ time: 0, tempo: 110 }, { time: 3, tempo: 150 }]
  });
  assert.equal(restoredProjectId, 'loaded');
  assert.equal(loaded.restoreResult.loaded, 1);
  assert.ok(audioContextEnsured >= 2);
  assert.ok(mixesUpdated >= 2);

  console.log('EditorSongTransitionService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
