/**
 * ArchiveTransferService
 *
 * Owns full-archive import and song/archive export flows. Browser dialogs,
 * storage, confirmation and rendering are injected to keep the legacy
 * ArchiveModule globals stable.
 */
(function attachArchiveTransferService(globalScope) {
  function cloneWithoutAudio(song) {
    const data = JSON.parse(JSON.stringify(song));
    delete data._audioPaths;
    delete data._audioBlobs;
    return data;
  }

  function create(context = {}) {
    const {
      documentRef = globalScope.document,
      BlobCtor = globalScope.Blob,
      URLRef = globalScope.URL,
      showSaveFilePicker = globalScope.showSaveFilePicker?.bind(globalScope),
      showDirectoryPicker = globalScope.showDirectoryPicker?.bind(globalScope),
      getAllSongs,
      getSelectedIds = () => new Set(),
      setAllSongs,
      prepareSong,
      normalizeSong,
      confirmImport,
      resetSearchCache,
      renderArchive,
      renderArtists,
      toast,
      now = () => new Date(),
      t = globalScope.t || (k => k)
    } = context;

    function dateStamp() {
      return new Date(now()).toISOString().slice(0, 10);
    }

    function safeFilename(title) {
      return (title || 'song').replace(/[\/\\?%*:|"<>]/g, '_') + '.json';
    }

    function downloadJson(data, filename, message) {
      const blob = new BlobCtor([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      const url = URLRef.createObjectURL(blob);
      const anchor = documentRef.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URLRef.revokeObjectURL(url);
      if (message) toast?.(message);
      return { blob, url, filename };
    }

    async function mergeImportedSongs(imported) {
      const existing = getAllSongs();
      let added = 0;
      let updated = 0;
      for (const song of imported) {
        if (!song || typeof song !== 'object') continue;
        prepareSong?.(song);
        const duplicate =
          existing.find(item => String(item.id) === String(song.id)) ||
          existing.find(item => item.artist === song.artist && item.title === song.title && item.title);
        if (duplicate) {
          Object.assign(duplicate, normalizeSong(song, ''));
          duplicate.updatedAt = new Date(now()).toISOString();
          updated++;
        } else {
          existing.unshift(normalizeSong(song, ''));
          added++;
        }
      }
      setAllSongs(existing);
      resetSearchCache?.();
      renderArchive?.();
      renderArtists?.();
      toast?.(added + ' اضافه شد، ' + updated + ' به‌روزرسانی');
      return { added, updated };
    }

    async function processFullArchive(file) {
      try {
        const text = await file.text();
        let imported;
        try {
          imported = JSON.parse(text);
        } catch (_) {
          toast?.('فرمت JSON نامعتبر');
          return { added: 0, updated: 0, cancelled: false };
        }
        if (!Array.isArray(imported)) {
          imported = imported.songs || imported.archive || [imported];
        }
        if (!Array.isArray(imported)) {
          toast?.('ساختار فایل آرشیو نامعتبر');
          return { added: 0, updated: 0, cancelled: false };
        }
        const ok = await confirmImport(imported.length);
        if (!ok) return { added: 0, updated: 0, cancelled: true };
        return mergeImportedSongs(imported);
      } catch (error) {
        toast?.('خطا در خواندن فایل: ' + error.message);
        return { added: 0, updated: 0, cancelled: false, error };
      }
    }

    function openFullArchivePicker() {
      const input = documentRef.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = event => {
        const file = event.target.files[0];
        if (file) processFullArchive(file).catch(() => {});
      };
      input.click();
      return input;
    }

    function importFullArchive(file) {
      return file ? processFullArchive(file) : openFullArchivePicker();
    }

    function exportSong(id) {
      const song = getAllSongs().find(item => item.id === id);
      if (!song) return null;
      return downloadJson(
        cloneWithoutAudio(song),
        safeFilename(song.title)
      );
    }

    function exportAll() {
      const songs = getAllSongs().filter(song => !song.deletedAt);
      if (!songs.length) {
        toast?.(t('archiveEmpty'));
        return null;
      }
      const data = songs.map(cloneWithoutAudio);
      const filename = 'archive_all_' + dateStamp() + '.json';
      const serialized = JSON.stringify(data, null, 2);
      if (typeof showSaveFilePicker === 'function') {
        return showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        }).then(async handle => {
          try {
            const writer = await handle.createWritable();
            await writer.write(serialized);
            await writer.close();
            toast?.(songs.length + ' ترانه ذخیره شد');
          } catch (error) {
            if (error.name !== 'AbortError') toast?.('خطا: ' + error.message);
          }
        }).catch(() => {});
      }
      return downloadJson(data, filename, songs.length + ' ترانه دانلود شد');
    }

    async function bulkExport() {
      const selected = getAllSongs().filter(song => getSelectedIds().has(song.id));
      if (!selected.length) {
        toast?.('ترانه‌ای انتخاب نشده');
        return { saved: 0, selected: 0 };
      }
      if (typeof showDirectoryPicker === 'function') {
        try {
          const directory = await showDirectoryPicker({ mode: 'readwrite' });
          let saved = 0;
          for (const song of selected) {
            const data = cloneWithoutAudio(song);
            const safeName = safeFilename(song.title);
            try {
              const fileHandle = await directory.getFileHandle(safeName, { create: true });
              const writer = await fileHandle.createWritable();
              await writer.write(JSON.stringify(data, null, 2));
              await writer.close();
              saved++;
            } catch (_) {}
          }
          toast?.(saved + ' فایل ذخیره شد');
          return { saved, selected: selected.length };
        } catch (error) {
          if (error.name !== 'AbortError') toast?.('خطا: ' + error.message);
          return { saved: 0, selected: selected.length };
        }
      }
      const data = selected.map(cloneWithoutAudio);
      downloadJson(
        data,
        'archive_export_' + dateStamp() + '.json',
        selected.length + ' ترانه خروجی گرفته شد'
      );
      return { saved: selected.length, selected: selected.length };
    }

    return Object.freeze({
      importFullArchive,
      processFullArchive,
      exportSong,
      exportAll,
      bulkExport
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveTransferService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
