/**
 * TimelineViewportService — pure viewport math for playhead following.
 *
 * It does not read the DOM. The timeline adapter supplies the current scroll
 * position, viewport width and playhead pixel position.
 */
(function attachTimelineViewportService(globalScope) {
  'use strict';

  function toFinite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function getScrollLeftForPlayhead({
    playheadX,
    scrollLeft = 0,
    viewportWidth = 0,
    mode = 'page',
    margin = 60,
    maxScrollLeft = Number.POSITIVE_INFINITY
  } = {}) {
    const x = Math.max(0, toFinite(playheadX));
    const current = Math.max(0, toFinite(scrollLeft));
    const width = Math.max(0, toFinite(viewportWidth));
    const edgeMargin = Math.max(0, toFinite(margin, 60));
    const maximum = Math.max(0, toFinite(maxScrollLeft, Number.POSITIVE_INFINITY));

    let next = current;
    if (mode === 'center' && width > 0) {
      next = x - width / 2;
    } else if (x < current + edgeMargin) {
      next = x - edgeMargin;
    } else if (x > current + width - edgeMargin) {
      next = x - edgeMargin;
    }

    return Math.max(0, Math.min(maximum, next));
  }

  globalScope.TimelineViewportService = Object.freeze({
    getScrollLeftForPlayhead
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.TimelineViewportService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
