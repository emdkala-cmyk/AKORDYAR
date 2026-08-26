/**
 * EditorAutoImportWorkflowService
 *
 * Owns the multi-artist auto-import workflow. DOM updates, fetching, archive
 * persistence and transient state are supplied through explicit callbacks.
 */
(function attachEditorAutoImportWorkflowService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    fetchRef = (...args) => globalScope.fetch?.(...args),
    getState = () => null,
    parseArtistNames = raw => String(raw || '')
      .split(/[,\n،]+/)
      .map(value => value.trim())
      .filter(Boolean),
    escapeHtml = value => String(value ?? ''),
    updateProgress = () => {},
    showProgress = () => {},
    fetchArtistFromServer = async () => ({ results: [] }),
    buildProgressDetail = () => '',
    saveSongToArchive = () => ({ saved: false, duplicate: false }),
    getAllSongs = () => [],
    setAllSongs = () => {},
    toast = () => {},
    wait = milliseconds => new Promise(resolve => {
      globalScope.setTimeout(resolve, milliseconds);
    }),
    logger = console
  } = {}) {
    const element = id => (
      typeof getElement === 'function' ? getElement(id) : null
    );

    function setStatus(statusElement, value) {
      if (statusElement) statusElement.textContent = value;
    }

    function appendArtistResults(resultsElement, artistName, artistData, songs) {
      if (!resultsElement) return;

      const safeArtistName = escapeHtml(artistName);
      const successfulCount = songs.filter(song => !song.error).length;
      const failedCount = songs.filter(song => song.error).length;
      const headerColor = failedCount > 0
        ? '#e24f5b'
        : 'var(--accent-teal)';

      resultsElement.innerHTML +=
        `<div style="padding:8px 10px;margin:8px 0 4px;` +
        `border-radius:6px;background:rgba(255,255,255,0.04);` +
        `border-left:3px solid ${headerColor};font-weight:700;` +
        `color:var(--text-primary);font-size:0.9rem;">🎵 ${safeArtistName} ` +
        `<span style="color:var(--text-secondary);font-weight:400;` +
        `font-size:0.8rem;">(${successfulCount}/${artistData.expected} موفق` +
        `${failedCount ? `، ${failedCount} ناموفق` : ''})</span></div>`;

      songs.forEach(song => {
        const safeTitle = escapeHtml(song.title || '');
        if (song.error) {
          resultsElement.innerHTML +=
            `<div style="padding:6px 10px;margin:2px 0 2px 16px;` +
            `border-radius:6px;background:rgba(255,0,0,0.1);` +
            `border:1px solid #e24f5b;font-size:0.8rem;">❌ ` +
            `${safeTitle}: ${escapeHtml(song.error)}</div>`;
          return;
        }

        const key = escapeHtml(String(songUniqueId(song)));
        resultsElement.innerHTML +=
          `<div data-action="loadAutoImportSong" data-value="${key}" ` +
          `style="padding:6px 10px;margin:2px 0 2px 16px;` +
          `border-radius:6px;background:rgba(63,184,175,0.1);` +
          `border:1px solid var(--accent-teal);cursor:pointer;` +
          `font-size:0.8rem;">🎵 ${safeTitle} ` +
          `<span style="color:var(--text-secondary);font-size:0.75rem;">(` +
          `${escapeHtml(song.key || '-')}</span></div>`;
      });
    }

    function songUniqueId(song) {
      if (song?.url) return normalizeKey(song.url);
      return normalizeKey(song?.artist) + '::' + normalizeKey(song?.title);
    }

    function normalizeKey(value) {
      return String(value || '').replace(/\s+/g, '').toLowerCase();
    }

    function buildFinalReport(state) {
      const stats = state.getStats();
      let report = '━━━ گزارش نهایی ━━━\n';

      for (const [name, data] of state.getArtistEntries()) {
        if (data.error) report += `❌ ${name}: ${data.error}\n`;
        else {
          report += `🎵 ${name}: ${data.fetched}/${data.expected} ` +
            'دریافت شد\n';
        }
      }

      report += `\n📊 مجموع تعداد مورد انتظار: ${stats.total}\n`;
      report += `📊 تعداد دریافت‌شده: ${stats.fetched}\n`;
      report += `📊 ذخیره‌شده در آرشیو: ${stats.archived}\n`;
      report += `📊 تکراری: ${stats.dupes}\n`;
      report += `📊 ناموفق: ${stats.errors}`;

      const failedSongs = state.getFailedSongs();
      if (failedSongs.length > 0) {
        report += '\n\n❌ موارد ناموفق:\n';
        failedSongs.forEach(song => {
          report += `  • ${song.artist} — ${song.title}: ${song.error}\n`;
        });
      }

      return report;
    }

    async function start() {
      const state = getState?.();
      if (!state) throw new Error('Auto Import state service is unavailable.');

      const rawInput = element('autoArtistName')?.value?.trim() || '';
      const requestedCount =
        parseInt(element('autoSongCount')?.value, 10) || 0;
      const saveToArchive = Boolean(element('autoSaveArchive')?.checked);
      const artistNames = parseArtistNames(rawInput);

      if (!artistNames.length) {
        toast('نام خواننده را وارد کنید');
        return { success: false, reason: 'missing-artist' };
      }

      const status = element('autoImportStatus');
      const results = element('autoImportResults');
      const button = element('autoImportBtn');
      const source = element('autoSource')?.value;
      const apiUrl = source === 'akord'
        ? '/api/akord/auto-import'
        : '/api/auto-import';

      status.style.display = 'block';
      results.innerHTML = '';
      button.disabled = true;
      showProgress();
      state.reset();

      try {
        status.textContent = '🔍 در حال شناسایی تعداد ترانه‌ها...';
        let grandExpected = 0;

        for (let index = 0; index < artistNames.length; index++) {
          const artistName = artistNames[index];
          status.textContent =
            `🔍 [${index + 1}/${artistNames.length}] شناسایی ` +
            `${escapeHtml(artistName)}...`;
          updateProgress(
            grandExpected,
            grandExpected + 1,
            `<span class="auto-progress-teal">شناسایی ` +
            `${escapeHtml(artistName)}...</span>`
          );

          try {
            const probeResponse = await fetchRef(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                artistName,
                count: 1,
                start: 1
              })
            });
            const probeData = await probeResponse.json();

            if (probeData.error) {
              state.setArtist(artistName, {
                expected: 0,
                fetched: 0,
                status: 'error',
                error: probeData.error,
                candidates: probeData.candidates,
                songs: []
              });
              continue;
            }

            const totalSongs = probeData.totalSongs || 1;
            const countToFetch = requestedCount > 0
              ? Math.min(requestedCount, totalSongs)
              : totalSongs;

            logger.log(
              `[AUTO-IMPORT CLIENT] Artist: ${artistName} | ` +
              `totalSongs from probe: ${totalSongs} | ` +
              `countToFetch: ${countToFetch}`
            );
            state.setArtist(artistName, {
              expected: countToFetch,
              fetched: 0,
              status: 'pending',
              songs: []
            });
            grandExpected += countToFetch;
          } catch (error) {
            state.setArtist(artistName, {
              expected: 0,
              fetched: 0,
              status: 'error',
              error: error?.message || String(error),
              songs: []
            });
          }

          await wait(300);
        }

        state.setStat('total', grandExpected);

        const summaryLines = ['━━━ خلاصه شناسایی ━━━'];
        for (const [name, data] of state.getArtistEntries()) {
          if (data.error) summaryLines.push(`❌ ${name}: ${data.error}`);
          else summaryLines.push(`🎵 ${name}: ${data.expected} ترانه`);
        }
        summaryLines.push(`📊 جمع کل: ${grandExpected} ترانه`);
        status.textContent = summaryLines.join('\n');
        updateProgress(0, grandExpected, buildProgressDetail());

        let processedCount = 0;
        for (const [artistName, artistData] of state.getArtistEntries()) {
          if (artistData.error) continue;

          status.textContent =
            `🎵 در حال دریافت ${escapeHtml(artistName)} ` +
            `(${artistData.expected} ترانه)...`;
          updateProgress(
            processedCount,
            grandExpected,
            `<span class="auto-progress-teal">دریافت ` +
            `${escapeHtml(artistName)}...</span><br>` +
            `${buildProgressDetail()}`
          );

          const fetchResult = await fetchArtistFromServer(
            artistName,
            apiUrl,
            artistData.expected,
            message => setStatus(status, message)
          );

          if (fetchResult?.error) {
            artistData.status = 'error';
            artistData.error = fetchResult.error;
            artistData.candidates = fetchResult.candidates;
            artistData.songs = fetchResult.results || [];
            artistData.fetched = artistData.songs.length;
            processedCount += artistData.songs.length;
            state.incrementStats({
              fetched: artistData.songs.length,
              errors: artistData.expected - artistData.songs.length
            });
            continue;
          }

          const seenUrls = new Set();
          const uniqueSongs = [];
          for (const song of fetchResult?.results || []) {
            if (!seenUrls.has(song.url)) {
              seenUrls.add(song.url);
              uniqueSongs.push(song);
            }
          }

          artistData.songs = uniqueSongs;
          artistData.fetched = uniqueSongs.length;
          artistData.status = 'done';
          state.addResults(uniqueSongs);
          state.incrementStats({ fetched: uniqueSongs.length });
          processedCount += uniqueSongs.length;

          updateProgress(
            processedCount,
            grandExpected,
            buildProgressDetail()
          );
          appendArtistResults(results, artistName, artistData, uniqueSongs);
          await wait(300);
        }

        if (saveToArchive) {
          status.textContent = '📁 در حال ذخیره در آرشیو...';
          const existingSongs = getAllSongs();
          let archived = 0;
          let dupes = 0;
          let noText = 0;
          let parseErrors = 0;

          for (const song of state.getResults()) {
            if (song.error) continue;
            if (!song.rawText || !song.rawText.trim()) {
              noText++;
              continue;
            }

            try {
              const result = saveSongToArchive(song, existingSongs);
              if (result.duplicate) dupes++;
              else if (result.saved) archived++;
            } catch (error) {
              parseErrors++;
              logger.log(
                `[ARCHIVE] PARSE ERROR: ${song.title} — ` +
                `${error?.message || String(error)}`
              );
            }
          }

          logger.log(
            `[ARCHIVE] FINAL: archived=${archived}, dupes=${dupes}, ` +
            `noText=${noText}, parseErr=${parseErrors}, ` +
            `total=${state.getResults().length}`
          );
          logger.log(
            `[ARCHIVE] Songs with rawText: ` +
            `${state.getResults().filter(song => (
              !song.error && song.rawText && song.rawText.trim()
            )).length}`
          );
          logger.log(`[ARCHIVE] Songs WITHOUT rawText: ${noText}`);
          setAllSongs(existingSongs);
          state.updateStats({
            archived,
            dupes,
            errors: state.getFailedSongs().length
          });
        }

        const finalStats = state.getStats();
        const report = buildFinalReport(state);
        setStatus(status, report);
        setStatus(element('autoImportSummary'), report);
        updateProgress(
          finalStats.fetched,
          finalStats.total,
          buildProgressDetail()
        );
        element('autoImportForm').style.display = 'none';
        element('autoImportFooter').style.display = 'none';
        element('autoImportDone').style.display = 'block';

        return { success: true, report, stats: finalStats };
      } catch (error) {
        const errorMessage = error?.message || String(error);
        const isNetworkError =
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('ERR_CONNECTION');

        setStatus(
          status,
          isNetworkError
            ? '❌ سرور پیدا نشد!\n\nلطفاً سرور را اجرا کنید:\n' +
              '1. ترمینال باز کنید\n2. بروید به پوشه پروژه\n' +
              '3. بزنید: npm start\n4. بعد دوباره تلاش کنید'
            : `❌ خطا: ${errorMessage}`
        );
        button.disabled = false;
        button.textContent = '🔄 تلاش مجدد';
        element('autoImportDone').style.display = 'block';
        return { success: false, error: errorMessage };
      }
    }

    return Object.freeze({
      start,
      startAutoImport: start
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorAutoImportWorkflowService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
