// ==========================================
// PART 4: Timeline Rendering & UI Event Listeners
// ==========================================

// Keep selection state initialized before DOM setup can register handlers.
const editorAppRuntime = window.EditorRuntimeAdapter;
if (!editorAppRuntime?.getDAWOrThrow) {
  throw new Error(
    'EditorRuntimeAdapter باید قبل از app/editor.js بارگذاری شود.'
  );
}
const editorGetRuntimeDAW = () => editorAppRuntime.getDAWOrThrow();
const editorPublicApiRegistry = window.EditorPublicApi;
if (!editorPublicApiRegistry?.create) {
  throw new Error(
    'EditorPublicApi باید قبل از app/editor.js بارگذاری شود.'
  );
}
const editorPublicApi = editorPublicApiRegistry.create({
  target: window,
  namespace: 'AkordyarEditorApi'
});
const editorCoreApi = window.AkordyarCoreApi;
if (!editorCoreApi) {
  throw new Error(
    'AkordyarCoreApi باید قبل از app/editor.js بارگذاری شود.'
  );
}
const editorArchiveApi = window.AkordyarArchiveApi;
if (!editorArchiveApi) {
  throw new Error(
    'AkordyarArchiveApi باید قبل از app/editor.js بارگذاری شود.'
  );
}
const editorArchiveCall = (name, ...args) => {
  const fn = editorArchiveApi[name];
  return typeof fn === 'function' ? fn(...args) : undefined;
};
const editorGetArchiveSongs = (...args) =>
  editorArchiveCall('getAllSongs', ...args) || [];
const editorSetArchiveSongs = (...args) =>
  editorArchiveCall('setAllSongs', ...args);
const editorArchiveArtistKey = (...args) =>
  editorArchiveCall('artistKey', ...args) || '';
const editorArchiveAudioDirHandle = (...args) =>
  editorArchiveCall('getAudioDirHandle', ...args) || null;
const editorLoadArchiveDirHandle = (...args) =>
  editorArchiveCall('loadDirHandle', ...args);
const editorSaveArchiveDirHandle = (...args) =>
  editorArchiveCall('saveDirHandle', ...args);
const editorGetLyricPopup = (...args) =>
  editorCoreApi.getLyricPopup?.(...args) || null;
const editorGetLyricOnlyPopup = (...args) =>
  editorCoreApi.getLyricOnlyPopup?.(...args) || null;
const editorSyncLyricPopup = (...args) =>
  editorCoreApi.syncLyricPopup?.(...args);
const editorSyncLyricOnlyPopup = (...args) =>
  editorCoreApi.syncLyricOnlyPopup?.(...args);
const editorOpenLyricPopup = (...args) =>
  editorCoreApi.openLyricPopup?.(...args);
const editorOpenLyricOnlyPopup = (...args) =>
  editorCoreApi.openLyricOnlyPopup?.(...args);
const editorToggleFocusMode = (...args) =>
  editorCoreApi.toggleFocusMode?.(...args);
const editorClearSelection = (...args) =>
  window.AkordyarCoreApi?.clearSelection?.(...args);
const editorSplitSelectedAtPlayhead = (...args) =>
  editorCoreApi.splitSelectedAtPlayhead?.(...args);
const editorDeleteSelected = (...args) =>
  editorCoreApi.deleteSelected?.(...args);
const editorCopySelected = (...args) =>
  editorCoreApi.copySelected?.(...args);
const editorCutSelected = (...args) =>
  editorCoreApi.cutSelected?.(...args);
const editorPasteClipboard = (...args) =>
  editorCoreApi.pasteClipboard?.(...args);
const editorSetSelection = (...args) =>
  editorCoreApi.setSelection?.(...args);
const editorDuplicateSelected = (...args) =>
  editorCoreApi.duplicateSelected?.(...args);
// bindingهای core.js در scope سراسری مشترکِ اسکریپت‌های classic حاضرند؛
// destructure کردن دوبارهٔ آن‌ها خطای redeclare در مرورگر ایجاد می‌کند.
const {
  ensureRecLane,
  toggleRec,
  applyTheme,
  applyAccent,
  applyOutputDevice,
  applyMetroSound,
  previewMetronomeSound,
  applySettingsToggles,
  openSettings,
  closeSettings,
  resetSettings,
  setHighlightEffect,
  initHighlightEffect,
  getPerformanceState,
  updatePerformanceState
} = editorCoreApi;
const editorAudioStorageRuntime = window.EditorAudioStorageRuntime;
if (!editorAudioStorageRuntime) {
  throw new Error(
    'EditorAudioStorageRuntime باید قبل از app/editor.js بارگذاری شود.'
  );
}
const {
  getAudioBlobFromDB,
  getFileHandle,
  loadAudioBlobsForProject,
  refreshStorageInfo,
  saveAudioBlobToDB,
  saveAudioBlobsForProject
} = editorAudioStorageRuntime;
const editorSyncAnalysisRuntime =
  window.EditorSyncAnalysisRuntimeService?.create?.({
    analysis: window.SyncAnalysis,
    getSongState: () => getEditorSongStateService(),
    performanceRef: window.performance,
    getElement: id => $(id),
    saveSong: (...args) => edSaveSong(...args),
    handleTimingChange: (...args) =>
      window.handleTimingChange?.(...args),
    syncToolbar: (...args) => edSyncToolbar(...args),
    renderEditor: (...args) => edRenderEditor(...args),
    toast: (...args) => toast(...args)
  });
if (!editorSyncAnalysisRuntime) {
  throw new Error(
    'EditorSyncAnalysisRuntimeService باید قبل از app/editor.js بارگذاری شود.'
  );
}

// تحلیل هوشمند صوت (تمپو/گام/آکورد) — موتور AudioAnalysisEngine + رابط ادیتور.
const editorAudioAnalysisRuntime =
  window.EditorAudioAnalysisRuntimeService?.create?.({
    engine: window.AudioAnalysisEngine,
    getDAW: () => editorGetRuntimeDAW(),
    getSong: getCurrentEditorSong,
    getSongState: () => getEditorSongStateService(),
    getElement: id => $(id),
    legacyRuntime: editorSyncAnalysisRuntime,
    restoreAudio: async () =>
      getEditorAudioRecoveryService()?.restoreSongAudio?.(
        getCurrentEditorSong()
      ) || { loaded: 0 },
    decodeFileToBuffer,
    transposeChordName: (name, semitones) =>
      window.TransposeService?.transposeChordName?.(name, semitones) || name,
    transposeKeyName: (key, semitones) =>
      window.TransposeService?.transposeKeyName?.(key, semitones) || key,
    saveSong: (...args) => edSaveSong(...args),
    saveState: (...args) => saveState(...args),
    commit: () => edCommit(),
    handleTimingChange: (...args) => handleTimingChange(...args),
    syncToolbar: (...args) => edSyncToolbar(...args),
    renderEditor: (...args) => edRenderEditor(...args),
    renderChords: (...args) => edRenderChords(...args),
    renderTracks: (...args) => renderTracks(...args),
    renderClips: (...args) => renderClips(...args),
    renderAll: (...args) => renderAll(...args),
    ensureTimelineFits: (...args) => ensureTimelineFits(...args),
    uid: (...args) => uid(...args),
    roundMs: (...args) => roundMs(...args),
    colors: COLORS,
    toast: (...args) => toast(...args)
  });
let edSelectedChords = [];
let editorColorToolService = null;
let editorKeyCommandController = null;

function getEditorKeyCommandController() {
  if (
    !editorKeyCommandController &&
    typeof window.EditorKeyCommandControllerService?.create === 'function'
  ) {
    editorKeyCommandController =
      window.EditorKeyCommandControllerService.create({
        getSong: getCurrentEditorSong,
        documentRef: document,
        storage: localStorage,
        notationService: window.EditorNotationService,
        transposeService: window.TransposeService,
        commandServiceFactory: window.EditorKeyCommandService,
        ensureBaseChordNamesAligned: song =>
          getEditorChordStateService()?.ensureBaseChordNamesAligned(song),
        renderChords: immediate => edRenderChords(immediate),
        renderEditor: rebuild => edRenderEditor(rebuild),
        syncTransposeToTimelineChords: () =>
          syncTransposeToTimelineChords(),
        saveSong: () => edSaveSong(),
        saveCurrentVersion: () => saveCurrentVersion(),
        rebuildPerformanceSongDocument: () => {
          if (typeof rebuildPerformanceSongDocument === 'function') {
            rebuildPerformanceSongDocument();
          }
        },
        toast,
        customPrompt: (...args) => customPrompt(...args)
      });
  }
  return editorKeyCommandController;
}

function getEditorColorToolService() {
  if (
    !editorColorToolService &&
    typeof window.EditorColorToolService?.create === 'function'
  ) {
    editorColorToolService = window.EditorColorToolService.create({
      documentRef: document,
      getElement: id => $(id),
      getDAW: () => editorGetRuntimeDAW(),
      getSongState: () => getEditorSongStateService(),
      getSelectedChords: () => edSelectedChords,
      getClip: id => getClip(id),
      getBaseClipMouseDown: () => onClipMouseDown,
      setClipMouseDown: handler => {
        onClipMouseDown = handler;
      },
      saveState: (...args) => saveState(...args),
      renderChords: (...args) => edRenderChords(...args),
      renderClips: (...args) => renderClips(...args),
      saveSong: (...args) => edSaveSong(...args),
      toast: (...args) => toast(...args)
    });
  }
  return editorColorToolService;
}

function isColorToolActive() {
  return getEditorColorToolService()?.isColorToolActive?.() || false;
}

function toggleColorTool(mode) {
  return getEditorColorToolService()?.toggleColorTool?.(mode);
}

function deactivateColorTool() {
  return getEditorColorToolService()?.deactivateColorTool?.();
}

function selectColor(color) {
  return getEditorColorToolService()?.selectColor?.(color);
}

function paintLyricChord(index, event = {}) {
  return getEditorColorToolService()?.paintLyricChord?.(index, event);
}

const editorPopupWindowService = window.PopupWindowService?.create?.({
  windowRef: window,
  windowBridge: window.WindowBridge
});

function editorPopupIsOpen(popup) {
  return (
    editorPopupWindowService?.isOpen?.(popup) ??
    Boolean(popup && !popup.closed)
  );
}

function editorPopupDocument(popup) {
  return editorPopupWindowService?.getDocument?.(popup) || null;
}

const editorPopupTimelineSyncService =
  window.EditorPopupTimelineSyncService?.create?.({
    documentRef: document,
    windowRef: window,
    bridge: window.WindowBridge,
    getPopup: () => editorGetLyricPopup(),
    isOpen: editorPopupIsOpen,
    getDocument: editorPopupDocument,
    getSong: () => window.EditorRuntimeAdapter?.getSong?.() || null,
    getDAW: () => editorGetRuntimeDAW(),
    getProjectEnd: () => getProjectEnd(),
    getTimeSignatureGridConfig: (signature, bpm) =>
      getTimeSignatureGridConfig(signature, bpm),
    timeToX: time => timeToX(time),
    getTransportPlayhead: () => getTransportPlayhead(),
    getTransportClockSnapshot: options =>
      getTransportClockSnapshot(options),
    logger: console
  });

function safeMirrorTimeline() {
  return editorPopupTimelineSyncService?.render?.();
}

let edSongTransitionService = null;
function getEditorSongTransitionService() {
  if (
    !edSongTransitionService &&
    typeof window.EditorSongTransitionService?.create === 'function'
  ) {
    edSongTransitionService = window.EditorSongTransitionService.create({
      getDAW: () => editorGetRuntimeDAW(),
      setSong: song => editorAppRuntime.setSong(song),
      repairSong: song => window.TextEncodingService?.repairSong?.(song) || song,
      ensureSongParsed: (...args) =>
        editorArchiveCall('ensureSongParsed', ...args),
      hydrationService: window.EditorHydrationService,
      updateNextIdFromClips,
      ensureAudioCtx,
      updateTrackMix,
      restoreAudio: (...args) => restoreAudioForProjectSilently(...args),
      logger: console
    });
  }
  return edSongTransitionService;
}

let edAudioRecoveryService = null;
function getEditorAudioRecoveryService() {
  if (
    !edAudioRecoveryService &&
    typeof window.AudioRecoveryService?.create === 'function'
  ) {
    edAudioRecoveryService = window.AudioRecoveryService.create({
      getDAW: () => editorGetRuntimeDAW(),
      getSong: () => getCurrentEditorSong(),
      loadAudioBlobsForProject,
      getAudioBlobFromDB,
      decodeFileToBuffer,
      loadAudioFromHardDrive,
      getFileHandle,
      getDirHandle: options => {
        if (options?.load) return editorLoadArchiveDirHandle();
        return editorArchiveAudioDirHandle();
      },
      setDirHandle: handle => editorSaveArchiveDirHandle(handle),
      saveDirHandle: handle => editorSaveArchiveDirHandle(handle),
      showDirectoryPicker: window.showDirectoryPicker,
      isElectron,
      electronAvailable: Boolean(window.electronAPI),
      peaksFromBuffer,
      refreshClipWaveImage,
      toast,
      logger: console
    });
  }
  return edAudioRecoveryService;
}

function restoreAudioForProjectSilently(projectId, silent = true) {
  return (
    getEditorAudioRecoveryService()?.restoreProjectAudio?.(projectId, silent) ||
    { loaded: 0, missing: 0, missingNames: [] }
  );
}

function preloadAudioForSong(songData) {
  return (
    getEditorAudioRecoveryService()?.preloadAudioForSong?.(songData) ||
    Promise.resolve({ loaded: 0, missing: 0, missingNames: [] })
  );
}

let edProjectExportService = null;
function getEditorProjectExportService() {
  if (
    !edProjectExportService &&
    typeof window.EditorProjectExportService?.create === 'function'
  ) {
    edProjectExportService = window.EditorProjectExportService.create({
      syncMetadata: (song, options) => SongMetadata.syncFromDom(song, options),
      logger: console
    });
  }
  return edProjectExportService;
}

let edProjectExportRouteService = null;
function getEditorProjectExportRouteService() {
  if (
    !edProjectExportRouteService &&
    typeof window.EditorProjectExportRouteService?.create === 'function'
  ) {
    edProjectExportRouteService = window.EditorProjectExportRouteService.create({
      getShowSaveFilePicker: () => window.showSaveFilePicker,
      getConfirm: () => window.confirm,
      documentRef: document,
      urlRef: window.URL,
      schedule: window.setTimeout,
      logger: console
    });
  }
  return edProjectExportRouteService;
}

let edProjectExportWorkflowService = null;
function getEditorProjectExportWorkflowService() {
  if (
    !edProjectExportWorkflowService &&
    typeof window.EditorProjectExportWorkflowService?.create === 'function'
  ) {
    edProjectExportWorkflowService =
      window.EditorProjectExportWorkflowService.create({
        getSong: getCurrentEditorSong,
        getDAW: () => editorGetRuntimeDAW(),
        buildBundle: options =>
          getEditorProjectExportService()?.buildBundle(options),
        saveNative: options =>
          getEditorProjectFileService()?.saveNative(options),
        saveBrowser: options =>
          getEditorProjectExportRouteService()?.saveBrowser(options),
        refreshStorageInfo: () => refreshStorageInfo(),
        toast,
        BlobRef: window.Blob,
        logger: console
      });
  }
  return edProjectExportWorkflowService;
}

let edSongImportService = null;
function getEditorSongImportService() {
  if (
    !edSongImportService &&
    typeof window.EditorSongImportService?.create === 'function'
  ) {
    edSongImportService = window.EditorSongImportService.create({
      getSong: getCurrentEditorSong,
      setSong: song => editorAppRuntime.setSong(song),
      getDAW: () => editorGetRuntimeDAW(),
      createBlankSong: edBlankSong,
      isValidNote: note => typeof etIsValidNote !== 'function' || etIsValidNote(note)
    });
  }
  return edSongImportService;
}

let edMidiScoreController = null;
function getMidiScoreController() {
  if (
    !edMidiScoreController &&
    typeof window.MidiScoreController?.create === 'function'
  ) {
    edMidiScoreController = window.MidiScoreController.create({
      getSong: getCurrentEditorSong,
      setSong: song => editorAppRuntime.setSong(song),
      getDAW: () => editorGetRuntimeDAW(),
      saveSong: () => getEditorSongPersistenceService()?.save?.(),
      onSongChanged: () => {
        try { resetPerformanceSerialization?.(); } catch (_) {}
        try { rebuildPerformanceSongDocument?.(); } catch (_) {}
        try { edSyncToolbar?.(); } catch (_) {}
        try { edRenderEditor?.(true); } catch (_) {}
        try { renderAll?.(); } catch (_) {}
      },
      toast,
      logger: console
    });
    window.__midiScorePlayhead = seconds =>
      edMidiScoreController?.updatePlayhead?.(seconds);
  }
  return edMidiScoreController;
}

    /**
     * همگام‌سازی UI بعد از تغییر آهنگ — فراخوانی مشترک بین loadArrSong و hotSwapToNextSong
     */
    // تابع ایمن برای کپی آکوردها از تایم‌لاین به پلیر
    function syncUIAfterSongChange() {
      if (typeof rebuildPerformanceSongDocument === 'function') rebuildPerformanceSongDocument();
      const lyricPopup = editorGetLyricPopup();
      const lyricOnlyPopup = editorGetLyricOnlyPopup();
      if (editorPopupIsOpen(lyricPopup)) {
        try {
          const _script = editorPopupDocument(lyricPopup)
            ?.querySelector('script[data-pv="chord"]');
          if (_script) _script.remove();
        } catch(_) {}
        setTimeout(() => { try { editorSyncLyricPopup(); } catch(_) {} }, 50);
        setTimeout(() => { try { editorSyncLyricPopup(); } catch(_) {} }, 300);
        setTimeout(() => { try { safeMirrorTimeline(); } catch(_) {} }, 1000);
      }
      if (editorPopupIsOpen(lyricOnlyPopup)) {
        setTimeout(() => { try { editorSyncLyricOnlyPopup(); } catch(_) {} }, 50);
        setTimeout(() => { try { editorSyncLyricOnlyPopup(); } catch(_) {} }, 300);
      }
      if (typeof _forceRenderOpenPopupsFull === 'function') _forceRenderOpenPopupsFull();
      notifyPerformanceTrackChanged();
    }

    // Arranger runtime: load and hot-swap wiring stays outside editor.js.
    let editorArrangerController = null;
    function getEditorArrangerRuntime() {
      if (
        !editorArrangerController &&
        typeof window.EditorArrangerControllerService?.create === 'function'
      ) {
        editorArrangerController =
          window.EditorArrangerControllerService.create({
            performanceState: {
              get: () => getPerformanceState?.() || {},
              update: patch => updatePerformanceState?.(patch)
            },
            arrangement: {
              getArrangement: () =>
                getPerformanceState?.()?.data ||
                window.AkordyarCoreApi?.getEditingArr?.() ||
                null,
              getAllSongs: () => editorGetArchiveSongs(),
              getItemSetting: (...args) =>
                window.AkordyarCoreApi?.getArrItemSetting?.(...args) || {},
              getDAW: () => editorGetRuntimeDAW(),
              getPlaybackPolicy: () => arrangerPlaybackPolicy,
              getProjectEnd: () => getProjectEnd()
            },
            actions: {
              applyPreparedState: payload =>
                getEditorSongTransitionService()?.applyPreparedState(payload),
              loadSong: (...args) =>
                getEditorSongTransitionService()?.loadSong(...args),
              pauseTransport: () => pauseTransport(),
              stopAllVoices: () => stopAllVoices(),
              setSelectionEnd: value => {
                selectionEnd = value;
              },
              resetRecording: () => {
                isRecordingChords = false;
                currentRecordingClipId = null;
              },
              seekTransport: (...args) => seekTransport(...args),
              ensureAudioCtx: () => ensureAudioCtx(),
              startTransport: () => startTransport(),
              prepareNextSong: (...args) => prepareNextArrSong(...args)
            },
            ui: {
              resetHistory: () => resetHistory(),
              syncToolbar: () => edSyncToolbar(),
              renderEditor: (...args) => edRenderEditor(...args),
              renderAll: (...args) => renderAll(...args),
              saveState: () => saveState(),
              initHighlightEffect: () => initHighlightEffect(),
              syncUIAfterSongChange: () => syncUIAfterSongChange(),
              renderPerfUI: () => renderPerfUI(),
              toast: message => toast(message),
              translate: key => t(key),
              getElement: id => $(id),
              mirrorTimeline: () => safeMirrorTimeline()
            },
            scheduling: {
              schedule: (...args) => setTimeout(...args)
            },
            logger: console
          });
      }
      return editorArrangerController?.runtime || null;
    }

    function hotSwapToNextSong(...args) {
      return getEditorArrangerRuntime()?.hotSwapToNextSong?.(...args);
    }

    /**
     * بعد از هر تعویض ترک/آهنگ صدا زده شود.
     * rebuild + full render embedded + popupها
     */
    function notifyPerformanceTrackChanged() {
      requestAnimationFrame(function () {
        if (typeof window.onPerformanceSongChanged === 'function') {
          window.onPerformanceSongChanged();
        } else if (typeof rebuildPerformanceSongDocument === 'function') {
          if (typeof rebuildPerformanceSongDocument === 'function') rebuildPerformanceSongDocument();
        }
      });
    }

    async function loadArrSong(idx, options) {
      return getEditorArrangerRuntime()?.loadArrSong?.(idx, options);
    }

    function setZoom(pps, anchorClientX) {
      const scroll = $('tl-scroll'); const oldPps = editorGetRuntimeDAW().pxPerSecond; const newPps = clamp(pps, 5, 260);
      if (Math.abs(newPps - oldPps) < 0.01) return;
      if (editorGetRuntimeDAW().isPlaying && !editorGetRuntimeDAW().isScrubbing) {
        editorGetRuntimeDAW().playhead = getTransportPlayhead();
      }
      let anchorTime = editorGetRuntimeDAW().playhead; if (typeof anchorClientX === 'number') anchorTime = clientToTime(anchorClientX);
      const rel = timeToX(anchorTime) - scroll.scrollLeft; editorGetRuntimeDAW().pxPerSecond = newPps; $('zoom-range').value = String(Math.round(newPps));
      // خودکار بزرگ کردن تایم‌لاین بر اساس عرض صفحه نمایش
      const visibleTime = scroll.clientWidth / newPps;
      ensureTimelineFits(visibleTime + 10);
      // Zoom changes clip geometry only. Rebuilding every waveform canvas here
      // blocks the UI thread and starves the metronome scheduler; existing
      // waveform images scale with the clip until an edit requires a refresh.
      renderAll({ preserveWaveforms: true }); scroll.scrollLeft = Math.max(0, timeToX(anchorTime) - rel);
      updateZoomFontScale();
    }

    function getTimelineZoomAnchorX() {
      const scroll = $('tl-scroll');
      if (!scroll) return null;
      const rect = scroll.getBoundingClientRect();
      return rect.left + (scroll.clientWidth / 2);
    }

    function zoomTimelineHorizontal(direction) {
      const factor = direction > 0 ? 1.2 : (1 / 1.2);
      setZoom(editorGetRuntimeDAW().pxPerSecond * factor, getTimelineZoomAnchorX());
    }

    const MIN_LANE_HEIGHT = 32;
    const MAX_LANE_HEIGHT = 240;

    function setVerticalZoom(newH) {
      newH = clamp(Math.round(newH), MIN_LANE_HEIGHT, MAX_LANE_HEIGHT);
      if (Math.abs(newH - editorGetRuntimeDAW().laneHeight) < 1) return;
      editorGetRuntimeDAW().laneHeight = newH;
      document.documentElement.style.setProperty('--lane-h', newH + 'px');
      // Reset all per-lane heights to follow global zoom
      editorGetRuntimeDAW().tracks.forEach(t => { t.laneHeight = null; });
      document.querySelectorAll('.track-lane').forEach(el => { el.style.removeProperty('--lane-h'); el.style.removeProperty('height'); });
      document.querySelectorAll('.track-name').forEach(el => { el.style.removeProperty('--lane-h'); el.style.removeProperty('height'); });
      document.querySelectorAll('.lane-grid').forEach(c => drawLaneGrid(c));
      updateZoomFontScale();
    }

    // Unified font scaling for chord clips and section tags
    function updateZoomFontScale() {
      const BASE_FONT = 16; // 1rem in px
      const DEFAULT_PPS = 70;
      const DEFAULT_LANE_H = 64;
      const vScale = editorGetRuntimeDAW().laneHeight / DEFAULT_LANE_H;
      const hScale = editorGetRuntimeDAW().pxPerSecond / DEFAULT_PPS;
      const combined = Math.sqrt(vScale * hScale);
      const scaled = clamp(BASE_FONT * combined, 10, 32);
      document.documentElement.style.setProperty('--zoom-font', scaled + 'px');
    }

    function setLaneHeight(trackId, newH) {
      newH = clamp(Math.round(newH), MIN_LANE_HEIGHT, MAX_LANE_HEIGHT);
      const track = editorGetRuntimeDAW().tracks.find(t => t.id === trackId);
      if (!track) return;
      track.laneHeight = newH;
      const lane = document.querySelector(`.track-lane[data-track-id="${trackId}"]`);
      const name = document.querySelector(`.track-name[data-track-id="${trackId}"]`);
      if (lane) { lane.style.setProperty('--lane-h', newH + 'px'); lane.style.height = newH + 'px'; drawLaneGrid(lane.querySelector('.lane-grid')); }
      if (name) { name.style.setProperty('--lane-h', newH + 'px'); name.style.height = newH + 'px'; }
      updateZoomFontScale();
    }

    function zoomTimelineVertical(direction) {
      const factor = direction > 0 ? 1.2 : (1 / 1.2);
      setVerticalZoom(editorGetRuntimeDAW().laneHeight * factor);
    }

    function getTimelineSelectionRange() {
      const daw = editorGetRuntimeDAW();
      const clips = (daw.clips || []).filter(clip => daw.selectedIds?.has(clip.id));
      const sections = (daw.sections || []).filter(section =>
        daw.selectedSectionIds?.has(section.id)
      );
      const items = [...clips, ...sections].filter(item =>
        Number.isFinite(item.start) && Number.isFinite(item.duration)
      );
      if (!items.length) return null;
      return {
        start: Math.min(...items.map(item => item.start)),
        end: Math.max(...items.map(item => item.start + item.duration))
      };
    }

    function zoomTimelineToSelection() {
      const scroll = $('tl-scroll');
      const range = getTimelineSelectionRange();
      if (!scroll || !range || range.end <= range.start) {
        toast('ابتدا یک آیتم در تایم‌لاین انتخاب کنید');
        return;
      }
      const padding = Math.max(0.25, (range.end - range.start) * 0.08);
      const start = Math.max(0, range.start - padding);
      const end = range.end + padding;
      const viewportWidth = Math.max(1, scroll.clientWidth - 24);
      setZoom(viewportWidth / Math.max(0.05, end - start), null);
      scroll.scrollLeft = Math.max(0, timeToX(start) - 12);
    }

    function zoomTimelineFull() {
      const scroll = $('tl-scroll');
      const total = Math.max(0.05, getProjectEnd());
      if (!scroll) return;
      const viewportWidth = Math.max(1, scroll.clientWidth - 24);
      setZoom(viewportWidth / total, null);
      scroll.scrollLeft = 0;
    }

    function toggleSelectedTrackHeight() {
      const daw = editorGetRuntimeDAW();
      const track = daw.tracks.find(tr => tr.id === daw.selectedTrackId);
      if (!track) {
        toast('ابتدا یک لاین را انتخاب کنید');
        return;
      }

      const baseHeight = clamp(Math.round(daw.laneHeight || 64), MIN_LANE_HEIGHT, MAX_LANE_HEIGHT);
      const expandedHeight = clamp(Math.round(Math.max(96, baseHeight * 1.75)), MIN_LANE_HEIGHT, MAX_LANE_HEIGHT);
      const currentHeight = track.laneHeight || baseHeight;
      const isExpanded = Boolean(track.laneHeight && currentHeight >= expandedHeight - 1);

      // Z focuses the selected track: it becomes large and every other track
      // becomes compact. Pressing Z again restores the normal layout.
      daw.tracks.forEach(item => {
        const nextHeight = isExpanded
          ? null
          : (item.id === track.id ? expandedHeight : MIN_LANE_HEIGHT);
        item.laneHeight = nextHeight;
        const lane = document.querySelector(`.track-lane[data-track-id="${item.id}"]`);
        const name = document.querySelector(`.track-name[data-track-id="${item.id}"]`);
        [lane, name].forEach(element => {
          if (!element) return;
          if (nextHeight == null) {
            element.style.removeProperty('--lane-h');
            element.style.removeProperty('height');
          } else {
            element.style.setProperty('--lane-h', `${nextHeight}px`);
            element.style.height = `${nextHeight}px`;
          }
        });
        const grid = lane?.querySelector('.lane-grid');
        if (grid) drawLaneGrid(grid);
      });
      updateTrackSelectionUI();
      saveState();
      toast(isExpanded ? 'اندازه لاین‌ها به حالت عادی برگشت' : 'لاین انتخاب‌شده بزرگ شد');
    }

    /* ===== CHORD EDITOR & MIDI ===== */
    const editorTimelineChordEditorRuntime =
      window.EditorTimelineChordEditorService?.create?.({
        documentRef: document,
        windowRef: window,
        getElement: id => $(id),
        getDAW: () => editorGetRuntimeDAW(),
        getClip: clipId => getClip(clipId),
        getMidiChordService: () => getEditorMidiChordService(),
        getCurrentChord: () => currentChord,
        setCurrentChord: value => {
          currentChord = value;
        },
        getModalMode: () => edChordModalMode,
        setModalMode: value => {
          edChordModalMode = value;
        },
        setChordIndex: value => {
          edChordIdx = value;
        },
        setPendingAnchor: value => {
          edPendingAnchor = value;
        },
        confirmEditorChord: (...args) => edConfirmChord(...args),
        deleteEditorChord: (...args) => edDeleteChord(...args),
        saveState: (...args) => saveState(...args),
        renderClips: (...args) => renderClips(...args),
        renderAll: (...args) => renderAll(...args),
        ensureTimelineFits: (...args) => ensureTimelineFits(...args),
        saveSong: (...args) => edSaveSong(...args),
        uid: prefix => uid(prefix),
        roundMs: value => roundMs(value),
        translate: key => t(key),
        toast: message => toast(message),
        constants: {
          ROOT_NOTES,
          BASS_NOTES,
          NOTE_TO_SHARP,
          NOTE_SEMITONE,
          NOTES,
          CHORD_TYPES,
          TENSIONS,
          CHORD_INTERVALS,
          TENSION_INTERVALS
        }
      });
    if (!editorTimelineChordEditorRuntime) {
      throw new Error(
        'EditorTimelineChordEditorService باید قبل از editor.js بارگذاری شود.'
      );
    }
    const {
      buildChordEditor,
      buildPiano,
      updateChordPreview,
      openChordEditor,
      closeChordEditor,
      chordModalConfirm,
      chordModalDelete,
      placeChordOnTimeline
    } = editorTimelineChordEditorRuntime;

    let editorMidiChordService = null;
    function getEditorMidiChordService() {
      if (
        !editorMidiChordService &&
        typeof window.EditorMidiChordService?.create === 'function'
      ) {
        editorMidiChordService = window.EditorMidiChordService.create({
          notes: NOTES,
          chordTemplates: CHORD_TEMPLATES,
          formatType: chordTypeDisplay
        });
      }
      return editorMidiChordService;
    }

    // ===== MIDI TRANSPORT SYNC =====
    let midiSyncActive = false;
    const editorMidiTransportService = window.EditorMidiTransportService.create({
      getSyncActive: () => midiSyncActive,
      getDAW: () => editorGetRuntimeDAW(),
      seekTransport,
      startTransport,
      pauseTransport,
      getNow: () => performance.now(),
      onTempoChange: newBPM => {
        const tempoInput = $('edTempo');
        if (tempoInput) tempoInput.value = newBPM;
        if (getEditorSongStateService()?.setTempo?.(newBPM)) {
          edSaveSong();
        }
        toast(`تمپوی کیوبیس: ${newBPM} BPM`);
      },
      schedule: (callback, delay) => setTimeout(callback, delay),
      cancel: timer => clearTimeout(timer)
    });

    const editorMidiInputService = window.EditorMidiInputService.create({
      documentRef: document,
      getElement: id => $(id),
      notes: NOTES,
      noteNames: NOTES,
      getMidiTransportService: () => editorMidiTransportService,
      getMidiChordService: () => getEditorMidiChordService(),
      updateMidiMonitor,
      updateMidiStatusDot,
      updateMidiChordDisplay,
      logMidiMsg,
      getActiveMidiNotes: () => activeMidiNotes,
      getMidiTimeout: () => midiTimeout,
      setMidiTimeout: value => { midiTimeout = value; },
      schedule: (callback, delay) => setTimeout(callback, delay),
      cancel: timer => clearTimeout(timer),
      getMidiLearnActive: () => midiLearnActive,
      handleMidiLearnInput,
      getMidiMap,
      executeMidiMappedFunction,
      getRecordingState: () => ({
        active: isRecordingChords,
        clipId: currentRecordingClipId
      }),
      setRecordingClipId: value => { currentRecordingClipId = value; },
      getClip: clipId => getClip(clipId),
      getTimelineState: () => editorGetRuntimeDAW(),
      saveState: () => saveState(),
      renderAll: () => renderAll(),
      renderClips: () => renderClips(),
      ensureTimelineFits: value => ensureTimelineFits(value),
      uid: prefix => uid(prefix),
      roundMs: value => roundMs(value),
      setCurrentChord: value => { currentChord = value; },
      updateChordPreview: () => updateChordPreview(),
      getModalMode: () => edChordModalMode,
      getCurrentEditorSong: () => getCurrentEditorSong(),
      getSelectedChords: () => edSelectedChords,
      syncBaseChordName: index => edSyncBaseChordName(index),
      renderEditorChords: () => edRenderChords(),
      commitEditor: () => edCommit(),
      getEditorSongStateService: () => getEditorSongStateService(),
      getSequentialChordingActive: () => edSeqChordingActive,
      setSequentialChordingActive: value => { edSeqChordingActive = value; },
      getSequentialPoints: () => edSeqPoints,
      setSequentialPoints: value => { edSeqPoints = value; },
      getSequentialCursor: () => edSeqCursor,
      setSequentialCursor: value => { edSeqCursor = value; },
      filterChordsWithBase: predicate => edFilterChordsWithBase(predicate),
      getSyncActive: () => midiSyncActive,
      setSyncActive: value => { midiSyncActive = Boolean(value); },
      translate: key => t(key),
      toast,
      constants: {
        ROOT_NOTES,
        CHORD_TYPES,
        TENSIONS,
        BASS_NOTES
      }
    });
    if (!editorMidiInputService) {
      throw new Error(
        'EditorMidiInputService باید قبل از editor.js بارگذاری شود.'
      );
    }

    const editorMidiConnectionService = window.EditorMidiConnectionService.create({
      navigatorRef: window.navigator,
      getMidiAccess: () => midiAccess,
      setMidiAccess: value => { midiAccess = value; },
      getSyncActive: () => midiSyncActive,
      setSyncActive: value => { midiSyncActive = Boolean(value); },
      onMessage: event => editorMidiInputService.handleMessage(event),
      toast,
      logger: console
    });

    function toggleMIDITab() {
      toggleTab('tab-midi');
      const tab = $('tab-midi');
      if (tab.classList.contains('active-pink')) {
        return editorMidiConnectionService.connect();
      }
      return editorMidiConnectionService.disconnect();
    }

    function toggleMIDISync() {
      return editorMidiInputService.toggleSync();
    }

    function toggleTab(id) { const tab = $(id); if (id === 'tab-sync') tab.classList.toggle('active-teal'); else if (id === 'tab-midi') tab.classList.toggle('active-pink'); }

    /* ===================== KEYBOARD ===================== */
    // ===== SHORTCUT SYSTEM =====
    const shortcutStore = window.EditorShortcutStoreService.create({
      storage: localStorage
    });
    const SHORTCUT_DEFAULTS = shortcutStore.shortcutDefaults;
    const SHORTCUTS = shortcutStore.shortcuts;
    function loadShortcuts() { return shortcutStore.loadShortcuts(); }
    function saveShortcuts() { return shortcutStore.saveShortcuts(); }
    function getShortcut(id) { return shortcutStore.getShortcut(id); }
    function matchShortcut(event, id) {
      return shortcutStore.matchShortcut(event, id);
    }
    function formatKeyName(code) {
      return shortcutStore.formatKeyName(code);
    }
    loadShortcuts();

    let _editingShortcutId = null;
    // ===== AUTO IMPORT =====
    // Auto Import owns its state, DOM workflow, parser and persistence wiring.
    const editorAutoImportRuntime =
      window.EditorAutoImportRuntimeService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        fetchRef: (...args) => fetch(...args),
        positionMapper: requireLyricPositionMapper(),
        getAllSongs: (...args) => editorGetArchiveSongs(...args),
        setAllSongs: (...args) => editorSetArchiveSongs(...args),
        artistKey: value => editorArchiveArtistKey(value),
        isValidNote: value =>
          typeof etIsValidNote !== 'function' || etIsValidNote(value),
        confirmRef: (...args) => window.confirm(...args),
        showDirectoryPicker: window.showDirectoryPicker,
        toast,
        logger: console
      });
    if (!editorAutoImportRuntime) {
      throw new Error(
        'EditorAutoImportRuntimeService باید قبل از editor.js بارگذاری شود.'
      );
    }
    const autoImportStateService = editorAutoImportRuntime.getState();
    const {
      escapeHtml: editorEscapeHtml,
      songUniqueId,
      normalizeRawText,
      hasPersian,
      isChordOnlyLine,
      parseRawSong,
      startAutoImport,
      autoRetryFailed,
      autoImportSaveArchive,
      autoImportSaveConfirm,
      autoImportDoSave,
      openAutoImportModal,
      closeAutoImportModal,
      autoImportNewRequest
    } = editorAutoImportRuntime;

    const editorChordImportRuntime =
      window.EditorChordImportService?.create?.({
        documentRef: document,
        windowRef: window,
        getElement: id => $(id),
        fetchRef: (...args) => fetch(...args),
        getAutoImportResults: () => autoImportStateService.getResults(),
        songUniqueId,
        normalizeRawText,
        hasPersian,
        isChordOnlyLine,
        parseRawSong,
        parseChordLyricText: rawText =>
          requireLyricsParser().parseChordLyricText(rawText),
        getEditorSongImportService,
        getDAW: () => editorGetRuntimeDAW(),
        syncToolbar: (...args) => edSyncToolbar(...args),
        renderEditor: (...args) => edRenderEditor(...args),
        saveSong: (...args) => edSaveSong(...args),
        renderAll: (...args) => renderAll(...args),
        toast,
        logger: console
      });
    if (!editorChordImportRuntime) {
      throw new Error(
        'EditorChordImportService باید قبل از editor.js بارگذاری شود.'
      );
    }
    const {
      openImportChordModal,
      closeImportChordModal,
      loadAutoImportSong,
      fetchFromUrl,
      applyImportChords
    } = editorChordImportRuntime;

    function openShortcutModal() {
      const list = $('shortcutList'); list.innerHTML = '';
      SHORTCUT_DEFAULTS.forEach(sk => {
        const cur = getShortcut(sk.id);
        const midiNote = Object.entries(MIDI_MAPS).find(([k, v]) => v === sk.id);
        const div = document.createElement('div');
        div.className = 'shortcut-item';
        const keyParts = [];
        if (cur.ctrl) keyParts.push('Ctrl');
        if (cur.shift) keyParts.push('Shift');
        if (cur.alt) keyParts.push('Alt');
        keyParts.push(formatKeyName(cur.code));
        const midiLabel = midiNote ? '🎹N' + midiNote[0].replace('n','') : '';
        const midiRemoveBtn = midiNote ? `<button class="ed-btn" data-action="removeMidiMap" data-value="${editorEscapeHtml(midiNote[0].replace('n',''))}" title="حذف MIDI" style="font-size:0.6rem;min-width:18px;height:24px;padding:0 3px;background:#e24f5b;color:#fff;border-color:#e24f5b;">✕</button>` : '';
        div.innerHTML = `<span class="shortcut-label">${editorEscapeHtml(sk.label)}</span><div style="display:flex;gap:4px;align-items:center;"><div class="shortcut-key" data-sid="${editorEscapeHtml(sk.id)}"><kbd>${editorEscapeHtml(keyParts.join(' + '))}</kbd></div><button class="ed-btn" data-action="startMidiLearn" data-value="${editorEscapeHtml(sk.id)}" title="MIDI Learn" style="font-size:0.7rem;min-width:28px;height:24px;padding:0 4px;${midiNote ? 'background:#9F7AEA;color:#fff;border-color:#9F7AEA;' : ''}">🎹${midiLabel}</button>${midiRemoveBtn}</div>`;
        div.querySelector('.shortcut-key').addEventListener('click', () => startEditShortcut(sk.id));
        list.appendChild(div);
      });
      $('shortcutModal').classList.add('show');
    }
    function closeShortcutModal() { $('shortcutModal').classList.remove('show'); _editingShortcutId = null; cancelMidiLearn(); }
    function startEditShortcut(id) {
      _editingShortcutId = id;
      document.querySelectorAll('.shortcut-key').forEach(el => el.classList.remove('editing'));
      const el = document.querySelector(`.shortcut-key[data-sid="${id}"]`);
      if (el) { el.classList.add('editing'); el.querySelector('kbd').textContent = '...کلید را بزنید'; }
    }
    function finishEditShortcut(code, ctrl, shift) {
      if (!_editingShortcutId) return;
      SHORTCUTS[_editingShortcutId] = { code, ctrl: !!ctrl, shift: !!shift };
      saveShortcuts(); _editingShortcutId = null;
      openShortcutModal(); // re-render
      toast('شرتکات ذخیره شد');
    }
    function resetShortcuts() { shortcutStore.resetShortcuts(); openShortcutModal(); toast('شرتکات به پیش‌فرض بازگشت'); }

    // ===== MIDI MAP (MIDI Learn) =====
    const MIDI_MAPS = shortcutStore.midiMaps;
    let midiLearnActive = false;
    let midiLearnTargetId = null;
    let midiLearnTimer = null;
    function loadMidiMaps() { return shortcutStore.loadMidiMaps(); }
    function saveMidiMaps() { return shortcutStore.saveMidiMaps(); }
    function getMidiMap(note) { return shortcutStore.getMidiMap(note); }
    function setMidiMap(note, funcId) {
      return shortcutStore.setMidiMap(note, funcId);
    }
    function removeMidiMap(note) {
      return shortcutStore.removeMidiMap(note);
    }
    function executeMidiMappedFunction(funcId) { const fn = ACTION_FUNCTIONS[funcId]; if (fn) fn(); }
    function hideMidiLearnToast() {
      clearTimeout(midiLearnTimer);
      midiLearnTimer = null;
      const toastEl = document.querySelector('.mapping-toast');
      if (toastEl) toastEl.style.display = 'none';
    }
    function cancelMidiLearn() {
      if (!midiLearnActive) return;
      midiLearnActive = false;
      const prevId = midiLearnTargetId;
      midiLearnTargetId = null;
      if (prevId) {
        const btn = document.querySelector(`[data-action="${prevId}"]`);
        if (btn) btn.classList.remove('mapping-active');
      }
      hideMidiLearnToast();
    }
    function startMidiLearn(funcId) {
      cancelMidiLearn();
      midiLearnActive = true;
      midiLearnTargetId = funcId;
      const btn = document.querySelector(`[data-action="${funcId}"]`);
      if (btn) btn.classList.add('mapping-active');
      let toastEl = document.querySelector('.mapping-toast');
      if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'mapping-toast'; document.body.appendChild(toastEl); }
      const label = SHORTCUT_DEFAULTS.find(s => s.id === funcId)?.label || funcId;
      toastEl.textContent = '🎹 «' + label + '» — نت MIDI را بزنید...';
      toastEl.style.display = 'block';
      clearTimeout(midiLearnTimer);
      midiLearnTimer = setTimeout(() => cancelMidiLearn(), 3000);
    }
    function handleMidiLearnInput(note) {
      if (!midiLearnActive || !midiLearnTargetId) return;
      setMidiMap(note, midiLearnTargetId);
      const completedId = midiLearnTargetId;
      midiLearnActive = false;
      midiLearnTargetId = null;
      hideMidiLearnToast();
      const btn = document.querySelector(`[data-action="${completedId}"]`);
      if (btn) btn.classList.remove('mapping-active');
      openShortcutModal();
      toast('🎹 MIDI mapping ذخیره شد: Note ' + note);
    }
    loadMidiMaps();

    // Global shortcut capture for editing.
    // EventBindings is responsible for registering this handler.
    function handleGlobalKeydownCapture(e) {
      return getEditorKeyboardRuntime()?.handleGlobalKeydownCapture?.(e);
    }

    // Main global shortcuts handler.
    // EventBindings is responsible for registering this handler.
    function handleGlobalKeydown(e) {
      const keyboardService = getEditorKeyboardRuntime();
      if (keyboardService?.handleKeydown?.(e)) return true;
      return keyboardService?.handleGlobalKeydown?.(e);
    }

    function handleGlobalKeyup(e) {
      return getEditorKeyboardRuntime()?.handleGlobalKeyup?.(e);
    }

    function handleGlobalDocumentKeydown(e) {
      return getEditorKeyboardRuntime()?.handleAuxiliaryKeydown?.(e);
    }

    /* ===================== INIT & INTERACTIONS ===================== */
    function init() {
      ensureAudioCtx();
      editorGetRuntimeDAW().tracks = [
        { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
        { id: 't0s', name: 'Section', icon: '🏷', type: 'section' },
        { id: 't1', name: 'Vocals', icon: '🎤', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't2', name: 'Guitar', icon: '🎸', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't3', name: 'Bass', icon: '🎵', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't4', name: 'Keys', icon: '🎹', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't5', name: 'Drums', icon: '🥁', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 }
      ];
      editorGetRuntimeDAW().tracks.forEach(t => {
        if (t.type === 'audio') {
          t._pannerNode = editorGetRuntimeDAW().audioCtx.createStereoPanner(); t._gainNode = editorGetRuntimeDAW().audioCtx.createGain();
          t._pannerNode.connect(t._gainNode); t._gainNode.connect(editorGetRuntimeDAW().masterGain); updateTrackMix(t.id);
        }
      });
      ensureRecLane();
      editorGetRuntimeDAW().sections = []; editorGetRuntimeDAW().selectedSectionIds = new Set();
      editorGetRuntimeDAW().timelineDuration = 120; editorGetRuntimeDAW().pxPerSecond = 70; saveState(); renderAll();
      updateZoomFontScale();

      const scroll = $('tl-scroll');
      const lanes = $('lanes-container');

      // visual cut guide while holding Shift
      const showGuide = (e) => {
        const guide = $('cut-guide');
        if (!e.shiftKey) { guide.style.display = 'none'; return; }
        const t = clientToTime(e.clientX);
        guide.style.display = 'block';
        guide.style.left = timeToX(t) + 'px';
      };
      lanes.addEventListener('mousemove', showGuide);
      scroll.addEventListener('mousemove', (e) => { if (e.shiftKey) showGuide(e); });
      lanes.addEventListener('mouseleave', () => { if (!$('tl-scroll').matches(':hover')) $('cut-guide').style.display = 'none'; });

    } // End init()

    // ===== TOOLBAR DRAG & DOCK =====
    let editorToolbarDockService = null;
    function getEditorToolbarDockService() {
      if (
        !editorToolbarDockService &&
        typeof window.EditorToolbarDockService?.create === 'function'
      ) {
        editorToolbarDockService =
          window.EditorToolbarDockService.create({
            documentRef: document,
            windowRef: window,
            getElement: id => $(id),
            schedule: (...args) => setTimeout(...args)
          });
      }
      return editorToolbarDockService;
    }

    function toggleToolbarDock() {
      return getEditorToolbarDockService()?.toggleToolbarDock?.();
    }

    getEditorToolbarDockService()?.bind?.();


    // ===== Ruler & Playhead =====
    const editorTimelineInteractionService =
      window.EditorTimelineInteractionService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        getDAW: () => editorGetRuntimeDAW(),
        isSnapEnabled: () => editorCoreApi.isSnapEnabled?.() ?? true,
        snapTime: value => editorCoreApi.snapTime?.(value) ?? value,
        setVerticalZoom: value => setVerticalZoom(value),
        setZoom: (...args) => setZoom(...args),
        toast,
        translate: t,
        clearEditorTextSelection,
        clearChordSelection: () => edClearChordSelection(),
        clearSelection: editorClearSelection,
        seekTransport,
        xToTime,
        clientToTime,
        clamp,
        autoScrollToPlayhead,
        renderLoopRegion,
        saveState
      });
    editorTimelineInteractionService?.init?.();

      // Global deselect: clicking anywhere clears all selections
      document.addEventListener('mousedown', (e) => {
        const colorSurface = e.target.closest(
          '.clip, .section-tag, .track-lane, #editorWrap, .tl-toolbar, .tl-zoom, .color-tool-group, #colorQuickBar'
        );
        if (isColorToolActive() && !colorSurface) {
          deactivateColorTool();
        }
        if (e.target.closest('.chord') || e.target.closest('.clip') || e.target.closest('.section-tag') || e.target.closest('#editorWrap') || e.target.closest('.tl-toolbar') || e.target.closest('.tl-zoom')) return;
        edClearChordSelection();
        editorClearSelection();
      });

      // Update loop toggle button state
      const loopBtn = $('loopToggleBtn');
      if (loopBtn) loopBtn.classList.toggle('loop-active', editorGetRuntimeDAW().loopEnabled);
      renderLoopRegion();

      // ===== DRAG & DROP audio files onto timeline =====
      const tlScroll = $('tl-scroll');

      const audioDropService = window.AudioDropImportService?.create?.({
        getDAW: () => editorGetRuntimeDAW(),
        getSong: getCurrentEditorSong,
        clearSelection: editorClearSelection,
        ensureAudioCtx,
        addNewTrack,
        askAudioCopyMode,
        decodeFileToBuffer,
        uid,
        roundMs,
        colors: COLORS,
        peaksFromBuffer,
        refreshClipWaveImage,
        ensureTimelineFits,
        saveAudioBlobToDB,
        saveAudioBlobsForProject,
        saveState,
        renderAll,
        saveSong: edSaveSong,
        toast,
        isElectron,
        electronAPI: window.electronAPI,
        logger: console
      });
      audioDropService?.bind?.(tlScroll);
      // Init sync UI
      editorCoreApi.initSyncUI?.();

    /* ===================================================================
       LYRIC & CHORD EDITOR (integrated into workspace)
       =================================================================== */

    // -- Song Data --
    // Validate a note/key root accepts BOTH sharps and flats (e.g. 'Bb','Eb','F#','Db').
    function etIsValidNote(n) {
      return Boolean(getEditorKeyCommandController()?.isValidNote?.(n));
    }

    // EditorRuntimeAdapter is the single owner of the current song reference.
    function getCurrentEditorSong() {
      return window.EditorRuntimeAdapter?.getSong?.() || null;
    }

    let edUndoStack = [], edRedoStack = [];
    let edChordIdx = null, edPendingAnchor = null;
    let edTransposing = 0;
    let edChordDragActive = false;
    let edChordsVisible = true;
    let edChordModalMode = null;

    let edInputRenderTimer = null;
    let edSaveTimer = null;
    let edCommitTimer = null;

function edScheduleEditorRefresh() {
  clearTimeout(edInputRenderTimer);
  edInputRenderTimer = setTimeout(() => {
    if (!getCurrentEditorSong()) return;
    edRenderEditor(false);
  }, 80);
}

function edScheduleSave() {
  clearTimeout(edSaveTimer);
  edSaveTimer = setTimeout(() => {
    if (!getCurrentEditorSong()) return;
    edSaveSong();
  }, 400);
}


function edBlankSong() {

      return { id: Date.now(), artist:'', title:'', key:'C', keyMode:'maj', originalKey:'C', originalKeyMode:'maj', baseChordNames:[], transpose:0, lyrics:'', chords:[], syncTimes:[], syncWords:[], trackId:null, trackPath:null, seqPoints:[],
        timeSignature:'4/4', tempo:120, genre:'', lineColors:[], chordVersions:[], activeChordVersion:0,
        styles:{ tSize:38,tColor:'#0fa966',tFont:'Vazirmatn',tBold:true,align:'center', cSize:38,cColor:'#e6aa28',cFont:'JetBrains Mono' } };
    }

    let edSongInitializationService = null;
    let edSongInitializationOptions = null;
    function getEditorSongInitializationService() {
    if (!edSongInitializationService) {
      const configured =
        window.EditorSongInitializationControllerService?.create?.({
        storage: localStorage,
        getSong: getCurrentEditorSong,
        setSong: song => editorAppRuntime.setSong(song),
        blankSong: edBlankSong,
        repairSong: song => window.TextEncodingService?.repairSong?.(song) || song,
        hydrationService: window.EditorHydrationService,
        documentRef: document,
        daw: editorGetRuntimeDAW(),
        updateNextIdFromClips,
        ensureAudioCtx,
        updateTrackMix,
        audioRecoveryService: getEditorAudioRecoveryService(),
        loadAudioBlobsForProject,
        getAudioBlobFromDB,
        decodeFileToBuffer,
        loadAudioFromHardDrive,
        getFileHandle,
        getDirHandle: options => {
          if (options?.load) return editorLoadArchiveDirHandle();
          return editorArchiveAudioDirHandle();
        },
        setDirHandle: handle => editorSaveArchiveDirHandle(handle),
        showDirectoryPicker: window.showDirectoryPicker,
        isElectron,
        electronAvailable: Boolean(window.electronAPI),
        peaksFromBuffer,
        refreshClipWaveImage,
        syncToolbar: edSyncToolbar,
        renderEditor: edRenderEditor,
        resetHistory,
        deactivateHistory,
        activateHistory,
        renderAll,
        saveState,
        initHighlightEffect,
        rebuildSongDocument: () => {
          if (typeof rebuildPerformanceSongDocument === 'function') {
            rebuildPerformanceSongDocument();
          }
        },
        syncViewStyles: () => {
          if (typeof syncViewStylesFromSong === 'function') {
            syncViewStylesFromSong();
          }
        },
        toast
      });
      edSongInitializationOptions = configured?.options || null;

      if (!configured) {
        throw new Error(
          'EditorSongInitializationService باید قبل از app/editor.js بارگذاری شود.'
        );
      }
      edSongInitializationService = configured.runtime;
    }
    return edSongInitializationService;
  }

  async function edInitSong() {
    const initializationService = getEditorSongInitializationService();
    return initializationService?.initialize?.({
      ...(edSongInitializationOptions || {}),
      storage: localStorage
    });
  }

    // -- Unified Save/Load (Timeline + Lyrics + Audio) --
    // ===== مودال سفارشی بله/نه جای confirm() =====
    let _copyModalResolver = null;
    function askAudioCopyMode(fileName) {
  // در نسخه نصبی (Electron)، صدا همیشه به صورت مسیر ذخیره می‌شود
  if (isElectron) {
    toast(`«${fileName}» به‌صورت مسیر ذخیره شد (حجم کم)`);
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
        _copyModalResolver = resolve;
        const modal = $('audioCopyModal');
        const text = $('audioCopyModalText');
        if (text) text.textContent = `فایل «${fileName}» در پروژه کپی شود؟`;
        if (modal) modal.style.display = 'flex';
      });
    }

    // Event listeners for modal buttons
    document.addEventListener('DOMContentLoaded', () => {
      const yesBtn = $('audioCopyYes');
      const noBtn = $('audioCopyNo');
      if (yesBtn) yesBtn.onclick = () => { const m = $('audioCopyModal'); if (m) m.style.display = 'none'; if (_copyModalResolver) { _copyModalResolver(true); _copyModalResolver = null; } };
      if (noBtn) noBtn.onclick = () => { const m = $('audioCopyModal'); if (m) m.style.display = 'none'; if (_copyModalResolver) { _copyModalResolver(false); _copyModalResolver = null; } };
    });

    let edProjectFileService = null;
    function getEditorProjectFileService() {
      if (
        !edProjectFileService &&
        typeof window.EditorProjectFileService?.create === 'function'
      ) {
        edProjectFileService = window.EditorProjectFileService.create({
          getElectronAPI: () => window.electronAPI
        });
      }
      return edProjectFileService;
    }

    function setEditorProjectFilePath(filePath) {
      return getEditorProjectFileService()?.setPath?.(filePath) || null;
    }

    function clearEditorProjectFilePath() {
      return getEditorProjectFileService()?.clearPath?.() || null;
    }

    async function edExportProjectFull(options = {}) {
      return getEditorProjectExportWorkflowService()?.exportProject?.(options);
    }

    async function edSaveProjectFile() {
      const currentPath = getEditorProjectFileService()?.getPath?.();
      if (currentPath) {
        return edExportProjectFull({ targetPath: currentPath });
      }
      return edExportProjectFull();
    }

    let edSongPersistenceService = null;
    function getEditorSongPersistenceService() {
      if (
        !edSongPersistenceService &&
        typeof window.EditorSongPersistenceService?.create === 'function'
      ) {
        edSongPersistenceService = window.EditorSongPersistenceService.create({
          getSong: getCurrentEditorSong,
          getDAW: () => editorGetRuntimeDAW(),
          syncMetadata: song => SongMetadata.syncFromDom(song),
          artistKey: artist => editorArchiveArtistKey(artist),
          storage: localStorage,
          scheduleAudioBlobSave: () => scheduleAudioBlobSave(),
          rebuildSongDocument: () => {
            if (typeof rebuildPerformanceSongDocument === 'function') {
              rebuildPerformanceSongDocument();
            }
          },
          syncViewStyles: () => {
            if (typeof syncViewStylesToSong === 'function') {
              syncViewStylesToSong();
            }
          }
        });
      }
      return edSongPersistenceService;
    }

    function edSaveSong() {
      return getEditorSongPersistenceService()?.save?.() || false;
    }

    function edSyncToolbar() {
      getEditorToolbarService()?.syncToolbar?.();
    }

    let edLyricsRenderer = null;
    function getEditorLyricsRenderer() {
      if (
        !edLyricsRenderer &&
        typeof window.EditorLyricsRenderer?.create === 'function'
      ) {
        edLyricsRenderer = window.EditorLyricsRenderer.create({
          getState: () => ({
            song: getCurrentEditorSong(),
            editor: $('editor'),
            printTitle: $('edPrintTitle'),
            printSub: $('edPrintSub'),
            statChordCount: $('statChordCount'),
            statLineCount: $('statLineCount'),
            titleFallback: t('untitled'),
            buildSubtext: song => {
              const displayKey = song.key || song.originalKey;
              const keyStr =
                displayKey + (song.keyMode === 'min' ? 'm' : '');
              return [
                song.artist,
                song.key
                  ? (currentLang === 'fa' ? 'گام: ' : 'Key: ') + keyStr
                  : null,
                song.transpose
                  ? (
                      currentLang === 'fa'
                        ? 'ترنسپوز '
                        : 'Transpose '
                    ) +
                    (song.transpose > 0 ? '+' : '') +
                    song.transpose
                  : null
              ].filter(Boolean).join('  ·  ');
            }
          })
        });
      }
      return edLyricsRenderer;
    }

    function edRenderEditor(rebuildContent) {
      if (!getCurrentEditorSong()) return;
      getEditorLyricsRenderer()?.render(rebuildContent !== false);
      edRenderChords();
    }


    // -- Chord Rendering --
    let edAnchorService = null;
    function getEditorAnchorService() {
      if (
        !edAnchorService &&
        typeof window.EditorAnchorService?.create === 'function'
      ) {
        edAnchorService = window.EditorAnchorService.create({
          getEditor: () => $('editor')
        });
      }
      return edAnchorService;
    }
    function anchorRectIn(editorEl, ch) {
      return getEditorAnchorService()?.anchorRectIn(editorEl, ch) || null;
    }
    function anchorRect(ch) { return anchorRectIn($('editor'), ch); }

    function resolveAccidentalPreference() {
      return getEditorKeyCommandController()?.resolveAccidentalPreference?.() ?? null;
    }

    function edBaseNameFromDisplayed(name, song = getCurrentEditorSong()) {
      return getEditorKeyCommandController()?.baseNameFromDisplayed?.(
        name,
        song
      ) || (name || '');
    }

    function getEditorSongStateService() {
      if (typeof requireEditorSongStateService === 'function') {
        return requireEditorSongStateService();
      }
      if (
        !window.__editorSongStateServiceBridge &&
        typeof window.EditorSongStateService?.create === 'function'
      ) {
        window.__editorSongStateServiceBridge =
          window.EditorSongStateService.create({
            getSong: () => window.EditorRuntimeAdapter?.getSong?.() || null
          });
      }
      return window.__editorSongStateServiceBridge || null;
    }

    let edMutationService = null;
    function getEditorMutationService() {
      if (
        !edMutationService &&
        typeof window.EditorMutationService?.create === 'function'
      ) {
        edMutationService = window.EditorMutationService.create({
          baseNameFromDisplayed: (name, song) => {
            const transpose = Number(song?.transpose) || 0;
            return transpose && name
              ? edTransposeChord(name, -transpose)
              : (name || '');
          }
        });
      }
      return edMutationService;
    }

    let edChordStateService = null;
    function getEditorChordStateService() {
      if (
        !edChordStateService &&
        typeof window.EditorChordStateService?.create === 'function'
      ) {
        edChordStateService = window.EditorChordStateService.create({
          baseNameFromDisplayed: (name, song) => {
            const transpose = Number(song?.transpose) || 0;
            return transpose && name
              ? edTransposeChord(name, -transpose)
              : (name || '');
          }
        });
      }
      return edChordStateService;
    }

    function edSyncBaseChordName(index) {
      getEditorChordStateService()?.syncBaseChordName(getCurrentEditorSong(), index);
    }

    function edRemoveChordAt(index) {
      getEditorChordStateService()?.removeChordAt(getCurrentEditorSong(), index);
    }

    function edFilterChordsWithBase(predicate) {
      getEditorChordStateService()?.filterChordsWithBase(getCurrentEditorSong(), predicate);
    }

    function edEnsureBaseChordNamesAligned() {
      return getEditorChordStateService()?.ensureBaseChordNamesAligned(getCurrentEditorSong()) || [];
    }

    function initAccidentalSelector() {
      return getEditorKeyCommandController()?.initAccidentalSelector?.();
    }

    function edTransposeChord(name, semi) {
      return getEditorKeyCommandController()?.transposeChord?.(name, semi) ||
        name;
    }

    let edChordRenderer = null;

    function getEditorChordRenderer() {
      if (edChordRenderer || typeof window.EditorChordRenderer?.create !== 'function') {
        return edChordRenderer;
      }
      edChordRenderer = window.EditorChordRenderer.create({
        getState: () => ({
          song: getCurrentEditorSong(),
          editor: $('editor'),
          layer: $('chordLayer'),
          wrap: $('editorWrap'),
          chordsVisible: edChordsVisible,
          selectedChords: edSelectedChords,
          sequenceActive: edSeqChordingActive,
          sequenceModeActive: edSeqModeActive,
          sequencePoints: edSeqPoints,
          sequenceCursor: edSeqCursor
        }),
        anchorRectIn,
        attachDrag: edAttachChordDrag,
        onPopupSync: () => {
          const lyricPopup = editorGetLyricPopup();
          if (editorPopupIsOpen(lyricPopup)) {
            setTimeout(() => editorSyncLyricPopup(), 100);
          }
        }
      });
      return edChordRenderer;
    }

    function edRenderChords(immediate) {
      getEditorChordRenderer()?.render(immediate);
    }



    // -- caret/anchor from mouse position (from file 2) --
    function caretFromPoint(x, y) {
      return getEditorAnchorService()?.caretFromPoint(x, y) || null;
    }

    function anchorFromPoint(x, y) {
      return getEditorAnchorService()?.anchorFromPoint(x, y) || null;
    }

    // -- Editor Input --
    function edGetLyricsFromDOM() {
      const editor = $('editor');
      const renderer = getEditorLyricsRenderer();
      if (editor && typeof renderer?.readLyrics === 'function') {
        return renderer.readLyrics(editor);
      }
      return editor?.innerText?.replace(/\u200B/g, '').replace(/\r\n?/g, '\n') || '';
    }

    function edRemapAnchors(oldText, newText) {
      const songState = getEditorSongStateService();
      if (oldText === newText || !songState?.currentSong?.()) return;
      // منطق remap به js/editor/LyricPositionMapper.js منتقل شده است.
      songState.getChords().forEach(ch =>
        requireLyricPositionMapper().remapAnchorToNewText(ch, oldText, newText)
      );
      edFilterChordsWithBase(ch => ch.lineIndex >= 0);
    }

    function edRemapSyncTimes(oldText, newText) {
      const songState = getEditorSongStateService();
      if (oldText === newText || !songState?.currentSong?.()) return;

      const syncTimes = songState.getSyncTimes?.();
      if (!Array.isArray(syncTimes) || syncTimes.length === 0) return;

      const remapped = requireLyricPositionMapper().remapLineValues(
        syncTimes,
        oldText,
        newText
      );
      songState.replaceSyncTimes?.(remapped);
    }

    let edSelectionService = null;
    function getEditorSelectionService() {
      if (
        !edSelectionService &&
        typeof window.EditorSelectionService?.create === 'function'
      ) {
        edSelectionService = window.EditorSelectionService.create({
          getSelected: () => edSelectedChords,
          setSelected: next => {
            edSelectedChords = next;
          },
          queryChordElements: () => document.querySelectorAll('.chord')
        });
      }
      return edSelectionService;
    }
    function edClearChordSelection() {
      const service = getEditorSelectionService();
      if (service) return service.clear();
      edSelectedChords = [];
      document.querySelectorAll('.chord')
        .forEach(el => el.classList.remove('selected'));
    }

    // -- Chord Selection --
    function edSelectChord(idx, isShift) {
      const service = getEditorSelectionService();
      if (service) return service.select(idx, isShift);
      if (isShift) {
        const position = edSelectedChords.indexOf(idx);
        if (position > -1) edSelectedChords.splice(position, 1);
        else edSelectedChords.push(idx);
      } else {
        edSelectedChords = [idx];
      }
      document.querySelectorAll('.chord').forEach(el => {
        const chordIndex = Number.parseInt(el.dataset.idx, 10);
        el.classList.toggle('selected', edSelectedChords.includes(chordIndex));
      });
    }
    let edChordDragService = null;
    function getEditorChordDragService() {
      if (
        !edChordDragService &&
        typeof window.EditorChordDragService?.create === 'function'
      ) {
        edChordDragService = window.EditorChordDragService.create();
      }
      return edChordDragService;
    }
    let edChordInteractionService = null;
    function getEditorChordInteractionService() {
      if (
        !edChordInteractionService &&
        typeof window.EditorChordInteractionService?.create === 'function'
      ) {
        edChordInteractionService = window.EditorChordInteractionService.create({
          getSong: getCurrentEditorSong,
          getSelected: () => edSelectedChords,
          selectChord: (index, withToggle) => edSelectChord(index, withToggle),
          clearSelection: () => edClearChordSelection(),
          getEditor: () => $('editor'),
          getWrap: () => $('editorWrap'),
          getChordElement: index =>
            document.querySelector(`.chord[data-idx="${index}"]`),
          setSelected: indices => getEditorSelectionService()?.set(indices),
          isColorToolActive: () => isColorToolActive(),
          onPaintChord: (index, event) => paintLyricChord(index, event),
          isLocked: () => Boolean(getCurrentEditorSong()?.editorLocked),
          openChordModal: index => edOpenChordModal(index),
          geometry: getEditorChordDragService(),
          mutations: getEditorMutationService(),
          render: () => edRenderChords(),
          commit: () => edCommit(),
          setDragging: value => { edChordDragActive = value; },
          toast: message => toast(message)
        });
      }
      return edChordInteractionService;
    }
    // -- Chord Drag --
    function edAttachChordDrag(el, idx) {
  getEditorChordInteractionService()?.attach(el, idx);
}
    let edAltDown = false;
    let edGlobalBindingsService = null;
    function getEditorGlobalBindingsService() {
      if (
        !edGlobalBindingsService &&
        typeof window.EditorGlobalBindingsService?.create === 'function'
      ) {
        edGlobalBindingsService = window.EditorGlobalBindingsService.create({
          windowRef: window,
          documentRef: document,
          getSong: getCurrentEditorSong,
          renderChords: () => edRenderChords(),
          getEditorWrap: () => $('editorWrap'),
          isDragging: () => edChordDragActive,
          onAltChange: value => { edAltDown = value; }
        });
      }
      return edGlobalBindingsService;
    }
    getEditorGlobalBindingsService()?.bind?.();

    let edLyricsChordInteractionService = null;
    if (typeof window.EditorLyricsChordInteractionService?.create === 'function') {
      edLyricsChordInteractionService =
        window.EditorLyricsChordInteractionService.create({
          documentRef: document,
          getSongState: () => getEditorSongStateService(),
          getEditor: () => $('editor'),
          getEditorWrap: () => $('editorWrap'),
          getEditorText: () => edGetLyricsFromDOM(),
          executeCommand: (...args) => document.execCommand?.(...args),
          remapAnchors: (oldText, newText) => edRemapAnchors(oldText, newText),
          remapSequencePoints: (oldText, newText) =>
            edRemapSeqPoints(oldText, newText),
          remapSyncTimes: (oldText, newText) =>
            edRemapSyncTimes(oldText, newText),
          refreshSyncLyrics: () => {
            if (editorCoreApi.isSyncActive?.()) {
              editorCoreApi.renderSyncLyrics?.();
            }
          },
          scheduleEditorRefresh: () => edScheduleEditorRefresh(),
          scheduleCommit: () => {
            clearTimeout(edCommitTimer);
            edCommitTimer = setTimeout(() => edCommit(), 300);
          },
          scheduleSave: () => edScheduleSave(),
          clearEditorTextSelection,
          clearSelection: editorClearSelection,
          clearChordSelection: () => edClearChordSelection(),
          isAltDown: () => edAltDown,
          anchorFromPoint,
          onLocked: () => {
            const button = $('edEditorLockBtn');
            if (button) {
              button.classList.add('editor-lock-blink');
              setTimeout(
                () => button.classList.remove('editor-lock-blink'),
                2000
              );
            }
          },
          setPendingAnchor: value => { edPendingAnchor = value; },
          setChordIndex: value => { edChordIdx = value; },
          openChordModal: index => edOpenChordModal(index),
          toast
        });
      edLyricsChordInteractionService.bind();
    }

    // -- Arrow keys to move selected chord (from file 2) --
    // Added in the main keyboard handler below

    // -- Scroll to reposition chords (handled above with rAF) --

    // -- Commit & Undo/Redo --
    let edCommitService = null;
    function getEditorCommitService() {
      if (
        !edCommitService &&
        typeof window.EditorCommitService?.create === 'function'
      ) {
        edCommitService = window.EditorCommitService.create({
          getSong: getCurrentEditorSong,
          isHistoryApplying,
          syncMetadata: (song, options) => SongMetadata.syncFromDom(song, options),
          getSeqPoints: () => edSeqPoints,
          setSeqPoints: points => getEditorSongStateService()?.setSeqPoints(points),
          saveState,
          rebuildSongDocument: () => {
            if (typeof rebuildPerformanceSongDocument === 'function') {
              rebuildPerformanceSongDocument();
            }
          }
        });
      }
      return edCommitService;
    }

    function edCommit() {
      return getEditorCommitService()?.commit?.() || false;
    }

let edTextSelectionService = null;
function getEditorTextSelectionService() {
  if (
    !edTextSelectionService &&
    typeof window.EditorTextSelectionService?.create === 'function'
  ) {
    edTextSelectionService = window.EditorTextSelectionService.create();
  }
  return edTextSelectionService;
}

let edChordCommandService = null;
function getEditorChordCommandService() {
  if (
    !edChordCommandService &&
    typeof window.EditorChordCommandService?.create === 'function'
  ) {
    edChordCommandService = window.EditorChordCommandService.create({
      baseNameFromDisplayed: (name, song) => {
        const transpose = Number(song?.transpose) || 0;
        return transpose && name
          ? edTransposeChord(name, -transpose)
          : (name || '');
      }
    });
  }
  return edChordCommandService;
}

function edRestoreSelectionState(state) {
  const service = getEditorTextSelectionService();
  if (service) {
    return service.restore($('editor'), state, document.getSelection());
  }
}




    function edRestore(stateStr) {
  applyState(stateStr);
}

    // History commands stay in the editor scope so keyboard, toolbar and
    // document actions share one implementation.
    function undo() {
      return getHistoryService().undo();
    }

    function redo() {
      return getHistoryService().redo();
    }


if ($('edUndoBtn')) {
  $('edUndoBtn').onclick = () => {
    undo();
  };
}


if ($('edRedoBtn')) {
  $('edRedoBtn').onclick = () => {
    redo();
  };
}

if ($('edRemoveAsterisks')) {
  $('edRemoveAsterisks').onclick = () => {
    const song = getCurrentEditorSong();
    if (!song || song.editorLocked) return;
    const result = getEditorMutationService()?.removeAsterisks(song);
    if (!result?.changed) {
      toast('ستاره‌ای در متن وجود ندارد');
      return;
    }
    edRenderEditor(true);
    edSaveSong();
    toast('تمام ستاره‌ها حذف شدند');
  };
}

if ($('edReverseChords')) {
  $('edReverseChords').onclick = () => {
    // ⚠️ این دکمه فقط برای موارد خاص است که آکوردها عمداً برعکس وارد شده‌اند
    // در حالت عادی نباید از این دکمه استفاده کرد چون ترتیب موسیقایی را برعکس می‌کند
    const song = getCurrentEditorSong();
    if (!song || song.editorLocked || !song.chords.length) {
      toast('آکوردی وجود ندارد');
      return;
    }
    if (!confirm('⚠️ آیا مطمئن هستید؟ این کار ترتیب موسیقایی آکوردها را در هر خط برعکس می‌کند و فقط برای موارد خاص کاربرد دارد.')) {
      return;
    }
    const result = getEditorMutationService()?.reverseChords(song);
    if (!result?.changed) return;
    edRenderEditor(true);
    edSaveSong();
    toast('ترتیب آکورد هر خط برعکس شد (فقط برای موارد خاص)');
  };
}

if ($('edDoBoth')) {
  $('edDoBoth').onclick = () => {
    const song = getCurrentEditorSong();
    if (!song || song.editorLocked) return;
    getEditorMutationService()?.removeAndReverse(song);
    edRenderEditor(true);
    edSaveSong();
    toast('ستاره‌ها حذف و آکوردها برعکس شدند');
  };
}


    // -- Chord Version System --
    let edChordVersionService = null;
    function getEditorChordVersionService() {
      if (
        !edChordVersionService &&
        typeof window.EditorChordVersionService?.create === 'function'
      ) {
        edChordVersionService = window.EditorChordVersionService.create({
          getSong: getCurrentEditorSong,
          getDAW: () => editorGetRuntimeDAW(),
          uid,
          roundMs,
          renderEditor: rebuild => edRenderEditor(rebuild),
          saveState,
          renderTracks,
          renderClips,
          refreshKeyUI,
          customPrompt,
          toast
        });
      }
      return edChordVersionService;
    }

    function ensureChordVersionsInit() {
      return getEditorChordVersionService()?.ensureInitialized?.();
    }

    function saveCurrentVersion() {
      return getEditorChordVersionService()?.saveCurrent?.();
    }

    function loadVersionToTimeline(versionIndex) {
      return getEditorChordVersionService()?.loadToTimeline?.(versionIndex);
    }

    function switchChordVersion(direction) {
      return getEditorChordVersionService()?.switchVersion?.(direction);
    }

    function addChordVersion() {
      return getEditorChordVersionService()?.addVersion?.();
    }

    function renameChordVersion() {
      return getEditorChordVersionService()?.renameVersion?.();
    }

    function syncTransposeToTimelineChords() {
      return getEditorChordVersionService()?.syncTransposeToTimeline?.();
    }

    let edChordModalService = null;
    function getEditorChordModalService() {
      if (
        !edChordModalService &&
        typeof window.EditorChordModalService?.create === 'function'
      ) {
        edChordModalService = window.EditorChordModalService.create({
          getSong: getCurrentEditorSong,
          getChordCommandService: () => getEditorChordCommandService(),
          getCurrentChord: () => currentChord,
          setCurrentChord: value => { currentChord = value; },
          getMode: () => edChordModalMode,
          setMode: value => { edChordModalMode = value; },
          getChordIndex: () => edChordIdx,
          setChordIndex: value => { edChordIdx = value; },
          setPendingAnchor: value => { edPendingAnchor = value; },
          buildEditor: buildChordEditor,
          translate: t
        });
      }
      return edChordModalService;
    }

    function edOpenChordModal(idx) {
      return getEditorChordModalService()?.open?.(idx) || false;
    }

    function edCloseChordModal() {
      return getEditorChordModalService()?.close?.() || false;
    }
    function edConfirmChord() {
      const song = getCurrentEditorSong();
      if (!song || edChordModalMode !== 'editor') return;
      const commandService = getEditorChordCommandService();
      const name = commandService
        ? commandService.normalizeName($('chordManual')?.value || '')
        : ($('chordManual')?.value || '').trim();
      if (!name) { edCloseChordModal(); return; }
      const chordIndex = edChordIdx;
      const pendingAnchor = edPendingAnchor;
      if (commandService) {
        commandService.applyName(song, chordIndex, pendingAnchor, name);
      } else if (chordIndex !== null && song.chords[chordIndex]) {
        song.chords[chordIndex].name = name;
        edSyncBaseChordName(chordIndex);
      } else if (pendingAnchor) {
        song.chords.push({ ...pendingAnchor, name });
        if (!song.baseChordNames) song.baseChordNames = [];
        song.baseChordNames.push(edBaseNameFromDisplayed(name));
      }
      edPendingAnchor = null; edChordIdx = null;
      edCloseChordModal(); edRenderChords(); edCommit();
      // Sequential chording: advance cursor
      if (edSeqChordingActive) {
        if (edSeqCursor < edSeqPoints.length - 1) {
          edSeqCursor++;
          edRenderChords();
        } else {
          const seqStart = song.chords.length - edSeqPoints.length;
          edFilterChordsWithBase((c, i) => i < seqStart || c.name);
          edSeqChordingActive = false;
          edSeqPoints = [];
          getEditorSongStateService()?.setSeqPoints([]);
          edCommit(); edRenderChords();
          toast(t('chordDone'));
        }
      }
    }
    function edDeleteChord() {
      const song = getCurrentEditorSong();
      if (edChordIdx !== null && song) {
        edRemoveChordAt(edChordIdx);
      }
      edCloseChordModal(); edRenderChords(); edCommit();
    }

    // -- Transposition --

    function edTransposeKeyName(key, semitones) {
      return getEditorKeyCommandController()?.transposeKeyName?.(
        key,
        semitones
      ) || key;
    }

    function edToggleAccidental() {
      return getEditorKeyCommandController()?.toggleAccidental?.() || false;
    }

    // ===== CENTRAL KEY/TRANSPOSE FUNCTIONS =====
    function keyToSemi(key) {
      return getEditorKeyCommandController()?.keyToSemi?.(key) ?? -1;
    }
    function keyDelta(fromKey, toKey) {
      return getEditorKeyCommandController()?.keyDelta?.(fromKey, toKey) ?? 0;
    }
    function transposeChordNamesInPlace(chords, semitones) {
      return getEditorKeyCommandController()?.transposeChordNamesInPlace?.(
        chords,
        semitones
      ) || 0;
    }

    // Central refresh: update all UI from state
    function refreshKeyUI() {
      return getEditorKeyCommandController()?.refreshKeyUI?.();
    }

    function renderAllChordsAndText() {
      return getEditorKeyCommandController()?.renderAllChordsAndText?.();
    }

    // TRANSPOSE: always compute from baseChordNames (never from already-transposed chords)
    function applyTranspose(newTranspose) {
      return getEditorKeyCommandController()?.applyTranspose?.(
        newTranspose
      ) || false;
      // همگام‌سازی ترنسپز با ورژن فعال فعلی
    }

    // KEY CHANGE: only modify chord names in current state (from baseChordNames)
    function applyKeyChange(newKey, newMode) {
      return getEditorKeyCommandController()?.applyKeyChange?.(
        newKey,
        newMode
      ) || false;
    }

    // ORIGINAL KEY CHANGE: edit the base-key reference without moving the project
    function applyOriginalKeyChange(newKey, newMode) {
      return getEditorKeyCommandController()?.applyOriginalKeyChange?.(
        newKey,
        newMode
      ) || false;
    }

    // ALT+CLICK: make the project key equal to the independent original key.
    function syncProjectKeyToOriginal() {
      return getEditorKeyCommandController()?.syncProjectKeyToOriginal?.() ||
        false;
    }

    // RESET TO ORIGINAL: restore chord names from baseChordNames, preserve positions
    function resetToOriginalKey() {
      return getEditorKeyCommandController()?.resetToOriginalKey?.() || false;
    }
    getEditorKeyCommandController()?.bind?.();

    // -- Toolbar bindings --
    let _sizeLocked = false;
    let edToolbarService = null;

    function getEditorToolbarService() {
      if (
        !edToolbarService &&
        typeof window.EditorToolbarService?.create === 'function'
      ) {
        edToolbarService = window.EditorToolbarService.create({
          documentRef: document,
          getSong: getCurrentEditorSong,
          getElement: id => $(id),
          isKeySyncing: () =>
            getEditorKeyCommandController()?.isKeySyncing?.() || false,
          artistKey: editorArchiveArtistKey,
          render: rebuild => edRenderEditor(rebuild),
          renderChords: immediate => edRenderChords(immediate),
          save: () => edSaveSong(),
          applyKeyChange: (key, mode) => applyKeyChange(key, mode),
          refreshKeyUI: () => refreshKeyUI(),
          renderTracks: () => renderTracks(),
          renderRuler: () => renderRuler(),
          renderClips: () => renderClips(),
          onTimingChange: () => handleTimingChange(),
          toast: message => toast(message),
          noteNames: getEditorKeyCommandController()?.noteNames || []
        });
      }
      return edToolbarService;
    }

    function toggleSizeLock() {
      const next = getEditorToolbarService()?.toggleSizeLock?.();
      if (typeof next === 'boolean') _sizeLocked = next;
      return next;
    }

    function syncSizeLocked(changedId) {
      return getEditorToolbarService()?.syncSizeLocked?.(changedId);
    }

    // ===== RANDOM LINE COLORS =====
    const LINE_COLOR_PALETTE = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F1948A', '#82E0AA', '#F8C471', '#AED6F1', '#D7BDE2',
      '#A3E4D7', '#FAD7A0', '#A9CCE3', '#D5DBDB', '#E8DAEF',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#01A3A4', '#F368E0',
      '#FF6348', '#7BED9F', '#70A1FF', '#FFA502', '#2ED573'
    ];

    function _shufflePalette() {
      const p = [...LINE_COLOR_PALETTE];
      for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
      return p;
    }

    function handleLineColorClick(e, type) {
      if (e.altKey) { resetLineColor(type); return; }
      randomizeLineColor(type);
    }

    function randomizeLineColor(type) {
      const songState = getEditorSongStateService();
      const song = songState?.currentSong?.();
      if (!song || song.editorLocked) return;
      const lines = songState.getLyrics().split('\n');
      if (lines.length === 0) return;
      const shuffled = _shufflePalette();

      if (type === 'text') {
        songState.replaceLineColors(
          lines.map((_, index) => shuffled[index % shuffled.length])
        );
        edRenderEditor(false);
        toast('🎨 رنگ متن رندوم شد');
      } else {
        songState.colorChordsByLine(
          lineIndex => shuffled[lineIndex % shuffled.length]
        );
        edRenderChords();
        toast('🎨 رنگ آکوردها رندوم شد');
      }
      edSaveSong();
    }

    function resetLineColor(type) {
      const songState = getEditorSongStateService();
      if (!songState?.currentSong?.()) return;
      const defaultTextColor = '#0fa966';
      const defaultChordColor = '#e6aa28';
      if (type === 'text') {
        songState.clearLineColors();
        songState.setTextColor(defaultTextColor);
        edRenderEditor(false);
        toast('🔄 رنگ متن ریست شد');
      } else {
        songState.resetChordColors(defaultChordColor);
        songState.setChordColorStyle(defaultChordColor);
        edRenderChords();
        toast('🔄 رنگ آکوردها ریست شد');
      }
      edSaveSong();
    }

    function toggleEditorLock() {
      return getEditorToolbarService()?.toggleEditorLock?.();
    }
    getEditorToolbarService()?.bind?.();

    function isEditorVisualRTL() {
      const editor = $('editor');
      if (editor && typeof getComputedStyle === 'function') {
        const direction = getComputedStyle(editor).direction;
        if (direction) return direction === 'rtl';
      }
      return document.documentElement?.dir === 'rtl';
    }

    function hasSelectedChordLineClip() {
      const daw = editorGetRuntimeDAW();
      return Boolean(
        daw?.clips?.some(clip =>
          clip?.type === 'chord' && daw.selectedIds?.has(clip.id)
        )
      );
    }

    // Keyboard composition belongs to its dedicated controller service.
    let editorKeyboardRuntime = null;
    const editorKeyboardController =
      window.EditorKeyboardControllerService?.create({
        runtimeService: window.EditorKeyboardRuntimeService,
        windowRef: window,
        state: {
          isChordModalOpen: () =>
            $('chord-modal')?.classList.contains('show'),
          isEditorChordModal: () => edChordModalMode === 'editor',
          getChordIndex: () => edChordIdx,
          isEditorLocked: () => Boolean(getCurrentEditorSong()?.editorLocked),
          hasSelectedChords: () => edSelectedChords.length > 0,
          hasSelectedChordLineClip,
          isSequentialChordingActive: () => edSeqChordingActive,
          isShortcutEditing: () => Boolean(_editingShortcutId),
          isFocusMode: () =>
            editorCoreApi.getFocusMode?.() || false,
          isSyncActive: () => syncActive,
          isPerfModeActive: () =>
            getPerformanceState?.()?.modeActive || false,
          isColorToolActive: () => isColorToolActive(),
          getMappingTarget: () =>
            getKeyboardMappingService()?.getTarget?.(),
          getSelectedChords: () => edSelectedChords,
          getSequencePoints: () => edSeqPoints,
          getSequenceCursor: () => edSeqCursor,
          getCurrentSong: getCurrentEditorSong
        },
        shortcuts: {
          getShortcutMatch: (event, id) => matchShortcut(event, id),
          onCancelShortcutEdit: () => {
            _editingShortcutId = null;
            cancelMidiLearn();
            openShortcutModal();
          },
          onFinishShortcutEdit: (code, ctrl, shift) =>
            finishEditShortcut(code, ctrl, shift)
        },
        actions: {
          getDAW: () => editorGetRuntimeDAW(),
          getGridConfig: () =>
            getTimeSignatureGridConfig(
              $('edTimeSig')?.value || '4/4',
              parseInt($('edTempo')?.value, 10) || 120
            ),
          setLoopFromSelectionAndPlay: () => setLoopFromSelectionAndPlay(),
          perfTogglePlay: (...args) => perfTogglePlay(...args),
          togglePlay: (...args) => togglePlay(...args),
          undo: () => undo(),
          redo: () => redo(),
          ensureAudioCtx: () => ensureAudioCtx(),
          startTransport: () => startTransport(),
          openLyricOnlyPopup: () => editorOpenLyricOnlyPopup(),
          openLyricPopup: () => editorOpenLyricPopup(),
          toggleFocusMode: () => editorToggleFocusMode(),
          seekTransport: (time, snap, noSnap) =>
            seekTransport(time, snap, noSnap),
          deleteSelectedClips: () => editorDeleteSelected(),
          splitSelectedAtPlayhead: () => editorSplitSelectedAtPlayhead(),
          copySelected: () => editorCopySelected(),
          cutSelected: () => editorCutSelected(),
          pasteClipboard: () => editorPasteClipboard(),
          setSelection: ids => editorSetSelection(ids),
          duplicateSelected: () => editorDuplicateSelected(),
          transportToStart: () => transportToStart(),
          setLoopFromSelection: () => setLoopFromSelection(),
          toggleLoop: () => toggleLoop(),
          setLoopA: () => setLoopA(),
          setLoopB: () => setLoopB(),
          togglePlayheadMode: () => togglePlayheadMode(),
          toggleMetronome: () => toggleMetronome(),
          toggleRecording: () => toggleRec(),
          toggleSelectedTrackHeight: () => toggleSelectedTrackHeight(),
          zoomHorizontal: direction => zoomTimelineHorizontal(direction),
          zoomVertical: direction => zoomTimelineVertical(direction),
          zoomToSelection: () => zoomTimelineToSelection(),
          zoomFull: () => zoomTimelineFull(),
          syncTap: () => syncTap(),
          exitSyncMode: () => exitSyncMode(),
          clearSelection: () => editorClearSelection()
        },
        ui: {
          hideCutGuide: () => {
            const guide = $('cut-guide');
            if (guide) guide.style.display = 'none';
          },
          cancelMapping: () => getKeyboardMappingService()?.cancel?.(),
          togglePanel: panel => togglePanel(panel)
        },
        color: {
          toggleBrush: () => toggleColorTool('brush'),
          toggleEyedropper: () => toggleColorTool('eyedropper'),
          deactivate: () => deactivateColorTool()
        },
        performance: {
          stop: () => perfStop(),
          nextSong: () => perfNextSong(),
          previousSong: () => perfPrevSong(),
          restartSong: () => perfRestartSong(),
          toggleStageMode: () => perfToggleStageMode(),
          transpose: delta => perfTranspose(delta),
          togglePauseMode: () => perfTogglePauseMode()
        },
        chord: {
          closeModal: () => edCloseChordModal(),
          confirm: () => edConfirmChord(),
          tapTempo: () => editorSyncAnalysisRuntime.tapTempo(),
          quantize: () => quantizeSelectedChords(),
          lineTap: () => edClTap(),
          navigate: direction => edNavigateChord(direction)
        },
        services: {
          getElement: id => $(id),
          getMutationService: () => getEditorMutationService(),
          getSongStateService: () => getEditorSongStateService(),
          renderChords: () => edRenderChords(),
          commit: () => edCommit(),
          clearChordSelection: () => edClearChordSelection(),
          openChordModal: index => edOpenChordModal(index),
          isEditorVisualRTL
        }
      });

    function getEditorKeyboardRuntime() {
      if (!editorKeyboardRuntime) {
        editorKeyboardRuntime = editorKeyboardController?.get?.() || null;
      }
      return editorKeyboardRuntime;
    }

    // Navigate between chords in modal
    function edNavigateChord(dir) {
      const song = getCurrentEditorSong();
      if (edChordIdx === null || !song) return;
      const newName = $('chordManual')?.value?.trim();
      if (newName && song.chords[edChordIdx]) {
        song.chords[edChordIdx].name = newName;
        edSyncBaseChordName(edChordIdx);
      }
      const newIdx = edChordIdx + dir;
      if (newIdx >= 0 && newIdx < song.chords.length) {
        edChordIdx = newIdx;
        $('chordManual').value = song.chords[newIdx].name;
        if ($('chord-preview')) $('chord-preview').textContent = song.chords[newIdx].name;
      }
    }

    getEditorColorToolService()?.init?.();

    // Action -> function mapping
    const ACTION_FUNCTIONS = {
      'play': togglePlay, 'pause': pauseTransport, 'stop': stopTransport,
      'goStart': transportToStart, 'goEnd': transportToEnd,
      'returnToStart': toggleReturnToStart,
      'loop': toggleLoop, 'loopA': setLoopA, 'loopB': setLoopB,
      'setLoopFromSel': setLoopFromSelection,
      'setArrangerA': () => setArrangerA(),
      'setArrangerB': () => setArrangerB(),
      'clearArrangerMarkers': () => clearArrangerMarkers(),
      'toggleArrangerMarkers': () => toggleArrangerMarkers(),
      'undo': () => getHistoryService().undo(),
      'redo': () => getHistoryService().redo(),
      'fullscreen': () => {
        const daw = editorGetRuntimeDAW();
        editorOpenLyricOnlyPopup();
        // Player View must be rendered before transport starts; otherwise
        // its first highlight is already several hundred milliseconds late.
        editorOpenLyricPopup();
        if (!daw.isPlaying) {
          ensureAudioCtx();
          if (daw.playhead <= 0) seekTransport(0, false);
          startTransport();
        }
      },
      'singerView': editorOpenLyricOnlyPopup,
      'playerView': (typeof openPlayerView === 'function') ? openPlayerView : editorOpenLyricPopup,
      'split': editorSplitSelectedAtPlayhead, 'copy': editorCopySelected, 'cut': editorCutSelected, 'paste': editorPasteClipboard,
      'projectHubOpen': () => window.ProjectHub?.open(),
      'archiveOpen': () => editorArchiveCall('open'),
      'quickSearchOpen': () => window.openQuickSearchPanel(),
      'archiveSave': () =>
        Promise.resolve(editorArchiveCall('saveToArchive')).then(() =>
          toast('ذخیره شد')
        ),
      'songNew': () => editorArchiveCall('newSong'),
      'projectExport': () => editorArchiveCall('exportProject'),
      'autoImportOpen': openAutoImportModal,
      'chordImportOpen': openImportChordModal,
      'projectImport': () => editorArchiveCall('importProject'),
      'midiScoreOpen': () => getMidiScoreController()?.open?.(),
      'midiScoreImport': () => getMidiScoreController()?.openImporter?.(),
      'musicXmlScoreOpen': () => getMidiScoreController()?.open?.(),
      'musicXmlScoreImport': () => getMidiScoreController()?.openMusicXmlImporter?.(),
      'midiScoreClose': () => getMidiScoreController()?.close?.(),
      'midiScoreClear': () => getMidiScoreController()?.clearScore?.(),
      'musicXmlScoreClear': () => getMidiScoreController()?.clearMusicXmlScore?.(),
      'arrangerOpen': openArrangerModal,
      'songPrint': () => window.printSong(),
      'shortcutsOpen': openShortcutModal,
      'quickSearchClose': () => window.closeQuickSearchPanel(),
      'quickSearchFilter': () => window.quickSearchFilter(),
      'quickSearchClearInput': () => {
        const input = document.getElementById('quickSearchInput');
        if (input) input.value = '';
        window.quickSearchFilter();
      },
      'quickSearchClearFilters': () => window.quickSearchClearFilters(),
      'quickSearchLoadSong': (_, element) => window.quickSearchLoadSong(element.dataset.songId),
      toolbarDock: () => toggleToolbarDock(),
      sizeLock: () => toggleSizeLock(),
      lineColorText: event => handleLineColorClick(event, 'text'),
      lineColorChord: event => handleLineColorClick(event, 'chord'),
      editorLock: () => toggleEditorLock(),
      syncChordLine: () => syncChordLineFromLyrics(),
      sendToArranger: () => sendCurrentSongToArranger(),
      toggleMetronome: () => toggleMetronome(),
      tapTempo: () => editorSyncAnalysisRuntime.tapTempo(),
      detectTempo: () =>
        editorAudioAnalysisRuntime
          ? editorAudioAnalysisRuntime.detectTempo()
          : editorSyncAnalysisRuntime.detectTempo(),
      detectKey: () =>
        editorAudioAnalysisRuntime
          ? editorAudioAnalysisRuntime.detectKey()
          : editorSyncAnalysisRuntime.detectKey(),
      detectChords: () => editorAudioAnalysisRuntime?.detectChords?.(),
      analyzeAll: () => editorAudioAnalysisRuntime?.analyzeAll?.(),
      toggleMIDITab: () => toggleMIDITab(),
      toggleMIDISync: () => toggleMIDISync(),
      toggleMidiMonitor: () => toggleMidiMonitor(),
      setHighlightEffect: (_, element) => setHighlightEffect(element.dataset.value),
      toggleRec: () => toggleRec(),
      split: () => editorSplitSelectedAtPlayhead(),
      delete: () => editorDeleteSelected(),
      toggleLoop: () => toggleLoop(),
      setLoopA: () => setLoopA(),
      setLoopB: () => setLoopB(),
      clearLoop: () => clearLoop(),
      setArrangerA: () => setArrangerA(),
      setArrangerB: () => setArrangerB(),
      clearArrangerMarkers: () => clearArrangerMarkers(),
      toggleArrangerMarkers: () => toggleArrangerMarkers(),
      togglePlayheadMode: () => togglePlayheadMode(),
      toggleSnap: () => toggleSnap(),
      showQuantize: () => showQuantizeModal(),
      toggleColorTool: (_, element) => toggleColorTool(element.dataset.value),
      selectColor: (_, element) => selectColor(element.value),
      toggleMixer: () => toggleMixer(),
      openSettings: () => openSettings(),
      setZoom: (_, element) => setZoom(Number(element.value), null),
      perfPause: () => perfTogglePauseMode(),
      perfStop: () => perfStop(),
      perfNext: () => perfNextSong(),
      perfRestart: () => perfRestartSong(),
      perfPlay: () => perfTogglePlay(),
      perfPrev: () => perfPrevSong(),
      perfTransposeDown: () => perfTranspose(-1),
      perfTransposeUp: () => perfTranspose(1),
      closeArrSongNote: () => closeArrSongNote(),
      saveArrSongNote: () => saveArrSongNote(),
      perfNoteClose: (_, element) => element.parentElement?.classList.remove('show'),
      setCountInBars: (_, element) => setCountInBars(element.value),
      applyTheme: (_, element) => applyTheme(element.value),
      applyAccent: (_, element) => applyAccent(element.value),
      applyOutputDevice: (_, element) => applyOutputDevice(element.value),
      applyMetroSound: (_, element) => applyMetroSound(element.value),
      previewMetroSound: () => previewMetronomeSound(),
      applyLanguage: (_, element) => {
        window.setCurrentLang?.(element.value);
        window.applyI18n?.();
        window.toast?.(element.value === 'fa' ? 'زبان فارسی' : 'English');
      },
      applySettingsToggles: () => applySettingsToggles(),
      resetSettings: () => resetSettings(),
      closeSettings: () => closeSettings(),
      clearMidiLog: () => clearMidiLog(),
      toggleMidiMonitorAutoScroll: () => toggleMidiMonitorAutoScroll(),
      toggleMidiSync: () => toggleMIDISync(),
      applyQuantize: (_, element) => applyQuantize(element.dataset.value, element),
      closeImportChordModal: () => closeImportChordModal(),
      fetchFromUrl: () => fetchFromUrl(),
      applyImportChords: () => applyImportChords(),
      autoImportNewRequest: () => autoImportNewRequest(),
      autoRetryFailed: () => autoRetryFailed(),
      autoImportSaveArchive: () => autoImportSaveArchive(),
      autoImportSaveConfirm: () => autoImportSaveConfirm(),
      closeAutoImportModal: () => closeAutoImportModal(),
      autoImportDoSave: () => autoImportDoSave(),
      startAutoImport: () => startAutoImport(),
      archToggleFullscreen: () => editorArchiveCall('toggleFullscreen'),
      archClose: () => editorArchiveCall('close'),
      archToggleArtistSection: () => editorArchiveCall('toggleArtistSection'),
      archClearArtistSearch: () => {
        const input = document.getElementById('artistSearchInput');
        if (input) input.value = '';
        editorArchiveCall('filterArtists');
      },
      archArtistSlide: (_, element) =>
        editorArchiveCall('artistSlide', Number(element.dataset.value)),
      archSetTab: (_, element) =>
        editorArchiveCall('setTab', element.dataset.tab),
      archClearSearch: () => {
        const input = document.getElementById('archiveSearch');
        if (input) input.value = '';
        editorArchiveCall('applyFilters');
      },
      archSetView: (_, element) =>
        editorArchiveCall('setView', element.dataset.value),
      archToggleSelectMode: () => editorArchiveCall('toggleSelectMode'),
      archImportFiles: () => editorArchiveCall('importFiles'),
      archImportFolder: () => editorArchiveCall('importFolder'),
      archImportFullArchive: () =>
        editorArchiveCall('importFullArchive'),
      archExportAll: () => editorArchiveCall('exportAll'),
      archRefresh: () => editorArchiveCall('refresh'),
      archClearFilters: () => editorArchiveCall('clearFilters'),
      archBulkFav: (_, element) =>
        editorArchiveCall('bulkFavorite', element.dataset.value === 'true'),
      archBulkExport: () => editorArchiveCall('bulkExport'),
      archBulkTrash: () => editorArchiveCall('bulkTrash'),
      archArtistCtx: (_, element) =>
        editorArchiveCall('artistContextAction', element.dataset.value),
      archConfirmResolve: (_, element) =>
        editorArchiveCall(
          'resolveConfirm',
          element.dataset.value === 'true'
        ),
      archEditClose: () => editorArchiveCall('editClose'),
      archEditSave: () => editorArchiveCall('editSave'),
      archCtxAction: (_, element) =>
        editorArchiveCall('contextAction', element.dataset.value),
      closeShortcutModal: () => closeShortcutModal(),
      resetShortcuts: () => resetShortcuts(),
      clearMidiMaps: () => {
        shortcutStore.clearMidiMaps();
        openShortcutModal();
        toast('Mapping های MIDI پاک شد');
      },
      closeArrangerModal: () => closeArrangerModal(),
      switchArrTab: (_, element) => switchArrTab(element.dataset.tab),
      saveCurrentArranger: () => saveCurrentArranger(),
      saveCurrentArrangerDebounced: () => saveCurrentArrangerDebounced(),
      exportCurrentArranger: () => exportCurrentArranger(),
      openPerfMode: () => openPerfMode(),
      arrFilterSongs: () => arrFilterSongs(),
      arrAutoTranspose: () => arrAutoTranspose(),
      arrClearNotes: () => arrClearNotes(),
      arrSetCrossfade: (_, element) => arrSetCrossfade(Number(element.value)),
      arrTogglePauseBetween: () => arrTogglePauseBetween(),
      closeChordEditor: () => closeChordEditor(),
      chordModalDelete: () => chordModalDelete(),
      chordModalConfirm: () => chordModalConfirm(),
      loadAutoImportSong: (_, element) => loadAutoImportSong(element.dataset.value),
      createNewArranger: () => createNewArranger(),
      importArrangerFromFile: () => importArrangerFromFile(),
      importAllPlaylistsFromFile: () => importAllPlaylistsFromFile(),
      exportAllPlaylistsToFile: () => exportAllPlaylistsToFile(),
      archSelectAll: (_, element) =>
        editorArchiveCall('selectAll', !!element.checked),
      archToggleSelect: (_, element) =>
        editorArchiveCall('toggleSelect', element.dataset.songId),
      archExitReadOnly: () => editorArchiveCall('exitReadOnly'),
      archCreateEditableCopy: () =>
        editorArchiveCall('createEditableCopy'),
      archClearArtistFilter: () =>
        editorArchiveCall('clearArtistFilter'),
      removeMidiMap: (_, element) => {
        removeMidiMap(Number(element.dataset.value));
        openShortcutModal();
      },
      startMidiLearn: (_, element) => startMidiLearn(element.dataset.value),
    };

    let eventBindings = null;
    let keyboardMappingService = null;

    function getKeyboardMappingService() {
      if (
        !keyboardMappingService &&
        typeof window.KeyboardMappingService?.create === 'function'
      ) {
        keyboardMappingService = window.KeyboardMappingService.create({
          documentRef: document,
          getLabel: actionId =>
            SHORTCUT_DEFAULTS.find(shortcut => shortcut.id === actionId)?.label ||
            actionId,
          saveShortcut: (actionId, shortcut) => {
            SHORTCUTS[actionId] = shortcut;
            saveShortcuts();
          },
          formatKeyName,
          toast
        });
      }
      return keyboardMappingService;
    }

    function handleGlobalMousedownCapture(e) {
      if (!e.ctrlKey || !e.shiftKey || !e.altKey) return;
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      startMapping(btn.dataset.action, btn);
    }

    function initializeEventBindings() {
      if (document.readyState === 'loading') return;
      if (eventBindings || typeof window.EventBindings !== 'function') return;

      eventBindings = new window.EventBindings({
        actions: ACTION_FUNCTIONS,
        onGlobalKeydownCapture: handleGlobalKeydownCapture,
        onGlobalKeydown: handleGlobalKeydown,
        onGlobalKeyup: handleGlobalKeyup,
        onGlobalDocumentKeydown: handleGlobalDocumentKeydown,
        onGlobalMousedownCapture: handleGlobalMousedownCapture
      });

      eventBindings.init();
    }

    // Supports either script load order without exposing app internals globally.
    window.addEventListener(
      'akordyar:event-bindings-ready',
      initializeEventBindings,
      { once: true }
    );

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeEventBindings, { once: true });
    } else {
      initializeEventBindings();
    }

    function startMapping(actionId, el) {
      // Deactivate any active tools
      if (isColorToolActive()) deactivateColorTool();
      return getKeyboardMappingService()?.start?.(actionId, el) || false;
    }

    function cancelMapping() {
      return getKeyboardMappingService()?.cancel?.();
    }

    // History must be attached before lifecycle initialization. The service
    // remains disabled until hydration has completed and explicitly activates.
    if (typeof attachHistoryService === 'function') {
      attachHistoryService();
    }

    const lifecycleReady = window.EditorLifecycleService?.initialize?.({
      initDAW: init,
      initSong: edInitSong,
      initAccidentalSelector,
      applyI18n,
      initHighlightEffect,
      refreshStorageInfo
    });
    lifecycleReady?.catch?.(error => {
      console.error('Editor lifecycle initialization failed:', error);
    });
  
    let editorPlaylistBackupService = null;
    function getEditorPlaylistBackupService() {
      if (
        !editorPlaylistBackupService &&
        typeof window.EditorPlaylistBackupService?.create === 'function'
      ) {
        editorPlaylistBackupService =
          window.EditorPlaylistBackupService.create({
            documentRef: document,
            windowRef: window,
            getArrangers: () =>
              window.AkordyarCoreApi?.getArrangers?.() || [],
            getEditingArr: () =>
              window.AkordyarCoreApi?.getEditingArr?.() || null,
            getAllSongs: () => editorGetArchiveSongs(),
            setAllSongs: (...args) => editorSetArchiveSongs(...args),
            saveArrangers: (...args) =>
              window.AkordyarCoreApi?.saveArrangers?.(...args),
            renderArrangerManager: (...args) =>
              window.AkordyarCoreApi?.renderArrangerManager?.(...args),
            toast: message => toast(message),
            logger: console,
            now: () => Date.now(),
            isoNow: () => new Date().toISOString(),
            random: () => Math.random(),
            blobRef: window.Blob,
            urlRef: window.URL
          });
      }
      return editorPlaylistBackupService;
    }

    function exportAllPlaylistsToFile() {
      return getEditorPlaylistBackupService()?.exportAllPlaylistsToFile();
    }

    function importAllPlaylistsFromFile() {
      return getEditorPlaylistBackupService()?.importAllPlaylistsFromFile();
    }

/**
 * دریافت مسیر فایل صوتی برای یک کلیپ (بدون لود کردن)
 */
function getClipFilePath(clip, projectFilePath = null) {
  let filePath = null;
  
  // بررسی حالت‌های مختلف ذخیره‌سازی
  if (clip.storage && clip.storage.mode === 'copy') {
    const projRoot = projectFilePath ? pathDirname(projectFilePath) : editorGetRuntimeDAW().projectRoot;
    if (!projRoot || !clip.storage.projectPath) {
      return null;
    }
    filePath = (window.electronAPI?.resolvePath)
               ? window.electronAPI.resolvePath(projRoot, clip.storage.projectPath)
               : pathJoin(projRoot, clip.storage.projectPath);
  } else if (clip.storage && clip.storage.mode === 'reference') {
    filePath = clip.storage.externalPath;
  } else if (clip.relativePath) {
    const projRoot = projectFilePath ? pathDirname(projectFilePath) : editorGetRuntimeDAW().projectRoot;
    if (projRoot) {
      filePath = (window.electronAPI?.resolvePath)
                 ? window.electronAPI.resolvePath(projRoot, clip.relativePath)
                 : pathJoin(projRoot, clip.relativePath);
    }
  } else if (clip._filePath) {
    filePath = clip._filePath;
  } else if (clip.filePath) {
    filePath = clip.filePath;
  }
  
  return filePath;
}

editorPublicApi.publish({
  saveSong: edSaveSong,
  syncToolbar: edSyncToolbar,
  renderEditor: edRenderEditor,
  clearChordSelection: edClearChordSelection,
  setLaneHeight,
  switchChordVersion,
  addChordVersion,
  renameChordVersion,
  buildChordEditor,
  buildPiano,
  updateChordPreview,
  renderChords: edRenderChords,
  openChordEditor,
  closeChordEditor,
  chordModalConfirm,
  chordModalDelete,
  placeChordOnTimeline,
  getClipFilePath,
  createBlankSong: edBlankSong,
  parseRawSong,
  isValidNote: etIsValidNote,
  decodeFileToBuffer,
  peaksFromBuffer,
  refreshClipWaveImage,
  setProjectFilePath: setEditorProjectFilePath,
  clearProjectFilePath: clearEditorProjectFilePath,
  saveCurrentVersion,
  applyImportChords,
  getMidiScoreController,
  saveProjectFile: edSaveProjectFile,
  exportProjectFull: edExportProjectFull
});
