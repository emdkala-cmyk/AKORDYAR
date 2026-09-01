/**
 * FreeWarpEngine — Piecewise-linear time remap for Cubase-style Free Warp.
 *
 * Given a sorted array of warp markers (sourceTime ↔ timelineTime pairs),
 * maps any playback time on the timeline to the corresponding source audio
 * sample position.  No DOM, no DAW state — pure math, testable in Node.
 *
 * Marker invariant: markers must be sorted by timelineTime ascending.
 * At minimum two markers are required (clip start + clip end).
 */
(function attachFreeWarpEngine(globalScope) {
  'use strict';

  /* ---- helpers ---- */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Build a default two-marker set covering [0, duration].
   * clipStart is the timeline position of the clip.
   * sourceOffset shifts the mapped source window for trimmed clips:
   * the clip exposes [offset, offset + duration] of the source buffer.
   */
  function defaultMarkers(clipStart, duration, snapPointOffset, sourceOffset) {
    const sp = Number(snapPointOffset) || 0;
    const src0 = Math.max(0, Number(sourceOffset) || 0);
    return [
      { id: '_start', sourceTime: src0, timelineTime: clipStart, pinned: true },
      { id: '_end',   sourceTime: src0 + duration, timelineTime: clipStart + duration, pinned: true }
    ];
  }

  /**
   * Ensure markers are sorted by timelineTime.
   */
  function sortMarkers(markers) {
    return [...markers].sort((a, b) => a.timelineTime - b.timelineTime);
  }

  /**
   * Given sorted markers and a timeline position T,
   * return the corresponding source time via piecewise linear interpolation.
   *
   *   α = (T - Mk.tl) / (Mk+1.tl - Mk.tl)
   *   src = Mk.src + α * (Mk+1.src - Mk.src)
   *
   * Returns null if T is outside the marker range.
   */
  function timelineToSource(T, markers) {
    if (!markers || markers.length < 2) return null;

    // clamp to marker range
    const first = markers[0];
    const last = markers[markers.length - 1];
    if (T <= first.timelineTime) return first.sourceTime;
    if (T >= last.timelineTime)  return last.sourceTime;

    // find bounding segment
    for (let i = 0; i < markers.length - 1; i += 1) {
      const mk = markers[i];
      const mkNext = markers[i + 1];
      if (T >= mk.timelineTime && T <= mkNext.timelineTime) {
        const tlSpan = mkNext.timelineTime - mk.timelineTime;
        if (tlSpan < 1e-9) return mk.sourceTime;
        const alpha = (T - mk.timelineTime) / tlSpan;
        return mk.sourceTime + alpha * (mkNext.sourceTime - mk.sourceTime);
      }
    }
    return last.sourceTime;
  }

  /**
   * Inverse mapping: given a source time, find the corresponding timeline position.
   */
  function sourceToTimeline(src, markers) {
    if (!markers || markers.length < 2) return null;

    const first = markers[0];
    const last = markers[markers.length - 1];
    if (src <= first.sourceTime) return first.timelineTime;
    if (src >= last.sourceTime)  return last.timelineTime;

    for (let i = 0; i < markers.length - 1; i += 1) {
      const mk = markers[i];
      const mkNext = markers[i + 1];
      if (src >= mk.sourceTime && src <= mkNext.sourceTime) {
        const srcSpan = mkNext.sourceTime - mk.sourceTime;
        if (srcSpan < 1e-9) return mk.timelineTime;
        const alpha = (src - mk.sourceTime) / srcSpan;
        return mk.timelineTime + alpha * (mkNext.timelineTime - mk.timelineTime);
      }
    }
    return last.timelineTime;
  }

  /**
   * Insert a new warp marker at the given source+timeline position.
   * Returns a new sorted marker array (does not mutate input).
   */
  function insertMarker(markers, id, sourceTime, timelineTime, pinned) {
    const merged = [...markers, {
      id,
      sourceTime: Number(sourceTime) || 0,
      timelineTime: Number(timelineTime) || 0,
      pinned: pinned === true
    }];
    return sortMarkers(merged);
  }

  /**
   * Remove a marker by id.  Start/end markers cannot be removed.
   */
  function removeMarker(markers, id) {
    if (id === '_start' || id === '_end') return [...markers];
    return markers.filter(m => m.id !== id);
  }

  /**
   * Move a marker to a new timeline position.
   * If snapToGrid is provided, timelineTime is snapped first.
   * Returns a new sorted marker array.
   */
  function moveMarker(markers, id, newTimelineTime, snapToGrid) {
    let tl = Number(newTimelineTime) || 0;
    if (typeof snapToGrid === 'function') {
      tl = snapToGrid(tl);
    }
    return sortMarkers(
      markers.map(m => m.id === id ? { ...m, timelineTime: tl } : m)
    );
  }

  /**
   * Compute the effective duration on the timeline given markers.
   */
  function effectiveDuration(markers) {
    if (!markers || markers.length < 2) return 0;
    return markers[markers.length - 1].timelineTime - markers[0].timelineTime;
  }

  /**
   * Compute the stretch ratio at a given timeline position.
   * ratio = dSource / dTimeline for the enclosing segment.
   * ratio < 1 means compression, > 1 means stretching.
   */
  function stretchRatioAt(T, markers) {
    for (let i = 0; i < markers.length - 1; i += 1) {
      const mk = markers[i];
      const mkNext = markers[i + 1];
      if (T >= mk.timelineTime && T <= mkNext.timelineTime) {
        const tlSpan = mkNext.timelineTime - mk.timelineTime;
        const srcSpan = mkNext.sourceTime - mk.sourceTime;
        if (tlSpan < 1e-9) return 1;
        return srcSpan / tlSpan;
      }
    }
    return 1;
  }

  /**
   * Apply a warp drag: move marker at dragIndex to newTimelineTime,
   * keeping all other markers fixed.  Returns new marker array.
   */
  function applyWarpDrag(markers, dragIndex, newTimelineTime, snapToGrid) {
    if (dragIndex <= 0 || dragIndex >= markers.length - 1) return markers;
    let tl = Number(newTimelineTime) || 0;
    if (typeof snapToGrid === 'function') {
      tl = snapToGrid(tl);
    }
    // ensure marker stays between neighbors
    const prev = markers[dragIndex - 1].timelineTime + 0.001;
    const next = markers[dragIndex + 1].timelineTime - 0.001;
    tl = clamp(tl, prev, next);
    return sortMarkers(
      markers.map((m, i) => i === dragIndex ? { ...m, timelineTime: tl } : m)
    );
  }

  /**
   * List warp segments with their stretch ratios.
   * ratio = srcSpan / tlSpan  (>1 compression, <1 stretch).
   */
  function segments(markers) {
    if (!markers || markers.length < 2) return [];
    const out = [];
    for (let i = 0; i < markers.length - 1; i += 1) {
      const a = markers[i];
      const b = markers[i + 1];
      const tlSpan = b.timelineTime - a.timelineTime;
      const srcSpan = b.sourceTime - a.sourceTime;
      out.push({
        index: i,
        srcStart: a.sourceTime,
        srcEnd: b.sourceTime,
        tlStart: a.timelineTime,
        tlEnd: b.timelineTime,
        ratio: tlSpan > 1e-9 ? srcSpan / tlSpan : 1
      });
    }
    return out;
  }

  /**
   * Compact fingerprint of a marker set for cache keys.
   * Markers are rounded to 1ms so float jitter does not thrash caches.
   */
  function markersKey(markers) {
    if (!markers || !markers.length) return 'none';
    return markers
      .map(m => `${m.id}:${Math.round(m.sourceTime * 1000)}:${Math.round(m.timelineTime * 1000)}`)
      .join('|');
  }

  /**
   * Does this marker set actually warp (any segment ratio != 1)?
   */
  function isWarped(markers) {
    if (!markers || markers.length < 2) return false;
    return segments(markers).some(seg => Math.abs(seg.ratio - 1) > 1e-4);
  }

  /**
   * Resample a full-source peaks array through the warp mapping so the
   * drawn waveform reflects the stretched/compressed timeline layout.
   * Output bucket i covers timeline position tl at fraction i/buckets of
   * [tlStart, tlEnd]; its value is the source peak at timelineToSource(tl).
   */
  function resamplePeaksThroughWarp(peaks, sourceDuration, markers, buckets) {
    if (!markers || markers.length < 2 || !peaks || !peaks.length) return peaks;
    const n = Math.max(2, Math.floor(buckets) || 2);
    const out = new Float32Array(n);
    const tlStart = markers[0].timelineTime;
    const tlEnd = markers[markers.length - 1].timelineTime;
    const tlSpan = tlEnd - tlStart;
    const dur = Math.max(1e-9, Number(sourceDuration) || 1e-9);
    for (let i = 0; i < n; i += 1) {
      const t = tlSpan > 1e-9 ? tlStart + (i / (n - 1)) * tlSpan : tlStart;
      const src = timelineToSource(t, markers);
      const idx = clamp(Math.floor((src / dur) * peaks.length), 0, peaks.length - 1);
      out[i] = peaks[idx] || 0;
    }
    return out;
  }

  const engine = Object.freeze({
    defaultMarkers,
    sortMarkers,
    timelineToSource,
    sourceToTimeline,
    insertMarker,
    removeMarker,
    moveMarker,
    effectiveDuration,
    stretchRatioAt,
    applyWarpDrag,
    segments,
    markersKey,
    isWarped,
    resamplePeaksThroughWarp,
    clamp
  });

  globalScope.FreeWarpEngine = engine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
