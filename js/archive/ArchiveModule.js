/**
 * ArchiveModule — سیستم آرشیو ترانه‌ها (IndexedDB + localStorage fallback)
 *
 * استخراج‌شده از runtime آرشیو — Commit 3 برنامهٔ ماژولارسازی.
 * پیاده‌سازی در یک closure خصوصی نگهداری می‌شود و فقط namespace منجمد
 * AkordyarArchiveApi برای مصرف‌کننده‌های برنامه منتشر می‌شود.
 * این فایل پیش از app/core و editor لود می‌شود تا API آرشیو قبل از ثبت
 * actionها و routeهای بعدی آماده باشد؛ ارجاع‌های runtime به core و editor
 * فقط هنگام اجرای actionها resolve می‌شوند.
 */

    (function attachArchiveModule(globalScope) {
      'use strict';

      const window = globalScope;
      const $ = id => window.document?.getElementById(id);

    // ===== ARCHIVE SYSTEM =====
    const archivePublicApiFactory = window.ArchivePublicApi;
    if (!archivePublicApiFactory?.create) {
      throw new Error(
        'ArchivePublicApi باید قبل از ArchiveModule بارگذاری شود.'
      );
    }
    const archivePublicApi = archivePublicApiFactory.create({
      target: window,
      namespace: 'AkordyarArchiveApi'
    });

    const getArchiveEditorApi = () => window.AkordyarEditorApi || {};
    const archiveEditorCall = (name, ...args) => {
      const fn = getArchiveEditorApi()[name];
      return typeof fn === 'function' ? fn(...args) : undefined;
    };
    const archiveEditorSaveSong = (...args) =>
      archiveEditorCall('saveSong', ...args);
    const archiveEditorSyncToolbar = (...args) =>
      archiveEditorCall('syncToolbar', ...args);
    const archiveEditorRenderEditor = (...args) =>
      archiveEditorCall('renderEditor', ...args);
    const archiveEditorCreateBlankSong = (...args) =>
      archiveEditorCall('createBlankSong', ...args);
    const archiveEditorSetProjectFilePath = (...args) =>
      archiveEditorCall('setProjectFilePath', ...args);
    const archiveEditorClearProjectFilePath = (...args) =>
      archiveEditorCall('clearProjectFilePath', ...args);
    const archiveEditorApplyImportChords = (...args) =>
      archiveEditorCall('applyImportChords', ...args);
    const archiveEditorSaveCurrentVersion = (...args) =>
      archiveEditorCall('saveCurrentVersion', ...args);
    const archiveEditorExportProjectFull = (...args) =>
      archiveEditorCall('exportProjectFull', ...args);

    const ARCH_SCHEMA_VERSION = 1;
    const _archiveStateController = window.ArchiveStateService.create({
      storage: window.localStorage
    });
    const _archState = _archiveStateController.state;
    let _archProjectImportRouteService = null;
    let _archiveProjectPersistenceService = null;
    let _archiveProjectFileImportService = null;
    let _archiveCurrentSongService = null;
    let _archiveBatchImportService = null;
    let _archiveTransferService = null;
    let _archiveXmlExportService = null;
    let _archiveLifecycleService = null;
    let _archiveSelectionFilterService = null;
    let _archiveMutationService = null;
    let _archiveArtistUiService = null;
    let _archiveArtistImageService = null;
    let _archiveRenderService = null;
    let _archiveRenderCoordinatorService = null;
    let _archiveSearchService = null;
    let _archiveListViewService = null;
    let _archiveSongLoadService = null;
    let _archiveReadOnlyService = null;
    let _archiveArtistCatalogService = null;
    let _audioDirHandle = null;

    function getArchiveCoreApi() {
      return window.AkordyarCoreApi || {};
    }

    const toast = (...args) => getArchiveCoreApi().toast?.(...args);
    const t = key => window.t?.(key) ?? key;
    const decodeFileToBuffer = (...args) =>
      archiveEditorCall('decodeFileToBuffer', ...args);
    const peaksFromBuffer = (...args) =>
      archiveEditorCall('peaksFromBuffer', ...args);
    const refreshClipWaveImage = (...args) =>
      archiveEditorCall('refreshClipWaveImage', ...args);
    const parseRawSong = (...args) =>
      archiveEditorCall('parseRawSong', ...args);
    const etIsValidNote = value =>
      archiveEditorCall('isValidNote', value) !== false;
    const resetHistory = (...args) =>
      getArchiveCoreApi().resetHistory?.(...args);
    const archiveResetRecordingState = (...args) =>
      getArchiveCoreApi().resetRecordingState?.(...args);

    const archivePauseTransport = (...args) =>
      getArchiveCoreApi().pauseTransport?.(...args);
    const archiveUpdateTrackMix = (...args) =>
      getArchiveCoreApi().updateTrackMix?.(...args);
    const archiveLoadAudioFromHardDrive = (...args) =>
      getArchiveCoreApi().loadAudioFromHardDrive?.(...args);
    const archiveInitHighlightEffect = (...args) =>
      getArchiveCoreApi().initHighlightEffect?.(...args);
    const archiveEnsureAudioCtx = (...args) =>
      getArchiveCoreApi().ensureAudioCtx?.(...args);
    const archiveStopAllVoices = (...args) =>
      getArchiveCoreApi().stopAllVoices?.(...args);
    const archiveUpdateNextIdFromClips = (...args) =>
      getArchiveCoreApi().updateNextIdFromClips?.(...args);
    const archiveRenderAll = (...args) =>
      getArchiveCoreApi().renderAll?.(...args);
    const archiveSaveState = (...args) =>
      getArchiveCoreApi().saveState?.(...args);
    const archiveResetHistory = (...args) =>
      getArchiveCoreApi().resetHistory?.(...args);

    function getArchiveProjectImportRouteService() {
      if (
        !_archProjectImportRouteService &&
        typeof window.EditorProjectImportRouteService?.create === 'function'
      ) {
        _archProjectImportRouteService =
          window.EditorProjectImportRouteService.create({
            getElectronAPI: () => window.electronAPI
          });
      }
      return _archProjectImportRouteService;
    }

    function getArchiveCurrentSongService() {
      if (!_archiveCurrentSongService) {
        const create = window.ArchiveCurrentSongService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveCurrentSongService is not loaded. Check script order.');
        }
        _archiveCurrentSongService = create({
          runtimeAdapter: window.ArchiveRuntimeAdapter,
          getArrangerMarkerService: () => window.ArrangerMarkerService
        });
      }
      return _archiveCurrentSongService;
    }

    function getArchiveSong() {
      return getArchiveCurrentSongService().getSong();
    }

    function getArchiveSongOrNull() {
      return getArchiveCurrentSongService().getSongOrNull();
    }

    function setArchiveSong(song) {
      const setSong = window.EditorRuntimeAdapter?.setSong;
      if (typeof setSong !== 'function') {
        throw new Error('EditorRuntimeAdapter is not loaded. Check script order.');
      }
      return setSong.call(window.EditorRuntimeAdapter, song);
    }

    function getArchiveAudioStorageRuntime() {
      const runtime = window.EditorAudioStorageRuntime;
      if (!runtime) {
        throw new Error(
          'EditorAudioStorageRuntime is not loaded. Check script order.'
        );
      }
      return runtime;
    }

    const archiveLoadAudioBlobsForProject = (...args) =>
      getArchiveAudioStorageRuntime().loadAudioBlobsForProject?.(...args);
    const archiveSaveAudioBlobsForProject = (...args) =>
      getArchiveAudioStorageRuntime().saveAudioBlobsForProject?.(...args);
    const archiveGetFileHandle = (...args) =>
      getArchiveAudioStorageRuntime().getFileHandle?.(...args);
    const archiveBase64ToUint8 = (...args) =>
      getArchiveAudioStorageRuntime().base64ToUint8?.(...args);
    const archiveDecodeWebMToBuffer = (...args) =>
      getArchiveAudioStorageRuntime().decodeWebMToBuffer?.(...args);
    const archiveGetAudioCompressionService = (...args) =>
      getArchiveAudioStorageRuntime().getAudioCompressionService?.(...args);
    const archiveResampleFloat32 = (...args) =>
      getArchiveAudioStorageRuntime().resampleFloat32?.(...args);
    const archiveDeleteAudioBlobsForProject = (...args) =>
      getArchiveAudioStorageRuntime().deleteAudioBlobsForProject?.(...args);

    function resetPerformanceSerialization() {
      return getArchiveCurrentSongService().resetPerformanceSerialization();
    }

    function getArchiveDAW() {
      return getArchiveCurrentSongService().getDAW();
    }

    function getArchiveArrangerMarkers(song) {
      return getArchiveCurrentSongService().getArrangerMarkers(song);
    }

    // --- Storage bridge ---
    let _archiveStorageService = null;
    function getArchiveStorageService() {
      if (!_archiveStorageService) {
        const create = window.ArchiveStorageService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveStorageService is not loaded. Check script order.');
        }
        _archiveStorageService = create({
          globalScope: window,
          toast: message => getArchiveCoreApi().toast?.(message)
        });
      }
      return _archiveStorageService;
    }

    function edGetAllSongs() {
      return getArchiveStorageService().getAllSongs();
    }

    function edSetAllSongs(arr) {
      return getArchiveStorageService().setAllSongs(arr);
    }

    // --- Identity and migration bridge ---
    let _archiveMigrationService = null;
    function getArchiveMigrationService() {
      if (!_archiveMigrationService) {
        const create = window.ArchiveMigrationService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveMigrationService is not loaded. Check script order.');
        }
        _archiveMigrationService = create({
          schemaVersion: ARCH_SCHEMA_VERSION,
          cryptoRef: window.crypto,
          setSongs: edSetAllSongs
        });
      }
      return _archiveMigrationService;
    }

    function archGenId() {
      return getArchiveMigrationService().generateId();
    }

    function archMigrate(songs) {
      return getArchiveMigrationService().migrate(songs);
    }
    try { archMigrate(edGetAllSongs()); } catch(_) {}

    // --- Normalize and search bridge ---
    let _archiveNormalizationService = null;
    function getArchiveNormalizationService() {
      if (!_archiveNormalizationService) {
        const create = window.ArchiveNormalizationService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveNormalizationService is not loaded. Check script order.');
        }
        _archiveNormalizationService = create({
          schemaVersion: ARCH_SCHEMA_VERSION,
          generateId: archGenId
        });
      }
      return _archiveNormalizationService;
    }

    function archNormalize(data, fileName) {
      return getArchiveNormalizationService().normalizeSong(data, fileName);
    }

    function archNormText(value) {
      return getArchiveNormalizationService().normalizeText(value);
    }

    // --- Search/index bridge ---
    function getArchiveSearchService() {
      if (!_archiveSearchService) {
        const create = window.ArchiveSearchService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveSearchService is not loaded. Check script order.');
        }
        _archiveSearchService = create({
          normalizeText: archNormText,
          extractSearchText: song =>
            getArchiveNormalizationService().extractSearchText(song)
        });
      }
      return _archiveSearchService;
    }

    function archResetSearchCache() {
      getArchiveSearchService().clear();
    }

    function archExtractSearchText(song) {
      return getArchiveSearchService().getSearchText(song);
    }

    // --- Artist canonicalization bridge ---
    function getArchiveArtistCatalogService() {
      if (!_archiveArtistCatalogService) {
        const service = window.ArchiveArtistCatalogService;
        if (!service?.getAll || !service?.getDisplayName) {
          throw new Error('ArchiveArtistCatalogService is not loaded. Check script order.');
        }
        _archiveArtistCatalogService = service;
      }
      return _archiveArtistCatalogService;
    }

    function getArchiveDefaultArtists() {
      return getArchiveArtistCatalogService().getAll();
    }

    let _archiveArtistService = null;
    function getArchiveArtistService() {
      if (!_archiveArtistService) {
        const create = window.ArchiveArtistService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveArtistService is not loaded. Check script order.');
        }
        _archiveArtistService = create({
          normalizeText: archNormText,
          getDefaultArtists: getArchiveDefaultArtists
        });
      }
      return _archiveArtistService;
    }

    function archArtistKey(value) {
      return getArchiveArtistService().artistKey(value);
    }

    function matchDefaultArtist(songArtist) {
      return getArchiveArtistService().matchDefaultArtist(songArtist);
    }

    // --- Undo bridge ---
    let _archiveUndoService = null;
    function getArchiveUndoService() {
      if (!_archiveUndoService) {
        const create = window.ArchiveUndoService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveUndoService is not loaded. Check script order.');
        }
        _archiveUndoService = create({ getSongs: edGetAllSongs });
      }
      return _archiveUndoService;
    }

    function archPushUndo(desc) {
      getArchiveUndoService().push(desc);
    }

    // --- Confirm bridge ---
    let _archiveConfirmService = null;
    function getArchiveConfirmService() {
      if (!_archiveConfirmService) {
        const create = window.ArchiveConfirmService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveConfirmService is not loaded. Check script order.');
        }
        _archiveConfirmService = create({ getElement: id => $(id) });
      }
      return _archiveConfirmService;
    }

    function archConfirm(title, msg, okLabel, dangerMode) {
      return getArchiveConfirmService().open(title, msg, okLabel, dangerMode);
    }

    function archConfirmResolve(val) {
      getArchiveConfirmService().close(val);
    }

    // --- Project persistence bridge ---
    function getArchiveProjectPersistenceService() {
      if (!_archiveProjectPersistenceService) {
        const create = window.ArchiveProjectPersistenceService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveProjectPersistenceService is not loaded. Check script order.');
        }
        _archiveProjectPersistenceService = create({
          global: window,
          getDAW: getArchiveDAW,
          getSong: getArchiveSong,
          getSongOrNull: getArchiveSongOrNull,
          setSong: setArchiveSong,
          pauseTransport: archivePauseTransport,
          stopAllVoices: archiveStopAllVoices,
          resetRecordingState: archiveResetRecordingState,
          isValidNote: note => etIsValidNote(note),
          updateNextIdFromClips: archiveUpdateNextIdFromClips,
          getArrangerMarkers: getArchiveArrangerMarkers,
          ensureAudioCtx: archiveEnsureAudioCtx,
          updateTrackMix: archiveUpdateTrackMix,
          loadAudioBlobsForProject: archiveLoadAudioBlobsForProject,
          saveAudioBlobsForProject: archiveSaveAudioBlobsForProject,
          loadAudioFromHardDrive: archiveLoadAudioFromHardDrive,
          peaksFromBuffer,
          refreshClipWaveImage,
          getFileHandle: archiveGetFileHandle,
          decodeFileToBuffer,
          getAudioDirHandle: () => _audioDirHandle,
          loadDirHandle,
          saveDirHandle,
          resetHistory,
          resetPerformanceSerialization,
          syncToolbar: archiveEditorSyncToolbar,
          renderEditor: archiveEditorRenderEditor,
          renderAll: archiveRenderAll,
          saveState: archiveSaveState,
          getElement: id => $(id),
          initHighlightEffect: archiveInitHighlightEffect,
          rebuildSongDocument: () =>
            window.rebuildPerformanceSongDocument?.(),
          syncViewStyles: () => window.syncViewStylesFromSong?.(),
          syncMetadata: song => window.SongMetadata.syncFromDom(song),
          artistKey: archArtistKey,
          saveCurrentVersion: archiveEditorSaveCurrentVersion,
          getAllSongs: edGetAllSongs,
          setAllSongs: edSetAllSongs,
          getIsElectron: () => Boolean(window.electronAPI?.isElectron)
        });
      }
      return _archiveProjectPersistenceService;
    }

    function getArchiveProjectFileImportService() {
      if (!_archiveProjectFileImportService) {
        const create = window.ArchiveProjectFileImportService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveProjectFileImportService is not loaded. Check script order.');
        }
        _archiveProjectFileImportService = create({
          getDAW: getArchiveDAW,
          getSong: getArchiveSong,
          getElement: id => $(id),
          setSong: setArchiveSong,
          setProjectFilePath: archiveEditorSetProjectFilePath,
          clearProjectFilePath: archiveEditorClearProjectFilePath,
          pauseTransport: archivePauseTransport,
          stopAllVoices: archiveStopAllVoices,
          updateNextIdFromClips: archiveUpdateNextIdFromClips,
          getArrangerMarkers: getArchiveArrangerMarkers,
          ensureAudioCtx: archiveEnsureAudioCtx,
          updateTrackMix: archiveUpdateTrackMix,
          applyImportChords: archiveEditorApplyImportChords,
          loadAudioBlobsForProject: archiveLoadAudioBlobsForProject,
          saveAudioBlobsForProject: archiveSaveAudioBlobsForProject,
          peaksFromBuffer,
          refreshClipWaveImage,
          base64ToUint8: archiveBase64ToUint8,
          decodeWebMToBuffer: archiveDecodeWebMToBuffer,
          decompressBytes: value =>
            archiveGetAudioCompressionService()?.decompressBytes(value) || value,
          resampleFloat32: archiveResampleFloat32,
          getFileHandle: archiveGetFileHandle,
          decodeFileToBuffer,
          getAudioDirHandle: () => _audioDirHandle,
          loadDirHandle,
          saveDirHandle,
          loadAudioFromHardDrive: archiveLoadAudioFromHardDrive,
          getIsElectron: () => Boolean(window.electronAPI?.isElectron),
          resetHistory: archiveResetHistory,
          resetPerformanceSerialization,
          syncToolbar: archiveEditorSyncToolbar,
          renderEditor: archiveEditorRenderEditor,
          initHighlightEffect: archiveInitHighlightEffect,
          saveState: archiveSaveState,
          saveSong: archiveEditorSaveSong,
          renderAll: archiveRenderAll,
          toast,
          logError: console.error,
          getGlobal: () => window
        });
      }
      return _archiveProjectFileImportService;
    }

    // --- Artist UI bridge ---
    function getArchiveArtistUiService() {
      if (!_archiveArtistUiService) {
        const create = window.ArchiveArtistUiService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveArtistUiService is not loaded. Check script order.');
        }
        _archiveArtistUiService = create({
          getElement: id => $(id),
          documentRef: window.document,
          storage: window.localStorage,
          getAllSongs: edGetAllSongs,
          getDefaultArtists: getArchiveDefaultArtists,
          artistKey: archArtistKey,
          matchDefaultArtist,
          normalizeText: archNormText,
          getArtistImage: archGetArtistImage,
          avatarColor: archAvatarColor,
          getInitials: archGetInitials,
          escapeHtml: escH,
          getArtistCache: () => _archState.artistCache,
          setArtistCache: value => {
            _archState.artistCache = value;
          },
          getArtistFilter: () => _archState.artistFilter,
          setArtistFilter: value => {
            _archState.artistFilter = value;
          },
          render: archRender,
          refreshArtists: archRenderArtists,
          updateActiveFilters: archUpdateActiveFilters,
          pickArtistImage: archPickArtistImage,
          removeArtistImage: archRemoveArtistImage,
          toast,
          getSectionCollapsed: () => _archState.artistSectionCollapsed,
          setSectionCollapsed: value => {
            _archState.artistSectionCollapsed = value;
          },
          getFullscreen: () => _archState.fullscreen,
          setFullscreen: value => {
            _archState.fullscreen = value;
          }
        });
      }
      return _archiveArtistUiService;
    }

    // --- Render bridge ---
    function getArchiveRenderService() {
      if (!_archiveRenderService) {
        const create = window.ArchiveRenderService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveRenderService is not loaded. Check script order.');
        }
        _archiveRenderService = create({
          documentRef: window.document,
          requestFrame: callback => window.requestAnimationFrame(callback),
          escapeHtml: escH,
          syncSelectAll: archSyncSelectAllCheckbox
        });
      }
      return _archiveRenderService;
    }

    function getArchiveRenderCoordinatorService() {
      if (!_archiveRenderCoordinatorService) {
        const create = window.ArchiveRenderCoordinatorService?.create;
        if (typeof create !== 'function') {
          throw new Error(
            'ArchiveRenderCoordinatorService is not loaded. Check script order.'
          );
        }
        _archiveRenderCoordinatorService = create({
          getElement: id => $(id),
          getAllSongs: edGetAllSongs,
          normalizeText: archNormText,
          extractSearchText: archExtractSearchText,
          getCurrentTab: () => _archState.currentTab,
          getArtistFilter: () => _archState.artistFilter,
          matchDefaultArtist,
          artistKey: archArtistKey,
          getViewMode: () => _archState.viewMode,
          getSelectMode: () => _archState.selectMode,
          getSelectedIds: () => _archState.selectedIds,
          getActiveSongId: () => getArchiveSongOrNull()?.id,
          renderList: (list, songs, options) =>
            getArchiveRenderService().render(list, songs, options),
          renderEmpty: (list, options) =>
            getArchiveRenderService().renderEmpty(list, options)
        });
      }
      return _archiveRenderCoordinatorService;
    }

    // --- List/view bridge ---
    function getArchiveListViewService() {
      if (!_archiveListViewService) {
        const create = window.ArchiveListViewService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveListViewService is not loaded. Check script order.');
        }
        _archiveListViewService = create({
          documentRef: window.document,
          storage: window.localStorage,
          getElement: id => $(id),
          getViewMode: () => _archState.viewMode,
          setViewMode: value => {
            _archState.viewMode = value;
          },
          getCurrentTab: () => _archState.currentTab,
          setCurrentTab: value => {
            _archState.currentTab = value;
          },
          render: archRender,
          loadSong: archLoadSong,
          loadSongReadOnly: archLoadSongReadOnly,
          editSong: archEditOpen,
          toggleFavorite: archToggleFav,
          duplicateSong: archDuplicateSong,
          exportSong: archExportSong,
          trashSong: archTrashSong,
          restoreSong: archRestoreSong,
          permanentDelete: archPermanentDelete,
          showContextMenu: archCtxShow
        });
      }
      return _archiveListViewService;
    }

    // --- Editable song load bridge ---
    function getArchiveSongLoadService() {
      if (!_archiveSongLoadService) {
        const create = window.ArchiveSongLoadService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveSongLoadService is not loaded. Check script order.');
        }
        _archiveSongLoadService = create({
          getAllSongs: edGetAllSongs,
          getCurrentSong: getArchiveSongOrNull,
          getLoading: () => _archState.loading,
          setLoading: value => {
            _archState.loading = value;
          },
          ensureSongParsed,
          hasUnsavedChanges: () => historyLength() > 1,
          confirmUnsaved: () => archConfirm(
            'پروژه ذخیره نشده',
            'تغییرات ذخیره‌نشده‌ای وجود دارد. آیا می‌خواهید قبل از لود ذخیره کنید؟',
            'ذخیره و لود',
            false
          ),
          saveCurrent: edSaveToArchive,
          closeArchive: archClose,
          loadProject: loadProjectData,
          setAllSongs: edSetAllSongs,
          toast,
          logError: console.error
        });
      }
      return _archiveSongLoadService;
    }

    // --- Read-only load bridge ---
    function getArchiveReadOnlyService() {
      if (!_archiveReadOnlyService) {
        const create = window.ArchiveReadOnlyService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveReadOnlyService is not loaded. Check script order.');
        }
        _archiveReadOnlyService = create({
          documentRef: window.document,
          getElement: id => $(id),
          getAllSongs: edGetAllSongs,
          getCurrentSong: getArchiveSongOrNull,
          setAllSongs: edSetAllSongs,
          setSong: setArchiveSong,
          generateId: archGenId,
          ensureSongParsed,
          closeArchive: archClose,
          loadProject: loadProjectData,
          getLoading: () => _archState.loading,
          setLoading: value => {
            _archState.loading = value;
          },
          setReadOnly: value => {
            if (typeof editorState !== 'undefined') editorState.readOnly = value;
            else window._editorReadOnly = value;
          },
          toast,
          logError: console.error
        });
      }
      return _archiveReadOnlyService;
    }

    function getArchiveMetadataEditService() {
      const create = window.ArchiveMetadataEditService?.create;
      if (typeof create !== 'function') throw new Error('ArchiveMetadataEditService is not loaded. Check script order.');
      return create({
        getElement: id => $(id), getAllSongs: edGetAllSongs, setAllSongs: edSetAllSongs,
        getEditSongId: () => _archState.editSongId, setEditSongId: value => { _archState.editSongId = value; },
        artistKey: archArtistKey, pushUndo: archPushUndo, resetSearchCache: archResetSearchCache,
        resetArtistCache: () => { _archState.artistCache = null; }, render: archRender, renderArtists: archRenderArtists,
        updateActiveFilters: archUpdateActiveFilters, toast, OptionCtor: window.Option
      });
    }

    // --- Batch import bridge ---
    function getArchiveBatchImportService() {
      if (!_archiveBatchImportService) {
        const create = window.ArchiveBatchImportService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveBatchImportService is not loaded. Check script order.');
        }
        _archiveBatchImportService = create({
          documentRef: window.document,
          showDirectoryPicker: window.showDirectoryPicker?.bind(window),
          getElement: id => $(id),
          getAllSongs: edGetAllSongs,
          setAllSongs: edSetAllSongs,
          prepareSong: ensureSongParsed,
          normalizeSong: archNormalize,
          generateId: archGenId,
          resetSearchCache: () => {
            archResetSearchCache();
            _archState.artistCache = null;
          },
          renderArchive: archRender,
          renderArtists: archRenderArtists,
          openArchive: archOpen,
          toast
        });
      }
      return _archiveBatchImportService;
    }

    // --- Archive transfer bridge ---
    function getArchiveTransferService() {
      if (!_archiveTransferService) {
        const create = window.ArchiveTransferService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveTransferService is not loaded. Check script order.');
        }
        _archiveTransferService = create({
          documentRef: window.document,
          BlobCtor: window.Blob,
          URLRef: window.URL,
          showSaveFilePicker: window.showSaveFilePicker?.bind(window),
          showDirectoryPicker: window.showDirectoryPicker?.bind(window),
          getAllSongs: edGetAllSongs,
          getSelectedIds: () => _archState.selectedIds,
          setAllSongs: edSetAllSongs,
          prepareSong: ensureSongParsed,
          normalizeSong: archNormalize,
          confirmImport: count => archConfirm(
            'ورودی آرشیو',
            `فایل حاوی ${count} ترانه است. آیا با آرشیو فعلی ادغام شود؟`,
            'ادغام'
          ),
          resetSearchCache: () => {
            archResetSearchCache();
            _archState.artistCache = null;
          },
          renderArchive: archRender,
          renderArtists: archRenderArtists,
          toast
        });
      }
      return _archiveTransferService;
    }

    function getArchiveXmlExportService() {
      if (!_archiveXmlExportService) {
        const create = window.ArchiveXmlExportService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveXmlExportService is not loaded. Check script order.');
        }
        _archiveXmlExportService = create({
          getSong: getArchiveSongOrNull,
          syncMetadata: song => SongMetadata.syncFromDom(song, { includeKey: false }),
          getShowSaveFilePicker: () => window.showSaveFilePicker,
          documentRef: window.document,
          BlobCtor: window.Blob,
          URLRef: window.URL,
          toast
        });
      }
      return _archiveXmlExportService;
    }

    // --- Lifecycle bridge ---
    function getArchiveLifecycleService() {
      if (!_archiveLifecycleService) {
        const create = window.ArchiveLifecycleService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveLifecycleService is not loaded. Check script order.');
        }
        _archiveLifecycleService = create({
          getElement: id => $(id),
          documentRef: window.document,
          getViewMode: () => _archState.viewMode,
          render: archRender,
          renderArtists: archRenderArtists,
          initArtistSection: archInitArtistSection,
          applyFilters: archApplyFilters,
          handleListClick: archHandleListClick,
          handleListKeydown: archHandleListKeydown,
          stopAutoScroll: archStopAutoScroll,
          isFullscreen: () => _archState.fullscreen,
          setFullscreen: value => {
            _archState.fullscreen = value;
          }
        });
      }
      return _archiveLifecycleService;
    }

    // --- Selection/filter bridge ---
    function getArchiveSelectionFilterService() {
      if (!_archiveSelectionFilterService) {
        const create = window.ArchiveSelectionFilterService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveSelectionFilterService is not loaded. Check script order.');
        }
        _archiveSelectionFilterService = create({
          getElement: id => $(id),
          selectedIds: _archState.selectedIds,
          getSelectMode: () => _archState.selectMode,
          setSelectMode: value => {
            _archState.selectMode = value;
          },
          render: archRender,
          getCurrentTab: () => _archState.currentTab,
          getAllSongs: edGetAllSongs,
          getArtistFilter: () => _archState.artistFilter,
          setArtistFilter: value => {
            _archState.artistFilter = value;
          },
          renderArtists: archRenderArtists,
          updateActiveFilters: archUpdateActiveFilters
        });
      }
      return _archiveSelectionFilterService;
    }

    // --- Mutation bridge ---
    function getArchiveMutationService() {
      if (!_archiveMutationService) {
        const create = window.ArchiveMutationService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveMutationService is not loaded. Check script order.');
        }
        _archiveMutationService = create({
          getAllSongs: edGetAllSongs,
          setAllSongs: edSetAllSongs,
          selectedIds: _archState.selectedIds,
          clearSelected: () => _archState.selectedIds.clear(),
          setSelectMode: value => {
            _archState.selectMode = value;
          },
          updateSelectionUi: () => {
            $('archiveBulkBar').classList.remove('show');
            $('archSelectBtn').classList.remove('active-blue');
          },
          confirm: archConfirm,
          pushUndo: archPushUndo,
          deleteAudioBlobsForProject: archiveDeleteAudioBlobsForProject,
          generateId: archGenId,
          render: archRender,
          renderArtists: archRenderArtists,
          updateActiveFilters: archUpdateActiveFilters,
          resetSearchCache: () => {
            archResetSearchCache();
            _archState.artistCache = null;
          },
          escapeHtml: escH,
          toast
        });
      }
      return _archiveMutationService;
    }

    // --- Shared Load Project Data ---
    async function loadProjectData(data, options = {}) {
      return getArchiveProjectPersistenceService().load(data, options);
    }

    // --- Save To Archive ---
    async function edSaveToArchive() {
      return getArchiveProjectPersistenceService().saveToArchive();
    }

    // --- Save Archive to Folder ---
    function edSaveArchiveToFolder() {
      return getArchiveTransferService().exportAll();
    }

    // --- Ensure rawText is parsed into lyrics+chords ---
    function ensureSongParsed(song) {
      if (song.rawText && (!song.lyrics || !song.lyrics.trim()) && (!song.chords || !song.chords.length)) {
        try {
          const parsed = parseRawSong(song);
          if (parsed.lyrics) song.lyrics = parsed.lyrics;
          if (parsed.chords && parsed.chords.length) song.chords = parsed.chords;
          // Also sync key/keyMode from parsed result
          if (parsed.key) song.key = parsed.key;
          if (parsed.keyMode) song.keyMode = parsed.keyMode;
          if (parsed.timeSignature) song.timeSignature = parsed.timeSignature;
        } catch(e) { console.warn('[PARSE] ensureSongParsed failed:', e.message, song.title); }
      }
      if (!song.timeSignature && song.rhythm) song.timeSignature = song.rhythm;
      SongMetadata.normalize(song, etIsValidNote);
      return song;
    }

    // --- Import Songs (Multi) and Folder ---
    function archImportFiles(files) {
      return getArchiveBatchImportService().importFiles(files);
    }

    function edImportArchiveFromJson(files) {
      return archImportFiles(files);
    }

    function archImportFolder(directoryHandle) {
      return getArchiveBatchImportService().importFolder(directoryHandle);
    }

    // --- Full archive import and export ---
    function archImportFullArchive(file) {
      return getArchiveTransferService().importFullArchive(file);
    }

    function archExportSong(id) {
      return getArchiveTransferService().exportSong(id);
    }

    function archExportAll() {
      return edSaveArchiveToFolder();
    }

    function archBulkExport() {
      return getArchiveTransferService().bulkExport();
    }

    // --- Open / Close ---
    function edOpenArchive() { archOpen(); }
    function archOpen() {
      return getArchiveLifecycleService().open();
    }
    function archClose() {
      return getArchiveLifecycleService().close();
    }

    // --- Event delegation and view facade ---
    function archHandleListClick(e) {
      return getArchiveListViewService().handleListClick(e);
    }
    function archHandleListKeydown(e) {
      return getArchiveListViewService().handleListKeydown(e);
    }
    function archDispatchAction(action, id, e) {
      return getArchiveListViewService().dispatchAction(action, id, e);
    }
    function archSetView(mode) {
      return getArchiveListViewService().setView(mode);
    }
    function archSetTab(tab) {
      return getArchiveListViewService().setTab(tab);
    }

    // --- Select ---
    function archToggleSelectMode() {
      return getArchiveSelectionFilterService().toggleMode();
    }
    function archToggleSelect(id) {
      return getArchiveSelectionFilterService().toggle(id);
    }
    function archSelectAll(checked) {
      return getArchiveSelectionFilterService().selectAll(checked);
    }
    function archSyncSelectAllCheckbox() {
      return getArchiveSelectionFilterService().syncSelectAllCheckbox();
    }
    function archGetVisibleSongIds() {
      return getArchiveSelectionFilterService().getVisibleSongIds();
    }
    function archGetFilteredSongs() {
      return getArchiveSelectionFilterService().getFilteredSongs();
    }

    // --- Filters ---
    function archApplyFilters() {
      return getArchiveSelectionFilterService().applyFilters();
    }
    function archClearFilters() {
      return getArchiveSelectionFilterService().clearFilters();
    }

    // --- Main Render ---
    function archRender() {
      return getArchiveRenderCoordinatorService().render();
    }
    function escH(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

    // --- Load Song (Main) ---
    async function archLoadSong(id) {
      return getArchiveSongLoadService().load(id);
    }
    function edLoadFromArchive(id) { archLoadSong(id); }

    // --- Load Read-Only ---
    async function archLoadSongReadOnly(id) {
      return getArchiveReadOnlyService().loadReadOnly(id);
    }
    function archShowReadOnlyBanner() {
      return getArchiveReadOnlyService().showBanner();
    }
    function archExitReadOnly() {
      return getArchiveReadOnlyService().exitReadOnly();
    }
    async function archCreateEditableCopy() {
      return getArchiveReadOnlyService().createEditableCopy();
    }

    // --- Bulk Actions ---
    async function archBulkTrash() {
      return getArchiveMutationService().bulkTrash();
    }
    async function archBulkFav(add) {
      return getArchiveMutationService().bulkFavorite(add);
    }

    // --- Delete / Trash / Restore ---
    async function archTrashSong(id) {
      return getArchiveMutationService().trash(id);
    }
    async function archRestoreSong(id) {
      return getArchiveMutationService().restore(id);
    }
    async function archPermanentDelete(id) {
      return getArchiveMutationService().permanentDelete(id);
    }
    function edDeleteFromArchive(id) { archTrashSong(id); }

    // --- Favorite ---
    function archToggleFav(id) {
      return getArchiveMutationService().toggleFavorite(id);
    }

    // --- Context Menu ---
    function archCtxShow(e, id) {
      _archState.ctxSongId=id; const menu=$('archiveCtxMenu');
      menu.style.left=Math.min(e.clientX,window.innerWidth-220)+'px';
      menu.style.top=Math.min(e.clientY,window.innerHeight-300)+'px';
      menu.classList.add('show'); e.stopPropagation();
    }
    async function archCtxAction(action) {
      $('archiveCtxMenu').classList.remove('show'); const id=_archState.ctxSongId; if (!id) return;
      archDispatchAction(action, id, {stopPropagation:()=>{}});
    }

    // --- Duplicate ---
    async function archDuplicateSong(id) {
      return getArchiveMutationService().duplicate(id);
    }

    // --- Edit Metadata ---
    function archEditOpen(id) {
      return getArchiveMetadataEditService().open(id);
    }
    function archEditClose() { return getArchiveMetadataEditService().close(); }
    function archEditSave() { return getArchiveMetadataEditService().save(); }

    // --- Refresh ---
    function archRefresh() { archResetSearchCache(); _archState.artistCache=null; archMigrate(edGetAllSongs()); archRender(); archRenderArtists(); toast('آرشیو تازه‌سازی شد'); }

    // ===== ARTIST SLIDER SYSTEM =====

    // Avatar color generator (deterministic from name)
    function archAvatarColor(name) {
      const colors = ['#E53935','#1E88E5','#43A047','#FB8C00','#8E24AA','#00ACC1','#F4511E','#3949AB','#00897B','#D81B60','#5E35B1','#039BE5','#7CB342','#FFB300','#6D4C41','#546E7A'];
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
      return colors[Math.abs(hash) % colors.length];
    }

    // Get initials from name
    function archGetInitials(name) {
      if (!name || name === 'نامشخص') return '?';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length-1].charAt(0)).toUpperCase();
    }

    // Artist image facade — public names remain stable for editor.js and HTML actions.
    function getArchiveArtistImageService() {
      if (!_archiveArtistImageService) {
        const create = window.ArchiveArtistImageService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveArtistImageService is not loaded. Check script order.');
        }
        _archiveArtistImageService = create({
          storage: window.localStorage,
          documentRef: window.document,
          FileReaderCtor: window.FileReader,
          ImageCtor: window.Image,
          getDefaultArtists: getArchiveDefaultArtists,
          artistKey: archArtistKey,
          refreshArtists: archRenderArtists,
          toast
        });
      }
      return _archiveArtistImageService;
    }

    function archGetArtistImage(normalizedName) {
      return getArchiveArtistImageService().get(normalizedName);
    }
    function archSetArtistImage(normalizedName, dataUrl) {
      return getArchiveArtistImageService().set(normalizedName, dataUrl);
    }
    function archRemoveArtistImage(normalizedName) {
      return getArchiveArtistImageService().remove(normalizedName);
    }
    function archProcessImage(file) {
      return getArchiveArtistImageService().process(file);
    }
    function archPickArtistImage(normalizedName, mode) {
      return getArchiveArtistImageService().pick(normalizedName, mode);
    }

    // Artist UI facade — public names remain stable for editor.js and HTML actions.
    function archBuildArtistList() { return getArchiveArtistUiService().buildArtistList(); }
    function archRenderArtists() { return getArchiveArtistUiService().renderArtists(); }
    function archFilterArtists() { return getArchiveArtistUiService().filterArtists(); }
    function archArtistCtxShow(e, normalizedName) {
      return getArchiveArtistUiService().showArtistContext(e, normalizedName);
    }
    function archArtistCtx(action) {
      return getArchiveArtistUiService().artistContextAction(action);
    }
    function archPositionCards3D() { return getArchiveArtistUiService().positionCards3D(); }
    function archArtistSlide(dir) { return getArchiveArtistUiService().slide(dir); }
    function archUpdateSliderNav() { return getArchiveArtistUiService().updateSliderNav(); }
    function archStartAutoScroll() { return getArchiveArtistUiService().startAutoScroll(); }
    function archStopAutoScroll() { return getArchiveArtistUiService().stopAutoScroll(); }
    function archResetAutoScroll() { return getArchiveArtistUiService().resetAutoScroll(); }
    function archHandleWheel(e) { return getArchiveArtistUiService().handleWheel(e); }
    function archToggleArtistSection() {
      return getArchiveArtistUiService().toggleArtistSection();
    }
    function archToggleFullscreen() {
      return getArchiveArtistUiService().toggleFullscreen();
    }



function getArtistDisplayName(artistKey) {
  return getArchiveArtistCatalogService().getDisplayName(artistKey);
}

// --- ۲. تنها نسخه تابع رندر فیلتر (مطمئن شو نسخه دیگری در فایل نباشد) ---
function archUpdateActiveFilters() {
  const container = $('archiveActiveFilters');
  if (!container) return;

  container.innerHTML = '';

  if (_archState.artistFilter) {
    const chip = document.createElement('span');
    chip.className = 'aaf-chip';

    const displayName = getArtistDisplayName(_archState.artistFilter);

    chip.innerHTML = `خواننده: ${escH(displayName)} <button data-action="archClearArtistFilter">✕</button>`;
    container.appendChild(chip);
  }
}




    // Initialize artist section on open.
    function archInitArtistSection() {
      return getArchiveArtistUiService().bindArtistSection();
    }
    async function edNewSong() {
      const daw = getArchiveDAW();
      if (getArchiveSongOrNull() && historyLength() > 1) {
        if (confirm(t('saveSong') + '?')) await edSaveToArchive();
      }
      archiveEditorClearProjectFilePath();
      archivePauseTransport();
archiveStopAllVoices();

setArchiveSong(archiveEditorCreateBlankSong());

archiveResetHistory();
resetPerformanceSerialization();

daw.clips = [];
daw.sections = [];
daw.selectedIds.clear();
daw.selectedSectionIds = new Set();
daw.bufferCache.clear();
daw.waveCache.clear();
daw.loopEnabled = false;
daw.loopA = 0;
daw.loopB = 10;
      archiveResetRecordingState();

// Reset tracks to defaults
daw.tracks = [
  { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
  { id: 't1', name: 'Vocals', icon: '🎤', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
  { id: 't2', name: 'Guitar', icon: '🎸', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
  { id: 't3', name: 'Bass', icon: '🎵', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
  { id: 't4', name: 'Keys', icon: '🎹', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
  { id: 't5', name: 'Drums', icon: '🥁', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 }
];
archiveEnsureAudioCtx();
daw.tracks.forEach(t => {
  if (t.type === 'audio') {
    t._pannerNode = daw.audioCtx.createStereoPanner();
    t._gainNode = daw.audioCtx.createGain();
    t._pannerNode.connect(t._gainNode);
    t._gainNode.connect(daw.masterGain);
  }
});
daw.timelineDuration = 120;
daw.pxPerSecond = 70;

if ($('edArtist')) $('edArtist').value = '';
if ($('edTitle')) $('edTitle').value = '';
localStorage.removeItem('ed_current_song');

archiveEditorSyncToolbar();
archiveEditorRenderEditor(true);
archiveRenderAll();
archiveSaveState();

      // Update loop toggle button state
      const loopBtn2 = $('loopToggleBtn');
      if (loopBtn2) loopBtn2.classList.remove('loop-active');

      // Apply highlight effect (default)
      archiveInitHighlightEffect();

    }
    // ===== Audio Directory Handle for auto-loading =====
    let _audioDirDB = null;
    async function getAudioDirDB() {
      if (_audioDirDB) return _audioDirDB;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('AchordDirDB', 1);
        req.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('dirHandles')) db.createObjectStore('dirHandles'); };
        req.onsuccess = e => { _audioDirDB = e.target.result; resolve(_audioDirDB); };
        req.onerror = () => reject(req.error);
      });
    }
    async function saveDirHandle(handle) {
      const db = await getAudioDirDB();
      const tx = db.transaction('dirHandles', 'readwrite');
      tx.objectStore('dirHandles').put(handle, 'audioDir');
      _audioDirHandle = handle;
    }
    async function loadDirHandle() {
      try {
        const db = await getAudioDirDB();
        const tx = db.transaction('dirHandles', 'readonly');
        const req = tx.objectStore('dirHandles').get('audioDir');
        return new Promise(resolve => { req.onsuccess = () => { _audioDirHandle = req.result || null; resolve(_audioDirHandle); }; req.onerror = () => resolve(null); });
      } catch (_) { return null; }
    }

    async function edExportProject() {
      if (getArchiveEditorApi().exportProjectFull) {
        return archiveEditorExportProjectFull();
      }
      toast('سرویس خروجی پروژه هنوز آماده نیست');
    }

    async function edExportXML() {
      return getArchiveXmlExportService().exportXml();
    }

    // Import — loads metadata, then asks user to select audio files
    async function edImportProject() {
      const input = $('import-file-input');
      input.value = '';
      input.onchange = async (e) => {
        const files = e.target.files;
        if (!files || !files.length) return;
        if (files.length === 1) {
          return getArchiveProjectFileImportService().importSingle(files[0]);
        } else {
          // Multiple files: import all into archive, load last one as current project
          const existing = edGetAllSongs();
          let added = 0, updated = 0, errors = 0;
          for (const file of files) {
            try {
              const text = await file.text();
              let data;
              try { data = JSON.parse(text); } catch(_) { errors++; continue; }
              if (!data || typeof data !== 'object') { errors++; continue; }
              // Duplicate check: by id or title+artist
              const dupById = existing.find(es => es.id === data.id && data.id);
              const dupByMeta = existing.find(es => es.artist === data.artist && es.title === data.title && es.title);
              if (dupById || dupByMeta) {
                const target = dupById || dupByMeta;
                Object.assign(target, archNormalize(data, file.name));
                target.updatedAt = new Date().toISOString();
                updated++;
              } else {
                const song = archNormalize(data, file.name);
                if (!song.id) song.id = archGenId();
                existing.unshift(song);
                added++;
              }
            } catch(_) { errors++; }
          }
          edSetAllSongs(existing);
          // Load the last file as current project
          const lastFile = files[files.length - 1];
          try {
            const text = await lastFile.text();
            const data = JSON.parse(text);
            if (data && typeof data === 'object') {
              await loadProjectData(data);
              archiveEditorSaveSong();
            }
          } catch(err) { console.error('Load last file error:', err); }
          toast(`${added} وارد شد، ${updated} به‌روزرسانی` + (errors ? `، ${errors} خطا` : ''));
          archOpen();
        }
      };

      const nativeImport = await getArchiveProjectImportRouteService()?.openNative?.({
        onFile: file => input.onchange({
          target: { files: [file] }
        })
      });
      if (nativeImport?.handled) {
        if (nativeImport.status === 'error') {
          const error = nativeImport.error;
          console.error('[Project Import] Native file load failed:', error);
          toast('خطا در باز کردن فایل پروژه: ' + (error?.message || error));
        }
        return;
      }

      input.click();
    }

    // Auto-load audio from saved directory handle
    async function autoLoadFromDir(clips) {
      try {
        const perm = await _audioDirHandle.requestPermission({ mode: 'read' });
        if (perm !== 'granted') return false;
        let anyLoaded = false;
        for (const clip of clips) {
          const name = clip.name || '';
          if (!name) continue;
          try {
            const fileHandle = await _audioDirHandle.getFileHandle(name);
            const file = await fileHandle.getFile();
            const { buffer } = await decodeFileToBuffer(file);
            const bufKey = 'dir_' + name;
            getArchiveDAW().bufferCache.set(bufKey, buffer);
            clip.bufferKey = bufKey;
            clip.sourceDuration = buffer.duration;
            clip._peaks = peaksFromBuffer(buffer, 2000);
            refreshClipWaveImage(clip);
            anyLoaded = true;
          } catch (_) {}
        }
        return anyLoaded;
      } catch (_) { return false; }
    }

    function archClearArtistFilter() {
      _archState.artistFilter = null;
      archRenderArtists();
      archRender();
      archUpdateActiveFilters();
    }

    archivePublicApi.publish({
      getAllSongs: edGetAllSongs,
      setAllSongs: edSetAllSongs,
      saveToArchive: edSaveToArchive,
      saveArchiveToFolder: edSaveArchiveToFolder,
      open: archOpen,
      close: archClose,
      loadSong: archLoadSong,
      loadSongReadOnly: archLoadSongReadOnly,
      deleteSong: archTrashSong,
      restoreSong: archRestoreSong,
      permanentDelete: archPermanentDelete,
      newSong: edNewSong,
      exportProject: edExportProject,
      exportXml: edExportXML,
      importProject: edImportProject,
      importArchiveFromJson: edImportArchiveFromJson,
      importFiles: archImportFiles,
      importFolder: archImportFolder,
      importFullArchive: archImportFullArchive,
      exportSong: archExportSong,
      exportAll: archExportAll,
      bulkExport: archBulkExport,
      refresh: archRefresh,
      artistKey: archArtistKey,
      ensureSongParsed,
      pushUndo: archPushUndo,
      confirm: archConfirm,
      resolveConfirm: archConfirmResolve,
      render: archRender,
      renderArtists: archRenderArtists,
      updateActiveFilters: archUpdateActiveFilters,
      clearArtistFilter: archClearArtistFilter,
      toggleFullscreen: archToggleFullscreen,
      toggleArtistSection: archToggleArtistSection,
      filterArtists: archFilterArtists,
      artistContextAction: archArtistCtx,
      artistSlide: archArtistSlide,
      setTab: archSetTab,
      setView: archSetView,
      applyFilters: archApplyFilters,
      clearFilters: archClearFilters,
      toggleSelectMode: archToggleSelectMode,
      selectAll: archSelectAll,
      toggleSelect: archToggleSelect,
      bulkFavorite: archBulkFav,
      bulkTrash: archBulkTrash,
      editClose: archEditClose,
      editSave: archEditSave,
      contextAction: archCtxAction,
      exitReadOnly: archExitReadOnly,
      createEditableCopy: archCreateEditableCopy,
      getAudioDirHandle: () => _audioDirHandle,
      loadDirHandle,
      saveDirHandle,
      setProjectFilePath: archiveEditorSetProjectFilePath,
      clearProjectFilePath: archiveEditorClearProjectFilePath
    });
  })(
    typeof window !== 'undefined' ? window : globalThis
  );
