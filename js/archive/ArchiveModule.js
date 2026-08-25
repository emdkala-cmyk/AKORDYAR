/**
 * ArchiveModule — سیستم آرشیو ترانه‌ها (IndexedDB + localStorage fallback)
 *
 * برش verbatim از app.js — Commit 3 برنامهٔ کاهش حجم app.js.
 * این فایل classic script است: اعلان‌های top-level آن در global lexical scope
 * باقی می‌مانند و از app.js، projecthub.js و inline handlerهای HTML قابل دسترس‌اند.
 * این فایل پیش از app/core و editor لود می‌شود تا APIهای آرشیو قبل از ثبت
 * actionها و routeهای بعدی در دسترس باشند؛ ارجاع‌های runtime به $، toast و
 * سرویس‌های editor فقط هنگام اجرای actionها resolve می‌شوند.
 *
 * نکته: اعلان let _audioDirHandle عمداً در app.js باقی مانده است،
 * چون ناحیهٔ Storage در app.js به آن نیاز دارد.
 */

    // ===== ARCHIVE SYSTEM =====
    const ARCH_SCHEMA_VERSION = 1;
    let _archCtxSongId = null;
    let _archSelectMode = false;
    let _archSelectedIds = new Set();
    let _archCurrentTab = 'all';
    let _archViewMode = localStorage.getItem('arch_view_mode') || 'card';
    let _archEditSongId = null;
    let _archLoading = false;
    let _archProjectImportRouteService = null;
    let _archiveProjectPersistenceService = null;
    let _archiveBatchImportService = null;
    let _archiveTransferService = null;
    let _archiveLifecycleService = null;
    let _archiveSelectionFilterService = null;
    let _archiveMutationService = null;
    let _archiveArtistUiService = null;
    let _archiveArtistImageService = null;
    let _archiveRenderService = null;
    let _archiveSearchService = null;

    function getArchiveRuntimeAdapter() {
      const adapter = window.ArchiveRuntimeAdapter;
      if (!adapter) {
        throw new Error('ArchiveRuntimeAdapter is not loaded. Check Akordyar.html script order.');
      }
      return adapter;
    }

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

    function getArchiveSong() {
      const adapter = getArchiveRuntimeAdapter();
      if (typeof adapter.getSongOrThrow === 'function') {
        return adapter.getSongOrThrow();
      }
      const song = adapter.getSong?.();
      if (!song) throw new Error('ArchiveRuntimeAdapter: editor song is unavailable');
      return song;
    }

    function getArchiveSongOrNull() {
      return getArchiveRuntimeAdapter().getSong?.() || null;
    }

    function resetPerformanceSerialization() {
      getArchiveRuntimeAdapter().resetPerformanceSerialization?.();
    }

    function getArchiveDAW() {
      const adapter = getArchiveRuntimeAdapter();
      if (typeof adapter.getDAWOrThrow === 'function') {
        return adapter.getDAWOrThrow();
      }
      const daw = adapter.getDAW?.();
      if (!daw) throw new Error('ArchiveRuntimeAdapter: DAW is unavailable');
      return daw;
    }

    function getArchiveArrangerMarkers(song) {
      return window.ArrangerMarkerService?.fromSong?.(song) || {
        enabled: song?._arrangerMarkers?.enabled === true,
        start: Math.max(0, Number(song?._arrangerMarkers?.start) || 0),
        end: Math.max(0, Number(song?._arrangerMarkers?.end) || 0)
      };
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
          toast: message => window.toast?.(message)
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
    let _archiveArtistService = null;
    function getArchiveArtistService() {
      if (!_archiveArtistService) {
        const create = window.ArchiveArtistService?.create;
        if (typeof create !== 'function') {
          throw new Error('ArchiveArtistService is not loaded. Check script order.');
        }
        _archiveArtistService = create({
          normalizeText: archNormText,
          getDefaultArtists: () => DEFAULT_ARTISTS
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
          setEditorSong,
          pauseTransport,
          stopAllVoices,
          resetRecordingState: () => {
            isRecordingChords = false;
            currentRecordingClipId = null;
          },
          isValidNote: note => etIsValidNote(note),
          updateNextIdFromClips,
          getArrangerMarkers: getArchiveArrangerMarkers,
          ensureAudioCtx,
          updateTrackMix,
          loadAudioBlobsForProject,
          saveAudioBlobsForProject,
          loadAudioFromHardDrive,
          peaksFromBuffer,
          refreshClipWaveImage,
          getFileHandle,
          decodeFileToBuffer,
          getAudioDirHandle: () => _audioDirHandle,
          loadDirHandle,
          saveDirHandle,
          resetHistory,
          resetPerformanceSerialization,
          edSyncToolbar,
          edRenderEditor,
          renderAll,
          saveState,
          getElement: id => $(id),
          initHighlightEffect,
          rebuildSongDocument: () => {
            if (typeof rebuildSongDocumentFromEdCur === 'function') {
              rebuildSongDocumentFromEdCur();
            }
          },
          syncViewStyles: () => {
            if (typeof syncViewStylesFromEdCur === 'function') {
              syncViewStylesFromEdCur();
            }
          },
          syncMetadata: song => SongMetadata.syncFromDom(song),
          artistKey: archArtistKey,
          saveCurrentVersion,
          getAllSongs: edGetAllSongs,
          setAllSongs: edSetAllSongs,
          getIsElectron: () => isElectron
        });
      }
      return _archiveProjectPersistenceService;
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
          getDefaultArtists: () => DEFAULT_ARTISTS,
          artistKey: archArtistKey,
          matchDefaultArtist,
          normalizeText: archNormText,
          getArtistImage: archGetArtistImage,
          avatarColor: archAvatarColor,
          getInitials: archGetInitials,
          escapeHtml: escH,
          getArtistCache: () => _archArtistCache,
          setArtistCache: value => {
            _archArtistCache = value;
          },
          getArtistFilter: () => _archArtistFilter,
          setArtistFilter: value => {
            _archArtistFilter = value;
          },
          render: archRender,
          refreshArtists: archRenderArtists,
          updateActiveFilters: archUpdateActiveFilters,
          pickArtistImage: archPickArtistImage,
          removeArtistImage: archRemoveArtistImage,
          toast,
          getSectionCollapsed: () => _archArtistSectionCollapsed,
          setSectionCollapsed: value => {
            _archArtistSectionCollapsed = value;
          },
          getFullscreen: () => _archFullscreen,
          setFullscreen: value => {
            _archFullscreen = value;
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
            _archArtistCache = null;
          },
          renderArchive: archRender,
          renderArtists: archRenderArtists,
          openArchive: edOpenArchive,
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
          getSelectedIds: () => _archSelectedIds,
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
            _archArtistCache = null;
          },
          renderArchive: archRender,
          renderArtists: archRenderArtists,
          toast
        });
      }
      return _archiveTransferService;
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
          getViewMode: () => _archViewMode,
          render: archRender,
          renderArtists: archRenderArtists,
          initArtistSection: archInitArtistSection,
          applyFilters: archApplyFilters,
          handleListClick: archHandleListClick,
          handleListKeydown: archHandleListKeydown,
          stopAutoScroll: archStopAutoScroll,
          isFullscreen: () => _archFullscreen,
          setFullscreen: value => {
            _archFullscreen = value;
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
          selectedIds: _archSelectedIds,
          getSelectMode: () => _archSelectMode,
          setSelectMode: value => {
            _archSelectMode = value;
          },
          render: archRender,
          getCurrentTab: () => _archCurrentTab,
          getAllSongs: edGetAllSongs,
          getArtistFilter: () => _archArtistFilter,
          setArtistFilter: value => {
            _archArtistFilter = value;
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
          selectedIds: _archSelectedIds,
          clearSelected: () => _archSelectedIds.clear(),
          setSelectMode: value => {
            _archSelectMode = value;
          },
          updateSelectionUi: () => {
            $('archiveBulkBar').classList.remove('show');
            $('archSelectBtn').classList.remove('active-blue');
          },
          confirm: archConfirm,
          pushUndo: archPushUndo,
          deleteAudioBlobsForProject,
          generateId: archGenId,
          render: archRender,
          renderArtists: archRenderArtists,
          updateActiveFilters: archUpdateActiveFilters,
          resetSearchCache: () => {
            archResetSearchCache();
            _archArtistCache = null;
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
          const parsed = parseRawSongToEdCur(song);
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

    // --- Event Delegation ---
    function archHandleListClick(e) {
      const card = e.target.closest('[data-song-id]');
      if (!card) return;
      const id = String(card.dataset.songId);
      if (e.target.closest('[data-arch-action]')) {
        e.stopPropagation();
        const action = e.target.closest('[data-arch-action]').dataset.archAction;
        archDispatchAction(action, id, e);
        return;
      }
      // Click on card body = open
      if (!e.target.closest('.archive-card-actions')&&!e.target.closest('.archive-card-check')) {
        archLoadSong(id);
      }
    }
    function archHandleListKeydown(e) {
      if (e.key!=='Enter'&&e.key!=='Delete') return;
      const card = e.target.closest('[data-song-id]');
      if (!card) return;
      const id = String(card.dataset.songId);
      if (e.key==='Enter') archLoadSong(id);
      if (e.key==='Delete') archTrashSong(id);
    }
    function archDispatchAction(action, id, e) {
      switch(action) {
        case 'open': archLoadSong(id); break;
        case 'readonly': archLoadSongReadOnly(id); break;
        case 'edit': archEditOpen(id); break;
        case 'fav': archToggleFav(id); break;
        case 'duplicate': archDuplicateSong(id); break;
        case 'export': archExportSong(id); break;
        case 'trash': archTrashSong(id); break;
        case 'restore': archRestoreSong(id); break;
        case 'permanent-delete': archPermanentDelete(id); break;
        case 'menu': archCtxShow(e, id); break;
      }
    }

    // --- View / Tab ---
    function archSetView(mode) { _archViewMode=mode; localStorage.setItem('arch_view_mode',mode); $('archViewCard').classList.toggle('active-blue',mode==='card'); $('archViewTable').classList.toggle('active-blue',mode==='table'); $('archiveList').classList.toggle('table-view',mode==='table'); archRender(); }
    function archSetTab(tab) { _archCurrentTab=tab; document.querySelectorAll('.archive-tabs .at-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab)); archRender(); }

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
      const allSongs = edGetAllSongs();
      const q = archNormText($('archiveSearch')?.value||'');
      const sig = $('filterSig')?.value||'';
      const genre = $('filterGenre')?.value||'';
      const tempoRange = $('filterTempo')?.value||'';
      const keyFilter = $('filterKey')?.value||'';
      const sort = $('filterSort')?.value||'newest';
      const activeAll = allSongs.filter(s=>!s.deletedAt);
      $('tabCountAll').textContent=activeAll.length;
      $('tabCountFav').textContent=activeAll.filter(s=>s.favorite).length;
      $('tabCountTrash').textContent=allSongs.filter(s=>s.deletedAt).length;
      $('archiveTotalCount').textContent=`(${activeAll.length} ترانه)`;
      let songs;
      if (_archCurrentTab==='fav') songs=activeAll.filter(s=>s.favorite);
      else if (_archCurrentTab==='trash') songs=allSongs.filter(s=>s.deletedAt);
      else songs=activeAll;
      songs = songs.filter(s => {
        if (q && !archExtractSearchText(s).includes(q)) return false;
        if (_archArtistFilter) {
          const rawArtist = s.artist || s.artistName || s.singer || '';
          const matched = matchDefaultArtist(rawArtist);
          const songKey = matched ? archArtistKey(matched.normalizedName) : archArtistKey(rawArtist);
          if (songKey !== _archArtistFilter) return false;
        }
        if (sig && s.timeSignature!==sig) return false;
        if (genre && s.genre!==genre) return false;
        if (keyFilter === '_maj' && s.keyMode !== 'maj') return false;
        else if (keyFilter === '_min' && s.keyMode !== 'min') return false;
        else if (keyFilter && keyFilter !== '_maj' && keyFilter !== '_min' && s.key !== keyFilter) return false;
        if (tempoRange) { const bpm=s.tempo||s.bpm||120; if (tempoRange==='slow'&&bpm>80) return false; if (tempoRange==='mid'&&(bpm<=80||bpm>120)) return false; if (tempoRange==='fast'&&(bpm<=120||bpm>160)) return false; if (tempoRange==='vfast'&&bpm<=160) return false; }
        return true;
      });
      songs.sort((a,b) => { switch(sort) { case 'newest':return (b.createdAt||'').localeCompare(a.createdAt||''); case 'oldest':return (a.createdAt||'').localeCompare(b.createdAt||''); case 'title':return (a.title||'').localeCompare(b.title||'','fa'); case 'artist':return (a.artist||'').localeCompare(b.artist||'','fa'); case 'lastEdit':return (b.updatedAt||'').localeCompare(a.updatedAt||''); case 'lastOpen':return (b.lastOpenedAt||'').localeCompare(a.lastOpenedAt||''); case 'key':return (a.key||'').localeCompare(b.key||''); case 'bpm':return (a.tempo||0)-(b.tempo||0); default:return 0; } });
      $('archiveResultCount').textContent=songs.length+' نتیجه';
      const isTrash=_archCurrentTab==='trash';
      $('archiveStatusText').textContent=isTrash?'سطل زباله':_archCurrentTab==='fav'?'علاقه‌مندی‌ها':'همه ترانه‌ها';
      $('archiveFilterBar').style.display=isTrash?'none':'';
      const list = $('archiveList');
      list.innerHTML = '';
      if (!songs.length) {
        getArchiveRenderService().renderEmpty(list, {
          query: q,
          isTrash,
          currentTab: _archCurrentTab
        });
        return;
      }
      getArchiveRenderService().render(list, songs, {
        viewMode: _archViewMode,
        selectMode: _archSelectMode,
        selectedIds: _archSelectedIds,
        activeId: getArchiveSongOrNull()?.id
      });
    }
    function escH(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

    // --- Load Song (Main) ---
    async function archLoadSong(id) {
      if (_archLoading) return;
      _archLoading = true;
      try {
        const songs = edGetAllSongs();
        const s = songs.find(x => String(x.id) === String(id));
        if (!s || s.deletedAt) { toast('ترانه یافت نشد'); _archLoading=false; return; }
        toast('در حال باز کردن ترانه...');
        // Parse rawText if lyrics/chords are missing (bulk import case)
        ensureSongParsed(s);
        // Check unsaved changes: history length > 1 means user made changes after loading
        if (getArchiveSongOrNull() && historyLength() > 1) {
          const ok = await archConfirm('پروژه ذخیره نشده', 'تغییرات ذخیره‌نشده‌ای وجود دارد. آیا می‌خواهید قبل از لود ذخیره کنید؟', 'ذخیره و لود', false);
          if (ok) await edSaveToArchive();
        }
        // Close archive FIRST to prevent any UI blocking
        archClose();
        // Load project
        await loadProjectData(s);
        // Update lastOpenedAt
        const all2 = edGetAllSongs();
        const idx2 = all2.findIndex(x => String(x.id) === String(getArchiveSong().id));
        if (idx2 > -1) { all2[idx2].lastOpenedAt = new Date().toISOString(); edSetAllSongs(all2); }
        toast('پروژه لود شد: ' + (getArchiveSong().title || 'بدون نام'));
      } catch(err) {
        console.error('Archive load error:', err);
        toast('خطا در لود ترانه: ' + (err.message || 'خطای ناشناخته'));
        // Do NOT close archive on error
      } finally {
        _archLoading = false;
      }
    }
    function edLoadFromArchive(id) { archLoadSong(id); }

    // --- Load Read-Only ---
    async function archLoadSongReadOnly(id) {
      if (_archLoading) return;
      _archLoading = true;
      try {
        const songs = edGetAllSongs();
        const s = songs.find(x => String(x.id) === String(id));
        if (!s || s.deletedAt) { toast('ترانه یافت نشد'); _archLoading=false; return; }
        toast('در حال باز کردن ترانه...');
        // Parse rawText if lyrics/chords are missing (bulk import case)
        ensureSongParsed(s);
        archClose();
        await loadProjectData(s);
        // Enable read-only mode
        if (typeof editorState !== 'undefined') editorState.readOnly = true;
        else window._editorReadOnly = true;
        const all2 = edGetAllSongs();
        const idx2 = all2.findIndex(x => String(x.id) === String(getArchiveSong().id));
        if (idx2 > -1) { all2[idx2].lastOpenedAt = new Date().toISOString(); edSetAllSongs(all2); }
        // Show read-only banner
        archShowReadOnlyBanner();
        toast('ترانه در حالت فقط‌خواندنی باز شد');
      } catch(err) {
        console.error('Archive readonly load error:', err);
        toast('خطا در لود ترانه: ' + (err.message || 'خطای ناشناخته'));
      } finally { _archLoading = false; }
    }
    function archShowReadOnlyBanner() {
      let banner = $('readOnlyBanner');
      if (!banner) { banner = document.createElement('div'); banner.id = 'readOnlyBanner'; banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(255,165,0,0.95);color:#000;text-align:center;padding:8px;font-weight:700;font-size:0.85rem;display:flex;justify-content:center;align-items:center;gap:12px;'; document.body.appendChild(banner); }
      banner.innerHTML = '👁 حالت فقط‌خواندنی | <button data-action="archExitReadOnly" style="background:#000;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:700;" type="button">خروج از فقط‌خواندنی</button> <button data-action="archCreateEditableCopy" style="background:#fff;color:#000;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:700;" type="button">ایجاد نسخه قابل ویرایش</button>';
      if (!banner._actionListenerAttached) {
        const actions = {
          archExitReadOnly,
          archCreateEditableCopy
        };
        banner.addEventListener('click', event => {
          const control = event.target.closest('[data-action]');
          if (!control) return;
          const action = actions[control.dataset.action];
          if (typeof action === 'function') action(event, control);
        });
        banner._actionListenerAttached = true;
      }
      banner.style.display = 'flex';
    }
    function archExitReadOnly() {
      if (typeof editorState !== 'undefined') editorState.readOnly = false;
      else window._editorReadOnly = false;
      const b = $('readOnlyBanner'); if (b) b.remove();
      toast('حالت فقط‌خواندنی غیرفعال شد');
    }
    async function archCreateEditableCopy() {
      const sourceSong = getArchiveSongOrNull();
      if (!sourceSong) return;
      archExitReadOnly();
      const copy = JSON.parse(JSON.stringify(sourceSong));
      copy.id = archGenId();
      copy.title = (copy.title || 'بدون نام') + ' (نسخه قابل ویرایش)';
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = new Date().toISOString();
      const songs = edGetAllSongs(); songs.unshift(copy); edSetAllSongs(songs);
      setEditorSong(copy);
      toast('نسخه قابل ویرایش ساخته شد');
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
      _archCtxSongId=id; const menu=$('archiveCtxMenu');
      menu.style.left=Math.min(e.clientX,window.innerWidth-220)+'px';
      menu.style.top=Math.min(e.clientY,window.innerHeight-300)+'px';
      menu.classList.add('show'); e.stopPropagation();
    }
    async function archCtxAction(action) {
      $('archiveCtxMenu').classList.remove('show'); const id=_archCtxSongId; if (!id) return;
      archDispatchAction(action, id, {stopPropagation:()=>{}});
    }

    // --- Duplicate ---
    async function archDuplicateSong(id) {
      return getArchiveMutationService().duplicate(id);
    }

    // --- Edit Metadata ---
    function archEditOpen(id) {
      const songs=edGetAllSongs(); const s=songs.find(x=>String(x.id)===String(id)); if (!s) return;
      _archEditSongId=id;
      $('aeTitle').value=s.title||''; $('aeArtist').value=s.artist||''; $('aeAlbum').value=s.album||'';
      $('aeKey').value=s.key||'C'; $('aeKeyMode').value=s.keyMode||'maj';
      $('aeBpm').value=s.tempo||s.bpm||120; $('aeTimeSig').value=s.timeSignature||'4/4';
      $('aeGenre').value=s.genre||''; $('aeCategory').value=(s.categories||[]).join(', ');
      $('aeNotes').value=s.notes||'';
      const ks=$('aeKey'); if (ks.options.length<=1) ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].forEach(n=>ks.add(new Option(n,n)));
      $('archiveEditOverlay').classList.add('show');
    }
    function archEditClose() { $('archiveEditOverlay').classList.remove('show'); _archEditSongId=null; }
    function archEditSave() {
      if (!_archEditSongId) return;
      archPushUndo('ویرایش مشخصات'); const songs=edGetAllSongs(); const s=songs.find(x=>String(x.id)===String(_archEditSongId));
      if (!s) return;
      s.title=$('aeTitle').value.trim()||'بدون نام'; s.artist=$('aeArtist').value.trim(); s.artistKey=archArtistKey(s.artist); s.album=$('aeAlbum').value.trim();
      s.key=$('aeKey').value; s.keyMode=$('aeKeyMode').value; s.tempo=parseInt($('aeBpm').value)||120; s.bpm=s.tempo;
      s.timeSignature=$('aeTimeSig').value; s.genre=$('aeGenre').value;
      s.categories=$('aeCategory').value.split(',').map(c=>c.trim()).filter(Boolean);
      s.notes=$('aeNotes').value.trim(); s.updatedAt=new Date().toISOString();
      edSetAllSongs(songs); archResetSearchCache(); _archArtistCache=null; archEditClose(); archRender(); archRenderArtists(); archUpdateActiveFilters(); toast('مشخصات به‌روزرسانی شد');
    }

    // --- Refresh ---
    function archRefresh() { archResetSearchCache(); _archArtistCache=null; archMigrate(edGetAllSongs()); archRender(); archRenderArtists(); toast('آرشیو تازه‌سازی شد'); }

    // ===== ARTIST SLIDER SYSTEM =====
    let _archArtistCache = null;
    let _archArtistFilter = null;
    let _archArtistSectionCollapsed = localStorage.getItem('arch_artists_collapsed') === 'true';
    let _archFullscreen = false;

    // ===== DEFAULT ARTISTS =====
const DEFAULT_ARTISTS = [
  {
    id: "hayedeh",
    displayName: "هایده",
    normalizedName: "hayedeh",
    aliases: ["هایده", "هايده", "Hayedeh", "hayedeh", "Haydeh", "haydeh", "حیدری"],
    image: { type: "bundled", src: "./assets/artists/hayedeh.jpg" },
    favorite: false
  },
  {
    id: "googoosh",
    displayName: "گوگوش",
    normalizedName: "googoosh",
    aliases: ["گوگوش", "Googoosh", "googoosh", "Googosh", "googosh", "بیژن"],
    image: { type: "bundled", src: "./assets/artists/googosh.jpg" },
    favorite: false
  },
  {
    id: "dariush",
    displayName: "داریوش",
    normalizedName: "dariush",
    aliases: ["داریوش", "Dariush", "dariush", "اقبال"],
    image: { type: "bundled", src: "./assets/artists/dariush.jpg" },
    favorite: false
  },
  {
    id: "ebi",
    displayName: "ابی",
    normalizedName: "ebi",
    aliases: ["ابی", "Ebi", "ebi", "EBI", "ابی ابراهیمی"],
    image: { type: "bundled", src: "./assets/artists/ebi.jpg" },
    favorite: false
  },
  {
    id: "siavash-ghomayshi",
    displayName: "سیاوش قمیشی",
    normalizedName: "siavash-ghomayshi",
    aliases: ["سیاوش قمیشی", "Siavash Ghomayshi", "siavash-ghomayshi", "قمیشی"],
    image: { type: "bundled", src: "./assets/artists/siavash-ghomayshi.jpg" },
    favorite: false
  },
  {
    id: "moein",
    displayName: "معین",
    normalizedName: "moein",
    aliases: ["معین", "Moein", "moein", "کاشانی"],
    image: { type: "bundled", src: "./assets/artists/moein.jpg" },
    favorite: false
  },
  {
    id: "habib",
    displayName: "حبیب",
    normalizedName: "habib",
    aliases: ["حبیب", "Habib", "habib", "موحد"],
    image: { type: "bundled", src: "./assets/artists/habib.jpg" },
    favorite: false
  },
  {
    id: "mahasti",
    displayName: "مهستی",
    normalizedName: "mahasti",
    aliases: ["هاشمی"],
    image: { type: "bundled", src: "./assets/artists/mahasti.jpg" },
    favorite: false
  },
  {
    id: "aref",
    displayName: "عارف",
    normalizedName: "aref",
    aliases: ["_avlazm"],
    image: { type: "bundled", src: "./assets/artists/aref.jpg" },
    favorite: false
  },
  {
    id: "farhamz-aslani",
    displayName: "فرامرز اصلانی",
    normalizedName: "farhamz-aslani",
    aliases: ["فرامرز", "اصلانی", "فرامرز اصلانی"],
    image: { type: "bundled", src: "./assets/artists/farhamz-aslani.jpg" },
    favorite: false
  },
  {
    id: "martik",
    displayName: "مارتیک",
    normalizedName: "martik",
    aliases: ["ترپتیان"],
    image: { type: "bundled", src: "./assets/artists/martik.jpg" },
    favorite: false
  },
  {
    id: "sheyad-ghambari",
    displayName: "شهیار قنبری",
    normalizedName: "sheyad-ghambari",
    aliases: ["قنبری"],
    image: { type: "bundled", src: "./assets/artists/sheyad-ghambari.jpg" },
    favorite: false
  },
  {
    id: "andy",
    displayName: "اندی",
    normalizedName: "andy",
    aliases: ["سیسجنگ"],
    image: { type: "bundled", src: "./assets/artists/andy.jpg" },
    favorite: false
  },
  {
    id: "leila-forouhar",
    displayName: "لیلا فروهر",
    normalizedName: "leila-forouhar",
    aliases: ["فروهر"],
    image: { type: "bundled", src: "./assets/artists/leila-forouhar.jpg" },
    favorite: false
  },
  {
    id: "sattar",
    displayName: "ستار",
    normalizedName: "sattar",
    aliases: ["صدرالدین"],
    image: { type: "bundled", src: "./assets/artists/sattar.jpg" },
    favorite: false
  },
  {
    id: "farhad",
    displayName: "فرهاد",
    normalizedName: "farhad",
    aliases: ["شکیبا"],
    image: { type: "bundled", src: "./assets/artists/farhad.jpg" },
    favorite: false
  },
  {
    id: "shohreh",
    displayName: "شهره",
    normalizedName: "shohreh",
    aliases: ["سعادتمند"],
    image: { type: "bundled", src: "./assets/artists/shohreh.jpg" },
    favorite: false
  },
  {
    id: "marjan",
    displayName: "مرجان",
    normalizedName: "marjan",
    aliases: ["سعادت‌مند"],
    image: { type: "bundled", src: "./assets/artists/marjan.jpg" },
    favorite: false
  },
  {
    id: "homaira",
    displayName: "حمیرا",
    normalizedName: "homaira",
    aliases: [],
    image: { type: "bundled", src: "./assets/artists/homaira.jpg" },
    favorite: false
  },
  {
    id: "vigen",
    displayName: "ویگن",
    normalizedName: "vigen",
    aliases: ["دردیریان"],
    image: { type: "bundled", src: "./assets/artists/vigen.jpg" },
    favorite: false
  },
  {
    id: "kourosh-yaghmaei",
    displayName: "کوروش یغمایی",
    normalizedName: "kourosh-yaghmaei",
    aliases: ["یغمایی"],
    image: { type: "bundled", src: "./assets/artists/kourosh-yaghmaei.jpg" },
    favorite: false
  }
];



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
          getDefaultArtists: () => DEFAULT_ARTISTS,
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
  if (!artistKey) return '';

  const normalizedKey = String(artistKey).trim().toLowerCase();

  if (Array.isArray(DEFAULT_ARTISTS)) {
    const artist = DEFAULT_ARTISTS.find((item) => {
      if (String(item.id || '').trim().toLowerCase() === normalizedKey) return true;
      if (String(item.normalizedName || '').trim().toLowerCase() === normalizedKey) return true;
      return Array.isArray(item.aliases) && item.aliases.some((alias) =>
        String(alias || '').trim().toLowerCase() === normalizedKey
      );
    });

    if (artist?.displayName) return artist.displayName;
  }

  const manualMap = {
    hayedeh: 'هایده',
    googoosh: 'گوگوش',
    dariush: 'داریوش',
    ebi: 'ابی',
    'siavash-ghomayshi': 'سیاوش قمیشی',
    moein: 'معین',
    habib: 'حبیب',
    mahasti: 'مهستی',
    aref: 'عارف',
    'farhamz-aslani': 'فرامز اصلانی',
    martik: 'مارتیک',
    'sheyad-ghambari': 'شهیار قنبری',
    andy: 'اندی',
    'leila-forouhar': 'لیلا فروهر',
    sattar: 'ستار',
    farhad: 'فرهاد',
    shohreh: 'شهره',
    marjan: 'مرجان',
    homaira: 'حمیرا',
    vigen: 'ویگن',
    'kourosh-yaghmaei': 'کوروش یغمایی',
  };

  return manualMap[normalizedKey] || artistKey;
}

// --- ۲. تنها نسخه تابع رندر فیلتر (مطمئن شو نسخه دیگری در فایل نباشد) ---
function archUpdateActiveFilters() {
  const container = $('archiveActiveFilters');
  if (!container) return;

  container.innerHTML = '';

  if (_archArtistFilter) {
    const chip = document.createElement('span');
    chip.className = 'aaf-chip';

    const displayName = getArtistDisplayName(_archArtistFilter);

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
      if (typeof clearEditorProjectFilePath === 'function') {
        clearEditorProjectFilePath();
      }
      pauseTransport();
stopAllVoices();

setEditorSong(edBlankSong());

resetHistory();
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
isRecordingChords = false;
currentRecordingClipId = null;

// Reset tracks to defaults
daw.tracks = [
  { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
  { id: 't1', name: 'Vocals', icon: '🎤', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
  { id: 't2', name: 'Guitar', icon: '🎸', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
  { id: 't3', name: 'Bass', icon: '🎵', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
  { id: 't4', name: 'Keys', icon: '🎹', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
  { id: 't5', name: 'Drums', icon: '🥁', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 }
];
ensureAudioCtx();
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

edSyncToolbar();
edRenderEditor(true);
renderAll();
saveState();

      // Update loop toggle button state
      const loopBtn2 = $('loopToggleBtn');
      if (loopBtn2) loopBtn2.classList.remove('loop-active');

      // Apply highlight effect (default)
      initHighlightEffect();

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
      if (typeof edExportProjectFull === 'function') {
        return edExportProjectFull();
      }
      toast('سرویس خروجی پروژه هنوز آماده نیست');
    }

    async function edExportXML() {
      const song = getArchiveSongOrNull();
      if (!song) { toast('ترانه‌ای باز نیست'); return; }
      SongMetadata.syncFromDom(song, {includeKey: false});

      const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<song>\n';
      xml += `  <title>${esc(song.title)}</title>\n`;
      xml += `  <artist>${esc(song.artist)}</artist>\n`;
      xml += `  <key>${esc(song.key)}${song.keyMode === 'min' ? 'm' : ''}</key>\n`;
      xml += `  <timeSignature>${esc(song.timeSignature)}</timeSignature>\n`;
      xml += `  <tempo>${song.tempo || 120}</tempo>\n`;
      xml += `  <genre>${esc(song.genre)}</genre>\n`;
      xml += `  <transpose>${song.transpose || 0}</transpose>\n`;

      // Chords
      xml += '  <chords>\n';
      (song.chords || []).forEach(ch => {
        xml += `    <chord name="${esc(ch.name)}" line="${ch.lineIndex}" char="${ch.charIndex}" anchor="${esc(ch.anchorType)}" />\n`;
      });
      xml += '  </chords>\n';

      // Lyrics line by line
      xml += '  <lyrics>\n';
      (song.lyrics || '').split('\n').forEach((line, i) => {
        xml += `    <line index="${i}">${esc(line)}</line>\n`;
      });
      xml += '  </lyrics>\n';

      // Styles
      const st = song.styles || {};
      xml += '  <styles>\n';
      xml += `    <text size="${st.tSize||23}" color="${esc(st.tColor||'#0fa966')}" font="${esc(st.tFont||'Vazirmatn')}" bold="${st.tBold?'true':'false'}" align="${esc(st.align||'center')}" />\n`;
      xml += `    <chord size="${st.cSize||23}" color="${esc(st.cColor||'#e6aa28')}" font="${esc(st.cFont||'JetBrains Mono')}" />\n`;
      xml += '  </styles>\n';

      xml += '</song>';

      const defaultName = (song.title || 'ترانه جدید') + '.xml';
      const blob = new Blob([xml], { type: 'application/xml' });

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: defaultName,
            types: [{ description: 'فایل XML', accept: { 'application/xml': ['.xml'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast('خروجی XML ذخیره شد');
          return;
        } catch (e) { if (e.name === 'AbortError') return; }
      }
      // Fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = defaultName; a.click(); URL.revokeObjectURL(url);
      toast('خروجی XML ذخیره شد');
    }

    // Import — loads metadata, then asks user to select audio files
    async function edImportProject() {
      const daw = getArchiveDAW();
      const input = $('import-file-input');
      input.value = '';
      input.onchange = async (e) => {
        const files = e.target.files;
        if (!files || !files.length) return;
        if (files.length === 1) {
          // Single file: load as current project (existing behavior)
          const file = files[0];
          try {
            if (file._projectFilePath) {
              setEditorProjectFilePath(file._projectFilePath);
            } else if (typeof clearEditorProjectFilePath === 'function') {
              clearEditorProjectFilePath();
            }
            toast('در حال لود پروژه...');
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data || typeof data !== 'object') throw new Error('Invalid');
            pauseTransport(); stopAllVoices();
            daw.clips = []; daw.sections = []; daw.selectedIds.clear(); daw.selectedSectionIds = new Set(); daw.bufferCache.clear(); daw.waveCache.clear();
            daw.loopEnabled = false; daw.loopA = 0; daw.loopB = 10;
            daw.arrangerMarkers = { enabled: false, start: 0, end: 0 };
            setEditorSong(data);
            const song = getArchiveSong();
            if (!song.styles) song.styles = {};
            const defaults = { tSize:38,tColor:'#0fa966',tFont:'Vazirmatn',tBold:true,align:'center', cSize:38,cColor:'#e6aa28',cFont:'JetBrains Mono' };
            Object.keys(defaults).forEach(k => { if (song.styles[k] === undefined) song.styles[k] = defaults[k]; });
            if (!song.timeSignature) song.timeSignature = '4/4';
            if (!song.tempo) song.tempo = 120;
            if (!song.genre) song.genre = '';

            // Auto-import raw format: has rawText but no lyrics/chords → parse it
            if (song.rawText && !song.lyrics) {
              _importParsed = song;
              $('importText').value = song.rawText;
              $('importUrl').value = song.url || '';
              applyImportChords();
              _importParsed = null;
            }

            if (song._dawTracks) daw.tracks = JSON.parse(JSON.stringify(song._dawTracks));
            if (song._dawClips) daw.clips = JSON.parse(JSON.stringify(song._dawClips));
            if (song._dawSections) daw.sections = JSON.parse(JSON.stringify(song._dawSections)); else daw.sections = [];
            updateNextIdFromClips();
            // Migrate any old section clips from daw.clips to daw.sections
            const _impOldSections = daw.clips.filter(c => c.type === 'section');
            if (_impOldSections.length > 0) {
              _impOldSections.forEach(c => { daw.sections.push({ id: c.id, trackId: c.trackId, label: c.name, start: c.start, duration: c.duration, color: c.color }); });
              daw.clips = daw.clips.filter(c => c.type !== 'section');
            }
            if (song._dawLoop) { daw.loopEnabled = !!song._dawLoop.loopEnabled; daw.loopA = song._dawLoop.loopA||0; daw.loopB = song._dawLoop.loopB||10; }
            daw.arrangerMarkers = getArchiveArrangerMarkers(song);
            ensureAudioCtx();
            daw.tracks.forEach(tr => {
              if (tr.type === 'audio') {
                if (tr.transpose === undefined) tr.transpose = 0;
                tr._pannerNode = daw.audioCtx.createStereoPanner(); tr._gainNode = daw.audioCtx.createGain();
                tr._pannerNode.connect(tr._gainNode); tr._gainNode.connect(daw.masterGain); updateTrackMix(tr.id);
              }
            });
            resetHistory(); resetPerformanceSerialization();
            edSyncToolbar(); edRenderEditor(true);
            initHighlightEffect();
            const loopBtn = $('loopToggleBtn');
            if (loopBtn) loopBtn.classList.toggle('loop-active', daw.loopEnabled);

            // First: try loading audio from IndexedDB (same browser/session)
            const audioClips = daw.clips.filter(c => c.type !== 'chord');
            if (audioClips.length > 0) {
              try {
                await loadAudioBlobsForProject(song.id);
              } catch(e) {}

              // Re-create waveforms for clips that have buffers
              daw.clips.forEach(c => {
                if (c.type !== 'chord' && c.bufferKey && daw.bufferCache.has(c.bufferKey)) {
                  const buffer = daw.bufferCache.get(c.bufferKey);
                  c.sourceDuration = buffer.duration;
                  c._peaks = peaksFromBuffer(buffer, 2000);
                  refreshClipWaveImage(c);
                }
              });

              // Second: restore from embedded audio in backup file
              const stillMissing = audioClips.filter(c => c.bufferKey && !daw.bufferCache.has(c.bufferKey));
              if (stillMissing.length > 0 && song._embeddedAudio && Object.keys(song._embeddedAudio).length > 0) {
                ensureAudioCtx();
                let restored = 0;
                for (const clip of stillMissing) {
                  const embedded = song._embeddedAudio[clip.bufferKey];
                  if (!embedded) continue;
                  try {
                    let buf;
                    if (embedded.format === 'wav' || embedded.format === 'webm-opus') {
                      const audioData = base64ToUint8(embedded.data);
                      buf = await decodeWebMToBuffer(audioData);
                    } else if (embedded.format === 'float32-b64') {
                      const numCh = embedded.channels || 1;
                      buf = daw.audioCtx.createBuffer(numCh, embedded.length, embedded.sampleRate);
                      for (let i = 0; i < numCh; i++) {
                        const chBytes = base64ToUint8(embedded.data[i]);
                        buf.getChannelData(i).set(new Float32Array(chBytes.buffer));
                      }
                    } else if (embedded.format === 'opus-b64') {
                      const compressed = base64ToUint8(embedded.data);
                      const decompressed = await decompressBytes(compressed);
                      const int16 = new Int16Array(decompressed.buffer);
                      const float32 = new Float32Array(int16.length);
                      for (let j = 0; j < int16.length; j++) float32[j] = int16[j] < 0 ? int16[j] / 0x8000 : int16[j] / 0x7FFF;
                      const upsampled = resampleFloat32(float32, embedded.sampleRate, embedded.originalSampleRate || embedded.sampleRate);
                      const ch = embedded.originalChannels || 1;
                      buf = daw.audioCtx.createBuffer(ch, upsampled.length, embedded.originalSampleRate || embedded.sampleRate);
                      for (let c = 0; c < ch; c++) buf.getChannelData(c).set(upsampled);
                    } else if (embedded.format === 'int16b64') {
                      const channels = Array.isArray(embedded.data) ? embedded.data : [embedded.data];
                      buf = daw.audioCtx.createBuffer(channels.length, embedded.length, embedded.sampleRate);
                      channels.forEach((chB64, i) => {
                        if (i < buf.numberOfChannels) {
                          const bytes = base64ToUint8(chB64);
                          const int16 = new Int16Array(bytes.buffer);
                          const float32 = new Float32Array(int16.length);
                          for (let j = 0; j < int16.length; j++) float32[j] = int16[j] < 0 ? int16[j] / 0x8000 : int16[j] / 0x7FFF;
                          buf.getChannelData(i).set(float32);
                        }
                      });
                    } else {
                      const chData = Array.isArray(embedded.data) ? embedded.data : [embedded.data];
                      buf = daw.audioCtx.createBuffer(chData.length, embedded.length, embedded.sampleRate);
                      chData.forEach((ch, i) => { if (i < buf.numberOfChannels && ch) buf.getChannelData(i).set(new Float32Array(ch)); });
                    }
                    daw.bufferCache.set(clip.bufferKey, buf);
                    clip.sourceDuration = buf.duration;
                    clip._peaks = peaksFromBuffer(buf, 2000);
                    refreshClipWaveImage(clip);
                    restored++;
                  } catch(_) {}
                }
                if (restored > 0) toast(`بازیابی صدا: ${restored} فایل از بکآپ`);
                saveAudioBlobsForProject(song.id).catch(() => {});
              }

              // Third: if still missing, try loading from file paths then directory
              const stillMissing2 = audioClips.filter(c => c.bufferKey && !daw.bufferCache.has(c.bufferKey));
              if (stillMissing2.length > 0 && song._audioPaths && song._audioPaths.length > 0) {
                // اول از filePath (Electron) لود کن
                if (isElectron && window.electronAPI) {
                  for (const ap of song._audioPaths) {
                    if (!ap.filePath) continue;
                    const clip = daw.clips.find(c => c.type !== 'chord' && c.bufferKey === ap.bufferKey);
                    if (!clip || daw.bufferCache.has(clip.bufferKey)) continue;
                    try {
                      console.log('[LINK] Import: Loading from path:', ap.filePath);
                      const audioBuffer = await loadAudioFromHardDrive(ap.filePath);
                      daw.bufferCache.set(clip.bufferKey, audioBuffer);
                      clip.sourceDuration = audioBuffer.duration;
                      clip._peaks = peaksFromBuffer(audioBuffer, 2000);
                      clip._filePath = ap.filePath;
                      refreshClipWaveImage(clip);
                    } catch (e) {
                      console.warn('[LINK] Import: File not found:', ap.filePath, e.message);
                    }
                  }
                }
                // لود از FileHandle ذخیره‌شده در IndexedDB
                const stillAfterPath3 = audioClips.filter(c => c.bufferKey && !daw.bufferCache.has(c.bufferKey));
                if (stillAfterPath3.length > 0) {
                  for (const clip of stillAfterPath3) {
                    try {
                      const handle = await getFileHandle(clip.bufferKey);
                      if (!handle) continue;
                      const perm = await handle.requestPermission({ mode: 'read' });
                      if (perm !== 'granted') continue;
                      const file = await handle.getFile();
                      const { buffer } = await decodeFileToBuffer(file);
                      daw.bufferCache.set(clip.bufferKey, buffer);
                      clip.sourceDuration = buffer.duration;
                      clip._peaks = peaksFromBuffer(buffer, 2000);
                      refreshClipWaveImage(clip);
                      console.log('[HANDLE] Auto-reloaded (import):', clip.fileName);
                    } catch(e) { console.warn('[HANDLE] Auto-reload failed:', clip.bufferKey); }
                  }
                }
                // بعد از پوشه لود کن
                const stillMissing3 = audioClips.filter(c => c.bufferKey && !daw.bufferCache.has(c.bufferKey));
                if (stillMissing3.length > 0) {
                  let dirHandle = _audioDirHandle;
                  if (!dirHandle) { try { await loadDirHandle(); dirHandle = _audioDirHandle; } catch(_){} }
                  if (!dirHandle) {
                    try {
                      dirHandle = await window.showDirectoryPicker({ mode: 'read' });
                      await saveDirHandle(dirHandle);
                    } catch(_) {}
                  }
                  if (dirHandle) {
                    const perm = await dirHandle.requestPermission({ mode: 'read' });
                    if (perm === 'granted') {
                      const notFound = [];
                      for (const ap of song._audioPaths) {
                        const clip = daw.clips.find(c => c.type !== 'chord' && c.bufferKey === ap.bufferKey);
                        if (!clip || daw.bufferCache.has(clip.bufferKey)) continue;
                        const candidates = [ap.fileName, ap.fileName ? ap.fileName.replace(/\.[^.]+$/, '') : ''];
                        let loaded = false;
                        for (const name of candidates) {
                          if (!name) continue;
                          try {
                            const fileHandle = await dirHandle.getFileHandle(name);
                            const file = await fileHandle.getFile();
                            const { buffer } = await decodeFileToBuffer(file);
                            daw.bufferCache.set(clip.bufferKey, buffer);
                            clip.sourceDuration = buffer.duration;
                            clip._peaks = peaksFromBuffer(buffer, 2000);
                            refreshClipWaveImage(clip);
                            loaded = true;
                            break;
                          } catch(_) {}
                        }
                        if (!loaded) notFound.push(ap.fileName || ap.name || 'نام‌ناشناخته');
                      }
                      if (notFound.length > 0) {
                        toast('فایل‌های صوتی پیدا نشد: ' + notFound.join(', '));
                      }
                    }
                  }
                }
              }
            }

            // Re-create waveforms for all clips that have buffers
            daw.clips.forEach(c => {
              if (c.type !== 'chord' && c.bufferKey && daw.bufferCache.has(c.bufferKey) && !c._peaks) {
                const buffer = daw.bufferCache.get(c.bufferKey);
                c.sourceDuration = buffer.duration;
                c._peaks = peaksFromBuffer(buffer, 2000);
                refreshClipWaveImage(c);
              }
            });

            await saveAudioBlobsForProject(song.id).catch(e => console.warn('Audio save error:', e));
            saveState();
            edSaveSong();
            renderAll();
            toast('پروژه لود شد: ' + file.name);
          } catch (err) { console.error(err); toast('خطا در لود فایل!'); }
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
              edSaveSong();
            }
          } catch(err) { console.error('Load last file error:', err); }
          toast(`${added} وارد شد، ${updated} به‌روزرسانی` + (errors ? `، ${errors} خطا` : ''));
          edOpenArchive();
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
