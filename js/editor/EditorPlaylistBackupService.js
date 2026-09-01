/**
 * EditorPlaylistBackupService
 *
 * Owns the full arranger backup commands. File access, validation and
 * persistence are injected so editor.js only exposes the command bridge.
 */
(function attachEditorPlaylistBackupService(globalScope) {
  'use strict';

  const BACKUP_FORMAT = 'achord-playlists-backup';
  const SUPPORTED_VERSIONS = Object.freeze([1, '1.0', 2, '2.0']);

  function normalizePlaylistName(name) {
    return String(name || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('fa-IR');
  }

  function errorMessage(error) {
    return error?.message || String(error);
  }

  function playlistItems(items) {
    return Array.isArray(items)
      ? items.map(item => (
        typeof item === 'string' ? item : item?.songId
      ))
      : [];
  }

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    getArrangers = () => [],
    getEditingArr = () => null,
    getAllSongs = () => [],
    setAllSongs = () => {},
    saveArrangers = () => {},
    renderArrangerManager = () => {},
    toast = () => {},
    logger = console,
    now = () => Date.now(),
    isoNow = () => new Date().toISOString(),
    random = () => Math.random(),
    blobRef = globalScope.Blob,
    urlRef = windowRef?.URL || globalScope.URL
  } = {}) {
    function getFileName() {
      return (
        `achord-playlists-backup-${isoNow().slice(0, 10)}.json`
      );
    }

    function buildBackupData(arrangers) {
      const timestamp = isoNow();
      return {
        format: BACKUP_FORMAT,
        version: 1,
        exportType: 'all',
        exportedAt: timestamp,
        activePlaylistId: getEditingArr()?.id || null,
        settings: { repeatMode: 'none' },
        playlists: arrangers.map(arranger => ({
          id: arranger.id,
          name: arranger.name || 'پلی‌لیست',
          createdAt: arranger.createdAt || timestamp,
          updatedAt: arranger.updatedAt || timestamp,
          items: playlistItems(arranger.items),
          crossfade: arranger.crossfade || 0,
          pauseBetween: !!arranger.pauseBetween,
          _itemSettings: arranger._itemSettings || {}
        }))
      };
    }

    async function writeWithPicker(json, fileName) {
      const handle = await windowRef.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'JSON Playlists Backup',
          accept: { 'application/json': ['.json'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
    }

    function download(json, fileName) {
      const blob = new blobRef([json], { type: 'application/json' });
      const url = urlRef.createObjectURL(blob);
      const anchor = documentRef.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      urlRef.revokeObjectURL(url);
    }

    async function exportAllPlaylistsToFile() {
      const arrangers = getArrangers?.() || [];
      if (arrangers.length === 0) {
        toast('⚠ هیچ پلی‌لیستی برای خروجی وجود ندارد');
        return { success: false, reason: 'empty' };
      }

      const fileName = getFileName();
      const json = JSON.stringify(buildBackupData(arrangers), null, 2);

      if (typeof windowRef?.showSaveFilePicker === 'function') {
        try {
          await writeWithPicker(json, fileName);
          toast(`✅ خروجی کامل گرفته شد: ${fileName}`);
          return { success: true, fileName, method: 'picker' };
        } catch (error) {
          if (error?.name === 'AbortError') {
            return { success: false, reason: 'aborted' };
          }
          toast('خطا در خروجی: ' + errorMessage(error));
          return { success: false, reason: 'write-failed', error };
        }
      }

      download(json, fileName);
      toast(`✅ خروجی کامل گرفته شد: ${fileName}`);
      return { success: true, fileName, method: 'download' };
    }

    function createInput() {
      const input = documentRef.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      return input;
    }

    function validateBackup(data) {
      if (
        !data ||
        data.format !== BACKUP_FORMAT ||
        !Array.isArray(data.playlists)
      ) {
        return '❌ فایل معتبر نیست — فرمت پشتیبان پلی‌لیست نیست';
      }

      if (
        data.version &&
        !SUPPORTED_VERSIONS.includes(data.version)
      ) {
        return `❌ نسخه فایل (${data.version}) پشتیبانی نمی‌شود.`;
      }

      for (let index = 0; index < data.playlists.length; index++) {
        const playlist = data.playlists[index];
        if (!playlist || !playlist.name || !playlist.name.trim()) {
          return `❌ پلی‌لیست شماره ${index + 1} نام معتبر ندارد.`;
        }
        if (!Array.isArray(playlist.items)) {
          return `❌ پلی‌لیست «${playlist.name}» آرایه items معتبر ندارد.`;
        }
      }

      return null;
    }

    function findDuplicateNames(playlists, arrangers) {
      const existingNames = new Set(
        arrangers.map(arranger => normalizePlaylistName(arranger.name))
      );
      const importedNames = new Set();
      const duplicateNames = [];

      playlists.forEach(playlist => {
        const normalizedName = normalizePlaylistName(playlist.name);
        if (importedNames.has(normalizedName)) {
          duplicateNames.push(playlist.name);
        } else {
          importedNames.add(normalizedName);
        }
        if (
          existingNames.has(normalizedName) &&
          !duplicateNames.includes(playlist.name)
        ) {
          duplicateNames.push(playlist.name);
        }
      });

      return duplicateNames;
    }

    function importSongs(data) {
      if (!data.songs || typeof data.songs !== 'object') return 0;

      const allSongs = getAllSongs?.() || [];
      let importedSongsCount = 0;
      for (const [id, song] of Object.entries(data.songs)) {
        if (
          song &&
          song.title &&
          !allSongs.find(existing => existing.id === id)
        ) {
          allSongs.push(song);
          importedSongsCount++;
        }
      }

      if (importedSongsCount > 0) {
        setAllSongs(allSongs);
        logger?.log?.(
          `[Import All] ${importedSongsCount} song(s) imported`
        );
      }
      return importedSongsCount;
    }

    function createImportedPlaylists(playlists) {
      return playlists.map(playlist => {
        const timestamp = isoNow();
        return {
          id: `playlist_${now()}_${random().toString(36).slice(2, 8)}`,
          name: playlist.name,
          items: playlistItems(playlist.items),
          crossfade: playlist.crossfade || 0,
          pauseBetween: !!playlist.pauseBetween,
          _itemSettings: playlist._itemSettings || {},
          createdAt: timestamp,
          updatedAt: timestamp
        };
      });
    }

    async function importFile(file) {
      if (!file) return { success: false, reason: 'missing-file' };

      try {
        const data = JSON.parse(await file.text());
        const validationError = validateBackup(data);
        if (validationError) {
          toast(validationError);
          return { success: false, reason: 'invalid-backup' };
        }

        const arrangers = getArrangers?.() || [];
        const duplicateNames = findDuplicateNames(
          data.playlists,
          arrangers
        );
        if (duplicateNames.length > 0) {
          toast(
            'ورود کامل انجام نشد. پلی‌لیست‌های زیر دارای نام تکراری هستند:\n' +
            `«${duplicateNames.join('»، «')}»`
          );
          return { success: false, reason: 'duplicate-names' };
        }

        const importedSongsCount = importSongs(data);
        const newPlaylists = createImportedPlaylists(data.playlists);
        arrangers.unshift(...newPlaylists);
        saveArrangers();
        renderArrangerManager();

        toast(
          `✅ ${newPlaylists.length} پلی‌لیست وارد شد` +
          `${importedSongsCount > 0
            ? `، ${importedSongsCount} آهنگ جدید`
            : ''}`
        );
        return {
          success: true,
          playlists: newPlaylists,
          importedSongsCount
        };
      } catch (error) {
        logger?.error?.('[Import All] Error:', error);
        toast('❌ خطا در بارگذاری فایل: ' + errorMessage(error));
        return { success: false, reason: 'read-failed', error };
      }
    }

    function importAllPlaylistsFromFile() {
      const input = createInput();
      input.onchange = event => importFile(event?.target?.files?.[0]);
      input.click();
      return input;
    }

    return Object.freeze({
      exportAllPlaylistsToFile,
      importAllPlaylistsFromFile,
      importFile,
      normalizePlaylistName
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorPlaylistBackupService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
