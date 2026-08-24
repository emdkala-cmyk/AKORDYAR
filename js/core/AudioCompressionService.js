/**
 * AudioCompressionService
 *
 * ابزارهای فشرده‌سازی و بازکردن دادهٔ صوتی برای storage.
 * این سرویس به DOM، DAW و state ویرایشگر وابسته نیست.
 */
(function attachAudioCompressionService(globalScope) {
  'use strict';

  function create({
    CompressionStreamCtor = globalScope.CompressionStream,
    DecompressionStreamCtor = globalScope.DecompressionStream,
    BlobCtor = globalScope.Blob
  } = {}) {
    async function compressBytes(uint8Arr) {
      try {
        if (typeof CompressionStreamCtor !== 'function') {
          return {
            blob: new BlobCtor([uint8Arr], { type: 'audio/wav' }),
            format: 'wav'
          };
        }

        const stream = new CompressionStreamCtor('deflate');
        const writer = stream.writable.getWriter();
        await writer.write(uint8Arr);
        await writer.close();

        const reader = stream.readable.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        return {
          blob: new BlobCtor(chunks, {
            type: 'application/octet-stream'
          }),
          format: 'wav-deflate'
        };
      } catch (_) {
        return {
          blob: new BlobCtor([uint8Arr], { type: 'audio/wav' }),
          format: 'wav'
        };
      }
    }

    async function decompressBytes(uint8Arr) {
      if (typeof DecompressionStreamCtor !== 'function') {
        throw new Error('DecompressionStream is unavailable');
      }

      const stream = new DecompressionStreamCtor('deflate');
      const writer = stream.writable.getWriter();
      await writer.write(uint8Arr);
      await writer.close();

      const reader = stream.readable.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce(
        (total, chunk) => total + chunk.length,
        0
      );
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    }

    return Object.freeze({ compressBytes, decompressBytes });
  }

  const service = Object.freeze({ create });
  globalScope.AudioCompressionService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
