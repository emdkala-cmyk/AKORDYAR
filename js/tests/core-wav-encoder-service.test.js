const assert = require('node:assert/strict');
const CoreWavEncoderService = require('../app/CoreWavEncoderService.js');

class FakeBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options.type;
  }
}

const runtime = CoreWavEncoderService.create({ BlobCtor: FakeBlob });
const audioBuffer = {
  numberOfChannels: 2,
  sampleRate: 44100,
  getChannelData(channel) {
    return channel === 0
      ? new Float32Array([-1, 0.5])
      : new Float32Array([1, -0.5]);
  }
};

const blob = runtime.encode(audioBuffer, 2);
assert.equal(blob.type, 'audio/wav');
assert.equal(blob.parts.length, 1);

const view = blob.parts[0];
assert.equal(view.byteLength, 52);
assert.equal(view.getUint32(0, true), 0x46464952);
assert.equal(view.getUint32(4, true), 44);
assert.equal(view.getUint32(8, true), 0x45564157);
assert.equal(view.getUint32(12, true), 0x20746d66);
assert.equal(view.getUint16(20, true), 1);
assert.equal(view.getUint16(22, true), 2);
assert.equal(view.getUint32(24, true), 44100);
assert.equal(view.getUint32(28, true), 176400);
assert.equal(view.getUint16(32, true), 4);
assert.equal(view.getUint16(34, true), 16);
assert.equal(view.getUint32(36, true), 0x61746164);
assert.equal(view.getUint32(40, true), 8);
assert.deepEqual(
  [view.getInt16(44, true), view.getInt16(46, true)],
  [-32768, 32767]
);
assert.deepEqual(
  [view.getInt16(48, true), view.getInt16(50, true)],
  [16383, -16383]
);

console.log('CoreWavEncoderService tests passed');
