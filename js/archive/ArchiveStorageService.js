/**
 * ArchiveStorageService
 *
 * Owns the archive song persistence boundary: IndexedDB, the in-memory cache,
 * and the localStorage fallback. The public edGetAllSongs/edSetAllSongs
 * wrappers remain in ArchiveModule for legacy callers.
 */
(function attachArchiveStorageService(globalScope) {
  const DB_NAME = 'ChordSongDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'songs';
  const FALLBACK_KEY = 'ed_songs_archive';

  function readFallback(storage) {
    try {
      const value = JSON.parse(storage?.getItem(FALLBACK_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function writeFallback(storage, songs, onQuota) {
    try {
      storage?.setItem(FALLBACK_KEY, JSON.stringify(songs));
    } catch (error) {
      if (error?.name === 'QuotaExceededError') {
        onQuota?.('❌ حافظه مرورگر پر است!');
      }
    }
  }

  function create(options = {}) {
    const scope = options.globalScope || globalScope;
    const storage = options.storage || scope.localStorage;
    const indexedDBRef = options.indexedDB || scope.indexedDB;
    const notify = typeof options.onQuota === 'function'
      ? options.onQuota
      : options.toast;

    let cache = null;
    let database = null;

    const getFallbackSongs = () => {
      if (cache) return cache;
      cache = readFallback(storage);
      return cache;
    };

    const openRequest = indexedDBRef?.open?.(DB_NAME, DB_VERSION);
    if (!openRequest) {
      cache = readFallback(storage);
    } else {
      openRequest.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      openRequest.onsuccess = event => {
        database = event.target.result;
        scope._archDB = database;

        const readTransaction = database.transaction(STORE_NAME, 'readonly');
        const request = readTransaction.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => {
          cache = request.result || [];
        };
        request.onerror = () => {
          cache = [];
        };

        try {
          const oldSongs = readFallback(storage);
          if (oldSongs.length) {
            const migrationTransaction = database.transaction(STORE_NAME, 'readwrite');
            oldSongs.forEach(song => {
              migrationTransaction.objectStore(STORE_NAME).put(song);
            });
            migrationTransaction.oncomplete = () => {
              try {
                storage?.removeItem(FALLBACK_KEY);
              } catch (_) {}
              console.log(`Migrated ${oldSongs.length} songs to IndexedDB`);
            };
          }
        } catch (_) {}
      };

      openRequest.onerror = () => {
        cache = readFallback(storage);
      };
    }

    function getAllSongs() {
      return cache || getFallbackSongs();
    }

    function setAllSongs(songs) {
      cache = Array.isArray(songs) ? songs : [];
      if (!database) {
        writeFallback(storage, cache, notify);
        return cache;
      }

      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      cache.forEach(song => store.put(song));
      return cache;
    }

    return Object.freeze({
      getAllSongs,
      setAllSongs,
      getDatabase: () => database
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveStorageService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
