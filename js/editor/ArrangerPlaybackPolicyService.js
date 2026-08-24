/**
 * ArrangerPlaybackPolicyService
 *
 * Arranger playback uses opt-in independent A/B markers as a bounded segment:
 * A is the start position and B is the transition position. When markers are
 * disabled, the full song timeline is used. Editor looping remains separate.
 */
(function attachArrangerPlaybackPolicyService(globalScope) {
  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getTimelineEnd({ clips = [], sections = [] } = {}) {
    let end = 0;
    [
      ...(Array.isArray(clips) ? clips : []),
      ...(Array.isArray(sections) ? sections : [])
    ].forEach(item => {
      const start = Math.max(0, finiteNumber(item?.start));
      const duration = Math.max(0, finiteNumber(item?.duration));
      end = Math.max(end, start + duration);
    });
    return end;
  }

  function createBoundary({
    clips = [],
    sections = [],
    arrangerMarkers = null,
    legacyLoopState = null,
    fallbackEnd = 0
  } = {}) {
    const contentEnd = getTimelineEnd({ clips, sections });
    const fallback = Math.max(0, finiteNumber(fallbackEnd));
    const timelineEnd = contentEnd > 0 ? contentEnd : fallback;
    // `legacyLoopState` is intentionally ignored. Editor loop points must not
    // become arranger A/B points unless the user explicitly enables them.
    const markerSource = arrangerMarkers &&
      typeof arrangerMarkers === 'object' &&
      arrangerMarkers.enabled === true
      ? arrangerMarkers
      : null;
    const configuredStart = Math.max(
      0,
      finiteNumber(
        markerSource?.start,
        0
      )
    );
    const configuredEnd = finiteNumber(
      markerSource?.end,
      0
    );
    const hasConfiguredRange = configuredEnd > configuredStart;

    let start = hasConfiguredRange ? configuredStart : 0;
    let end = hasConfiguredRange ? configuredEnd : timelineEnd;

    // Never create an unreachable boundary when a legacy/default B is longer
    // than the actual song timeline.
    if (timelineEnd > 0) {
      if (start >= timelineEnd) {
        start = 0;
        end = timelineEnd;
      } else {
        end = Math.min(end, timelineEnd);
        if (end <= start) end = timelineEnd;
      }
    }

    if (end <= start) end = start + 10;

    return Object.freeze({
      start,
      end,
      selectionEnd: end,
      markers: Object.freeze({
        start,
        end
      })
    });
  }

  function applyToDAW(daw) {
    if (!daw || typeof daw !== 'object') return false;
    // Do not overwrite loopA/loopB: they belong to the editor loop system.
    // The arranger boundary is stored in daw.arrangerMarkers instead.
    daw.loopEnabled = false;
    return true;
  }

  const service = Object.freeze({
    getTimelineEnd,
    createBoundary,
    applyToDAW
  });

  globalScope.ArrangerPlaybackPolicyService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
