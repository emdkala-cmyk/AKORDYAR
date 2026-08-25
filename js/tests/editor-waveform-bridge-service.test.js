const assert = require('node:assert/strict');
const BridgeService = require('../core/EditorWaveformBridgeService.js');

const calls = [];
class FakeWaveformService {
  constructor(deps) {
    this.deps = deps;
  }

  decodeFileToBuffer(file) {
    calls.push(['decode', file]);
    return 'decoded';
  }

  peaksFromBuffer(buffer, buckets) {
    calls.push(['peaks', buffer, buckets]);
    return 'peaks';
  }

  drawWaveToCanvas(peaks, width, height) {
    calls.push(['draw', peaks, width, height]);
    return 'image';
  }

  refreshClipWaveImage(clip) {
    calls.push(['refresh', clip]);
    return 'refreshed';
  }
}

const bridge = BridgeService.create({
  waveformServiceCtor: FakeWaveformService,
  ensureAudioCtx: () => 'ctx',
  setAudioContext: () => {},
  getWaveCache: () => new Map(),
  documentRef: {},
  clamp: value => value,
  timeToX: value => value
});

assert.ok(bridge.service instanceof FakeWaveformService);
assert.equal(bridge.service.deps.ensureAudioCtx(), 'ctx');
assert.equal(bridge.decodeFileToBuffer('file'), 'decoded');
assert.equal(bridge.peaksFromBuffer('buffer', 8), 'peaks');
assert.equal(bridge.drawWaveToCanvas('peaks', 20, 52), 'image');
assert.equal(bridge.refreshClipWaveImage('clip'), 'refreshed');
assert.deepEqual(calls, [
  ['decode', 'file'],
  ['peaks', 'buffer', 8],
  ['draw', 'peaks', 20, 52],
  ['refresh', 'clip']
]);

console.log('EditorWaveformBridgeService tests passed');
