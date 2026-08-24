/**
 * ArrangerMarkerService
 *
 * Normalizes the independent per-song arranger A/B markers. Marker use is
 * opt-in through `enabled`; editor loop points are never migrated into
 * arranger points automatically.
 */
(function attachArrangerMarkerService(globalScope) {
  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalize(markers = null) {
    const source = markers && typeof markers === 'object' ? markers : null;
    return {
      enabled: source?.enabled === true,
      start: Math.max(
        0,
        finiteNumber(source?.start, 0)
      ),
      end: Math.max(
        0,
        finiteNumber(source?.end, 0)
      )
    };
  }

  function fromSong(song) {
    return normalize(song?._arrangerMarkers);
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
