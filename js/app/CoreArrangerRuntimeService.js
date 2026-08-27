/*
 * CoreArrangerRuntimeService
 *
 * Composes the arranger playlist state, editor UI runtimes and persistence
 * actions. The application entrypoint supplies domain callbacks while the
 * individual services remain independent and testable.
 */
(function attachCoreArrangerRuntimeService(globalScope) {
  'use strict';

  function requireService(service, name) {
    if (typeof service?.create !== 'function') {
      throw new Error(
        `${name} باید قبل از CoreArrangerRuntimeService بارگذاری شود.`
      );
    }
    return service;
  }

  function readStoredArrangers(storage, logger) {
    try {
      const parsed = JSON.parse(storage?.getItem?.('arrangers_v1') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger?.warn?.('[Arranger] Failed to read saved playlists:', error);
      return [];
    }
  }

  function create({
    state = {},
    actions = {},
    ui = {},
    timing = {},
    services = {},
    logger = console,
    windowRef = globalScope
  } = {}) {
    const storage = state.storage || windowRef?.localStorage;
    let arrangers = Array.isArray(state.arrangers)
      ? state.arrangers
      : readStoredArrangers(storage, logger);
    let editingArr = state.editingArr || null;

    const {
      documentRef = windowRef?.document,
      getElement = id => documentRef?.getElementById?.(id)
    } = ui;

    const {
      getAllSongs = () => [],
      setAllSongs = () => {},
      getCurrentSong = () => null,
      saveCurrentSong = async () => {},
      customPrompt = async () => null,
      confirm = message => windowRef?.confirm?.(message) || false,
      translate = key => key,
      toast = () => {},
      startPointerDrag = (...args) =>
        globalScope.EditorRuntimeAdapter?.startPointerDrag?.(...args)
    } = actions;

    const {
      now = () => Date.now(),
      isoNow = () => new Date().toISOString(),
      schedule = (...args) => windowRef?.setTimeout?.(...args),
      cancel = id => windowRef?.clearTimeout?.(id)
    } = timing;

    const {
      fileExportService = globalScope.CoreArrangerFileExportService,
      managerRendererService = globalScope.CoreArrangerManagerRendererService,
      songsOverviewService = globalScope.CoreArrangerSongsOverviewService,
      fileImportService = globalScope.CoreArrangerFileImportService,
      songTransferService = globalScope.CoreArrangerSongTransferService,
      editorActionsService = globalScope.CoreArrangerEditorActionsService,
      controlsService = globalScope.CoreArrangerControlsService,
      songNoteService = globalScope.CoreArrangerSongNoteService,
      setlistRendererService = globalScope.CoreArrangerSetlistRendererService,
      poolRendererService = globalScope.CoreArrangerPoolRendererService,
      editorService = globalScope.CoreArrangerEditorService,
      modalService = globalScope.CoreArrangerModalService,
      creationService = globalScope.CoreArrangerCreationService,
      saveService = globalScope.CoreArrangerSaveService
    } = services;

    function getArrangers() {
      return arrangers;
    }

    function setArrangers(value) {
      arrangers = Array.isArray(value) ? value : [];
      return arrangers;
    }

    function getEditingArr() {
      return editingArr;
    }

    function setEditingArr(value) {
      editingArr = value || null;
      return editingArr;
    }

    function normalizePlaylistName(name) {
      return String(name || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('fa-IR');
    }

    function playlistNameExists(name, excludeId = null) {
      const normalizedName = normalizePlaylistName(name);
      return arrangers.some(
        arranger =>
          arranger.id !== excludeId &&
          normalizePlaylistName(arranger.name) === normalizedName
      );
    }

    function ensureArrItem(arr, index) {
      if (!arr._itemSettings) arr._itemSettings = {};
      const id = arr.items[index];
      if (!arr._itemSettings[id]) {
        arr._itemSettings[id] = { transpose: 0, notes: '' };
      }
      return arr._itemSettings[id];
    }

    function getArrItemSetting(arr, songId) {
      if (!arr?._itemSettings) return { transpose: 0, notes: '' };
      return arr._itemSettings[songId] || { transpose: 0, notes: '' };
    }

    function saveArrangers() {
      storage?.setItem?.('arrangers_v1', JSON.stringify(arrangers));
    }

    let managerRuntime = null;
    let fileImportRuntime = null;
    let fileExportRuntime = null;
    let editorRuntime = null;
    let songTransferRuntime = null;
    let songsOverviewRuntime = null;
    let setlistRendererRuntime = null;
    let poolRendererRuntime = null;
    let modalRuntime = null;
    let creationRuntime = null;
    let saveRuntime = null;

    function renderArrangerManager(...args) {
      return managerRuntime?.render?.(...args);
    }

    async function sendCurrentSongToArranger() {
      return songTransferRuntime?.send?.();
    }

    function openArrEditor(...args) {
      return editorRuntime?.open?.(...args);
    }

    async function exportArranger(...args) {
      return fileExportRuntime?.exportArranger?.(...args);
    }

    async function importArrangerFromFile(...args) {
      return fileImportRuntime?.importFromFile?.(...args);
    }

    function renderArrSongsList(...args) {
      return songsOverviewRuntime?.render?.(...args);
    }

    function renderArrSetlist(...args) {
      return setlistRendererRuntime?.render?.(...args);
    }

    function renderArrPool(...args) {
      return poolRendererRuntime?.render?.(...args);
    }

    function openArrangerModal(...args) {
      return modalRuntime?.open?.(...args);
    }

    function closeArrangerModal(...args) {
      return modalRuntime?.close?.(...args);
    }

    function createNewArranger(...args) {
      return creationRuntime?.createNewArranger?.(...args);
    }

    function saveCurrentArranger(...args) {
      return saveRuntime?.saveCurrentArranger?.(...args);
    }

    function saveCurrentArrangerDebounced(...args) {
      return saveRuntime?.saveCurrentArrangerDebounced?.(...args);
    }

    fileExportRuntime = requireService(
      fileExportService,
      'CoreArrangerFileExportService'
    ).create({
      documentRef,
      windowRef,
      getAllSongs,
      toast,
      blobRef: windowRef?.Blob,
      urlRef: windowRef?.URL
    });

    managerRuntime = requireService(
      managerRendererService,
      'CoreArrangerManagerRendererService'
    ).create({
      documentRef,
      getElement,
      getArrangers,
      getEditingArr,
      setArrangers,
      setEditingArr,
      openArrEditor,
      saveArrangers,
      exportArranger,
      confirmRef: confirm,
      translate,
      toast
    });

    songsOverviewRuntime = requireService(
      songsOverviewService,
      'CoreArrangerSongsOverviewService'
    ).create({
      getElement,
      getEditingArr,
      getAllSongs,
      getItemSetting: getArrItemSetting
    });

    fileImportRuntime = requireService(
      fileImportService,
      'CoreArrangerFileImportService'
    ).create({
      documentRef,
      getArrangers,
      setEditingArr,
      getAllSongs,
      setAllSongs,
      playlistNameExists,
      saveArrangers,
      renderArrangerManager,
      openArrEditor,
      toast,
      logger,
      now,
      isoNow
    });

    songTransferRuntime = requireService(
      songTransferService,
      'CoreArrangerSongTransferService'
    ).create({
      getCurrentSong,
      saveCurrentSong,
      getArrangers,
      setEditingArr,
      saveArrangers,
      openArrangerModal,
      toast,
      logger,
      now
    });

    const editorActionsRuntime = requireService(
      editorActionsService,
      'CoreArrangerEditorActionsService'
    ).create({
      documentRef,
      getElement,
      getEditingArr,
      setEditingArr,
      saveArrangers,
      renderArrangerManager,
      renderArrSongsList,
      saveCurrentArranger,
      exportArranger,
      toast
    });

    const {
      switchArrTab,
      closeArrEditor,
      exportCurrentArranger
    } = editorActionsRuntime;

    const controlsRuntime = requireService(
      controlsService,
      'CoreArrangerControlsService'
    ).create({
      getEditingArr,
      getElement,
      ensureArrItem,
      customPrompt,
      confirm,
      saveArrangers,
      renderArrPool,
      renderArrSetlist
    });

    const songNoteRuntime = requireService(
      songNoteService,
      'CoreArrangerSongNoteService'
    ).create({
      getEditingArr,
      getAllSongs,
      getElement,
      ensureArrItem,
      saveArrangers,
      renderArrSetlist
    });

    setlistRendererRuntime = requireService(
      setlistRendererService,
      'CoreArrangerSetlistRendererService'
    ).create({
      documentRef,
      getElement,
      getEditingArr,
      getAllSongs,
      getSearchQuery: () => getElement('arrSearchInput')?.value || '',
      ensureArrItem,
      saveArrangers,
      openArrSongNote: (...args) => songNoteRuntime.openArrSongNote?.(...args),
      translate
    });

    poolRendererRuntime = requireService(
      poolRendererService,
      'CoreArrangerPoolRendererService'
    ).create({
      documentRef,
      getElement,
      getEditingArr,
      getAllSongs,
      getSearchQuery: () => getElement('arrSearchInput')?.value || '',
      saveArrangers,
      renderArrSetlist,
      translate
    });

    editorRuntime = requireService(
      editorService,
      'CoreArrangerEditorService'
    ).create({
      getElement,
      getEditingArr,
      renderArrPool,
      renderArrSetlist,
      switchArrTab,
      renderArrangerManager,
      logger
    });

    modalRuntime = requireService(
      modalService,
      'CoreArrangerModalService'
    ).create({
      getElement,
      getArrangers,
      getEditingArranger: getEditingArr,
      setEditingArr,
      renderArrangerManager,
      openArrEditor,
      startPointerDrag
    });

    creationRuntime = requireService(
      creationService,
      'CoreArrangerCreationService'
    ).create({
      getArrangers,
      prompt: customPrompt,
      playlistNameExists,
      saveArrangers,
      setEditingArr,
      renderArrangerManager,
      openArrEditor,
      toast,
      now,
      isoNow
    });

    saveRuntime = requireService(
      saveService,
      'CoreArrangerSaveService'
    ).create({
      getElement,
      getEditingArr,
      playlistNameExists,
      saveArrangers,
      renderArrangerManager,
      toast,
      isoNow,
      schedule,
      cancel
    });

    const publicApi = Object.freeze({
      getArrangers,
      setArrangers,
      getEditingArr,
      setEditingArr,
      normalizePlaylistName,
      playlistNameExists,
      ensureArrItem,
      getArrItemSetting,
      saveArrangers,
      renderArrangerManager,
      sendCurrentSongToArranger,
      openArrEditor,
      exportArranger,
      importArrangerFromFile,
      renderArrSongsList,
      switchArrTab,
      closeArrEditor,
      exportCurrentArranger,
      arrSetCrossfade: controlsRuntime.arrSetCrossfade,
      arrTogglePauseBetween: controlsRuntime.arrTogglePauseBetween,
      arrAutoTranspose: controlsRuntime.arrAutoTranspose,
      arrClearNotes: controlsRuntime.arrClearNotes,
      arrFilterSongs: controlsRuntime.arrFilterSongs,
      openArrSongNote: songNoteRuntime.openArrSongNote,
      closeArrSongNote: songNoteRuntime.closeArrSongNote,
      saveArrSongNote: songNoteRuntime.saveArrSongNote,
      renderArrSetlist,
      renderArrPool,
      openArrangerModal,
      closeArrangerModal,
      createNewArranger,
      saveCurrentArranger,
      saveCurrentArrangerDebounced
    });

    return Object.freeze({
      ...publicApi,
      publicApi,
      runtimes: Object.freeze({
        manager: managerRuntime,
        fileImport: fileImportRuntime,
        fileExport: fileExportRuntime,
        songsOverview: songsOverviewRuntime,
        songTransfer: songTransferRuntime,
        editorActions: editorActionsRuntime,
        controls: controlsRuntime,
        songNote: songNoteRuntime,
        setlistRenderer: setlistRendererRuntime,
        poolRenderer: poolRendererRuntime,
        editor: editorRuntime,
        modal: modalRuntime,
        creation: creationRuntime,
        save: saveRuntime
      })
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
