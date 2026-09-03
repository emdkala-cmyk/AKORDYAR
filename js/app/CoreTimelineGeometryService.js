/**
 * CoreTimelineGeometryService
 *
 * Owns the shared time/pixel geometry used by timeline rendering and pointer
 * interactions. Zoom controls remain in editor.js; this module only provides
 * their stable geometry primitives.
 */
(function attachCoreTimelineGeometryService(globalScope) {
  'use strict';

  function create({
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || {},
    getTimelineInner = () =>
      globalScope.document?.getElementById?.('tl-inner'),
    clamp = (value, minimum, maximum) =>
      Math.max(minimum, Math.min(maximum, value)),
    getTimingContext = () => ({}),
    meter = globalScope.Meter,
    tempoMap = globalScope.TempoMap,
    syncTimelineViewportToPlayhead = () => {}
  } = {}) {
    function pixelsPerSecond() {
      return Number(getDAW()?.pxPerSecond) || 1;
    }

    function timeToX(time) {
      return time * pixelsPerSecond();
    }

    function xToTime(x) {
      return x / pixelsPerSecond();
    }

    function timeToBarBeat(seconds) {
      const timing = getTimingContext() || {};
      const map = tempoMap?.create && (
        timing.tempoMap || getDAW()?.tempoMap
      )
        ? tempoMap.create({
            tempo: timing.tempo,
            timeSignature: timing.timeSignature,
            tempoMap: timing.tempoMap || getDAW()?.tempoMap
          })
        : null;
      if (map?.timeToBarBeat) return map.timeToBarBeat(seconds);
      return meter?.timeToBarBeat?.(
        seconds,
        timing.timeSignature,
        timing.tempo
      );
    }

    function barBeatToTime(bar, beat) {
      const timing = getTimingContext() || {};
      const map = tempoMap?.create && (
        timing.tempoMap || getDAW()?.tempoMap
      )
        ? tempoMap.create({
            tempo: timing.tempo,
            timeSignature: timing.timeSignature,
            tempoMap: timing.tempoMap || getDAW()?.tempoMap
          })
        : null;
      if (map?.barBeatToTime) return map.barBeatToTime(bar, beat);
      return meter?.barBeatToTime?.(
        bar,
        beat,
        timing.timeSignature,
        timing.tempo
      );
    }

    function getProjectEnd() {
      const daw = getDAW() || {};
      let end = 30;
      for (const clip of daw.clips || []) {
        end = Math.max(end, clip.start + clip.duration);
      }
      for (const section of daw.sections || []) {
        end = Math.max(end, section.start + section.duration);
      }
      return Math.max(Number(daw.timelineDuration) || 0, end + 8);
    }

    function ensureTimelineFits(needed) {
      const daw = getDAW() || {};
      if (needed > daw.timelineDuration) daw.timelineDuration = needed;
      return daw.timelineDuration;
    }

    function getInnerRect() {
      return getTimelineInner()?.getBoundingClientRect?.() || null;
    }

    function clientToTime(clientX) {
      const inner = getInnerRect();
      if (!inner) return 0;
      return clamp(
        xToTime(clientX - inner.left),
        0,
        getProjectEnd()
      );
    }

    function clientToInnerPoint(clientX, clientY) {
      const inner = getInnerRect();
      if (!inner) return { x: clientX, y: clientY };
      return {
        x: clientX - inner.left,
        y: clientY - inner.top
      };
    }

    function autoScrollToPlayhead() {
      return syncTimelineViewportToPlayhead();
    }

    return Object.freeze({
      timeToX,
      xToTime,
      timeToBarBeat,
      barBeatToTime,
      getProjectEnd,
      ensureTimelineFits,
      clientToTime,
      clientToInnerPoint,
      autoScrollToPlayhead
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreTimelineGeometryService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
