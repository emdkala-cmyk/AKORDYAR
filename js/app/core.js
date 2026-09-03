console.log("!!! APP_CORE_LOADED_FROM_DISK !!!");
// ==========================================
// PART 1: Initialization & Electron Setup
// ==========================================
// ─── تشخیص صحیح محیط الکترون ───
// قبلاً از process.versions.electron استفاده می‌شد که با contextIsolation:true
// در دسترس نیست. حالا از window.electronAPI (که preload.js ست می‌کنه) استفاده می‌کنیم.
const isElectron = !!(typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron) ||
                   (typeof process !== 'undefined' && process.versions && !!process.versions.electron);

if (isElectron) {
  console.log('[App] Electron mode detected. electronAPI available:', !!window.electronAPI);
} else {
  console.log('[App] Browser mode detected.');
}


// ==========================================
// PART 2: Audio Import & Hard Drive Auto-Load
// ==========================================
// منطق loadAudioFromHardDrive / pathDirname / pathJoin / handleAudioImport /
// loadProject / resolveClipAudio در js/core/ProjectAudioService.js متمرکز است.

// تشخیص محیط مرورگر/پنجره الکترون
const isBrowser = typeof window !== 'undefined';

// globalScope فقط برای انتشار runtime state نهایی استفاده می‌شود.
// placeholder قدیمی DAW حذف شده تا adapter هیچ‌وقت state ناقص را نبیند.
const globalScope = isBrowser ? window : global;
const coreEditorRuntime = globalScope.EditorRuntimeAdapter;
if (
  !coreEditorRuntime?.getDAWOrThrow ||
  !coreEditorRuntime?.getPERFOrThrow ||
  !coreEditorRuntime?.startPointerDrag
) {
  throw new Error(
    'EditorRuntimeAdapter باید قبل از app/core.js بارگذاری شود.'
  );
}
const coreGetRuntimeDAW = () => coreEditorRuntime.getDAWOrThrow();
const coreGetRuntimePERF = () => coreEditorRuntime.getPERFOrThrow();
const coreStartPointerDrag = (...args) =>
  coreEditorRuntime.startPointerDrag(...args);
const coreAudioStorageRuntime = globalScope.EditorAudioStorageRuntime;
if (!coreAudioStorageRuntime) {
  throw new Error(
    'EditorAudioStorageRuntime باید قبل از app/core.js بارگذاری شود.'
  );
}
const coreSaveAudioBlobToDB = (...args) =>
  coreAudioStorageRuntime.saveAudioBlobToDB?.(...args);
const coreSaveAudioBlobsForProject = (...args) =>
  coreAudioStorageRuntime.saveAudioBlobsForProject?.(...args);
let corePerformanceRuntime = null;
let corePerformanceController = null;
let coreArrangerRuntime = null;
let coreWavEncoderRuntime = null;
let coreTimelineRuntime = null;
let coreClipInteractionRuntime = null;
let corePopupRuntime = null;
// Sequential-chord state is shared by core.js and editor.js.
let edSeqModeActive = false,
  edSeqPoints = [],
  edSeqChordingActive = false,
  edSeqCursor = 0;

const corePublicApiFactory = globalScope.CorePublicApi;
if (!corePublicApiFactory?.create) {
  throw new Error('CorePublicApi باید قبل از app/core.js بارگذاری شود.');
}
const corePublicApi = corePublicApiFactory.create({
  target: globalScope,
  namespace: 'AkordyarCoreApi',
  exposeGlobals: false
});
const coreArchiveCall = (name, ...args) => {
  const fn = globalScope.AkordyarArchiveApi?.[name];
  return typeof fn === 'function' ? fn(...args) : undefined;
};
const coreGetArchiveSongs = (...args) =>
  coreArchiveCall('getAllSongs', ...args) || [];
const coreSetArchiveSongs = (...args) =>
  coreArchiveCall('setAllSongs', ...args);
const coreSaveArchiveSong = (...args) =>
  coreArchiveCall('saveToArchive', ...args);
const coreGetPerformanceState = () => corePerformanceController?.state;
const coreReadPerformanceState = () =>
  corePerformanceController?.getState?.() || null;
const coreUpdatePerformanceState = patch =>
  corePerformanceController?.updateState?.(patch);
const coreGetArrangerState = () => {
  const state = coreGetPerformanceState();
  return {
    active: state?.active || false,
    data: state?.data || null,
    index: state?.index ?? -1,
    nextState: state?.nextState || null,
    preparePending: state?.preparePending || false,
    prepStartedForIndex: state?.prepStartedForIndex ?? -1,
    waitPollActive: state?.waitPollActive || false,
    isCrossfading: state?.crossfading || false,
    perfModeActive: state?.modeActive || false,
    perfPauseMode: state?.pauseMode || false
  };
};

coreWavEncoderRuntime =
  globalScope.CoreWavEncoderService?.create?.({
    BlobCtor: globalScope.Blob
  });
if (!coreWavEncoderRuntime) {
  throw new Error(
    'CoreWavEncoderService باید قبل از app/core.js بارگذاری شود.'
  );
}

let editorCustomPromptService = null;
function getEditorCustomPromptService() {
  if (!editorCustomPromptService) {
    const create = globalScope.EditorCustomPromptService?.create;
    if (typeof create !== 'function') {
      throw new Error('EditorCustomPromptService is not loaded. Check script order.');
    }
    editorCustomPromptService = create({
      documentRef: document,
      windowRef: window,
      schedule: window.setTimeout
    });
  }
  return editorCustomPromptService;
}

/**
 * customPrompt — جایگزین window.prompt که در الکترون پشتیبانی نمی‌شه
 *
 * @param {string} message - پیام به کاربر
 * @param {string} defaultValue - مقدار پیش‌فرض
 * @returns {Promise<string|null>} - مقدار وارد شده یا null اگه کنسل بشه
 */
function customPrompt(message, defaultValue = '') {
  return getEditorCustomPromptService().prompt(message, defaultValue);
}

    let settingsRuntime = null;
    function getAppSettings() {
      return settingsRuntime?.getSettings?.() || {};
    }

    const editorTransportState = globalScope.EditorTransportStateService.create();
    let transportSchedulingService = null;
    let audioContextServiceBridge = null;
    let countInSchedulerBridge = null;
    const coreGridQuantizeRuntime =
      globalScope.CoreGridQuantizeService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        getTransportState: () => editorTransportState,
        getSongState: () => requireEditorSongStateService(),
        getDAW: () => coreGetRuntimeDAW(),
        timelineGrid: globalScope.TimelineGrid,
        meter: globalScope.Meter,
        quantizer: globalScope.EditorChordQuantizeService,
        saveState: () => saveState(),
        renderClips: () => renderClips(),
        renderRuler: () => renderRuler(),
        toast: message => toast(message),
        round: value => roundMs(value)
      });
    if (!coreGridQuantizeRuntime) {
      throw new Error(
        'CoreGridQuantizeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      getTimeSignatureGridConfig,
      getActiveQuantizeGridStep,
      toggleSnap,
      isSnapEnabled,
      snapTime,
      showQuantizeModal,
      applyQuantize,
      quantizeSelectedChords
    } = coreGridQuantizeRuntime;
    corePublicApi.publish({
      getTimeSignatureGridConfig,
      getActiveQuantizeGridStep,
      toggleSnap,
      isSnapEnabled,
      snapTime,
      showQuantizeModal,
      applyQuantize,
      quantizeSelectedChords
    });
    coreGridQuantizeRuntime.bindModalDismiss();

    /* ---- Warp Audio Renderer (pitch-preserving WSOLA stretch) ---- */
    const coreWarpAudioRenderer =
      globalScope.WarpAudioRendererService?.create?.({
        ensureAudioCtx: (...args) => ensureAudioCtx(...args),
        getBuffer: clip =>
          coreGetRuntimeDAW().bufferCache?.get?.(clip?.bufferKey) || null,
        FreeWarp: globalScope.FreeWarpEngine,
        logger: console
      });

    /* ---- Free Warp Service ---- */
    const coreFreeWarpRuntime =
      globalScope.CoreFreeWarpService?.create?.({
        getDAW: () => coreGetRuntimeDAW(),
        getClip: clipId => getClip(clipId),
        getTransportState: () => editorTransportState,
        snapTime: (...args) => snapTime(...args),
        isSnapEnabled: () => isSnapEnabled(),
        roundMs: value => roundMs(value),
        saveState: (...args) => saveState(...args),
        renderAll: (...args) => renderAll(...args),
        renderClips: (...args) => renderClips(...args),
        refreshClipWaveImage: (...args) => refreshClipWaveImage(...args),
        scheduleAllFromPlayhead: (...args) =>
          scheduleAllFromPlayhead(...args),
        getWarpAudioRenderer: () => coreWarpAudioRenderer,
        toast: (...args) => toast(...args)
      });
    if (coreFreeWarpRuntime) {
      corePublicApi.publish({
        setSnapPoint: coreFreeWarpRuntime.setSnapPoint,
        getSnapPoint: coreFreeWarpRuntime.getSnapPoint,
        getSnapPointTime: coreFreeWarpRuntime.getSnapPointTime,
        insertWarpMarker: coreFreeWarpRuntime.insertWarpMarker,
        removeWarpMarker: coreFreeWarpRuntime.removeWarpMarker,
        moveWarpMarker: coreFreeWarpRuntime.moveWarpMarker,
        getSourceTime: coreFreeWarpRuntime.getSourceTime,
        getWarpedDuration: coreFreeWarpRuntime.getWarpedDuration,
        commitWarp: coreFreeWarpRuntime.commitWarp,
        renderWarpAudio: coreFreeWarpRuntime.renderWarpAudio,
        getWarpedAudioBuffer: coreFreeWarpRuntime.getWarpedAudioBuffer,
        setWarpMode: coreFreeWarpRuntime.setWarpMode,
        isWarpMode: coreFreeWarpRuntime.isWarpMode,
        getFreeWarpService: () => coreFreeWarpRuntime
      });
    }

    const coreTransportRuntime =
      globalScope.CoreTransportService?.create?.({
        getDAW: () => coreGetRuntimeDAW(),
        getElement: id => $(id),
        tempoMapService: globalScope.TempoMap,
        setTempoMap: map =>
          requireEditorSongStateService().setTempoMap(map),
        getTransportState: () => editorTransportState,
        getTimingContext: () =>
          requireEditorSongStateService().getTimingContext(),
        ensureAudioCtx: (...args) => ensureAudioCtx(...args),
        cancelCountIn: (...args) => cancelCountIn(...args),
        isCountInRunning: (...args) => isCountInRunning(...args),
        getProjectEnd: (...args) => getProjectEnd(...args),
        snapTime: (...args) => snapTime(...args),
        playheadMath: PlayheadMath,
        setTransportOrigin: (...args) => setTransportOrigin(...args),
        getTransportPlayhead: (...args) =>
          getTransportPlayhead(...args),
        updatePlayheadUI: (...args) => updatePlayheadUI(...args),
        scheduleAllFromPlayhead: (...args) =>
          scheduleAllFromPlayhead(...args),
        stopAllVoices: (...args) => stopAllVoices(...args),
        startMetronome: (...args) => startMetronome(...args),
        stopMetronome: (...args) => stopMetronome(...args),
        getMetronomeSchedulerBridge: () =>
          getMetronomeSchedulerBridge(),
        checkMetronomeTick: (...args) =>
          checkMetronomeTick(...args),
        getCountInScheduler: () => countInSchedulerBridge,
        alignPlayheadToNearestMeasure: (...args) =>
          alignPlayheadToNearestMeasure(...args),
        getTimeSignatureGridConfig: (...args) =>
          getTimeSignatureGridConfig(...args),
        getAppSettings: () => getAppSettings(),
        getRecordingRuntime: () => recordingRuntime,
        getAudioContextService: () => audioContextServiceBridge,
        getArrangerState: () => ({
          ...coreGetArrangerState(),
          selectionEnd,
          playbackPolicy: arrangerPlaybackPolicy
        }),
        setArrangerPreparePending: value => {
          corePerformanceController?.updateState({
            preparePending: value
          });
        },
        setArrangerPrepStartedForIndex: value => {
          corePerformanceController?.updateState({
            prepStartedForIndex: value
          });
        },
        setArrangerWaitPollActive: value => {
          corePerformanceController?.updateState({
            waitPollActive: value
          });
        },
        clearArrangerNextState: () => {
          corePerformanceController?.updateState({ nextState: null });
        },
        prepareNextArrSong: (...args) => prepareNextArrSong(...args),
        loadArrSong: (...args) => loadArrSong(...args),
        hotSwapToNextSong: (...args) => hotSwapToNextSong(...args),
        arrCrossfadeSwap: (...args) => arrCrossfadeSwap(...args),
        renderPerfUI: (...args) => renderPerfUI(...args),
        publishPlaybackSync: (...args) => publishPlaybackSync(...args),
        updateSyncHighlight: (...args) => updateSyncHighlight(...args),
        isSyncActive: () => syncActive,
        isLyricPopupOpen: () => {
          const popup = corePopupRuntime?.getLyricPopup?.();
          return typeof isPopupOpen === 'function' && isPopupOpen(popup);
        },
        requestAnimationFrameRef: (...args) =>
          globalScope.requestAnimationFrame?.(...args),
        cancelAnimationFrameRef: (...args) =>
          globalScope.cancelAnimationFrame?.(...args),
        performanceRef: globalScope.performance,
        toast: message => toast(message),
        logger: console
      });
    if (!coreTransportRuntime) {
      throw new Error(
        'CoreTransportService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      seekTransport,
      resyncPlayingTransport,
      updateReturnToStartButton,
      toggleReturnToStart,
      togglePlay,
      startTransport,
      pauseTransport,
      stopTransport,
      getArrangerEnd,
      transportToStart,
      transportToEnd
    } = coreTransportRuntime;
    corePublicApi.publish(coreTransportRuntime, { exposeGlobals: false });

    const coreMetronomeRuntime =
      globalScope.CoreMetronomeService?.create?.({
        getElement: id => $(id),
        getTransportState: () => editorTransportState,
        getTimingContext: () =>
          requireEditorSongStateService().getTimingContext(),
        getDAW: () => coreGetRuntimeDAW(),
        getProjectEnd: () => getProjectEnd(),
        seekTransport: (...args) => seekTransport(...args),
        stopAllVoices: (...args) => stopAllVoices(...args),
        updatePlayheadUI: (...args) => updatePlayheadUI(...args),
        playheadMath: PlayheadMath,
        getGridConfig: (...args) => getTimeSignatureGridConfig(...args),
        getSchedulingService: () => transportSchedulingService,
        getCountInScheduler: () => countInSchedulerBridge,
        ensureAudioCtx: (...args) => ensureAudioCtx(...args),
        getMetroSound: () => getAppSettings().metroSound || 'classic'
      });
    if (!coreMetronomeRuntime) {
      throw new Error(
        'CoreMetronomeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      alignPlayheadToNearestMeasure,
      setCountInBars,
      getMetronomeSchedulerBridge,
      isCountInRunning,
      cancelCountIn,
      toggleMetronome,
      startMetronome,
      stopMetronome,
      checkMetronomeTick
    } = coreMetronomeRuntime;
    corePublicApi.publish({
      alignPlayheadToNearestMeasure,
      setCountInBars,
      getMetronomeSchedulerBridge,
      isCountInRunning,
      cancelCountIn,
      toggleMetronome,
      startMetronome,
      stopMetronome,
      checkMetronomeTick
    });

    const corePanelLayoutRuntime =
      globalScope.CorePanelLayoutService?.create?.({
        documentRef: document,
        windowRef: window,
        getElement: id => document.getElementById(id),
        getFocusMode: () => corePopupRuntime?.getFocusMode?.() || false,
        panelLayoutService: globalScope.DockablePanelLayoutService,
        timelineScrollbarsService: globalScope.TimelineScrollbarsService,
        timelinePanelLayoutService: globalScope.TimelinePanelLayoutService
      });
    if (!corePanelLayoutRuntime) {
      throw new Error(
        'CorePanelLayoutService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      getTimelinePanelHeight,
      setTimelinePanelHeight,
      syncDockableSidePanelGrid,
      initDockableSidePanels,
      togglePanel
    } = corePanelLayoutRuntime;
    corePublicApi.publish({
      getTimelinePanelHeight,
      setTimelinePanelHeight,
      syncDockableSidePanelGrid,
      initDockableSidePanels,
      togglePanel
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDockableSidePanels, { once: true });
    } else {
      initDockableSidePanels();
    }

    const appConstants = globalScope.AkordyarAppConstants;
    if (!appConstants) {
      throw new Error('AkordyarAppConstants باید قبل از app/core.js بارگذاری شود.');
    }
    const {
      COLORS,
      NOTES,
      FLAT_NOTES,
      ALL_NOTE_NAMES,
      ROOT_NOTES,
      BASS_NOTES,
      NOTE_TO_SHARP,
      NOTE_SEMITONE,
      CHORD_TYPES,
      TENSIONS,
      CHORD_INTERVALS,
      TENSION_INTERVALS,
      CHORD_TEMPLATES
    } = appConstants;
    function chordTypeDisplay(type) { return type === 'min' ? 'm' : type === 'maj' ? '' : type; }
    /* =========================
   PERF / RENDER HELPERS
   ========================= */
const PERF = globalScope.PerformanceRuntimeState?.create?.() || {
  lastSerializedState: '',
  lastSyncActiveLi: -2,
  lastSyncDoneKey: '',
  lastPopupActiveLi: -2,
  lastPopupDoneKey: '',
  lastEditorScrollTarget: -1,
  lastPopupScrollTarget: -1,
  lastSyncTimelinePct: -1,
  lastSyncTimeText: '',
  syncLinesCache: [],
  syncPanelNodes: [],
  rulerMajor: null,
  rulerTotal: -1,
  rulerWidth: -1,
  clipsVersion: 0,
  tracksVersion: 0,
  pendingRenderAll: false,
  pendingSyncPanelRender: false
};
if (typeof globalScope.RuntimeStateAdapter?.setPERF !== 'function') {
  throw new Error('RuntimeStateAdapter باید قبل از app/core.js بارگذاری شود.');
}
globalScope.RuntimeStateAdapter.setPERF(PERF);

const functionUtils = globalScope.AkordyarFunctionUtils;
if (!functionUtils) {
  throw new Error('AkordyarFunctionUtils باید قبل از app/core.js بارگذاری شود.');
}
const {
  rafThrottle,
  debounce,
  arrayShallowEqual,
  safeText,
  buildDoneKey
} = functionUtils;

function centerScrollIfNeeded(container, targetEl, lastTargetRefName) {
  if (!container || !targetEl) return;
  const idx = +(targetEl.dataset.li ?? -1);
  if (PERF[lastTargetRefName] === idx) return;
  PERF[lastTargetRefName] = idx;
  const top = targetEl.offsetTop - (container.clientHeight / 2) + (targetEl.offsetHeight / 2);
  container.scrollTop = Math.max(0, top);
}

const requestRenderAll = rafThrottle(() => { renderAll(); });
const requestRenderSyncLyrics = debounce(() => { renderSyncLyrics(); }, 120);
/* =========================
   END PERF / RENDER HELPERS
   ========================= */


    if (!globalScope.DAWRuntimeState?.create) {
      throw new Error('DAWRuntimeState باید قبل از app/core.js بارگذاری شود.');
    }
    const DAW = globalScope.DAWRuntimeState.create();
    if (typeof globalScope.RuntimeStateAdapter?.setDAW !== 'function') {
      throw new Error('RuntimeStateAdapter باید قبل از app/core.js بارگذاری شود.');
    }
    globalScope.RuntimeStateAdapter.setDAW(DAW);
    const arrangerPlaybackPolicy = globalScope.ArrangerPlaybackPolicyService;

    let activeMidiNotes = new Set(), midiTimeout = null, isRecordingChords = false, currentRecordingClipId = null;
    let currentChord = { root: 'None', type: 'None', tension: '', bass: 'None' };
    function resetRecordingState() {
      isRecordingChords = false;
      currentRecordingClipId = null;
    }
    // Playhead scroll mode: 'page' (scrolls page by page) or 'center' (stationary center)
    coreGetRuntimeDAW().playheadMode = 'page';
    // Arranger transition boundary (B). Looping itself stays disabled.
    let selectionEnd = 0;

    const $ = (id) => document.getElementById(id);
    const uid = (p = 'c') => p + (coreGetRuntimeDAW().nextId++);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const roundMs = (t) => Math.round(t * 1e9) / 1e9;

    // آپدیت nextId بر اساس بزرگ‌ترین ID موجود (جلوگیری از تداخل آیدی)
    function updateNextIdFromClips() {
      const allIds = [...coreGetRuntimeDAW().clips.map(c => c.id), ...(coreGetRuntimeDAW().sections || []).map(s => s.id)];
      allIds.forEach(id => {
        const num = parseInt(id.replace(/^[a-z]+/, ''), 10);
        if (!isNaN(num) && num >= coreGetRuntimeDAW().nextId) coreGetRuntimeDAW().nextId = num + 1;
      });
    }

    function formatTime(sec, ms = true) {
      sec = Math.max(0, sec || 0); const m = Math.floor(sec / 60); const s = Math.floor(sec % 60);
      const milli = Math.floor((sec % 1) * 1000); const base = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      return ms ? `${base}.${String(milli).padStart(3,'0')}` : base;
    }

    function toast(msg) {
      const t = $('toast'); t.textContent = msg; t.classList.add('show');
      clearTimeout(toast._tm); toast._tm = setTimeout(() => t.classList.remove('show'), 1700);
    }

    function ensureAudioCtx() {
      const daw = coreGetRuntimeDAW();
      if (!daw.audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        daw.audioCtx = new Ctx(); daw.masterGain = daw.audioCtx.createGain();
        daw.masterGain.gain.value = 1; daw.masterGain.connect(daw.audioCtx.destination);
      }
      if (daw.audioCtx.state === 'suspended') daw.audioCtx.resume().catch(() => {});
      if (audioContextServiceBridge?.setContext) {
        audioContextServiceBridge.setContext(daw.audioCtx);
      }
      return daw.audioCtx;
    }

    const editorTransportRuntimeService =
      globalScope.EditorTransportRuntimeService.create({
        getDAW: () => coreGetRuntimeDAW(),
        getMeterConfig: getTimeSignatureGridConfig,
        getLoop: () => {
          const daw = coreGetRuntimeDAW();
          return {
            enabled: Boolean(daw.loopEnabled),
            start: daw.loopA,
            end: daw.loopB
          };
        },
        contextProvider: () => {
          try {
            return coreGetRuntimeDAW()?.audioCtx || null;
          } catch (_) {
            return null;
          }
        },
        playheadMath: PlayheadMath,
        getNow: () => performance.now(),
        scheduleAheadTime: 1.5,
        logger: console
      });
    const setTransportOrigin = (...args) =>
      editorTransportRuntimeService.setOrigin(...args);
    const getTransportClockSnapshot = (...args) =>
      editorTransportRuntimeService.getClockSnapshot(...args);
    const getTransportPlayhead = (...args) =>
      editorTransportRuntimeService.getPlayhead(...args);
    const getTransportVisualPlayhead = (...args) =>
      editorTransportRuntimeService.getVisualPlayhead(...args);
    transportSchedulingService = editorTransportRuntimeService.schedulingService;
    audioContextServiceBridge = editorTransportRuntimeService.audioContextService;
    countInSchedulerBridge = editorTransportRuntimeService.countInScheduler;

    const playbackTimelineController =
      globalScope.PlaybackTimelineController?.create({
        getDAW: () => coreGetRuntimeDAW(),
        ensureAudioCtx,
        stopAllVoices,
        getTransportClockSnapshot,
        getNode: id => $(id),
        timeToX: t => t * coreGetRuntimeDAW().pxPerSecond,
        formatTime,
        onPlayheadTime: displayTime => {
          try {
            coreTimelineRuntime?.syncTimingControlsAt?.(displayTime);
          } catch (_) {}
          try { window.__midiScorePlayhead?.(displayTime); } catch (_) {}
        }
      });
    const scheduleAllFromPlayhead = (...args) =>
      playbackTimelineController?.scheduleAllFromPlayhead?.(...args);
    const getDisplayPlayheadTime = (...args) =>
      playbackTimelineController?.getDisplayPlayheadTime?.(...args) || 0;
    const updatePlayheadUI = (...args) =>
      playbackTimelineController?.updatePlayheadUI?.(...args);
    const syncTimelineViewportToPlayhead = (...args) =>
      playbackTimelineController?.syncTimelineViewportToPlayhead?.(...args);

// ==========================================
// ProjectAudioService Bridge
// مالکیت state و AudioContext با runtimeهای فعال DAW است.
// ==========================================
const projectAudioServiceBridge =
  typeof window.ProjectAudioService === 'function'
    ? new window.ProjectAudioService({
        state: DAW,

        isElectron: Boolean(
          typeof isElectron !== 'undefined' &&
          isElectron
        ),

        getElectronAPI: () =>
          typeof window !== 'undefined'
            ? window.electronAPI || null
            : null,

        ensureAudioCtx,

        renderTimeline: () => {
          if (typeof renderTimeline === 'function') {
            renderTimeline();
          }
        },

        getLoadingIndicator: () =>
          typeof document !== 'undefined'
            ? document.getElementById('loading-indicator')
            : null,

        repairSong: (song) =>
          window.TextEncodingService?.repairSong?.(song) || song,

        logger: console
      })
    : null;

function requireProjectAudioService() {
  if (!projectAudioServiceBridge) {
    throw new Error(
      'ProjectAudioService در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.'
    );
  }

  return projectAudioServiceBridge;
}

// ==========================================
// ProjectAudioService thin wrappers
// انتشار فرمان‌های عمومی موردنیاز rendererهای فعلی.
// ==========================================

async function loadAudioFromHardDrive(filePath) {
  return requireProjectAudioService().loadAudioFromHardDrive(filePath);
}

function pathDirname(filePath) {
  return requireProjectAudioService().pathDirname(filePath);
}

function pathJoin(dir, relativePath) {
  return requireProjectAudioService().pathJoin(dir, relativePath);
}

async function handleAudioImport(file, copyToProject = false) {
  return requireProjectAudioService()
    .handleAudioImport(file, copyToProject);
}

async function loadProject(projectData, projectFilePath = null) {
  return requireProjectAudioService()
    .loadProject(projectData, projectFilePath);
}

async function resolveClipAudio(clip, projectFilePath = null) {
  return requireProjectAudioService()
    .resolveClipAudio(clip, projectFilePath);
}

// انتشار فرمان‌های عمومی موردنیاز rendererهای فعلی.
corePublicApi.publish({
  loadAudioFromHardDrive,
  pathDirname,
  pathJoin,
  handleAudioImport,
  loadProject,
  resolveClipAudio
});

// ==========================================
// Editor Domain module accessors (Commit 1)
// ==========================================
function requireLyricsParser() {
  if (typeof window.LyricsParser !== 'object' || !window.LyricsParser) {
    throw new Error('LyricsParser در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.');
  }
  return window.LyricsParser;
}

function requireLyricPositionMapper() {
  if (typeof window.LyricPositionMapper !== 'object' || !window.LyricPositionMapper) {
    throw new Error('LyricPositionMapper در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.');
  }
  return window.LyricPositionMapper;
}

function requireEditorSongStateService() {
  if (
    typeof window.EditorSongStateService !== 'object' ||
    !window.EditorSongStateService
  ) {
    throw new Error(
      'EditorSongStateService در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.'
    );
  }
  if (!window.__editorSongStateServiceBridge) {
    window.__editorSongStateServiceBridge =
      window.EditorSongStateService.create({
        getSong: () => window.EditorRuntimeAdapter?.getSong?.() || null
      });
  }
  return window.__editorSongStateServiceBridge;
}

function requireEditorSongRuntimeService() {
  if (
    typeof window.EditorSongRuntimeService !== 'object' ||
    !window.EditorSongRuntimeService
  ) {
    throw new Error(
      'EditorSongRuntimeService در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.'
    );
  }
  if (!window.__editorSongRuntimeServiceBridge) {
    window.__editorSongRuntimeServiceBridge =
      window.EditorSongRuntimeService.create({
        runtimeAdapter: window.EditorRuntimeAdapter
      });
  }
  return window.__editorSongRuntimeServiceBridge;
}

const coreHistoryBridgeRuntime =
  globalScope.CoreHistoryBridgeService?.create?.({
    isAttached: () => Boolean(window.__historyAttached),
    setAttached: value => {
      window.__historyAttached = value;
    },
    getHistoryService: () => requireHistoryService(),
    getDAW: () => coreGetRuntimeDAW(),
    getPERF: () => coreGetRuntimePERF(),
    getSongState: () => requireEditorSongStateService(),
    setSong: (...args) => coreEditorRuntime.setSong(...args),
    repairSong: song => window.TextEncodingService?.repairSong?.(song) || song,
    getSeqPoints: () => edSeqPoints,
    setSeqPoints: value => {
      edSeqPoints = value;
    },
    clearEditorTimers: () => {
      clearTimeout(edCommitTimer);
      clearTimeout(edInputRenderTimer);
      clearTimeout(edSaveTimer);
    },
    saveSong: (...args) => edSaveSong(...args),
    syncToolbar: (...args) => edSyncToolbar(...args),
    renderEditor: (...args) => edRenderEditor(...args),
    updateNextIdFromClips: (...args) => updateNextIdFromClips(...args),
    ensureAudioCtx: (...args) => ensureAudioCtx(...args),
    updateTrackMix: (...args) => updateTrackMix(...args),
    peaksFromBuffer: (...args) => peaksFromBuffer(...args),
    refreshClipWaveImage: (...args) => refreshClipWaveImage(...args),
    renderAll: (...args) => renderAll(...args),
    scheduleAllFromPlayhead: (...args) =>
      scheduleAllFromPlayhead(...args),
    flushPendingCommit: (...args) => edFlushPendingCommit(...args),
    getCommitTimer: () => edCommitTimer,
    toast: (...args) => toast(...args),
    translate: (...args) => t(...args),
    logger: console
  });
if (!coreHistoryBridgeRuntime) {
  throw new Error(
    'CoreHistoryBridgeService باید قبل از app/core.js بارگذاری شود.'
  );
}

function attachHistoryService(...args) {
  return coreHistoryBridgeRuntime.attach(...args);
}

function getHistoryService() {
  return requireHistoryService();
}

function resetHistory() {
  return getHistoryService().reset();
}

function activateHistory() {
  return getHistoryService().activate();
}

function deactivateHistory() {
  return getHistoryService().deactivate();
}

function historyLength() {
  return getHistoryService().getHistoryLength();
}

function isHistoryApplying() {
  return getHistoryService().isApplying();
}

function formatTimelineTimeSignature(value, context = {}) {
  const preset =
    context?.timeSignaturePreset ||
    context?.baseTimeSignaturePreset ||
    '';
  if (
    String(value || '') === '2/4' &&
    preset === '2/4-feel-6/8'
  ) {
    return '2/4 (حس 6/8)';
  }
  return String(value || '4/4');
}

function setTimelineSongBaseTiming(baseTiming = {}) {
  const songState = requireEditorSongStateService();
  const song = songState?.currentSong?.();
  if (!song) return false;

  const tempo = Number(baseTiming.tempo);
  if (Number.isFinite(tempo) && tempo > 0) {
    songState.setTempo?.(tempo);
  }

  const timeSignature = baseTiming.timeSignature;
  if (timeSignature) {
    const preset =
      baseTiming.timeSignaturePreset ||
      baseTiming.baseTimeSignaturePreset ||
      '';
    const displayValue =
      preset === '2/4-feel-6/8'
        ? '2/4 (حس 6/8)'
        : timeSignature;
    if (typeof window.SongMetadata?.setTimeSignature === 'function') {
      window.SongMetadata.setTimeSignature(song, displayValue);
    } else {
      song.timeSignature = timeSignature;
      if (preset) song.timeSignaturePreset = preset;
      else delete song.timeSignaturePreset;
    }
  }
  return true;
}

    coreTimelineRuntime =
      globalScope.CoreTimelineRuntimeService?.create?.({
        documentRef: document,
        windowRef: window,
        getDAW: () => coreGetRuntimeDAW(),
        getSongState: () => requireEditorSongStateService(),
        getTimingContext: () =>
          requireEditorSongStateService().getTimingContext(),
        tempoMap: globalScope.TempoMap,
        getTimelineInner: () => document.getElementById('tl-inner'),
        clamp: (value, minimum, maximum) => clamp(value, minimum, maximum),
        meter: globalScope.Meter,
        syncTimelineViewportToPlayhead: (...args) =>
          syncTimelineViewportToPlayhead(...args),
        ensureAudioCtx: () => ensureAudioCtx(),
        setAudioContext: ctx => {
          if (!coreGetRuntimeDAW().audioCtx) {
            coreGetRuntimeDAW().audioCtx = ctx;
          }
        },
        getWaveCache: () => coreGetRuntimeDAW().waveCache,
        timelineGrid: globalScope.TimelineGrid,
        getElement: id => $(id),
        getTimeSignatureGridConfig: (...args) =>
          getTimeSignatureGridConfig(...args),
        getActiveQuantizeGridStep: (...args) =>
          getActiveQuantizeGridStep(...args),
        snapTime: (...args) => snapTime(...args),
        getTransportState: () => editorTransportState,
        updatePlayheadUI: (...args) => updatePlayheadUI(...args),
        startMetronome: (...args) => startMetronome(...args),
        resyncPlayingTransport: (...args) =>
          resyncPlayingTransport(...args),
        getTransportPlayhead: (...args) =>
          getTransportPlayhead(...args),
        setTempoMap: map =>
          requireEditorSongStateService().setTempoMap(map),
        setSongBaseTiming: baseTiming =>
          setTimelineSongBaseTiming(baseTiming),
        saveSong: () => edSaveSong(),
        formatTime: value => formatTime(value),
        formatTimeSignature: (value, context) =>
          formatTimelineTimeSignature(value, context),
        isPerforming: () => coreGetPerformanceState()?.active || false,
        getIsRecordingChords: () => isRecordingChords,
        setIsRecordingChords: value => {
          isRecordingChords = value;
        },
        getIconRegistry: () => globalScope.IconRegistry,
        uid: prefix => uid(prefix),
        roundMs: value => roundMs(value),
        saveState: (...args) => saveState(...args),
        renderAll: (...args) => renderAll(...args),
        scheduleAllFromPlayhead: (...args) =>
          scheduleAllFromPlayhead(...args),
        ensureTimelineFits: (...args) =>
          ensureTimelineFits(...args),
        refreshPopupTimeline: () =>
          globalScope.safeMirrorTimeline?.(),
        toast: message => toast(message),
        translate: key => globalScope.t?.(key) ?? key,
        customPrompt,
        getClipFilePath: (...args) =>
          globalScope.AkordyarEditorApi?.getClipFilePath?.(...args) || '',
        openChordEditor: (...args) =>
          globalScope.AkordyarEditorApi?.openChordEditor?.(...args),
        openChordLineImporter: (...args) =>
          corePublicApi.get('openChordLineImporter')?.(...args),
        editorAction: (name, ...args) =>
          globalScope.AkordyarEditorApi?.[name]?.(...args),
        coreAction: (name, ...args) =>
          corePublicApi.get(name)?.(...args),
        startPointerDrag: (...args) =>
          coreStartPointerDrag(...args),
        getClipInteractionRuntime: () => coreClipInteractionRuntime
      });
    if (!coreTimelineRuntime) {
      throw new Error(
        'CoreTimelineRuntimeService باید قبل از app/core.js بارگذاری شود.'
      );
    }

    const {
      waveformBridge,
      timeToX,
      xToTime,
      timeToBarBeat,
      barBeatToTime,
      getProjectEnd,
      ensureTimelineFits,
      clientToTime,
      clientToInnerPoint,
      autoScrollToPlayhead,
      getClip,
      selectedClips,
      splitClipAt,
      splitSelectedAtPlayhead,
      openTimelineChordEditor,
      getIconSvg,
      openIconPicker,
      addNewTrack,
      getTimelineTrackRendererService,
      updateTrackSelectionUI,
      selectTrack,
      renderTracks,
      drawLaneGrid,
      renderRuler,
      handleTimingChange,
      renderTempoMarkers,
      removeTempoMarker,
      getTimingContextAtPlayhead,
      syncTimingControlsAt,
      getTimelineSectionRendererService,
      renderClips: renderTimelineClips,
      refreshClipGeometry,
      waveformService
    } = coreTimelineRuntime;

    corePublicApi.publish({
      timeToX,
      xToTime,
      timeToBarBeat,
      barBeatToTime,
      getProjectEnd,
      ensureTimelineFits,
      clientToTime,
      clientToInnerPoint,
      autoScrollToPlayhead,
      getClip,
      selectedClips,
      splitClipAt,
      splitSelectedAtPlayhead,
      openTimelineChordEditor,
      getIconSvg,
      openIconPicker,
      addNewTrack,
      getTimelineTrackRendererService,
      updateTrackSelectionUI,
      selectTrack,
      renderTracks,
      drawLaneGrid,
      renderRuler,
      handleTimingChange,
      renderTempoMarkers,
      removeTempoMarker,
      getTimingContextAtPlayhead,
      syncTimingControlsAt,
      getTimelineSectionRendererService,
      refreshClipGeometry
    });

    function renderClips(options = {}) {
      return renderTimelineClips?.(options);
    }

function saveState() {
  return getHistoryService().saveState();
}

function applyState(stateStr) {
  return getHistoryService().applyState(stateStr);
}

    function edFlushPendingCommit() {
  if (!edCommitTimer) return;
  clearTimeout(edCommitTimer);
  edCommitTimer = null;
  edCommit();
}

    async function decodeFileToBuffer(file) {
      return waveformBridge.decodeFileToBuffer(file);
    }

    function peaksFromBuffer(buffer, buckets = 2000) {
      return waveformBridge.peaksFromBuffer(buffer, buckets);
    }

    function drawWaveToCanvas(peaks, w, h) {
      return waveformBridge.drawWaveToCanvas(peaks, w, h);
    }

    function refreshClipWaveImage(clip) {
      return waveformBridge.refreshClipWaveImage(clip);
    }

    const coreMixerRuntime =
      globalScope.CoreMixerBridgeService?.create?.({
        mixerFactory: () => globalScope.EditorMixerService?.create,
        getDAW: () => coreGetRuntimeDAW(),
        getElement: id => $(id),
        documentRef: document,
        windowRef: window,
        saveState: (...args) => saveState(...args),
        renderTracks: (...args) => renderTracks(...args),
        renderClips: (...args) => renderClips(...args),
        scheduleAllFromPlayhead: (...args) =>
          scheduleAllFromPlayhead(...args),
        startPointerDrag: (...args) =>
          coreStartPointerDrag(...args)
      });
    if (!coreMixerRuntime) throw new Error(
      'CoreMixerBridgeService باید قبل از app/core.js بارگذاری شود.'
    );
    const {
      getEditorMixerService,
      updateTrackMix,
      toggleMixer,
      renderMixer,
      initMixerDrag
    } = coreMixerRuntime;
    corePublicApi.publish(coreMixerRuntime);

    function stopAllVoices() {
      for (const [id, v] of coreGetRuntimeDAW().voices) { try { v.source.onended = null; v.source.stop(0); } catch (_) {} try { v.source.disconnect(); } catch (_) {} try { v.gain.disconnect(); } catch (_) {} }
      coreGetRuntimeDAW().voices.clear();
    }

    function renderAll(options = {}) {
      renderTracks(); renderRuler(); renderClips(options); renderLoopRegion(); renderArrangerMarkers(); updatePlayheadUI(); updateHud();
      edRenderClMarkers();
    }

    function setTimelineGeometryWidth(width) {
      const safeWidth = `${Math.max(1, Math.ceil(Number(width) || 0))}px`;
      ['tl-inner', 'lanes-container', 'timeline-ruler'].forEach(id => {
        const element = $(id);
        if (element) element.style.width = safeWidth;
      });
    }

    function clearTimelineZoomPreview() {
      const rulerCanvas = $('timeline-ruler')?.querySelector?.('canvas');
      const rulerLabels = $('ruler-labels');
      [rulerCanvas, rulerLabels].forEach(element => {
        if (!element?.style) return;
        element.style.transform = '';
        element.style.transformOrigin = '';
        element.style.willChange = '';
      });
      document.querySelectorAll('.lane-grid').forEach(canvas => {
        canvas.style.transform = '';
        canvas.style.transformOrigin = '';
        canvas.style.willChange = '';
      });
    }

    function refreshTimelineZoomPreview(previewBasePps) {
      const daw = coreGetRuntimeDAW();
      const currentPps = Number(daw.pxPerSecond) || 70;
      const basePps = Number(previewBasePps) || currentPps;
      const ratio = Math.max(0.01, currentPps / basePps);
      const width = Math.max(
        1,
        Math.ceil(Number(timeToX(getProjectEnd())) || 0)
      );
      setTimelineGeometryWidth(width);

      const applyPreviewTransform = element => {
        if (!element?.style) return;
        element.style.transformOrigin = 'left top';
        element.style.transform = `scaleX(${ratio})`;
        element.style.willChange = 'transform';
      };

      applyPreviewTransform($('ruler-labels'));
      applyPreviewTransform($('timeline-ruler')?.querySelector?.('canvas'));
      document.querySelectorAll('.lane-grid').forEach(applyPreviewTransform);
    }

    function refreshTimelineGeometry(options = {}) {
      const detail = options.detail !== false;
      if (detail) {
        clearTimelineZoomPreview();
        renderRuler({ detail: true });
        document.querySelectorAll('.lane-grid').forEach(canvas => {
          drawLaneGrid(canvas, { detail: true });
        });
        clearTimelineZoomPreview();
      } else {
        refreshTimelineZoomPreview(options.previewBasePps);
      }
      refreshClipGeometry?.();
      renderLoopRegion();
      renderArrangerMarkers();
      updatePlayheadUI();
    }

    corePublicApi.publish({ refreshTimelineGeometry });

    function updateHud() { $('clip-count').textContent = String(coreGetRuntimeDAW().clips.length + (coreGetRuntimeDAW().sections || []).length); }

    const coreAudioBlobSaveSchedulerRuntime =
      globalScope.CoreAudioBlobSaveSchedulerService?.create?.({
        getSongId: () => requireEditorSongStateService().currentSong()?.id,
        saveAudioBlobsForProject: (...args) =>
          coreSaveAudioBlobsForProject(...args),
        schedule: (...args) => setTimeout(...args),
        cancel: timer => clearTimeout(timer),
        logger: console
      });
    if (!coreAudioBlobSaveSchedulerRuntime) {
      throw new Error(
        'CoreAudioBlobSaveSchedulerService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const { scheduleAudioBlobSave } = coreAudioBlobSaveSchedulerRuntime;
    corePublicApi.publish({ scheduleAudioBlobSave });

    const coreSelectionRuntime =
      globalScope.CoreSelectionService?.create?.({
        documentRef: document,
        getDAW: () => coreGetRuntimeDAW(),
        renderClips,
        updateHud
      });
    if (!coreSelectionRuntime) throw new Error(
      'CoreSelectionService باید قبل از app/core.js بارگذاری شود.'
    );
    corePublicApi.publish(coreSelectionRuntime);

    const coreAudioImportRuntime =
      globalScope.CoreAudioImportService?.create?.({
        getDAW: () => coreGetRuntimeDAW(),
        getFileInput: () => $('audio-file-input'),
        renderTracks: (...args) => renderTracks(...args),
        clearSelection: (...args) =>
          coreSelectionRuntime.clearSelection(...args),
        ensureAudioCtx: (...args) => ensureAudioCtx(...args),
        decodeFileToBuffer: (...args) => decodeFileToBuffer(...args),
        askAudioCopyMode: (...args) => askAudioCopyMode(...args),
        uid: prefix => uid(prefix),
        roundMs: value => roundMs(value),
        colors: COLORS,
        peaksFromBuffer: (...args) => peaksFromBuffer(...args),
        refreshClipWaveImage: clip => refreshClipWaveImage(clip),
        ensureTimelineFits: value => ensureTimelineFits(value),
         saveAudioBlobToDB: (...args) => coreSaveAudioBlobToDB(...args),
         saveAudioBlobsForProject: (...args) =>
           coreSaveAudioBlobsForProject(...args),
        saveState: (...args) => saveState(...args),
        renderAll: (...args) => renderAll(...args),
        scheduleAllFromPlayhead: (...args) =>
          scheduleAllFromPlayhead(...args),
        getSong: () => requireEditorSongStateService().currentSong(),
        saveSong: (...args) => edSaveSong(...args),
        toast: message => toast(message),
        translate: key => globalScope.t?.(key) ?? key,
        isElectron,
        getElectronAPI: () => window.electronAPI || null,
        logger: console
      });
    if (!coreAudioImportRuntime) throw new Error(
      'CoreAudioImportService باید قبل از app/core.js بارگذاری شود.'
    );
    const {
      openFileForTrack,
      importFileForTrack,
      bindFileInput
    } = coreAudioImportRuntime;
    corePublicApi.publish({ openFileForTrack, importFileForTrack });
    bindFileInput();

   function clearEditorTextSelection() {
     window.getSelection()?.removeAllRanges();
     $('editor')?.blur();
}

    const coreClipboardRuntime =
      globalScope.CoreClipboardBridgeService?.create?.({
        clipboardFactory: () => globalScope.ClipboardService,
        getEdSaveSong: () =>
          globalScope.AkordyarEditorApi?.saveSong || null,
        getDAW: () => coreGetRuntimeDAW(),
        selectedClips: () => selectedClips(),
        uid,
        roundMs,
        peaksFromBuffer,
        refreshClipWaveImage,
        ensureTimelineFits,
        saveState,
        renderAll,
        scheduleAllFromPlayhead,
        stopAllVoices,
        toast,
        translate: t
      });
    if (!coreClipboardRuntime) throw new Error(
      'CoreClipboardBridgeService باید قبل از app/core.js بارگذاری شود.'
    );
    corePublicApi.publish(coreClipboardRuntime);

    const coreClipEditRuntime =
      globalScope.CoreClipEditService?.create?.({
        getDAW: () => coreGetRuntimeDAW(),
        roundMs: value => roundMs(value),
        splitClipAt: (...args) => splitClipAt(...args),
        seekTransport: (...args) => seekTransport(...args),
        saveState: (...args) => saveState(...args),
        renderAll: (...args) => renderAll(...args),
        scheduleAllFromPlayhead: (...args) =>
          scheduleAllFromPlayhead(...args),
        toast: message => toast(message),
        translate: key => globalScope.t?.(key) ?? key
      });
    if (!coreClipEditRuntime) throw new Error(
      'CoreClipEditService باید قبل از app/core.js بارگذاری شود.'
    );
    const { cutAtTime } = coreClipEditRuntime;
    corePublicApi.publish({ cutAtTime });

    coreClipInteractionRuntime =
      globalScope.CoreClipInteractionService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        getDAW: () => coreGetRuntimeDAW(),
        getClip: clipId => getClip(clipId),
        selectedClips: () => selectedClips(),
        clearEditorTextSelection: () => clearEditorTextSelection(),
        clearChordSelection: (...args) =>
          globalScope.AkordyarEditorApi?.clearChordSelection?.(...args),
        selectionService: coreSelectionRuntime,
        renderClips: (...args) => renderClips(...args),
        renderAll: (...args) => renderAll(...args),
        renderRuler: (...args) => renderRuler(...args),
        updateHud: (...args) => updateHud(...args),
        clientToTime: (...args) => clientToTime(...args),
        clientToInnerPoint: (...args) => clientToInnerPoint(...args),
        xToTime: (...args) => xToTime(...args),
        snapTime: (...args) => snapTime(...args),
        roundMs: (...args) => roundMs(...args),
        clamp: (...args) => clamp(...args),
        ensureTimelineFits: (...args) => ensureTimelineFits(...args),
        refreshClipWaveImage: (...args) =>
          refreshClipWaveImage(...args),
        peaksFromBuffer: (...args) => peaksFromBuffer(...args),
        cutAtTime: (...args) => cutAtTime(...args),
        openTimelineChordEditor: (...args) =>
          openTimelineChordEditor(...args),
        startPointerDrag: (...args) =>
          coreStartPointerDrag(...args),
        saveState: (...args) => saveState(...args),
        scheduleAllFromPlayhead: (...args) =>
          scheduleAllFromPlayhead(...args),
        toast: (...args) => toast(...args),
        uid: prefix => uid(prefix)
      });
    if (!coreClipInteractionRuntime) throw new Error(
      'CoreClipInteractionService باید قبل از app/core.js بارگذاری شود.'
    );
    let {
      getMarqueeLaneElements,
      onClipMouseDown,
      onDocMouseMove,
      onDocMouseUp
    } = coreClipInteractionRuntime;
    corePublicApi.publish(coreClipInteractionRuntime);

    let recordingRuntime = null;

    const coreRecordingRuntime =
      globalScope.CoreRecordingService?.create?.({
        getDAW: () => coreGetRuntimeDAW(),
        documentRef: document,
        getNavigator: () => globalScope.navigator,
        getMediaRecorder: () => globalScope.MediaRecorder,
        getBlob: () => globalScope.Blob,
        requestAnimationFrameRef: (...args) =>
          globalScope.requestAnimationFrame?.(...args),
        cancelAnimationFrameRef: (...args) =>
          globalScope.cancelAnimationFrame?.(...args),
        ensureAudioCtx: (...args) => ensureAudioCtx(...args),
        updateTrackMix: (...args) => updateTrackMix(...args),
        renderAll: (...args) => renderAll(...args),
        startTransport: (...args) => startTransport(...args),
        pauseTransport: (...args) => pauseTransport(...args),
        timeToX: value => timeToX(value),
         decodeFileToBuffer: (...args) => decodeFileToBuffer(...args),
         peaksFromBuffer: (...args) => peaksFromBuffer(...args),
         refreshClipWaveImage: (...args) =>
           refreshClipWaveImage(...args),
         ensureTimelineFits: (...args) => ensureTimelineFits(...args),
         saveState: (...args) => saveState(...args),
         saveAudioBlobToDB: (...args) =>
           coreSaveAudioBlobToDB(...args),
        uid: prefix => uid(prefix),
        roundMs: value => roundMs(value),
        formatTime: value => formatTime(value),
        toast: message => toast(message),
        logger: console
      });
    if (!coreRecordingRuntime) {
      throw new Error(
        'CoreRecordingService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    recordingRuntime = coreRecordingRuntime;
    corePublicApi.publish(coreRecordingRuntime);

    /* ============================================================
       SETTINGS (theme, audio device, toggles) + movable windows
       ============================================================ */
    const coreSettingsRuntime =
      globalScope.CoreSettingsService?.create?.({
        settingsKey: 'ed_app_settings',
        documentRef: document,
        storage: globalScope.localStorage,
        getElement: id => $(id),
        getNavigator: () => globalScope.navigator,
        getDAW: () => coreGetRuntimeDAW(),
        getTransportState: () => editorTransportState,
        ensureAudioCtx: (...args) => ensureAudioCtx(...args),
        getAudioContextService: () => audioContextServiceBridge,
        toggleMetronome: (...args) => toggleMetronome(...args),
        stopMetronome: (...args) => stopMetronome(...args),
        startMetronome: (...args) => startMetronome(...args),
        updateReturnToStartButton: (...args) =>
          updateReturnToStartButton(...args),
        getSizeLocked: () =>
          typeof _sizeLocked !== 'undefined' ? _sizeLocked : false,
        toggleSizeLock: (...args) =>
          typeof toggleSizeLock === 'function'
            ? toggleSizeLock(...args)
            : undefined,
        toast: message => toast(message),
        logger: console
      });
    if (!coreSettingsRuntime) {
      throw new Error(
        'CoreSettingsService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    settingsRuntime = coreSettingsRuntime;
    corePublicApi.publish(coreSettingsRuntime);
    coreSettingsRuntime.initialize();
    const coreChordLineSyncRuntime =
      globalScope.CoreChordLineSyncService?.create?.({
        getSongState: () => requireEditorSongStateService(),
        getDAW: () => coreGetRuntimeDAW(),
        getChordLineSyncService: () => globalScope.ChordLineSyncService,
        isPopupOpen: popup => isPopupOpen(popup),
        getChordLinePopup: () =>
          corePopupRuntime?.getChordLinePopup?.() || null,
        syncChordLinePopup: (...args) =>
          corePopupRuntime?.syncChordLinePopup?.(...args),
        saveState: () => saveState(),
        renderAll: () => renderAll(),
        toast: message => toast(message),
        saveSong: () => edSaveSong(),
        saveCurrentVersion: () =>
          globalScope.AkordyarEditorApi?.saveCurrentVersion?.(),
        scheduleAllFromPlayhead: () => scheduleAllFromPlayhead(),
        ensureTimelineFits: (...args) => ensureTimelineFits(...args),
        uid: prefix => uid(prefix),
        roundMs: value => roundMs(value),
        colors: COLORS,
        getFileInput: () => $('chord-line-file-input'),
        parser: globalScope.MidiFileParser,
        chordService: globalScope.EditorMidiChordService?.create?.(),
        navigatorRef: globalScope.navigator,
        logger: console
      });
    if (!coreChordLineSyncRuntime) {
      throw new Error(
        'CoreChordLineSyncService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      syncChordLineFromLyrics,
      bindChordLineFileInput
    } = coreChordLineSyncRuntime;
    corePublicApi.publish(coreChordLineSyncRuntime);
    bindChordLineFileInput();
    const coreMovableWindowRuntime =
      globalScope.CoreMovableWindowBridgeService?.create?.({
        documentRef: document,
        windowRef: window,
        startPointerDrag: (...args) =>
          coreStartPointerDrag(...args)
      });
    if (!coreMovableWindowRuntime) {
      throw new Error(
        'CoreMovableWindowBridgeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    corePublicApi.publish(coreMovableWindowRuntime);
    coreMovableWindowRuntime.initMovableWindows();

    // Playhead mode toggle
    function togglePlayheadMode() {
      coreGetRuntimeDAW().playheadMode = coreGetRuntimeDAW().playheadMode === 'page' ? 'center' : 'page';
      const btn = $('playheadModeBtn');
      if (btn) btn.classList.toggle('ph-center', coreGetRuntimeDAW().playheadMode === 'center');
      toast(coreGetRuntimeDAW().playheadMode === 'center' ? 'پلی‌هدر ثابت در مرکز' : 'اسکرول صفحه‌ای');
    }

    const corePopupWindowRuntime =
      globalScope.CorePopupWindowBridgeService?.create?.({
        windowRef: window,
        windowBridge: globalScope.WindowBridge
      });
    if (!corePopupWindowRuntime) {
      throw new Error(
        'CorePopupWindowBridgeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      windowBridge: popupWindowBridge,
      isPopupOpen,
      popupDocument,
      openPopupWindow,
      focusPopupWindow
    } = corePopupWindowRuntime;
    corePublicApi.publish({
      isPopupOpen,
      popupDocument,
      openPopupWindow,
      focusPopupWindow
    });

    const coreHighlightRuntime =
      globalScope.CoreHighlightService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        getSongState: () => requireEditorSongStateService(),
        getPopup: () => corePopupRuntime?.getLyricPopup?.() || null,
        isPopupOpen: popup => isPopupOpen(popup),
        popupDocument: popup => popupDocument(popup),
        saveSong: () => {
          if (typeof edSaveSong === 'function') edSaveSong();
        }
      });
    if (!coreHighlightRuntime) {
      throw new Error(
        'CoreHighlightService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    corePublicApi.publish(coreHighlightRuntime);

    /* ===== LOOP A-B ===== */
    const coreLoopVisualRuntime =
      globalScope.CoreLoopVisualService?.create?.({
        getDAW: () => coreGetRuntimeDAW(),
        getElement: id => $(id),
        documentRef: document,
        timeToX: value => timeToX(value),
        xToTime: value => xToTime(value),
        clamp: (value, min, max) => clamp(value, min, max),
        getProjectEnd: () => getProjectEnd(),
        isSnapEnabled: () => editorTransportState.snapEnabled === true,
        snapTime: (...args) => snapTime(...args),
        startPointerDrag: (...args) =>
          coreStartPointerDrag(...args),
        saveState: (...args) => saveState(...args)
      });
    if (!coreLoopVisualRuntime) {
      throw new Error(
        'CoreLoopVisualService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const { renderLoopRegion } = coreLoopVisualRuntime;
    corePublicApi.publish(coreLoopVisualRuntime);
    coreLoopVisualRuntime.bindLoopDrag();

    const coreLoopControlRuntime =
      globalScope.CoreLoopControlService?.create?.({
        getDAW: () => coreGetRuntimeDAW(),
        getElement: id => $(id),
        isPerforming: () => coreGetPerformanceState()?.active || false,
        getSelectedClips: () => selectedClips(),
        setSelectionEnd: value => {
          selectionEnd = value;
        },
        renderLoopRegion: () => renderLoopRegion(),
        updatePlayheadUI: () => updatePlayheadUI(),
        startTransport: () => startTransport(),
        stopAllVoices: () => stopAllVoices(),
        cancelAnimationFrame: (...args) => cancelAnimationFrame(...args),
        isSnapEnabled: () => editorTransportState.snapEnabled === true,
        snapTime: (...args) => snapTime(...args),
        toast: message => toast(message),
        formatTime: value => formatTime(value)
      });
    if (!coreLoopControlRuntime) {
      throw new Error(
        'CoreLoopControlService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      toggleLoop,
      setLoopA,
      setLoopB,
      clearLoop,
      setLoopFromSelection,
      setLoopFromSelectionAndPlay
    } = coreLoopControlRuntime;
    corePublicApi.publish(coreLoopControlRuntime);

    const coreArrangerMarkerRuntime =
      globalScope.CoreArrangerMarkerBridgeService?.create?.({
        getDAW: () => coreGetRuntimeDAW(),
        markerService: globalScope.ArrangerMarkerService,
        getProjectEnd: () => getProjectEnd(),
        timeToX: value => timeToX(value),
        xToTime: value => xToTime(value),
        clamp: (value, min, max) => clamp(value, min, max),
        getElement: id => $(id),
        documentRef: document,
        isPerforming: () => coreGetPerformanceState()?.active || false,
        isSnapEnabled: () => editorTransportState.snapEnabled === true,
        snapTime: (...args) => snapTime(...args),
        startPointerDrag: (...args) =>
          coreStartPointerDrag(...args),
        saveState: () => saveState(),
        saveSong: () => {
          if (typeof edSaveSong === 'function') edSaveSong();
        },
        toast: message => toast(message),
        formatTime: value => formatTime(value)
      });
    if (!coreArrangerMarkerRuntime) {
      throw new Error(
        'CoreArrangerMarkerBridgeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      getArrangerMarkers,
      persistArrangerMarkers,
      setArrangerA,
      setArrangerB,
      clearArrangerMarkers,
      toggleArrangerMarkers,
      renderArrangerMarkers
    } = coreArrangerMarkerRuntime;
    corePublicApi.publish(coreArrangerMarkerRuntime);

    /* ===== POPUP WINDOW FULLSCREEN ===== */
    corePopupRuntime =
      globalScope.CorePopupRuntimeService?.create?.({
        state: {},
        window: {
          documentRef: document,
          windowRef: window,
          navigatorRef: window.navigator,
          nodeFilter: window.NodeFilter,
          popupWindowBridge,
          isPopupOpen: popup => isPopupOpen(popup),
          popupDocument: popup => popupDocument(popup),
          openPopupWindow: (...args) => openPopupWindow(...args),
          focusPopupWindow: popup => focusPopupWindow(popup),
          EventCtor: window.Event,
          schedule: (...args) => setTimeout(...args),
          safeMirrorTimeline: (...args) =>
            globalScope.safeMirrorTimeline?.(...args)
        },
        actions: {
          getSongState: () => requireEditorSongStateService(),
          getDAW: () => coreGetRuntimeDAW(),
          getTransportPlayhead: () => getTransportPlayhead(),
          getTransportVisualPlayhead: () => getTransportVisualPlayhead(),
          getSyncTimes: () => requireEditorSongStateService().getSyncTimes(),
          transposeChord: (...args) => edTransposeChord(...args),
          renderChords: () => edRenderChords(),
          toast: message => toast(message),
          translate: key => t(key),
          getCurrentLang: () => currentLang,
          applyHighlightClassToPopup: (...args) =>
            coreHighlightRuntime.applyHighlightClassToPopup?.(...args)
        },
        services: {
          focusMode: globalScope.CoreFocusModeService,
          lyricOnlyPopup: globalScope.CoreLyricOnlyPopupService,
          chordLinePopup: globalScope.CoreChordLinePopupService,
          playerViewSettings: globalScope.CorePlayerViewSettingsService,
          playerViewPopupSync: globalScope.CorePlayerViewPopupSyncService,
          playerViewPopupBuilder:
            globalScope.CorePlayerViewPopupBuilderService,
          playerViewPopup: globalScope.CorePlayerViewPopupService,
          chordRenderer: globalScope.CorePlayerViewChordRendererService
        }
      });
    if (!corePopupRuntime) {
      throw new Error(
        'CorePopupRuntimeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      getLyricPopup,
      getLyricOnlyPopup,
      getChordLinePopup,
      getFocusMode,
      openLyricPopup,
      syncLyricPopup,
      openLyricOnlyPopup,
      syncLyricOnlyPopup,
      openChordLinePopup,
      syncChordLinePopup,
      toggleFocusMode,
      getSettings,
      save,
      apply,
      setupWheelHandlers,
      syncHighlight,
      initialize,
      fontFamily,
      syncExistingPopup,
      render
    } = corePopupRuntime;
    corePublicApi.publish({
      getLyricPopup,
      getLyricOnlyPopup,
      getChordLinePopup,
      getFocusMode,
      openLyricPopup,
      syncLyricPopup,
      openLyricOnlyPopup,
      syncLyricOnlyPopup,
      openChordLinePopup,
      syncChordLinePopup,
      toggleFocusMode,
      getSettings,
      save,
      apply,
      setupWheelHandlers,
      syncHighlight,
      initialize,
      fontFamily,
      syncExistingPopup,
      render
    }, { exposeGlobals: false });

// ==========================================
// PART 3: Project Load & Audio Export (WAV)
// ==========================================
// منطق load/resolve صوت پروژه به js/core/ProjectAudioService.js منتقل شده است.

/**
 * تبدیل AudioBuffer به فرمت استاندارد WAV جهت ذخیره‌سازی
 */
function bufferToWave(abuffer, len) {
  return coreWavEncoderRuntime?.encode?.(abuffer, len);
}

  // ==========================================
// PART 4: Timeline Rendering & UI Event Listeners
// ==========================================

function renderTimeline() {
  return window.EditorLifecycleService?.renderTimeline?.({
    documentRef: document,
    getDAW: () => coreGetRuntimeDAW()
  });
}

// اتصال رویدادهای اولیه صفحه پس از بارگذاری DOM - بخش اول (خط ۳۶۲۳)
document.addEventListener('DOMContentLoaded', () => {
  setTimelinePanelHeight(getTimelinePanelHeight(), { persist: false });
  initDockableSidePanels();

  window.EditorLifecycleService?.bindAudioImport?.({
    documentRef: document,
    confirmRef: window.confirm,
    handleAudioImport,
    toast,
    logger: console
  });

  // ============================================
  // Menu Command Handlers (Electron)
  // ============================================
  if (
    isElectron &&
    window.electronAPI &&
    window.ElectronMenuCommandService?.create
  ) {
    window.ElectronMenuCommandService.create({
      electronApi: window.electronAPI,
      notify: toast,
      logger: console
    }).bind();
  }
});
    /* ===== SYNC / LINE GUIDE ===== */
    let syncCursor = 0,
    syncHistory = [],
    syncRedoHistory = [],
    syncWatch = null,
    syncActive = false;

let lastSyncActiveLi = -999;
let syncTapKeyHandler = null;

    /* ===== SYNC / LINE GUIDE — پل SyncModeController (Commit 2a) ===== */
    // state متعلق به runtime ادیتور است؛ کنترلر از طریق accessor می‌خواند/می‌نویسد.
    const syncModeState = {
      get active() { return syncActive; }, set active(v) { syncActive = v; },
      get cursor() { return syncCursor; }, set cursor(v) { syncCursor = v; },
      get history() { return syncHistory; }, set history(v) { syncHistory = v; },
      get redoHistory() { return syncRedoHistory; }, set redoHistory(v) { syncRedoHistory = v; },
      get watch() { return syncWatch; }, set watch(v) { syncWatch = v; },
      get tapKeyHandler() { return syncTapKeyHandler; }, set tapKeyHandler(v) { syncTapKeyHandler = v; },
      get lastActiveLi() { return lastSyncActiveLi; }, set lastActiveLi(v) { lastSyncActiveLi = v; }
    };

    // Commit 2b — accessor روی stateهای seq/CL (تعریف state در همین runtime می‌ماند؛
    // edSeq* در ادامهٔ فایل و edCl* کمی پایین‌تر تعریف می‌شوند — closureها فقط هنگام فراخوانی مقدار می‌خوانند)
    const seqClState = {
      get seqModeActive() { return edSeqModeActive; }, set seqModeActive(v) { edSeqModeActive = v; },
      get seqPoints() { return edSeqPoints; }, set seqPoints(v) { edSeqPoints = v; },
      get chordingActive() { return edSeqChordingActive; }, set chordingActive(v) { edSeqChordingActive = v; },
      get seqCursor() { return edSeqCursor; }, set seqCursor(v) { edSeqCursor = v; },
      get clMode() { return edClMode; }, set clMode(v) { edClMode = v; },
      get clTapActive() { return edClTapActive; }, set clTapActive(v) { edClTapActive = v; },
      get clMarkers() { return edClMarkers; }, set clMarkers(v) { edClMarkers = v; }
    };

    const coreSyncModeRuntime =
      globalScope.CoreSyncModeBridgeService?.create?.({
        controllerClass: globalScope.SyncModeController,
        state: syncModeState,
        seqState: seqClState,
        getDAW: () => coreGetRuntimeDAW(),
        songState: requireEditorSongStateService(),
        getElement: id => $(id),
        translate: key => t(key),
        toast: message => toast(message),
        saveSong: () => edSaveSong(),
        startTransport: () => startTransport(),
        pauseTransport: () => pauseTransport(),
        seekTransport: (time, keepPlaying) =>
          seekTransport(time, keepPlaying),
        getProjectEnd: () => getProjectEnd(),
        getLyricPopup: () => getLyricPopup(),
        getLyricOnlyPopup: () => getLyricOnlyPopup(),
        getChordLinePopup: () => getChordLinePopup(),
        renderChords: () => edRenderChords(),
        commit: () => edCommit(),
        saveState: () => saveState(),
        renderAll: () => renderAll(),
        uid: prefix => uid(prefix),
        roundMs: value => roundMs(value),
        ensureTimelineFits: value => ensureTimelineFits(value),
        timeToX: value => timeToX(value),
        formatTime: value => formatTime(value),
        openChordLinePopup: () => openChordLinePopup(),
        getPerformanceStore: () =>
          window.RuntimeStateAdapter?.getPerformanceStore?.() || null,
        applyHighlightClassToEditor: () =>
          coreHighlightRuntime.applyHighlightClassToEditor?.(),
        windowRef: window,
        windowBridge: popupWindowBridge,
        logger: console
      });
    if (!coreSyncModeRuntime) {
      throw new Error(
        'CoreSyncModeBridgeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      createSyncModeControllerBridge,
      requireSyncModeController,
      renderSyncLyrics,
      selectSyncLine,
      syncTap,
      updateSyncHighlight,
      syncTick,
      enterSyncMode,
      exitSyncMode,
      edToggleSeqMode,
      edStartSeqChording,
      edSeqNavigate,
      edUpdateClCount,
      edRenderClMarkers,
      edSetSeqMode,
      edToggleClTap,
      edClTap,
      edClUndoMarker,
      edClClearMarkers,
      edClApplyMarkers,
      initSyncUI
    } = coreSyncModeRuntime;
    corePublicApi.publish(coreSyncModeRuntime);

    const coreSequentialChordRemapRuntime =
      globalScope.CoreSequentialChordRemapService?.create?.({
        getSongState: () => requireEditorSongStateService(),
        getPositionMapper: () => requireLyricPositionMapper(),
        getSeqModeActive: () => edSeqModeActive,
        setRuntimeSeqPoints: value => {
          edSeqPoints = value;
        }
      });
    if (!coreSequentialChordRemapRuntime) {
      throw new Error(
        'CoreSequentialChordRemapService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const { remap: edRemapSeqPoints } =
      coreSequentialChordRemapRuntime;
    corePublicApi.publish({ edRemapSeqPoints });

    // Chord visibility toggle (editor only, independent of popup)
    if ($('edToggleChords')) $('edToggleChords').onclick = () => {
      edChordsVisible = !edChordsVisible;
      $('edToggleChords').classList.toggle('active', edChordsVisible);
      edRenderChords();
    };

    if ($('edSeqToggle')) $('edSeqToggle').onclick = edToggleSeqMode;
    if ($('edSeqStart')) $('edSeqStart').onclick = edStartSeqChording;
    if ($('edSeqPrev')) $('edSeqPrev').onclick = () => edSeqNavigate(-1);
    if ($('edSeqNext')) $('edSeqNext').onclick = () => edSeqNavigate(1);

    // ===== Sequential: حالت کورد لاین (نقطه‌گذاری با آهنگ روی تایم لاین) =====
    let edClMode = false, edClTapActive = false, edClMarkers = [];
    if ($('edSeqModeLyrics')) $('edSeqModeLyrics').onclick = () => edSetSeqMode('lyrics');
    if ($('edSeqModeChord')) $('edSeqModeChord').onclick = () => edSetSeqMode('chord');
    if ($('edClStart')) $('edClStart').onclick = edToggleClTap;
    if ($('edClUndo')) $('edClUndo').onclick = edClUndoMarker;
    if ($('edClClear')) $('edClClear').onclick = edClClearMarkers;
    if ($('edClApply')) $('edClApply').onclick = edClApplyMarkers;
    edUpdateClCount();

    // Editor click for seq mode point placement
    if ($('editor')) $('editor').addEventListener('click', (e) => {
      if (!edSeqModeActive) return;
      e.preventDefault();
      const sel = window.getSelection(); if (!sel.rangeCount) return;
      const rng = sel.getRangeAt(0);
      const lineEl = rng.startContainer.parentElement?.closest?.('.eline') || (rng.startContainer.classList?.contains('eline') ? rng.startContainer : null);
      if (!lineEl) return;
      const lineIndex = [...$('editor').children].indexOf(lineEl);
      const text = lineEl.textContent.replace(/\u200B/g,'');
      const off = Math.min(rng.startOffset, text.length);
      let anchorType = 'OnCharacter', charIndex = off;
      if (off === 0) anchorType = 'LineStart';
      else if (off >= text.length) anchorType = 'LineEnd';
      edSeqPoints.push({ anchorType, lineIndex, charIndex, name: '' });
      requireEditorSongStateService().setSeqPoints(edSeqPoints);
      edRenderChords(); edCommit();

    }, true);

    /* ===== ARRANGER ===== */
    coreArrangerRuntime =
      globalScope.CoreArrangerRuntimeService?.create?.({
        state: {
          storage: localStorage
        },
        actions: {
          getAllSongs: () => coreGetArchiveSongs(),
          setAllSongs: (...args) => coreSetArchiveSongs(...args),
          getCurrentSong: () => requireEditorSongStateService().currentSong(),
          saveCurrentSong: (...args) => coreSaveArchiveSong(...args),
          customPrompt: (...args) => customPrompt(...args),
          confirm: message => window.confirm(message),
          translate: key => t(key),
          toast: message => toast(message),
          startPointerDrag: (...args) => coreStartPointerDrag(...args)
        },
        ui: {
          documentRef: document,
          getElement: id => $(id)
        },
        timing: {
          now: () => Date.now(),
          isoNow: () => new Date().toISOString(),
          schedule: (...args) => setTimeout(...args),
          cancel: timer => clearTimeout(timer)
        },
        logger: console,
        windowRef: window
      });
    if (!coreArrangerRuntime) {
      throw new Error(
        'CoreArrangerRuntimeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
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
      arrSetCrossfade,
      arrTogglePauseBetween,
      arrAutoTranspose,
      arrClearNotes,
      arrFilterSongs,
      openArrSongNote,
      closeArrSongNote,
      saveArrSongNote,
      renderArrSetlist,
      renderArrPool,
      openArrangerModal,
      closeArrangerModal,
      createNewArranger,
      saveCurrentArranger,
      saveCurrentArrangerDebounced
    } = coreArrangerRuntime.publicApi;
    corePublicApi.publish(coreArrangerRuntime.publicApi);

    // ===== Performance Mode (Live Dashboard) =====
    corePerformanceController =
      globalScope.CorePerformanceControllerService?.create?.({
        actions: {
          getDAW: () => coreGetRuntimeDAW(),
          getEditingArr: () => getEditingArr(),
          getAllSongs: () => coreGetArchiveSongs(),
          getItemSetting: (...args) => getArrItemSetting(...args),
          getPerformanceMarkers: () => getArrangerMarkers(),
          getSongMarkers: song =>
            globalScope.ArrangerMarkerService?.fromSong?.(song),
          createPlaybackBoundary: config =>
            arrangerPlaybackPolicy?.createBoundary?.(config),
          preloadAudioForSong: (...args) => preloadAudioForSong(...args),
          peaksFromBuffer: (...args) => peaksFromBuffer(...args),
          restoreAudioForProjectSilently: (...args) =>
            restoreAudioForProjectSilently(...args),
          loadArrSong: (...args) => loadArrSong(...args),
          hotSwapToNextSong: (...args) => hotSwapToNextSong(...args),
          stopAllVoices: (...args) => stopAllVoices(...args),
          pauseTransport: (...args) => pauseTransport(...args),
          startTransport: (...args) => startTransport(...args),
          seekTransport: (...args) => seekTransport(...args),
          ensureAudioCtx: (...args) => ensureAudioCtx(...args),
          scheduleAllFromPlayhead: (...args) =>
            scheduleAllFromPlayhead(...args),
          saveArrangers: (...args) => saveArrangers(...args),
          getSongState: () => requireEditorSongStateService(),
          getTimingContext: () =>
            coreTimelineRuntime?.getTimingContextAtPlayhead?.() ||
            requireEditorSongStateService().getTimingContext(),
          saveSong: (...args) => edSaveSong(...args),
          handleTimingChange: (...args) => handleTimingChange(...args),
          getArrangerEnd: (...args) => getArrangerEnd(...args),
          getCurrentSong: () =>
            requireEditorSongStateService().currentSong(),
          ensureArrItem: (...args) => ensureArrItem(...args),
          closeArrangerModal: (...args) => closeArrangerModal(...args),
          openLyricOnlyPopup: (...args) => openLyricOnlyPopup(...args),
          openLyricPopup: (...args) => openLyricPopup(...args),
          startPointerDrag: (...args) => coreStartPointerDrag(...args)
        },
        ui: {
          documentRef: document,
          getElement: id => $(id),
          getActiveElement: () => document.activeElement
        },
        timing: {
          clamp: (...args) => clamp(...args),
          translate: key => t(key),
          toast: message => toast(message),
          schedule: (...args) => setTimeout(...args),
          setIntervalRef: (...args) => setInterval(...args),
          clearIntervalRef: (...args) => clearInterval(...args),
          now: () => Date.now(),
          wait: delay => new Promise(resolve => setTimeout(resolve, delay))
        },
        logger: console
      });
    if (!corePerformanceController) {
      throw new Error(
        'CorePerformanceControllerService must be loaded before app/core.js.'
      );
    }
    corePerformanceRuntime = corePerformanceController.runtime;
    if (!corePerformanceRuntime) {
      throw new Error(
        'CorePerformanceRuntimeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      openPerfMode,
      perfStop,
      perfTogglePauseMode,
      perfTogglePlay,
      perfRestartSong,
      perfPrevSong,
      perfNextSong,
      perfTranspose,
      perfTempoChange,
      perfJumpToSong,
      startPerfTimer,
      stopPerfTimer,
      startArrangerPerform,
      startBackgroundPreload: _startBackgroundPreload,
      renderPerfUI,
      prepareNextArrSong,
      arrCrossfadeSwap
    } = corePerformanceRuntime;
    corePublicApi.publish({
      openPerfMode,
      perfStop,
      perfTogglePauseMode,
      perfTogglePlay,
      perfRestartSong,
      perfPrevSong,
      perfNextSong,
      perfTranspose,
      perfTempoChange,
      perfJumpToSong,
      startPerfTimer,
      stopPerfTimer,
      startArrangerPerform,
      getPerformanceState: coreReadPerformanceState,
      updatePerformanceState: coreUpdatePerformanceState
    });

    corePublicApi.publish({
      customPrompt,
      formatTime,
      toast,
      ensureAudioCtx,
      clearEditorTextSelection,
      updateNextIdFromClips,
      renderClips,
      saveState,
      applyState,
      stopAllVoices,
      renderAll,
      resetRecordingState,
      resetHistory,
      isHistoryApplying,
      attachHistoryService
    });
