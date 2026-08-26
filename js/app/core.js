console.log("!!! APP_JS_LOADED_FROM_DISK !!!");
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
// loadProject / resolveClipAudio به js/core/ProjectAudioService.js منتقل شده است.
// wrapperهای سازگاری بلافاصله بعد از ensureAudioCtx() تعریف شده‌اند.

// تشخیص محیط مرورگر/پنجره الکترون
const isBrowser = typeof window !== 'undefined';

// globalScope فقط برای انتشار runtime state نهایی استفاده می‌شود.
// placeholder قدیمی DAW حذف شده تا adapter هیچ‌وقت state ناقص را نبیند.
const globalScope = isBrowser ? window : global;
let corePerformanceUiRuntime = null;
let coreArrangerPreparationRuntime = null;
let coreArrangerManagerRendererRuntime = null;
let coreArrangerFileImportRuntime = null;
let coreArrangerFileExportRuntime = null;
let coreArrangerSetlistRendererRuntime = null;
let coreClipRendererRuntime = null;
let coreArrangerBackgroundPreloadRuntime = null;

const corePublicApiFactory = globalScope.CorePublicApi;
if (!corePublicApiFactory?.create) {
  throw new Error('CorePublicApi باید قبل از app/core.js بارگذاری شود.');
}
const corePublicApi = corePublicApiFactory.create({
  target: globalScope,
  namespace: 'AkordyarCoreApi'
});

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
if (typeof window !== 'undefined') window.customPrompt = customPrompt;

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
        getDAW: () => getEditorDAW(),
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
      snapTime,
      showQuantizeModal,
      applyQuantize,
      quantizeSelectedChords
    } = coreGridQuantizeRuntime;
    Object.assign(globalScope, {
      getTimeSignatureGridConfig,
      getActiveQuantizeGridStep,
      toggleSnap,
      snapTime,
      showQuantizeModal,
      applyQuantize,
      quantizeSelectedChords
    });
    corePublicApi.publish({
      getTimeSignatureGridConfig,
      getActiveQuantizeGridStep,
      toggleSnap,
      snapTime,
      showQuantizeModal,
      applyQuantize,
      quantizeSelectedChords
    });
    coreGridQuantizeRuntime.bindModalDismiss();

    const coreTransportRuntime =
      globalScope.CoreTransportService?.create?.({
        getDAW: () => getEditorDAW(),
        getElement: id => $(id),
        getTransportState: () => editorTransportState,
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
          active: arrPerformActive,
          data: arrPerformData,
          index: arrPerformIdx,
          selectionEnd,
          nextState: _arrNextState,
          preparePending: arrPreparePending,
          prepStartedForIndex: _arrPrepStartedForIndex,
          waitPollActive: _arrWaitPollActive,
          isCrossfading: _arrIsCrossfading,
          perfModeActive,
          perfPauseMode,
          playbackPolicy: arrangerPlaybackPolicy
        }),
        setArrangerPreparePending: value => {
          arrPreparePending = value;
        },
        setArrangerPrepStartedForIndex: value => {
          _arrPrepStartedForIndex = value;
        },
        setArrangerWaitPollActive: value => {
          _arrWaitPollActive = value;
        },
        clearArrangerNextState: () => {
          _arrNextState = null;
        },
        prepareNextArrSong: (...args) => prepareNextArrSong(...args),
        loadArrSong: (...args) => loadArrSong(...args),
        hotSwapToNextSong: (...args) => hotSwapToNextSong(...args),
        arrCrossfadeSwap: (...args) => arrCrossfadeSwap(...args),
        renderPerfUI: (...args) => renderPerfUI(...args),
        publishPlaybackSync: (...args) => publishPlaybackSync(...args),
        updateSyncHighlight: (...args) => updateSyncHighlight(...args),
        isSyncActive: () => syncActive,
        isLyricPopupOpen: () =>
          typeof isPopupOpen === 'function' && isPopupOpen(_lyricPopup),
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
    Object.assign(globalScope, coreTransportRuntime);
    corePublicApi.publish(coreTransportRuntime);

    const coreMetronomeRuntime =
      globalScope.CoreMetronomeService?.create?.({
        getElement: id => $(id),
        getTransportState: () => editorTransportState,
        getDAW: () => getEditorDAW(),
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
    Object.assign(globalScope, {
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
        getFocusMode: () => _focusMode,
        getPanelLayout: name => globalScope[name],
        panelLayoutService: globalScope.DockablePanelLayoutService
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
    Object.assign(globalScope, {
      getTimelinePanelHeight,
      setTimelinePanelHeight,
      syncDockableSidePanelGrid,
      initDockableSidePanels,
      togglePanel
    });
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
globalScope.PERF = PERF;

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
    globalScope.DAW = DAW;
    const arrangerPlaybackPolicy = globalScope.ArrangerPlaybackPolicyService;

    let activeMidiNotes = new Set(), midiTimeout = null, isRecordingChords = false, currentRecordingClipId = null;
    let currentChord = { root: 'None', type: 'None', tension: '', bass: 'None' };
    // Playhead scroll mode: 'page' (scrolls page by page) or 'center' (stationary center)
    getEditorDAW().playheadMode = 'page';
    // Arranger transition boundary (B). Looping itself stays disabled.
    let selectionEnd = 0;

    const $ = (id) => document.getElementById(id);
    const uid = (p = 'c') => p + (getEditorDAW().nextId++);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const roundMs = (t) => Math.round(t * 1e9) / 1e9;

    // آپدیت nextId بر اساس بزرگ‌ترین ID موجود (جلوگیری از تداخل آیدی)
    function updateNextIdFromClips() {
      const allIds = [...getEditorDAW().clips.map(c => c.id), ...(getEditorDAW().sections || []).map(s => s.id)];
      allIds.forEach(id => {
        const num = parseInt(id.replace(/^[a-z]+/, ''), 10);
        if (!isNaN(num) && num >= getEditorDAW().nextId) getEditorDAW().nextId = num + 1;
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
      const daw = getEditorDAW();
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
        getDAW: () => getEditorDAW(),
        getMeterConfig: getTimeSignatureGridConfig,
        getLoop: () => {
          const daw = getEditorDAW();
          return {
            enabled: Boolean(daw.loopEnabled),
            start: daw.loopA,
            end: daw.loopB
          };
        },
        contextProvider: () => {
          try {
            return getEditorDAW()?.audioCtx || null;
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
    transportSchedulingService = editorTransportRuntimeService.schedulingService;
    audioContextServiceBridge = editorTransportRuntimeService.audioContextService;
    countInSchedulerBridge = editorTransportRuntimeService.countInScheduler;

    const playbackTimelineController =
      globalScope.PlaybackTimelineController?.create({
        getDAW: () => getEditorDAW(),
        ensureAudioCtx,
        stopAllVoices,
        getTransportClockSnapshot,
        getNode: id => $(id),
        timeToX: t => t * getEditorDAW().pxPerSecond,
        formatTime,
        onPlayheadTime: displayTime => {
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
// مالکیت state و AudioContext همچنان با app.js / DAW است.
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
// برای سازگاری با call-siteهای قدیمی در app.js
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

// حفظ APIهای global قدیمی برای بخش‌های دیگر پروژه و ابزارهای legacy.
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

function attachHistoryService() {
  if (window.__historyAttached) return;
  const historyService = requireHistoryService();
  historyService.init({
    getDAW: () => getEditorDAW(),
    getPERF: () => getEditorPERF(),
    getEdCur: () => requireEditorSongStateService().currentSong(),
    getSong: () => requireEditorSongStateService().currentSong(),
    setEdCur: (v) => setEditorSong(v),
    setSong: (v) => setEditorSong(v),
    repairSong: (song) => window.TextEncodingService?.repairSong?.(song) || song,
    getEdSeqPoints: () => edSeqPoints,
    setEdSeqPoints: (v) => { edSeqPoints = v; },
    clearEdTimers: () => {
      clearTimeout(edCommitTimer);
      clearTimeout(edInputRenderTimer);
      clearTimeout(edSaveTimer);
    },
    edSaveSong,
    edSyncToolbar,
    edRenderEditor,
    updateNextIdFromClips,
    ensureAudioCtx,
    updateTrackMix,
    peaksFromBuffer,
    refreshClipWaveImage,
    renderAll,
    scheduleAllFromPlayhead,
    edFlushPendingCommit,
    edCommitTimerRef: () => edCommitTimer,
    toast,
    t,
    logger: console
  });
  window.__historyAttached = true;
  return historyService;
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
    const coreTimelineGeometryRuntime =
      globalScope.CoreTimelineGeometryService?.create?.({
        getDAW: () => getEditorDAW(),
        getTimelineInner: () => document.getElementById('tl-inner'),
        clamp: (value, minimum, maximum) => clamp(value, minimum, maximum),
        getTimingContext: () =>
          requireEditorSongStateService().getTimingContext(),
        meter: globalScope.Meter,
        syncTimelineViewportToPlayhead: (...args) =>
          syncTimelineViewportToPlayhead(...args)
      });
    if (!coreTimelineGeometryRuntime) {
      throw new Error(
        'CoreTimelineGeometryService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      timeToX,
      xToTime,
      timeToBarBeat,
      barBeatToTime,
      getProjectEnd,
      ensureTimelineFits,
      clientToTime,
      clientToInnerPoint,
      autoScrollToPlayhead
    } = Object.assign(globalScope, coreTimelineGeometryRuntime);
    corePublicApi.publish(coreTimelineGeometryRuntime);
    const waveformBridge =
      globalScope.EditorWaveformBridgeService.create({
        ensureAudioCtx: () => ensureAudioCtx(),
        setAudioContext: (ctx) => {
          if (!getEditorDAW().audioCtx) getEditorDAW().audioCtx = ctx;
        },
        getWaveCache: () => getEditorDAW().waveCache,
        documentRef: document,
        clamp: (value, min, max) => clamp(value, min, max),
        timeToX: (value) => timeToX(value)
    });
    window.waveformService = waveformBridge.service;
    const coreClipRuntime =
      globalScope.CoreClipService?.create?.({
        getDAW: () => getEditorDAW(),
        uid: prefix => uid(prefix),
        roundMs: value => roundMs(value),
        refreshClipWaveImage: clip => refreshClipWaveImage(clip),
        saveState: () => saveState(),
        renderAll: (...args) => renderAll(...args),
        scheduleAllFromPlayhead: (...args) => scheduleAllFromPlayhead(...args),
        toast: message => toast(message),
        translate: key => globalScope.t?.(key) ?? key
      });
    if (!coreClipRuntime) throw new Error(
      'CoreClipService باید قبل از app/core.js بارگذاری شود.'
    );
    const { getClip, selectedClips, splitClipAt, splitSelectedAtPlayhead } =
      coreClipRuntime;
    Object.assign(globalScope, coreClipRuntime);
    corePublicApi.publish(coreClipRuntime);

function setEditorSong(song) {
  return requireEditorSongRuntimeService().setSong(song);
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
        getDAW: () => getEditorDAW(),
        getElement: id => $(id),
        documentRef: document,
        windowRef: window,
        saveState: (...args) => saveState(...args),
        renderTracks: (...args) => renderTracks(...args),
        renderClips: (...args) => renderClips(...args),
        scheduleAllFromPlayhead: (...args) =>
          scheduleAllFromPlayhead(...args),
        startPointerDrag: (...args) =>
          startEditorPointerDrag(...args)
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
    Object.assign(globalScope, {
      getEditorMixerService,
      updateTrackMix,
      toggleMixer,
      renderMixer,
      initMixerDrag
    });
    corePublicApi.publish(coreMixerRuntime);

    function stopAllVoices() {
      for (const [id, v] of getEditorDAW().voices) { try { v.source.onended = null; v.source.stop(0); } catch (_) {} try { v.source.disconnect(); } catch (_) {} try { v.gain.disconnect(); } catch (_) {} }
      getEditorDAW().voices.clear();
    }

    function renderAll(options = {}) {
      renderTracks(); renderRuler(); renderClips(options); renderLoopRegion(); renderArrangerMarkers(); updatePlayheadUI(); updateHud();
      edRenderClMarkers();
    }

    function handleTimingChange() {
      const timing = requireEditorSongStateService().getTimingContext();
      const config = getTimeSignatureGridConfig(
        timing.timeSignature,
        timing.tempo
      );
      editorTransportState.snapValue = getActiveQuantizeGridStep(config);
      renderTracks();
      renderRuler();
      renderClips({ preserveWaveforms: true });
      updatePlayheadUI();
      if (editorTransportState.metroActive && getEditorDAW().isPlaying) startMetronome();
    }

    const coreTrackSetupRuntime =
      globalScope.CoreTrackSetupService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        getDAW: () => getEditorDAW(),
        getIconRegistry: () => globalScope.IconRegistry,
        ensureAudioCtx: () => ensureAudioCtx(),
        uid: prefix => uid(prefix),
        saveState: () => saveState(),
        renderAll: () => renderAll(),
        toast: message => toast(message),
        translate: key => t(key)
      });
    if (!coreTrackSetupRuntime) {
      throw new Error(
        'CoreTrackSetupService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const { getIconSvg, openIconPicker, addNewTrack } =
      coreTrackSetupRuntime;
    Object.assign(globalScope, coreTrackSetupRuntime);
    corePublicApi.publish(coreTrackSetupRuntime);

    const coreTimelineRendererRuntime =
      globalScope.CoreTimelineRendererService?.create?.({
        documentRef: document,
        windowRef: window,
        getDAW: () => getEditorDAW(),
        getSongState: () => requireEditorSongStateService(),
        getIsRecordingChords: () => isRecordingChords,
        setIsRecordingChords: value => { isRecordingChords = value; },
        getIconSvg,
        customPrompt,
        uid,
        roundMs
      });
    if (!coreTimelineRendererRuntime) {
      throw new Error(
        'CoreTimelineRendererService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const {
      getTimelineTrackRendererService,
      updateTrackSelectionUI,
      selectTrack,
      renderTracks
    } = coreTimelineRendererRuntime;
    Object.assign(globalScope, {
      getTimelineTrackRendererService,
      updateTrackSelectionUI,
      selectTrack,
      renderTracks
    });
    corePublicApi.publish(coreTimelineRendererRuntime);

    let timelineSectionRendererService = null;
    function getTimelineSectionRendererService() {
      if (
        !timelineSectionRendererService &&
        window.TimelineSectionRendererService?.create
      ) {
        timelineSectionRendererService =
          window.TimelineSectionRendererService.create({
            documentRef: document,
            windowRef: window,
            getDAW: () => getEditorDAW(),
            timeToX,
            xToTime,
            snapTime,
            roundMs,
            renderClips: () => renderClips(),
            selectedClips,
            startPointerDrag: (...args) => startEditorPointerDrag(...args),
            getTimelineInner: () => $('tl-inner'),
            onDocumentMouseMove: (...args) =>
              coreClipInteractionRuntime.onDocMouseMove(...args),
            onDocumentMouseUp: (...args) =>
              coreClipInteractionRuntime.onDocMouseUp(...args),
            saveState
          });
      }
      return timelineSectionRendererService;
    }

    // ===== Cubase-style Timeline Grid =====
    function drawLaneGrid(canvas) {
      const timing = requireEditorSongStateService().getTimingContext();
      TimelineGrid.drawLaneGrid(canvas, {
        total: getProjectEnd(),
        timeToX: timeToX,
        tempo: timing.tempo,
        timeSignature: timing.timeSignature,
        pxPerSec: getEditorDAW().pxPerSecond
      });
    }

    function renderRuler() {
      const timing = requireEditorSongStateService().getTimingContext();
      const total = getProjectEnd();
      TimelineGrid.renderRuler({
        total: total,
        timeToX: timeToX,
        tempo: timing.tempo,
        timeSignature: timing.timeSignature,
        pxPerSec: getEditorDAW().pxPerSecond,
        rulerEl: $('timeline-ruler'),
        labelsEl: $('ruler-labels'),
        tlInnerEl: $('tl-inner'),
        lanesEl: $('lanes-container'),
        onDurationChange: function(t) { getEditorDAW().timelineDuration = t; }
      });
    }

    coreClipRendererRuntime =
      globalScope.CoreClipRendererService?.create?.({
        documentRef: document,
        getDAW: () => getEditorDAW(),
        timeToX: value => timeToX(value),
        refreshClipWaveImage: (...args) => refreshClipWaveImage(...args),
        getClipFilePath: (...args) => getClipFilePath(...args),
        onClipMouseDown: (...args) => onClipMouseDown(...args),
        openTimelineChordEditor: (...args) =>
          openTimelineChordEditor(...args),
        renderSections: () =>
          getTimelineSectionRendererService()?.renderSections?.()
      });
    if (!coreClipRendererRuntime) {
      throw new Error(
        'CoreClipRendererService باید قبل از app/core.js بارگذاری شود.'
      );
    }

    function renderClips(options = {}) {
      return coreClipRendererRuntime?.render?.(options);
    }

    function updateHud() { $('clip-count').textContent = String(getEditorDAW().clips.length + (getEditorDAW().sections || []).length); }

     let _audioSaveTimer = null;
     let _audioSaveRunning = false;
     let _audioSaveQueued = false;

     function scheduleAudioBlobSave() {
     const songId = requireEditorSongStateService().currentSong()?.id;
     if (!songId) return;

     clearTimeout(_audioSaveTimer);

    _audioSaveTimer = setTimeout(async () => {
    if (_audioSaveRunning) {
      _audioSaveQueued = true;
      return;
    }

    _audioSaveRunning = true;

    try {
      await saveAudioBlobsForProject(songId);
    } catch (e) {
      console.warn('Audio save error:', e);
    } finally {
      _audioSaveRunning = false;

      if (_audioSaveQueued) {
        _audioSaveQueued = false;
        scheduleAudioBlobSave();
      }
    }
  }, 1200);
}

    const coreSelectionRuntime =
      globalScope.CoreSelectionService?.create?.({
        documentRef: document,
        getDAW: () => getEditorDAW(),
        renderClips,
        updateHud
      });
    if (!coreSelectionRuntime) throw new Error(
      'CoreSelectionService باید قبل از app/core.js بارگذاری شود.'
    );
    corePublicApi.publish(coreSelectionRuntime);

    const coreAudioImportRuntime =
      globalScope.CoreAudioImportService?.create?.({
        getDAW: () => getEditorDAW(),
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
        saveAudioBlobToDB: (...args) => saveAudioBlobToDB(...args),
        saveAudioBlobsForProject: (...args) =>
          saveAudioBlobsForProject(...args),
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
    Object.assign(globalScope, { openFileForTrack });
    corePublicApi.publish({ openFileForTrack, importFileForTrack });
    bindFileInput();

   function clearEditorTextSelection() {
     window.getSelection()?.removeAllRanges();
     $('editor')?.blur();
}

    const coreClipboardRuntime =
      globalScope.CoreClipboardBridgeService?.create?.({
        clipboardFactory: () => globalScope.ClipboardService,
        getEdSaveSong: () => globalScope.edSaveSong,
        getDAW: () => getEditorDAW(),
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
        getDAW: () => getEditorDAW(),
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
    Object.assign(globalScope, { cutAtTime });
    corePublicApi.publish({ cutAtTime });

    const coreClipInteractionRuntime =
      globalScope.CoreClipInteractionService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        getDAW: () => getEditorDAW(),
        getClip: clipId => getClip(clipId),
        selectedClips: () => selectedClips(),
        clearEditorTextSelection: () => clearEditorTextSelection(),
        clearChordSelection: (...args) =>
          globalScope.edClearChordSelection?.(...args),
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
          startEditorPointerDrag(...args),
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
    Object.assign(globalScope, {
      getMarqueeLaneElements,
      onClipMouseDown,
      onDocMouseMove,
      onDocMouseUp
    });
    corePublicApi.publish(coreClipInteractionRuntime);

    function openTimelineChordEditor(clipId) {
      const clip = getClip(clipId);
      if (!clip || clip.type !== 'chord' || typeof openChordEditor !== 'function') return;
      const now = Date.now();
      if (clip._lastModalOpenAt && now - clip._lastModalOpenAt < 120) return;
      clip._lastModalOpenAt = now;
      openChordEditor(clipId);
    }

    let recordingRuntime = null;

    const coreRecordingRuntime =
      globalScope.CoreRecordingService?.create?.({
        getDAW: () => getEditorDAW(),
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
          globalScope.saveAudioBlobToDB?.(...args),
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
    Object.assign(globalScope, coreRecordingRuntime);
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
        getDAW: () => getEditorDAW(),
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
    Object.assign(globalScope, coreSettingsRuntime);
    corePublicApi.publish(coreSettingsRuntime);
    coreSettingsRuntime.initialize();
    let syncChordLinePopup;
    const coreChordLineSyncRuntime =
      globalScope.CoreChordLineSyncService?.create?.({
        getSongState: () => requireEditorSongStateService(),
        getDAW: () => getEditorDAW(),
        getChordLineSyncService: () => globalScope.ChordLineSyncService,
        isPopupOpen: popup => isPopupOpen(popup),
        getChordLinePopup: () =>
          typeof _chordLinePopup !== 'undefined' ? _chordLinePopup : null,
        syncChordLinePopup: () => syncChordLinePopup(),
        saveState: () => saveState(),
        renderAll: () => renderAll(),
        toast: message => toast(message)
      });
    if (!coreChordLineSyncRuntime) {
      throw new Error(
        'CoreChordLineSyncService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const { syncChordLineFromLyrics } = coreChordLineSyncRuntime;
    Object.assign(globalScope, coreChordLineSyncRuntime);
    corePublicApi.publish(coreChordLineSyncRuntime);
    const coreMovableWindowRuntime =
      globalScope.CoreMovableWindowBridgeService?.create?.({
        documentRef: document,
        windowRef: window,
        startPointerDrag: (...args) =>
          globalScope.startEditorPointerDrag?.(...args)
      });
    if (!coreMovableWindowRuntime) {
      throw new Error(
        'CoreMovableWindowBridgeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    Object.assign(globalScope, coreMovableWindowRuntime);
    corePublicApi.publish(coreMovableWindowRuntime);
    coreMovableWindowRuntime.initMovableWindows();

    // Playhead mode toggle
    function togglePlayheadMode() {
      getEditorDAW().playheadMode = getEditorDAW().playheadMode === 'page' ? 'center' : 'page';
      const btn = $('playheadModeBtn');
      if (btn) btn.classList.toggle('ph-center', getEditorDAW().playheadMode === 'center');
      toast(getEditorDAW().playheadMode === 'center' ? 'پلی‌هدر ثابت در مرکز' : 'اسکرول صفحه‌ای');
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
    Object.assign(globalScope, {
      isPopupOpen,
      popupDocument,
      openPopupWindow,
      focusPopupWindow
    });
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
        getPopup: () =>
          typeof _lyricPopup !== 'undefined' ? _lyricPopup : null,
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
    Object.assign(globalScope, coreHighlightRuntime);
    corePublicApi.publish(coreHighlightRuntime);

    /* ===== LOOP A-B ===== */
    const coreLoopVisualRuntime =
      globalScope.CoreLoopVisualService?.create?.({
        getDAW: () => getEditorDAW(),
        getElement: id => $(id),
        documentRef: document,
        timeToX: value => timeToX(value),
        xToTime: value => xToTime(value),
        clamp: (value, min, max) => clamp(value, min, max),
        getProjectEnd: () => getProjectEnd(),
        startPointerDrag: (...args) =>
          globalScope.startEditorPointerDrag?.(...args),
        saveState: (...args) => saveState(...args)
      });
    if (!coreLoopVisualRuntime) {
      throw new Error(
        'CoreLoopVisualService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const { renderLoopRegion } = coreLoopVisualRuntime;
    Object.assign(globalScope, coreLoopVisualRuntime);
    corePublicApi.publish(coreLoopVisualRuntime);
    coreLoopVisualRuntime.bindLoopDrag();

    const coreLoopControlRuntime =
      globalScope.CoreLoopControlService?.create?.({
        getDAW: () => getEditorDAW(),
        getElement: id => $(id),
        isPerforming: () => arrPerformActive,
        getSelectedClips: () => selectedClips(),
        setSelectionEnd: value => {
          selectionEnd = value;
        },
        renderLoopRegion: () => renderLoopRegion(),
        updatePlayheadUI: () => updatePlayheadUI(),
        startTransport: () => startTransport(),
        stopAllVoices: () => stopAllVoices(),
        cancelAnimationFrame: (...args) => cancelAnimationFrame(...args),
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
    Object.assign(globalScope, coreLoopControlRuntime);
    corePublicApi.publish(coreLoopControlRuntime);

    const arrangerMarkerController =
      globalScope.EditorArrangerMarkerControllerService.create({
        getDAW: () => getEditorDAW(),
        markerService: globalScope.ArrangerMarkerService,
        getProjectEnd: () => getProjectEnd(),
        timeToX: value => timeToX(value),
        xToTime: value => xToTime(value),
        clamp: (value, min, max) => clamp(value, min, max),
        getElement: id => $(id),
        documentRef: document,
        isPerforming: () => arrPerformActive,
        startPointerDrag: (...args) =>
          startEditorPointerDrag(...args),
        saveState: () => saveState(),
        saveSong: () => {
          if (typeof edSaveSong === 'function') edSaveSong();
        },
        toast: message => toast(message),
        formatTime: value => formatTime(value)
      });

    function getArrangerMarkers() {
      return arrangerMarkerController.getArrangerMarkers();
    }

    function persistArrangerMarkers() {
      return arrangerMarkerController.persistArrangerMarkers();
    }

    function setArrangerA() {
      return arrangerMarkerController.setArrangerA();
    }

    function setArrangerB() {
      return arrangerMarkerController.setArrangerB();
    }

    function clearArrangerMarkers() {
      return arrangerMarkerController.clearArrangerMarkers();
    }

    function toggleArrangerMarkers() {
      return arrangerMarkerController.toggleArrangerMarkers();
    }

    function renderArrangerMarkers() {
      return arrangerMarkerController.renderArrangerMarkers();
    }

    arrangerMarkerController.bindDrag();

    /* ===== POPUP WINDOW FULLSCREEN ===== */
    let _lyricPopup = null;
    let _focusMode = false;
    const coreFocusModeRuntime =
      globalScope.CoreFocusModeService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        getFocusMode: () => _focusMode,
        setFocusMode: value => {
          _focusMode = value;
        },
        getSongState: () => requireEditorSongStateService(),
        schedule: (...args) => setTimeout(...args),
        renderChords: () => edRenderChords(),
        toast: message => toast(message),
        translate: key => t(key)
      });
    if (!coreFocusModeRuntime) {
      throw new Error(
        'CoreFocusModeService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    Object.assign(globalScope, coreFocusModeRuntime);
    corePublicApi.publish(coreFocusModeRuntime);

    function installPopupHighlightLoop(popup, doc) {
      if (!popup || !doc?.body) return;
      const script = doc.createElement('script');
      script.textContent = '(function(){if(window.__akordHighlightLoopStarted)return;window.__akordHighlightLoopStarted=true;function frame(){try{window._syncHighlight?.()}catch(_){}if(!window.closed)window.requestAnimationFrame(frame)}frame()})();';
      doc.body.appendChild(script);
    }

    function openLyricPopup() {
      if (isPopupOpen(_lyricPopup)) { focusPopupWindow(_lyricPopup); return; }
      _lyricPopup = openPopupWindow('lyricPopup', 'width=900,height=700,menubar=no,toolbar=no,location=no,status=no');
      if (!_lyricPopup) { toast(t('popupBlocked')); return; }
      popupWindowBridge?.set?.(_lyricPopup, '__popupRole', 'player');
      syncLyricPopup();
      setTimeout(safeMirrorTimeline, 1000);
    }

    // ===== LYRIC-ONLY POPUP (singer view, no chords) =====
    let _lyricOnlyPopup = null;
    function openLyricOnlyPopup() {
      if (isPopupOpen(_lyricOnlyPopup)) { focusPopupWindow(_lyricOnlyPopup); return; }
      _lyricOnlyPopup = openPopupWindow('lyricOnlyPopup', 'width=650,height=400,menubar=no,toolbar=no,location=no,status=no');
      if (!_lyricOnlyPopup) { toast(t('popupBlocked')); return; }
      popupWindowBridge?.set?.(_lyricOnlyPopup, '__popupRole', 'singer');
      syncLyricOnlyPopup();
    }
    const coreLyricOnlyPopupRuntime =
      globalScope.CoreLyricOnlyPopupService?.create?.({
        getPopup: () => _lyricOnlyPopup,
        isPopupOpen: popup => isPopupOpen(popup),
        popupDocument: popup => popupDocument(popup),
        getSnapshot: () =>
          requireEditorSongStateService().getPresentationSnapshot(),
        popupWindowBridge,
        windowRef: window,
        getDAW: () => getEditorDAW(),
        getTransportPlayhead: () => getTransportPlayhead(),
        getSyncTimes: () => requireEditorSongStateService().getSyncTimes(),
        installPopupHighlightLoop
      });
    if (!coreLyricOnlyPopupRuntime) {
      throw new Error(
        'CoreLyricOnlyPopupService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    function syncLyricOnlyPopup(...args) {
      return coreLyricOnlyPopupRuntime.sync(...args);
    }

    // ===== CHORD LINE POPUP (detachable, small) =====
    let _chordLinePopup = null;
    const coreChordLinePopupRuntime =
      globalScope.CoreChordLinePopupService?.create?.({
        getPopup: () => _chordLinePopup,
        setPopup: popup => {
          _chordLinePopup = popup;
        },
        getSongState: () => requireEditorSongStateService(),
        isPopupOpen: popup => isPopupOpen(popup),
        popupDocument: popup => popupDocument(popup),
        openPopupWindow: (...args) => openPopupWindow(...args),
        focusPopupWindow: popup => focusPopupWindow(popup),
        popupWindowBridge,
        windowRef: window,
        navigatorRef: window.navigator,
        nodeFilter: window.NodeFilter,
        transposeChord: (...args) => edTransposeChord(...args),
        translate: key => t(key),
        toast: message => toast(message)
      });
    if (!coreChordLinePopupRuntime) {
      throw new Error(
        'CoreChordLinePopupService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    const { openChordLinePopup } = coreChordLinePopupRuntime;
    syncChordLinePopup = coreChordLinePopupRuntime.syncChordLinePopup;
    Object.assign(globalScope, coreChordLinePopupRuntime);
    corePublicApi.publish(coreChordLinePopupRuntime);

    const corePlayerViewSettingsRuntime =
      globalScope.CorePlayerViewSettingsService?.create?.({
        getPopup: () => _lyricPopup,
        isPopupOpen: popup => isPopupOpen(popup),
        popupDocument: popup => popupDocument(popup),
        popupWindowBridge,
        windowRef: window,
        getSongState: () => requireEditorSongStateService(),
        getDAW: () => getEditorDAW(),
        getTransportPlayhead: () => getTransportPlayhead(),
        installPopupHighlightLoop,
        schedule: (...args) => setTimeout(...args),
        EventCtor: window.Event
      });
    if (!corePlayerViewSettingsRuntime) {
      throw new Error(
        'CorePlayerViewSettingsService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    Object.assign(globalScope, corePlayerViewSettingsRuntime);
    corePublicApi.publish(corePlayerViewSettingsRuntime);

    const corePlayerViewPopupSyncRuntime =
      globalScope.CorePlayerViewPopupSyncService?.create?.({
        popup: _lyricPopup,
        documentRef: () => popupDocument(_lyricPopup),
        popupWindowBridge,
        getSnapshot: () =>
          requireEditorSongStateService().getPresentationSnapshot(),
        transposeChord: (...args) => edTransposeChord(...args),
        getSettings: () => corePlayerViewSettingsRuntime.getSettings(),
        isPopupOpen: popup => isPopupOpen(popup),
        schedule: (...args) => setTimeout(...args),
        EventCtor: window.Event
      });
    if (!corePlayerViewPopupSyncRuntime) {
      throw new Error(
        'CorePlayerViewPopupSyncService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    corePublicApi.publish(corePlayerViewPopupSyncRuntime);

    const corePlayerViewPopupBuilderRuntime =
      globalScope.CorePlayerViewPopupBuilderService?.create?.({
        popup: _lyricPopup,
        popupWindowBridge,
        chordRenderer: globalScope.CorePlayerViewChordRendererService,
        settingsRuntime: corePlayerViewSettingsRuntime,
        applyHighlightClassToPopup
      });
    if (!corePlayerViewPopupBuilderRuntime) {
      throw new Error(
        'CorePlayerViewPopupBuilderService باید قبل از app/core.js بارگذاری شود.'
      );
    }
    corePublicApi.publish(corePlayerViewPopupBuilderRuntime);

    function syncLyricPopup() {
      if (!isPopupOpen(_lyricPopup)) return;
      const popupDoc = popupDocument(_lyricPopup);
      if (!popupDoc) return;
      // If popup already has chord script, update in-place (no full rebuild)
      if (corePlayerViewPopupSyncRuntime.syncExistingPopup()) return;
      const snapshot = requireEditorSongStateService().getPresentationSnapshot();
      if (!snapshot) return;
      const builderTitle = snapshot.title || t('untitled');
      const builderArtist = snapshot.artist || '';
      const builderKeyStr = (snapshot.key || 'C') + (snapshot.keyMode === 'min' ? 'm' : '');
      const builderSub = [builderArtist, builderKeyStr ? (currentLang === 'fa' ? 'گام: ' : 'Key: ') + builderKeyStr : null]
        .filter(Boolean)
        .join('  ·  ');
      const builderLines = snapshot.lyrics.split('\n');
      const builderChords = snapshot.chords.map(ch => ({
        lineIndex: ch.lineIndex,
        charIndex: ch.charIndex,
        anchorType: ch.anchorType,
        _name: edTransposeChord(ch.name, snapshot.transpose)
      }));
      corePlayerViewPopupBuilderRuntime.render({
        documentRef: popupDoc,
        title: builderTitle,
        sub: builderSub,
        lines: builderLines,
        styles: snapshot.styles,
        chords: builderChords
      });
    }

// ==========================================
// PART 3: Project Load & Audio Export (WAV)
// ==========================================
// منطق load/resolve صوت پروژه به js/core/ProjectAudioService.js منتقل شده است.

/**
 * تبدیل AudioBuffer به فرمت استاندارد WAV جهت ذخیره‌سازی
 */
function bufferToWave(abuffer, len) {
  let numOfChan = abuffer.numberOfChannels,
      length = len * numOfChan * 2 + 44,
      out = new DataView(new ArrayBuffer(length)),
      channels = [], i, sample,
      offset = 0, pos = 0;

  function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
  function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (i = 0; i < numOfChan; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (offset < len) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }
  return new Blob([out], { type: "audio/wav" });
}

  // ==========================================
// PART 4: Timeline Rendering & UI Event Listeners
// ==========================================

function renderTimeline() {
  return window.EditorLifecycleService?.renderTimeline?.({
    documentRef: document,
    getDAW: () => getEditorDAW()
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
    // state همچنان متعلق به app.js است؛ کنترلر از طریق accessor می‌خواند/می‌نویسد.
    const syncModeState = {
      get active() { return syncActive; }, set active(v) { syncActive = v; },
      get cursor() { return syncCursor; }, set cursor(v) { syncCursor = v; },
      get history() { return syncHistory; }, set history(v) { syncHistory = v; },
      get redoHistory() { return syncRedoHistory; }, set redoHistory(v) { syncRedoHistory = v; },
      get watch() { return syncWatch; }, set watch(v) { syncWatch = v; },
      get tapKeyHandler() { return syncTapKeyHandler; }, set tapKeyHandler(v) { syncTapKeyHandler = v; },
      get lastActiveLi() { return lastSyncActiveLi; }, set lastActiveLi(v) { lastSyncActiveLi = v; }
    };

    // Commit 2b — accessor روی stateهای seq/CL (تعریف letها در app.js می‌ماند؛
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
        getDAW: () => getEditorDAW(),
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
        getLyricPopup: () =>
          typeof _lyricPopup !== 'undefined' ? _lyricPopup : null,
        getLyricOnlyPopup: () =>
          typeof _lyricOnlyPopup !== 'undefined' ? _lyricOnlyPopup : null,
        getChordLinePopup: () =>
          typeof _chordLinePopup !== 'undefined' ? _chordLinePopup : null,
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
    Object.assign(globalScope, coreSyncModeRuntime);
    corePublicApi.publish(coreSyncModeRuntime);

    // Chord visibility toggle (editor only, independent of popup)
    if ($('edToggleChords')) $('edToggleChords').onclick = () => {
      edChordsVisible = !edChordsVisible;
      $('edToggleChords').classList.toggle('active', edChordsVisible);
      edRenderChords();
    };

    // Sequential chords (آکورد ترتیبی)
    function edRemapSeqPoints(oldText, newText) {
      const songState = requireEditorSongStateService();
      const seqPoints = songState.getSeqPoints();
      if (!seqPoints.length) return;
      // منطق remap به js/editor/LyricPositionMapper.js منتقل شده است.
      seqPoints.forEach(sp => requireLyricPositionMapper().remapAnchorToNewText(sp, oldText, newText));
      const validPoints = seqPoints.filter(p => p.lineIndex >= 0);
      songState.setSeqPoints(validPoints);
      if (edSeqModeActive) edSeqPoints = validPoints;
    }

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
    let arrangers = JSON.parse(localStorage.getItem('arrangers_v1') || '[]');
    window.arrangers = arrangers; // exposed for ProjectHub
    let editingArr = null;

    // ===== Normalize playlist name for comparison (case-insensitive, whitespace-insensitive) =====
    const normalizePlaylistName = (name) =>
      String(name || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("fa-IR");

    // ===== Check if playlist name already exists (excluding optional current id) =====
    function playlistNameExists(name, excludeId = null) {
      const normalizedName = normalizePlaylistName(name);
      return arrangers.some(a => a.id !== excludeId && normalizePlaylistName(a.name) === normalizedName);
    }

    // ===== Arranger Enhanced: Per-song settings =====
    // Each arranger item: { id, transpose: 0, notes: '' }
    // Arranger level: { crossfade: 0, pauseBetween: false }
    function ensureArrItem(arr, idx) {
      if (!arr._itemSettings) arr._itemSettings = {};
      const id = arr.items[idx];
      if (!arr._itemSettings[id]) arr._itemSettings[id] = { transpose: 0, notes: '' };
      return arr._itemSettings[id];
    }
    function getArrItemSetting(arr, songId) {
      if (!arr._itemSettings) return { transpose: 0, notes: '' };
      return arr._itemSettings[songId] || { transpose: 0, notes: '' };
    }

    function saveArrangers() { localStorage.setItem('arrangers_v1', JSON.stringify(arrangers)); }

    function openArrangerModal() {
      $('arrangerModal').classList.add('show');
      renderArrangerManager();
      // اگر ارنجری وجود داره، مستقیم ادیتور رو باز کن
      if (arrangers.length > 0) {
        editingArr = arrangers[0];
        openArrEditor();
      } else {
        $('arrEditor').style.display = 'none';
      }
      // درگ پنل ارنجر
      _setupArrangerModalDrag();
      // اضافه کردن هندلر کیبورد برای دکمه ESC و فوکوس
      const arrModal = $('arrangerModal');
      if (arrModal) {
        arrModal.focus();
        if (!arrModal._escHandler) {
          arrModal._escHandler = (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              closeArrangerModal();
            }
          };
          arrModal.addEventListener('keydown', arrModal._escHandler);
        }
      }
    }
    function closeArrangerModal() {
      $('arrangerModal').classList.remove('show');
      // ریست موقعیت
      const editor = $('arrangerModal').querySelector('.chord-editor');
      if (editor) { editor.style.left = ''; editor.style.top = ''; }
      editingArr = null;
    }

    // Expose for ProjectHub (Hub arranger track click).
    corePublicApi.publish({
      openArrangerModal,
      closeArrangerModal
    });

    // درگ arrangerModal
    function _setupArrangerModalDrag() {
      const handle = $('arrModalDragHandle');
      const modal = $('arrangerModal');
      const editor = modal.querySelector('.chord-editor');
      if (!handle || !editor || handle._dragSetup) return;
      handle._dragSetup = true;
      let dragging = false, startX, startY, origX, origY;
      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'H3') {
          if (e.target.tagName === 'H3') {} else return;
        }
        dragging = true;
        const rect = editor.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        origX = rect.left; origY = rect.top;
        e.preventDefault();
        startEditorPointerDrag(handle, e, move, () => { dragging = false; });
      });
      const move = (e) => {
        if (!dragging) return;
        editor.style.left = (origX + e.clientX - startX) + 'px';
        editor.style.top = (origY + e.clientY - startY) + 'px';
      };
    }

    coreArrangerFileExportRuntime =
      globalScope.CoreArrangerFileExportService?.create?.({
        documentRef: document,
        windowRef: window,
        getAllSongs: () => edGetAllSongs(),
        toast: message => toast(message),
        blobRef: globalScope.Blob,
        urlRef: globalScope.URL
      });
    if (!coreArrangerFileExportRuntime) {
      throw new Error(
        'CoreArrangerFileExportService باید قبل از app/core.js بارگذاری شود.'
      );
    }

    coreArrangerManagerRendererRuntime =
      globalScope.CoreArrangerManagerRendererService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        getArrangers: () => arrangers,
        getEditingArr: () => editingArr,
        setArrangers: value => {
          arrangers = value;
        },
        setEditingArr: value => {
          editingArr = value;
        },
        openArrEditor: (...args) => openArrEditor(...args),
        saveArrangers: (...args) => saveArrangers(...args),
        exportArranger: (...args) => exportArranger(...args),
        confirmRef: message => confirm(message),
        translate: key => t(key),
        toast: message => toast(message)
      });
    if (!coreArrangerManagerRendererRuntime) {
      throw new Error(
        'CoreArrangerManagerRendererService باید قبل از app/core.js بارگذاری شود.'
      );
    }

    function renderArrangerManager(...args) {
      return coreArrangerManagerRendererRuntime?.render?.(...args);
    }

    coreArrangerFileImportRuntime =
      globalScope.CoreArrangerFileImportService?.create?.({
        documentRef: document,
        getArrangers: () => arrangers,
        setEditingArr: value => {
          editingArr = value;
        },
        getAllSongs: () => edGetAllSongs(),
        setAllSongs: (...args) => edSetAllSongs(...args),
        playlistNameExists: (...args) => playlistNameExists(...args),
        saveArrangers: (...args) => saveArrangers(...args),
        renderArrangerManager: (...args) => renderArrangerManager(...args),
        openArrEditor: (...args) => openArrEditor(...args),
        toast: message => toast(message),
        logger: console,
        now: () => Date.now(),
        isoNow: () => new Date().toISOString()
      });
    if (!coreArrangerFileImportRuntime) {
      throw new Error(
        'CoreArrangerFileImportService باید قبل از app/core.js بارگذاری شود.'
      );
    }

    // Send current song to Arranger Track
    async function sendCurrentSongToArranger() {
      const currentSong = requireEditorSongStateService().currentSong();
      if (!currentSong) { toast('ترانه‌ای باز نیست'); return; }

      try {
        // Save current song to archive first so the arranger references the
        // latest timeline and the saved A/B markers.
        await edSaveToArchive();

        // If no arrangers exist, create one
        if (!arrangers.length) {
          const arr = { id: Date.now(), name: 'پلی‌لیست جدید', items: [], crossfade: 0, pauseBetween: false };
          arrangers.unshift(arr);
          editingArr = arr;
        } else {
          // Use first arranger or last edited one
          editingArr = arrangers[0];
        }
        if (!Array.isArray(editingArr.items)) editingArr.items = [];

        // Add current song to arranger if not already there
        if (!editingArr.items.some(item => String(item) === String(currentSong.id))) {
          editingArr.items.push(currentSong.id);
        }
        saveArrangers();
        // Open arranger editor
        openArrangerModal();
        toast('ترانه به پلی‌لیست اضافه شد');
      } catch (error) {
        console.error('[Arranger] Failed to send current song:', error);
        toast('خطا در ارسال ترانه به ارنجر');
      }
    }

    async function createNewArranger() {
      const name = await customPrompt('نام پلی‌لیست جدید:', 'پلی‌لیست ' + (arrangers.length + 1));
      if (name === null) return; // کاربر کنسل کرد
      const trimmedName = name.trim() || ('پلی‌لیست ' + (arrangers.length + 1));

      // ─── بررسی نام تکراری با مقایسه normalize شده ───
      if (playlistNameExists(trimmedName)) {
        toast(`⚠ پلی‌لیستی با نام «${trimmedName}» از قبل وجود دارد. نام دیگری انتخاب کنید.`);
        return createNewArranger(); // دوباره بپرس
      }

      const arr = { 
        id: 'playlist_' + Date.now(), 
        name: trimmedName, 
        items: [], 
        crossfade: 0, 
        pauseBetween: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      arrangers.unshift(arr);
      saveArrangers();
      editingArr = arr;
      renderArrangerManager(); // اول لیست پلی‌لیست‌ها رو refresh کن
      openArrEditor();          // بعد ادیتور رو باز کن
      toast(`✅ پلی‌لیست «${arr.name}» ساخته شد`);
    }

    // Expose for ProjectHub (Hub "➕ جدید" button).
    corePublicApi.publish({ createNewArranger });

    function openArrEditor() {
      if (!editingArr) return;
      // ابتدا style های قدیمی رو پاک کن
      const arrManager = $('arrManager');
      arrManager.style.maxHeight = '';
      arrManager.style.borderBottom = '';
      arrManager.style.paddingBottom = '';
      arrManager.style.marginBottom = '';

      // ادیتور رو نمایش بده
      const arrEditor = $('arrEditor');
      arrEditor.style.display = 'block';

      // اطمینان از اینکه پنجره ارنجر هم نمایش داده شده
      const modal = $('arrangerModal');
      if (modal && !modal.classList.contains('show')) {
        modal.classList.add('show');
      }

      $('arrName').value = editingArr.name || '';
      // Sync crossfade/pause controls
      if (editingArr.crossfade) {
        $('arrCrossfadeRange').value = editingArr.crossfade;
        $('arrCrossfadeVal').textContent = editingArr.crossfade + 's';
      } else {
        $('arrCrossfadeRange').value = '0';
        $('arrCrossfadeVal').textContent = '0s';
      }
      if (editingArr.pauseBetween) $('arrPauseBtn').classList.add('arr-stl-active');
      else $('arrPauseBtn').classList.remove('arr-stl-active');
      renderArrPool(); renderArrSetlist();
      // Reset to editor tab
      switchArrTab('editor');
      // Highlight active arranger card
      renderArrangerManager();
      console.log(`[Arranger] Editor opened for: "${editingArr.name}"`);
    }

    function switchArrTab(tab) {
      document.querySelectorAll('.arr-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      $('arrTabEditor').style.display = tab === 'editor' ? '' : 'none';
      $('arrTabSongs').style.display = tab === 'songs' ? '' : 'none';
      if (tab === 'songs') renderArrSongsList();
    }

    function renderArrSongsList() {
      const box = $('arrSongsList');
      if (!editingArr || !editingArr.items.length) {
        box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-secondary);">ترانه‌ای در این ارنجر وجود ندارد</div>';
        return;
      }
      const allSongs = edGetAllSongs();
      let html = '';
      editingArr.items.forEach((songId, idx) => {
        const song = allSongs.find(s => s.id === songId);
        if (!song) return;
        const setting = getArrItemSetting(editingArr, songId);
        const key = song.key || '';
        const rhythm = song.rhythm || '';
        const transpose = setting.transpose ? (setting.transpose > 0 ? '+' + setting.transpose : setting.transpose) : '0';
        html += `<div class="arr-song-card">
          <div class="song-header">
            <div class="song-num">${idx + 1}</div>
            <div class="song-title">${song.title || 'بدون عنوان'}</div>
          </div>
          <div class="song-meta">
            ${song.artist ? '<span>🎤 ' + song.artist + '</span>' : ''}
            ${key ? '<span>🎵 گام: ' + key + '</span>' : ''}
            ${rhythm ? '<span>🥁 ریتم: ' + rhythm + '</span>' : ''}
            <span>♯ تغییر گام: ${transpose}</span>
          </div>
          ${setting.notes ? '<div style="margin-top:6px;font-size:0.8rem;color:var(--accent-cyan-glow);">📝 ' + setting.notes + '</div>' : ''}
        </div>`;
      });
      box.innerHTML = html;
    }
    function closeArrEditor() {
      saveArrangers();
      $('arrEditor').style.display = 'none';
      editingArr = null;
      renderArrangerManager();
    }

    /**
     * saveCurrentArranger — ذخیره پلی‌لیست فعلی
     * نام پلی‌لیست رو از input می‌خونه، در localStorage ذخیره می‌کنه،
     * و لیست پلی‌لیست‌ها رو refresh می‌کنه.
     * اگر نام تکراری باشه، خطا میده.
     */
    function saveCurrentArranger() {
      if (!editingArr) {
        toast('⚠ هیچ پلی‌لیستی در حال ویرایش نیست');
        return;
      }
      const nameInput = $('arrName');
      let newName = nameInput ? nameInput.value.trim() : '';
      if (!newName) newName = 'پلی‌لیست بدون نام';

      // ─── بررسی نام تکراری با مقایسه normalize شده (به‌جز خود پلی‌لیست فعلی) ───
      if (playlistNameExists(newName, editingArr.id)) {
        toast(`⚠ پلی‌لیستی با نام «${newName}» از قبل وجود دارد.`);
        return;
      }

      editingArr.name = newName;
      editingArr.updatedAt = new Date().toISOString();

      // ذخیره crossfade فعلی
      const cfRange = $('arrCrossfadeRange');
      if (cfRange) editingArr.crossfade = parseFloat(cfRange.value) || 0;

      saveArrangers();
      renderArrangerManager();
      toast(`✅ پلی‌لیست «${editingArr.name}» ذخیره شد (${editingArr.items.length} آهنگ)`);
    }

    // Debounced save for playlist name input
    let _saveNameDebounceTimer = null;
    function saveCurrentArrangerDebounced() {
      if (_saveNameDebounceTimer) clearTimeout(_saveNameDebounceTimer);
      _saveNameDebounceTimer = setTimeout(() => {
        saveCurrentArranger();
      }, 500);
    }

    /**
     * exportCurrentArranger — اکسپورت پلی‌لیست فعلی به فایل JSON
     */
    function exportCurrentArranger() {
      if (!editingArr) {
        toast('⚠ هیچ پلی‌لیستی در حال ویرایش نیست');
        return;
      }
      // اول پلی‌لیست رو ذخیره کن
      saveCurrentArranger();
      exportArranger(editingArr);
    }

    /**
     * exportArranger — اکسپورت یک پلی‌لیست مشخص به فایل JSON
     * @param {Object} arr - پلی‌لیست برای اکسپورت
     */
    async function exportArranger(arr) {
      return coreArrangerFileExportRuntime?.exportArranger?.(arr);
    }

    /**
     * importArrangerFromFile — بارگذاری پلی‌لیست از فایل JSON
     * اگر پلی‌لیستی با همان نام وجود داشته باشد، خطا می‌دهد.
     */
    async function importArrangerFromFile(...args) {
      return coreArrangerFileImportRuntime?.importFromFile?.(...args);
    }

    // Crossfade control
    function arrSetCrossfade(val) {
      if (editingArr) { editingArr.crossfade = val; saveArrangers(); }
      $('arrCrossfadeVal').textContent = val + 's';
    }

    // Pause between songs toggle
    function arrTogglePauseBetween() {
      if (!editingArr) return;
      editingArr.pauseBetween = !editingArr.pauseBetween;
      $('arrPauseBtn').classList.toggle('arr-stl-active', editingArr.pauseBetween);
      saveArrangers();
    }

    // Auto transpose all songs
    async function arrAutoTranspose() {
      if (!editingArr) return;
      const val = await customPrompt('تغییر گام برای همه آهنگ‌ها (مثلاً 2 یا -3):', '0');
      if (val === null) return;
      const semi = parseInt(val);
      if (isNaN(semi)) return;
      const allSongs = edGetAllSongs();
      editingArr.items.forEach(id => {
        const setting = ensureArrItem(editingArr, editingArr.items.indexOf(id));
        setting.transpose = (setting.transpose || 0) + semi;
      });
      saveArrangers(); renderArrSetlist();
    }

    // Clear all notes
    function arrClearNotes() {
      if (!editingArr || !confirm('یادداشت‌های همه آهنگ‌ها پاک شود؟')) return;
      editingArr.items.forEach(id => {
        const setting = ensureArrItem(editingArr, editingArr.items.indexOf(id));
        setting.notes = '';
      });
      saveArrangers(); renderArrSetlist();
    }

    // Song Note Modal
    let _arrNoteIdx = -1;
    function arrFilterSongs() {
      renderArrPool();
      renderArrSetlist();
    }
    function openArrSongNote(idx) {
      _arrNoteIdx = idx;
      const allSongs = edGetAllSongs();
      const id = editingArr.items[idx];
      const song = allSongs.find(x => x.id === id);
      const setting = ensureArrItem(editingArr, idx);
      $('arrSongNoteTitle').textContent = (song ? (song.title || 'بدون نام') : '') + ' — یادداشت اجرا';
      $('arrSongNoteText').value = setting.notes || '';
      $('arrSongNoteOverlay').classList.add('show');
    }
    function closeArrSongNote() {
      $('arrSongNoteOverlay').classList.remove('show');
      _arrNoteIdx = -1;
    }
    function saveArrSongNote() {
      if (_arrNoteIdx < 0 || !editingArr) return;
      const setting = ensureArrItem(editingArr, _arrNoteIdx);
      setting.notes = $('arrSongNoteText').value;
      saveArrangers(); closeArrSongNote(); renderArrSetlist();
    }

    function renderArrPool() {
      const box = $('arrPool'); box.innerHTML = '';
      const allSongs = edGetAllSongs();
      const inList = new Set(editingArr.items);
      let avail = allSongs.filter(s => !inList.has(s.id));
      const query = ($('arrSearchInput')?.value || '').trim().toLowerCase();
      if (query) {
        avail = avail.filter(s => {
          const matchText = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.key || '') + ' ' + (s.genre || '')).toLowerCase();
          return matchText.includes(query);
        });
      }
      if (!avail.length) { box.innerHTML = `<div style="padding:14px;color:var(--text-secondary);font-size:13px;">${query ? 'نتیجه‌ای یافت نشد' : t('allInSetlist')}</div>`; return; }
      avail.forEach(s => {
        const it = document.createElement('div'); it.className = 'arr-item';
        it.innerHTML = `<span class="ai-title">${s.title || t('untitled')}<small>${s.artist || '—'}</small></span><button>＋</button>`;
        it.onclick = () => { editingArr.items.push(s.id); saveArrangers(); renderArrPool(); renderArrSetlist(); };
        box.appendChild(it);
      });
    }

    // ===== Arranger Setlist Management =====
    coreArrangerSetlistRendererRuntime =
      globalScope.CoreArrangerSetlistRendererService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        getEditingArr: () => editingArr,
        getAllSongs: () => edGetAllSongs(),
        getSearchQuery: () => $('arrSearchInput')?.value || '',
        ensureArrItem: (...args) => ensureArrItem(...args),
        saveArrangers: (...args) => saveArrangers(...args),
        openArrSongNote: (...args) => openArrSongNote(...args),
        translate: key => t(key)
      });
    if (!coreArrangerSetlistRendererRuntime) {
      throw new Error(
        'CoreArrangerSetlistRendererService باید قبل از app/core.js بارگذاری شود.'
      );
    }

    function renderArrSetlist(...args) {
      return coreArrangerSetlistRendererRuntime?.render?.(...args);
    }

    // ===== Performance Mode (Live Dashboard) =====
    let arrPerformIdx = -1, arrPerformActive = false, arrPerformData = null, arrPreparePending = false;
    let _arrNextState = null;
    let _arrHasLoggedNoNextSong = false; // جلوگیری از تکرار لاگ "No more songs"
    let _arrPrepStartedForIndex = -1;    // جلوگیری از تکرار لاگ "Starting prep"
    let perfModeActive = false;
    let perfStageMode = false;
    let perfPauseMode = false;
    let perfLiveTranspose = 0;

    // Crossfade state
    let _arrCrossfadeGain = null;
    let _arrIsCrossfading = false;

    // ─── Background Preload State ───
    // برای preload همه آهنگ‌های ارنجر در پس‌زمینه
    let _bgPreloadActive = false;
    let _bgPreloadedSongIds = new Set(); // آهنگ‌هایی که preload شد

    // ─── Wait Poll State ───
    // وقتی آهنگ فعلی تموم می‌شه ولی prep آهنگ بعدی هنوز انجام نشده،
    // این فلگ فعال می‌شه و یک poll مستقل از tick، منتظر اتمام prep می‌مونه
    let _arrWaitPollActive = false;

    coreArrangerPreparationRuntime =
      globalScope.CoreArrangerPreparationService?.create?.({
        getArranger: () => arrPerformData || editingArr,
        getCurrentIndex: () => arrPerformIdx,
        isActive: () => arrPerformActive,
        hasLoggedNoNextSong: () => _arrHasLoggedNoNextSong,
        setHasLoggedNoNextSong: value => {
          _arrHasLoggedNoNextSong = value;
        },
        setNextState: value => {
          _arrNextState = value;
        },
        getAllSongs: () => edGetAllSongs(),
        preloadAudioForSong: (...args) => preloadAudioForSong(...args),
        getDAW: () => getEditorDAW(),
        createPlaybackBoundary: config =>
          arrangerPlaybackPolicy?.createBoundary?.(config),
        getArrangerMarkers: song =>
          globalScope.ArrangerMarkerService?.fromSong?.(song),
        getItemSetting: (...args) => getArrItemSetting(...args),
        peaksFromBuffer: (...args) => peaksFromBuffer(...args),
        restoreAudioForProjectSilently: (...args) =>
          restoreAudioForProjectSilently(...args),
        wait: delay => new Promise(resolve => setTimeout(resolve, delay)),
        logger: console
      });
    if (!coreArrangerPreparationRuntime) {
      throw new Error(
        'CoreArrangerPreparationService باید قبل از app/core.js بارگذاری شود.'
      );
    }

    const corePerformanceModeRuntime =
      globalScope.CorePerformanceModeService?.create?.({
        getElement: id => $(id),
        getActiveElement: () => document.activeElement,
        getEditingArr: () => editingArr,
        getPerformanceState: () => ({
          arrPerformData,
          arrPerformIdx,
          arrPerformActive,
          perfModeActive,
          perfStageMode,
          perfPauseMode,
          perfLiveTranspose,
          arrNextState: _arrNextState,
          bgPreloadActive: _bgPreloadActive,
          arrWaitPollActive: _arrWaitPollActive,
          arrPreparePending,
          arrHasLoggedNoNextSong: _arrHasLoggedNoNextSong,
          arrPrepStartedForIndex: _arrPrepStartedForIndex
        }),
        updatePerformanceState: patch => {
          if (Object.prototype.hasOwnProperty.call(patch, 'arrPerformData')) {
            arrPerformData = patch.arrPerformData;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'arrPerformIdx')) {
            arrPerformIdx = patch.arrPerformIdx;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'arrPerformActive')) {
            arrPerformActive = patch.arrPerformActive;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'perfModeActive')) {
            perfModeActive = patch.perfModeActive;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'perfStageMode')) {
            perfStageMode = patch.perfStageMode;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'perfPauseMode')) {
            perfPauseMode = patch.perfPauseMode;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'perfLiveTranspose')) {
            perfLiveTranspose = patch.perfLiveTranspose;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'arrNextState')) {
            _arrNextState = patch.arrNextState;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'bgPreloadActive')) {
            _bgPreloadActive = patch.bgPreloadActive;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'arrWaitPollActive')) {
            _arrWaitPollActive = patch.arrWaitPollActive;
          }
          if (Object.prototype.hasOwnProperty.call(patch, 'arrPreparePending')) {
            arrPreparePending = patch.arrPreparePending;
          }
          if (
            Object.prototype.hasOwnProperty.call(
              patch,
              'arrHasLoggedNoNextSong'
            )
          ) {
            _arrHasLoggedNoNextSong = patch.arrHasLoggedNoNextSong;
          }
          if (
            Object.prototype.hasOwnProperty.call(
              patch,
              'arrPrepStartedForIndex'
            )
          ) {
            _arrPrepStartedForIndex = patch.arrPrepStartedForIndex;
          }
        },
        getDAW: () => getEditorDAW(),
        getArrangerMarkers: () => getArrangerMarkers(),
        ensureArrItem: (...args) => ensureArrItem(...args),
        loadArrSong: (...args) => loadArrSong(...args),
        renderPerfUI: (...args) => renderPerfUI(...args),
        renderPerformancePanel: (...args) => renderPerfUI(...args),
        startBackgroundPreload: (...args) =>
          _startBackgroundPreload(...args),
        closeArrangerModal: (...args) => closeArrangerModal(...args),
        openLyricOnlyPopup: (...args) =>
          openLyricOnlyPopup(...args),
        openLyricPopup: (...args) => openLyricPopup(...args),
        pauseTransport: (...args) => pauseTransport(...args),
        startTransport: (...args) => startTransport(...args),
        seekTransport: (...args) => seekTransport(...args),
        ensureAudioCtx: (...args) => ensureAudioCtx(...args),
        scheduleAllFromPlayhead: (...args) =>
          scheduleAllFromPlayhead(...args),
        saveArrangers: (...args) => saveArrangers(...args),
        getSongState: () => requireEditorSongStateService(),
        saveSong: (...args) => edSaveSong(...args),
        handleTimingChange: (...args) => handleTimingChange(...args),
        startPointerDrag: (...args) =>
          startEditorPointerDrag(...args),
        clamp: (...args) => clamp(...args),
        translate: key => t(key),
        toast: message => toast(message),
        schedule: (...args) => setTimeout(...args),
        setIntervalRef: (...args) => setInterval(...args),
        clearIntervalRef: (...args) => clearInterval(...args),
        now: () => Date.now(),
        logger: console
      });
    if (!corePerformanceModeRuntime) {
      throw new Error(
        'CorePerformanceModeService باید قبل از app/core.js بارگذاری شود.'
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
      startArrangerPerform
    } = corePerformanceModeRuntime;
    Object.assign(globalScope, corePerformanceModeRuntime);
    corePublicApi.publish(corePerformanceModeRuntime);

    coreArrangerBackgroundPreloadRuntime =
      globalScope.CoreArrangerBackgroundPreloadService?.create?.({
        getArranger: () => arrPerformData,
        getActive: () => _bgPreloadActive,
        setActive: value => {
          _bgPreloadActive = value;
        },
        getPreloadedIds: () => _bgPreloadedSongIds,
        setPreloadedIds: value => {
          _bgPreloadedSongIds = value;
        },
        getAllSongs: () => edGetAllSongs(),
        getDAW: () => getEditorDAW(),
        preloadAudioForSong: (...args) => preloadAudioForSong(...args),
        wait: delay => new Promise(resolve => setTimeout(resolve, delay)),
        logger: console
      });
    if (!coreArrangerBackgroundPreloadRuntime) {
      throw new Error(
        'CoreArrangerBackgroundPreloadService باید قبل از app/core.js بارگذاری شود.'
      );
    }

    corePerformanceUiRuntime =
      globalScope.CorePerformanceUiService?.create?.({
        documentRef: document,
        getElement: id => $(id),
        getPerformanceState: () => ({
          perfModeActive,
          arrPerformData,
          arrPerformIdx
        }),
        getAllSongs: () => edGetAllSongs(),
        getItemSetting: (...args) => getArrItemSetting(...args),
        getCurrentSong: () => requireEditorSongStateService().currentSong(),
        getDAW: () => getEditorDAW(),
        getArrangerEnd: () => getArrangerEnd(),
        jumpToSong: index => perfJumpToSong(index),
        saveArrangers: (...args) => saveArrangers(...args),
        seekTransport: (...args) => seekTransport(...args),
        ensureAudioCtx: (...args) => ensureAudioCtx(...args),
        startTransport: (...args) => startTransport(...args)
      });
    if (!corePerformanceUiRuntime) {
      throw new Error(
        'CorePerformanceUiService باید قبل از app/core.js بارگذاری شود.'
      );
    }

    /**
     * _startBackgroundPreload — preload تمام آهنگ‌های ارنجر در پس‌زمینه
     *
     * این تابع بلافاصله بعد از openPerfMode صدا زده می‌شه و تمام آهنگ‌های
     * ست‌لیست رو به‌صورت یکی‌یکی preload می‌کنه. این کار تضمین می‌کنه که
     * وقتی به آهنگ بعدی می‌رسیم، بافر صوتی از قبل در getEditorDAW().bufferCache هست.
     *
     * مهم: این تابع غیرمسدودکننده هست و نباید پخش فعلی رو مختل کنه.
     */
    function _startBackgroundPreload() {
      return coreArrangerBackgroundPreloadRuntime?.start?.();
    }

    // Render performance mode UI
    function renderPerfUI(...args) {
      return corePerformanceUiRuntime?.render?.(...args);
    }

    // Pre-build the next song's full DAW state while current plays.
    async function prepareNextArrSong(...args) {
      return coreArrangerPreparationRuntime?.prepare?.(...args);
    }

    // Crossfade between songs — نسخه بهبودیافته با overlap واقعی
    //
    // استراتژی:
    //   1. صدای آهنگ فعلی رو از طریق masterGain fade-out می‌کنیم
    //   2. همزمان hot-swap می‌کنیم و آهنگ جدید رو schedule می‌کنیم
    //   3. masterGain رو fade-in می‌کنیم
    //
    // این روش یک "gapless crossfade" ایجاد می‌کنه: در طول fadeTime،
    // صدای قدیمی fade-out و صدای جدید fade-in می‌شه. در نقطه میانی،
    // هر دو آهنگ در حال پخش هستن (overlap).
    function arrCrossfadeSwap() {
      const crossfadeDur = arrPerformData?.crossfade || 0;
      if (crossfadeDur <= 0 || !_arrNextState) { hotSwapToNextSong(); return; }

      _arrIsCrossfading = true;
      ensureAudioCtx();
      const ctx = getEditorDAW().audioCtx;
      const curGain = getEditorDAW().masterGain;
      const now = ctx.currentTime;
      const fadeTime = Math.min(Math.max(crossfadeDur, 0.5), 5); // بین 0.5 تا 5 ثانیه

      console.log(`[Arranger Crossfade] Starting ${fadeTime}s crossfade`);

      // ─── مرحله 1: fade-out صدای فعلی ───
      const currentVolume = curGain.gain.value;
      curGain.gain.cancelScheduledValues(now);
      curGain.gain.setValueAtTime(currentVolume, now);
      curGain.gain.linearRampToValueAtTime(0, now + fadeTime * 0.5);

      // ─── مرحله 2: در نیمه راه، hot-swap کن ───
      // در این نقطه، masterGain صفر هست، پس swap بی‌صدا انجام می‌شه
      setTimeout(() => {
        try {
          // قبل از swap، صدای فعلی رو کامل قطع کن
          stopAllVoices();

          // hot-swap به آهنگ جدید
          hotSwapToNextSong();

          // حالا masterGain رو از 0 به 1 fade-in کن
          const fadeInNow = ctx.currentTime;
          curGain.gain.cancelScheduledValues(fadeInNow);
          curGain.gain.setValueAtTime(0, fadeInNow);
          curGain.gain.linearRampToValueAtTime(currentVolume, fadeInNow + fadeTime * 0.5);

          console.log('[Arranger Crossfade] Fade-in started');
        } catch(e) {
          console.error('[Arranger Crossfade] Error during swap:', e);
        } finally {
          _arrIsCrossfading = false;
        }
      }, fadeTime * 500); // نصف fadeTime به میلی‌ثانیه
    }
