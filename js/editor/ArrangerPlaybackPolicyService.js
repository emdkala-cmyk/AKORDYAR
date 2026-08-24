/**
 * ArrangerPlaybackPolicyService
 *
 * Arranger playback is a continuous setlist flow. A song's personal loop
 * markers are useful in the editor, but must not stop or wrap setlist
 * playback. This service keeps that policy pure and testable.
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
    fallbackEnd = 0
  } = {}) {
    const contentEnd = getTimelineEnd({ clips, sections });
    const fallback = Math.max(0, finiteNumber(fallbackEnd));
    return Object.freeze({
      end: contentEnd > 0 ? contentEnd : fallback,
      selectionEnd: 0,
      loopState: Object.freeze({
        loopEnabled: false,
        loopA: 0,
        loopB: 10
      })
    });
  }

  function applyToDAW(daw) {
    if (!daw || typeof daw !== 'object') return false;
    daw.loopEnabled = false;
    daw.loopA = 0;
    daw.loopB = 10;
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
