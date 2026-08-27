/**
 * EditorArrangerSongLoadService
 *
 * Owns the asynchronous arranger-song loading workflow. Runtime state,
 * transport, rendering and persistence remain injected so this service does
 * not depend on editor.js lexical variables or legacy globals.
 */
(function attachEditorArrangerSongLoadService(globalScope) {
  function create({
    getArrangement = () => null,
    getPerformanceState = () => ({}),
    updatePerformanceState = () => {},
    getAllSongs = () => [],
    getItemSetting = () => ({}),
    getDAW = () => null,
    loadSong = async () => null,
    getPlaybackPolicy = () => null,
    getProjectEnd = () => 0,
    pauseTransport = () => {},
    stopAllVoices = () => {},
    setSelectionEnd = () => {},
    resetRecording = () => {},
    resetHistory = () => {},
    syncToolbar = () => {},
    renderEditor = () => {},
    renderAll = () => {},
    saveState = () => {},
    initHighlightEffect = () => {},
    syncUIAfterSongChange = () => {},
    toast = () => {},
    translate = key => key,
    seekTransport = () => {},
    ensureAudioCtx = () => {},
    startTransport = () => {},
    prepareNextSong = () => Promise.resolve(),
    renderPerfUI = () => {},
    mirrorTimeline = () => {},
    schedule = globalScope.setTimeout?.bind(globalScope),
    logger = console
  } = {}) {
    const scheduleRef = typeof schedule === 'function'
      ? schedule
      : globalScope.setTimeout?.bind(globalScope);

    function readPerformanceState() {
      return getPerformanceState?.() || {};
    }

    function patchPerformanceState(patch) {
      updatePerformanceState?.(patch);
    }

    function finishArrangement() {
      patchPerformanceState({
        active: false,
        nextState: null
      });
      toast(translate('arrangerFinished'));
    }

    function resetPreparationState() {
      patchPerformanceState({
        nextState: null,
        preparePending: false,
        waitPollActive: false,
        hasLoggedNoNextSong: false,
        prepStartedForIndex: -1
      });
    }

    function fallbackPlaybackBoundary() {
      const end = getProjectEnd();
      return {
        start: 0,
        end,
        selectionEnd: end,
        markers: {
          enabled: false,
          start: 0,
          end
        }
      };
    }

    async function load(index) {
      const arrangement = getArrangement?.();
      const items = Array.isArray(arrangement?.items)
        ? arrangement.items
        : [];

      if (!arrangement || index >= items.length) {
        finishArrangement();
        return;
      }

      patchPerformanceState({ index });
      resetPreparationState();

      const allSongs = getAllSongs?.() || [];
      const song = allSongs.find(item => item.id === items[index]);
      if (!song) {
        return load(index + 1);
      }

      logger?.log?.(
        `[Arranger] loadArrSong(${index}): "${song.title}"`
      );

      pauseTransport();
      stopAllVoices();
      setSelectionEnd(0);
      resetRecording();

      const setting = getItemSetting(arrangement, song.id) || {};
      const transition = await loadSong(song, {
        transpose: setting.transpose || 0,
        styleDefaults: {
          tSize: 23,
          tColor: '#0fa966',
          tFont: 'Vazirmatn',
          tBold: true,
          align: 'center',
          cSize: 23,
          cColor: '#e6aa28',
          cFont: 'JetBrains Mono'
        }
      });

      if (!transition) {
        logger?.error?.(
          '[Arranger] Song transition service is unavailable'
        );
        return;
      }

      const daw = getDAW?.() || {};
      const playbackPolicy = getPlaybackPolicy?.();
      const playbackBoundary =
        playbackPolicy?.createBoundary?.({
          clips: daw.clips,
          sections: daw.sections,
          arrangerMarkers: song._arrangerMarkers,
          fallbackEnd: 30
        }) || fallbackPlaybackBoundary();

      const performanceState = readPerformanceState();
      if (performanceState.active) {
        playbackPolicy?.applyToDAW?.(daw);
        setSelectionEnd(playbackBoundary.end);
      } else {
        setSelectionEnd(
          daw.loopA < daw.loopB ? daw.loopB : 0
        );
      }

      const restoreResult = transition.restoreResult;
      if (transition.restoreError) {
        logger?.warn?.('Audio load error:', transition.restoreError);
        toast('⚠ خطا در لود فایل صوتی');
      } else if (restoreResult) {
        if (restoreResult.missing > 0) {
          logger?.warn?.(
            `[Arranger] ${restoreResult.missing} audio clip(s) ` +
            'could not be loaded:',
            restoreResult.missingNames
          );
          toast(
            `⚠ ${restoreResult.missing} فایل صوتی پیدا نشد — ` +
            `${restoreResult.missingNames.slice(0, 2).join(', ')}` +
            `${restoreResult.missingNames.length > 2 ? '...' : ''}`
          );
        } else {
          logger?.log?.(
            `[Arranger] ✓ Audio loaded for "${song.title}" ` +
            `(${restoreResult.loaded} clips)`
          );
        }
      }

      resetHistory();
      syncToolbar();
      renderEditor(true);
      renderAll();
      saveState();
      initHighlightEffect();
      syncUIAfterSongChange();

      const stateAfterLoad = readPerformanceState();
      toast(
        `${translate('songN')} ${index + 1}/${items.length}: ` +
        `${song.title || translate('untitled')}`
      );
      seekTransport(
        stateAfterLoad.active ? playbackBoundary.start : 0,
        false,
        true
      );
      ensureAudioCtx();

      if (
        stateAfterLoad.active &&
        !daw.isPlaying &&
        !stateAfterLoad.pauseMode
      ) {
        startTransport();
      }

      if (stateAfterLoad.active && index + 1 < items.length) {
        scheduleRef?.(() => {
          const scheduledState = readPerformanceState();
          if (
            scheduledState.active &&
            scheduledState.index === index &&
            !scheduledState.nextState &&
            !scheduledState.preparePending
          ) {
            patchPerformanceState({ preparePending: true });
            Promise.resolve(prepareNextSong())
              .then(() => {
                patchPerformanceState({ preparePending: false });
              })
              .catch(error => {
                logger?.error?.(
                  '[Arranger] Prep after loadArrSong failed:',
                  error
                );
                patchPerformanceState({ preparePending: false });
              });
          }
        }, 500);
      }

      if (readPerformanceState().perfModeActive) {
        renderPerfUI();
      }
      scheduleRef?.(() => mirrorTimeline(), 1000);
    }

    return Object.freeze({
      load,
      loadArrSong: load
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorArrangerSongLoadService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
