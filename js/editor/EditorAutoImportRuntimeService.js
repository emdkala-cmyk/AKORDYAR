/**
 * EditorAutoImportRuntimeService
 *
 * Composes the Auto Import state, UI, parser, archive and retry workflows.
 * The editor entrypoint only supplies application callbacks and exposes
 * command-shaped methods to its action map.
 */
(function attachEditorAutoImportRuntimeService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    fetchRef = (...args) => globalScope.fetch?.(...args),
    stateService = globalScope.EditorAutoImportStateService,
    uiService = globalScope.EditorAutoImportUiService,
    fileSaveService = globalScope.EditorAutoImportFileSaveService,
    workflowService = globalScope.EditorAutoImportWorkflowService,
    retryService = globalScope.EditorAutoImportRetryService,
    rawSongParserService = globalScope.EditorRawSongParserService,
    positionMapper = globalScope.LyricPositionMapper,
    getAllSongs = () => [],
    setAllSongs = () => {},
    artistKey = value => value,
    isValidNote = () => true,
    confirmRef = (...args) => globalScope.confirm?.(...args),
    showDirectoryPicker = null,
    toast = () => {},
    wait = milliseconds => new Promise(resolve => {
      globalScope.setTimeout(resolve, milliseconds);
    }),
    logger = console
  } = {}) {
    if (typeof stateService?.create !== 'function') return null;
    if (typeof uiService?.create !== 'function') return null;
    if (typeof fileSaveService?.create !== 'function') return null;
    if (typeof workflowService?.create !== 'function') return null;
    if (typeof rawSongParserService?.create !== 'function') return null;

    const element = id => (
      typeof getElement === 'function' ? getElement(id) : null
    );
    const state = stateService.create();
    const ui = uiService.create({ getElement });
    const parser = rawSongParserService.create({
      positionMapper,
      logger
    });
    const fileSaver = fileSaveService.create({
      documentRef,
      getElement,
      fetchRef,
      getSongs: () => state.getResults(),
      getDirectoryHandle: () => state.getDirectoryHandle(),
      setFilesSaved: value => state.setStat('filesSaved', value),
      setFailedFiles: files => state.setFailedFiles(files),
      toast
    });

    function parseArtistNames(raw) {
      return String(raw || '')
        .split(/[,\n،]+/)
        .map(value => value.trim())
        .filter(Boolean);
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char]));
    }

    function updateAutoArtistTags() {
      const names = parseArtistNames(element('autoArtistName')?.value || '');
      const target = element('autoArtistTags');
      if (!target) return;
      target.innerHTML = names.map((name, index) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;` +
        `background:rgba(63,184,175,0.15);border:1px solid var(--accent-teal);` +
        `border-radius:6px;padding:3px 10px;font-size:0.8rem;` +
        `color:var(--accent-cyan-glow);font-weight:700;">🎵 ` +
        `${escapeHtml(name)}${names.length > 1
          ? ` <span style="opacity:0.5;font-size:0.7rem;">#${index + 1}</span>`
          : ''}</span>`
      ).join('');
    }

    function normalizeKey(value) {
      return String(value || '').replace(/\s+/g, '').toLowerCase();
    }

    function songUniqueId(song) {
      if (song?.url) return normalizeKey(song.url);
      return `${normalizeKey(song?.artist)}::${normalizeKey(song?.title)}`;
    }

    function updateProgress(current, total, detail) {
      return ui.updateProgress(current, total, detail);
    }

    function showProgress() {
      return ui.showProgress();
    }

    function hideProgress() {
      return ui.hideProgress();
    }

    function openAutoImportModal() {
      ui.open();
      const artistInput = element('autoArtistName');
      if (artistInput && !artistInput._tagListenerAttached) {
        artistInput.addEventListener('input', updateAutoArtistTags);
        artistInput._tagListenerAttached = true;
      }

      const sourceSelect = element('autoSource');
      if (sourceSelect && !sourceSelect._cookieListener) {
        sourceSelect._cookieListener = true;
        sourceSelect.addEventListener('change', () => {
          const cookieField = element('autoCookieField');
          if (cookieField) {
            cookieField.style.display =
              sourceSelect.value === 'laminor' ? 'block' : 'none';
          }
        });
        const cookieField = element('autoCookieField');
        if (cookieField) {
          cookieField.style.display =
            sourceSelect.value === 'laminor' ? 'block' : 'none';
        }
      }
    }

    function closeAutoImportModal() {
      return ui.close();
    }

    function autoImportNewRequest() {
      return ui.resetRequest();
    }

    async function fetchArtistFromServer(
      artistName,
      apiUrl,
      totalCount,
      onProgress
    ) {
      onProgress?.(
        `🎵 ${artistName} — در حال دریافت تمام ${totalCount} ترانه...`
      );
      logger.log?.(
        `[FETCH] Starting: ${artistName} — requesting ${totalCount} songs`
      );

      try {
        const response = await fetchRef(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artistName,
            count: totalCount,
            start: 1,
            sessionCookie: element('autoSessionCookie')?.value || ''
          })
        });
        const data = await response.json();
        if (data.error) {
          logger.log?.(`[FETCH] Server error: ${data.error}`);
          return {
            error: data.error,
            candidates: data.candidates,
            results: []
          };
        }

        const results = data.results || [];
        logger.log?.(
          `[FETCH] DONE: ${artistName} — server returned ${results.length}`
        );
        return { totalSongs: totalCount, results };
      } catch (error) {
        logger.log?.(`[FETCH] Network error: ${error.message}`);
        return { error: error.message, results: [] };
      }
    }

    function normalizeRawText(rawText) {
      return parser.normalizeRawText(rawText);
    }

    function hasPersian(value) {
      return parser.hasPersian(value);
    }

    function isChordOnlyLine(value) {
      return parser.isChordOnlyLine(value);
    }

    function parseRawSong(parsedSong) {
      return parser.parseRawSong(parsedSong);
    }

    function parseSongRawText(song) {
      return parseRawSong(song);
    }

    function saveSongToArchive(song, existingSongs) {
      const songArtist = (song.artist || '').trim();
      const songTitle = (song.title || '').trim();
      const songUrlNorm = song.url ? normalizeKey(song.url) : '';
      const songArtistTitleNorm = normalizeKey(
        `${songArtist}::${songTitle}`
      );

      for (const existingSong of existingSongs) {
        if (
          songUrlNorm &&
          existingSong.url &&
          normalizeKey(existingSong.url) === songUrlNorm
        ) {
          return { saved: false, duplicate: true };
        }
        const existingArtistTitle = normalizeKey(
          `${existingSong.artist || ''}::${existingSong.title || ''}`
        );
        if (
          songArtistTitleNorm &&
          existingArtistTitle &&
          songArtistTitleNorm === existingArtistTitle
        ) {
          return { saved: false, duplicate: true };
        }
      }

      const parsedSong = parseSongRawText(song);
      parsedSong.artist = songArtist;
      parsedSong.artistKey = artistKey(songArtist);
      parsedSong.title = songTitle;
      if (song.url) parsedSong.url = song.url;
      if (song.key) {
        const cleanKey = song.key.replace('m', '');
        const keyMode = song.key.endsWith('m') ? 'min' : 'maj';
        if (isValidNote(cleanKey)) {
          parsedSong.key = cleanKey;
          parsedSong.keyMode = keyMode;
        }
      }
      if (song.rhythm) parsedSong.timeSignature = song.rhythm;
      existingSongs.unshift(JSON.parse(JSON.stringify(parsedSong)));
      return { saved: true, duplicate: false };
    }

    function buildProgressDetail() {
      const stats = state.getStats();
      return [
        `<span class="apd-ok">✓ موفق: ${stats.archived}</span>`,
        `<span class="apd-fail">✗ ناموفق: ${stats.errors}</span>`,
        `<span class="apd-dup">≈ تکراری: ${stats.dupes}</span>`,
        `<span class="apd-pending">◯ باقی‌مانده: ` +
          `${Math.max(0, stats.total - stats.fetched)}</span>`
      ].join('  ');
    }

    const workflow = workflowService.create({
      documentRef,
      getElement,
      fetchRef,
      getState: () => state,
      parseArtistNames,
      escapeHtml,
      updateProgress,
      showProgress,
      fetchArtistFromServer,
      buildProgressDetail,
      saveSongToArchive,
      getAllSongs,
      setAllSongs,
      toast,
      wait,
      logger
    });

    let retry = null;
    function getRetryService() {
      if (!retry && typeof retryService?.create === 'function') {
        retry = retryService.create({
          getState: () => state,
          getElement,
          getSource: () => element('autoSource')?.value,
          showProgress,
          updateProgress,
          fetchArtistFromServer,
          escapeHtml,
          buildProgressDetail,
          saveSongToArchive,
          getAllSongs,
          setAllSongs,
          toast,
          logger
        });
      }
      return retry;
    }

    function startAutoImport() {
      return workflow.start();
    }

    function autoRetryFailed() {
      return getRetryService()?.retryFailed?.();
    }

    function autoImportSaveArchive() {
      const songs = state.getResults().filter(song =>
        !song.error && song.rawText
      );
      if (!songs.length) {
        toast('ترانه‌ای برای ذخیره وجود ندارد');
        return;
      }
      if (!confirmRef(`آیا ${songs.length} ترانه در آرشیو ذخیره شود؟`)) {
        return;
      }

      const existingSongs = getAllSongs();
      let saved = 0;
      let duplicates = 0;
      for (const song of songs) {
        const result = saveSongToArchive(song, existingSongs);
        if (result.saved) saved += 1;
        else if (result.duplicate) duplicates += 1;
      }
      setAllSongs(existingSongs);
      toast(
        `📁 ${saved} ترانه ذخیره شد` +
        `${duplicates ? `، ${duplicates} تکراری رد شد` : ''}`
      );
    }

    function autoImportSaveConfirm() {
      const songs = state.getResults().filter(song =>
        !song.error && song.rawText
      );
      if (!songs.length) {
        toast('فایلی برای ذخیره وجود ندارد');
        return;
      }

      const folderInput = element('autoImportFolderInput');
      if (folderInput) folderInput.style.display = 'block';
      if (typeof showDirectoryPicker !== 'function') {
        const pathInput = element('autoSavePathInput');
        if (pathInput) {
          pathInput.disabled = false;
          pathInput.value = '';
        }
        return;
      }

      Promise.resolve(showDirectoryPicker({ mode: 'readwrite' }))
        .then(directoryHandle => {
          if (!directoryHandle) throw new Error('Directory handle unavailable');
          state.setDirectoryHandle(directoryHandle);
          const pathInput = element('autoSavePathInput');
          if (pathInput) {
            pathInput.value = directoryHandle.name;
            pathInput.disabled = true;
          }
        })
        .catch(() => {
          state.setDirectoryHandle(null);
          const pathInput = element('autoSavePathInput');
          if (pathInput) {
            pathInput.disabled = false;
            pathInput.value = '';
          }
        });
    }

    function autoImportDoSave() {
      return fileSaver.saveFiles();
    }

    return Object.freeze({
      getState: () => state,
      getResults: () => state.getResults(),
      getStats: () => state.getStats(),
      parseArtistNames,
      escapeHtml,
      songUniqueId,
      normalizeRawText,
      hasPersian,
      isChordOnlyLine,
      parseRawSong,
      parseSongRawText,
      saveSongToArchive,
      buildProgressDetail,
      updateAutoArtistTags,
      updateProgress,
      showProgress,
      hideProgress,
      openAutoImportModal,
      closeAutoImportModal,
      autoImportNewRequest,
      fetchArtistFromServer,
      startAutoImport,
      autoRetryFailed,
      autoImportSaveArchive,
      autoImportSaveConfirm,
      autoImportDoSave
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorAutoImportRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
