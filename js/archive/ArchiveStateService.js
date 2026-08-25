/**
 * ArchiveStateService
 *
 * Keeps mutable archive UI/session state in one explicit object. Persistence
 * and rendering remain outside this service.
 */
(function attachArchiveStateService(globalScope) {
  function create(context = {}) {
    const { storage = globalScope.localStorage } = context;

    function read(key, fallback) {
      try {
        const value = storage?.getItem(key);
        return value === null || value === undefined ? fallback : value;
      } catch (_) {
        return fallback;
      }
    }

    const state = {
      ctxSongId: null,
      selectMode: false,
      selectedIds: new Set(),
      currentTab: 'all',
      viewMode: read('arch_view_mode', 'card'),
      editSongId: null,
      loading: false,
      artistCache: null,
      artistFilter: null,
      artistSectionCollapsed: read('arch_artists_collapsed', 'false') === 'true',
      fullscreen: false
    };

    function clearSelection() {
      state.selectedIds.clear();
      state.selectMode = false;
    }

    function resetCaches() {
      state.artistCache = null;
      state.artistFilter = null;
    }

    return Object.freeze({
      state,
      clearSelection,
      resetCaches
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveStateService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
