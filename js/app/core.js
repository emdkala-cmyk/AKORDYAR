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

function requireChordLineSyncService() {
  if (typeof window.ChordLineSyncService !== 'object' || !window.ChordLineSyncService) {
    throw new Error('ChordLineSyncService در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.');
  }
  return window.ChordLineSyncService;
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

    function renderClips(options = {}) {
      const preserveWaveforms = options.preserveWaveforms === true;
      document.querySelectorAll('.clip').forEach(el => el.remove());
      // Render audio & chord clips
      getEditorDAW().clips.forEach(clip => {
        const lane = document.querySelector(`.track-lane[data-track-id="${clip.trackId}"]`); if (!lane) return;
        const hint = lane.querySelector('.empty-lane-hint'); if (hint) hint.remove();
        if (clip.type !== 'chord' && (!preserveWaveforms || !clip.waveUrl)) {
          refreshClipWaveImage(clip);
        }
        const el = document.createElement('div');
        el.className = 'clip' + (clip.type === 'chord' ? ' chord-clip' : '') + (getEditorDAW().selectedIds.has(clip.id) ? ' selected' : '');
        el.dataset.clipId = clip.id; el.style.left = timeToX(clip.start) + 'px'; el.style.width = Math.max(30, timeToX(clip.duration)) + 'px';
        if (clip.type !== 'chord') {
          el.style.background = `linear-gradient(180deg, ${clip.color}bb, ${clip.color}88)`;
          el.innerHTML = `<img class="clip-wave" alt="" draggable="false" ${clip.waveUrl ? `src="${clip.waveUrl}"` : ''}><div class="clip-title">${clip.name}</div><div class="resize-handle left" data-edge="left"></div><div class="resize-handle right" data-edge="right"></div>`;
          // Mouseover event to show file path in storageInfoBar
          el.addEventListener('mouseenter', (e) => {
            const filePath = getClipFilePath(clip);
            if (filePath) {
              const storageBar = document.getElementById('storageInfoBar');
              const storageText = document.getElementById('storageText');
              if (storageBar && storageText) {
                storageBar.style.display = 'block';
                storageText.textContent = filePath;
                storageText.title = filePath;
              }
            }
          });
          el.addEventListener('mouseleave', () => {
            const storageBar = document.getElementById('storageInfoBar');
            const storageText = document.getElementById('storageText');
            if (storageBar && storageText) {
              storageBar.style.display = 'none';
              storageText.textContent = '';
            }
          });
        } else {
          const chordColor = clip.color || '#9F7AEA';
          el.style.background = `linear-gradient(180deg, ${chordColor}cc, ${chordColor}77)`;
          el.style.borderColor = chordColor;
          el.innerHTML = `<span>${clip.name}</span><div class="resize-handle left" data-edge="left"></div><div class="resize-handle right" data-edge="right"></div>`;
          // Keep chord editing reliable even when the first click causes a
          // clip re-render. The delegated/native double-click path complements
          // the pointer timing fallback in onClipMouseDown.
          el.addEventListener('dblclick', event => {
            event.preventDefault();
            event.stopPropagation();
            openTimelineChordEditor(clip.id);
          });
        }
        el.addEventListener(
          'pointerdown',
          event => coreClipInteractionRuntime.onClipMouseDown(event)
        );
        lane.appendChild(el);
      });
      getTimelineSectionRendererService()?.renderSections?.();
    }

    function updateHud() { $('clip-count').textContent = String(getEditorDAW().clips.length + (getEditorDAW().sections || []).length); }

    // ===== ICON PICKER =====
    const ICON_SVG_MAP = {
      '🎤': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
      '🎸': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 2l-2 2c-1.5 1.5-4 1.5-5.5 0L11 6l-2-2c-1.5-1.5-4-1.5-5.5 0L2 4V20l2-2c1.5 1.5 4 1.5 5.5 0l1.5-1.5 2 2c1.5 1.5 4 1.5 5.5 0l2-2V2z"/><line x1="7" y1="11" x2="13" y2="17"/><line x1="11" y1="7" x2="17" y2="13"/></svg>',
      '🎹': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="6" y1="2" x2="6" y2="14"/><line x1="10" y1="2" x2="10" y2="14"/><line x1="14" y1="2" x2="14" y2="14"/><line x1="18" y1="2" x2="18" y2="14"/><rect x="4" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="8" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="12" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="16" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/></svg>',
      '🎺': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8m0 0l4 4m-4-4l-4 4"/><circle cx="12" cy="18" r="4"/><path d="M8 22h8"/></svg>',
      '🎻': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6m6-6v6"/><ellipse cx="12" cy="16" rx="6" ry="8"/><line x1="12" y1="8" x2="12" y2="24"/></svg>',
      '🥁': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="6"/><line x1="4" y1="6" x2="4" y2="18"/><line x1="20" y1="6" x2="20" y2="18"/><path d="M8 2l4 4m4-4l-4 4"/></svg>',
      '🎷': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l2 6-4 4"/><path d="M18 2l-2 6 4 4"/><path d="M12 8v14"/><circle cx="12" cy="22" r="2"/></svg>',
      '🎵': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
      '🎶': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 9l12-2"/></svg>',
      '🎼': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="9" y1="9" x2="21" y2="7"/></svg>',
      '🎙️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/><circle cx="12" cy="1" r="1" fill="currentColor"/></svg>',
      '🎧': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
      '📡': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/><circle cx="12" cy="12" r="2"/></svg>',
      '🎛️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
      '⏺': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>',
      '♫': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
      '🏷': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    };
    if (typeof IconRegistry !== 'undefined') { Object.assign(ICON_SVG_MAP, IconRegistry.getAll()); }
    function getIconSvg(icon) { return ICON_SVG_MAP[icon] || icon; }

    const INSTRUMENT_ICONS = ['🎤','🎸','🎹','🎺','🎻','🥁','🎷','🎵','🎶','🎼','🎙️','🎧','📡','🎛️','⏺','♫','🏷'];

    let _iconPickerTrack = null;

    function openIconPicker(track) {
      _iconPickerTrack = track;
      const grid = $('iconPickerGrid');
      grid.innerHTML = '';
      INSTRUMENT_ICONS.forEach(icon => {
        const item = document.createElement('div');
        item.className = 'icon-picker-item' + (icon === track.icon ? ' active' : '');
        item.innerHTML = getIconSvg(icon);
        item.onclick = () => {
          track.icon = icon;
          $('iconPickerOverlay').classList.remove('show');
          _iconPickerTrack = null;
          saveState(); renderAll();
        };
        grid.appendChild(item);
      });
      $('iconPickerOverlay').classList.add('show');
    }

    // Close icon picker on overlay click
    if ($('iconPickerOverlay')) {
      $('iconPickerOverlay').addEventListener('click', (e) => {
        if (e.target === $('iconPickerOverlay')) {
          $('iconPickerOverlay').classList.remove('show');
          _iconPickerTrack = null;
        }
      });
    }

    function addNewTrack(name, icon) {
      const n = getEditorDAW().tracks.length + 1; ensureAudioCtx();
      const newT = { id: uid('t'), name: name || `Line ${n}`, icon: icon || '🎛️', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0, locked: false };
      newT._pannerNode = getEditorDAW().audioCtx.createStereoPanner(); newT._gainNode = getEditorDAW().audioCtx.createGain();
      newT._pannerNode.connect(newT._gainNode); newT._gainNode.connect(getEditorDAW().masterGain); getEditorDAW().tracks.push(newT);
      saveState(); renderAll(); toast(t('newTrackAdded'));
    }

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
    const {
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

    function seekTransport(t, keepPlaying = true, noSnap = false) {
      if (isCountInRunning()) cancelCountIn();
      getEditorDAW().playhead = PlayheadMath.clamp(
        noSnap ? t : snapTime(t),
        getProjectEnd()
      );
      if (getEditorDAW().isPlaying) setTransportOrigin(getEditorDAW().playhead);
      updatePlayheadUI();
      if (getEditorDAW().isPlaying && !getEditorDAW().isScrubbing) {
        scheduleAllFromPlayhead();
        if (editorTransportState.metroActive) startMetronome();
      } else {
        stopAllVoices();
      }
      if (typeof publishPlaybackSync === 'function') publishPlaybackSync();
    }

    // Return-to-start on pause (Cubase style)
    let playStartPos = 0;

    function updateReturnToStartButton() {
      const btn = $('returnToStartBtn');
      if (!btn) return;
      btn.classList.toggle('active', editorTransportState.returnToStartOnPause);
      btn.style.background = editorTransportState.returnToStartOnPause ? 'var(--accent-teal)' : '';
      btn.style.color = editorTransportState.returnToStartOnPause ? '#000' : '';
      btn.style.borderColor = editorTransportState.returnToStartOnPause ? 'var(--accent-teal)' : '';
      btn.setAttribute('aria-pressed', String(editorTransportState.returnToStartOnPause));
    }

    function toggleReturnToStart() {
      editorTransportState.returnToStartOnPause = !editorTransportState.returnToStartOnPause;
      updateReturnToStartButton();
      toast(editorTransportState.returnToStartOnPause ? 'برگشت به ابتدا فعال شد' : 'برگشت به ابتدا غیرفعال شد');
    }

    function togglePlay() {
      if (getEditorDAW().isPlaying) {
        if (editorTransportState.returnToStartOnPause) {
          const savedPos = playStartPos;
          pauseTransport();
          seekTransport(savedPos, false);
        } else {
          pauseTransport();
        }
      } else if (isCountInRunning()) {
        pauseTransport();
      } else {
        playStartPos = getEditorDAW().playhead;
        startTransport();
      }
    }

    function startTransport() {
      ensureAudioCtx();
      cancelCountIn();

      const beginPlayback = (transportStartAudioTime = null) => {
        getEditorDAW().isPlaying = true;
        getEditorDAW().isScrubbing = false;
        setTransportOrigin(
          getEditorDAW().playhead,
          transportStartAudioTime
        );
        if (typeof publishPlaybackSync === 'function') publishPlaybackSync();
        $('play-btn').style.color = 'var(--accent-neon-pink)';
        scheduleAllFromPlayhead();

        // Update perf play button
        if (perfModeActive) $('perfPlayBtn').textContent = '⏸';

        // Start the continuous metronome only after count-in completes.
        if (editorTransportState.metroActive && !editorTransportState.metroTimer) startMetronome();
      };

      const tick = (rafTimestamp) => {
        if (!getEditorDAW().isPlaying) return;
        if (!getEditorDAW().isScrubbing) getEditorDAW().playhead = getTransportPlayhead();

        // Loop A-B: if playhead reaches B, jump back to A (math delegated to PlayheadMath)
        if (getEditorDAW().loopEnabled && !arrPerformActive && !getEditorDAW().isRecording && getEditorDAW().playhead >= getEditorDAW().loopB) {
          var looped = PlayheadMath.applyLoop(getEditorDAW().playhead, getEditorDAW().loopEnabled, getEditorDAW().loopA, getEditorDAW().loopB);
          getEditorDAW().playhead = looped.playhead;
          setTransportOrigin(getEditorDAW().playhead);
          scheduleAllFromPlayhead({
            preserveVoices: true,
            loopOnly: true
          });
        }

        updatePlayheadUI({
          performanceTime: Number.isFinite(rafTimestamp)
            ? rafTimestamp
            : performance.now()
        });
        // Look-ahead scheduler runs independently of RAF. Only fall back to
        // RAF-based beat checking when the scheduler is unavailable.
        if (!getMetronomeSchedulerBridge()) checkMetronomeTick(getEditorDAW().playhead);
        // ─── Early prep: وقتی ۱۵ ثانیه به انتها مونده، شروع به ساختن state آهنگ بعدی کن ───
        // این زمان زیاد هست تا مطمئن بشیم حتی برای فایل‌های بزرگ هم کافیه.
        if (arrPerformActive && !_arrNextState && !arrPreparePending) {
          const end = getArrangerEnd();
          if (end > 0 && getEditorDAW().playhead >= end - 15) {
            // فقط اگر قبلاً برای این ایندکس prep شروع نشده، لاگ بزن
            if (_arrPrepStartedForIndex !== arrPerformIdx + 1) {
              _arrPrepStartedForIndex = arrPerformIdx + 1;
              console.log(`[Arranger] Starting prep at ${getEditorDAW().playhead.toFixed(1)}s (end: ${end.toFixed(1)}s)`);
            }
            arrPreparePending = true;
            prepareNextArrSong()
              .then(() => { arrPreparePending = false; })
              .catch((e) => {
                console.error('[Arranger] Prep failed:', e);
                arrPreparePending = false;
                _arrNextState = null;
              });
          }
        }
        if (getEditorDAW().playhead >= (arrPerformActive ? getArrangerEnd() : getProjectEnd())) {
          // Gapless arranger: hot-swap if next song is ready
          // Guard: اگر در حال کراس‌فید هستیم، صبر کن تا تموم شه
          if (arrPerformActive && _arrNextState && !_arrIsCrossfading) {
            const crossfadeDur = arrPerformData?.crossfade || 0;
            if (crossfadeDur > 0) arrCrossfadeSwap();
            else hotSwapToNextSong();
            getEditorDAW().rafId = requestAnimationFrame(tick); return;
          }
          // اگر کراس‌فید در حال اجراست، به تیک بعدی منتقل شو
          if (_arrIsCrossfading) {
            getEditorDAW().rafId = requestAnimationFrame(tick); return;
          }
          // ─── اگر _arrNextState آماده نیست ولی prep در حال اجراست: صبر کن (وارد حالت pause شو) ───
          // به‌جای stop، playback رو pause می‌کنیم تا وقتی prep تموم شد، ادامه بدیم
          if (arrPerformActive && !_arrNextState && arrPreparePending) {
            console.log('[Arranger] Reached end but prep still running. Entering wait mode...');
            // playback رو متوقف کن ولی transport رو stop نکن
            stopAllVoices();
            getEditorDAW().isPlaying = false;
            // ─── مکانیزم poll مستقل از tick ───
            // چون tick با getEditorDAW().isPlaying=false متوقف می‌شه، یک poll جداگانه می‌سازیم
            // که وقتی prep تموم شد، hot-swap رو انجام بده
            if (!_arrWaitPollActive) {
              _arrWaitPollActive = true;
              const waitPoll = () => {
                if (!arrPerformActive) { _arrWaitPollActive = false; return; }
                if (_arrNextState) {
                  console.log('[Arranger] Prep finished during wait — hot-swapping now');
                  _arrWaitPollActive = false;
                  if (arrPerformData?.crossfade > 0) arrCrossfadeSwap();
                  else hotSwapToNextSong();
                } else if (!arrPreparePending) {
                  // prep تموم شده ولی _arrNextState هنوز null — fallback
                  console.warn('[Arranger] Prep finished but no next state — fallback to loadArrSong');
                  _arrWaitPollActive = false;
                  arrPreparePending = true;
                  loadArrSong(arrPerformIdx + 1)
                    .then(() => { arrPreparePending = false; })
                    .catch((e) => { console.error(e); arrPreparePending = false; });
                } else {
                  // هنوز صبر کن
                  setTimeout(waitPoll, 100);
                }
              };
              setTimeout(waitPoll, 100);
            }
            return;
          }
          // ─── اگر نه prep در حال اجراست و نه _arrNextState آماده‌ست: fallback به loadArrSong ───
          if (arrPerformActive && !_arrNextState && !arrPreparePending) {
            console.warn('[Arranger] Next song not ready and no prep running — fallback to loadArrSong');
            arrPreparePending = true;
            loadArrSong(arrPerformIdx + 1)
              .then(() => { arrPreparePending = false; })
              .catch((e) => {
                console.error('[Arranger] Fallback loadArrSong failed:', e);
                arrPreparePending = false;
              });
            return;
          }
          stopTransport(); return;
        }
        // Update sync highlight during playback (works for both sync mode and popup)
        if (syncActive) updateSyncHighlight();
        else if (isPopupOpen(_lyricPopup)) updateSyncHighlight();
        getEditorDAW().rafId = requestAnimationFrame(tick);
      };

      // Count-in runs before project playback and is independent from the metronome.
      if (editorTransportState.countInBars > 0 && countInSchedulerBridge) {
        const bpm = parseInt($('edTempo')?.value) || 120;
        const sig = $('edTimeSig')?.value || '4/4';
        const config = getTimeSignatureGridConfig(sig, bpm);
        // Count-in always starts from a downbeat.
        alignPlayheadToNearestMeasure(config);
        getEditorDAW().isPlaying = false;
        getEditorDAW().isScrubbing = false;
        if (getEditorDAW().rafId) {
          cancelAnimationFrame(getEditorDAW().rafId);
          getEditorDAW().rafId = null;
        }
        stopAllVoices();
        if (editorTransportState.metroTimer) stopMetronome();
        $('play-btn').style.color = 'var(--accent-cyan-glow)';
        toast('🔢 شمارش: ' + editorTransportState.countInBars + ' میزان');
        const scheduledCountIn = countInSchedulerBridge.start({
          bars: editorTransportState.countInBars,
          bpm,
          timeSignature: sig,
          soundType: getAppSettings().metroSound || 'classic',
          onComplete: ({ endTime }) => {
            beginPlayback(endTime);
            if (getEditorDAW().rafId) cancelAnimationFrame(getEditorDAW().rafId);
            getEditorDAW().rafId = requestAnimationFrame(tick);
          }
        });
        if (scheduledCountIn) return;

        toast('مترونوم در دسترس نیست؛ پخش بدون کانتین شروع شد');
      }

      beginPlayback();
      if (getEditorDAW().rafId) cancelAnimationFrame(getEditorDAW().rafId);
      getEditorDAW().rafId = requestAnimationFrame(tick);
    }

    function pauseTransport() {
      cancelCountIn();
      if (getEditorDAW().isRecording) recordingRuntime?.endRec?.();
      if (getEditorDAW().isPlaying && !getEditorDAW().isScrubbing) {
        getEditorDAW().playhead = getTransportPlayhead();
      }
      getEditorDAW().isPlaying = false; getEditorDAW().isScrubbing = false; if (getEditorDAW().rafId) cancelAnimationFrame(getEditorDAW().rafId); getEditorDAW().rafId = null; stopAllVoices(); $('play-btn').style.color = 'var(--accent-cyan-glow)'; updatePlayheadUI();
      getEditorDAW().playOriginAudio = null;
      audioContextServiceBridge?.stopAll?.();

      // Auto-stop metronome
      if (editorTransportState.metroTimer) stopMetronome();

      // Clear sync highlights in editor
      const editorEl = $('editor');
      if (editorEl) [...editorEl.children].forEach(el => { el.classList.remove('sync-playing', 'sync-done'); });

      // Update perf play button
      if (perfModeActive) $('perfPlayBtn').textContent = '▶';
      if (typeof publishPlaybackSync === 'function') publishPlaybackSync();
    }
    function stopTransport() { pauseTransport(); getEditorDAW().playhead = 0; updatePlayheadUI();
      if (typeof publishPlaybackSync === 'function') publishPlaybackSync();
      // Auto-advance arranger when song finishes
      if (arrPerformActive && arrPerformData) {
        // If pause mode, don't auto-advance
        if (perfPauseMode && perfModeActive) {
          if (perfModeActive) renderPerfUI();
          return;
        }
        loadArrSong(arrPerformIdx + 1);
      }
      // Update perf UI play button
      if (perfModeActive) { $('perfPlayBtn').textContent = '▶'; renderPerfUI(); }
    }
    // SyncHub uses these explicit hooks for timeline controls requested by the
    // phone Player View. The registry keeps the legacy aliases intact.
    corePublicApi.publish({
      startTransport,
      pauseTransport,
      stopTransport,
      seekTransport
    });
    // Arranger end: B is the transition point for the current song.
    // If a legacy song has no valid B, fall back to its timeline end.
    function getArrangerEnd() {
      if (arrPerformActive && selectionEnd > 0) return selectionEnd;
      if (arrPerformActive && arrangerPlaybackPolicy?.getTimelineEnd) {
        const contentEnd = arrangerPlaybackPolicy.getTimelineEnd({
          clips: getEditorDAW().clips,
          sections: getEditorDAW().sections
        });
        if (contentEnd > 0) return contentEnd;
      }
      if (selectionEnd > 0) return selectionEnd;
      // Fallback: end of last clip/section in current project
      let end = 0;
      getEditorDAW().clips.forEach(c => end = Math.max(end, c.start + c.duration));
      getEditorDAW().sections.forEach(s => end = Math.max(end, s.start + s.duration));
      return end > 0 ? end : getProjectEnd();
    }
    function transportToStart() { seekTransport(0); }
    function transportToEnd() { let end = 0; getEditorDAW().clips.forEach(c => end = Math.max(end, c.start + c.duration)); seekTransport(end); }

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
    function syncChordLineFromLyrics() {
      const songState = requireEditorSongStateService();
      const song = songState.currentSong();
      if (!song) { toast('سندی برای سینک وجود ندارد'); return; }
      
          // 1. Extract chords from the current song (parsed from lyrics)
      const lyricsChords = songState.getChords(song);
      
      // If no chords in Lyrics
      if (lyricsChords.length === 0) { 
        toast('هیچ آکوردی در Lyrics Chord وجود ندارد.');
        return; 
      }
      
      // 2. Sort chords by spatial position from right to left (RTL reading order)
      // منطق مرتب‌سازی به js/editor/ChordLineSyncService.js منتقل شده است.
      const lyricsChordsInSyncOrder = requireChordLineSyncService().sortLyricsChordsForSync(lyricsChords);
      
      // 3. Get current Chord Line clips from getEditorDAW().clips (the actual source of truth)
      const chordTrack = getEditorDAW().tracks.find(t => t.type === 'chord');
      let currentChordLineClips = [];
      
      if (chordTrack) {
        // Get all chord clips sorted by start time (left to right on timeline)
        currentChordLineClips = getEditorDAW().clips
          .filter(c => c.type === 'chord' && c.trackId === chordTrack.id)
          .sort((a, b) => a.start - b.start);
      }
      
      // If Chord Line is empty
      if (currentChordLineClips.length === 0) {
        toast('برای همگام‌سازی، ابتدا حداقل یک آکورد در Chord Line ایجاد کنید.');
        return;
      }
      
      // 4. Apply Lyrics chords to Chord Line from left to right
      // Only update the .name property of existing clips
      // منطق اعمال به js/editor/ChordLineSyncService.js منتقل شده است.
      const appliedCount = requireChordLineSyncService().applyChordNamesToClips(lyricsChordsInSyncOrder, currentChordLineClips);
      
      // 5. Update state and re-render
      songState.markChordLineSynced(song);
      
      // Re-render Chord Line popup if open
      if (isPopupOpen(_chordLinePopup)) {
        syncChordLinePopup();
      }
      
      // Save state to persist changes
      saveState();
      
      // Re-render timeline to show updated chord clips
      renderAll();
      
      // Show result message
      if (lyricsChordsInSyncOrder.length > currentChordLineClips.length) {
        toast(`فقط ${appliedCount} آکورد اول Lyrics روی ${currentChordLineClips.length} آکورد موجود در Chord Line اعمال شد.`);
      } else {
        toast(`✔ Chord Line با موفقیت از Lyrics Chord همگام شد (${appliedCount} آکورد).`);
      }
    }
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
    let _lyricOnlyMessageCleanup = null;
    let _chordLineMessageCleanup = null;
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
    function syncLyricOnlyPopup() {
      if (!isPopupOpen(_lyricOnlyPopup)) return;
      const snapshot = requireEditorSongStateService().getPresentationSnapshot();
      if (!snapshot) return;
      const doc = popupDocument(_lyricOnlyPopup);
      if (!doc) return;
      const { title, artist, lyrics, styles } = snapshot;
      const { tSize, tColor, tFont, tBold, align } = styles;
      const lines = lyrics.split('\n');

      doc.title = title + ' — ' + artist + ' | خواننده';
      doc.documentElement.dir = 'rtl';
      doc.documentElement.lang = 'fa';
      doc.head.innerHTML = `
        <style>
          @font-face { font-family: 'Vazirmatn'; src: url('../fonts/Vazirmatn-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'Vazirmatn Bold'; src: url('../fonts/Vazirmatn-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Thin'; src: url('../fonts/Vazirmatn-Thin.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Black'; src: url('../fonts/Vazirmatn-Black.woff2') format('woff2'); }
          @font-face { font-family: 'BArshia'; src: url('../fonts/BArshia.woff2') format('woff2'); }
          @font-face { font-family: 'BFarnaz'; src: url('../fonts/BFarnaz.woff2') format('woff2'); }
          @font-face { font-family: 'BJadid'; src: url('../fonts/BJadidBd.woff2') format('woff2'); }
          @font-face { font-family: 'BZar'; src: url('../fonts/BZar.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'BZar Bold'; src: url('../fonts/BZarBd.woff2') format('woff2'); }
          @font-face { font-family: 'Lalezar'; src: url('../fonts/Lalezar-Regular.woff2') format('woff2'); }
          @font-face { font-family: 'Mada'; src: url('../fonts/Mada-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Rubik'; src: url('../fonts/Rubik-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'JetBrains Mono'; src: url('../fonts/JetBrainsMono-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'JetBrains Mono Bold'; src: url('../fonts/JetBrainsMono-Bold.woff2') format('woff2'); }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0F131E; color: #E2E8F0; font-family: 'Vazirmatn', sans-serif; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
          .lop-header { text-align: center; padding: 8px 12px 4px; background: linear-gradient(180deg, #1C2333, #161B26); border-bottom: 1px solid #232B3E; }
          .lop-header .title { font-size: 15px; font-weight: 900; color: #00F2FE; }
          .lop-header .sub { font-size: 10px; color: #718096; }
          .lop-body { flex: 1; overflow: auto; padding: 16px 20px; position: relative; line-height: 2.4; }
          .lop-body { flex: 1; overflow-y: auto; padding: 16px; }
          .eline { min-height: 1.2em; white-space: pre-wrap; }
          .lop-active { color: #FF2E93 !important; text-shadow: 0 0 8px rgba(255,46,147,0.5); }
          .lop-active-bg { background: rgba(255,46,147,0.08); border-radius: 6px; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #1A202C; }
          ::-webkit-scrollbar-thumb { background: #4A5568; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #718096; }
        </style>`;
      let html = `<div class="lop-header"><div class="title">${title}</div><div class="sub">${artist}</div></div><div class="lop-body" id="lopBody">`;
      lines.forEach((line, i) => {
        html += `<div class="eline" data-li="${i}" style="font-size:${tSize}px;color:${tColor};font-family:'${tFont}';font-weight:${tBold};text-align:${align};">${line || '\u200B'}</div>`;
      });
      html += '</div>';
      doc.body.innerHTML = html;
      doc.body.setAttribute('data-popup-role', 'singer');

      // Sync playhead highlight
      _lyricOnlyMessageCleanup?.();
      _lyricOnlyMessageCleanup = popupWindowBridge?.onMessage?.({
        windowRef: window,
        getSource: () => _lyricOnlyPopup,
        type: 'syncUpdate',
        handler: ev => {
          if (!isPopupOpen(_lyricOnlyPopup)) {
            _lyricOnlyMessageCleanup?.();
            _lyricOnlyMessageCleanup = null;
            return;
          }
          const body = popupDocument(_lyricOnlyPopup)?.getElementById('lopBody');
          if (!body) return;
          const activeIdx = ev.data.activeIdx;
          [...body.children].forEach(el => {
            if (!el.dataset.li) return;
            const li = +el.dataset.li;
            el.classList.toggle('lop-active', li === activeIdx);
            el.classList.toggle('lop-active-bg', li === activeIdx);
          });
          if (activeIdx >= 0) {
            const activeEl = body.querySelector('[data-li="' + activeIdx + '"]');
            if (activeEl) {
              const bodyH = body.clientHeight;
              const elTop = activeEl.offsetTop;
              const elH = activeEl.offsetHeight;
              body.scrollTo({ top: elTop - bodyH / 2 + elH / 2, behavior: 'smooth' });
            }
          }
        }
      }) || null;
      // Direct highlight sync (same pattern as lyricPopup)
      function _syncSingerHighlight() {
        if (!isPopupOpen(_lyricOnlyPopup)) return;
        const body = popupDocument(_lyricOnlyPopup)?.getElementById('lopBody');
        if (!body) return;
        const times = requireEditorSongStateService().getSyncTimes();
        const daw = getEditorDAW();
        const t = daw?.isPlaying
          ? getTransportPlayhead()
          : (Number.isFinite(daw?.playhead) ? daw.playhead : 0);
        let activeIdx = -1;
        for (let i = 0; i < times.length; i++) {
          if (Number.isFinite(times[i]) && times[i] <= t) activeIdx = i;
          else if (Number.isFinite(times[i]) && times[i] > t) break;
        }
        [...body.children].forEach(el => {
          if (!el.dataset.li) return;
          const li = +el.dataset.li;
          el.classList.toggle('lop-active', li === activeIdx);
          el.classList.toggle('lop-active-bg', li === activeIdx);
        });
        if (activeIdx >= 0) {
          const activeEl = body.querySelector('[data-li="' + activeIdx + '"]');
          if (activeEl) {
            const bodyH = body.clientHeight;
            body.scrollTo({ top: activeEl.offsetTop - bodyH / 2 + activeEl.offsetHeight / 2, behavior: 'smooth' });
          }
        }
      }
      popupWindowBridge?.set?.(_lyricOnlyPopup, '_syncHighlight', _syncSingerHighlight);
      installPopupHighlightLoop(_lyricOnlyPopup, doc);
    }

    // ===== CHORD LINE POPUP (detachable, small) =====
    let _chordLinePopup = null;
    function openChordLinePopup() {
      if (isPopupOpen(_chordLinePopup)) { focusPopupWindow(_chordLinePopup); return; }
      _chordLinePopup = openPopupWindow('chordLinePopup', 'width=650,height=400,menubar=no,toolbar=no,location=no,status=no');
      if (!_chordLinePopup) { toast(t('popupBlocked')); return; }
      syncChordLinePopup();
    }
    function syncChordLinePopup() {
      if (!isPopupOpen(_chordLinePopup)) return;
      const snapshot = requireEditorSongStateService().getPresentationSnapshot();
      if (!snapshot) return;
      const doc = popupDocument(_chordLinePopup);
      if (!doc) return;
      const { title, artist, key, keyMode, lyrics, styles } = snapshot;
      const keyStr = key + (keyMode === 'min' ? 'm' : '');
      const { tSize, tColor, tFont, tBold, align, cSize, cColor, cFont } = styles;
      const lines = lyrics.split('\n');
      // Use independent chordLineClips state - this is the source of truth for Chord Line display
      const chordLineClips = snapshot.chordLineClips;
      const transpose = snapshot.transpose;
      // Render chords from chordLineClips with transpose applied
      const chords = chordLineClips.map(ch => ({ 
        lineIndex: ch.lineIndex, 
        charIndex: ch.charIndex, 
        anchorType: ch.anchorType, 
        _name: ch.name ? edTransposeChord(ch.name, transpose) : '' 
      }));

      doc.title = title + ' — ' + artist + ' | Chord Line';
      doc.documentElement.dir = 'rtl';
      doc.documentElement.lang = 'fa';
      doc.head.innerHTML = `
        <style>
          @font-face { font-family: 'Vazirmatn'; src: url('../fonts/Vazirmatn-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'Vazirmatn Bold'; src: url('../fonts/Vazirmatn-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Thin'; src: url('../fonts/Vazirmatn-Thin.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Black'; src: url('../fonts/Vazirmatn-Black.woff2') format('woff2'); }
          @font-face { font-family: 'BArshia'; src: url('../fonts/BArshia.woff2') format('woff2'); }
          @font-face { font-family: 'BFarnaz'; src: url('../fonts/BFarnaz.woff2') format('woff2'); }
          @font-face { font-family: 'BJadid'; src: url('../fonts/BJadidBd.woff2') format('woff2'); }
          @font-face { font-family: 'BZar'; src: url('../fonts/BZar.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'BZar Bold'; src: url('../fonts/BZarBd.woff2') format('woff2'); }
          @font-face { font-family: 'Lalezar'; src: url('../fonts/Lalezar-Regular.woff2') format('woff2'); }
          @font-face { font-family: 'Mada'; src: url('../fonts/Mada-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Rubik'; src: url('../fonts/Rubik-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'JetBrains Mono'; src: url('../fonts/JetBrainsMono-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'JetBrains Mono Bold'; src: url('../fonts/JetBrainsMono-Bold.woff2') format('woff2'); }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0F131E; color: #E2E8F0; font-family: 'Vazirmatn', sans-serif; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
          .clp-header { text-align: center; padding: 8px 12px 4px; background: linear-gradient(180deg, #1C2333, #161B26); border-bottom: 1px solid #232B3E; }
          .clp-header .title { font-size: 15px; font-weight: 900; color: #00F2FE; }
          .clp-header .sub { font-size: 10px; color: #718096; }
          .clp-controls { display: flex; gap: 8px; padding: 8px 12px; background: #161B26; border-bottom: 1px solid #232B3E; align-items: center; justify-content: center; }
          .clp-btn { background: #232B3E; color: #E2E8F0; border: 1px solid #2D3748; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.15s; }
          .clp-btn:hover { background: #2D3748; border-color: #4A5568; }
          .clp-btn:active { transform: translateY(1px); }
          .clp-btn-primary { background: #0fa966; border-color: #0fa966; color: #fff; }
          .clp-btn-primary:hover { background: #0c8a54; }
          .clp-body { flex: 1; overflow: auto; padding: 16px 20px; position: relative; line-height: 2.4; }
          .clp-body { flex: 1; overflow-y: auto; padding: 16px; }
          .eline { min-height: 1.2em; white-space: pre-wrap; }
          .clp-chord { position: absolute; pointer-events: none; font-weight: bold; color: ${cColor}; font-family: '${cFont}', monospace; font-size: ${cSize}px; direction: ltr; white-space: nowrap; z-index: 5; }
          .clp-chord-line { position: absolute; width: 2px; pointer-events: none; opacity: .4; background: ${cColor}; z-index: 4; }
          .clp-active { color: #FF2E93 !important; text-shadow: 0 0 8px rgba(255,46,147,0.5); }
          .clp-active-bg { background: rgba(255,46,147,0.08); border-radius: 6px; }
        </style>`;
      let html = `<div class="clp-header"><div class="title">${title}</div><div class="sub">${artist} · ${keyStr}</div></div>`;
      // Add controls container with Sync and Transpose buttons
      html += `<div class="clp-controls">
        <button class="clp-btn clp-btn-primary" id="clpSyncBtn" title="بروزرسانی Chord Line از Lyrics Chord">🔄 سینک</button>
        <button class="clp-btn" id="clpTransDown" title="بمل">♭</button>
        <span id="clpTransVal" style="color:#718096;font-size:12px;font-weight:600;min-width:24px;text-align:center;display:inline-block;">${transpose > 0 ? '+' : ''}${transpose}</span>
        <button class="clp-btn" id="clpTransUp" title="دیز">♯</button>
        <button class="clp-btn" id="clpCopyBtn" title="کپی آکوردها">✔ کپی</button>
      </div>`;
      html += `<div class="clp-body" id="clpBody">`;
      lines.forEach((line, i) => {
        html += `<div class="eline" data-li="${i}" style="font-size:${tSize}px;color:${tColor};font-family:'${tFont}';font-weight:${tBold};text-align:${align};">${line || '\u200B'}</div>`;
      });
      html += '</div>';
      doc.body.innerHTML = html;

      // Attach event listeners to controls
      const syncBtn = doc.getElementById('clpSyncBtn');
      const transUpBtn = doc.getElementById('clpTransUp');
      const transDownBtn = doc.getElementById('clpTransDown');
      const transValSpan = doc.getElementById('clpTransVal');
      const copyBtn = doc.getElementById('clpCopyBtn');

      // Sync button: copy chords from Lyrics to chordLineClips with spatial ordering
      if (syncBtn) {
        syncBtn.onclick = () => {
          const songState = requireEditorSongStateService();
          const song = songState.currentSong();
          if (!song) return;
          
      // 1. Extract chords from the current song (parsed from lyrics)
          const lyricsChords = songState.getChords(song);
          
          // If no chords in Lyrics
          if (lyricsChords.length === 0) { 
            toast('هیچ آکوردی در Lyrics Chord وجود ندارد.');
            return; 
          }
          
          // 2. Sort chords by spatial position from right to left (RTL reading order)
          // For Persian text: index 0 is on the far right, higher indices go to the left
          // So ascending sort (a.charIndex - b.charIndex) gives us right-to-left order
          const lyricsChordsInSyncOrder = [...lyricsChords].sort((a, b) => {
            if (a.lineIndex !== b.lineIndex) {
              return a.lineIndex - b.lineIndex;
            }
            // Ascending order: smaller charIndex (right side) comes first
            return a.charIndex - b.charIndex;
          });
          
          // 3. Get current Chord Line clips
          const currentChordLineClips = songState.getChordLineClips(song);
          
          // If Chord Line is empty
          if (currentChordLineClips.length === 0) {
            toast('برای همگام‌سازی، ابتدا حداقل یک آکورد در Chord Line ایجاد کنید.');
            return;
          }
          
          // 4. Apply Lyrics chords to Chord Line from left to right
          let appliedCount = Math.min(lyricsChordsInSyncOrder.length, currentChordLineClips.length);
          
          for (let i = 0; i < appliedCount; i++) {
            currentChordLineClips[i].name = lyricsChordsInSyncOrder[i].name;
          }
          
          // 5. Update state and re-render
          songState.setChordLineClips(currentChordLineClips, song);
          songState.markChordLineSynced(song);
          syncChordLinePopup();
          
          // Show result message
          if (lyricsChordsInSyncOrder.length > currentChordLineClips.length) {
            toast(`فقط ${appliedCount} آکورد اول Lyrics روی ${currentChordLineClips.length} آکورد موجود در Chord Line اعمال شد.`);
          } else {
            toast(`✔ Chord Line با موفقیت از Lyrics Chord همگام شد (${appliedCount} آکورد).`);
          }
        };
      }

      // Transpose Up button: only modify chordLineClips
      if (transUpBtn) {
        transUpBtn.onclick = () => {
          const songState = requireEditorSongStateService();
          if (!songState.getChordLineClips().length) return;
          const newTranspose = songState.getTranspose() + 1;
          songState.setTranspose(newTranspose);
          // Update transpose display
          if (transValSpan) transValSpan.textContent = (newTranspose > 0 ? '+' : '') + newTranspose;
          // Re-render chords with new transpose (only affects chordLineClips)
          syncChordLinePopup();
        };
      }

      // Transpose Down button: only modify chordLineClips
      if (transDownBtn) {
        transDownBtn.onclick = () => {
          const songState = requireEditorSongStateService();
          if (!songState.getChordLineClips().length) return;
          const newTranspose = songState.getTranspose() - 1;
          songState.setTranspose(newTranspose);
          // Update transpose display
          if (transValSpan) transValSpan.textContent = (newTranspose > 0 ? '+' : '') + newTranspose;
          // Re-render chords with new transpose (only affects chordLineClips)
          syncChordLinePopup();
        };
      }

      // Copy button: copy chord names to clipboard
      if (copyBtn) {
        copyBtn.onclick = () => {
          const songState = requireEditorSongStateService();
          const chordLineClips = songState.getChordLineClips();
          if (chordLineClips.length === 0) {
            toast('آکوردی برای کپی وجود ندارد');
            return;
          }
          const transpose = songState.getTranspose();
          const chordNames = chordLineClips
            .map(ch => ch.name ? edTransposeChord(ch.name, transpose) : '')
            .filter(n => n);
          if (chordNames.length === 0) {
            toast('آکوردی برای کپی وجود ندارد');
            return;
          }
          const textToCopy = chordNames.join(' ');
          navigator.clipboard.writeText(textToCopy).then(() => {
            toast('✔ ' + chordNames.length + ' آکورد کپی شد');
          }).catch(() => {
            toast('خطا در کپی');
          });
        };
      }

      // Render chords
      const pb = doc.getElementById('clpBody');
      const wrapRect = pb.getBoundingClientRect();
      const GAP = Math.max(10, cSize * 0.6);
      const MARGIN = 5;

      chords.forEach(ch => {
        if (!ch._name) return;
        const lineEl = pb.children[ch.lineIndex];
        if (!lineEl) return;

        const segs = [];
        let total = 0;
        const walker = doc.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          segs.push({ node, start: total, len: node.textContent.length });
          total += node.textContent.length;
        }
        if (!segs.length) return;

        const len = total;
        const r = doc.createRange();
        if (ch.anchorType === 'LineStart') {
          const s = segs[0]; r.setStart(s.node, 0); r.setEnd(s.node, Math.min(1, s.len));
        } else if (ch.anchorType === 'LineEnd') {
          const s = segs[segs.length - 1]; const p = Math.max(0, s.len - 1);
          r.setStart(s.node, p); r.setEnd(s.node, Math.min(p + 1, s.len));
        } else {
          const ci = Math.min(ch.charIndex, Math.max(0, len - 1));
          const s = segs.find(sg => ci >= sg.start && ci < sg.start + sg.len) || segs[segs.length - 1];
          const local = Math.max(0, ci - s.start);
          r.setStart(s.node, Math.min(local, s.len));
          r.setEnd(s.node, Math.min(local + 1, s.len));
        }
        const rect = r.getBoundingClientRect();
        const x = (ch.anchorType === 'LineStart') ? rect.right + MARGIN : (ch.anchorType === 'LineEnd') ? rect.left - MARGIN : (rect.left + rect.right) / 2;
        const top = rect.top - wrapRect.top + pb.scrollTop - cSize - GAP;

        const el = doc.createElement('span');
        el.className = 'clp-chord';
        el.textContent = ch._name;
        el.style.top = top + 'px';
        el.style.left = (x - wrapRect.left - el.offsetWidth / 2) + 'px';
        pb.appendChild(el);

        const ln = doc.createElement('div');
        ln.className = 'clp-chord-line';
        ln.style.left = (x - wrapRect.left) + 'px';
        ln.style.top = (top + cSize) + 'px';
        ln.style.height = Math.max(4, GAP) + 'px';
        pb.appendChild(ln);
      });

      // Sync playhead highlight
      _chordLineMessageCleanup?.();
      _chordLineMessageCleanup = popupWindowBridge?.onMessage?.({
        windowRef: window,
        getSource: () => _chordLinePopup,
        type: 'syncUpdate',
        handler: ev => {
          if (!isPopupOpen(_chordLinePopup)) {
            _chordLineMessageCleanup?.();
            _chordLineMessageCleanup = null;
            return;
          }
          const body = popupDocument(_chordLinePopup)?.getElementById('clpBody');
          if (!body) return;
          [...body.children].forEach(el => {
            if (!el.dataset.li) return;
            const li = +el.dataset.li;
            el.classList.toggle('clp-active', li === ev.data.activeIdx);
            el.classList.toggle('clp-active-bg', li === ev.data.activeIdx);
          });
        }
      }) || null;
    }

    // === Player View persistent settings (survives popup rebuilds) ===
    const _pvSettingsKey = 'achord_player_view_settings';
    const _pvDefaults = { font:'Vazirmatn', tColor:'#0fa966', cColor:'#e6aa28', hlColor:'#FF2E93', bgColor:'#0F131E', tSize:53, cSize:40, scaleLock:true, bold:true };
    let _pvSettings = Object.assign({}, _pvDefaults);
    try { const s = JSON.parse(localStorage.getItem(_pvSettingsKey)); if (s) _pvSettings = Object.assign({}, _pvDefaults, s); } catch(_) {}
    function _pvSave() { try { localStorage.setItem(_pvSettingsKey, JSON.stringify(_pvSettings)); } catch(_) {} }
    // Wheel handlers — re-attached on each syncLyricPopup() call
    const _fontList = [
      'Vazirmatn', 
      'Vazirmatn Thin', 
      'Vazirmatn Bold', 
      'Vazirmatn Black', 
      'BArshia', 
      'BFarnaz', 
      'BJadid', 
      'BZar', 
      'BZar Bold', 
      'Lalezar'
    ];
    
    // Helper to ensure font name is properly quoted for CSS
    function _getFontFamilyCSS(fontName) {
      return "'" + fontName + "', sans-serif";
    }
    function _pvSetupWheelHandlers() {
      if (!isPopupOpen(_lyricPopup)) return;
      const pDoc = popupDocument(_lyricPopup);
      if (!pDoc) return;
      // Remove old handler if exists
      const previousWheelHandler = popupWindowBridge?.get?.(_lyricPopup, '_pvWheelHandler');
      if (previousWheelHandler) {
        pDoc.removeEventListener('wheel', previousWheelHandler);
      }
      // Create new handler
      const handler = (e) => {
        if (!isPopupOpen(_lyricPopup)) return;
        const target = e.target;
        // Ctrl+Wheel anywhere → lyric size
        if (e.ctrlKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 1 : -1;
          _pvSettings.tSize = Math.max(12, Math.min(55, _pvSettings.tSize + delta));
          if (_pvSettings.scaleLock) {
            _pvSettings.cSize = Math.max(8, Math.min(40, Math.round(_pvSettings.tSize * 0.7)));
          }
          _pvSave(); _pvApply();
          return;
        }
        // Plain wheel on chord → chord size
        if (target && target.classList && target.classList.contains('p-chord')) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 1 : -1;
          _pvSettings.cSize = Math.max(8, Math.min(40, _pvSettings.cSize + delta));
          if (_pvSettings.scaleLock) {
            _pvSettings.tSize = Math.max(12, Math.min(55, Math.round(_pvSettings.cSize / 0.7)));
          }
          _pvSave(); _pvApply();
          return;
        }
        // Wheel on font selector → cycle fonts
        if (target && target.id === 'pv-font') {
          e.preventDefault();
          let idx = _fontList.indexOf(_pvSettings.font);
          idx = e.deltaY < 0 ? (idx - 1 + _fontList.length) % _fontList.length : (idx + 1) % _fontList.length;
          _pvSettings.font = _fontList[idx];
          target.value = _pvSettings.font;
          _pvSave(); _pvApply();
          return;
        }
      };
      popupWindowBridge?.set?.(_lyricPopup, '_pvWheelHandler', handler);
      pDoc.addEventListener('wheel', handler, { passive: false });
    }

    function syncLyricPopup() {
      if (!isPopupOpen(_lyricPopup)) return;
      const popupDoc = popupDocument(_lyricPopup);
      if (!popupDoc) return;
      // If popup already has chord script, update in-place (no full rebuild)
      const _existingScript = popupDoc.querySelector('script[data-pv="chord"]');
      if (_existingScript) {
        const doc = popupDoc;
        const pb = doc.getElementById('popupBody');
        if (!pb) return;

        const snapshot = requireEditorSongStateService().getPresentationSnapshot();
        if (!snapshot) return;
        const lines = snapshot.lyrics.split('\n');
        const transpose = snapshot.transpose;
        const chords = snapshot.chords.map(ch => ({
          lineIndex: ch.lineIndex, charIndex: ch.charIndex,
          anchorType: ch.anchorType, _name: edTransposeChord(ch.name, transpose)
        }));
        const { tSize, tColor, tFont, tBold, align } = snapshot.styles;

        // بررسی آیا ساختار خط‌ها واقعاً عوض شده
        const existingLines = Array.from(pb.querySelectorAll('.popup-sync-line'));
        let structureChanged = existingLines.length !== lines.length;
        if (!structureChanged) {
          for (let i = 0; i < lines.length; i++) {
            if (!existingLines[i] || existingLines[i].textContent !== (lines[i] || '\u200B')) {
              structureChanged = true; break;
            }
          }
        }

        if (structureChanged) {
          // فقط وقتی تعداد خط‌ها یا متن عوض شده rebuild کن
          let h = '';
          lines.forEach((line, i) => {
            h += `<div class="eline popup-sync-line" data-li="${i}">${line || '\u200B'}</div>`;
          });
          pb.innerHTML = h;
        }

        // آپدیت text و style خط‌ها روی DOM موجود
        const lineEls = pb.querySelectorAll('.popup-sync-line');
        lineEls.forEach((el, i) => {
          const nextText = lines[i] || '\u200B';
          if (el.textContent !== nextText) el.textContent = nextText;
          el.style.fontSize = tSize + 'px';
          el.style.color = tColor;
          el.style.fontFamily = `'${tFont}', sans-serif`;
          el.style.fontWeight = tBold;
          el.style.textAlign = align;
        });

        // آپدیت chord data و رندر
        try {
          const previousVersion = Number(
            popupWindowBridge?.get?.(_lyricPopup, '_pStructureVersion')
          ) || 0;
          const nextVersion = previousVersion + (structureChanged ? 1 : 0);

          // اگر ساختار عوض شده، کش المان‌های chord قبلی را پاک کن
          if (structureChanged) {
            popupWindowBridge?.clearManagedNodes?.(
              _lyricPopup,
              ['_pChordEls', '_pChordLineEls']
            );
          }
          popupWindowBridge?.set?.(_lyricPopup, '_pChords', chords);
          popupWindowBridge?.set?.(_lyricPopup, '_pStructureVersion', nextVersion);
          const renderReason = structureChanged ? 'structure' : 'data';
          const rendered = popupWindowBridge?.call?.(
            _lyricPopup,
            '_pScheduleChordRender',
            renderReason
          );
          if (!rendered) {
            popupWindowBridge?.call?.(_lyricPopup, '_pRenderChords');
          }

          // Fallback chain: اگر rAF یا layout هنوز آماده نباشد
          if (structureChanged) {
            [120, 300, 600].forEach(function(ms) {
              setTimeout(function() {
                try {
                  if (isPopupOpen(_lyricPopup)) {
                    const scheduled = popupWindowBridge?.call?.(
                      _lyricPopup,
                      '_pScheduleChordRender',
                      'structure'
                    );
                    if (!scheduled) {
                      popupWindowBridge?.call?.(
                        _lyricPopup,
                        '_pRenderChords'
                      );
                    }
                  }
                } catch(_) {}
              }, ms);
            });
          }
        } catch(_) {
          // اگر bridge یا layout موقتاً آماده نبود، بعد از layout دوباره تلاش کن.
          setTimeout(function() {
            try {
              if (isPopupOpen(_lyricPopup)) {
                popupWindowBridge?.call?.(_lyricPopup, '_pRenderChords');
              }
            } catch(_) {}
          }, 250);
        }

        // Re-apply saved settings
        try {
          const s = JSON.parse(localStorage.getItem('${_pvSettingsKey}')) || {};
          lineEls.forEach(el => {
            el.style.fontSize = (s.tSize || tSize) + 'px';
            el.style.color = s.tColor || tColor;
            el.style.fontWeight = s.bold ? 'bold' : tBold;
            el.style.fontFamily = "'" + (s.font || tFont) + "', sans-serif";
          });
          if (s.cSize || s.cColor) {
            const popupConfig = popupWindowBridge?.get?.(_lyricPopup, '_pCfg');
            if (popupConfig && typeof popupConfig === 'object') {
              popupConfig.cSize = s.cSize || 38;
              popupConfig.cColor = s.cColor || '#e6aa28';
              popupWindowBridge?.set?.(_lyricPopup, '_pCfg', popupConfig);
              const scheduled = popupWindowBridge?.call?.(
                _lyricPopup,
                '_pScheduleChordRender',
                'style'
              );
              if (!scheduled) {
                popupWindowBridge?.call?.(_lyricPopup, '_pRenderChords');
              }
            }
          }
        } catch(_) {}
        // Force Reflow: مجبور کردن مرورگر به محاسبه مجدد چیدمان
        try { void pb.offsetHeight; } catch(_) {}
        // Dispatch resize event to force layout recalculation
        popupWindowBridge?.dispatch?.(_lyricPopup, new Event('resize'));
        return;
      }
      const snapshot = requireEditorSongStateService().getPresentationSnapshot();
      if (!snapshot) return;
      const title = snapshot.title || t('untitled');
      const artist = snapshot.artist || '';
      const keyStr = (snapshot.key || 'C') + (snapshot.keyMode === 'min' ? 'm' : '');
      const sub = [artist, keyStr ? (currentLang==='fa'?'گام: ':'Key: ') + keyStr : null].filter(Boolean).join('  ·  ');
      const { tSize, tColor, tFont, tBold, align, cSize, cColor, cFont } = snapshot.styles;
      const transpose = snapshot.transpose;
      const lines = snapshot.lyrics.split('\n');
      const chords = snapshot.chords.map(ch => ({ lineIndex: ch.lineIndex, charIndex: ch.charIndex, anchorType: ch.anchorType, _name: edTransposeChord(ch.name, transpose) }));
      popupDoc.title = title + ' — ' + artist + ' | نوازنده';
      popupDoc.documentElement.dir = 'rtl';
      popupDoc.documentElement.lang = 'fa';
      popupDoc.head.innerHTML = `
        <style>
          @font-face { font-family: 'Vazirmatn'; src: url('../fonts/Vazirmatn-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'Vazirmatn Bold'; src: url('../fonts/Vazirmatn-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Thin'; src: url('../fonts/Vazirmatn-Thin.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Black'; src: url('../fonts/Vazirmatn-Black.woff2') format('woff2'); }
          @font-face { font-family: 'BArshia'; src: url('../fonts/BArshia.woff2') format('woff2'); }
          @font-face { font-family: 'BFarnaz'; src: url('../fonts/BFarnaz.woff2') format('woff2'); }
          @font-face { font-family: 'BJadid'; src: url('../fonts/BJadidBd.woff2') format('woff2'); }
          @font-face { font-family: 'BZar'; src: url('../fonts/BZar.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'BZar Bold'; src: url('../fonts/BZarBd.woff2') format('woff2'); }
          @font-face { font-family: 'Lalezar'; src: url('../fonts/Lalezar-Regular.woff2') format('woff2'); }
          @font-face { font-family: 'Mada'; src: url('../fonts/Mada-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Rubik'; src: url('../fonts/Rubik-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'JetBrains Mono'; src: url('../fonts/JetBrainsMono-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'JetBrains Mono Bold'; src: url('../fonts/JetBrainsMono-Bold.woff2') format('woff2'); }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0F131E; color: #E2E8F0; font-family: 'Vazirmatn', sans-serif; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
          .popup-header { text-align: center; padding: 16px 20px 10px; background: linear-gradient(180deg, #1C2333, #161B26); border-bottom: 1px solid #232B3E; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
          .popup-header .title { font-size: 20px; font-weight: 900; color: #00F2FE; text-shadow: 0 0 20px rgba(0,242,254,0.3); }
          .popup-header .sub { font-size: 12px; color: #718096; margin-top: 3px; }
          .popup-body { flex: 1; overflow: auto; padding: 30px 40px; position: relative; }
          .eline { min-height: 1.4em; line-height: 2.6; white-space: pre-wrap; transition: opacity 0.3s ease, color 0.3s ease, background 0.3s ease, text-shadow 0.3s ease; }
          .popup-sync-line {
  position: relative;
  margin-top: 1.8em;
  padding: 4px 12px;
  border-bottom: none !important;
  transition: opacity 0.2s ease, color 0.2s ease, background 0.2s ease, text-shadow 0.2s ease;
}

.popup-sync-line.active {
  color: #fff;
  border-radius: 8px;
  z-index: 10;
}

.popup-sync-line.done {
  opacity: 0.50;
}

/* ===== Highlight Effects (matching main editor) ===== */
@keyframes hl-gradient-sweep { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes hl-pulse-glow { 0%,100% { box-shadow: 0 0 8px rgba(34,211,100,0.3), inset 0 0 12px rgba(34,211,100,0.05); } 50% { box-shadow: 0 0 20px rgba(34,211,100,0.6), inset 0 0 20px rgba(34,211,100,0.1); } }
@keyframes hl-text-pulse { 0%,100% { text-shadow: 0 0 6px rgba(34,211,100,0.5), 0 0 12px rgba(34,211,100,0.3); } 50% { text-shadow: 0 0 12px rgba(34,211,100,0.8), 0 0 30px rgba(34,211,100,0.5), 0 0 50px rgba(34,211,100,0.2); } }
/* Neon */
body.hl-neon .popup-sync-line.active { color: #00F2FE; text-shadow: 0 0 8px rgba(0,242,254,0.8), 0 0 20px rgba(0,242,254,0.4); }
body.hl-neon .popup-sync-line.active::before { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: linear-gradient(180deg, rgba(0,242,254,0.2), rgba(0,242,254,0.04) 55%, transparent); border: 1px solid rgba(0,242,254,0.3); border-radius: 8px; pointer-events: none; box-shadow: 0 0 15px rgba(0,242,254,0.3), 0 0 30px rgba(0,242,254,0.1); }
/* Frost */
body.hl-frost .popup-sync-line.active { color: #fff; }
body.hl-frost .popup-sync-line.active::before { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 50%, rgba(200,220,255,0.08) 100%); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; pointer-events: none; box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 16px rgba(0,0,0,0.3); }
body.hl-frost .popup-sync-line.active::after { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: rgba(255,255,255,0.06); backdrop-filter: blur(8px); border-radius: 12px; pointer-events: none; z-index: -1; }
/* Shift */
body.hl-shift .popup-sync-line.active { background: linear-gradient(135deg, #ff2e93, #7b2fff, #00F2FE, #3FB8AF, #ff2e93); background-size: 400% 400%; animation: hl-gradient-sweep 4s ease infinite; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
body.hl-shift .popup-sync-line.active::before { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: linear-gradient(135deg, rgba(255,46,147,0.15), rgba(123,47,255,0.15), rgba(0,242,254,0.15)); background-size: 400% 400%; animation: hl-gradient-sweep 4s ease infinite; border-radius: 8px; pointer-events: none; }
/* Depth */
body.hl-depth .popup-sync-line.active { color: #E2E8F0; text-shadow: 0 1px 0 rgba(0,0,0,0.8), 0 2px 0 rgba(0,0,0,0.7), 0 3px 0 rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.5), 0 0 15px rgba(255,46,147,0.3); }
body.hl-depth .popup-sync-line.active::before { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: linear-gradient(180deg, rgba(255,46,147,0.15), rgba(255,46,147,0.02) 60%, transparent); border: 1px solid rgba(255,46,147,0.2); border-radius: 8px; pointer-events: none; box-shadow: 0 6px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(255,46,147,0.2); }
/* Pulse */
body.hl-pulse .popup-sync-line.active { color: #22D364; animation: hl-text-pulse 2s ease-in-out infinite; }
body.hl-pulse .popup-sync-line.active::before { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: linear-gradient(180deg, rgba(34,211,100,0.12), rgba(34,211,100,0.02) 55%, transparent); border: 1px solid rgba(34,211,100,0.25); border-radius: 10px; pointer-events: none; animation: hl-pulse-glow 2s ease-in-out infinite; }

          .p-chord {
  position: absolute;
  pointer-events: none;
  font-weight: bold;
  color: ${cColor};
  font-family: '${cFont}', monospace;
  font-size: ${cSize}px;
  line-height: 1.15;
  box-sizing: border-box;
  background: transparent;
  border-radius: 4px;
  padding: 0 2px;
  direction: ltr;
  white-space: nowrap;
  z-index: 5;
}

          .p-chord-line { position: absolute; width: 2px; pointer-events: none; opacity: .5; background: ${cColor}; z-index: 4; }

          #pv-settings-toggle { transition: color 0.2s, transform 0.2s; }
          #pv-settings-toggle:hover { color: #00F2FE; transform: scale(1.05); }
          #pv-settings { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
          #pv-settings select { transition: border-color 0.2s, box-shadow 0.2s; }
          #pv-settings select:hover, #pv-settings select:focus { border-color: #00F2FE; box-shadow: 0 0 0 2px rgba(0,242,254,0.15); outline: none; }
          #pv-settings input[type="range"] { transition: filter 0.2s; }
          #pv-settings input[type="range"]:hover { filter: brightness(1.3); }
          #pv-settings label:hover { background: rgba(255,255,255,0.04); }
          .pv-hint { font-size: 10px; color: #4A5568; margin-top: 8px; text-align: center; letter-spacing: 0.3px; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #1A202C; }
          ::-webkit-scrollbar-thumb { background: #4A5568; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #718096; }
        </style>`;
      let html = `<div class="popup-header"><div class="title">${title}</div><div class="sub">${sub}</div>
        <div id="pv-settings-toggle" style="cursor:pointer;font-size:11px;color:#718096;margin-top:4px;user-select:none;transition:color 0.2s;">⚙ تنظیمات نمایش</div>
        <div id="pv-settings" style="display:none;text-align:right;padding:12px 14px;font-size:12px;margin-top:8px;background:linear-gradient(135deg,#1A202C,#161B26);border:1px solid #2D3748;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:center;">
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;">فونت:
              <select id="pv-font" style="background:#0D1117;color:#E2E8F0;border:1px solid #30363D;border-radius:8px;padding:4px 10px;font-size:11px;cursor:pointer;transition:border-color 0.2s;">
                <option value="Vazirmatn">Vazirmatn</option><option value="Vazirmatn Thin">Vazirmatn Thin</option><option value="Vazirmatn Bold">Vazirmatn Bold</option><option value="Vazirmatn Black">Vazirmatn Black</option><option value="BArshia">BArshia</option><option value="BFarnaz">BFarnaz</option><option value="BJadid">BJadid</option><option value="BZar">BZar</option><option value="BZar Bold">BZar Bold</option><option value="Lalezar">Lalezar</option>
              </select>
            </label>
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="color" id="pv-tColor" value="${tColor}" style="width:24px;height:24px;border:2px solid #30363D;border-radius:6px;cursor:pointer;background:none;padding:0;"> متن</label>
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="color" id="pv-cColor" value="${cColor}" style="width:24px;height:24px;border:2px solid #30363D;border-radius:6px;cursor:pointer;background:none;padding:0;"> آکورد</label>
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="color" id="pv-bgColor" value="#0F131E" style="width:24px;height:24px;border:2px solid #30363D;border-radius:6px;cursor:pointer;background:none;padding:0;"> پس‌زمینه</label>
            <div style="display:flex;align-items:center;gap:5px;color:#A0AEC0;">متن: <input type="range" id="pv-tSize" min="12" max="55" value="${tSize}" style="width:70px;accent-color:#00F2FE;height:4px;"> <span id="pv-tSizeVal" style="min-width:22px;text-align:center;font-family:monospace;color:#00F2FE;font-weight:bold;">${tSize}</span></div>
            <div style="display:flex;align-items:center;gap:5px;color:#A0AEC0;">آکورد: <input type="range" id="pv-cSize" min="8" max="40" value="${cSize}" style="width:70px;accent-color:#00F2FE;height:4px;"> <span id="pv-cSizeVal" style="min-width:22px;text-align:center;font-family:monospace;color:#00F2FE;font-weight:bold;">${cSize}</span></div>
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:background 0.2s;" title="قفل نسبت اندازه متن و آکورد"><input type="checkbox" id="pv-scaleLock" checked style="accent-color:#00F2FE;"> 🔗 قفل</label>
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:background 0.2s;"><input type="checkbox" id="pv-bold" style="accent-color:#00F2FE;"> <b>B</b> ضخیم</label>
          </div>
          <div class="pv-hint">Ctrl+Wheel: تغییر اندازه متن | Wheel روی آکورد: تغییر اندازه آکورد | Wheel روی فونت: پیمایش فونت‌ها</div>
        </div>
      </div><div class="popup-body" id="popupBody">`;
      lines.forEach((line, i) => {
        html += `<div class="eline popup-sync-line" data-li="${i}" style="font-size:${tSize}px;color:${tColor};font-family:'${tFont}';font-weight:${tBold};text-align:${align};">${line || '\u200B'}</div>`;
      });
      html += '</div>';
      // ظرف خالی برای نوار آکورد آینه‌ای + دستگیره ریسایز
      html += '<div id="chordMirrorResize" style="position:fixed;bottom:0;left:0;width:100%;height:94px;z-index:9999;">' +
        '<div id="chordMirrorHandle" style="width:100%;height:4px;background:linear-gradient(90deg,#4A5568,#9F7AEA,#4A5568);cursor:ns-resize;border-radius:2px 2px 0 0;opacity:0.5;transition:opacity 0.2s;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.5\'"></div>' +
        '<div id="playerChordMirror" style="width:100%;height:90px;background:#111;overflow:hidden;border-top:1px solid #333;"></div>' +
        '</div>';
      popupDoc.body.innerHTML = html;
      popupDoc.body.setAttribute('data-popup-role', 'player');
      // Apply highlight effect class to popup body
      applyHighlightClassToPopup();
      // Inject chord positioning script via createElement (not insertAdjacentHTML)
      const chordsJson = JSON.stringify(chords);
      const configJson = JSON.stringify({ cSize, cColor, cFont });
      const sc = popupDoc.createElement('script');
      sc.setAttribute('data-pv', 'chord');
      sc.textContent = `
        var _pChords = ${chordsJson};
        var _pCfg = ${configJson};
        var _pChordEls = Object.create(null);
        var _pChordLineEls = Object.create(null);
        var _pRenderPending = false;
        var _pRenderReason = 'init';
        var _pStructureVersion = 0;
        var _pLastRenderedSignature = '';
        var _pLastStructureVersion = -1;

        function _pChordKey(ch) {
          return [ch.lineIndex, ch.charIndex, ch.anchorType || ''].join('|');
        }

        function _pAnchorRect(editorEl, ch) {
          var lineEl = editorEl.children[ch.lineIndex]; if (!lineEl) return null;
          var segs = [], total = 0, node;
          var walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
          while (node = walker.nextNode()) { segs.push({ node: node, start: total, len: node.textContent.length }); total += node.textContent.length; }
          if (!segs.length) return null;
          var len = total, r = document.createRange();
          if (ch.anchorType === 'LineStart') { var s = segs[0]; r.setStart(s.node,0); r.setEnd(s.node,Math.min(1,s.len)); }
          else if (ch.anchorType === 'LineEnd') { var s2 = segs[segs.length-1]; var p = Math.max(0,s2.len-1); r.setStart(s2.node,p); r.setEnd(s2.node,Math.min(p+1,s2.len)); }
          else { var ci = Math.min(ch.charIndex, Math.max(0, len-1)); var s3 = null; for (var k=0;k<segs.length;k++) { if (ci >= segs[k].start && ci < segs[k].start+segs[k].len) { s3=segs[k]; break; } } if(!s3) s3=segs[segs.length-1]; var local = Math.max(0, ci-s3.start); r.setStart(s3.node, Math.min(local,s3.len)); r.setEnd(s3.node, Math.min(local+1,s3.len)); }
          return { rect: r.getBoundingClientRect(), lineRect: lineEl.getBoundingClientRect(), type: ch.anchorType };
        }

        function _pChordSignature() {
          return JSON.stringify({
            chords: (_pChords || []).map(function(ch) { return { l: ch.lineIndex, c: ch.charIndex, a: ch.anchorType, n: ch._name }; }),
            cSize: _pCfg.cSize, cColor: _pCfg.cColor, cFont: _pCfg.cFont
          });
        }

        function _pEnsureChordEl(key, pb) {
          var el = _pChordEls[key];
          if (el && el.isConnected) return { el: el, created: false };
          el = document.createElement('span');
          el.className = 'p-chord';
          el.setAttribute('data-chord-key', key);
          el.style.cssText = 'position:absolute;pointer-events:none;font-weight:bold;line-height:1.15;box-sizing:border-box;background:transparent;z-index:5;direction:ltr;white-space:nowrap;visibility:hidden;';
          pb.appendChild(el);
          _pChordEls[key] = el;
          return { el: el, created: true };
        }

        function _pEnsureChordLineEl(key, pb) {
          var el = _pChordLineEls[key];
          if (el && el.isConnected) return { el: el, created: false };
          el = document.createElement('div');
          el.className = 'p-chord-line';
          el.setAttribute('data-chordline-key', key);
          el.style.cssText = 'position:absolute;width:2px;pointer-events:none;opacity:.5;z-index:4;visibility:hidden;';
          pb.appendChild(el);
          _pChordLineEls[key] = el;
          return { el: el, created: true };
        }

        function _pCleanupUnused(usedKeys) {
          Object.keys(_pChordEls).forEach(function(key) {
            if (usedKeys[key]) return;
            var el = _pChordEls[key];
            if (el && el.isConnected) el.remove();
            delete _pChordEls[key];
          });
          Object.keys(_pChordLineEls).forEach(function(key) {
            if (usedKeys[key]) return;
            var el = _pChordLineEls[key];
            if (el && el.isConnected) el.remove();
            delete _pChordLineEls[key];
          });
        }

        function _pRenderChords() {
          var pb = document.getElementById('popupBody');
          if (!pb) return;
          var signature = _pChordSignature();
          var structureChanged = _pLastStructureVersion !== _pStructureVersion;
          var contentChanged = _pLastRenderedSignature !== signature;
          if (!structureChanged && !contentChanged && _pRenderReason !== 'resize') return;

          var wrapRect = pb.getBoundingClientRect();
          var scrollTop = pb.scrollTop;
          var GAP = Math.max(10, _pCfg.cSize * 0.6);
          var MARGIN = 5;
          var usedKeys = Object.create(null);

          (_pChords || []).forEach(function(ch) {
            if (!ch || !ch._name) return;
            var a = _pAnchorRect(pb, ch);
            if (!a) return;
            var key = _pChordKey(ch);
            var ensured = _pEnsureChordEl(key, pb);
            var el = ensured.el;
            usedKeys[key] = true;
            // آپدیت text و style فقط اگر عوض شده
            if (el.textContent !== ch._name) el.textContent = ch._name;
            var nf = _pCfg.cSize + 'px', nc = _pCfg.cColor, nfa = '"' + _pCfg.cFont + '",monospace';
            if (el.style.fontSize !== nf) el.style.fontSize = nf;
            if (el.style.color !== nc) el.style.color = nc;
            if (el.style.fontFamily !== nfa) el.style.fontFamily = nfa;
            var elW = el.offsetWidth;
            var x;
            if (ch.anchorType === 'LineStart') { x = a.rect.right + MARGIN; }
            else if (ch.anchorType === 'LineEnd') { x = a.rect.left - MARGIN; }
            else { x = (a.rect.left + a.rect.right) / 2; }
            var nt = (a.rect.top - wrapRect.top + scrollTop - _pCfg.cSize - GAP) + 'px';
            var nl = (x - wrapRect.left - elW / 2) + 'px';
            if (el.style.top !== nt) el.style.top = nt;
            if (el.style.left !== nl) el.style.left = nl;
            if (ensured.created) el.style.visibility = 'visible';

            // Chord line (vertical connector from chord to lyric)
            var lnEnsured = _pEnsureChordLineEl(key, pb);
            var ln = lnEnsured.el;
            var lnX = (x - wrapRect.left) + 'px';
            var lnTop = (parseFloat(nt) + _pCfg.cSize) + 'px';
            var lnH = Math.max(4, GAP) + 'px';
            if (ln.style.left !== lnX) ln.style.left = lnX;
            if (ln.style.top !== lnTop) ln.style.top = lnTop;
            if (ln.style.height !== lnH) ln.style.height = lnH;
            if (ln.style.background !== _pCfg.cColor) ln.style.background = _pCfg.cColor;
            if (lnEnsured.created) ln.style.visibility = 'visible';
          });
          _pCleanupUnused(usedKeys);
          _pLastRenderedSignature = signature;
          _pLastStructureVersion = _pStructureVersion;
          _pRenderReason = 'idle';
        }

        function _pScheduleChordRender(reason) {
          _pRenderReason = reason || _pRenderReason || 'unknown';
          if (_pRenderPending) return;
          _pRenderPending = true;
          requestAnimationFrame(function() { _pRenderPending = false; _pRenderChords(); });
        }

        _pScheduleChordRender('init');
        window.addEventListener('resize', function() { _pScheduleChordRender('resize'); });

        window._pCfg = _pCfg;
        window._pChords = _pChords;
        window._pRenderChords = _pRenderChords;
        window._pScheduleChordRender = _pScheduleChordRender;
        window._pChordEls = _pChordEls;
        window._pChordLineEls = _pChordLineEls;

        // === Wheel handlers ===
        var _pvKey = '${_pvSettingsKey}';
        function _pvLoad() { try { return JSON.parse(localStorage.getItem(_pvKey)) || {}; } catch(e) { return {}; } }
        function _pvSaveLocal(s) { try { localStorage.setItem(_pvKey, JSON.stringify(s)); } catch(e) {} }
        function _pvApplyLocal(s) {
          document.body.style.background = s.bgColor || '#0F131E';
          var fontName = s.font || 'Vazirmatn';
          document.querySelectorAll('.eline').forEach(function(el) {
            el.style.color = s.tColor || '#0fa966';
            el.style.fontSize = (s.tSize || 38) + 'px';
            el.style.fontWeight = s.bold ? 'bold' : 'normal';
            el.style.fontFamily = fontName;
          });
          _pCfg.cSize = s.cSize || 38;
          _pCfg.cColor = s.cColor || '#e6aa28';
          _pCfg.cFont = fontName;
          if (typeof _pScheduleChordRender === 'function') { _pScheduleChordRender('style'); }
          else { _pRenderChords(); }
        }
        document.addEventListener('wheel', function(e) {
          var s = _pvLoad(); if (!s.tSize) s.tSize = 20; if (!s.cSize) s.cSize = 14;
          if (s.scaleLock === undefined) s.scaleLock = true;
          var t = e.target;
          if (t && t.id === 'pv-tSize') {
            e.preventDefault();
            s.tSize = Math.max(12, Math.min(55, s.tSize + (e.deltaY < 0 ? 1 : -1)));
            if (s.scaleLock) s.cSize = Math.max(8, Math.min(40, Math.round(s.tSize * 0.7)));
            t.value = s.tSize;
            var tv = document.getElementById('pv-tSizeVal'); if (tv) tv.textContent = s.tSize;
            var cs = document.getElementById('pv-cSize'); var cv = document.getElementById('pv-cSizeVal');
            if (cs) cs.value = s.cSize; if (cv) cv.textContent = s.cSize;
            _pvSaveLocal(s); _pvApplyLocal(s); return;
          }
          if (t && t.id === 'pv-cSize') {
            e.preventDefault();
            s.cSize = Math.max(8, Math.min(40, s.cSize + (e.deltaY < 0 ? 1 : -1)));
            if (s.scaleLock) s.tSize = Math.max(12, Math.min(55, Math.round(s.cSize / 0.7)));
            t.value = s.cSize;
            var cv2 = document.getElementById('pv-cSizeVal'); if (cv2) cv2.textContent = s.cSize;
            var ts = document.getElementById('pv-tSize'); var tv2 = document.getElementById('pv-tSizeVal');
            if (ts) ts.value = s.tSize; if (tv2) tv2.textContent = s.tSize;
            _pvSaveLocal(s); _pvApplyLocal(s); return;
          }
          if (t && t.id === 'pv-font') {
            e.preventDefault();
            var _fl = ['Vazirmatn','Vazirmatn Thin','Vazirmatn Bold','Vazirmatn Black','BArshia','BFarnaz','BJadid','BZar','BZar Bold','Lalezar'];
            var idx = _fl.indexOf(s.font || 'Vazirmatn');
            idx = e.deltaY < 0 ? (idx - 1 + _fl.length) % _fl.length : (idx + 1) % _fl.length;
            s.font = _fl[idx]; t.value = s.font;
            _pvSaveLocal(s); _pvApplyLocal(s); return;
          }
        }, { passive: false });
      `;
      popupDoc.body.appendChild(sc);
      // Override _pCfg with saved Player View settings (not editor defaults)
      popupWindowBridge?.set?.(_lyricPopup, '_pCfg', {
        cSize: _pvSettings.cSize,
        cColor: _pvSettings.cColor,
        cFont: 'JetBrains Mono'
      });

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
      // تنظیمات popup فقط از مسیر WindowBridge به runtime پنجره می‌رسد.
      const initialPopupConfig = popupWindowBridge?.get?.(_lyricPopup, '_pCfg');
      if (initialPopupConfig && typeof initialPopupConfig === 'object') {
        initialPopupConfig.cSize = _pvSettings.cSize;
        initialPopupConfig.cColor = _pvSettings.cColor;
        popupWindowBridge?.set?.(_lyricPopup, '_pCfg', initialPopupConfig);
      }
      // Settings panel initialization — use persistent _pvSettings from outer scope
      const _pvDoc = popupDocument(_lyricPopup);
      if (!_pvDoc) return;
      function _pvApply() {
        const root = _pvDoc.body;
        root.style.background = _pvSettings.bgColor;
        // Apply to all lines
        _pvDoc.querySelectorAll('.eline').forEach(el => {
          el.style.color = _pvSettings.tColor;
          el.style.fontSize = _pvSettings.tSize + 'px';
          el.style.fontWeight = _pvSettings.bold ? 'bold' : 'normal';
          el.style.fontFamily = _getFontFamilyCSS(_pvSettings.font);
        });
        // Update chord config and re-render through the popup bridge.
        const popupConfig = popupWindowBridge?.get?.(_lyricPopup, '_pCfg');
        if (popupConfig && typeof popupConfig === 'object') {
          popupConfig.cSize = _pvSettings.cSize;
          popupConfig.cColor = _pvSettings.cColor;
          popupConfig.cFont = 'JetBrains Mono';
          popupWindowBridge?.set?.(_lyricPopup, '_pCfg', popupConfig);
          const scheduled = popupWindowBridge?.call?.(
            _lyricPopup,
            '_pScheduleChordRender',
            'style'
          );
          if (!scheduled) {
            popupWindowBridge?.call?.(_lyricPopup, '_pRenderChords');
          }
        }
      }
      // Toggle settings panel (auto-hide: clicking outside closes it)
      const _pvToggle = _pvDoc.getElementById('pv-settings-toggle');
      const _pvPanel = _pvDoc.getElementById('pv-settings');
      if (_pvToggle && _pvPanel) {
        _pvToggle.onclick = (e) => { e.stopPropagation(); _pvPanel.style.display = _pvPanel.style.display === 'none' ? 'block' : 'none'; };
        _pvDoc.body.addEventListener('click', (e) => { if (!_pvPanel.contains(e.target) && e.target !== _pvToggle) _pvPanel.style.display = 'none'; });
      }
      // Wire up controls
      const _pvFont = _pvDoc.getElementById('pv-font'); if (_pvFont) { _pvFont.value = _pvSettings.font; _pvFont.onchange = () => { _pvSettings.font = _pvFont.value; _pvSave(); _pvApply(); }; }
      const _pvTC = _pvDoc.getElementById('pv-tColor'); if (_pvTC) { _pvTC.value = _pvSettings.tColor; _pvTC.oninput = () => { _pvSettings.tColor = _pvTC.value; _pvSave(); _pvApply(); }; }
      const _pvCC = _pvDoc.getElementById('pv-cColor'); if (_pvCC) { _pvCC.value = _pvSettings.cColor; _pvCC.oninput = () => { _pvSettings.cColor = _pvCC.value; _pvSave(); _pvApply(); }; }
      const _pvBG = _pvDoc.getElementById('pv-bgColor'); if (_pvBG) { _pvBG.value = _pvSettings.bgColor; _pvBG.oninput = () => { _pvSettings.bgColor = _pvBG.value; _pvSave(); _pvApply(); }; }
      const _pvTS = _pvDoc.getElementById('pv-tSize'); const _pvTV = _pvDoc.getElementById('pv-tSizeVal');
      if (_pvTS) { _pvTS.value = _pvSettings.tSize; if (_pvTV) _pvTV.textContent = _pvSettings.tSize; _pvTS.oninput = () => { _pvSettings.tSize = +_pvTS.value; if (_pvTV) _pvTV.textContent = _pvSettings.tSize; if (_pvSettings.scaleLock) { _pvSettings.cSize = Math.round(_pvSettings.tSize * 0.7); const cs = _pvDoc.getElementById('pv-cSize'); const cv = _pvDoc.getElementById('pv-cSizeVal'); if (cs) cs.value = _pvSettings.cSize; if (cv) cv.textContent = _pvSettings.cSize; } _pvSave(); _pvApply(); }; }
      const _pvCS = _pvDoc.getElementById('pv-cSize'); const _pvCV = _pvDoc.getElementById('pv-cSizeVal');
      if (_pvCS) { _pvCS.value = _pvSettings.cSize; if (_pvCV) _pvCV.textContent = _pvSettings.cSize; _pvCS.oninput = () => { _pvSettings.cSize = +_pvCS.value; if (_pvCV) _pvCV.textContent = _pvSettings.cSize; if (_pvSettings.scaleLock) { _pvSettings.tSize = Math.round(_pvSettings.cSize / 0.7); const ts = _pvDoc.getElementById('pv-tSize'); const tv = _pvDoc.getElementById('pv-tSizeVal'); if (ts) ts.value = _pvSettings.tSize; if (tv) tv.textContent = _pvSettings.tSize; } _pvSave(); _pvApply(); }; }
      const _pvSL = _pvDoc.getElementById('pv-scaleLock'); if (_pvSL) { _pvSL.checked = _pvSettings.scaleLock; _pvSL.onchange = () => { _pvSettings.scaleLock = _pvSL.checked; _pvSave(); }; }
      const _pvBold = _pvDoc.getElementById('pv-bold'); if (_pvBold) { _pvBold.checked = _pvSettings.bold; _pvBold.onchange = () => { _pvSettings.bold = _pvBold.checked; _pvSave(); _pvApply(); }; }
      // Apply saved settings on load
      _pvApply();
      // ریسایز درگ‌کردنی نوار آکورد
      (function() {
        const _handle = _pvDoc.getElementById('chordMirrorHandle');
        const _wrapper = _pvDoc.getElementById('chordMirrorResize');
        const _mirror = _pvDoc.getElementById('playerChordMirror');
        if (!_handle || !_wrapper || !_mirror) return;
        let _dragging = false, _startY = 0, _startH = 0;
        _handle.addEventListener('mousedown', function(e) {
          e.preventDefault(); _dragging = true; _startY = e.clientY; _startH = _wrapper.offsetHeight;
          _pvDoc.body.style.cursor = 'ns-resize'; _pvDoc.body.style.userSelect = 'none';
        });
        _pvDoc.addEventListener('mousemove', function(e) {
          if (!_dragging) return;
          const newH = Math.max(40, Math.min(300, _startH + (_startY - e.clientY)));
          _wrapper.style.height = newH + 'px';
          _mirror.style.height = (newH - 4) + 'px';
        });
        _pvDoc.addEventListener('mouseup', function() {
          if (_dragging) { _dragging = false; _pvDoc.body.style.cursor = ''; _pvDoc.body.style.userSelect = ''; }
        });
      })();
      // Highlight sync: update popup directly from main window (not postMessage)
      // فقط class toggling — هیچ inline style reset — هیچ DOM rebuild
      let _pvLastScrolledIdx = -999;
      function _syncLyricPopupHighlight() {
        if (!isPopupOpen(_lyricPopup)) return;
        const popupBody = popupDocument(_lyricPopup)?.getElementById('popupBody');
        if (!popupBody) return;
        const times = requireEditorSongStateService().getSyncTimes();
        const daw = getEditorDAW();
        const t = daw?.isPlaying
          ? getTransportPlayhead()
          : (Number.isFinite(daw?.playhead) ? daw.playhead : 0);
        let activeIdx = -1;
        for (let i = 0; i < times.length; i++) {
          if (Number.isFinite(times[i]) && times[i] <= t) activeIdx = i;
          else if (Number.isFinite(times[i]) && times[i] > t) break;
        }
        // فقط class toggling — بدون reset inline styles
        [...popupBody.children].forEach(el => {
          if (!el.dataset.li) return;
          const li = +el.dataset.li;
          el.classList.toggle('active', li === activeIdx);
          el.classList.toggle('done', (times[li] != null) && times[li] < t && li !== activeIdx);
        });
        // اسکرول فقط وقتی خط فعال عوض شده
        if (activeIdx >= 0 && activeIdx !== _pvLastScrolledIdx) {
          _pvLastScrolledIdx = activeIdx;
          const activeEl = popupBody.querySelector('[data-li="' + activeIdx + '"]');
          if (activeEl) {
            const bodyH = popupBody.clientHeight;
            popupBody.scrollTo({ top: activeEl.offsetTop - bodyH / 2 + activeEl.offsetHeight / 2, behavior: 'smooth' });
          }
        }
      }
      popupWindowBridge?.set?.(_lyricPopup, '_syncHighlight', _syncLyricPopupHighlight);
      installPopupHighlightLoop(_lyricPopup, _pvDoc);
      // Fallback chord render chain: اگر rAF اولیه در full rebuild fail شد
      [200, 500, 1000].forEach(function(ms) {
        setTimeout(function() {
          try {
            if (isPopupOpen(_lyricPopup)) {
              popupWindowBridge?.call?.(_lyricPopup, '_pRenderChords');
            }
          } catch(_) {}
        }, ms);
      });
      // Force Reflow: مجبور کردن مرورگر به محاسبه مجدد چیدمان
      try {
        const _pb = popupDocument(_lyricPopup)?.getElementById('popupBody');
        if (_pb) void _pb.offsetHeight;
        popupWindowBridge?.dispatch?.(_lyricPopup, new Event('resize'));
      } catch(_) {}
    }

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

    function renderArrangerManager() {
      const box = $('arrManager'); box.innerHTML = '';

      // ─── هدر بخش پلی‌لیست‌ها ───
      const header = document.createElement('div');
      header.className = 'arr-manager-header';
      header.innerHTML = `
        <div style="display:flex;align-items:center;">
          <h4>📋 پلی‌لیست‌های ذخیره‌شده</h4>
          <span class="arr-count-badge">${arrangers.length}</span>
        </div>
      `;
      box.appendChild(header);

      // ─── نوار ابزار: پلی‌لیست جدید + ایمپورت/اکسپورت ───
      const toolbar = document.createElement('div');
      toolbar.className = 'arr-manager-toolbar';
      toolbar.innerHTML = `
        <button class="arr-btn-new" data-action="createNewArranger" title="ساخت پلی‌لیست جدید">
          ＋ پلی‌لیست جدید
        </button>
        <div style="display:flex;gap:6px;">
          <button class="arr-btn-import" data-action="importArrangerFromFile" title="بارگذاری یک پلی‌لیست از فایل JSON">
            📥 ورود یک پلی‌لیست
          </button>
          <button class="arr-btn-import" data-action="importAllPlaylistsFromFile" title="بارگذاری کامل همه پلی‌لیست‌ها از فایل پشتیبان">
            📥 ورود کامل پلی‌لیست‌ها
          </button>
          <button class="arr-btn-import" data-action="exportAllPlaylistsToFile" title="خروجی کامل همه پلی‌لیست‌ها در یک فایل" ${arrangers.length === 0 ? 'disabled' : ''}>
            📤 خروجی کامل پلی‌لیست‌ها
          </button>
        </div>
      `;
      box.appendChild(toolbar);

      // ─── حالت خالی ───
      if (!arrangers.length) {
        const empty = document.createElement('div');
        empty.className = 'arr-empty-state';
        empty.innerHTML = `
          <div class="arr-empty-icon">🎼</div>
          <div class="arr-empty-text">هنوز پلی‌لیستی نساخته‌اید.<br>روی «پلی‌لیست جدید» بزنید تا اولین پلی‌لیست رو بسازید.</div>
        `;
        box.appendChild(empty);
        return;
      }

      // ─── لیست کارت‌های پلی‌لیست ───
      arrangers.forEach(arr => {
        const isActive = editingArr && editingArr.id === arr.id;
        const card = document.createElement('div');
        card.className = 'arr-card' + (isActive ? ' arr-card-active' : '');

        // ساخت badge ها برای کراس‌فید و توقف
        const badges = [];
        if (arr.crossfade) badges.push(`<span class="arr-badge badge-crossfade">🔄 کراس‌فید: ${arr.crossfade}s</span>`);
        if (arr.pauseBetween) badges.push(`<span class="arr-badge badge-pause">⏸ توقف بین آهنگ‌ها</span>`);

        card.innerHTML = `
          <div class="meta">
            <b>${arr.name || t('untitled')}</b>
            <span>${arr.items.length} ${t('songN')}</span>
            ${badges.length ? `<div class="arr-card-badges">${badges.join('')}</div>` : ''}
          </div>
          <div class="acts">
            <button data-a="edit" title="ویرایش">✏️ ویرایش</button>
            <button data-a="export" class="act-export" title="خروجی به فایل">📤</button>
            <button data-a="del" class="act-del" title="حذف">🗑</button>
          </div>
        `;

        card.onclick = (e) => {
          const a = e.target.dataset.a;
          if (!a) {
            // کلیک روی کارت = ویرایش
            editingArr = arr;
            openArrEditor();
            return;
          }
          if (a === 'del') {
            if (confirm(`حذف پلی‌لیست «${arr.name || t('untitled')}»؟`)) {
              arrangers = arrangers.filter(x => x.id !== arr.id);
              saveArrangers();
              if (editingArr && editingArr.id === arr.id) {
                editingArr = null;
                $('arrEditor').style.display = 'none';
              }
              renderArrangerManager();
              toast('🗑 پلی‌لیست حذف شد');
            }
          } else if (a === 'edit') {
            editingArr = arr;
            openArrEditor();
          } else if (a === 'export') {
            exportArranger(arr);
          }
        };
        box.appendChild(card);
      });
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
      if (!arr) { toast('⚠ پلی‌لیست نامعتبر'); return; }

      const allSongs = edGetAllSongs();
      const songData = {};
      arr.items.forEach(id => {
        const song = allSongs.find(s => s.id === id);
        if (song) songData[id] = song;
      });

      const exportData = {
        type: 'akordyar-playlist',
        version: '1.0',
        name: arr.name || 'پلی‌لیست',
        items: arr.items,
        crossfade: arr.crossfade || 0,
        pauseBetween: !!arr.pauseBetween,
        _itemSettings: arr._itemSettings || {},
        songs: songData,
        exportDate: new Date().toISOString()
      };

      const fileName = (arr.name || 'playlist').replace(/[\/\\:*?"<>|]/g, '_') + '.json';

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'JSON Playlist', accept: { 'application/json': ['.json'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(exportData, null, 2));
          await writable.close();
          toast(`✅ اکسپورت شد: ${fileName}`);
        } catch (e) {
          if (e.name !== 'AbortError') toast('خطا در اکسپورت: ' + e.message);
        }
      } else {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        toast(`✅ اکسپورت شد: ${fileName}`);
      }
    }

    /**
     * importArrangerFromFile — بارگذاری پلی‌لیست از فایل JSON
     * اگر پلی‌لیستی با همان نام وجود داشته باشد، خطا می‌دهد.
     */
    async function importArrangerFromFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);

          // بررسی فرمت
          if (!data || (!data.items && !data.songs)) {
            toast('❌ فایل معتبر نیست — فرمت پلی‌لیست نیست');
            return;
          }

          // بررسی نسخه فایل
          const supportedVersions = [1, '1.0', 2, '2.0'];
          if (data.version && !supportedVersions.includes(data.version)) {
            toast(`❌ نسخه فایل (${data.version}) پشتیبانی نمی‌شود.`);
            return;
          }

          // خواندن و اعتبارسنجی نام پلی‌لیست
          let baseName = data.name || file.name.replace(/\.json$/i, '');
          if (!baseName || !baseName.trim()) {
            toast('❌ نام پلی‌لیست در فایل خالی است.');
            return;
          }
          baseName = baseName.trim();

          // ─── بررسی نام تکراری با مقایسه normalize شده ───
          if (playlistNameExists(baseName)) {
            toast(`⚠ پلی‌لیستی با نام «${baseName}» از قبل وجود دارد.\nبرای ورود این فایل، ابتدا نام پلی‌لیست را در فایل خروجی یا در پروژه‌ی مبدا تغییر دهید.`);
            return;
          }

          // اعتبارسنجی items
          if (!Array.isArray(data.items)) {
            toast('❌ آرایه‌ی items در فایل معتبر نیست.');
            return;
          }

          // بررسی songId برای هر آیتم
          for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            // آیتم می‌تونه هم رشته/عدد (songId مستقیم) باشه هم آبجکت با خاصیت songId
            const songId = (item && typeof item === 'object') ? item.songId : item;
            if (!songId) {
              toast(`❌ آیتم شماره ${i + 1} فاقد songId معتبر است.`);
              return;
            }
          }

          // اگر آهنگ‌ها داخل فایل هستن، اول اونا رو به آرشیو اضافه کن
          let importedSongsCount = 0;
          if (data.songs && typeof data.songs === 'object') {
            const allSongs = edGetAllSongs();
            for (const [id, song] of Object.entries(data.songs)) {
              if (song && song.title) {
                if (!allSongs.find(s => s.id === id)) {
                  allSongs.push(song);
                  importedSongsCount++;
                }
              }
            }
            if (importedSongsCount > 0) {
              edSetAllSongs(allSongs);
              console.log(`[Import] ${importedSongsCount} song(s) imported from playlist`);
            }
          }

          // ساخت پلی‌لیست جدید با ساختار استاندارد
          const newArr = {
            id: 'playlist_' + Date.now(),
            name: baseName,
            items: Array.isArray(data.items) ? data.items.map(it => (it && typeof it === 'object') ? it.songId : it) : [],
            crossfade: data.crossfade || 0,
            pauseBetween: !!data.pauseBetween,
            _itemSettings: data._itemSettings || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          arrangers.unshift(newArr);
          saveArrangers();
          editingArr = newArr;
          renderArrangerManager();
          openArrEditor();

          toast(`✅ پلی‌لیست «${newArr.name}» بارگذاری شد (${newArr.items.length} آهنگ${importedSongsCount > 0 ? `، ${importedSongsCount} آهنگ جدید` : ''})`);
        } catch (e) {
          console.error('[Import] Error:', e);
          toast('❌ خطا در بارگذاری فایل: ' + e.message);
        }
      };
      input.click();
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
    let _arrDragIndex = null; // Persist drag index across render calls

    function renderArrSetlist() {
      const box = $('arrSetlist'); box.innerHTML = '';
      if (!editingArr.items.length) { box.innerHTML = `<div style="padding:14px;color:var(--text-secondary);font-size:13px;">${t('addFromLeft')}</div>`; return; }
      const allSongs = edGetAllSongs();
      const query = ($('arrSearchInput')?.value || '').trim().toLowerCase();
      
      editingArr.items.forEach((id, i) => {
        const s = allSongs.find(x => x.id === id); if (!s) return;
        // Live filtering
        if (query) {
          const matchText = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.key || '') + ' ' + (s.genre || '')).toLowerCase();
          if (!matchText.includes(query)) return;
        }
        const setting = ensureArrItem(editingArr, i);
        const transVal = setting.transpose || 0;
        const transSign = transVal > 0 ? '+' + transVal : String(transVal);
        const hasNotes = !!(setting.notes && setting.notes.trim());
        const it = document.createElement('div'); it.className = 'arr-item'; it.draggable = true; it.dataset.i = i;
        it.innerHTML = `
          <div class="arr-item-controls">
            <button data-a="up" title="بالا">↑</button>
            <button data-a="down" title="پایین">↓</button>
            <span class="arr-item-number">${i + 1}</span>
          </div>
          <div class="arr-item-info" draggable="true">
            <span class="ai-title">${s.title || t('untitled')}</span>
            <small>${s.artist || '—'}</small>
          </div>
          <div class="ai-ctrls">
            <button class="ai-trans-btn" data-a="trans-down" title="بمل">♭</button>
            <span class="ai-trans-val">${transSign}</span>
            <button class="ai-trans-btn" data-a="trans-up" title="دیز">♯</button>
            <button class="ai-notes-btn ${hasNotes ? 'has-notes' : ''}" data-a="notes" title="یادداشت اجرا">📝</button>
            <button data-a="del" title="حذف">✕</button>
          </div>`;
        it.onclick = (e) => {
          const btn = e.target.closest('[data-a]');
          if (!btn) return;
          const a = btn.dataset.a;
          if (a === 'up' && i > 0) { [editingArr.items[i - 1], editingArr.items[i]] = [editingArr.items[i], editingArr.items[i - 1]]; }
          else if (a === 'down' && i < editingArr.items.length - 1) { [editingArr.items[i + 1], editingArr.items[i]] = [editingArr.items[i], editingArr.items[i + 1]]; }
          else if (a === 'del') { editingArr.items.splice(i, 1); }
          else if (a === 'trans-up') { setting.transpose = (setting.transpose || 0) + 1; }
          else if (a === 'trans-down') { setting.transpose = (setting.transpose || 0) - 1; }
          else if (a === 'notes') { openArrSongNote(i); return; }
          else return;
          saveArrangers(); renderArrSetlist();
        };
        it.addEventListener('dragstart', () => { _arrDragIndex = i; it.style.opacity = '.4'; });
        it.addEventListener('dragover', e => { e.preventDefault(); it.classList.add('dragover'); });
        it.addEventListener('dragleave', () => it.classList.remove('dragover'));
        it.addEventListener('drop', e => {
          e.preventDefault(); it.classList.remove('dragover');
          if (_arrDragIndex === null || _arrDragIndex === i) return;
          const moved = editingArr.items.splice(_arrDragIndex, 1)[0];
          editingArr.items.splice(i, 0, moved);
          saveArrangers(); renderArrSetlist(); _arrDragIndex = null;
        });
        it.addEventListener('dragend', () => { it.style.opacity = ''; });
        box.appendChild(it);
      });
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
    let perfTimer = null, perfStartTime = 0;

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

    async function openPerfMode() {
      if (!editingArr || !editingArr.items.length) { toast(t('emptySetlist')); return; }
      arrPerformData = editingArr;
      arrPerformIdx = 0;
      arrPerformActive = true;
      perfModeActive = true;
      perfLiveTranspose = 0;
      perfPauseMode = !!editingArr.pauseBetween;
      _arrNextState = null;

      const panel = $('arrPerfOverlay');
      panel.style.display = 'flex';
      $('perfArrangerName').textContent = '🎤 ' + (editingArr.name || 'اجرا');
      $('perfPauseModeBtn').classList.toggle('arr-stl-active', perfPauseMode);

      // درگ پنل
      _setupPerfPanelDrag(panel);

      closeArrangerModal();
      renderPerfUI();
      await loadArrSong(0);
      renderPerfUI();
      startPerfTimer();

      // ─── Background preload همه آهنگ‌های ارنجر ───
      // این کار تضمین می‌کنه که وقتی به آهنگ بعدی می‌رسیم، صدا از قبل لود شده.
      // preload به‌صورت غیرمسدودکننده در پس‌زمینه انجام می‌شه.
      _startBackgroundPreload();

      // باز کردن Player View و Singer View مثل F9
      if (typeof openLyricOnlyPopup === 'function') openLyricOnlyPopup();
      if (typeof openLyricPopup === 'function') setTimeout(openLyricPopup, 300);
    }

    // درگ پنل اجرا
    function _setupPerfPanelDrag(panel) {
      const handle = $('arrPerfDragHandle');
      if (!handle || handle._dragSetup) return;
      handle._dragSetup = true;
      let dragging = false, startX, startY, origX, origY;
      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target.tagName === 'BUTTON') return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        origX = rect.left; origY = rect.top;
        e.preventDefault();
        startEditorPointerDrag(handle, e, move, () => { dragging = false; });
      });
      const move = (e) => {
        if (!dragging) return;
        panel.style.left = (origX + e.clientX - startX) + 'px';
        panel.style.top = (origY + e.clientY - startY) + 'px';
        panel.style.right = 'auto';
      };
    }

    function perfStop() {
      arrPerformActive = false;
      perfModeActive = false;
      _arrNextState = null;
      _bgPreloadActive = false; // توقف background preload
      _arrWaitPollActive = false; // توقف wait poll
      arrPreparePending = false; // reset prep flag
      _arrHasLoggedNoNextSong = false; // reset no-next-song log flag
      _arrPrepStartedForIndex = -1;    // reset prep log flag
      pauseTransport();
      $('arrPerfOverlay').style.display = 'none';
      stopPerfTimer();
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
      if (_bgPreloadActive) return;
      if (!arrPerformData || !arrPerformData.items.length) return;

      _bgPreloadActive = true;
      _bgPreloadedSongIds = new Set();

      const allSongs = edGetAllSongs();
      const songsToPreload = arrPerformData.items
        .map(id => allSongs.find(s => s.id === id))
        .filter(s => s); // فیلتر null ها

      console.log(`[BG Preload] Starting background preload for ${songsToPreload.length} songs`);

      // اجرای preload به‌صورت زنجیره‌ای (یکی‌یکی، نه موازی) برای جلوگیری از overload
      (async () => {
        for (let i = 0; i < songsToPreload.length; i++) {
          if (!_bgPreloadActive) {
            console.log('[BG Preload] Cancelled');
            return;
          }
          const song = songsToPreload[i];
          if (_bgPreloadedSongIds.has(song.id)) continue;

          try {
            // اگه آهنگ فعلی داره پخش می‌شه و نزدیک انتها هست، اولویت با prepareNextArrSong باشه
            // اینجا فقط preload می‌کنیم اگه bufferCache نداشته باشیم
            const hasAudioClips = song._dawClips && song._dawClips.some(c => c.type !== 'chord' && c.bufferKey);
            if (!hasAudioClips) {
              _bgPreloadedSongIds.add(song.id);
              continue;
            }

            // چک کن: آیا همه بافرها از قبل لود شدن؟
            const allLoaded = song._dawClips.every(c =>
              c.type === 'chord' || !c.bufferKey || getEditorDAW().bufferCache.has(c.bufferKey)
            );
            if (allLoaded) {
              _bgPreloadedSongIds.add(song.id);
              continue;
            }

            console.log(`[BG Preload] (${i + 1}/${songsToPreload.length}) Preloading: "${song.title || song.id}"`);
            await preloadAudioForSong(song);
            _bgPreloadedSongIds.add(song.id);

            // یک وقفه کوتاه بین هر آهنگ برای اجازه دادن به playback tick
            await new Promise(r => setTimeout(r, 50));
          } catch (e) {
            console.warn(`[BG Preload] Error preloading "${song.title}":`, e);
            _bgPreloadedSongIds.add(song.id); // علامت‌گذاری به‌عنوان پردازش‌شده برای جلوگیری از loop بی‌نهایت
          }
        }
        console.log('[BG Preload] Complete');
        _bgPreloadActive = false;
      })();
    }

    function perfTogglePauseMode() {
      document.activeElement?.blur();
      perfPauseMode = !perfPauseMode;
      $('perfPauseModeBtn').classList.toggle('arr-stl-active', perfPauseMode);
    }

    function perfTogglePlay() {
      document.activeElement?.blur();
      if (getEditorDAW().isPlaying) {
        pauseTransport();
        $('perfPlayBtn').textContent = '▶';
      } else {
        ensureAudioCtx();
        if (getEditorDAW().playhead <= 0) {
          const markers = getArrangerMarkers();
          seekTransport(
            arrPerformActive && markers.enabled === true ? (markers.start || 0) : 0,
            false,
            true
          );
        }
        startTransport();
        $('perfPlayBtn').textContent = '⏸';
      }
    }

    function perfRestartSong() {
      document.activeElement?.blur();
      const markers = getArrangerMarkers();
      seekTransport(
        arrPerformActive && markers.enabled === true ? (markers.start || 0) : 0,
        false,
        true
      );
      ensureAudioCtx();
      startTransport();
      $('perfPlayBtn').textContent = '⏸';
    }

    function perfPrevSong() {
      document.activeElement?.blur();
      if (arrPerformIdx > 0) {
        arrPerformActive = true;
        loadArrSong(arrPerformIdx - 1);
        renderPerfUI();
      }
    }

    function perfNextSong() {
      document.activeElement?.blur();
      if (arrPerformData && arrPerformIdx < arrPerformData.items.length - 1) {
        arrPerformActive = true;
        loadArrSong(arrPerformIdx + 1);
        renderPerfUI();
      }
    }

    // Per-song transpose during performance
    function perfTranspose(semi) {
      document.activeElement?.blur();
      if (!arrPerformData) return;
      const setting = ensureArrItem(arrPerformData, arrPerformIdx);
      setting.transpose = (setting.transpose || 0) + semi;
      // Apply transpose to all audio tracks
      getEditorDAW().tracks.forEach(t => {
        if (t.type === 'audio') {
          t.transpose = (t.transpose || 0) + semi;
        }
      });
      if (getEditorDAW().isPlaying) scheduleAllFromPlayhead();
      saveArrangers();
      perfLiveTranspose += semi;
      renderPerfUI();
    }

    // Tempo change during performance
    function perfTempoChange(delta) {
      const cur = parseInt($('edTempo')?.value) || 120;
      const newVal = clamp(cur + delta, 20, 300);
      $('edTempo').value = newVal;
      if (requireEditorSongStateService().setTempo(newVal)) {
        edSaveSong();
        handleTimingChange();
      }
      renderPerfUI();
    }

    // Jump to specific song from performance sidebar
    function perfJumpToSong(idx) {
      if (idx < 0 || !arrPerformData || idx >= arrPerformData.items.length) return;
      arrPerformActive = true;
      loadArrSong(idx);
      renderPerfUI();
    }

    // Render performance mode UI
    function renderPerfUI() {
      if (!perfModeActive || !arrPerformData) return;
      const arr = arrPerformData;
      const allSongs = edGetAllSongs();

      // Current song info
      const songId = arr.items[arrPerformIdx];
      const song = allSongs.find(s => s.id === songId);
      const setting = getArrItemSetting(arr, songId);
      const currentSong = requireEditorSongStateService().currentSong();

      $('perfSongNum').textContent = `${arrPerformIdx + 1} / ${arr.items.length}`;
      $('perfSongTitle').textContent = song ? (song.title || 'بدون نام') : '—';
      $('perfSongArtist').textContent = song ? (song.artist || '') : '';
      const keyName = song?.key || currentSong?.key || 'C';
      const keyMode = song?.keyMode || currentSong?.keyMode || 'maj';
      const transVal = setting.transpose || 0;
      $('perfSongKey').innerHTML = `${keyName} ${keyMode === 'maj' ? 'ماژور' : 'مینور'} ${transVal ? `<span class="perf-trans">(${transVal > 0 ? '+' : ''}${transVal})</span>` : ''}`;
      $('perfTransVal').textContent = transVal > 0 ? '+' + transVal : String(transVal);
      if ($('perfTempoVal')) $('perfTempoVal').textContent =
        song?.tempo || currentSong?.tempo || 120;

      // Render setlist
      const setlistEl = $('perfSetlist');
      if (!setlistEl) return;
      setlistEl.innerHTML = '';
      
      let draggedIndex = -1;
      
      arr.items.forEach((id, i) => {
        const s = allSongs.find(x => x.id === id);
        const st = getArrItemSetting(arr, id);
        const div = document.createElement('div');
        div.className = 'arr-perf-setlist-item' + (i === arrPerformIdx ? ' pf-current' : '') + (i === arrPerformIdx + 1 ? ' pf-next' : '') + (i < arrPerformIdx ? ' pf-done' : '');
        div.draggable = true;
        div.innerHTML = `<span class="pf-num">${i + 1}</span><span class="pf-name">${s ? (s.title || 'بدون نام') : '—'}</span><span class="pf-key">${s?.key || '—'}${st.transpose ? (st.transpose > 0 ? '+' : '') + st.transpose : ''}</span>`;
        
        // Click to jump
        div.onclick = () => perfJumpToSong(i);
        
        // Drag events
        div.addEventListener('dragstart', (e) => {
          draggedIndex = i;
          div.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(i));
        });
        
        div.addEventListener('dragend', () => {
          draggedIndex = -1;
          div.classList.remove('dragging');
          // Remove all drag-over styles
          Array.from(setlistEl.children).forEach(child => {
            child.classList.remove('drag-over-top', 'drag-over-bottom');
            child.style.borderTop = '';
            child.style.borderBottom = '';
          });
        });
        
        div.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (draggedIndex === -1 || draggedIndex === i) return;
          
          const rect = div.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          
          // Remove old classes
          Array.from(setlistEl.children).forEach(child => {
            child.classList.remove('drag-over-top', 'drag-over-bottom');
            child.style.borderTop = '';
            child.style.borderBottom = '';
          });
          
          if (e.clientY < midpoint) {
            div.classList.add('drag-over-top');
            div.style.borderTop = '2px solid var(--accent-teal)';
          } else {
            div.classList.add('drag-over-bottom');
            div.style.borderBottom = '2px solid var(--accent-teal)';
          }
        });
        
        div.addEventListener('dragleave', () => {
          div.classList.remove('drag-over-top', 'drag-over-bottom');
          div.style.borderTop = '';
          div.style.borderBottom = '';
        });
        
        div.addEventListener('drop', (e) => {
          e.preventDefault();
          if (draggedIndex === -1 || draggedIndex === i) return;
          
          const rect = div.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          let dropIndex = i;
          
          // Determine insert position
          if (e.clientY < midpoint) {
            dropIndex = i;
          } else {
            dropIndex = i + 1;
          }
          
          // Adjust if dragging from before the drop position
          if (draggedIndex < dropIndex) {
            dropIndex--;
          }
          
          // Reorder the array
          if (draggedIndex !== dropIndex) {
            const movedItem = arr.items.splice(draggedIndex, 1)[0];
            arr.items.splice(dropIndex, 0, movedItem);
            
            // Save updated playlist
            saveArrangers();
            
            // Re-render to reflect changes
            renderPerfPanel();
          }
          
          // Cleanup
          draggedIndex = -1;
          div.classList.remove('drag-over-top', 'drag-over-bottom');
          div.style.borderTop = '';
          div.style.borderBottom = '';
        });
        
        setlistEl.appendChild(div);
      });

      // Render section navigation buttons
      const secNav = $('perfSectionNav');
      secNav.innerHTML = '';
      const sections = ['مقدمه', 'ورس', 'کورس', 'بریج', 'آوترو'];
      const sectionTimes = [0]; // at least start
      if (getEditorDAW().sections && getEditorDAW().sections.length) {
        getEditorDAW().sections.forEach(s => sectionTimes.push(s.start));
      }
      // Add end
      sectionTimes.push(getArrangerEnd());
      sections.forEach((name, i) => {
        if (i < sectionTimes.length - 1 || i === 0) {
          const btn = document.createElement('button');
          btn.textContent = name;
          btn.onclick = () => {
            if (i < sectionTimes.length) {
              seekTransport(sectionTimes[i], false);
              if (!getEditorDAW().isPlaying) { ensureAudioCtx(); startTransport(); $('perfPlayBtn').textContent = '⏸'; }
            }
          };
          secNav.appendChild(btn);
        }
      });

      // Show notes if any
      const noteBadge = $('perfNoteBadge');
      if (setting.notes && setting.notes.trim()) {
        $('perfNoteText').textContent = setting.notes;
        noteBadge.classList.add('show');
      } else {
        noteBadge.classList.remove('show');
      }

      // Scroll to current in sidebar
      const currentItem = setlistEl.querySelector('.pf-current');
      if (currentItem) currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Timer for performance
    function startPerfTimer() {
      stopPerfTimer();
      perfStartTime = Date.now();
      perfTimer = setInterval(() => {
        if (!perfModeActive) return;
        const elapsed = Date.now() - perfStartTime;
        const min = Math.floor(elapsed / 60000);
        const sec = Math.floor((elapsed % 60000) / 1000);
        $('perfTime').textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      }, 1000);
    }
    function stopPerfTimer() {
      if (perfTimer) { clearInterval(perfTimer); perfTimer = null; }
    }

    // Override startArrangerPerform to use new perf mode
    async function startArrangerPerform() {
      await openPerfMode();
    }

    // Pre-build the next song's full DAW state while current plays
    // این تابع حالا با try/catch/finally کامل نوشته شده تا arrPreparePending
    // هرگز گیر نکنه. اگه خطایی رخ بده، retry می‌کنه.
    async function prepareNextArrSong(retryCount = 0) {
      const arr = arrPerformData || editingArr;
      const nextIdx = arrPerformIdx + 1;

      // اگر آهنگ بعدی وجود نداره، _arrNextState رو null کن
      if (!arr || nextIdx >= arr.items.length) {
        _arrNextState = null;
        // فقط یک‌بار لاگ بزن
        if (!_arrHasLoggedNoNextSong) {
          _arrHasLoggedNoNextSong = true;
          console.log('[Arranger Prep] No more songs — _arrNextState cleared');
        }
        return;
      }

      const allSongs = edGetAllSongs();
      const song = allSongs.find(s => s.id === arr.items[nextIdx]);
      if (!song) {
        _arrNextState = null;
        console.warn(`[Arranger Prep] Song at index ${nextIdx} not found in archive (id: ${arr.items[nextIdx]})`);
        return;
      }

      try {
        const songData = JSON.parse(JSON.stringify(song));
        if (!songData.styles) songData.styles = {};
        const defaults = { tSize:23,tColor:'#0fa966',tFont:'Vazirmatn',tBold:true,align:'center',cSize:23,cColor:'#e6aa28',cFont:'JetBrains Mono' };
        Object.keys(defaults).forEach(k => { if (songData.styles[k] === undefined) songData.styles[k] = defaults[k]; });

        // ─── Pre-load کامل صدا برای آهنگ بعدی ───
        const preloadResult = await preloadAudioForSong(songData);
        if (preloadResult.missing > 0) {
          console.warn(`[Arranger Prep] ${preloadResult.missing} audio clip(s) missing for "${songData.title}":`, preloadResult.missingNames);
        } else {
          console.log(`[Arranger Prep] ✓ Audio ready for "${songData.title}" (loaded: ${preloadResult.loaded})`);
        }

        const tracks = songData._dawTracks ? JSON.parse(JSON.stringify(songData._dawTracks)) : [];
        let clips = songData._dawClips ? JSON.parse(JSON.stringify(songData._dawClips)) : [];
        let sections = songData._dawSections ? JSON.parse(JSON.stringify(songData._dawSections)) : [];
        const oldSec = clips.filter(c => c.type === 'section');
        if (oldSec.length) { oldSec.forEach(c => { sections.push({ id: c.id, trackId: c.trackId, label: c.name, start: c.start, duration: c.duration, color: c.color }); }); clips = clips.filter(c => c.type !== 'section'); }

        const playbackBoundary = arrangerPlaybackPolicy?.createBoundary?.({
          clips,
          sections,
          arrangerMarkers: songData._arrangerMarkers,
          legacyLoopState: songData._dawLoop,
          fallbackEnd: 30
        }) || {
          start: 0,
          end: 30,
          selectionEnd: 30,
          markers: { enabled: false, start: 0, end: 30 }
        };
        const savedArrangerMarkers =
          globalScope.ArrangerMarkerService?.fromSong?.(songData) || {
            enabled: songData._arrangerMarkers?.enabled === true,
            start: Math.max(0, Number(songData._arrangerMarkers?.start) || 0),
            end: Math.max(0, Number(songData._arrangerMarkers?.end) || 0)
          };

        // آپدیت sourceDuration و peaks برای کلیپ‌های که لود شدن
        clips.forEach(c => { if (c.type !== 'chord' && c.bufferKey && getEditorDAW().bufferCache.has(c.bufferKey)) { const buffer = getEditorDAW().bufferCache.get(c.bufferKey); c.sourceDuration = buffer.duration; c._peaks = peaksFromBuffer(buffer, 2000); } });

        // Apply per-song transpose to tracks
        const nextSetting = getArrItemSetting(arr, arr.items[nextIdx]);
        if (nextSetting.transpose) {
          tracks.forEach(t => { if (t.type === 'audio') t.transpose = (t.transpose || 0) + nextSetting.transpose; });
        }

        _arrNextState = {
          song: songData,
          idx: nextIdx,
          clips,
          sections,
          tracks,
          playbackStart: playbackBoundary.start,
          playbackEnd: playbackBoundary.end,
          selectionEnd: playbackBoundary.selectionEnd,
          loopState: songData._dawLoop,
          arrangerMarkers: savedArrangerMarkers
        };
        console.log(`[Arranger Prep] ✓ _arrNextState ready for song ${nextIdx + 1}: "${songData.title}"`);
        
        // ─── تأیید نهایی: مطمئن شو همه بافرهای مورد نیاز واقعاً لود شدن ───
        const audioClipsInNext = clips.filter(c => c.type !== 'chord' && c.bufferKey);
        const missingBuffers = audioClipsInNext.filter(c => !getEditorDAW().bufferCache.has(c.bufferKey));
        if (missingBuffers.length > 0) {
          console.warn(`[Arranger Prep] ⚠ ${missingBuffers.length} buffer(s) still missing after prep:`, missingBuffers.map(c => c.fileName || c.bufferKey));
          // تلاش مجدد برای لود بافرهای گمشده
          await restoreAudioForProjectSilently(songData.id, true);
          console.log(`[Arranger Prep] ✓ Retry complete - buffers rechecked`);
        }
      } catch (e) {
        console.error(`[Arranger Prep] Error preparing song ${nextIdx + 1} (retry ${retryCount}):`, e);
        _arrNextState = null;

        // Retry mechanism: حداکثر ۲ بار با وقفه ۱ ثانیه
        if (retryCount < 2 && arrPerformActive) {
          console.log(`[Arranger Prep] Retrying in 1s... (attempt ${retryCount + 1}/2)`);
          await new Promise(r => setTimeout(r, 1000));
          if (arrPerformActive && arrPerformIdx === nextIdx - 1) {
            return prepareNextArrSong(retryCount + 1);
          }
        }
      }
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
