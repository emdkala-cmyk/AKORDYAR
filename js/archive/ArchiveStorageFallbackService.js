/**
 * ArchiveStorageFallbackService
 *
 * Small, synchronous localStorage boundary used when IndexedDB is not ready
 * or unavailable. It deliberately knows nothing about IndexedDB or archive UI.
 */
(function attachArchiveStorageFallbackService(globalScope) {
  const FALLBACK_KEY = 'ed_songs_archive';

  function read(storage) {
    try {
      const value = JSON.parse(storage?.getItem(FALLBACK_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function write(storage, songs, onQuota) {
    try {
      storage?.setItem(FALLBACK_KEY, JSON.stringify(songs));
    } catch (error) {
      if (error?.name === 'QuotaExceededError') {
        onQuota?.('❌ حافظه مرورگر پر است!');
      }
    }
  }

  const service = Object.freeze({ FALLBACK_KEY, read, write });
  globalScope.ArchiveStorageFallbackService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
