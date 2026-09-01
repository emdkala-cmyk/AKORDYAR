/**
 * WarpAudioRendererService
 *
 * Renders a warped (time-stretched) AudioBuffer from a source buffer and a
 * warp-marker set, using a WSOLA-style overlap-add time stretch so pitch is
 * preserved while each marker segment lands exactly on its timeline span.
 *
 * The original buffer is never modified — warping is non-destructive and the
 * result is cached per clip keyed by the marker fingerprint.
 *
 * Pure DSP lives in renderWarpedSamples() (no DOM, no AudioContext) so the
 * algorithm is testable in Node; the service wrapper owns caching and
 * chunked async scheduling around ctx.createBuffer().
 */
(function attachWarpAudioRendererService(globalScope) {
  'use strict';

  const DEFAULT_WINDOW = 1024;   // ~23ms at 44.1kHz
  const DEFAULT_SEARCH = 128;    // WSOLA alignment search radius (samples)
  const ENV_FLOOR = 0.25;        // envelope normalization floor

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function hannWindow(size) {
    const w = new Float32Array(size);
    for (let i = 0; i < size; i += 1) {
      // periodic Hann → sums to 1 at 50% overlap
      w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size));
    }
    return w;
  }

  /**
   * WSOLA offset search: pick d ∈ [-search, +search] maximizing the
   * cross-correlation between the candidate frame and the ideal
   * continuation of the previously synthesized frame.  Coarse step first,
   * then a local refine, to keep the cost bounded.
   */
  function findBestOffset(data, candidatePos, idealPos, W, search, dataLen) {
    const idealStart = clamp(idealPos, 0, dataLen - W);
    if (idealStart !== idealPos) return clamp(candidatePos, 0, dataLen - W);
    let bestD = 0;
    let bestScore = -Infinity;
    const coarse = 4;
    for (let d = -search; d <= search; d += coarse) {
      const p = candidatePos + d;
      if (p < 0 || p + W > dataLen) continue;
      let score = 0;
      for (let n = 0; n < W; n += coarse) {
        score += data[p + n] * data[idealStart + n];
      }
      if (score > bestScore) {
        bestScore = score;
        bestD = d;
      }
    }
    for (let d = bestD - coarse + 1; d <= bestD + coarse - 1; d += 1) {
      if (d === bestD) continue;
      const p = candidatePos + d;
      if (p < 0 || p + W > dataLen) continue;
      let score = 0;
      for (let n = 0; n < W; n += 2) {
        score += data[p + n] * data[idealStart + n];
      }
      if (score > bestScore) {
        bestScore = score;
        bestD = d;
      }
    }
    return clamp(candidatePos + bestD, 0, dataLen - W);
  }

  /**
   * Linear resample fallback for segments shorter than two windows
   * (varispeed is acceptable at this scale; WSOLA needs room to work).
   */
  function renderSegmentLinear(channels, outChannels, env, sr, seg, outLenSamples) {
    const srcLen = Math.max(1, Math.round((seg.srcEnd - seg.srcStart) * sr));
    const outStart = Math.round(seg.outStart * sr);
    const outEnd = Math.round(seg.outEnd * sr);
    for (let o = outStart; o < outEnd && o < outLenSamples; o += 1) {
      const a = (o - outStart) / Math.max(1, outEnd - outStart);
      const src = seg.srcStart * sr + a * srcLen;
      const i0 = clamp(Math.floor(src), 0, channels[0].length - 1);
      const i1 = clamp(i0 + 1, 0, channels[0].length - 1);
      const f = src - i0;
      for (let ch = 0; ch < channels.length; ch += 1) {
        const v = channels[ch][i0] * (1 - f) + channels[ch][i1] * f;
        outChannels[ch][o] += v;
      }
      env[o] += 1;
    }
  }

  /**
   * Render one warp segment with WSOLA overlap-add into the shared output.
   * Frames are placed at synthesis hops across [outStart, outEnd); each
   * windowed frame may extend past the joint into the next segment's span,
   * producing a natural crossfade at marker joints.
   */
  function renderSegmentWSOLA(channels, outChannels, env, sr, seg, outLenSamples, W, search) {
    const win = hannWindow(W);
    const Hs = W >> 1;
    const dataLen = channels[0].length;
    const srcA = clamp(Math.round(seg.srcStart * sr), 0, Math.max(0, dataLen - 1));
    const srcB = clamp(Math.round(seg.srcEnd * sr), srcA + 1, dataLen);
    const outA = Math.round(seg.outStart * sr);
    const outB = Math.round(seg.outEnd * sr);
    const srcSpan = srcB - srcA;
    const outSpan = Math.max(1, outB - outA);
    if (srcSpan < W * 2 || outSpan < Hs) {
      renderSegmentLinear(channels, outChannels, env, sr, seg, outLenSamples);
      return;
    }
    const Ha = Hs * (srcSpan / outSpan);
    const maxRead = dataLen - W;
    let prevRead = srcA;
    let k = 0;
    for (let p = outA; p < outB && p < outLenSamples; p += Hs, k += 1) {
      const natural = clamp(srcA + Math.round(k * Ha), 0, maxRead);
      let readPos = natural;
      if (k > 0 && search > 0) {
        // ideal continuation: the source samples directly following the
        // frame read on the previous hop
        readPos = findBestOffset(
          channels[0], natural, prevRead + Hs, W, search, dataLen
        );
        // keep analysis progressing at a sane pace within this segment
        const lo = clamp(prevRead + Math.floor(Ha) - search, 0, maxRead);
        const hi = clamp(prevRead + Math.ceil(Ha) + search, 0, maxRead);
        readPos = clamp(readPos, lo, hi);
      }
      for (let n = 0; n < W; n += 1) {
        const o = p + n;
        if (o < 0 || o >= outLenSamples) continue;
        const w = win[n];
        env[o] += w;
        for (let ch = 0; ch < channels.length; ch += 1) {
          outChannels[ch][o] += channels[ch][readPos + n] * w;
        }
      }
      prevRead = readPos;
    }
  }

  /**
   * Pure DSP entry: warp full source channels through marker segments.
   *
   * @param {Float32Array[]} channels   source channel data
   * @param {number}         sampleRate
   * @param {Array}          segments   [{ srcStart, srcEnd, tlStart, tlEnd }] in seconds
   * @param {number}         timelineOrigin  timeline time of output sample 0
   * @param {object}         [opts]     { window, search }
   * @returns {{ channels: Float32Array[], length: number, sampleRate: number }}
   */
  function renderWarpedSamples(channels, sampleRate, segmentsList, timelineOrigin, opts = {}) {
    if (!channels || !channels.length || !segmentsList || !segmentsList.length) {
      return { channels: [], length: 0, sampleRate };
    }
    const W = Math.max(64, Math.floor(opts.window) || DEFAULT_WINDOW);
    const search = opts.search == null
      ? DEFAULT_SEARCH
      : Math.max(0, Math.floor(opts.search));
    const tlStart = segmentsList[0].tlStart;
    const tlEnd = segmentsList[segmentsList.length - 1].tlEnd;
    const outLen = Math.max(1, Math.ceil((tlEnd - tlStart) * sampleRate));
    const outChannels = channels.map(() => new Float32Array(outLen));
    const env = new Float32Array(outLen);

    for (const seg of segmentsList) {
      renderSegmentWSOLA(
        channels, outChannels, env, sampleRate,
        {
          srcStart: seg.srcStart,
          srcEnd: seg.srcEnd,
          outStart: seg.tlStart - timelineOrigin,
          outEnd: seg.tlEnd - timelineOrigin
        },
        outLen, W, search
      );
    }

    // normalize the OLA envelope so joints crossfade at unity gain
    for (let i = 0; i < outLen; i += 1) {
      const g = env[i] > ENV_FLOOR ? env[i] : ENV_FLOOR;
      for (let ch = 0; ch < outChannels.length; ch += 1) {
        outChannels[ch][i] /= g;
      }
    }
    return { channels: outChannels, length: outLen, sampleRate };
  }

  /* ================================================================
     Service wrapper — caching + chunked async scheduling
     ================================================================ */

  function create({
    ensureAudioCtx = () => null,
    getBuffer = () => null,
    FreeWarp = globalScope.FreeWarpEngine,
    logger = console,
    schedule = cb => setTimeout(cb, 0)
  } = {}) {
    const cache = new Map(); // clipId → { key, buffer, state }

    function cacheKeyFor(clip) {
      const markers = FreeWarp?.sortMarkers?.(clip.warpMarkers || []);
      if (!markers.length) return null;
      return [
        clip.bufferKey || '',
        FreeWarp.markersKey(markers),
        Math.round((clip.offset || 0) * 1000),
        Math.round(clip.duration * 1000)
      ].join('~');
    }

    /**
     * Synchronous cached lookup for playback.  Returns the warped
     * AudioBuffer when it is rendered and current, else null.
     */
    function getWarpedBuffer(clip) {
      if (!clip || clip.type === 'chord') return null;
      const markers = FreeWarp?.sortMarkers?.(clip.warpMarkers || []);
      if (!markers || markers.length < 2 || !FreeWarp.isWarped(markers)) return null;
      const entry = cache.get(clip.id);
      if (!entry || entry.state !== 'ready' || entry.key !== cacheKeyFor(clip)) {
        return null;
      }
      return entry.buffer;
    }

    function isRendering(clipId) {
      return cache.get(clipId)?.state === 'rendering';
    }

    /**
     * Kick (or reuse) an async render of the warped buffer for a clip.
     * onDone(buffer|null) fires when the render settles.
     */
    function ensureWarpedBuffer(clip, { onDone = () => {} } = {}) {
      if (!clip || clip.type === 'chord') {
        onDone(null);
        return null;
      }
      const markers = FreeWarp?.sortMarkers?.(clip.warpMarkers || []);
      if (!markers || markers.length < 2 || !FreeWarp.isWarped(markers)) {
        cache.delete(clip.id);
        onDone(null);
        return null;
      }
      const key = cacheKeyFor(clip);
      const entry = cache.get(clip.id);
      if (entry && entry.key === key && entry.state === 'ready') {
        onDone(entry.buffer);
        return entry.buffer;
      }
      if (entry && entry.key === key && entry.state === 'rendering') {
        entry.waiters.push(onDone);
        return null;
      }

      const sourceBuffer = getBuffer(clip);
      if (!sourceBuffer) {
        onDone(null);
        return null;
      }

      const record = { key, buffer: null, state: 'rendering', waiters: [onDone] };
      cache.set(clip.id, record);

      const segmentsList = FreeWarp.segments(markers);
      const timelineOrigin = markers[0].timelineTime;
      const channels = [];
      for (let ch = 0; ch < sourceBuffer.numberOfChannels; ch += 1) {
        channels.push(sourceBuffer.getChannelData(ch));
      }

      // Chunked render: one segment per macrotask keeps the UI alive.
      // env is shared across segments so joints crossfade correctly and the
      // OLA envelope is normalized exactly once, in finalize().
      const partial = channels.map(() => null);
      let env = null;
      let segIndex = 0;

      function finalize(totalLength) {
        try {
          const ctx = ensureAudioCtx();
          if (!ctx?.createBuffer) throw new Error('no AudioContext');
          for (let i = 0; i < totalLength; i += 1) {
            const g = env[i] > ENV_FLOOR ? env[i] : ENV_FLOOR;
            for (let ch = 0; ch < channels.length; ch += 1) {
              partial[ch][i] /= g;
            }
          }
          const out = ctx.createBuffer(channels.length, totalLength, sourceBuffer.sampleRate);
          for (let ch = 0; ch < channels.length; ch += 1) {
            out.getChannelData(ch).set(partial[ch].subarray(0, totalLength));
          }
          record.buffer = out;
          record.state = 'ready';
        } catch (err) {
          logger?.warn?.('warp render failed', err);
          record.buffer = null;
          record.state = 'error';
        }
        const waiters = record.waiters.splice(0);
        waiters.forEach(fn => {
          try { fn(record.buffer); } catch (_) {}
        });
      }

      function step() {
        if (cache.get(clip.id) !== record) return; // superseded
        if (segIndex >= segmentsList.length) {
          const lastSeg = segmentsList[segmentsList.length - 1];
          const totalLength = Math.max(1, Math.ceil(
            (lastSeg.tlEnd - timelineOrigin) * sourceBuffer.sampleRate
          ));
          finalize(totalLength);
          return;
        }
        const seg = segmentsList[segIndex];
        if (!seg) {
          record.state = 'error';
          record.waiters.splice(0).forEach(fn => {
            try { fn(null); } catch (_) {}
          });
          return;
        }
        const tlStart = segmentsList[0].tlStart;
        const tlEnd = segmentsList[segmentsList.length - 1].tlEnd;
        const outLen = Math.max(1, Math.ceil((tlEnd - tlStart) * sourceBuffer.sampleRate));
        if (partial[0] === null) {
          for (let ch = 0; ch < channels.length; ch += 1) {
            partial[ch] = new Float32Array(outLen);
          }
          env = new Float32Array(outLen);
        }
        renderSegmentWSOLA(
          channels, partial, env, sourceBuffer.sampleRate,
          {
            srcStart: seg.srcStart,
            srcEnd: seg.srcEnd,
            outStart: seg.tlStart - timelineOrigin,
            outEnd: seg.tlEnd - timelineOrigin
          },
          outLen, DEFAULT_WINDOW, DEFAULT_SEARCH
        );
        segIndex += 1;
        schedule(step);
      }

      schedule(step);
      return null;
    }

    function invalidate(clipId) {
      cache.delete(clipId);
    }

    return Object.freeze({
      getWarpedBuffer,
      ensureWarpedBuffer,
      isRendering,
      invalidate,
      cacheKeyFor
    });
  }

  const service = Object.freeze({
    create,
    renderWarpedSamples,
    renderSegmentWSOLA,
    hannWindow,
    DEFAULT_WINDOW,
    DEFAULT_SEARCH
  });

  globalScope.WarpAudioRendererService = service;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
