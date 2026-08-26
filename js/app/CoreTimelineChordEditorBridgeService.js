/**
 * CoreTimelineChordEditorBridgeService
 *
 * Guards timeline chord-editor openings and keeps the short duplicate-open
 * debounce independent from clip interaction and rendering services.
 */
(function attachCoreTimelineChordEditorBridgeService(globalScope) {
  'use strict';

  function create({
    getClip = () => null,
    openChordEditor = () => {},
    now = () => Date.now(),
    debounceMs = 120
  } = {}) {
    function openTimelineChordEditor(clipId) {
      const clip = getClip?.(clipId);
      if (
        !clip ||
        clip.type !== 'chord' ||
        typeof openChordEditor !== 'function'
      ) {
        return;
      }
      const timestamp = now?.();
      if (
        clip._lastModalOpenAt &&
        timestamp - clip._lastModalOpenAt < debounceMs
      ) {
        return;
      }
      clip._lastModalOpenAt = timestamp;
      openChordEditor(clipId);
    }

    return Object.freeze({ openTimelineChordEditor });
  }

  const service = Object.freeze({ create });
  globalScope.CoreTimelineChordEditorBridgeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
