/**
 * EditorAutoImportRetryService
 *
 * Owns retrying failed Auto Import songs. State, network, archive and DOM
 * operations are injected so retry logic stays independent from editor.js.
 */
(function attachEditorAutoImportRetryService(globalScope) {
  'use strict';

  function create({
    getState = () => null,
    getElement = id => globalScope.document?.getElementById?.(id),
    getSource = () => '',
    showProgress = () => {},
    updateProgress = () => {},
    fetchArtistFromServer = async () => ({ results: [] }),
    escapeHtml = value => String(value ?? ''),
    buildProgressDetail = () => '',
    saveSongToArchive = () => ({ saved: false, duplicate: false }),
    getAllSongs = () => [],
    setAllSongs = () => {},
    toast = () => {},
    logger = console
  } = {}) {
    const element = id => (
      typeof getElement === 'function' ? getElement(id) : null
    );

    function groupByArtist(songs) {
      return songs.reduce((groups, song) => {
        const artist = song.artist || '';
        (groups[artist] ||= []).push(song);
        return groups;
      }, {});
    }

    function setStatus(status, value) {
      if (status) status.textContent = value;
    }

    async function retryFailed() {
      const state = getState?.();
      const failed = state?.getFailedSongs?.() || [];
      if (!failed.length) {
        toast('مورد ناموفقی وجود ندارد');
        return { success: false, reason: 'empty' };
      }

      const status = element('autoImportStatus');
      const source = getSource?.() || element('autoSource')?.value;
      const apiUrl = source === 'akord'
        ? '/api/akord/auto-import'
        : '/api/auto-import';
      showProgress();
      setStatus(
        status,
        `🔄 تلاش مجدد برای ${failed.length} ترانه ناموفق...`
      );

      const byArtist = groupByArtist(failed);
      state.setFailedSongs([]);
      let retriedCount = 0;

      for (const [artistName, failedSongs] of Object.entries(byArtist)) {
        setStatus(
          status,
          `🔄 تلاش مجدد ${escapeHtml(artistName)} ` +
          `(${failedSongs.length} ترانه)...`
        );
        updateProgress(
          retriedCount,
          failed.length,
          `<span class="auto-progress-retry">تلاش مجدد ` +
          `${escapeHtml(artistName)}...</span>`
        );

        const fetchResult = await fetchArtistFromServer(
          artistName,
          apiUrl,
          failedSongs.length,
          message => setStatus(status, message)
        );
        if (fetchResult?.error) {
          state.addFailedSongs(failedSongs);
          retriedCount += failedSongs.length;
          continue;
        }

        const results = fetchResult?.results || [];
        const recoveredSongs = results.filter(
          song => !song.error && song.rawText
        );
        const recoveredUrls = new Set(
          recoveredSongs.map(song => song.url)
        );

        for (const song of recoveredSongs) {
          state.addResults([song]);
          state.incrementStats({ fetched: 1 });
          const existingSongs = getAllSongs();
          const result = saveSongToArchive(song, existingSongs);
          if (result.saved) {
            state.incrementStats({ archived: 1 });
          } else if (result.duplicate) {
            state.incrementStats({ dupes: 1 });
          }
          setAllSongs(existingSongs);
        }

        for (const failedSong of failedSongs) {
          if (!recoveredUrls.has(failedSong.url)) {
            state.addFailedSongs([failedSong]);
          }
        }
        retriedCount += failedSongs.length;
        updateProgress(
          retriedCount,
          failed.length,
          buildProgressDetail()
        );
      }

      const stillFailed = state.getFailedSongs().length;
      setStatus(
        status,
        `🔄 تلاش مجدد تمام شد\n` +
        `بازیابی شده: ${failed.length - stillFailed}\n` +
        `باقی‌مانده ناموفق: ${stillFailed}`
      );
      const retryStats = state.getStats();
      updateProgress(
        retryStats.fetched,
        retryStats.total,
        buildProgressDetail()
      );
      if (stillFailed === 0) {
        toast('✅ همه ترانه‌ها بازیابی شد!');
      } else {
        toast(`⚠️ ${stillFailed} ترانه هنوز ناموفق است`);
      }
      return {
        success: stillFailed === 0,
        recovered: failed.length - stillFailed,
        stillFailed,
        stats: retryStats
      };
    }

    return Object.freeze({
      retryFailed,
      autoRetryFailed: retryFailed
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorAutoImportRetryService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
