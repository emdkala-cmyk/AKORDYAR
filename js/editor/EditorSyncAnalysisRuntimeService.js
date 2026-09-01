/**
 * EditorSyncAnalysisRuntimeService
 *
 * Keeps tempo/key analysis UI orchestration outside core.js. Pure analysis is
 * delegated to SyncAnalysis; editor state and side effects are injected.
 */
(function attachEditorSyncAnalysisRuntimeService(globalScope) {
  'use strict';

  function create({
    analysis = globalScope.SyncAnalysis,
    getSongState = () => globalScope.requireEditorSongStateService?.(),
    performanceRef = globalScope.performance,
    getElement = id => globalScope.document?.getElementById?.(id),
    saveSong = () => {},
    handleTimingChange = (...args) =>
      globalScope.AkordyarCoreApi?.handleTimingChange?.(...args),
    syncToolbar = () => {},
    renderEditor = () => {},
    toast = () => {}
  } = {}) {
    let tapTimes = [];

    function tapTempo() {
      const songState = getSongState();
      if (!songState) return;

      const now = performanceRef?.now?.() ?? Date.now();
      tapTimes.push(now);
      if (tapTimes.length > 8) tapTimes.shift();

      if (tapTimes.length >= 2) {
        let total = 0;
        for (let index = 1; index < tapTimes.length; index += 1) {
          total += tapTimes[index] - tapTimes[index - 1];
        }
        const bpm = Math.round(60000 / (total / (tapTimes.length - 1)));
        if (bpm >= 20 && bpm <= 300) {
          const tempo = getElement('edTempo');
          if (tempo) tempo.value = bpm;
          if (songState.setTempo(bpm)) {
            saveSong();
            handleTimingChange();
          }
          toast(`تمپو: ${bpm} BPM`);
        }
      }

      if (
        tapTimes.length >= 2 &&
        tapTimes[tapTimes.length - 1] - tapTimes[tapTimes.length - 2] > 3000
      ) {
        tapTimes = [now];
      }
    }

    function detectTempo() {
      const songState = getSongState();
      const syncTimes = songState?.getSyncTimes?.() || [];
      if (syncTimes.length < 2) {
        toast('ابتدا سینک دستی را انجام دهید (حداقل ۲ لاین)');
        return;
      }

      const result = analysis?.detectTempoFromSyncTimes?.(syncTimes, {
        minDiff: 0.1,
        maxDiff: 10,
        minBpm: 60,
        maxBpm: 180
      });
      if (!result?.ok) {
        toast('تمپو قابل تشخیص نبود');
        return;
      }

      const tempo = getElement('edTempo');
      if (tempo) tempo.value = result.bpm;
      if (songState.setTempo(result.bpm)) {
        saveSong();
        handleTimingChange();
      }
      toast(
        `تمپوی تشخیص داده شده: ${result.bpm} BPM (از ${result.intervals.length} لاین سینک)`
      );
    }

    function detectKey() {
      const songState = getSongState();
      const chords = songState?.getChords?.() || [];
      if (chords.length === 0) {
        toast('آکوردی برای تشخیص گام وجود ندارد');
        return;
      }

      const result = analysis?.detectKeyFromChords?.(chords);
      if (!result?.ok) {
        toast('گام قابل تشخیص نبود');
        return;
      }

      const key = getElement('edKey');
      const mode = getElement('edKeyMode');
      if (key) key.value = result.key;
      if (mode) mode.value = result.mode;
      if (songState.setKey(result.key, result.mode)) {
        saveSong();
        syncToolbar();
        renderEditor();
      }
      toast(
        `گام تشخیص داده شده: ${result.key} ` +
        `${result.mode === 'maj' ? t('major') : t('minor')} (امتیاز: ${result.score})`
      );
    }

    return Object.freeze({ tapTempo, detectTempo, detectKey });
  }

  const service = Object.freeze({ create });
  globalScope.EditorSyncAnalysisRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
