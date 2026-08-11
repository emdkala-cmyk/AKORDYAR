const assert = require('node:assert/strict');
const WaveformService = require('../core/WaveformService.js');

const audioBuffer = {
  getChannelData: () => Float32Array.from([0, -0.5, 0.25, 1])
};

const audioContext = {
  async decodeAudioData() {
    return audioBuffer;
  }
};

const canvasContext = {
  clearRect() {},
  fillRect() {},
  globalAlpha: 1,
  fillStyle: ''
};

const documentRef = {
  createElement(tagName) {
    assert.equal(tagName, 'canvas');
    return {
      width: 0,
      height: 0,
      getContext: () => canvasContext,
      toDataURL: () => 'data:image/png;base64,test'
    };
  }
};

const waveCache = new Map();
let assignedAudioContext = null;

const service = new WaveformService({
  ensureAudioCtx: () => audioContext,
  setAudioContext: (value) => { assignedAudioContext = value; },
  getWaveCache: () => waveCache,
  documentRef,
  timeToX: (seconds) => seconds * 100
});

(async () => {
  const decoded = await service.decodeFileToBuffer({
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
  });

  assert.equal(decoded.buffer, audioBuffer);
  assert.equal(assignedAudioContext, audioContext);

  const peaks = service.peaksFromBuffer(audioBuffer, 4);
  assert.deepEqual(Array.from(peaks), [0, 0.5, 0.25, 1]);

  const clip = {
    id: 'clip-1',
    type: 'audio',
    _peaks: peaks,
    offset: 0,
    duration: 1,
    sourceDuration: 1
  };

  service.refreshClipWaveImage(clip);
  assert.equal(clip.waveUrl, 'data:image/png;base64,test');
  assert.equal(waveCache.size, 1);

  const cachedUrl = clip.waveUrl;
  clip.waveUrl = null;
  service.refreshClipWaveImage(clip);
  assert.equal(clip.waveUrl, cachedUrl);

  console.log('WaveformService tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
