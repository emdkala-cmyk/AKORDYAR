/**
 * ArchiveCurrentSongService
 *
 * Provides the archive-facing boundary for the current editor song, DAW
 * state, performance serialization reset and arranger markers.
 */
(function attachArchiveCurrentSongService(globalScope) {
  function create(context = {}) {
    const {
      runtimeAdapter = globalScope.ArchiveRuntimeAdapter,
      getArrangerMarkerService = () => globalScope.ArrangerMarkerService
    } = context;

    function getAdapter() {
      if (!runtimeAdapter) {
        throw new Error(
          'ArchiveRuntimeAdapter is not loaded. Check Akordyar.html script order.'
        );
      }
      return runtimeAdapter;
    }

    function getSong() {
      const adapter = getAdapter();
      if (typeof adapter.getSongOrThrow === 'function') {
        return adapter.getSongOrThrow();
      }
      const song = adapter.getSong?.();
      if (!song) throw new Error('ArchiveRuntimeAdapter: editor song is unavailable');
      return song;
    }

    function getSongOrNull() {
      return getAdapter().getSong?.() || null;
    }

    function resetPerformanceSerialization() {
      getAdapter().resetPerformanceSerialization?.();
    }

    function getDAW() {
      const adapter = getAdapter();
      if (typeof adapter.getDAWOrThrow === 'function') {
        return adapter.getDAWOrThrow();
      }
      const daw = adapter.getDAW?.();
      if (!daw) throw new Error('ArchiveRuntimeAdapter: DAW is unavailable');
      return daw;
    }

    function getArrangerMarkers(song) {
      return getArrangerMarkerService()?.fromSong?.(song) || {
        enabled: song?._arrangerMarkers?.enabled === true,
        start: Math.max(0, Number(song?._arrangerMarkers?.start) || 0),
        end: Math.max(0, Number(song?._arrangerMarkers?.end) || 0)
      };
    }

    return Object.freeze({
      getSong,
      getSongOrNull,
      resetPerformanceSerialization,
      getDAW,
      getArrangerMarkers
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveCurrentSongService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
