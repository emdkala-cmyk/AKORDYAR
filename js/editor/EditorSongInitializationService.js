/**
 * EditorSongInitializationService
 *
 * Coordinates the initial song transaction. Audio recovery is delegated to
 * AudioRecoveryService so hydration and file loading share one contract.
 */
(function attachEditorSongInitializationService(globalScope) {
  async function restoreAudio(song, options = {}) {
    const candidate =
      options.audioRecoveryService || globalScope.AudioRecoveryService;
    const recoveryService =
      typeof candidate?.restoreSongAudio === 'function'
        ? candidate
        : candidate?.create?.(options);
    return recoveryService?.restoreSongAudio?.(song, options);
  }

  async function initialize({
    storage = globalScope.localStorage,
    storageKey = 'ed_current_song',
    getSong = () => null,
    setSong = () => {},
    blankSong = () => null,
    repairSong = value => value,
    hydrationService = globalScope.EditorHydrationService,
    documentRef = globalScope.document,
    daw = null,
    updateNextIdFromClips,
    ensureAudioCtx,
    updateTrackMix,
    audioRecoveryService = globalScope.AudioRecoveryService,

    // Compatibility callbacks for callers that still construct the recovery
    // service through this initializer.
    loadAudioBlobsForProject,
    getAudioBlobFromDB,
    decodeFileToBuffer,
    loadAudioFromHardDrive,
    getFileHandle,
    getDirHandle,
    setDirHandle,
    saveDirHandle,
    showDirectoryPicker = globalScope.showDirectoryPicker,
    isElectron = false,
    electronAvailable = false,
    peaksFromBuffer,
    refreshClipWaveImage,

    syncToolbar,
    renderEditor,
    resetHistory,
    deactivateHistory,
    activateHistory,
    renderAll,
    saveState,
    initHighlightEffect,
    rebuildSongDocument,
    syncViewStyles,
    toast,
    logger = console
  } = {}) {
    // Hydration is a transaction: history must not observe half-restored state.
    deactivateHistory?.();

    const saved = storage?.getItem?.(storageKey);
    if (saved) {
      try {
        setSong(repairSong(JSON.parse(saved)));
      } catch (error) {
        logger?.warn?.('Song restore error:', error);
        setSong(null);
      }
    }

    if (!getSong()) setSong(blankSong());
    const song = getSong();
    hydrationService?.hydrateSong?.(song, {
      documentRef,
      daw,
      styleDefaults: {
        tSize: 38,
        tColor: '#0fa966',
        tFont: 'Vazirmatn',
        tBold: true,
        align: 'center',
        cSize: 38,
        cColor: '#e6aa28',
        cFont: 'JetBrains Mono'
      },
      updateNextIdFromClips,
      ensureAudioCtx,
      updateTrackMix,
      initializeAudioTracks: true
    });

    await restoreAudio(song, {
      audioRecoveryService,
      daw,
      loadAudioBlobsForProject,
      getAudioBlobFromDB,
      decodeFileToBuffer,
      loadAudioFromHardDrive,
      getFileHandle,
      getDirHandle,
      setDirHandle,
      saveDirHandle,
      showDirectoryPicker,
      isElectron,
      electronAvailable,
      peaksFromBuffer,
      refreshClipWaveImage,
      toast,
      logger
    });

    syncToolbar?.();
    renderEditor?.();
    resetHistory?.();
    syncToolbar?.();
    renderEditor?.(true);
    renderAll?.();
    initHighlightEffect?.();
    rebuildSongDocument?.(song);
    syncViewStyles?.(song);
    activateHistory?.();
    saveState?.();
    return song;
  }

  const service = Object.freeze({
    initialize,
    initializeEditor: initialize,
    restoreAudio
  });
  globalScope.EditorSongInitializationService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
