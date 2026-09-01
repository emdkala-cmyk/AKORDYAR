/**
 * EditorAudioAnalysisRuntimeService
 *
 * تحلیل هوشمند (AI) تمپو، گام و آکورد از فایل صوتی آهنگ جاری.
 *
 * استراتژی انتخاب صوت:
 *   1) کلیپ صوتی انتخاب‌شده در تایم‌لاین؛
 *   2) بلندترین کلیپ صوتی پروژه؛
 *   3) در صورت نبود بافر، مسیر restoreAudio (IndexedDB / Electron / Handle).
 *
 * خروجی‌ها از طریق songState و callbackهای تزریقی اعمال می‌شوند؛ این سرویس
 * خودش DOM رندر نمی‌کند و فقط وضعیت دکمه/متن status را به‌روزرسانی می‌کند.
 * وقتی صوتی در دسترس نیست، به runtime قدیمی (EditorSyncAnalysisRuntimeService)
 * برمی‌گردد تا رفتار قبلی حفظ شود.
 */
(function attachEditorAudioAnalysisRuntimeService(globalScope) {
  'use strict';

  const BUTTON_IDS = ['aiTempoBtn', 'aiKeyBtn', 'aiChordBtn', 'aiAnalyzeAllBtn'];
  const STATUS_ID = 'aiAnalysisStatus';
  const DEFAULT_COLORS = [
    '#3FB8AF', '#3182CE', '#D69E2E', '#9F7AEA',
    '#ED64A6', '#48BB78', '#ED8936', '#00B5D8'
  ];

  function create({
    engine = globalScope.AudioAnalysisEngine,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getSong = () => null,
    getSongState = () => globalScope.requireEditorSongStateService?.() || null,
    getElement = id => globalScope.document?.getElementById?.(id),
    legacyRuntime = null,
    restoreAudio = async () => ({ loaded: 0 }),
    decodeFileToBuffer = null,
    transposeChordName = (name, semitones) => name,
    transposeKeyName = (key, semitones) => key,
    saveSong = () => {},
    saveState = () => {},
    commit = () => {},
    handleTimingChange = () => {},
    syncToolbar = () => {},
    renderEditor = () => {},
    renderChords = () => {},
    renderTracks = () => {},
    renderClips = () => {},
    renderAll = () => {},
    ensureTimelineFits = () => {},
    uid = prefix => `${prefix || 'c'}${Date.now()}`,
    roundMs = value => value,
    colors = DEFAULT_COLORS,
    toast = () => {},
    logger = console
  } = {}) {
    let running = false;
    let audioPromiseCache = null;

    /* ----------------------------- status UI ----------------------------- */

    function setBusy(message) {
      BUTTON_IDS.forEach(id => {
        const button = getElement(id);
        if (button) button.disabled = Boolean(message);
      });
      const status = getElement(STATUS_ID);
      if (status) {
        status.style.display = message ? 'block' : 'none';
        status.textContent = message || '';
      }
    }

    function setStatusMessage(message) {
      const status = getElement(STATUS_ID);
      if (status && running) status.textContent = message;
    }

    function progressHandler(messagePrefix) {
      return ({ progress, message }) => {
        const percent = Math.round((progress || 0) * 100);
        setStatusMessage(`${messagePrefix} ${percent}% — ${message || ''}`);
      };
    }

    /* ----------------------------- audio access ----------------------------- */

    function audioClips(daw) {
      return (daw?.clips || []).filter(
        clip => clip && clip.type !== 'chord' && clip.type !== 'section'
      );
    }

    function pickClip(daw) {
      const clips = audioClips(daw);
      if (!clips.length) return null;
      const selected = daw.selectedIds
        ? clips.filter(clip => daw.selectedIds.has(clip.id))
        : [];
      if (selected.length) return selected[0];
      return clips.reduce((longest, clip) =>
        (clip.duration || 0) > (longest?.duration || 0) ? clip : longest, clips[0]);
    }

    function bufferForClip(daw, clip) {
      if (!clip) return null;
      const cache = daw?.bufferCache;
      const key = clip.bufferKey || clip.id;
      const buffer = cache?.get?.(key);
      if (buffer) return buffer;
      if (clip._originalBlob && typeof decodeFileToBuffer === 'function') {
        // Decoding below is async; handled by caller via tryDecodeOriginal.
        return null;
      }
      return null;
    }

    async function tryDecodeOriginal(clip) {
      if (!clip?._originalBlob || typeof decodeFileToBuffer !== 'function') {
        return null;
      }
      try {
        const decoded = await decodeFileToBuffer(clip._originalBlob);
        const buffer = decoded?.buffer || decoded;
        const daw = getDAW();
        if (buffer && daw?.bufferCache?.set) {
          daw.bufferCache.set(clip.bufferKey || clip.id, buffer);
        }
        return buffer || null;
      } catch (error) {
        logger?.warn?.('[AI] Embedded blob decode failed:', error?.message);
        return null;
      }
    }

    async function resolveAnalysisBuffer() {
      if (audioPromiseCache) return audioPromiseCache;
      const resolve = async () => {
        const daw = getDAW();
        let clip = pickClip(daw);
        let buffer = clip ? bufferForClip(daw, clip) : null;
        if (clip && !buffer) {
          buffer = await tryDecodeOriginal(clip);
        }
        if (!buffer && clip) {
          const result = await restoreAudio();
          if (result?.loaded) {
            const refreshedDaw = getDAW();
            clip = pickClip(refreshedDaw) || clip;
            buffer = bufferForClip(refreshedDaw, clip);
          }
        }
        return buffer ? { buffer, clip } : null;
      };
      audioPromiseCache = resolve().finally(() => {
        audioPromiseCache = null;
      });
      return audioPromiseCache;
    }

    /* ----------------------------- result application ----------------------------- */

    function applyTempo(tempo) {
      const songState = getSongState();
      const input = getElement('edTempo');
      if (input) input.value = Math.round(tempo.bpm);
      if (songState?.setTempo?.(Math.round(tempo.bpm))) {
        saveSong();
        handleTimingChange();
      }
    }

    function confidenceLabel(confidence) {
      if (confidence >= 0.7) return 'بالا';
      if (confidence >= 0.4) return 'متوسط';
      return 'پایین';
    }

    function applyKey(keyResult) {
      const song = getSong();
      const songState = getSongState();
      if (!song || !songState) return;
      const transpose = Number(song.transpose) || 0;
      const detectedKey = keyResult.key;
      song.originalKey = detectedKey;
      song.originalKeyMode = keyResult.mode;
      const displayedKey = transpose
        ? transposeKeyName(detectedKey, transpose)
        : detectedKey;
      if (songState.setKey(displayedKey, keyResult.mode)) {
        saveSong();
        syncToolbar();
        renderEditor();
      }
      const keyInput = getElement('edKey');
      const modeInput = getElement('edKeyMode');
      if (keyInput) keyInput.value = displayedKey;
      if (modeInput) modeInput.value = keyResult.mode;
    }

    function chordTrackId(daw) {
      const track = (daw?.tracks || []).find(candidate => candidate.type === 'chord');
      return track?.id || null;
    }

    function removeDetectedChordClips(daw) {
      const before = daw?.clips?.length || 0;
      daw.clips = (daw?.clips || []).filter(
        clip => !(clip && clip.type === 'chord' && clip._detected)
      );
      return before - daw.clips.length;
    }

    function chordClipFor(detection, index, trackId) {
      return {
        id: uid('c'),
        type: 'chord',
        trackId,
        name: detection.name,
        start: roundMs(detection.start),
        duration: Math.max(0.4, roundMs(detection.end - detection.start)),
        color: colors[index % colors.length],
        _detected: true
      };
    }

    function applyChordsToTimeline(chords, transpose) {
      const daw = getDAW();
      const trackId = chordTrackId(daw);
      if (!daw || trackId === null) return 0;
      removeDetectedChordClips(daw);
      let endTime = 0;
      chords.forEach((detection, index) => {
        const clip = chordClipFor(detection, index, trackId);
        clip.name = transposeChordName(detection.name, transpose);
        daw.clips.push(clip);
        endTime = Math.max(endTime, clip.start + clip.duration);
      });
      if (chords.length) {
        ensureTimelineFits(endTime + 5);
      }
      return chords.length;
    }

    /* ------------------- lyrics-line anchoring (when synced) ------------------- */

    function lineIndexForTime(time, syncTimes) {
      let index = 0;
      for (let i = 0; i < syncTimes.length; i += 1) {
        if (syncTimes[i] <= time + 1e-6) index = i;
      }
      return index;
    }

    function anchorForChord(detection, syncTimes, lyricsLines) {
      const lineIndex = lineIndexForTime(detection.start, syncTimes);
      const lineStart = syncTimes[lineIndex];
      const lineEnd = lineIndex + 1 < syncTimes.length
        ? syncTimes[lineIndex + 1]
        : lineStart + 4;
      const span = Math.max(0.5, lineEnd - lineStart);
      const relative = Math.min(1, Math.max(0, (detection.start - lineStart) / span));
      const text = lyricsLines[lineIndex] || '';
      let charIndex = Math.round(relative * text.length);
      let anchorType = 'OnCharacter';
      if (charIndex <= 0) {
        charIndex = 0;
        anchorType = 'LineStart';
      } else if (charIndex >= text.length) {
        charIndex = text.length;
        anchorType = 'LineEnd';
      }
      return { lineIndex, charIndex, anchorType };
    }

    function insertDetectedLyricsChords(chords, transpose) {
      const song = getSong();
      const songState = getSongState();
      if (!song || !songState) return 0;
      const syncTimes = songState.getSyncTimes(song);
      if (!Array.isArray(syncTimes) || syncTimes.length === 0) return 0;

      const lyricsLines = String(songState.getLyrics(song) || '').split('\n');
      if (!Array.isArray(song.chords)) song.chords = [];
      if (!Array.isArray(song.baseChordNames)) song.baseChordNames = [];

      // Remove previously detected lyric chords first (idempotent re-runs).
      const keepIndices = song.chords
        .map((chord, index) => (chord?._detected ? -1 : index))
        .filter(index => index >= 0);
      const keptChords = keepIndices.map(index => song.chords[index]);
      const keptBase = keepIndices.map(
        index => song.baseChordNames[index]
      );
      song.chords = keptChords;
      song.baseChordNames = keptBase;

      const entries = chords.map(detection => {
        const anchor = anchorForChord(detection, syncTimes, lyricsLines);
        return {
          chord: {
            ...anchor,
            name: transposeChordName(detection.name, transpose),
            _detected: true
          },
          baseName: detection.name
        };
      });

      // Stable insert ordered by (lineIndex, charIndex).
      let inserted = 0;
      for (const entry of entries) {
        let position = song.chords.length;
        for (let i = 0; i < song.chords.length; i += 1) {
          const existing = song.chords[i];
          if (
            existing.lineIndex > entry.chord.lineIndex ||
            (existing.lineIndex === entry.chord.lineIndex &&
              existing.charIndex > entry.chord.charIndex)
          ) {
            position = i;
            break;
          }
        }
        song.chords.splice(position, 0, entry.chord);
        song.baseChordNames.splice(position, 0, entry.baseName);
        inserted += 1;
      }
      return inserted;
    }

    function applyChords(chordResult) {
      const song = getSong();
      if (!song) return { timeline: 0, lyrics: 0 };
      const transpose = Number(song.transpose) || 0;
      const chords = chordResult.chords || [];
      const timeline = applyChordsToTimeline(chords, transpose);
      const lyrics = insertDetectedLyricsChords(chords, transpose);
      if (timeline || lyrics) {
        saveState();
        renderTracks();
        renderClips();
        renderAll();
        renderChords();
        commit();
        saveSong();
      }
      return { timeline, lyrics };
    }

    /* ----------------------------- public actions ----------------------------- */

    async function withBusyState(label, task) {
      if (running) {
        toast('🤖 تحلیل قبلی هنوز در حال اجراست...');
        return null;
      }
      running = true;
      setBusy(`${label} 0%`);
      try {
        return await task();
      } catch (error) {
        logger?.error?.('[AI] Analysis failed:', error);
        toast('❌ تحلیل صوتی ناموفق بود');
        return null;
      } finally {
        running = false;
        setBusy('');
      }
    }

    async function runAnalysis(parts) {
      const resolved = await resolveAnalysisBuffer();
      if (!resolved) {
        return { noAudio: true };
      }
      const analysis = await engine.analyzeAudio(resolved.buffer, {
        onProgress: progressHandler('🤖 تحلیل')
      });
      if (!analysis?.ok) {
        return { failed: true, reason: analysis?.reason };
      }
      const summary = {};
      if (parts.tempo && analysis.tempo?.ok) summary.tempo = analysis.tempo;
      if (parts.key && analysis.key?.ok) summary.key = analysis.key;
      if (parts.chords) summary.chords = analysis.chords;
      return summary;
    }

    async function detectTempo() {
      const outcome = await withBusyState('🤖 تشخیص تمپو', async () =>
        runAnalysis({ tempo: true })
      );
      if (!outcome) return;
      if (outcome.noAudio) {
        legacyRuntime?.detectTempo?.();
        return;
      }
      if (outcome.failed || !outcome.tempo) {
        toast('تمپو قابل تشخیص نبود');
        return;
      }
      applyTempo(outcome.tempo);
      toast(
        `🎵 تمپوی تشخیص داده‌شده: ${Math.round(outcome.tempo.bpm)} BPM ` +
        `(اطمینان: ${confidenceLabel(outcome.tempo.confidence)})`
      );
    }

    async function detectKey() {
      const outcome = await withBusyState('🤖 تشخیص گام', async () =>
        runAnalysis({ key: true })
      );
      if (!outcome) return;
      if (outcome.noAudio) {
        legacyRuntime?.detectKey?.();
        return;
      }
      if (outcome.failed || !outcome.key) {
        toast('گام قابل تشخیص نبود');
        return;
      }
      applyKey(outcome.key);
      toast(
        `🎼 گام تشخیص داده‌شده: ${outcome.key.key} ` +
        `${outcome.key.mode === 'maj' ? 'ماژور' : 'مینور'} ` +
        `(اطمینان: ${confidenceLabel(outcome.key.confidence)})`
      );
    }

    async function detectChords() {
      const outcome = await withBusyState('🤖 تشخیص آکورد', async () =>
        runAnalysis({ chords: true, tempo: true, key: true })
      );
      if (!outcome) return;
      if (outcome.noAudio) {
        toast('⚠️ فایل صوتی برای تشخیص آکورد پیدا نشد — ابتدا صوت را وارد کنید');
        return;
      }
      if (outcome.failed || !outcome.chords) {
        toast('آکوردی قابل تشخیص نبود');
        return;
      }
      const applied = applyChords(outcome.chords);
      if (outcome.tempo?.ok) applyTempo(outcome.tempo);
      if (outcome.key?.ok) applyKey(outcome.key);
      const details = [
        `${applied.timeline} آکورد روی Chord Line`
      ];
      if (applied.lyrics) {
        details.push(`${applied.lyrics} آکورد روی متن ترانه`);
      }
      toast(`🎼 تشخیص آکورد کامل شد — ${details.join('، ')}`);
    }

    async function analyzeAll() {
      const outcome = await withBusyState('🤖 تحلیل کامل', async () =>
        runAnalysis({ tempo: true, key: true, chords: true })
      );
      if (!outcome) return;
      if (outcome.noAudio) {
        legacyRuntime?.detectTempo?.();
        toast('⚠️ فایل صوتی پیدا نشد — تحلیل نیازمند صوت است');
        return;
      }
      if (outcome.failed) {
        toast('❌ تحلیل صوتی ناموفق بود');
        return;
      }
      const summary = [];
      if (outcome.tempo?.ok) {
        applyTempo(outcome.tempo);
        summary.push(`تمپو ${Math.round(outcome.tempo.bpm)} BPM`);
      }
      if (outcome.key?.ok) {
        applyKey(outcome.key);
        summary.push(`گام ${outcome.key.key} ${outcome.key.mode === 'maj' ? 'ماژور' : 'مینور'}`);
      }
      if (outcome.chords?.count) {
        const applied = applyChords(outcome.chords);
        summary.push(`${applied.timeline} آکورد`);
      }
      toast(summary.length ? `✅ تحلیل کامل: ${summary.join('، ')}` : 'چیزی قابل تشخیص نبود');
    }

    return Object.freeze({
      resolveAnalysisBuffer,
      detectTempo,
      detectKey,
      detectChords,
      analyzeAll
    });
  }

  const service = Object.freeze({ create });

  globalScope.EditorAudioAnalysisRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
