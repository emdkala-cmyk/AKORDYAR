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
   */
  function defaultMarkers(clipStart, duration, snapPointOffset) {
    const sp = Number(snapPointOffset) || 0;
    return [
      { id: '_start', sourceTime: 0, timelineTime: clipStart, pinned: true },
      { id: '_end',   sourceTime: duration, timelineTime: clipStart + duration, pinned: true }
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
    clamp
  });

  globalScope.FreeWarpEngine = engine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
