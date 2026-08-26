/*
 * CoreWavEncoderService
 *
 * Encodes AudioBuffer data as a standard 16-bit PCM WAV Blob.
 */
(function attachCoreWavEncoderService(globalScope) {
  'use strict';

  function create({ BlobCtor = globalScope.Blob } = {}) {
    function encode(abuffer, len) {
      const numOfChan = abuffer.numberOfChannels;
      const length = len * numOfChan * 2 + 44;
      const out = new DataView(new ArrayBuffer(length));
      const channels = [];
      let offset = 0;
      let pos = 0;

      const setUint16 = data => {
        out.setUint16(pos, data, true);
        pos += 2;
      };
      const setUint32 = data => {
        out.setUint32(pos, data, true);
        pos += 4;
      };

      setUint32(0x46464952); // "RIFF"
      setUint32(length - 8);
      setUint32(0x45564157); // "WAVE"
      setUint32(0x20746d66); // "fmt "
      setUint32(16);
      setUint16(1);
      setUint16(numOfChan);
      setUint32(abuffer.sampleRate);
      setUint32(abuffer.sampleRate * 2 * numOfChan);
      setUint16(numOfChan * 2);
      setUint16(16);
      setUint32(0x61746164); // "data"
      setUint32(length - pos - 4);

      for (let index = 0; index < numOfChan; index += 1) {
        channels.push(abuffer.getChannelData(index));
      }

      while (offset < len) {
        for (let index = 0; index < numOfChan; index += 1) {
          let sample = Math.max(
            -1,
            Math.min(1, channels[index][offset])
          );
          sample =
            (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
          out.setInt16(pos, sample, true);
          pos += 2;
        }
        offset += 1;
      }

      return new BlobCtor([out], { type: 'audio/wav' });
    }

    return Object.freeze({ encode });
  }

  const service = Object.freeze({ create });
  globalScope.CoreWavEncoderService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
