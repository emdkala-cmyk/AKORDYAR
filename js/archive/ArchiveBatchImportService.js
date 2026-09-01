/**
 * ArchiveBatchImportService
 *
 * Handles multi-file JSON imports and recursive directory imports. Parsing,
 * normalization, persistence and UI refresh are injected so this service
 * owns only the batch-import workflow.
 */
(function attachArchiveBatchImportService(globalScope) {
  function create(context = {}) {
    const {
      documentRef = globalScope.document,
      showDirectoryPicker = globalScope.showDirectoryPicker?.bind(globalScope),
      getElement,
      getAllSongs,
      setAllSongs,
      prepareSong,
      normalizeSong,
      generateId,
      resetSearchCache,
      renderArchive,
      renderArtists,
      openArchive,
      toast,
      addNewArtistToCarousel = () => {},
      now = () => new Date().toISOString(),
      t = globalScope.t || (k => k)
    } = context;

    function refreshArchive() {
      resetSearchCache?.();
      const modal = getElement?.('archiveModal');
      if (modal?.classList?.contains('show')) {
        renderArchive?.();
        renderArtists?.();
      } else {
        renderArchive?.();
        openArchive?.();
      }
    }

    function mergeRecords(existing, records) {
      let added = 0;
      let updated = 0;
      let errors = 0;
      const existingArtists = new Set(existing.map(s => (s.artist || '').toLowerCase().trim()));

      for (const record of records) {
        try {
          if (!record || typeof record.data !== 'object' || record.data === null) {
            errors++;
            continue;
          }
          const data = record.data;
          prepareSong?.(data);
          const duplicate =
            existing.find(song => String(song.id) === String(data.id)) ||
            existing.find(song => song.artist === data.artist && song.title === data.title && song.title);
          if (duplicate) {
            Object.assign(duplicate, normalizeSong(data, record.sourceName));
            duplicate.updatedAt = now();
            updated++;
          } else {
            const song = normalizeSong(data, record.sourceName);
            if (!song.id) song.id = generateId();
            existing.unshift(song);
            added++;
            // Track new artist for carousel
            const artistName = (song.artist || '').toLowerCase().trim();
            if (artistName && !existingArtists.has(artistName)) {
              existingArtists.add(artistName);
              addNewArtistToCarousel?.(song.artist);
            }
          }
        } catch (_) {
          errors++;
        }
      }

      setAllSongs(existing);
      refreshArchive();
      return { added, updated, errors };
    }

    async function readJsonFile(file, sourceName) {
      try {
        const text = await file.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (_) {
          return { data: null, sourceName, error: true };
        }
        return { data, sourceName, error: false };
      } catch (_) {
        return { data: null, sourceName, error: true };
      }
    }

    async function processFiles(files) {
      if (!files?.length) return { added: 0, updated: 0, errors: 0 };
      const records = [];
      for (const file of files) {
        const record = await readJsonFile(file, file.name);
        if (record.error) records.push({ data: null, sourceName: record.sourceName });
        else records.push(record);
      }
      const result = mergeRecords(getAllSongs(), records);
      toast?.(
        result.added +
          ' وارد شد' +
          (result.updated ? '، ' + result.updated + ' به‌روزرسانی' : '') +
          (result.errors ? '، ' + result.errors + ' خطا' : '')
      );
      return result;
    }

    function openFilePicker() {
      const input = documentRef.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.multiple = true;
      input.onchange = event => {
        processFiles(event.target.files).catch(error => {
          toast?.('خطا در خواندن فایل: ' + error.message);
        });
      };
      input.click();
      return input;
    }

    async function importFiles(files) {
      return files ? processFiles(files) : openFilePicker();
    }

    async function readDirectoryRecursive(handle, path, output) {
      let entries;
      try {
        entries = handle.entries();
      } catch (_) {
        return;
      }
      for await (const [name, child] of entries) {
        const childPath = path ? path + '/' + name : name;
        try {
          if (child.kind === 'file' && name.endsWith('.json')) {
            output.push({ handle: child, path: childPath });
          } else if (child.kind === 'directory') {
            await readDirectoryRecursive(child, childPath, output);
          }
        } catch (_) {
          // Ignore unreadable files/folders, matching the legacy behavior.
        }
      }
    }

    async function importFolder(directoryHandle) {
      if (!showDirectoryPicker && !directoryHandle) {
        toast?.('مرورگر شما از انتخاب پوشه پشتیبانی نمی‌کند');
        return { added: 0, updated: 0, errors: 0, files: 0 };
      }

      let dirHandle = directoryHandle;
      if (!dirHandle) {
        try {
          dirHandle = await showDirectoryPicker({ mode: 'read' });
        } catch (error) {
          if (error.name !== 'AbortError') toast?.('خطا در انتخاب پوشه');
          return { added: 0, updated: 0, errors: 0, files: 0 };
        }
      }

      toast?.('در حال خواندن فایل‌ها از پوشه...');
      const jsonFiles = [];
      try {
        await readDirectoryRecursive(dirHandle, '', jsonFiles);
      } catch (error) {
        toast?.('خطا در خواندن پوشه: ' + error.message);
        return { added: 0, updated: 0, errors: 0, files: 0 };
      }

      if (!jsonFiles.length) {
        toast?.('هیچ فایل JSON در پوشه پیدا نشد');
        return { added: 0, updated: 0, errors: 0, files: 0 };
      }

      const records = [];
      for (const { handle: fileHandle, path } of jsonFiles) {
        try {
          const file = await fileHandle.getFile();
          const record = await readJsonFile(file, path);
          records.push(
            record.error
              ? { data: null, sourceName: path }
              : record
          );
        } catch (_) {
          records.push({ data: null, sourceName: path });
        }
      }
      const result = mergeRecords(getAllSongs(), records);
      toast?.(
        `${result.added} وارد شد` +
          (result.updated ? '، ' + result.updated + ' به‌روزرسانی' : '') +
          (result.errors ? '، ' + result.errors + ' خطا' : '') +
          ` (از ${jsonFiles.length} فایل)`
      );
      return { ...result, files: jsonFiles.length };
    }

    return Object.freeze({ importFiles, importFolder, processFiles });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveBatchImportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
