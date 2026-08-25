const assert = require('node:assert/strict');
const ArchiveProjectAudioRecoveryService = require(
  '../archive/ArchiveProjectAudioRecoveryService.js'
);

function createBuffer(channels, length, sampleRate) {
  const data = Array.from(
    { length: channels },
    () => new Float32Array(length)
  );
  return {
    numberOfChannels: channels,
    duration: length / sampleRate,
    getChannelData(index) {
      return data[index];
    }
  };
}

const calls = [];
const toasts = [];
const daw = {
  clips: [],
  bufferCache: new Map(),
  audioCtx: {
    createBuffer
  }
};
const embeddedBytes = new Uint8Array(new Float32Array([0.25, -0.5]).buffer);
const service = ArchiveProjectAudioRecoveryService.create({
  ensureAudioCtx: () => calls.push('audio-context'),
  saveAudioBlobsForProject: async () => calls.push('save-blobs'),
  base64ToUint8: () => embeddedBytes,
  peaksFromBuffer: () => ['peak'],
  refreshClipWaveImage: () => calls.push('wave'),
  toast: message => toasts.push(message),
  getIsElectron: () => false,
  getFileHandle: async key => {
    if (key !== 'handle-key') return null;
    return {
      requestPermission: async () => 'granted',
      getFile: async () => ({ name: 'handle.wav' })
    };
  },
  decodeFileToBuffer: async () => ({ buffer: createBuffer(1, 4, 4) }),
  getGlobal: () => ({})
});

(async () => {
  const embeddedClip = {
    type: 'audio',
    bufferKey: 'embedded-key',
    fileName: 'embedded.wav'
  };
  daw.clips = [embeddedClip];
  await service.restoreEmbeddedAudio({
    id: 'song-1',
    _embeddedAudio: {
      'embedded-key': {
        format: 'float32-b64',
        data: ['ignored'],
        channels: 1,
        length: 2,
        sampleRate: 2
      }
    }
  }, daw, [embeddedClip]);
  assert.ok(daw.bufferCache.has('embedded-key'));
  assert.equal(embeddedClip.sourceDuration, 1);
  assert.deepEqual(embeddedClip._peaks, ['peak']);
  assert.equal(calls.includes('audio-context'), true);
  assert.equal(calls.includes('save-blobs'), true);
  assert.equal(toasts.at(-1), 'بازیابی صدا: 1 فایل از بکآپ');

  const handleClip = {
    type: 'audio',
    bufferKey: 'handle-key',
    fileName: 'handle.wav'
  };
  daw.clips.push(handleClip);
  await service.restoreLinkedAudio({
    _audioPaths: [{ bufferKey: 'handle-key', fileName: 'handle.wav' }]
  }, daw, [handleClip]);
  assert.ok(daw.bufferCache.has('handle-key'));
  assert.equal(handleClip.sourceDuration, 1);
  assert.deepEqual(handleClip._peaks, ['peak']);

  const electronClip = {
    type: 'audio',
    bufferKey: 'electron-key',
    fileName: 'electron.wav'
  };
  const electronBuffer = createBuffer(1, 8, 4);
  let loadedPath = null;
  const electronService = ArchiveProjectAudioRecoveryService.create({
    getIsElectron: () => true,
    getGlobal: () => ({ electronAPI: {} }),
    loadAudioFromHardDrive: async value => {
      loadedPath = value;
      return electronBuffer;
    },
    peaksFromBuffer: () => [],
    refreshClipWaveImage: () => {}
  });
  daw.clips.push(electronClip);
  await electronService.restoreLinkedAudio({
    _audioPaths: [{
      bufferKey: 'electron-key',
      fileName: 'electron.wav',
      filePath: 'C:\\Audio\\electron.wav'
    }]
  }, daw, [electronClip]);
  assert.equal(loadedPath, 'C:\\Audio\\electron.wav');
  assert.equal(electronClip._filePath, 'C:\\Audio\\electron.wav');
  assert.equal(daw.bufferCache.get('electron-key'), electronBuffer);

  console.log('ArchiveProjectAudioRecoveryService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
