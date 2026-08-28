const assert = require('node:assert/strict');
const recoveryModule = require('../editor/AudioRecoveryService.js');

function makeBuffer(duration = 3) {
  return { duration, sampleRate: 44100 };
}

(async () => {
  let refreshed = 0;
  const daw = {
    clips: [
      { id: 'audio-1', type: 'audio', bufferKey: 'blob-key', fileName: 'voice.wav' },
      { id: 'chord-1', type: 'chord', bufferKey: 'ignored' }
    ],
    bufferCache: new Map()
  };

  const service = recoveryModule.create({
    getDAW: () => daw,
    loadAudioBlobsForProject: async () => {},
    getAudioBlobFromDB: async key =>
      key === 'blob-key' ? { blob: { name: 'voice.wav' }, fileName: 'voice.wav' } : null,
    decodeFileToBuffer: async () => ({ buffer: makeBuffer() }),
    peaksFromBuffer: () => [0.5],
    refreshClipWaveImage: () => { refreshed += 1; },
    getDirHandle: async () => null,
    showDirectoryPicker: undefined
  });

  const restored = await service.restoreSongAudio({
    id: 'song-1',
    _audioPaths: [{ bufferKey: 'blob-key', fileName: 'voice.wav' }]
  });

  assert.equal(restored.loaded, 1);
  assert.equal(restored.missing, 0);
  assert.equal(daw.bufferCache.get('blob-key').duration, 3);
  assert.deepEqual(daw.clips[0]._peaks, [0.5]);
  assert.equal(refreshed, 1);

  const electronDaw = {
    clips: [{ id: 'audio-2', type: 'audio', bufferKey: 'path-key' }],
    bufferCache: new Map()
  };
  const electronService = recoveryModule.create({
    getDAW: () => electronDaw,
    loadAudioBlobsForProject: async () => {},
    loadAudioFromHardDrive: async filePath => {
      assert.equal(filePath, 'C:/audio/voice.wav');
      return makeBuffer(4);
    },
    isElectron: true,
    electronAvailable: true
  });

  const electronResult = await electronService.restoreProjectAudio('song-2', true, {
    song: {
      id: 'song-2',
      _audioPaths: [{
        bufferKey: 'path-key',
        fileName: 'voice.wav',
        filePath: 'C:/audio/voice.wav'
      }]
    }
  });

  assert.equal(electronResult.loaded, 1);
  assert.equal(electronResult.missing, 0);
  assert.equal(electronDaw.clips[0]._filePath, 'C:/audio/voice.wav');

  const preloadDaw = { bufferCache: new Map() };
  const preloadService = recoveryModule.create({
    getDAW: () => preloadDaw,
    loadAudioBlobsForProject: async () => {},
    getAudioBlobFromDB: async () => ({
      blob: { name: 'next.wav' },
      fileName: 'next.wav'
    }),
    decodeFileToBuffer: async () => ({ buffer: makeBuffer(5) })
  });

  const preloadResult = await preloadService.preloadAudioForSong({
    id: 'song-3',
    _dawClips: [{ id: 'next', type: 'audio', bufferKey: 'next-key' }],
    _audioPaths: [{ bufferKey: 'next-key', fileName: 'next.wav' }]
  });

  assert.equal(preloadResult.loaded, 1);
  assert.equal(preloadResult.missing, 0);
  assert.equal(preloadDaw.bufferCache.get('next-key').duration, 5);

  const missingDaw = {
    clips: [{
      id: 'missing-audio',
      type: 'audio',
      bufferKey: 'missing-key',
      fileName: 'missing.wav'
    }],
    bufferCache: new Map()
  };
  const missingService = recoveryModule.create({
    getDAW: () => missingDaw,
    loadAudioBlobsForProject: async () => {}
  });
  const missingResult = await missingService.restoreSongAudio({
    id: 'song-4'
  });

  assert.equal(missingResult.loaded, 0);
  assert.equal(missingResult.missing, 1);
  assert.deepEqual(missingResult.missingNames, ['missing.wav']);

  const handleDaw = {
    clips: [{
      id: 'handle-audio',
      type: 'audio',
      bufferKey: 'handle-key',
      fileName: 'handle.wav'
    }],
    bufferCache: new Map()
  };
  const handleService = recoveryModule.create({
    getDAW: () => handleDaw,
    getFileHandle: async key => key === 'handle-key'
      ? {
          requestPermission: async () => 'granted',
          getFile: async () => ({ name: 'handle.wav' })
        }
      : null,
    decodeFileToBuffer: async () => ({ buffer: makeBuffer(6) })
  });
  const handleResult = await handleService.restoreSongAudio({
    id: 'song-5'
  });

  assert.equal(handleResult.loaded, 1);
  assert.equal(handleResult.missing, 0);
  assert.equal(handleDaw.bufferCache.get('handle-key').duration, 6);

  let emptySongLoadAttempts = 0;
  const emptySongService = recoveryModule.create({
    getDAW: () => ({ clips: [], bufferCache: new Map() }),
    loadAudioBlobsForProject: async () => {
      emptySongLoadAttempts += 1;
      throw new Error('IndexedDB should not be opened for an empty song');
    }
  });
  const emptySongResult = await emptySongService.restoreSongAudio({
    id: 'empty-song'
  });
  assert.deepEqual(emptySongResult, {
    loaded: 0,
    missing: 0,
    missingNames: []
  });
  assert.equal(emptySongLoadAttempts, 0);

  console.log('AudioRecoveryService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
