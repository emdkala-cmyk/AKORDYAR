/**
 * ArchiveSearchService
 *
 * Caches searchable text by song id and provides a small, deterministic
 * query/filter boundary for ArchiveModule.
 */
(function attachArchiveSearchService(globalScope) {
  function create(context = {}) {
    const {
      normalizeText = value => String(value || '').trim().toLowerCase(),
      extractSearchText = song => normalizeText(song?.title || ''),
      getSongId = song => String(song?.id ?? '')
    } = context;
    const searchIndex = new Map();

    function cacheKey(song) {
      const id = getSongId(song);
      return id || song;
    }

    function clear() {
      searchIndex.clear();
    }

    function getSearchText(song) {
      const key = cacheKey(song);
      if (searchIndex.has(key)) return searchIndex.get(key);
      const text = extractSearchText(song);
      searchIndex.set(key, text);
      return text;
    }

    function query(value) {
      return normalizeText(value);
    }

    function matches(song, value) {
      const normalizedQuery = query(value);
      return !normalizedQuery || getSearchText(song).includes(normalizedQuery);
    }

    function filter(songs, value) {
      return songs.filter(song => matches(song, value));
    }

    return Object.freeze({
      clear,
      getSearchText,
      query,
      matches,
      filter
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveSearchService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
