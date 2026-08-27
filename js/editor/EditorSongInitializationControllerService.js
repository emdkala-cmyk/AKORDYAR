/*
 * EditorSongInitializationControllerService
 *
 * Builds the song-initialization runtime from editor-owned dependencies. The
 * application entrypoint keeps only the lifecycle call while this controller
 * owns the dependency graph and its stable default options.
 */
(function attachEditorSongInitializationControllerService(globalScope) {
  'use strict';

  function create({
    service = globalScope.EditorSongInitializationService,
    storage = globalScope.localStorage,
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
    loadAudioBlobsForProject,
    getAudioBlobFromDB,
    decodeFileToBuffer,
    loadAudioFromHardDrive,
    getFileHandle,
    getDirHandle,
    setDirHandle,
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
    if (typeof service?.create !== 'function') {
      throw new Error(
        'EditorSongInitializationService must be loaded before EditorSongInitializationControllerService.'
      );
    }

    const options = Object.freeze({
      storage,
      getSong,
      setSong,
      blankSong,
      repairSong,
      hydrationService,
      documentRef,
      daw,
      updateNextIdFromClips,
      ensureAudioCtx,
      updateTrackMix,
      audioRecoveryService,
      loadAudioBlobsForProject,
      getAudioBlobFromDB,
      decodeFileToBuffer,
      loadAudioFromHardDrive,
      getFileHandle,
      getDirHandle,
      setDirHandle,
      showDirectoryPicker,
      isElectron,
      electronAvailable,
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
      logger
    });
    const runtime = service.create(options);
    if (!runtime) {
      throw new Error(
        'EditorSongInitializationService failed to initialize.'
      );
    }

    return Object.freeze({
      runtime,
      options
    });
  }

  const controller = Object.freeze({ create });
  globalScope.EditorSongInitializationControllerService = controller;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = controller;
  }
})(typeof window !== 'undefined' ? window : globalThis);
