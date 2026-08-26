// ==========================================
// PART 4: Timeline Rendering & UI Event Listeners
// ==========================================

// Keep selection state initialized before DOM setup can register handlers.
let edSelectedChords = [];
let editorColorToolService = null;

function getEditorColorToolService() {
  if (
    !editorColorToolService &&
    typeof window.EditorColorToolService?.create === 'function'
  ) {
    editorColorToolService = window.EditorColorToolService.create({
      documentRef: document,
      getElement: id => $(id),
      getDAW: () => getEditorDAW(),
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
    getPopup: () => (typeof _lyricPopup !== 'undefined' ? _lyricPopup : null),
    isOpen: editorPopupIsOpen,
    getDocument: editorPopupDocument,
    getSong: () => window.EditorRuntimeAdapter?.getSong?.() || null,
    getDAW: () => getEditorDAW(),
    getProjectEnd: () => getProjectEnd(),
    getTimeSignatureGridConfig: (signature, bpm) =>
      getTimeSignatureGridConfig(signature, bpm),
    timeToX: time => timeToX(time),
    getTransportPlayhead: () => getTransportPlayhead(),
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
      getDAW: () => getEditorDAW(),
      setSong: song => setEditorSong(song),
      repairSong: song => window.TextEncodingService?.repairSong?.(song) || song,
      ensureSongParsed,
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
      getDAW: () => getEditorDAW(),
      getSong: () => getCurrentEditorSong(),
      loadAudioBlobsForProject,
      getAudioBlobFromDB,
      decodeFileToBuffer,
      loadAudioFromHardDrive,
      getFileHandle,
      getDirHandle: options => {
        if (options?.load) return loadDirHandle();
        return _audioDirHandle;
      },
      setDirHandle: handle => saveDirHandle(handle),
      saveDirHandle: handle => saveDirHandle(handle),
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

let edSongImportService = null;
function getEditorSongImportService() {
  if (
    !edSongImportService &&
    typeof window.EditorSongImportService?.create === 'function'
  ) {
    edSongImportService = window.EditorSongImportService.create({
      getSong: getCurrentEditorSong,
      setSong: song => setEditorSong(song),
      getDAW: () => getEditorDAW(),
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
      setSong: song => setEditorSong(song),
      getDAW: () => getEditorDAW(),
      saveSong: () => getEditorSongPersistenceService()?.save?.(),
      onSongChanged: () => {
        try { resetPerformanceSerialization?.(); } catch (_) {}
        try { rebuildSongDocumentFromEdCur?.(); } catch (_) {}
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
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
      if (editorPopupIsOpen(_lyricPopup)) {
        try {
          const _script = editorPopupDocument(_lyricPopup)
            ?.querySelector('script[data-pv="chord"]');
          if (_script) _script.remove();
        } catch(_) {}
        setTimeout(() => { try { syncLyricPopup(); } catch(_) {} }, 50);
        setTimeout(() => { try { syncLyricPopup(); } catch(_) {} }, 300);
        setTimeout(() => { try { safeMirrorTimeline(); } catch(_) {} }, 1000);
      }
      if (editorPopupIsOpen(_lyricOnlyPopup)) {
        setTimeout(() => { try { syncLyricOnlyPopup(); } catch(_) {} }, 50);
        setTimeout(() => { try { syncLyricOnlyPopup(); } catch(_) {} }, 300);
      }
      if (typeof _forceRenderOpenPopupsFull === 'function') _forceRenderOpenPopupsFull();
      notifyPerformanceTrackChanged();
    }

    // Instant hot-swap: apply pre-built state without any async work
    function hotSwapToNextSong() {
      if (!_arrNextState) return false;
      const ns = _arrNextState;
      _arrNextState = null;
      arrPerformIdx = ns.idx;

      // ─── Reset prep log flags after successful swap ───
      _arrHasLoggedNoNextSong = false;
      _arrPrepStartedForIndex = -1;

      console.log(`[Arranger] Hot-swapping to song ${ns.idx + 1}: "${ns.song?.title || 'Untitled'}"`);

      stopAllVoices();

      // ─── پاک‌سازی نودهای صوتی ترک‌های قدیمی ───
      // این نودها هنوز به masterGain وصلی هستن و باید قطع بشن تا bleed صدا نداشته باشیم
      const transition = getEditorSongTransitionService()?.applyPreparedState({
        song: ns.song,
        clips: ns.clips,
        sections: ns.sections,
        tracks: ns.tracks,
        loopState: ns.loopState,
        arrangerMarkers: ns.arrangerMarkers
      });
      if (!transition) {
        console.error('[Arranger] Song transition service is unavailable');
        return false;
      }
      const nextStart = Math.max(
        0,
        Number(ns.playbackStart ?? ns.arrangerMarkers?.start) || 0
      );
      const requestedEnd = Number(
        ns.playbackEnd ??
        ns.selectionEnd ??
        ns.arrangerMarkers?.end ??
        ns.loopState?.loopB
      );
      const nextEnd = Number.isFinite(requestedEnd) && requestedEnd > nextStart
        ? requestedEnd
        : nextStart + 10;
      if (arrPerformActive) {
        arrangerPlaybackPolicy?.applyToDAW?.(getEditorDAW());
        selectionEnd = nextEnd;
      } else {
        selectionEnd = ns.selectionEnd;
      }
      isRecordingChords = false; currentRecordingClipId = null;

      const audio = transition.audio;
      console.log(`[Arranger] Audio clips: ${audio.loaded}/${audio.total} loaded` +
        (audio.missing > 0
          ? `, ${audio.missing} missing: ${audio.missingNames.join(', ')}`
          : ''));

      // Re-anchor both the visual and AudioContext clocks. Updating only
      // playOriginPerf/playOriginTime leaves playOriginAudio pointing at the
      // previous song, so the scheduler starts this song near the old B.
      seekTransport(arrPerformActive ? nextStart : 0, true, true);

      resetHistory();
      edSyncToolbar(); edRenderEditor(true); renderAll(); saveState();
      initHighlightEffect();

      // Update perf UI
      renderPerfUI();

      toast(`${t('songN')} ${ns.idx + 1}/${(arrPerformData||editingArr).items.length}: ${ns.song.title || t('untitled')}`);

      // If pause mode, stop playback and wait for manual next
      if (perfPauseMode) {
        pauseTransport();
        $('perfPlayBtn').textContent = '▶';
      }

      // Check if we should auto-advance after crossfade
      if (arrPerformActive && ns.idx + 1 < (arrPerformData||editingArr).items.length) prepareNextArrSong();
      // Sync popup windows, SongDocument, and embedded view
      syncUIAfterSongChange();
      // آینه آکوردها در پاپ‌آپ
      setTimeout(safeMirrorTimeline, 1000);

      return true;
    }

    /**
     * بعد از هر تعویض ترک/آهنگ صدا زده شود.
     * rebuild + full render embedded + popupها
     */
    function notifyPerformanceTrackChanged() {
      requestAnimationFrame(function () {
        if (typeof window.onPerformanceSongChanged === 'function') {
          window.onPerformanceSongChanged();
        } else if (typeof rebuildSongDocumentFromEdCur === 'function') {
          if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
        }
      });
    }

    let editorArrangerSongLoadService = null;
    function getEditorArrangerSongLoadService() {
      if (
        !editorArrangerSongLoadService &&
        typeof window.EditorArrangerSongLoadService?.create === 'function'
      ) {
        editorArrangerSongLoadService =
          window.EditorArrangerSongLoadService.create({
            getArrangement: () => arrPerformData || editingArr,
            getPerformanceState: () => ({
              active: arrPerformActive,
              index: arrPerformIdx,
              pauseMode: perfPauseMode,
              perfModeActive,
              nextState: _arrNextState,
              preparePending: arrPreparePending,
              waitPollActive: _arrWaitPollActive,
              hasLoggedNoNextSong: _arrHasLoggedNoNextSong,
              prepStartedForIndex: _arrPrepStartedForIndex
            }),
            updatePerformanceState: patch => {
              if ('active' in patch) arrPerformActive = patch.active;
              if ('index' in patch) arrPerformIdx = patch.index;
              if ('nextState' in patch) _arrNextState = patch.nextState;
              if ('preparePending' in patch) {
                arrPreparePending = patch.preparePending;
              }
              if ('waitPollActive' in patch) {
                _arrWaitPollActive = patch.waitPollActive;
              }
              if ('hasLoggedNoNextSong' in patch) {
                _arrHasLoggedNoNextSong = patch.hasLoggedNoNextSong;
              }
              if ('prepStartedForIndex' in patch) {
                _arrPrepStartedForIndex = patch.prepStartedForIndex;
              }
            },
            getAllSongs: () => edGetAllSongs(),
            getItemSetting: (...args) => getArrItemSetting(...args),
            getDAW: () => getEditorDAW(),
            loadSong: (...args) =>
              getEditorSongTransitionService()?.loadSong(...args),
            getPlaybackPolicy: () => arrangerPlaybackPolicy,
            getProjectEnd: () => getProjectEnd(),
            pauseTransport: () => pauseTransport(),
            stopAllVoices: () => stopAllVoices(),
            setSelectionEnd: value => {
              selectionEnd = value;
            },
            resetRecording: () => {
              isRecordingChords = false;
              currentRecordingClipId = null;
            },
            resetHistory: () => resetHistory(),
            syncToolbar: () => edSyncToolbar(),
            renderEditor: (...args) => edRenderEditor(...args),
            renderAll: (...args) => renderAll(...args),
            saveState: () => saveState(),
            initHighlightEffect: () => initHighlightEffect(),
            syncUIAfterSongChange: () => syncUIAfterSongChange(),
            toast: message => toast(message),
            translate: key => t(key),
            seekTransport: (...args) => seekTransport(...args),
            ensureAudioCtx: () => ensureAudioCtx(),
            startTransport: () => startTransport(),
            prepareNextSong: (...args) => prepareNextArrSong(...args),
            renderPerfUI: () => renderPerfUI(),
            mirrorTimeline: () => safeMirrorTimeline(),
            schedule: (...args) => setTimeout(...args),
            logger: console
          });
      }
      return editorArrangerSongLoadService;
    }

    async function loadArrSong(idx) {
      return getEditorArrangerSongLoadService()?.load(idx);
    }

    function setZoom(pps, anchorClientX) {
      const scroll = $('tl-scroll'); const oldPps = getEditorDAW().pxPerSecond; const newPps = clamp(pps, 5, 260);
      if (Math.abs(newPps - oldPps) < 0.01) return;
      if (getEditorDAW().isPlaying && !getEditorDAW().isScrubbing) {
        getEditorDAW().playhead = getTransportPlayhead();
      }
      let anchorTime = getEditorDAW().playhead; if (typeof anchorClientX === 'number') anchorTime = clientToTime(anchorClientX);
      const rel = timeToX(anchorTime) - scroll.scrollLeft; getEditorDAW().pxPerSecond = newPps; $('zoom-range').value = String(Math.round(newPps));
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
      setZoom(getEditorDAW().pxPerSecond * factor, getTimelineZoomAnchorX());
    }

    const MIN_LANE_HEIGHT = 32;
    const MAX_LANE_HEIGHT = 240;

    function setVerticalZoom(newH) {
      newH = clamp(Math.round(newH), MIN_LANE_HEIGHT, MAX_LANE_HEIGHT);
      if (Math.abs(newH - getEditorDAW().laneHeight) < 1) return;
      getEditorDAW().laneHeight = newH;
      document.documentElement.style.setProperty('--lane-h', newH + 'px');
      // Reset all per-lane heights to follow global zoom
      getEditorDAW().tracks.forEach(t => { t.laneHeight = null; });
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
      const vScale = getEditorDAW().laneHeight / DEFAULT_LANE_H;
      const hScale = getEditorDAW().pxPerSecond / DEFAULT_PPS;
      const combined = Math.sqrt(vScale * hScale);
      const scaled = clamp(BASE_FONT * combined, 10, 32);
      document.documentElement.style.setProperty('--zoom-font', scaled + 'px');
    }

    function setLaneHeight(trackId, newH) {
      newH = clamp(Math.round(newH), MIN_LANE_HEIGHT, MAX_LANE_HEIGHT);
      const track = getEditorDAW().tracks.find(t => t.id === trackId);
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
      setVerticalZoom(getEditorDAW().laneHeight * factor);
    }

    function getTimelineSelectionRange() {
      const daw = getEditorDAW();
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
      const daw = getEditorDAW();
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
        getDAW: () => getEditorDAW(),
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
    Object.assign(window, editorTimelineChordEditorRuntime);

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
      getDAW: () => getEditorDAW(),
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
      getTimelineState: () => getEditorDAW(),
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
    // ===== AUTO IMPORT (Rewritten — multi-artist, progress, retry, accurate counts) =====

    const autoImportStateService =
      window.EditorAutoImportStateService.create();
    const editorAutoImportFileSaveService =
      window.EditorAutoImportFileSaveService.create({
        documentRef: document,
        getElement: id => $(id),
        fetchRef: (...args) => fetch(...args),
        getSongs: () => autoImportStateService.getResults(),
        getDirectoryHandle: () =>
          autoImportStateService.getDirectoryHandle(),
        setFilesSaved: value =>
          autoImportStateService.setStat('filesSaved', value),
        setFailedFiles: files =>
          autoImportStateService.setFailedFiles(files),
        toast
      });

    // ---- Helpers ----
    function parseArtistNames(raw) {
      return raw.split(/[,\n،]+/).map(s => s.trim()).filter(s => s.length > 0);
    }
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char]));
    }
    function updateAutoArtistTags() {
      const names = parseArtistNames($('autoArtistName')?.value || '');
      const el = $('autoArtistTags');
      if (!el) return;
      el.innerHTML = names.map((n, i) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(63,184,175,0.15);border:1px solid var(--accent-teal);border-radius:6px;padding:3px 10px;font-size:0.8rem;color:var(--accent-cyan-glow);font-weight:700;">🎵 ${escapeHtml(n)}${names.length > 1 ? ` <span style="opacity:0.5;font-size:0.7rem;">#${i + 1}</span>` : ''}</span>`
      ).join('');
    }
    function normalizeKey(s) { return (s || '').replace(/\s+/g, '').toLowerCase(); }
    function songUniqueId(song) {
      // اگه URL داریم، از اون استفاده کن (هر صفحه یکتا‌ست)
      if (song.url) return normalizeKey(song.url);
      // اگه URL نداریم، artist + title
      return normalizeKey(song.artist) + '::' + normalizeKey(song.title);
    }

    const autoImportUiService = window.EditorAutoImportUiService.create({
      getElement: id => $(id)
    });

    // ---- Progress UI ----
    function updateAutoProgress(current, total, detail) {
      return autoImportUiService.updateProgress(current, total, detail);
    }
    function showProgressBar() { return autoImportUiService.showProgress(); }
    function hideProgressBar() { return autoImportUiService.hideProgress(); }

    // ---- Modal open/close ----
    function openAutoImportModal() {
      autoImportUiService.open();
      const ta = $('autoArtistName');
      if (ta && !ta._tagListenerAttached) { ta.addEventListener('input', updateAutoArtistTags); ta._tagListenerAttached = true; }
      // Show/hide cookie field based on source
      const srcSel = $('autoSource');
      if (srcSel && !srcSel._cookieListener) {
        srcSel._cookieListener = true;
        srcSel.addEventListener('change', () => {
          $('autoCookieField').style.display = srcSel.value === 'laminor' ? 'block' : 'none';
        });
        // Init on open
        $('autoCookieField').style.display = srcSel.value === 'laminor' ? 'block' : 'none';
      }
    }
    function closeAutoImportModal() { return autoImportUiService.close(); }

    function autoImportNewRequest() {
      return autoImportUiService.resetRequest();
    }

    // ---- Fetch ALL songs for one artist (server handles everything) ----
    async function fetchArtistFromServer(artistName, apiUrl, totalCount, onProgress) {
      if (onProgress) onProgress(`🎵 ${artistName} — در حال دریافت تمام ${totalCount} ترانه...`);
      console.log(`[FETCH] Starting: ${artistName} — requesting ${totalCount} songs from server`);

      try {
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artistName,
            count: totalCount,
            start: 1,
            sessionCookie: $('autoSessionCookie')?.value || ''
          })
        });
        const data = await resp.json();

        if (data.error) {
          console.log(`[FETCH] Server error: ${data.error}`);
          return { error: data.error, candidates: data.candidates, results: [] };
        }

        const got = data.results ? data.results.length : 0;
        console.log(`[FETCH] DONE: ${artistName} — server returned ${got} songs (imported: ${data.imported}, failed: ${data.failed})`);
        return { totalSongs: totalCount, results: data.results || [] };
      } catch (e) {
        console.log(`[FETCH] Network error: ${e.message}`);
        return { error: e.message, results: [] };
      }
    }

    // ---- Common Parser adapter ----
    const editorRawSongParserService = window.EditorRawSongParserService.create({
      positionMapper: requireLyricPositionMapper(),
      logger: console
    });

    function normalizeRawText(rawText) {
      return editorRawSongParserService.normalizeRawText(rawText);
    }

    function hasPersian(value) {
      return editorRawSongParserService.hasPersian(value);
    }

    function isChordOnlyLine(value) {
      return editorRawSongParserService.isChordOnlyLine(value);
    }

    function parseRawSongToEdCur(parsedSong) {
      return editorRawSongParserService.parseRawSongToEdCur(parsedSong);
    }

    // Thin wrapper for backward compatibility
    function parseSongRawText(song) {
      return parseRawSongToEdCur(song);
    }

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
        parseRawSongToEdCur,
        parseChordLyricText: rawText =>
          requireLyricsParser().parseChordLyricText(rawText),
        getEditorSongImportService,
        getDAW: () => getEditorDAW(),
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

    // ---- Save a song to archive (with proper dedup: URL + artist+title) ----
    function saveSongToArchive(song, existingSongs) {
      const songArtist = (song.artist || '').trim();
      const songTitle = (song.title || '').trim();
      const songUrlNorm = song.url ? normalizeKey(song.url) : '';
      const songAtNorm = normalizeKey(songArtist + '::' + songTitle);

      for (const es of existingSongs) {
        // چک URL
        if (songUrlNorm && es.url && normalizeKey(es.url) === songUrlNorm) {
          return { saved: false, duplicate: true };
        }
        // چک artist + title
        const esUid = normalizeKey((es.artist || '') + '::' + (es.title || ''));
        if (songAtNorm && esUid && songAtNorm === esUid) {
          return { saved: false, duplicate: true };
        }
      }

      const tmpEd = parseSongRawText(song);
      tmpEd.artist = songArtist;
      tmpEd.artistKey = archArtistKey(songArtist);
      tmpEd.title = songTitle;
      if (song.url) tmpEd.url = song.url;
      if (song.key) {
        const cleanKey = song.key.replace('m', '');
        const kMode = song.key.endsWith('m') ? 'min' : 'maj';
        if (typeof etIsValidNote === 'function' && etIsValidNote(cleanKey)) { tmpEd.key = cleanKey; tmpEd.keyMode = kMode; }
      }
      if (song.rhythm) tmpEd.timeSignature = song.rhythm;
      existingSongs.unshift(JSON.parse(JSON.stringify(tmpEd)));
      return { saved: true, duplicate: false };
    }

    // ---- Build progress detail HTML ----
    function buildProgressDetail() {
      const a = autoImportStateService.getStats();
      let d = '';
      d += `<span class="apd-ok">✓ موفق: ${a.archived}</span>  `;
      d += `<span class="apd-fail">✗ ناموفق: ${a.errors}</span>  `;
      d += `<span class="apd-dup">≈ تکراری: ${a.dupes}</span>  `;
      d += `<span class="apd-pending">◯ باقی‌مانده: ${Math.max(0, a.total - a.fetched)}</span>`;
      return d;
    }

    const editorAutoImportWorkflowService =
      window.EditorAutoImportWorkflowService.create({
        documentRef: document,
        getElement: id => $(id),
        fetchRef: (...args) => fetch(...args),
        getState: () => autoImportStateService,
        parseArtistNames,
        escapeHtml,
        updateProgress: (...args) => updateAutoProgress(...args),
        showProgress: () => showProgressBar(),
        fetchArtistFromServer: (...args) =>
          fetchArtistFromServer(...args),
        buildProgressDetail: () => buildProgressDetail(),
        saveSongToArchive: (...args) => saveSongToArchive(...args),
        getAllSongs: (...args) => edGetAllSongs(...args),
        setAllSongs: (...args) => edSetAllSongs(...args),
        toast,
        wait: milliseconds => new Promise(resolve => {
          setTimeout(resolve, milliseconds);
        }),
        logger: console
      });

    // ---- MAIN: Start Auto Import ----
    function startAutoImport() {
      return editorAutoImportWorkflowService.start();
    }

    // ---- Retry failed songs only ----
    async function autoRetryFailed() {
      const failed = autoImportStateService.getFailedSongs();
      if (!failed.length) { toast('مورد ناموفقی وجود ندارد'); return; }

      const status = $('autoImportStatus');
      const results = $('autoImportResults');
      const source = $('autoSource').value;
      const apiUrl = source === 'akord' ? '/api/akord/auto-import' : '/api/auto-import';
      showProgressBar();

      status.textContent = `🔄 تلاش مجدد برای ${failed.length} ترانه ناموفق...`;

      // Group failed by artist
      const byArtist = {};
      failed.forEach(f => { (byArtist[f.artist] = byArtist[f.artist] || []).push(f); });

      autoImportStateService.setFailedSongs([]);
      let retriedCount = 0;

      for (const [artistName, failedSongs] of Object.entries(byArtist)) {
        status.textContent = `🔄 تلاش مجدد ${escapeHtml(artistName)} (${failedSongs.length} ترانه)...`;
        updateAutoProgress(retriedCount, failed.length, `<span class="auto-progress-retry">تلاش مجدد ${escapeHtml(artistName)}...</span>`);

        const fetchResult = await fetchArtistFromServer(artistName, apiUrl, failedSongs.length, (msg) => { status.textContent = msg; });

        if (fetchResult.error) {
          autoImportStateService.addFailedSongs(failedSongs);
          retriedCount += failedSongs.length;
          continue;
        }

        // Check which failed songs are now recovered
        const recoveredUrls = new Set(fetchResult.results.filter(r => !r.error).map(r => r.url));
        const recoveredSongs = fetchResult.results.filter(r => !r.error && !r.rawText?.includes(''));

        for (const song of recoveredSongs) {
          if (!song.error && song.rawText) {
            autoImportStateService.addResults([song]);
            autoImportStateService.incrementStats({ fetched: 1 });
            // Add to archive
            const existingSongs = edGetAllSongs();
            const result = saveSongToArchive(song, existingSongs);
            if (result.saved) autoImportStateService.incrementStats({ archived: 1 });
            else if (result.duplicate) autoImportStateService.incrementStats({ dupes: 1 });
            edSetAllSongs(existingSongs);
          }
        }

        // Songs still failed
        for (const f of failedSongs) {
          if (!recoveredUrls.has(f.url)) autoImportStateService.addFailedSongs([f]);
        }
        retriedCount += failedSongs.length;
        updateAutoProgress(retriedCount, failed.length, buildProgressDetail());
      }

      const stillFailed = autoImportStateService.getFailedSongs().length;
      status.textContent = `🔄 تلاش مجدد تمام شد\nبازیابی شده: ${failed.length - stillFailed}\nباقی‌مانده ناموفق: ${stillFailed}`;
      const retryStats = autoImportStateService.getStats();
      updateAutoProgress(retryStats.fetched, retryStats.total, buildProgressDetail());
      if (stillFailed === 0) toast('✅ همه ترانه‌ها بازیابی شد!');
      else toast(`⚠️ ${stillFailed} ترانه هنوز ناموفق است`);
    }

    // ---- Save to archive (manual button) ----
    function autoImportSaveArchive() {
      const songs = autoImportStateService
        .getResults()
        .filter(s => !s.error && s.rawText);
      if (!songs.length) { toast('ترانه‌ای برای ذخیره وجود ندارد'); return;
      }
      if (!confirm(`آیا ${songs.length} ترانه در آرشیو ذخیره شود؟`)) return;

      const existingSongs = edGetAllSongs();
      let saved = 0, dupes = 0;
      for (const song of songs) {
        const result = saveSongToArchive(song, existingSongs);
        if (result.saved) saved++;
        else if (result.duplicate) dupes++;
      }
      edSetAllSongs(existingSongs);
      toast(`📁 ${saved} ترانه ذخیره شد${dupes ? '، ' + dupes + ' تکراری رد شد' : ''}`);
    }

    // ---- Save files to folder ----
    function autoImportSaveConfirm() {
      const songs = autoImportStateService
        .getResults()
        .filter(s => !s.error && s.rawText);
      if (!songs.length) { toast('فایلی برای ذخیره وجود ندارد'); return; }
      $('autoImportFolderInput').style.display = 'block';
      if (window.showDirectoryPicker) {
        window.showDirectoryPicker({ mode: 'readwrite' }).then(async dirHandle => {
          autoImportStateService.setDirectoryHandle(dirHandle);
          $('autoSavePathInput').value = dirHandle.name;
          $('autoSavePathInput').disabled = true;
        }).catch(() => {
          autoImportStateService.setDirectoryHandle(null);
          $('autoSavePathInput').disabled = false;
          $('autoSavePathInput').value = '';
        });
      } else {
        $('autoSavePathInput').disabled = false;
        $('autoSavePathInput').value = '';
      }
    }

    function autoImportDoSave() {
      return editorAutoImportFileSaveService.saveFiles();
    }

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
        keyParts.push(formatKeyName(cur.code));
        const midiLabel = midiNote ? '🎹N' + midiNote[0].replace('n','') : '';
        const midiRemoveBtn = midiNote ? `<button class="ed-btn" data-action="removeMidiMap" data-value="${escapeHtml(midiNote[0].replace('n',''))}" title="حذف MIDI" style="font-size:0.6rem;min-width:18px;height:24px;padding:0 3px;background:#e24f5b;color:#fff;border-color:#e24f5b;">✕</button>` : '';
        div.innerHTML = `<span class="shortcut-label">${escapeHtml(sk.label)}</span><div style="display:flex;gap:4px;align-items:center;"><div class="shortcut-key" data-sid="${escapeHtml(sk.id)}"><kbd>${escapeHtml(keyParts.join(' + '))}</kbd></div><button class="ed-btn" data-action="startMidiLearn" data-value="${escapeHtml(sk.id)}" title="MIDI Learn" style="font-size:0.7rem;min-width:28px;height:24px;padding:0 4px;${midiNote ? 'background:#9F7AEA;color:#fff;border-color:#9F7AEA;' : ''}">🎹${midiLabel}</button>${midiRemoveBtn}</div>`;
        div.querySelector('.shortcut-key').addEventListener('click', () => startEditShortcut(sk.id));
        list.appendChild(div);
      });
      $('shortcutModal').classList.add('show');
    }
    function closeShortcutModal() { $('shortcutModal').classList.remove('show'); _editingShortcutId = null; }
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
    function startMidiLearn(funcId) {
      midiLearnActive = true;
      midiLearnTargetId = funcId;
      const btn = document.querySelector(`[data-action="${funcId}"]`);
      if (btn) btn.classList.add('mapping-active');
      let toastEl = document.querySelector('.mapping-toast');
      if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'mapping-toast'; document.body.appendChild(toastEl); }
      const label = SHORTCUT_DEFAULTS.find(s => s.id === funcId)?.label || funcId;
      toastEl.textContent = '🎹 «' + label + '» — نت MIDI را بزنید...';
      toastEl.style.display = 'block';
    }
    function handleMidiLearnInput(note) {
      if (!midiLearnActive || !midiLearnTargetId) return;
      setMidiMap(note, midiLearnTargetId);
      midiLearnActive = false;
      midiLearnTargetId = null;
      const btn = document.querySelector(`[data-action="${midiLearnTargetId}"]`);
      if (btn) btn.classList.remove('mapping-active');
      openShortcutModal();
      toast('🎹 MIDI mapping ذخیره شد: Note ' + note);
    }
    loadMidiMaps();

    // Global shortcut capture for editing.
    // EventBindings is responsible for registering this handler.
    function handleGlobalKeydownCapture(e) {
      return getEditorKeyboardService()?.handleGlobalKeydownCapture?.(e);
    }

    // Main global shortcuts handler.
    // EventBindings is responsible for registering this handler.
    function handleGlobalKeydown(e) {
      const keyboardService = getEditorKeyboardService();
      if (keyboardService?.handleKeydown?.(e)) return true;
      return keyboardService?.handleGlobalKeydown?.(e);
    }

    function handleGlobalKeyup(e) {
      return getEditorKeyboardService()?.handleGlobalKeyup?.(e);
    }

    function handleGlobalDocumentKeydown(e) {
      return getEditorKeyboardService()?.handleAuxiliaryKeydown?.(e);
    }

    /* ===================== INIT & INTERACTIONS ===================== */
    function init() {
      ensureAudioCtx();
      getEditorDAW().tracks = [
        { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
        { id: 't0s', name: 'Section', icon: '🏷', type: 'section' },
        { id: 't1', name: 'Vocals', icon: '🎤', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't2', name: 'Guitar', icon: '🎸', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't3', name: 'Bass', icon: '🎵', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't4', name: 'Keys', icon: '🎹', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't5', name: 'Drums', icon: '🥁', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 }
      ];
      getEditorDAW().tracks.forEach(t => {
        if (t.type === 'audio') {
          t._pannerNode = getEditorDAW().audioCtx.createStereoPanner(); t._gainNode = getEditorDAW().audioCtx.createGain();
          t._pannerNode.connect(t._gainNode); t._gainNode.connect(getEditorDAW().masterGain); updateTrackMix(t.id);
        }
      });
      ensureRecLane();
      getEditorDAW().sections = []; getEditorDAW().selectedSectionIds = new Set();
      getEditorDAW().timelineDuration = 120; getEditorDAW().pxPerSecond = 70; saveState(); renderAll();
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
        getDAW: () => getEditorDAW(),
        setVerticalZoom: value => setVerticalZoom(value),
        setZoom: (...args) => setZoom(...args),
        toast,
        translate: t,
        clearEditorTextSelection,
        clearChordSelection: () => edClearChordSelection(),
        clearSelection,
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
        clearSelection();
      });

      // Update loop toggle button state
      const loopBtn = $('loopToggleBtn');
      if (loopBtn) loopBtn.classList.toggle('loop-active', getEditorDAW().loopEnabled);
      renderLoopRegion();

      // ===== DRAG & DROP audio files onto timeline =====
      const tlScroll = $('tl-scroll');

      const audioDropService = window.AudioDropImportService?.create?.({
        getDAW: () => getEditorDAW(),
        getSong: getCurrentEditorSong,
        clearSelection,
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
      window.initSyncUI?.();

    /* ===================================================================
       LYRIC & CHORD EDITOR (integrated into workspace)
       =================================================================== */

    // -- Song Data --
    const ED_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const ED_FLAT_NOTES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
    const ED_ALL_NOTE_NAMES = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'];
    const ED_SEMITONE = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11};
    const ED_NOTE_TO_SHARP = { 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#' };
    const ED_NOTE_TO_FLAT = { 'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab', 'A#':'Bb' };
    const ED_FLAT_MAP = { 1:'Db', 3:'Eb', 6:'Gb', 8:'Ab', 10:'Bb' };
    
    // Accidental preference: 'sharp' | 'flat' | 'auto'
    let ED_ACCIDENTAL_PREF = 'auto';

    // Validate a note/key root accepts BOTH sharps and flats (e.g. 'Bb','Eb','F#','Db').
    function etIsValidNote(n) {
      if (!n) return false;
      return ED_ALL_NOTE_NAMES.includes(n) || ED_SEMITONE[n] != null;
    }
    const ED_TYPES = ['','m','7','maj7','m7','dim','aug','sus2','sus4','6','m6','m7b5'];
    const ED_TENS = ['','add9','9','11','13','b9','#9','#11','b13'];

    let edCur = window.EditorRuntimeAdapter?.getSong?.() || null;
    window.EdCurAdapter?.onChange?.((_eventName, song) => {
      edCur = song;
    });
    setEditorSong(edCur);

    // The editor keeps a local mutation mirror; runtime ownership stays in
    // EditorRuntimeAdapter/EdCurAdapter.
    function getCurrentEditorSong() {
      return window.EditorRuntimeAdapter?.getSong?.() || null;
    }

    let edUndoStack = [], edRedoStack = [];
    let edChordIdx = null, edPendingAnchor = null;
    let edTransposing = 0;
    let edChordDragActive = false;
    let edChordsVisible = true;
    let edSeqModeActive = false, edSeqPoints = [], edSeqChordingActive = false, edSeqCursor = 0;
    let edChordModalMode = null;

    let edInputRenderTimer = null;
    let edSaveTimer = null;
    let edCommitTimer = null;

function edScheduleEditorRefresh() {
  clearTimeout(edInputRenderTimer);
  edInputRenderTimer = setTimeout(() => {
    if (!edCur) return;
    edRenderEditor(false);
  }, 80);
}

function edScheduleSave() {
  clearTimeout(edSaveTimer);
  edSaveTimer = setTimeout(() => {
    if (!edCur) return;
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
      const service = window.EditorSongInitializationService;
      const defaults = {
        storage: localStorage,
        getSong: getCurrentEditorSong,
        setSong: setEditorSong,
        blankSong: edBlankSong,
        repairSong: song => window.TextEncodingService?.repairSong?.(song) || song,
        hydrationService: window.EditorHydrationService,
        documentRef: document,
        daw: getEditorDAW(),
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
          if (options?.load) return loadDirHandle();
          return _audioDirHandle;
        },
        setDirHandle: handle => saveDirHandle(handle),
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
          if (typeof rebuildSongDocumentFromEdCur === 'function') {
            rebuildSongDocumentFromEdCur();
          }
        },
        syncViewStyles: () => {
          if (typeof syncViewStylesFromEdCur === 'function') {
            syncViewStylesFromEdCur();
          }
        },
        toast
      };
      edSongInitializationOptions = defaults;

      if (typeof service?.create === 'function') {
        edSongInitializationService = service.create(defaults);
      } else if (
        typeof service?.initializeEditor === 'function' ||
        typeof service?.initialize === 'function'
      ) {
        // Compatibility path for an older loaded service during hot-swap.
        edSongInitializationService = service;
      }
    }
    return edSongInitializationService;
  }

  async function edInitSong() {
    const initializationService = getEditorSongInitializationService();
    const initializeEditor = initializationService?.initializeEditor
      || initializationService?.initialize;
    return initializeEditor?.({
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

    async function edExportProjectFull({ targetPath = null } = {}) {
      const song = getCurrentEditorSong();
      const exportService = getEditorProjectExportService();
      if (!song || !exportService) {
        toast('ترانه‌ای باز نیست');
        return;
      }

      try {
        const bundle = await exportService.buildBundle({
          song,
          daw: getEditorDAW(),
          onAudioProgress: ({ index, total }) => {
            toast(`رمزگذاری صدا ${index}/${total}...`);
          }
        });
        if (!bundle) {
          toast('ترانه‌ای باز نیست');
          return;
        }

      const { defaultName, data, audioCount, linkedCount } = bundle;
      const blob = new Blob([data], { type: 'application/json' });

      const sizeMB = (blob.size / (1024*1024)).toFixed(1);

      const nativeSave = await getEditorProjectFileService()?.saveNative?.({
        data,
        defaultPath: defaultName,
        targetPath
      });
      if (nativeSave?.handled) {
        if (nativeSave.cancelled) {
          toast('لغو شد');
          return;
        }
        toast(`خروجی ذخیره شد (${sizeMB} MB, ${audioCount} کپی + ${linkedCount} لینک)`);
        refreshStorageInfo();
        return;
      }

      const linkedInfo = linkedCount > 0 ? `\nلینک‌شده: ${linkedCount} فایل (بدون صدا)` : '';
      const browserSave = await getEditorProjectExportRouteService()?.saveBrowser?.({
        blob,
        defaultName,
        pickerOptions: {
          suggestedName: defaultName,
          types: [{
            description: 'فایل پروژه کامل',
            accept: { 'application/json': ['.json'] }
          }]
        },
        confirmMessage: `دانلود فایل: ${defaultName}\nحجم: ${sizeMB} MB\nصدا: ${audioCount} کپی‌شده${linkedInfo}\n\nذخیره در پوشه دانلود؟`
      });
      if (!browserSave?.handled) {
        throw new Error('EditorProjectExportRouteService در دسترس نیست');
      }
      if (browserSave.status === 'cancelled') {
        toast('لغو شد');
        return;
      }
      toast(`خروجی ذخیره شد (${sizeMB} MB, ${audioCount} کپی + ${linkedCount} لینک)`);
      refreshStorageInfo();
      } catch(e) { console.error('Export error:', e); toast('خطا در خروجی: ' + e.message); }
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
          getDAW: () => getEditorDAW(),
          syncMetadata: song => SongMetadata.syncFromDom(song),
          artistKey: artist => archArtistKey(artist),
          storage: localStorage,
          scheduleAudioBlobSave: () => scheduleAudioBlobSave(),
          rebuildSongDocument: () => {
            if (typeof rebuildSongDocumentFromEdCur === 'function') {
              rebuildSongDocumentFromEdCur();
            }
          },
          syncViewStyles: () => {
            if (typeof syncViewStylesToEdCur === 'function') {
              syncViewStylesToEdCur();
            }
          }
        });
      }
      return edSongPersistenceService;
    }

    function edSaveSong() {
      return getEditorSongPersistenceService()?.save?.() || false;
    }



    // ===== ARCHIVE SYSTEM — منتقل‌شده به js/archive/ArchiveModule.js (Commit 3) =====
    // اعلان _audioDirHandle عمداً اینجا می‌ماند چون ناحیهٔ Storage (بالای فایل) به آن نیاز دارد:
    let _audioDirHandle = null;


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
      if (!edCur) return;
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
      if (typeof ED_ACCIDENTAL_PREF !== 'undefined') {
        if (ED_ACCIDENTAL_PREF === 'sharp') return true;
        if (ED_ACCIDENTAL_PREF === 'flat') return false;
      }
      if (typeof window.TransposeService === 'object' && window.TransposeService && typeof window.TransposeService.keySignaturePreference === 'function') {
        const key = edCur?.originalKey || edCur?.key;
        const fromKey = key ? (key.endsWith('m') ? key.slice(0, -1) : key) : null;
        if (fromKey) {
          const preference = window.TransposeService.keySignaturePreference(fromKey);
          if (preference === true || preference === false) return preference;
        }
      }
      return null; // auto
    }

    function edBaseNameFromDisplayed(name) {
      const transpose = Number(edCur?.transpose) || 0;
      return transpose && name ? edTransposeChord(name, -transpose) : (name || '');
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
      getEditorChordStateService()?.syncBaseChordName(edCur, index);
    }

    function edRemoveChordAt(index) {
      getEditorChordStateService()?.removeChordAt(edCur, index);
    }

    function edFilterChordsWithBase(predicate) {
      getEditorChordStateService()?.filterChordsWithBase(edCur, predicate);
    }

    function edEnsureBaseChordNamesAligned() {
      return getEditorChordStateService()?.ensureBaseChordNamesAligned(edCur) || [];
    }

    // ===== دیز/بمل/خودکار selector =====
    // Persist accidental preference and inject a small dropdown into the header.
    function initAccidentalSelector() {
      try {
        const saved = localStorage.getItem('ed_accidental_pref');
        if (saved === 'sharp' || saved === 'flat' || saved === 'auto') ED_ACCIDENTAL_PREF = saved;
      } catch(_) {}
      const host = document.getElementById('headerCenterControls');
      if (!host || document.getElementById('edAccidentalSel')) return;
      const wrap = document.createElement('div');
      wrap.className = 'ed-grp';
      wrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';
      const label = document.createElement('span');
      label.textContent = 'نت:';
      label.style.cssText = 'font-size:0.7rem;color:var(--text-secondary);';
      const sel = document.createElement('select');
      sel.id = 'edAccidentalSel';
      sel.style.cssText = 'background:#0D1117;color:#E2E8F0;border:1px solid #30363D;border-radius:6px;padding:2px 6px;font-size:0.75rem;cursor:pointer;';
      const opts = [['auto','خودکار'],['sharp','دیز ♯'],['flat','بمل ♭']];
      opts.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); });
      sel.value = ED_ACCIDENTAL_PREF;
      sel.addEventListener('change', () => {
        ED_ACCIDENTAL_PREF = sel.value;
        try { localStorage.setItem('ed_accidental_pref', ED_ACCIDENTAL_PREF); } catch(_) {}
        // Re-apply current transpose/key so display updates immediately
        if (edCur) {
          if (edCur.transpose) applyTranspose(edCur.transpose);
          else { refreshKeyUI(); renderAllChordsAndText(); }
        }
        toast('نمایش نت: ' + (ED_ACCIDENTAL_PREF === 'sharp' ? 'دیز ♯' : ED_ACCIDENTAL_PREF === 'flat' ? 'بمل ♭' : 'خودکار'));
      });
      wrap.appendChild(label);
      wrap.appendChild(sel);
      host.appendChild(wrap);
    }

    function edTransposeChord(name, semi) {
      if (!semi || !name) return name;
      return window.EditorNotationService?.transposeChord(
        name,
        semi,
        resolveAccidentalPreference()
      ) || name;
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
          if (editorPopupIsOpen(_lyricPopup)) {
            setTimeout(() => syncLyricPopup(), 100);
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
    function edGetLyricsFromDOM() { return $('editor')?.innerText?.replace(/\u200B/g,'').replace(/\r\n?/g,'\n') || ''; }

    function edRemapAnchors(oldText, newText) {
      const songState = getEditorSongStateService();
      if (oldText === newText || !songState?.currentSong?.()) return;
      // منطق remap به js/editor/LyricPositionMapper.js منتقل شده است.
      songState.getChords().forEach(ch =>
        requireLyricPositionMapper().remapAnchorToNewText(ch, oldText, newText)
      );
      edFilterChordsWithBase(ch => ch.lineIndex >= 0);
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
          isLocked: () => Boolean(edCur?.editorLocked),
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
          getSongState: () => getEditorSongStateService(),
          getEditor: () => $('editor'),
          getEditorWrap: () => $('editorWrap'),
          getEditorText: () => edGetLyricsFromDOM(),
          executeCommand: (...args) => document.execCommand?.(...args),
          remapAnchors: (oldText, newText) => edRemapAnchors(oldText, newText),
          remapSequencePoints: (oldText, newText) =>
            edRemapSeqPoints(oldText, newText),
          scheduleEditorRefresh: () => edScheduleEditorRefresh(),
          scheduleCommit: () => {
            clearTimeout(edCommitTimer);
            edCommitTimer = setTimeout(() => edCommit(), 300);
          },
          scheduleSave: () => edScheduleSave(),
          clearSelection,
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
            if (typeof rebuildSongDocumentFromEdCur === 'function') {
              rebuildSongDocumentFromEdCur();
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

    // History command wrappers are kept in the editor scope so keyboard,
    // toolbar and legacy inline callers share the same implementation.
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
    if (!edCur || edCur.editorLocked) return;
    const result = getEditorMutationService()?.removeAsterisks(edCur);
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
    if (!edCur || edCur.editorLocked || !edCur.chords.length) {
      toast('آکوردی وجود ندارد');
      return;
    }
    if (!confirm('⚠️ آیا مطمئن هستید؟ این کار ترتیب موسیقایی آکوردها را در هر خط برعکس می‌کند و فقط برای موارد خاص کاربرد دارد.')) {
      return;
    }
    const result = getEditorMutationService()?.reverseChords(edCur);
    if (!result?.changed) return;
    edRenderEditor(true);
    edSaveSong();
    toast('ترتیب آکورد هر خط برعکس شد (فقط برای موارد خاص)');
  };
}

if ($('edDoBoth')) {
  $('edDoBoth').onclick = () => {
    if (!edCur || edCur.editorLocked) return;
    getEditorMutationService()?.removeAndReverse(edCur);
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
          getDAW: () => getEditorDAW(),
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
      if (!edCur || edChordModalMode !== 'editor') return;
      const commandService = getEditorChordCommandService();
      const name = commandService
        ? commandService.normalizeName($('chordManual')?.value || '')
        : ($('chordManual')?.value || '').trim();
      if (!name) { edCloseChordModal(); return; }
      const chordIndex = edChordIdx;
      const pendingAnchor = edPendingAnchor;
      if (commandService) {
        commandService.applyName(edCur, chordIndex, pendingAnchor, name);
      } else if (chordIndex !== null && edCur.chords[chordIndex]) {
        edCur.chords[chordIndex].name = name;
        edSyncBaseChordName(chordIndex);
      } else if (pendingAnchor) {
        edCur.chords.push({ ...pendingAnchor, name });
        if (!edCur.baseChordNames) edCur.baseChordNames = [];
        edCur.baseChordNames.push(edBaseNameFromDisplayed(name));
      }
      edPendingAnchor = null; edChordIdx = null;
      edCloseChordModal(); edRenderChords(); edCommit();
      // Sequential chording: advance cursor
      if (edSeqChordingActive) {
        if (edSeqCursor < edSeqPoints.length - 1) {
          edSeqCursor++;
          edRenderChords();
        } else {
          const seqStart = edCur.chords.length - edSeqPoints.length;
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
      if (edChordIdx !== null && edCur) {
        edRemoveChordAt(edChordIdx);
      }
      edCloseChordModal(); edRenderChords(); edCommit();
    }

    // -- Transposition --
    let _edSyncingKey = false; // flag to prevent onchange during programmatic key update
    let edKeyCommandService = null;
    function getEditorKeyCommandService() {
      if (
        !edKeyCommandService &&
        typeof window.EditorKeyCommandService?.create === 'function'
      ) {
        edKeyCommandService = window.EditorKeyCommandService.create({
          transposeChord: (name, semitones) => edTransposeChord(name, semitones),
          transposeKey: (key, semitones, preferSharp) =>
            window.EditorNotationService?.transposeKey(
              key,
              semitones,
              preferSharp
            ) || key,
          keyDelta: (fromKey, toKey) =>
            window.EditorNotationService?.keyDelta(fromKey, toKey),
          ensureBaseChordNamesAligned: song =>
            getEditorChordStateService()?.ensureBaseChordNamesAligned(song)
        });
      }
      return edKeyCommandService;
    }

    function edTransposeKeyName(key, semitones) {
      return getEditorKeyCommandService()?.transposeKeyName(
        key,
        semitones,
        resolveAccidentalPreference()
      ) || key;
    }

    // ===== Convert Accidental Spelling (دیز/بمل toggle) =====
    // Toggles the accidental spelling of ALL current chords WITHOUT changing the key.
    // If chords currently use sharps → convert to flats; if flats → convert to sharps.
    function edToggleAccidental() {
      if (!edCur || edCur.editorLocked) { toast('🔒 ویرایشگر قفل است'); return; }
      const cc = typeof window.TransposeService === 'object' && window.TransposeService &&
        typeof window.TransposeService.convertAccidentals === 'function'
        ? window.TransposeService.convertAccidentals
        : null;
      if (!cc) { toast('موتور آکورد در دسترس نیست'); return; }

      // Determine current dominant spelling by looking at first accidental chord
      let toFlat = true; // default: convert sharps → flats
      const withAcc = (edCur.chords || []).map(c => c.name || '').filter(n => /[#♯]|[b♭]/.test(n));
      if (withAcc.length && withAcc.every(n => /[b♭]/.test(n))) toFlat = false; // currently flats → to sharp

      let converted = 0;
      (edCur.chords || []).forEach(ch => {
        if (!ch.name) return;
        const newName = cc(ch.name, toFlat);
        if (newName !== ch.name) { ch.name = newName; converted++; }
      });
      // Also convert baseChordNames so future transpose stays consistent
      if (edCur.baseChordNames && edCur.baseChordNames.length) {
        edCur.baseChordNames = edCur.baseChordNames.map(n => n ? cc(n, toFlat) : n);
      }
      if (converted === 0) { toast('آکوردی برای تبدیل یافت نشد'); return; }
      edRenderChords(true);
      edRenderEditor(false);
      syncTransposeToTimelineChords();
      edSaveSong();
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
      toast(toFlat ? 'آکوردها به بمل ♭ تبدیل شدند (' + converted + ')' : 'آکوردها به دیز ♯ تبدیل شدند (' + converted + ')');
    }

    // ===== CENTRAL KEY/TRANSPOSE FUNCTIONS =====
    function keyToSemi(key) {
      return getEditorKeyCommandService()?.keyToSemi(key) ?? -1;
    }
    function keyDelta(fromKey, toKey) {
      return getEditorKeyCommandService()?.keyDelta(fromKey, toKey) ?? 0;
    }
    function transposeChordNamesInPlace(chords, semitones) {
      return getEditorKeyCommandService()?.transposeChordNamesInPlace(
        chords,
        semitones
      ) || 0;
    }

    // Central refresh: update all UI from state
    function refreshKeyUI() {
      _edSyncingKey = true;
      if (edCur) {
        if ($('edKey')) $('edKey').value = edCur.key || 'C';
        if ($('edKeyMode')) $('edKeyMode').value = edCur.keyMode || 'maj';
      }
      _edSyncingKey = false;
      // Original key label
      const origLabel = $('edOrigKeyLabel');
      if (origLabel && edCur) {
        const origKey = edCur.originalKey || edCur.key;
        const origMode = edCur.originalKeyMode || edCur.keyMode;
        origLabel.textContent = '🎵 ' + origKey + (origMode === 'min' ? 'm' : '');
        origLabel.title = 'گام اورجینال: ' + origKey + (origMode === 'min' ? 'm' : '') + ' | کلیک=تغییر | Alt+کلیک=انتقال به گام پروژه';
      }
      // Transpose display
      const v = edCur?.transpose || 0;
      if ($('edTransVal')) $('edTransVal').textContent = (v > 0 ? '+' : '') + v;
    }

    function renderAllChordsAndText() {
      edRenderChords(true);
      edRenderEditor(false);
      syncTransposeToTimelineChords();
    }

    // TRANSPOSE: always compute from baseChordNames (never from already-transposed chords)
    function applyTranspose(newTranspose) {
      const result = getEditorKeyCommandService()?.applyTranspose(
        edCur,
        newTranspose,
        resolveAccidentalPreference()
      );
      if (!result?.changed) return;
      // همگام‌سازی ترنسپز با ورژن فعال فعلی
      if (typeof saveCurrentVersion === 'function') saveCurrentVersion();
      refreshKeyUI();
      renderAllChordsAndText();
      edSaveSong();
      // === Performance Architecture v2: sync transpose immediately ===
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
    }

    // KEY CHANGE: only modify chord names in current state (from baseChordNames)
    function applyKeyChange(newKey, newMode) {
      const result = getEditorKeyCommandService()?.applyKeyChange(
        edCur,
        newKey,
        newMode
      );
      if (!result?.changed) return;
      refreshKeyUI();
      renderAllChordsAndText();
      edSaveSong();
      // === Performance Architecture v2: sync key change ===
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
    }

    // ORIGINAL KEY CHANGE: edit the base-key reference without moving the project
    function applyOriginalKeyChange(newKey, newMode) {
      const result = getEditorKeyCommandService()?.applyOriginalKeyChange(
        edCur,
        newKey,
        newMode
      );
      if (!result?.changed) return;
      if (typeof saveCurrentVersion === 'function') saveCurrentVersion();
      refreshKeyUI();
      renderAllChordsAndText();
      edSaveSong();
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
    }

    // ALT+CLICK: make the project key equal to the independent original key.
    function syncProjectKeyToOriginal() {
      const result = getEditorKeyCommandService()?.syncProjectKeyToOriginal(edCur);
      if (!result?.changed) return;
      if (typeof saveCurrentVersion === 'function') saveCurrentVersion();
      refreshKeyUI();
      renderAllChordsAndText();
      edSaveSong();
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
    }

    // RESET TO ORIGINAL: restore chord names from baseChordNames, preserve positions
    function resetToOriginalKey() {
      const result = getEditorKeyCommandService()?.resetToOriginalKey(edCur);
      if (!result?.changed) return;
      refreshKeyUI();
      renderAllChordsAndText();
      edSaveSong();
    }
    if ($('edTransUp')) $('edTransUp').onclick = () => { if (edCur && edCur.editorLocked) { toast('🔒 ویرایشگر قفل است'); return; } if (edCur) applyTranspose((edCur.transpose || 0) + 1); };
    if ($('edTransDown')) $('edTransDown').onclick = () => { if (edCur && edCur.editorLocked) { toast('🔒 ویرایشگر قفل است'); return; } if (edCur) applyTranspose((edCur.transpose || 0) - 1); };
    if ($('edTransVal')) $('edTransVal').addEventListener('dblclick', () => { if (edCur) applyTranspose(0); });
    // Toggle دیز/بمل برای همه آکوردها (بدون تغییر گام)
    if ($('edToggleAccidental')) $('edToggleAccidental').onclick = () => edToggleAccidental();

    // Click on original key label → edit, Alt+Click → project key = original key
    if ($('edOrigKeyLabel')) $('edOrigKeyLabel').addEventListener('click', (e) => {
      if (!edCur) return;
      if (edCur.editorLocked) {
        toast('🔒 ویرایشگر قفل است');
        return;
      }

      // Alt+Click → set the project key to the independent original key.
      if (e.altKey) {
        const originalKey = edCur.originalKey || edCur.key || 'C';
        const originalMode = edCur.originalKeyMode || edCur.keyMode || 'maj';
        syncProjectKeyToOriginal();
        toast('گام پروژه با گام اورجینال یکی شد: ' + originalKey + (originalMode === 'min' ? 'm' : ''));
        return;
      }

      // Normal click → change original key
      const curOrigKey = edCur.originalKey || edCur.key;
      const curOrigMode = edCur.originalKeyMode || edCur.keyMode || 'maj';
      const curOrigStr = curOrigKey + (curOrigMode === 'min' ? 'm' : '');
      const promptFn = typeof customPrompt === 'function'
        ? customPrompt
        : (typeof window.customPrompt === 'function'
          ? window.customPrompt
          : (message, defaultValue) => Promise.resolve(window.prompt(message, defaultValue)));
      promptFn('گام اورجینال آهنگ رو مشخص کنید:', curOrigStr).then((newOrig) => {
        if (!newOrig || newOrig.trim() === '' || newOrig.trim() === curOrigStr) return;
        const val = newOrig.trim();
        let newKey, newMode;
        if (val.endsWith('m') && val.length > 1) {
          newKey = val.replace(/m$/, '');
          newMode = 'min';
        } else {
          newKey = val;
          newMode = 'maj';
        }
        if (typeof etIsValidNote === 'function' && !etIsValidNote(newKey)) {
          toast('گام نامعتبر: ' + newKey);
          return;
        }
        applyOriginalKeyChange(newKey, newMode);
        toast('گام اورجینال ذخیره شد: ' + newKey + (newMode === 'min' ? 'm' : ''));
      });
    });

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
          isKeySyncing: () => _edSyncingKey,
          archArtistKey,
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
          noteNames: typeof ED_ALL_NOTE_NAMES !== 'undefined'
            ? ED_ALL_NOTE_NAMES
            : []
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
      const daw = typeof getEditorDAW === 'function' ? getEditorDAW() : null;
      return Boolean(
        daw?.clips?.some(clip =>
          clip?.type === 'chord' && daw.selectedIds?.has(clip.id)
        )
      );
    }

    // -- Keyboard Shortcuts for Editor (chord modal + chord movement) --
    let edKeyboardService = null;
    function getEditorKeyboardService() {
      if (
        !edKeyboardService &&
        typeof window.EditorKeyboardService?.create === 'function'
      ) {
        edKeyboardService = window.EditorKeyboardService.create({
          windowRef: window,
          isChordModalOpen: () =>
            $('chord-modal')?.classList.contains('show'),
          isEditorChordModal: () => edChordModalMode === 'editor',
          getChordIndex: () => edChordIdx,
          isEditorLocked: () => Boolean(edCur?.editorLocked),
          hasSelectedChords: () => edSelectedChords.length > 0,
          hasSelectedChordLineClip,
          isSequentialChordingActive: () => edSeqChordingActive,
          isShortcutEditing: () => Boolean(_editingShortcutId),
          getShortcutMatch: (event, id) => matchShortcut(event, id),
          getDAW: () => getEditorDAW(),
          getGridConfig: () =>
            getTimeSignatureGridConfig(
              $('edTimeSig')?.value || '4/4',
              parseInt($('edTempo')?.value, 10) || 120
            ),
          onCancelShortcutEdit: () => {
            _editingShortcutId = null;
            openShortcutModal();
          },
          onFinishShortcutEdit: (code, ctrl, shift) =>
            finishEditShortcut(code, ctrl, shift),
          onSetLoopFromSelectionAndPlay: () => setLoopFromSelectionAndPlay(),
          isPerfModeActive: () => perfModeActive,
          onPerfTogglePlay: () => perfTogglePlay(),
          onTogglePlay: () => togglePlay(),
          onUndo: () => undo(),
          onRedo: () => redo(),
          onFullscreen: () => {
            if (!getEditorDAW().isPlaying) {
              ensureAudioCtx();
              if (getEditorDAW().playhead <= 0) seekTransport(0, false);
              startTransport();
            }
            openLyricOnlyPopup();
            setTimeout(openLyricPopup, 300);
          },
          onFocusMode: () => toggleFocusMode(),
          onSeek: (time, snap, noSnap) => seekTransport(time, snap, noSnap),
          onDeleteSelectedClips: () => deleteSelected(),
          onSplitSelected: () => splitSelectedAtPlayhead(),
          onCopySelected: () => copySelected(),
          onCutSelected: () => cutSelected(),
          onPasteClipboard: () => pasteClipboard(),
          onSelectAllClips: () =>
            setSelection(getEditorDAW().clips.map(clip => clip.id)),
          onDuplicateSelected: () => duplicateSelected(),
          onGoStart: () => transportToStart(),
          onSetLoopFromSelection: () => setLoopFromSelection(),
          onToggleLoop: () => toggleLoop(),
          onSetLoopA: () => setLoopA(),
          onSetLoopB: () => setLoopB(),
          onTogglePlayheadMode: () => togglePlayheadMode(),
          onToggleMetronome: () => toggleMetronome(),
          onToggleRecording: () => toggleRec(),
          onToggleSelectedTrackHeight: () => toggleSelectedTrackHeight(),
          onZoomHorizontal: zoomIn => zoomTimelineHorizontal(zoomIn ? 1 : -1),
          onZoomVertical: zoomIn => zoomTimelineVertical(zoomIn ? 1 : -1),
          onZoomToSelection: () => zoomTimelineToSelection(),
          onZoomFull: () => zoomTimelineFull(),
          isFocusMode: () => _focusMode,
          isSyncActive: () => syncActive,
          onSyncTap: () => syncTap(),
          onExitSyncMode: () => {
            exitSyncMode();
            const tab = $('tab-sync');
            if (tab) tab.classList.remove('active-teal');
          },
          onClearSelection: () => clearSelection(),
          onHideCutGuide: () => {
            const guide = $('cut-guide');
            if (guide) guide.style.display = 'none';
          },
          isColorToolActive: () => isColorToolActive(),
          onToggleColorBrush: () => toggleColorTool('brush'),
          onToggleColorEyedropper: () => toggleColorTool('eyedropper'),
          onDeactivateColorTool: () => deactivateColorTool(),
          getMappingTarget: () =>
            getKeyboardMappingService()?.getTarget?.() || null,
          onCancelMapping: () => getKeyboardMappingService()?.cancel?.(),
          onTogglePanel: panel => togglePanel(panel),
          onPerfStop: () => perfStop(),
          onPerfNextSong: () => perfNextSong(),
          onPerfPrevSong: () => perfPrevSong(),
          onPerfRestartSong: () => perfRestartSong(),
          onPerfToggleStageMode: () => perfToggleStageMode(),
          onPerfTranspose: delta => perfTranspose(delta),
          onPerfTogglePauseMode: () => perfTogglePauseMode(),
          onCloseChordModal: () => edCloseChordModal(),
          onConfirmChord: () => edConfirmChord(),
          onTapTempo: () => tapTempo(),
          onQuantizeSelectedChords: () => quantizeSelectedChords(),
          onChordLineTap: () => edClTap(),
          onSequentialEnter: () => {
            const chords = getEditorSongStateService()?.getChords?.() || [];
            const seqIdx = chords.length - edSeqPoints.length + edSeqCursor;
            edOpenChordModal(seqIdx);
          },
          onNavigateChord: direction => edNavigateChord(direction),
          onMoveSelectedChords: direction => {
            const mutation = getEditorMutationService();
            const changed = mutation?.moveChords(
              edCur,
              edSelectedChords,
              direction,
              lineIndex => $('editor')?.children[lineIndex]?.textContent
                ?.replace(/\u200B/g, '').length || 0,
              isEditorVisualRTL()
            )?.changed;
            if (changed) {
              edRenderChords();
              edCommit();
            }
          },
          onDeleteSelectedChords: () => {
            const deleted = getEditorMutationService()?.deleteChords(
              edCur,
              edSelectedChords
            )?.changed;
            if (deleted) {
              edClearChordSelection();
              edRenderChords();
              edCommit();
            }
          }
        });
      }
      return edKeyboardService;
    }

    // Navigate between chords in modal
    function edNavigateChord(dir) {
      if (edChordIdx === null || !edCur) return;
      const newName = $('chordManual')?.value?.trim();
      if (newName && edCur.chords[edChordIdx]) {
        edCur.chords[edChordIdx].name = newName;
        edSyncBaseChordName(edChordIdx);
      }
      const newIdx = edChordIdx + dir;
      if (newIdx >= 0 && newIdx < edCur.chords.length) {
        edChordIdx = newIdx;
        $('chordManual').value = edCur.chords[newIdx].name;
        if ($('chord-preview')) $('chord-preview').textContent = edCur.chords[newIdx].name;
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
      'fullscreen': () => { if (!getEditorDAW().isPlaying) { ensureAudioCtx(); if (getEditorDAW().playhead <= 0) seekTransport(0, false); startTransport(); } openLyricOnlyPopup(); setTimeout(openLyricPopup, 300); },
      'singerView': openLyricOnlyPopup,
      'playerView': (typeof openPlayerView === 'function') ? openPlayerView : openLyricPopup,
      'split': splitSelectedAtPlayhead, 'copy': copySelected, 'cut': cutSelected, 'paste': pasteClipboard,
      'projectHubOpen': () => window.ProjectHub?.open(),
      'archiveOpen': edOpenArchive,
      'quickSearchOpen': () => window.openQuickSearchPanel(),
      'archiveSave': () => edSaveToArchive().then(() => toast('ذخیره شد')),
      'songNew': edNewSong,
      'projectExport': edExportProject,
      'autoImportOpen': openAutoImportModal,
      'chordImportOpen': openImportChordModal,
      'projectImport': edImportProject,
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
      tapTempo: () => tapTempo(),
      detectTempo: () => detectTempo(),
      detectKey: () => detectKey(),
      toggleMIDITab: () => toggleMIDITab(),
      toggleMIDISync: () => toggleMIDISync(),
      toggleMidiMonitor: () => toggleMidiMonitor(),
      setHighlightEffect: (_, element) => setHighlightEffect(element.dataset.value),
      toggleRec: () => toggleRec(),
      split: () => splitSelectedAtPlayhead(),
      delete: () => deleteSelected(),
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
      archToggleFullscreen: () => archToggleFullscreen(),
      archClose: () => archClose(),
      archToggleArtistSection: () => archToggleArtistSection(),
      archClearArtistSearch: () => {
        const input = document.getElementById('artistSearchInput');
        if (input) input.value = '';
        archFilterArtists();
      },
      archArtistSlide: (_, element) => archArtistSlide(Number(element.dataset.value)),
      archSetTab: (_, element) => archSetTab(element.dataset.tab),
      archClearSearch: () => {
        const input = document.getElementById('archiveSearch');
        if (input) input.value = '';
        archApplyFilters();
      },
      archSetView: (_, element) => archSetView(element.dataset.value),
      archToggleSelectMode: () => archToggleSelectMode(),
      archImportFiles: () => archImportFiles(),
      archImportFolder: () => archImportFolder(),
      archImportFullArchive: () => archImportFullArchive(),
      archExportAll: () => archExportAll(),
      archRefresh: () => archRefresh(),
      archClearFilters: () => archClearFilters(),
      archBulkFav: (_, element) => archBulkFav(element.dataset.value === 'true'),
      archBulkExport: () => archBulkExport(),
      archBulkTrash: () => archBulkTrash(),
      archArtistCtx: (_, element) => archArtistCtx(element.dataset.value),
      archConfirmResolve: (_, element) => archConfirmResolve(element.dataset.value === 'true'),
      archEditClose: () => archEditClose(),
      archEditSave: () => archEditSave(),
      archCtxAction: (_, element) => archCtxAction(element.dataset.value),
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
      archSelectAll: (_, element) => archSelectAll(!!element.checked),
      archToggleSelect: (_, element) => archToggleSelect(element.dataset.songId),
      archExitReadOnly: () => archExitReadOnly(),
      archCreateEditableCopy: () => archCreateEditableCopy(),
      archClearArtistFilter: () => {
        _archArtistFilter = null;
        archRenderArtists();
        archRender();
        archUpdateActiveFilters();
      },
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
            getArrangers: () => arrangers,
            getEditingArr: () => editingArr,
            getAllSongs: () => edGetAllSongs(),
            setAllSongs: (...args) => edSetAllSongs(...args),
            saveArrangers: (...args) => saveArrangers(...args),
            renderArrangerManager: (...args) =>
              renderArrangerManager(...args),
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
    const projRoot = projectFilePath ? pathDirname(projectFilePath) : getEditorDAW().projectRoot;
    if (!projRoot || !clip.storage.projectPath) {
      return null;
    }
    filePath = (window.electronAPI?.resolvePath)
               ? window.electronAPI.resolvePath(projRoot, clip.storage.projectPath)
               : pathJoin(projRoot, clip.storage.projectPath);
  } else if (clip.storage && clip.storage.mode === 'reference') {
    filePath = clip.storage.externalPath;
  } else if (clip.relativePath) {
    const projRoot = projectFilePath ? pathDirname(projectFilePath) : getEditorDAW().projectRoot;
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

// اطمینان از اینکه تابع getClipFilePath در global scope قابل دسترسی هست
if (typeof window !== 'undefined') {
  window.getClipFilePath = getClipFilePath;
}
