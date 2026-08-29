/**
 * ArchiveMigrationService
 *
 * Owns archive record identity generation and schema-default migration.
 * It mutates the supplied song array exactly as the legacy path did, then
 * asks the injected persistence callback to save only when a change occurred.
 */
(function attachArchiveMigrationService(globalScope) {
  const FEEL_6_8_LABEL = '2/4 (حس 6/8)';
  const FEEL_6_8_ID = '2/4-feel-6/8';

  function migrateTimeSignature(song) {
    const raw = String(song.timeSignature || '').trim();
    const preset = String(song.timeSignaturePreset || '').trim();
    if (
      raw === FEEL_6_8_LABEL ||
      raw === FEEL_6_8_ID ||
      preset === FEEL_6_8_LABEL ||
      preset === FEEL_6_8_ID
    ) {
      const changed =
        song.timeSignature !== '2/4' ||
        song.timeSignaturePreset !== FEEL_6_8_ID;
      song.timeSignature = '2/4';
      song.timeSignaturePreset = FEEL_6_8_ID;
      return changed;
    }
    return false;
  }

  function generateId(cryptoRef = globalScope.crypto) {
    if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
    return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 10);
  }

  function create(options = {}) {
    const schemaVersion = options.schemaVersion ?? 1;
    const cryptoRef = options.cryptoRef || globalScope.crypto;
    const setSongs = typeof options.setSongs === 'function'
      ? options.setSongs
      : () => {};
    const now = typeof options.now === 'function'
      ? options.now
      : () => new Date().toISOString();

    function createId() {
      return generateId(cryptoRef);
    }

    function migrate(songs) {
      let changed = false;
      const seen = new Set();
      for (const song of songs) {
        if (migrateTimeSignature(song)) changed = true;
        if (!song.id || seen.has(song.id)) {
          song.id = createId();
          changed = true;
        }
        seen.add(String(song.id));
        const defaults = {
          schemaVersion,
          deletedAt: null,
          favorite: false,
          categories: [],
          tags: []
        };
        for (const [key, value] of Object.entries(defaults)) {
          if (song[key] === undefined) {
            song[key] = value;
            changed = true;
          }
        }
        if (!song.createdAt) {
          song.createdAt = song.updatedAt || now();
          changed = true;
        }
        if (!song.updatedAt) {
          song.updatedAt = now();
          changed = true;
        }
        if (song.lastOpenedAt === undefined) {
          song.lastOpenedAt = null;
          changed = true;
        }
        if (song.importedAt === undefined) {
          song.importedAt = null;
          changed = true;
        }
        if (song.sourceFileName === undefined) {
          song.sourceFileName = '';
          changed = true;
        }
        if (song.status === undefined) {
          song.status = 'active';
          changed = true;
        }
        if (song.id !== undefined) song.id = String(song.id);
      }
      if (changed) setSongs(songs);
      return songs;
    }

    return Object.freeze({
      generateId: createId,
      migrate
    });
  }

  const service = Object.freeze({ create, generateId });
  globalScope.ArchiveMigrationService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
