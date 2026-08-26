/**
 * EditorAutoImportFileSaveService
 *
 * Owns the file-save phase of auto import. Both the Native File System API
 * path and the server-side fallback are kept behind one explicit service API.
 */
(function attachEditorAutoImportFileSaveService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    fetchRef = (...args) => globalScope.fetch?.(...args),
    getSongs = () => [],
    getDirectoryHandle = () => null,
    setFilesSaved = () => {},
    setFailedFiles = () => {},
    toast = () => {},
    locale = 'fa-IR'
  } = {}) {
    const element = id => (
      typeof getElement === 'function' ? getElement(id) : null
    );

    function sanitizeFilePart(value, fallback = 'Unknown') {
      const cleaned = String(value || fallback)
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
        .replace(/\s+/g, ' ')
        .replace(/[.\s]+$/g, '')
        .trim();

      return cleaned || fallback;
    }

    function getSavableSongs() {
      const songs = typeof getSongs === 'function' ? getSongs() : [];
      return (Array.isArray(songs) ? songs : [])
        .filter(song => !song?.error && song?.rawText);
    }

    function groupSongsByArtist(songs) {
      const byArtist = Object.create(null);
      songs.forEach(song => {
        const artistName = sanitizeFilePart(song?.artist, 'Unknown');
        if (!byArtist[artistName]) byArtist[artistName] = [];
        byArtist[artistName].push(song);
      });
      return byArtist;
    }

    function buildSaveReport({
      totalFiles = 0,
      perArtist = [],
      saved = 0,
      errors = 0,
      skipped = 0,
      failed = []
    } = {}) {
      let report = '━━━ گزارش ذخیره فایل‌ها ━━━\n';

      if (perArtist.length > 0) {
        perArtist.forEach(item => {
          const itemErrors = Number(item.errors) || 0;
          const itemSkipped = Number(item.skipped) || 0;
          let icon = '✅';

          if (itemErrors > 0) icon = '⚠️';
          else if (itemSkipped > 0) icon = 'ℹ️';

          report += `${icon} ${item.artist}: ${item.saved} از ` +
            `${item.expected} فایل`;

          const details = [];
          if (itemSkipped > 0) details.push(`${itemSkipped} رد شد`);
          if (itemErrors > 0) details.push(`${itemErrors} خطا`);
          if (details.length > 0) {
            report += ` (${details.join('، ')})`;
          }
          report += '\n';
        });
      }

      report += `\n📊 مجموع: ${saved} از ${totalFiles} فایل با موفقیت ذخیره شد`;
      if (skipped > 0) report += `\n⏭️ ردشده: ${skipped} فایل`;
      if (errors > 0) report += `\n❌ ناموفق: ${errors} فایل`;

      if (failed.length > 0) {
        report += '\n\nجزئیات خطاها:\n';
        failed.forEach(item => {
          report += `  • ${item.artist} — ${item.title}: ${item.error}\n`;
        });
      }

      return report.trim();
    }

    function setStatus(statusElement, text) {
      if (statusElement) statusElement.textContent = text;
    }

    function setSummary(summaryElement, report) {
      if (summaryElement) summaryElement.textContent = report;
    }

    function hideFolderInput(folderInputElement) {
      if (folderInputElement) folderInputElement.style.display = 'none';
    }

    async function saveFiles() {
      const songs = getSavableSongs();
      const emptyResult = {
        method: null,
        saved: 0,
        errors: 0,
        skipped: 0,
        failedFiles: []
      };

      if (!songs.length) {
        toast('داده‌ای برای ذخیره نیست');
        return emptyResult;
      }

      setFailedFiles([]);

      const byArtist = groupSongsByArtist(songs);
      const statusElement = element('autoImportStatus');
      const summaryElement = element('autoImportSummary');
      const folderInputElement = element('autoImportFolderInput');
      const totalFiles = songs.length;

      let savedTotal = 0;
      let errorsTotal = 0;
      const perArtistReport = [];
      const failedFiles = [];

      if (statusElement) statusElement.style.display = 'block';

      const directoryHandle = getDirectoryHandle();
      if (directoryHandle) {
        const artistEntries = Object.entries(byArtist);

        try {
          for (
            let artistIndex = 0;
            artistIndex < artistEntries.length;
            artistIndex++
          ) {
            const [artistName, artistSongs] = artistEntries[artistIndex];
            setStatus(
              statusElement,
              `💾 [${artistIndex + 1}/${artistEntries.length}] ` +
              `ذخیرهٔ ترانه‌های ${artistName} ` +
              `(${artistSongs.length} فایل)...`
            );

            const artistDirName = sanitizeFilePart(artistName, 'Unknown');
            let artistDir;

            try {
              artistDir = await directoryHandle.getDirectoryHandle(
                artistDirName,
                { create: true }
              );
            } catch (error) {
              const errorMessage = error?.message || String(error);
              artistSongs.forEach(song => {
                failedFiles.push({
                  artist: artistName,
                  title: song.title || 'Untitled',
                  error: `ساخت پوشه ناموفق بود: ${errorMessage}`
                });
              });
              errorsTotal += artistSongs.length;
              perArtistReport.push({
                artist: artistName,
                expected: artistSongs.length,
                saved: 0,
                skipped: 0,
                errors: artistSongs.length
              });
              continue;
            }

            let artistSaved = 0;
            let artistErrors = 0;
            const usedFileNames = new Map();

            for (
              let songIndex = 0;
              songIndex < artistSongs.length;
              songIndex++
            ) {
              const song = artistSongs[songIndex];

              try {
                setStatus(
                  statusElement,
                  `💾 [${artistIndex + 1}/${artistEntries.length}] ` +
                  `${artistName}\n` +
                  `فایل ${songIndex + 1} از ${artistSongs.length}: ` +
                  `${song.title || 'Untitled'}`
                );

                const fileArtist = sanitizeFilePart(
                  song.artist || artistName,
                  artistName
                );
                const fileTitle = sanitizeFilePart(song.title, 'Untitled');
                const baseName = `${fileArtist} - ${fileTitle}`;
                const normalizedBaseName =
                  baseName.toLocaleLowerCase(locale);
                const occurrence =
                  (usedFileNames.get(normalizedBaseName) || 0) + 1;

                usedFileNames.set(normalizedBaseName, occurrence);

                const finalBaseName = occurrence === 1
                  ? baseName
                  : `${baseName} (${occurrence})`;
                const filename = `${finalBaseName}.json`;
                const fileHandle = await artistDir.getFileHandle(
                  filename,
                  { create: true }
                );
                const writable = await fileHandle.createWritable();

                try {
                  await writable.write(JSON.stringify(song, null, 2));
                  await writable.close();
                } catch (writeError) {
                  try {
                    await writable.abort?.();
                  } catch (_) {
                    // Abort failures do not replace the original write error.
                  }
                  throw writeError;
                }

                artistSaved++;
                savedTotal++;
              } catch (error) {
                const errorMessage = error?.message || String(error);
                artistErrors++;
                errorsTotal++;
                failedFiles.push({
                  artist: artistName,
                  title: song.title || 'Untitled',
                  error: errorMessage
                });
              }
            }

            perArtistReport.push({
              artist: artistName,
              expected: artistSongs.length,
              saved: artistSaved,
              skipped: 0,
              errors: artistErrors
            });
          }

          setFilesSaved(savedTotal);
          setFailedFiles(failedFiles);

          const report = buildSaveReport({
            totalFiles,
            perArtist: perArtistReport,
            saved: savedTotal,
            errors: errorsTotal,
            skipped: 0,
            failed: failedFiles
          });

          setStatus(statusElement, report);
          setSummary(summaryElement, report);
          hideFolderInput(folderInputElement);

          if (errorsTotal > 0) {
            toast(
              `⚠️ ${savedTotal} فایل ذخیره شد، ` +
              `${errorsTotal} فایل ناموفق بود`
            );
          } else {
            toast(`✅ ${savedTotal} فایل با موفقیت ذخیره شد`);
          }

          return {
            method: 'native',
            saved: savedTotal,
            errors: errorsTotal,
            skipped: 0,
            failedFiles,
            perArtist: perArtistReport,
            report
          };
        } catch (error) {
          const errorMessage = error?.message || String(error);
          setFilesSaved(savedTotal);
          setFailedFiles(failedFiles);
          setStatus(
            statusElement,
            `❌ عملیات ذخیره متوقف شد.\n` +
            `${savedTotal} فایل قبل از بروز خطا ذخیره شد.\n` +
            `خطا: ${errorMessage}`
          );
          toast(`خطا در ذخیره فایل‌ها: ${errorMessage}`);
          return {
            method: 'native',
            saved: savedTotal,
            errors: errorsTotal,
            skipped: 0,
            failedFiles,
            error: errorMessage
          };
        }
      }

      const savePath = element('autoSavePathInput')?.value?.trim() || '';
      if (!savePath) {
        toast('آدرس پوشه را وارد کنید');
        return {
          ...emptyResult,
          method: 'server',
          cancelled: true
        };
      }

      setStatus(statusElement, '💾 در حال ذخیره فایل‌ها در سرور...');
      toast('در حال ذخیره...');

      try {
        const response = await fetchRef('/api/save-to-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ savePath, songs })
        });

        let data;
        try {
          data = await response.json();
        } catch (_) {
          throw new Error(
            `پاسخ سرور JSON معتبر نیست؛ کد وضعیت: ${response.status}`
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.error ||
            `درخواست ذخیره ناموفق بود؛ کد وضعیت: ${response.status}`
          );
        }
        if (data.error) throw new Error(data.error);

        savedTotal = Number(data.saved) || 0;
        errorsTotal = Number(data.errors) || 0;
        const skippedTotal = Number(data.skipped) || 0;
        const serverFailedFiles = Array.isArray(data.failedFiles)
          ? data.failedFiles
          : [];

        setFilesSaved(savedTotal);
        setFailedFiles(serverFailedFiles);

        const serverPerArtist = Array.isArray(data.perArtist)
          ? data.perArtist.map(item => ({
            artist: item.artist || 'Unknown',
            expected: Number(item.expected) || 0,
            saved: Number(item.saved) || 0,
            skipped: Number(item.skipped) || 0,
            errors: Number(item.errors) || 0
          }))
          : Object.entries(byArtist).map(([artistName, artistSongs]) => ({
            artist: artistName,
            expected: artistSongs.length,
            saved: 0,
            skipped: 0,
            errors: 0
          }));

        const report = buildSaveReport({
          totalFiles,
          perArtist: serverPerArtist,
          saved: savedTotal,
          errors: errorsTotal,
          skipped: skippedTotal,
          failed: serverFailedFiles
        });

        setStatus(statusElement, report);
        setSummary(summaryElement, report);
        hideFolderInput(folderInputElement);

        if (errorsTotal > 0) {
          toast(
            `⚠️ ${savedTotal} فایل ذخیره شد، ${errorsTotal} خطا` +
            `${skippedTotal ? `، ${skippedTotal} رد شد` : ''}`
          );
        } else {
          toast(
            `✅ ${savedTotal} فایل ذخیره شد` +
            `${skippedTotal ? `، ${skippedTotal} رد شد` : ''}`
          );
        }

        return {
          method: 'server',
          saved: savedTotal,
          errors: errorsTotal,
          skipped: skippedTotal,
          failedFiles: serverFailedFiles,
          perArtist: serverPerArtist,
          report
        };
      } catch (error) {
        const errorMessage = error?.message || String(error);
        setStatus(
          statusElement,
          `❌ ذخیره در سرور ناموفق بود:\n${errorMessage}`
        );
        toast(
          `خطا: ${errorMessage}\n` +
          'مطمئن شوید سرور اجرا شده و مسیر ذخیره معتبر است'
        );
        return {
          method: 'server',
          saved: savedTotal,
          errors: errorsTotal,
          skipped: 0,
          failedFiles: [],
          error: errorMessage
        };
      }
    }

    return Object.freeze({
      saveFiles,
      sanitizeFilePart,
      groupSongsByArtist,
      buildSaveReport
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorAutoImportFileSaveService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
