/**
 * ArrangerMarkerService
 *
 * Normalizes the independent per-song arranger A/B markers. Legacy songs
 * without `_arrangerMarkers` are migrated from `_dawLoop` only at load time;
 * new saves always use the separate arranger field.
 */
(function attachArrangerMarkerService(globalScope) {
  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalize(markers = null, legacyLoopState = null) {
    const source = markers && typeof markers === 'object'
      ? markers
      : legacyLoopState;
    return {
      start: Math.max(
        0,
        finiteNumber(source?.start, finiteNumber(source?.loopA, 0))
      ),
      end: Math.max(
        0,
        finiteNumber(source?.end, finiteNumber(source?.loopB, 0))
      )
    };
  }

  function fromSong(song) {
    return normalize(song?._arrangerMarkers, song?._dawLoop);
  }

  function fromDAW(daw) {
    return normalize(daw?.arrangerMarkers);
  }

  const service = Object.freeze({
    normalize,
    fromSong,
    fromDAW
  });

  globalScope.ArrangerMarkerService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
