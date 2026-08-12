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

  console.log('AudioRecoveryService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
