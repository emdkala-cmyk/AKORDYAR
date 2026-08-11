(function (global) {
  'use strict';

  class WaveformService {
    constructor(deps = {}) {
      this.ensureAudioCtx =
        typeof deps.ensureAudioCtx === 'function'
          ? deps.ensureAudioCtx
          : () => {
              throw new Error('WaveformService requires ensureAudioCtx');
            };

      this.setAudioContext =
        typeof deps.setAudioContext === 'function'
          ? deps.setAudioContext
          : () => {};

      this.getWaveCache =
        typeof deps.getWaveCache === 'function'
          ? deps.getWaveCache
          : () => null;

      this.document =
        deps.documentRef ||
        (typeof document !== 'undefined' ? document : null);

      this.clamp =
        typeof deps.clamp === 'function'
          ? deps.clamp
          : (value, min, max) =>
              Math.min(max, Math.max(min, value));

      this.timeToX =
        typeof deps.timeToX === 'function'
          ? deps.timeToX
          : (value) => value;
    }

    async decodeFileToBuffer(file) {
      if (!file || typeof file.arrayBuffer !== 'function') {
        throw new TypeError(
          'WaveformService.decodeFileToBuffer requires a File-like object'
        );
      }

      const ctx = this.ensureAudioCtx();

      const arrayBuffer = await file.arrayBuffer();
      const copy = arrayBuffer.slice(0);

      const buffer = await ctx.decodeAudioData(copy);

      this.setAudioContext(ctx);

      return {
        buffer,
        arrayBuffer
      };
    }

    peaksFromBuffer(buffer, buckets = 2000) {
      if (
        !buffer ||
        typeof buffer.getChannelData !== 'function'
      ) {
        throw new TypeError(
          'WaveformService.peaksFromBuffer requires an AudioBuffer'
        );
      }

      const ch = buffer.getChannelData(0);
      const block = Math.max(
        1,
        Math.floor(ch.length / buckets)
      );

      const peaks = new Float32Array(buckets);

      for (let i = 0; i < buckets; i++) {
        const start = i * block;
        let max = 0;

        const end = Math.min(
          ch.length,
          start + block
        );

        for (let j = start; j < end; j++) {
          const value = Math.abs(ch[j]);

          if (value > max) {
            max = value;
          }
        }

        peaks[i] = max;
      }

      return peaks;
    }

    drawWaveToCanvas(peaks, w, h) {
      if (!peaks || typeof peaks.length !== 'number') {
        throw new TypeError(
          'WaveformService.drawWaveToCanvas requires peaks'
        );
      }

      if (!this.document) {
        throw new Error('WaveformService requires documentRef to draw waveforms');
      }

      const canvas = this.document.createElement('canvas');

      canvas.width = Math.max(
        2,
        Math.floor(w)
      );

      canvas.height = Math.max(
        2,
        Math.floor(h)
      );

      const ctx = canvas.getContext('2d');

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const mid = canvas.height / 2;
      const n = peaks.length;

      ctx.fillStyle = '#ffffff';

      for (let i = 0; i < canvas.width; i++) {
        const idx = Math.min(
          n - 1,
          Math.floor((i / canvas.width) * n)
        );

        const amp = peaks[idx] || 0;
        const hh = Math.max(
          1,
          amp * (canvas.height * 0.86)
        );

        ctx.globalAlpha = 0.55;

        ctx.fillRect(
          i,
          mid - hh / 2,
          1,
          hh
        );
      }

      return canvas.toDataURL('image/png');
    }

    refreshClipWaveImage(clip) {
      if (
        !clip ||
        clip.type === 'chord' ||
        !clip._peaks
      ) {
        return;
      }

      const full = clip._peaks;

      const sourceDuration = Math.max(
        1e-6,
        clip.sourceDuration
      );

      const a = clip.offset / sourceDuration;

      const b =
        (clip.offset + clip.duration) /
        sourceDuration;

      const i0 = Math.floor(
        this.clamp(a, 0, 1) *
          (full.length - 1)
      );

      const i1 = Math.max(
        i0 + 1,
        Math.floor(
          this.clamp(b, 0, 1) *
            (full.length - 1)
        )
      );

      const slice = full.slice(i0, i1 + 1);

      const w = Math.max(
        8,
        this.timeToX(clip.duration)
      );

      const key = `${clip.id}:${i0}:${i1}:${Math.round(w)}`;

      const waveCache = this.getWaveCache();
      if (waveCache && waveCache.has(key)) {
        clip.waveUrl = waveCache.get(key);
        return;
      }

      clip.waveUrl = this.drawWaveToCanvas(
        slice,
        w,
        52
      );

      if (waveCache) {
        waveCache.set(key, clip.waveUrl);
      }
    }
  }

  // Expose globally
  global.WaveformService = WaveformService;
  global.waveformService = null; // placeholder, initialized later

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WaveformService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
