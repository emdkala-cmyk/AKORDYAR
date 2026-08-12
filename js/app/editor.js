// ==========================================
// PART 4: Timeline Rendering & UI Event Listeners
// ==========================================

// Keep selection state initialized before DOM setup can register handlers.
let edSelectedChords = [];

function editorPopupIsOpen(popup) {
  return window.WindowBridge?.isOpen?.(popup) ?? Boolean(popup && !popup.closed);
}

function editorPopupDocument(popup) {
  return window.WindowBridge?.getDocument?.(popup) || null;
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

let edSongImportService = null;
function getEditorSongImportService() {
  if (
    !edSongImportService &&
    typeof window.EditorSongImportService?.create === 'function'
  ) {
    edSongImportService = window.EditorSongImportService.create({
      getSong: getCurrentEditorSong,
      setSong: song => setEditorSong(song),
      createBlankSong: edBlankSong,
      isValidNote: note => typeof etIsValidNote !== 'function' || etIsValidNote(note)
    });
  }
  return edSongImportService;
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
        loopState: ns.loopState
      });
      if (!transition) {
        console.error('[Arranger] Song transition service is unavailable');
        return false;
      }
      selectionEnd = ns.selectionEnd;
      isRecordingChords = false; currentRecordingClipId = null;

      const audio = transition.audio;
      console.log(`[Arranger] Audio clips: ${audio.loaded}/${audio.total} loaded` +
        (audio.missing > 0
          ? `, ${audio.missing} missing: ${audio.missingNames.join(', ')}`
          : ''));

      getEditorDAW().playhead = 0;
      var _ori2 = PlayheadMath.createOrigin(performance.now(), 0); getEditorDAW().playOriginPerf = _ori2.playOriginPerf;
      getEditorDAW().playOriginTime = _ori2.playOriginTime;
      scheduleAllFromPlayhead();

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

    async function loadArrSong(idx) {
      const arr = arrPerformData || editingArr;
      if (!arr || idx >= arr.items.length) { arrPerformActive = false; _arrNextState = null; toast(t('arrangerFinished')); return; }
      arrPerformIdx = idx;

      // ─── Reset prep state ───
      // وقتی کاربر دستی آهنگی رو انتخاب می‌کنه، state های prep قبلی رو پاک کن
      _arrNextState = null;
      arrPreparePending = false;
      _arrWaitPollActive = false;
      _arrHasLoggedNoNextSong = false; // reset no-next-song log flag
      _arrPrepStartedForIndex = -1;    // reset prep log flag

      const allSongs = edGetAllSongs();
      const song = allSongs.find(s => s.id === arr.items[idx]);
      if (!song) { await loadArrSong(idx + 1); return; }

      console.log(`[Arranger] loadArrSong(${idx}): "${song.title}"`);

      pauseTransport(); stopAllVoices();
      // ─── مهم: bufferCache رو پاک نکن! ───
      // قبلاً اینجا getEditorDAW().bufferCache.clear() بود که همه بافرهای preload شده رو پاک می‌کرد.
      // این باعث می‌شد هر بار که آهنگ لود می‌شه، همه فایل‌ها دوباره از اول لود بشن.
      // به‌جاش، فقط waveCache (تصاویر waveform) رو پاک می‌کنیم که اون هم بعداً rebuild می‌شه.
      selectionEnd = 0;
      isRecordingChords = false; currentRecordingClipId = null;

      const setting = getArrItemSetting(arr, song.id);
      const transition = await getEditorSongTransitionService()?.loadSong(song, {
        transpose: setting.transpose || 0,
        styleDefaults: {
          tSize: 23, tColor: '#0fa966', tFont: 'Vazirmatn', tBold: true,
          align: 'center', cSize: 23, cColor: '#e6aa28',
          cFont: 'JetBrains Mono'
        }
      });
      if (!transition) {
        console.error('[Arranger] Song transition service is unavailable');
        return;
      }

      selectionEnd = (getEditorDAW().loopA < getEditorDAW().loopB)
        ? getEditorDAW().loopB
        : 0;

      const restoreResult = transition.restoreResult;
      if (transition.restoreError) {
        console.warn('Audio load error:', transition.restoreError);
        toast('⚠ خطا در لود فایل صوتی');
      } else if (restoreResult) {
        if (restoreResult.missing > 0) {
          console.warn(`[Arranger] ${restoreResult.missing} audio clip(s) could not be loaded:`, restoreResult.missingNames);
          toast(`⚠ ${restoreResult.missing} فایل صوتی پیدا نشد — ${restoreResult.missingNames.slice(0, 2).join(', ')}${restoreResult.missingNames.length > 2 ? '...' : ''}`);
        } else {
          console.log(`[Arranger] ✓ Audio loaded for "${song.title}" (${restoreResult.loaded} clips)`);
        }
      }

      resetHistory();
      edSyncToolbar(); edRenderEditor(true); renderAll(); saveState();
      initHighlightEffect();
      // Sync popup windows, SongDocument, and embedded view
      syncUIAfterSongChange();

      toast(`${t('songN')} ${idx + 1}/${arr.items.length}: ${song.title || t('untitled')}`);
      seekTransport(0, false);
      ensureAudioCtx();
      if (arrPerformActive && !getEditorDAW().isPlaying && !perfPauseMode) startTransport();
      if (arrPerformActive && idx + 1 < arr.items.length) {
        // ─── شروع prep آهنگ بعدی با delay کوتاه ───
        // تا playback فعلی شروع بشه و بعد prep شروع شه
        setTimeout(() => {
          if (arrPerformActive && arrPerformIdx === idx && !_arrNextState && !arrPreparePending) {
            arrPreparePending = true;
            prepareNextArrSong()
              .then(() => { arrPreparePending = false; })
              .catch((e) => { console.error('[Arranger] Prep after loadArrSong failed:', e); arrPreparePending = false; });
          }
        }, 500);
      }

      // Update perf UI
      if (perfModeActive) renderPerfUI();
      // آینه آکوردها در پاپ‌آپ
      setTimeout(safeMirrorTimeline, 1000);
    }

    function setZoom(pps, anchorClientX) {
      const scroll = $('tl-scroll'); const oldPps = getEditorDAW().pxPerSecond; const newPps = clamp(pps, 5, 260);
      if (Math.abs(newPps - oldPps) < 0.01) return;
      let anchorTime = getEditorDAW().playhead; if (typeof anchorClientX === 'number') anchorTime = clientToTime(anchorClientX);
      const rel = timeToX(anchorTime) - scroll.scrollLeft; getEditorDAW().pxPerSecond = newPps; $('zoom-range').value = String(Math.round(newPps));
      // خودکار بزرگ کردن تایم‌لاین بر اساس عرض صفحه نمایش
      const visibleTime = scroll.clientWidth / newPps;
      ensureTimelineFits(visibleTime + 10);
      getEditorDAW().clips.forEach(c => refreshClipWaveImage(c)); requestRenderAll(); scroll.scrollLeft = Math.max(0, timeToX(anchorTime) - rel);
      updateZoomFontScale();
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

      if (track.laneHeight && currentHeight >= expandedHeight - 1) {
        track.laneHeight = null;
        const lane = document.querySelector(`.track-lane[data-track-id="${track.id}"]`);
        const name = document.querySelector(`.track-name[data-track-id="${track.id}"]`);
        [lane, name].forEach(el => {
          if (!el) return;
          el.style.removeProperty('--lane-h');
          el.style.removeProperty('height');
        });
        const grid = lane?.querySelector('.lane-grid');
        if (grid) drawLaneGrid(grid);
        updateZoomFontScale();
      } else {
        setLaneHeight(track.id, expandedHeight);
      }
      updateTrackSelectionUI();
      saveState();
      toast(track.laneHeight ? 'لاین بزرگ شد' : 'اندازه لاین به حالت عادی برگشت');
    }

    /* ===== CHORD EDITOR & MIDI ===== */
    function buildChordEditor() {
      const fillCol = (colId, arr, key) => {
        const col = $(colId); col.innerHTML = '';
        arr.forEach(val => {
          const div = document.createElement('div');
          div.className = 'chord-item' + (currentChord[key] === val ? ' active' : '');
          div.textContent = val === '' || val === 'None' ? 'None' : val;
          div.onclick = () => { currentChord[key] = val; col.querySelectorAll('.chord-item').forEach(d => d.classList.remove('active')); div.classList.add('active'); updateChordPreview(); };
          col.appendChild(div);
        });
      };
      fillCol('col-root', ROOT_NOTES, 'root'); fillCol('col-type', CHORD_TYPES, 'type');
      fillCol('col-tension', TENSIONS, 'tension'); fillCol('col-bass', BASS_NOTES, 'bass');
      buildPiano(); updateChordPreview();
    }

    function buildPiano() {
      const piano = $('piano-keys'); piano.innerHTML = '';
      const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      const blackNotes = { 'C#': 0, 'D#': 1, 'F#': 3, 'G#': 4, 'A#': 5 };
      for (let oct = 4; oct <= 5; oct++) {
        whiteNotes.forEach(n => { const key = document.createElement('div'); key.className = 'white-key'; key.dataset.note = n + oct; key.textContent = n + oct; piano.appendChild(key); });
      }
      const whiteWidth = 100 / 14;
      for (let oct = 4; oct <= 5; oct++) {
        let pos = (oct - 4) * 7;
        for (const [n, idx] of Object.entries(blackNotes)) {
          const key = document.createElement('div'); key.className = 'black-key'; key.dataset.note = n + oct; key.textContent = n + oct;
          key.style.left = `calc(${(pos + idx + 1) * whiteWidth}% - 12px)`; piano.appendChild(key);
        }
      }
    }

    function updateChordPreview() {
      const { root, type, tension, bass } = currentChord;
      let name = 'None';
      if (root !== 'None' && type !== 'None') {
        name = `${root}${chordTypeDisplay(type)}${tension}${bass !== 'None' && bass !== root ? '/' + bass : ''}`;
      }
      $('chord-preview').textContent = name;
      if ($('chordManual')) $('chordManual').value = name === 'None' ? '' : name;

      document.querySelectorAll('.piano-keyboard .white-key, .piano-keyboard .black-key').forEach(k => k.classList.remove('active'));
      if (name === '') return;

      const rootIdx = NOTE_SEMITONE[root] != null ? NOTE_SEMITONE[root] : NOTES.indexOf(root);
      const intervals = [...(CHORD_INTERVALS[type] || []), ...(TENSION_INTERVALS[tension] || [])];
      intervals.forEach(i => {
        const noteIdx = (rootIdx + i) % 12; const noteName = NOTES[noteIdx];
        const keyEl4 = document.querySelector(`.piano-keyboard [data-note="${noteName}4"]`);
        const keyEl5 = document.querySelector(`.piano-keyboard [data-note="${noteName}5"]`);
        if (keyEl4) keyEl4.classList.add('active');
        if (keyEl5) keyEl5.classList.add('active');
      });
      if (bass !== 'None' && bass !== root) {
        const bassSharp = NOTE_TO_SHARP[bass] || bass;
        const bassEl4 = document.querySelector(`.piano-keyboard [data-note="${bassSharp}4"]`);
        const bassEl5 = document.querySelector(`.piano-keyboard [data-note="${bassSharp}5"]`);
        if (bassEl4) bassEl4.classList.add('active');
        if (bassEl5) bassEl5.classList.add('active');
      }
    }

    function openChordEditor(clipId = null) {
      getEditorDAW().editingChordClipId = clipId;
      edChordModalMode = null;
      if (clipId) {
        const clip = getClip(clipId);
        const m = clip.name.match(/^([A-G][#b]?)(maj|m(?:in)?|dim|aug|sus2|sus4)?(M7|7|9|b9|#9|11|#11|13|6)?(?:\/([A-G][#b]?))?$/);
        if (m) { let tp = m[2] || 'None'; if (tp === 'm') tp = 'min'; currentChord = { root: m[1] || 'None', type: tp, tension: m[3] || '', bass: m[4] || 'None' }; }
        else currentChord = { root: 'None', type: 'None', tension: '', bass: 'None' };
      } else {
        currentChord = { root: 'None', type: 'None', tension: '', bass: 'None' };
      }
      $('chordModalTitle').textContent = t('chordEditor');
      $('chordModalConfirmBtn').textContent = t('placeOnTimeline');
      $('chord-modal').classList.add('show'); buildChordEditor();
      // اضافه کردن هندلر کیبورد برای دکمه ESC
      const chordModal = $('chord-modal');
      if (chordModal) {
        // حذف هندلر قبلی اگر وجود دارد
        if (chordModal._escHandler) chordModal.removeEventListener('keydown', chordModal._escHandler);
        chordModal._escHandler = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            closeChordEditor();
          }
        };
        chordModal.addEventListener('keydown', chordModal._escHandler);
        // فوکوس روی مودال برای اینکه ESC بدون کلیک کار کند
        chordModal.focus();
      }
    }

    function closeChordEditor() {
      $('chord-modal').classList.remove('show');
      getEditorDAW().editingChordClipId = null;
      if (edChordModalMode === 'editor') { edChordModalMode = null; edChordIdx = null; edPendingAnchor = null; }
    }

    // Unified chord modal confirm/delete — dispatches based on mode
    function chordModalConfirm() {
      if (edChordModalMode === 'editor') { edConfirmChord(); }
      else { placeChordOnTimeline(); }
    }
    function chordModalDelete() {
      if (edChordModalMode === 'editor') { edDeleteChord(); }
      else {
        if (getEditorDAW().editingChordClipId) {
          const c = getClip(getEditorDAW().editingChordClipId);
          if (c) { c.name = ''; renderClips(); saveState(); }
        }
        closeChordEditor();
      }
    }

    function placeChordOnTimeline() {
      // اگر کاربر نامی دستی تایپ کرده، از آن استفاده کن (هماهنگ با ویرایشگر آکورد)
      let name = ($('chordManual')?.value || '').trim();
      if (name) {
        name = name.replace(/^([A-G][#b]?)maj$/, '$1');
        name = name.replace(/^([A-G][#b]?)min/i, '$1m');
      } else {
        const { root, type, tension, bass } = currentChord;
        if (root === 'None' || type === 'None') {
            toast(t('selectCompleteChord'));
            return;
        }
        name = `${root}${chordTypeDisplay(type)}${tension}${bass !== 'None' && bass !== root ? '/' + bass : ''}`;
      }
      if (getEditorDAW().editingChordClipId) {
        const clip = getClip(getEditorDAW().editingChordClipId);
        if (clip) { clip.name = name; getEditorDAW().editingChordClipId = null; saveState(); renderAll(); closeChordEditor(); toast(`${t('chordEditedTo')} ${name}`); return; }
      }
      // Check if we're placing from Alt+Click on chord track (use mouse position)
      let targetTime = getEditorDAW().playhead;
      if (window._tempChordTrackAnchor && window._tempChordTrack) {
        targetTime = window._tempChordTrackAnchor.time;
        // Clean up temp variables to prevent interference with future clicks
        delete window._tempChordTrackAnchor;
        delete window._tempChordTrack;
      }
      const chordTrack = getEditorDAW().tracks.find(t => t.type === 'chord'); if (!chordTrack) return;
      const clip = { id: uid('c'), type: 'chord', trackId: chordTrack.id, name, start: roundMs(targetTime), duration: 4, color: '#9F7AEA' };
      getEditorDAW().clips.push(clip); getEditorDAW().selectedIds = new Set([clip.id]); saveState(); ensureTimelineFits(clip.start + clip.duration + 5);
      renderAll(); closeChordEditor(); toast(`${t('chordPlaced')} ${name}`);
      edSaveSong();
    }

    function toggleMIDITab() {
      toggleTab('tab-midi'); const tab = $('tab-midi');
      if (tab.classList.contains('active-pink')) {
        if (navigator.requestMIDIAccess) {
          navigator.requestMIDIAccess().then(function(ma) {
            midiAccess = ma;
            midiAccess.inputs.forEach(input => input.onmidimessage = handleMIDIMessage);
            toast('MIDI وصل شد - پیام‌ها دریافت میشه');
            if (!midiSyncActive) {
              midiSyncActive = true;
              $('tab-midi-sync').classList.add('active-pink');
              $('midiSyncLabel').textContent = 'ON';
              toast('همگام‌سازی خودکار فعال شد');
            }
          }).catch(function(e) { console.error('MIDI Error:', e); toast('خطا در اتصال MIDI: ' + (e.message || e)); });
        } else { toast('MIDI پشتیبانی نمیشه (HTTPS لازمه)'); }
      } else {
        if (midiAccess) { midiAccess.inputs.forEach(input => input.onmidimessage = null); }
        midiSyncActive = false;
        $('tab-midi-sync')?.classList.remove('active-pink');
        if ($('midiSyncLabel')) $('midiSyncLabel').textContent = 'OFF';
        toast('MIDI قطع شد');
      }
    }

    function identifyChord(midiNotes) {
      if (midiNotes.length < 3) return null; 
      const sorted = [...midiNotes].sort((a, b) => a - b);
      const bassMidi = sorted[0];
      const bassNote = NOTES[bassMidi % 12];

      const uniqueMidiNotes = [...new Set(sorted)];
      
      for (const rootMidi of uniqueMidiNotes) {
        const intervals = uniqueMidiNotes.map(n => n - rootMidi).filter(i => i >= 0).sort((a, b) => a - b);
        const uniqueIntervals = [...new Set(intervals)];

        for (const tmpl of CHORD_TEMPLATES) {
          const req = tmpl.req;
          const hasAll = req.every(r => uniqueIntervals.includes(r));
          if (hasAll) {
            const rootName = NOTES[rootMidi % 12];
            return { root: rootName, type: tmpl.type, tension: tmpl.tension, bass: (bassMidi % 12 === rootMidi % 12) ? 'None' : bassNote };
          }
        }
      }
      return null;
    }

    // ===== MIDI TRANSPORT SYNC =====
    let midiClockRunning = false;
    let midiSyncActive = false;
    let lastClockTime = 0;
    let clockCount = 0;
    let clockDetectTimer = null;
    let clockIntervals = [];
    let midiSyncStartTime = 0;
    let midiSyncBPM = 0;

    function handleMIDIMessage(e) {
      const [status] = e.data;

      // Log ALL messages to monitor first
      updateMidiMonitor(e.data);
      updateMidiStatusDot();

      // MIDI Start (0xFA)
      if (status === 0xFA) {
        midiClockRunning = true;
        if (midiSyncActive) {
          seekTransport(0, false);
          if (!getEditorDAW().isPlaying) startTransport();
        }
        return;
      }
      // MIDI Stop (0xFC)
      if (status === 0xFC) {
        midiClockRunning = false;
        if (midiSyncActive && getEditorDAW().isPlaying) {
          pauseTransport();
        }
        return;
      }
      // MIDI Continue (0xFB)
      if (status === 0xFB) {
        midiClockRunning = true;
        if (midiSyncActive && !getEditorDAW().isPlaying) {
          startTransport();
        }
        return;
      }
      // MIDI Clock (0xF8)
      if (status === 0xF8) {
        if (midiSyncActive) {
          const now = performance.now();

          if (!midiClockRunning) {
            // شروع پخش
            midiClockRunning = true;
            clockIntervals = [];
            clockCount = 0;
            midiSyncStartTime = now;
            if (!getEditorDAW().isPlaying) {
              seekTransport(0, false);
              startTransport();
            }
          }

          // محاسبه تمپو از فاصله بین پالس‌ها
          // MIDI Clock = 24 pulses per beat
          // BPM = 60 / (interval_per_beat)
          // interval_per_beat = avg_interval * 24
          if (lastClockTime > 0) {
            const interval = now - lastClockTime;
            if (interval > 5 && interval < 100) { // فقط فاصله‌های معقول
              clockIntervals.push(interval);
              if (clockIntervals.length > 48) clockIntervals.shift(); // حداکثر ۴۸ پالس آخر

              // محاسبه میانگین فاصله
              if (clockCount % 24 === 0 && clockIntervals.length >= 12) {
                const avgInterval = clockIntervals.reduce((a, b) => a + b, 0) / clockIntervals.length;
                const beatInterval = avgInterval * 24; // فاصله هر بیت
                const newBPM = Math.round(60000 / beatInterval);

                // فقط اگه تمپو تغییر کرده، آپدیت کن
                if (newBPM >= 20 && newBPM <= 300 && newBPM !== midiSyncBPM) {
                  midiSyncBPM = newBPM;
                  $('edTempo').value = newBPM;
                  if (edCur) { edCur.tempo = newBPM; edSaveSong(); }
                  toast(`تمپوی کیوبیس: ${newBPM} BPM`);
                }
              }
            }
          }
          lastClockTime = now;
          clockCount++;

          // تایمر توقف
          clearTimeout(clockDetectTimer);
          clockDetectTimer = setTimeout(() => {
            if (midiClockRunning && midiSyncActive) {
              midiClockRunning = false;
              lastClockTime = 0;
              clockIntervals = [];
              if (getEditorDAW().isPlaying) pauseTransport();
            }
          }, 500);
        }
        return;
      }
      // MTC Quarter Frame (0xF1)
      if (status === 0xF1) {
        return;
      }
      // SysEx (0xF0) - MTC Full Message
      if (status === 0xF0) {
        const msg = e.data;
        if (msg.length >= 10 && msg[1] === 0x7F && msg[3] === 0x01 && msg[4] === 0x01) {
          const hours = msg[5] & 0x1F;
          const minutes = msg[6] & 0x3F;
          const seconds = msg[7] & 0x3F;
          const frames = msg[8] & 0x1F;
          const totalSeconds = hours * 3600 + minutes * 60 + seconds + frames / 30;
          if (midiSyncActive) {
            seekTransport(totalSeconds, false);
          }
        }
        return;
      }

      // Regular MIDI Note messages
      const note = e.data[1];
      const velocity = e.data[2];
      if (status === 144 && velocity > 0) {
        // MIDI Learn mode: capture this note for mapping
        if (midiLearnActive) { handleMidiLearnInput(note); return; }
        // MIDI Map: execute mapped function
        const mappedFunc = getMidiMap(note);
        if (mappedFunc) { executeMidiMappedFunction(mappedFunc); return; }
        activeMidiNotes.add(note); highlightPianoKey(note, true);
      }
      else if (status === 128 || (status === 144 && velocity === 0)) { activeMidiNotes.delete(note); highlightPianoKey(note, false); }

      clearTimeout(midiTimeout); midiTimeout = setTimeout(evaluateMidiInput, 50);
    }

    function evaluateMidiInput() {
      const isEditorOpen = $('chord-modal').classList.contains('show');
      const isEdChordModalOpen = edChordModalMode === 'editor' && $('chord-modal')?.classList.contains('show');

      if (activeMidiNotes.size === 0) {
        if (isRecordingChords && currentRecordingClipId) {
          const c = getClip(currentRecordingClipId); if (c) c.duration = roundMs(Math.max(0.5, getEditorDAW().playhead - c.start));
          currentRecordingClipId = null; saveState(); renderAll();
        }
        return;
      }

      const chord = identifyChord([...activeMidiNotes]);
      if (!chord) return;

      const name = `${chord.root}${chordTypeDisplay(chord.type)}${chord.tension}${chord.bass !== 'None' && chord.bass !== chord.root ? '/' + chord.bass : ''}`;

      // Show in MIDI monitor
      updateMidiChordDisplay(name, [...activeMidiNotes].map(n => noteNames[n % 12] + (Math.floor(n / 12) - 1)).join(', '));
      logMidiMsg('SYS', [0, 0, 0]); // chord identified marker

      // Update DAW Editor Live if open
      if (isEditorOpen) {
        currentChord = chord;
        updateChordPreview();
        document.querySelectorAll('.chord-item').forEach(el => el.classList.remove('active'));
        const rIdx = ROOT_NOTES.indexOf(chord.root);
        const tIdx = CHORD_TYPES.indexOf(chord.type);
        const teIdx = TENSIONS.indexOf(chord.tension);
        const bIdx = BASS_NOTES.indexOf(chord.bass);
        if(rIdx > -1) document.querySelector(`#col-root .chord-item:nth-child(${rIdx + 1})`)?.classList.add('active');
        if(tIdx > -1) document.querySelector(`#col-type .chord-item:nth-child(${tIdx + 1})`)?.classList.add('active');
        if(teIdx > -1) document.querySelector(`#col-tension .chord-item:nth-child(${teIdx + 1})`)?.classList.add('active');
        if(bIdx > -1) document.querySelector(`#col-bass .chord-item:nth-child(${bIdx + 1})`)?.classList.add('active');
      }

      // Update Lyrics Editor chord modal if open
      if (isEdChordModalOpen) {
        if ($('chordManual')) $('chordManual').value = name;
        if ($('chord-preview')) $('chord-preview').textContent = name;
      }

      // Update selected lyrics editor chord
if (edCur && edSelectedChords.length > 0 && !isEdChordModalOpen) {
  edSelectedChords.forEach(i => {
    if (edCur.chords[i]) {
      edCur.chords[i].name = name;
      edSyncBaseChordName(i);
    }
  });
  edRenderChords();
  edCommit();
}



      // Sequential chording via MIDI
      if (edSeqChordingActive && edCur && !isEdChordModalOpen) {
        const songState = getEditorSongStateService();
        const song = songState?.currentSong?.();
        const chords = songState?.getChords?.() || [];
        const seqIdx = chords.length - edSeqPoints.length + edSeqCursor;
        if (song && chords[seqIdx]) {
          songState.setChordName(seqIdx, name);
          edSyncBaseChordName(seqIdx);
          edCommit(); edRenderChords();
          if (edSeqCursor < edSeqPoints.length - 1) {
            edSeqCursor++;
          } else {
            const seqStart = chords.length - edSeqPoints.length;
            edFilterChordsWithBase((c, i) => i < seqStart || c.name);
            edSeqChordingActive = false;
            edSeqPoints = [];
            songState.setSeqPoints([]);
            edCommit(); edRenderChords();
            toast(t('chordDone'));
          }
        }
        return;
      }

      // Update DAW timeline recording
      if (isRecordingChords) {
        if (!currentRecordingClipId || getClip(currentRecordingClipId)?.name !== name) {
          if (currentRecordingClipId) { const oldC = getClip(currentRecordingClipId); if (oldC) oldC.duration = roundMs(Math.max(0.5, getEditorDAW().playhead - oldC.start)); }
          const chordTrack = getEditorDAW().tracks.find(t => t.type === 'chord');
          if (chordTrack) {
            const newClip = { id: uid('c'), type: 'chord', trackId: chordTrack.id, name, start: roundMs(getEditorDAW().playhead), duration: 2, color: '#9F7AEA' };
            getEditorDAW().clips.push(newClip); currentRecordingClipId = newClip.id; ensureTimelineFits(newClip.start + newClip.duration + 5); renderAll();
          }
        } else {
          const clip = getClip(currentRecordingClipId); if (clip) { clip.duration = roundMs(Math.max(0.5, getEditorDAW().playhead - clip.start)); renderClips(); }
        }
      } else if (getEditorDAW().selectedIds.size === 1) {
        const selId = [...getEditorDAW().selectedIds][0]; const clip = getClip(selId);
        if (clip && clip.type === 'chord' && clip.name !== name) { clip.name = name; renderClips(); }
      }
    }

    function highlightPianoKey(midiNote, on) {
      const noteName = NOTES[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
      const keyEl = document.querySelector(`.piano-keyboard [data-note="${noteName}"]`);
      if (keyEl) { if (on) keyEl.classList.add('active'); else keyEl.classList.remove('active'); }
    }

    function toggleMIDISync() {
      midiSyncActive = !midiSyncActive;
      $('tab-midi-sync').classList.toggle('active-pink', midiSyncActive);
      $('midiSyncLabel').textContent = midiSyncActive ? 'ON' : 'OFF';
      toast(midiSyncActive ? 'همگام‌سازی فعال شد' : 'همگام‌سازی غیرفعال شد');
    }

    function toggleTab(id) { const tab = $(id); if (id === 'tab-sync') tab.classList.toggle('active-teal'); else if (id === 'tab-midi') tab.classList.toggle('active-pink'); }

    /* ===================== KEYBOARD ===================== */
    // ===== SHORTCUT SYSTEM =====
    const SHORTCUT_DEFAULTS = [
      { id: 'undo',          label: 'برگشت (Undo)',           code: 'KeyZ',    ctrl: true,  shift: false },
      { id: 'redo',          label: 'جلو (Redo)',              code: 'KeyY',    ctrl: true,  shift: false },
      { id: 'play',          label: 'پخش / توقف',             code: 'Space',   ctrl: false, shift: false },
      { id: 'split',         label: 'برش در پخشگر',           code: 'KeyS',    ctrl: false, shift: false },
      { id: 'copy',          label: 'کپی',                    code: 'KeyC',    ctrl: true,  shift: false },
      { id: 'cut',           label: 'بریدن',                   code: 'KeyX',    ctrl: true,  shift: false },
      { id: 'paste',         label: 'چسباندن',                 code: 'KeyV',    ctrl: true,  shift: false },
      { id: 'selectAll',     label: 'انتخاب همه',              code: 'KeyA',    ctrl: true,  shift: false },
      { id: 'duplicate',     label: 'کپی + چسباندن',            code: 'KeyD',    ctrl: true,  shift: false },
      { id: 'delete',        label: 'حذف انتخاب‌شده',          code: 'Delete',  ctrl: false, shift: false },
      { id: 'loop',          label: 'روشن/خاموش حلقه',         code: 'NumpadDivide', ctrl: false, shift: false },
      { id: 'loopA',         label: 'شروع حلقه',               code: 'KeyI',    ctrl: false, shift: false },
      { id: 'loopB',         label: 'پایان حلقه',              code: 'KeyO',    ctrl: false, shift: false },
      { id: 'fullscreen',    label: 'پنجره تمام‌صفحه',         code: 'F9',      ctrl: false, shift: false },
      { id: 'focusMode',     label: 'حالت تمرکز',              code: 'F10',     ctrl: false, shift: false },
      { id: 'seekBack',      label: 'عقب‌رفتن',               code: 'ArrowLeft',  ctrl: false, shift: false },
      { id: 'seekFwd',       label: 'جلورفتن',                 code: 'ArrowRight', ctrl: false, shift: false },
      { id: 'goStart',       label: 'رفتن به ابتدا',           code: 'Home',    ctrl: false, shift: false },
      { id: 'setLoopFromSel',label: 'محدوده loop از selection',  code: 'KeyP',    ctrl: false, shift: false },
    ];

    let SHORTCUTS = {};
    function loadShortcuts() {
      try { SHORTCUTS = JSON.parse(localStorage.getItem('ed_shortcuts') || '{}'); } catch(_) { SHORTCUTS = {}; }
    }
    function saveShortcuts() { localStorage.setItem('ed_shortcuts', JSON.stringify(SHORTCUTS)); }
    function getShortcut(id) {
      const def = SHORTCUT_DEFAULTS.find(s => s.id === id);
      return SHORTCUTS[id] || (def ? { code: def.code, ctrl: def.ctrl, shift: def.shift } : null);
    }
    function matchShortcut(e, id) {
      const sk = getShortcut(id); if (!sk) return false;
      const mod = e.ctrlKey || e.metaKey;
      return e.code === sk.code && mod === !!sk.ctrl && e.shiftKey === !!sk.shift;
    }
    function formatKeyName(code) {
      const map = { 'Space':'Space','KeyA':'A','KeyB':'B','KeyC':'C','KeyD':'D','KeyE':'E','KeyF':'F','KeyG':'G','KeyH':'H','KeyI':'I','KeyJ':'J','KeyK':'K','KeyL':'L','KeyM':'M','KeyN':'N','KeyO':'O','KeyP':'P','KeyQ':'Q','KeyR':'R','KeyS':'S','KeyT':'T','KeyU':'U','KeyV':'V','KeyW':'W','KeyX':'X','KeyY':'Y','KeyZ':'Z','Delete':'Del','Backspace':'Bksp','Home':'Home','End':'End','F9':'F9','F10':'F10','ArrowLeft':'←','ArrowRight':'→','ArrowUp':'↑','ArrowDown':'↓' };
      return map[code] || code;
    }
    loadShortcuts();

    let _editingShortcutId = null;
    // ===== IMPORT FROM URL/TEXT =====
    let _importParsed = null;
    function openImportChordModal() { $('importChordModal').classList.add('show'); $('importText').value = ''; $('importUrl').value = ''; $('importPreview').style.display = 'none'; _importParsed = null; }
    function closeImportChordModal() { $('importChordModal').classList.remove('show'); _importParsed = null; }

    // ===== AUTO IMPORT (Rewritten — multi-artist, progress, retry, accurate counts) =====

    // ---- State ----
    window._aiResults = [];       // flat array of all fetched songs (with status tracking)
    window._aiArtistMap = {};     // { artistName: { expected, fetched, status, songs:[] } }
    window._aiStats = { total: 0, fetched: 0, archived: 0, filesSaved: 0, dupes: 0, errors: 0 };
    window._aiFailedSongs = [];   // songs that failed after all retries

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

    // ---- Progress UI ----
    function updateAutoProgress(current, total, detail) {
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      const fill = $('autoProgressFill');
      const label = $('autoProgressLabel');
      const pctEl = $('autoProgressPct');
      const detailEl = $('autoProgressDetail');
      if (fill) fill.style.width = pct + '%';
      if (label) label.textContent = `${current} / ${total}`;
      if (pctEl) pctEl.textContent = pct + '%';
      // Detail markup is assembled locally; every external value is escaped
      // before interpolation (see escapeHtml calls below).
      if (detailEl && detail) detailEl.innerHTML = detail;
    }
    function showProgressBar() { $('autoProgressBar')?.classList.add('show'); }
    function hideProgressBar() { $('autoProgressBar')?.classList.remove('show'); }

    // ---- Modal open/close ----
    function openAutoImportModal() {
      $('autoImportModal').classList.add('show');
      $('autoImportStatus').style.display = 'none';
      $('autoImportResults').innerHTML = '';
      $('autoImportDone').style.display = 'none';
      $('autoImportForm').style.display = 'block';
      $('autoImportFooter').style.display = 'flex';
      $('autoImportBtn').disabled = false;
      $('autoArtistTags').innerHTML = '';
      hideProgressBar();
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
    function closeAutoImportModal() { $('autoImportModal').classList.remove('show'); }

    function autoImportNewRequest() {
      $('autoImportStatus').style.display = 'none';
      $('autoImportResults').innerHTML = '';
      $('autoImportDone').style.display = 'none';
      $('autoImportSummary').textContent = '';
      $('autoImportFolderInput').style.display = 'none';
      $('autoImportForm').style.display = 'block';
      $('autoImportFooter').style.display = 'flex';
      $('autoImportBtn').disabled = false;
      $('autoImportBtn').textContent = '🚀 شروع ورودی اتومات';
      hideProgressBar();
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

    // ---- Chord Parser Helpers (shared by all import paths) ----
    const IMPORT_DEBUG = false;

    // charIndex contract:
    // Zero-based JavaScript string index in the exact final lyric line.
    // It is not an RTL visual column and must not be reversed after parsing.

    function normalizeRawText(rawText) {
      if (!rawText) return '';
      let t = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      while (t.startsWith('\n')) t = t.substring(1);
      while (t.endsWith('\n')) t = t.substring(0, t.length - 1);
      return t;
    }

    // Only for line-type classification. NEVER use result for positions.
    function normalizeLineForDetection(line) {
      return line.replace(/[│┃┃│┆┇┊┋╎╏║►▶◆◇○●★☆♦♣♠♥♪♫]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    }

    function expandTabsForVisualColumns(line, tabSize) {
      tabSize = tabSize || 4;
      let result = '';
      let col = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '\t') {
          const spaces = tabSize - (col % tabSize);
          for (let s = 0; s < spaces; s++) result += ' ';
          col += spaces;
        } else {
          result += line[i];
          col++;
        }
      }
      return result;
    }

    function hasPersian(s) {
      return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
    }

    // Single reusable chord-token regex for both detection and extraction
    const CHORD_ONLY_REGEX = /^[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?(?:[\s*]+[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?)*\s*$/;

    const CHORD_EXTRACT_REGEX = /[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?/g;

    function extractChordPositions(originalLine) {
      const expanded = expandTabsForVisualColumns(originalLine);
      const positions = [];
      let match;
      const re = new RegExp(CHORD_EXTRACT_REGEX.source, 'g');
      while ((match = re.exec(expanded)) !== null) {
        positions.push({
          name: match[0],
          startColumn: match.index,
          endColumn: match.index + match[0].length,
          centerColumn: match.index + match[0].length / 2
        });
      }
      return positions;
    }

    // Strip star markers and collect anchor positions in one pass.
    // Returns { cleanText, anchors } where anchors[i] is the zero-based
    // JavaScript string index in cleanText where chord i should be placed.
    //
    // Contract:
    // 1. A star before a visible character anchors the chord to that character.
    //    Example: "عش*ق" -> anchor points to "ق".
    // 2. A star inside trailing whitespace or after the visible text
    //    becomes a LineEnd anchor.
    // 3. Trailing horizontal whitespace is removed from final lyrics.
    // 4. charIndex is always based on the final cleanText.
    // 5. JavaScript UTF-16 indexing is preserved so the result remains
    //    compatible with slice(), substring(), DOM text offsets.
    function stripStarsAndCollectAnchors(rawLyricLine) {
      const raw = String(rawLyricLine ?? '');
      let textWithoutStars = '';
      const rawAnchors = [];
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '*') {
          rawAnchors.push(textWithoutStars.length);
        } else {
          textWithoutStars += raw[i];
        }
      }
      // Remove only horizontal trailing whitespace.
      const cleanText = textWithoutStars.replace(/[ \t\u00A0]+$/u, '');
      const visibleLength = cleanText.length;
      const anchors = rawAnchors.map(function(idx) {
        return Math.min(idx, visibleLength);
      });
      return { cleanText: cleanText, anchors: anchors };
    }

    function snapToWordBoundary(charIndex, lyricText) {
      const len = lyricText.length;
      if (len === 0) return 0;
      charIndex = Math.max(0, Math.min(charIndex, len - 1));
      // Find the nearest word-start to the left
      let bestLeft = charIndex;
      for (let i = charIndex; i >= 0; i--) {
        const prevChar = i > 0 ? lyricText[i - 1] : ' ';
        const curChar = lyricText[i];
        if ((prevChar === ' ' || prevChar === '\u200C' || i === 0) && curChar !== ' ' && curChar !== '\u200C') {
          bestLeft = i; break;
        }
      }
      // Find the nearest word-start to the right
      let bestRight = charIndex;
      for (let i = charIndex; i < len; i++) {
        const prevChar = i > 0 ? lyricText[i - 1] : ' ';
        const curChar = lyricText[i];
        if ((prevChar === ' ' || prevChar === '\u200C' || i === 0) && curChar !== ' ' && curChar !== '\u200C') {
          bestRight = i; break;
        }
      }
      const distLeft = Math.abs(bestLeft - charIndex);
      const distRight = Math.abs(bestRight - charIndex);
      if (distLeft <= distRight) return bestLeft;
      return bestRight;
    }

    // Determine anchor type from source context, not from clamped positions.
    function determineAnchorType(charIndex, lyricLength, explicitStart, explicitEnd) {
      if (lyricLength === 0 || explicitStart || charIndex === 0) return 'LineStart';
      if (explicitEnd || charIndex >= lyricLength) return 'LineEnd';
      return 'OnCharacter';
    }

    // Helper to correctly assign charIndex and anchorType for explicit anchors (stars).
    // LineEnd anchor: charIndex === lyricLength (points past the last character).
    function makeExplicitAnchor(rawIndex, lyricLength) {
      if (lyricLength <= 0) {
        return { charIndex: 0, anchorType: 'LineStart' };
      }
      if (rawIndex <= 0) {
        return { charIndex: 0, anchorType: 'LineStart' };
      }
      if (rawIndex >= lyricLength) {
        return { charIndex: lyricLength, anchorType: 'LineEnd' };
      }
      return { charIndex: rawIndex, anchorType: 'OnCharacter' };
    }

    // Map chord visual columns to lyric character indices for no-star lines.
    // Both lines share the same monospace coordinate system from <pre>.
    // Chord line is LTR; lyric line may be RTL.
    //
    // For RTL: charIndex = lyricVisualWidth - chordEndColumn
    //   (end of chord token maps to the correct text boundary)
    // For LTR: charIndex = chordStartColumn (direct mapping)
    //
    // No proportional scaling. No word-boundary snapping.
    function mapChordColumnsToLyricIndices(chordLine, lyricLine, chordPositions) {
      // منطق به js/editor/LyricPositionMapper.js منتقل شده است.
      return requireLyricPositionMapper().mapChordColumnsToLyricIndices(chordLine, lyricLine, chordPositions);
    }

    // Validate parsed song result in development mode.
    function validateParsedSong(result) {
      const warnings = [];
      if (typeof result.lyrics !== 'string') { warnings.push({ code: 'INVALID_LYRICS_TYPE', message: 'lyrics must be string' }); return warnings; }
      if (!Array.isArray(result.chords)) { warnings.push({ code: 'INVALID_CHORDS_TYPE', message: 'chords must be array' }); return warnings; }
      const lines = result.lyrics.split('\n');
      for (let i = 0; i < result.chords.length; i++) {
        const ch = result.chords[i];
        if (typeof ch.lineIndex !== 'number' || ch.lineIndex !== Math.floor(ch.lineIndex)) { warnings.push({ code: 'INVALID_LINE_INDEX', message: 'chord ' + i + ': lineIndex must be integer' }); continue; }
        if (typeof ch.charIndex !== 'number' || ch.charIndex !== Math.floor(ch.charIndex)) { warnings.push({ code: 'INVALID_CHAR_INDEX', message: 'chord ' + i + ': charIndex must be integer' }); continue; }
        if (ch.lineIndex < 0 || ch.lineIndex >= lines.length) { warnings.push({ code: 'LINE_INDEX_OUT_OF_RANGE', message: 'chord ' + i + ': lineIndex ' + ch.lineIndex + ' out of range' }); continue; }
        const line = lines[ch.lineIndex];
        // LineEnd anchor: charIndex === lyricLine.length is valid
        if (ch.anchorType === 'LineEnd') {
          if (ch.charIndex !== line.length) { warnings.push({ code: 'INVALID_LINE_END_INDEX', message: 'chord ' + i + ': LineEnd charIndex ' + ch.charIndex + ' != lyric length ' + line.length }); }
        } else if (line.length > 0 && (ch.charIndex < 0 || ch.charIndex >= line.length)) {
          warnings.push({ code: 'CLAMPED_CHAR_INDEX', message: 'chord ' + i + ': charIndex ' + ch.charIndex + ' out of range for line length ' + line.length });
        }
        if (!ch.name || typeof ch.name !== 'string' || !ch.name.trim()) { warnings.push({ code: 'EMPTY_CHORD_NAME', message: 'chord ' + i + ': empty name' }); }
        if (!['LineStart', 'OnCharacter', 'LineEnd'].includes(ch.anchorType)) { warnings.push({ code: 'INVALID_ANCHOR_TYPE', message: 'chord ' + i + ': invalid anchorType ' + ch.anchorType }); }
      }
      if (result.lyrics.includes('*')) { warnings.push({ code: 'STAR_IN_FINAL_LYRICS', message: 'Final lyrics contain star characters' }); }
      return warnings;
    }

    // ---- Common Parser: rawText → { lyrics, chords } ----
    // charIndex contract:
    // Zero-based JavaScript string index in the exact final lyric line.
    // It is not an RTL visual column and must not be reversed after parsing.
    function parseRawSongToEdCur(parsedSong) {
      const result = { title: parsedSong.title || '', artist: parsedSong.artist || '', key: parsedSong.key || '', keyMode: 'maj', timeSignature: parsedSong.rhythm || '', lyrics: '', chords: [], warnings: [] };
      if (parsedSong.key && parsedSong.key.endsWith('m')) { result.keyMode = 'min'; result.key = parsedSong.key.replace(/m$/, ''); }
      const rawText = normalizeRawText(parsedSong.rawText || '');
      if (!rawText) return result;

      const allRawLines = rawText.split('\n');
      const lineInfos = allRawLines.map(function(raw) {
        return { originalLine: raw, detectionLine: normalizeLineForDetection(raw), type: 'unknown' };
      });

      // Classify each line using detectionLine only
      for (let i = 0; i < lineInfos.length; i++) {
        const info = lineInfos[i];
        if (!info.detectionLine) { info.type = 'empty'; continue; }
        if (hasPersian(info.detectionLine)) {
          const endChordMatch = info.detectionLine.match(/\s+([A-G][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-G][#b]?|\d+)?(?:\s+[A-G][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-G][#b]?|\d+)?)*)\s*$/);
          if (endChordMatch) {
            // Detect chord suffix on detectionLine, but find it in originalLine
            const origText = info.originalLine;
            const chordSuffixRegex = /\s+([A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?(?:\s+[A-Ga-g][#b]?(?:m[maj7]*|maj(?:7|9|11|13)*|min(?:7|9|11|13)*|dim(?:7)?|aug(?:7)?|sus[24]?(?:7)?|add\d+|\/[A-Ga-g][#b]?|\d+)?)*)\s*$/;
            const origMatch = origText.match(chordSuffixRegex);
            let lyricPartOriginal, chordPartOriginal;
            if (origMatch) {
              lyricPartOriginal = origText.substring(0, origText.length - origMatch[0].length);
              chordPartOriginal = origMatch[1];
            } else {
              // Fallback: use detectionLine split positions
              const detLyricPart = info.detectionLine.substring(0, info.detectionLine.length - endChordMatch[0].length).trim();
              const detChordPart = endChordMatch[1].trim();
              lyricPartOriginal = detLyricPart;
              chordPartOriginal = detChordPart;
            }
            if (lyricPartOriginal.trim()) {
              lineInfos[i] = { originalLine: lyricPartOriginal, detectionLine: normalizeLineForDetection(lyricPartOriginal), type: 'lyric' };
              lineInfos.splice(i + 1, 0, { originalLine: chordPartOriginal, detectionLine: normalizeLineForDetection(chordPartOriginal), type: 'chord' });
            } else {
              lineInfos[i] = { originalLine: chordPartOriginal, detectionLine: normalizeLineForDetection(chordPartOriginal), type: 'chord' };
            }
          } else {
            info.type = 'lyric';
          }
        } else {
          if (/^[-=_~─━═━━─﹍﹎＿]{3,}$/.test(info.detectionLine.replace(/\s/g, ''))) { info.type = 'empty'; continue; }
          const stripped = info.detectionLine.replace(/\*/g, '');
          if (stripped && CHORD_ONLY_REGEX.test(stripped)) { info.type = 'chord'; }
          else { info.type = 'lyric'; }
        }
      }

      // Pair: chord line + next non-empty lyric line
      const consumed = new Set();
      const pairs = [];
      for (let i = 0; i < lineInfos.length; i++) {
        const item = lineInfos[i];
        if (item.type === 'chord') {
          let nextLyricIdx = -1;
          for (let j = i + 1; j < lineInfos.length; j++) {
            if (lineInfos[j].type === 'lyric' && !consumed.has(j)) { nextLyricIdx = j; break; }
            if (lineInfos[j].type === 'chord') break;
          }
          if (nextLyricIdx >= 0) {
            consumed.add(nextLyricIdx);
            pairs.push({ chordLineOriginal: item.originalLine, lyricLineOriginal: lineInfos[nextLyricIdx].originalLine });
          } else {
            result.warnings.push({ sourceLineIndex: i, code: 'INSTRUMENTAL_CHORD_LINE', message: 'Chord-only line at source index ' + i + ' preserved as intro/interlude' });
          }
        } else if (item.type === 'lyric' && !consumed.has(i)) {
          pairs.push({ chordLineOriginal: '', lyricLineOriginal: item.originalLine });
        }
      }

      // Build final lyrics and chords
      for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
        const pair = pairs[pairIdx];
        const chordLine = pair.chordLineOriginal;
        const lyricRaw = pair.lyricLineOriginal;

        // Build the final lyric line once, using the original lyric text
        const { cleanText: finalLyricLine, anchors: starAnchors } = stripStarsAndCollectAnchors(lyricRaw);
        pair.finalLyricLine = finalLyricLine;

        if (!chordLine || !finalLyricLine) continue;

        // Extract chord tokens from the chord line
        const chordTokens = chordLine.match(CHORD_EXTRACT_REGEX) || [];
        if (chordTokens.length === 0) continue;

        // Get valid chord tokens for matching
        const validChords = [];
        let cm;
        const ce = new RegExp(CHORD_EXTRACT_REGEX.source, 'g');
        while ((cm = ce.exec(chordLine)) !== null) {
          validChords.push({ name: cm[0] });
        }

        if (starAnchors.length > 0) {
          // Star-based positioning: pair chords with anchors deterministically
          if (validChords.length === starAnchors.length) {
            // Same count: one-to-one pairing
            for (let ci = 0; ci < validChords.length; ci++) {
              const explicit = makeExplicitAnchor(starAnchors[ci], finalLyricLine.length);
              result.chords.push({
                name: validChords[ci].name,
                lineIndex: pairIdx,
                charIndex: explicit.charIndex,
                anchorType: explicit.anchorType
              });
            }
          } else if (validChords.length > starAnchors.length) {
            // More chords than anchors: use anchors for prefix, fallback for rest
            for (let ci = 0; ci < starAnchors.length; ci++) {
              const explicit = makeExplicitAnchor(starAnchors[ci], finalLyricLine.length);
              result.chords.push({
                name: validChords[ci].name,
                lineIndex: pairIdx,
                charIndex: explicit.charIndex,
                anchorType: explicit.anchorType
              });
            }
            // Fallback for remaining chords using column projection
            const remainingChords = validChords.slice(starAnchors.length);
            const chordPositions = extractChordPositions(chordLine);
            const fallbackPositions = chordPositions.slice(starAnchors.length);
            const mapped = mapChordColumnsToLyricIndices(chordLine, finalLyricLine, fallbackPositions);
            for (let fi = 0; fi < mapped.length && fi < remainingChords.length; fi++) {
              const explicit = makeExplicitAnchor(mapped[fi].charIndex, finalLyricLine.length);
              result.chords.push({
                name: remainingChords[fi].name,
                lineIndex: pairIdx,
                charIndex: explicit.charIndex,
                anchorType: explicit.anchorType
              });
            }
            result.warnings.push({ sourceLineIndex: pairIdx, code: 'STAR_CHORD_COUNT_MISMATCH', message: 'More chords (' + validChords.length + ') than star anchors (' + starAnchors.length + ')' });
          } else {
            // More anchors than chords: use only matching count
            for (let ci = 0; ci < validChords.length; ci++) {
              const anchorIdx = ci < starAnchors.length ? starAnchors[ci] : 0;
              const explicit = makeExplicitAnchor(anchorIdx, finalLyricLine.length);
              result.chords.push({
                name: validChords[ci].name,
                lineIndex: pairIdx,
                charIndex: explicit.charIndex,
                anchorType: explicit.anchorType
              });
            }
            result.warnings.push({ sourceLineIndex: pairIdx, code: 'STAR_CHORD_COUNT_MISMATCH', message: 'More star anchors (' + starAnchors.length + ') than chords (' + validChords.length + ')' });
          }
        } else {
          // No-star fallback: column-based projection
          const chordPositions = extractChordPositions(chordLine);
          const mapped = mapChordColumnsToLyricIndices(chordLine, finalLyricLine, chordPositions);
          for (const m of mapped) {
            const explicit = makeExplicitAnchor(m.charIndex, finalLyricLine.length);
            result.chords.push({
              name: m.name,
              lineIndex: pairIdx,
              charIndex: explicit.charIndex,
              anchorType: explicit.anchorType
            });
          }
          if (IMPORT_DEBUG) {
            console.log('[IMPORT DEBUG] no-star pair', pairIdx, { chordLine: chordLine, lyricLine: finalLyricLine, chords: mapped });
          }
        }
      }

      // Build final lyrics string from all final lyric lines
      result.lyrics = pairs.map(function(p) { return p.finalLyricLine || ''; }).join('\n');

      // Validate
      const validationWarnings = validateParsedSong(result);
      if (validationWarnings.length > 0) {
        result.warnings = result.warnings.concat(validationWarnings);
        if (IMPORT_DEBUG) console.warn('[IMPORT WARNINGS]', validationWarnings);
      }

      return result;
    }

    // Thin wrapper for backward compatibility
    function parseSongRawText(song) {
      return parseRawSongToEdCur(song);
    }

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
      const a = window._aiStats;
      let d = '';
      d += `<span class="apd-ok">✓ موفق: ${a.archived}</span>  `;
      d += `<span class="apd-fail">✗ ناموفق: ${a.errors}</span>  `;
      d += `<span class="apd-dup">≈ تکراری: ${a.dupes}</span>  `;
      d += `<span class="apd-pending">◯ باقی‌مانده: ${Math.max(0, a.total - a.fetched)}</span>`;
      return d;
    }

    // ---- MAIN: Start Auto Import ----
    async function startAutoImport() {
      const rawInput = $('autoArtistName').value.trim();
      const requestedCount = parseInt($('autoSongCount').value) || 0;
      const saveToArchive = $('autoSaveArchive').checked;

      const artistNames = parseArtistNames(rawInput);
      if (!artistNames.length) { toast('نام خواننده را وارد کنید'); return; }

      const status = $('autoImportStatus');
      const results = $('autoImportResults');
      const btn = $('autoImportBtn');
      status.style.display = 'block';
      results.innerHTML = '';
      btn.disabled = true;
      showProgressBar();

      const source = $('autoSource').value;
      const apiUrl = source === 'akord' ? '/api/akord/auto-import' : '/api/auto-import';

      // Reset state
      window._aiResults = [];
      window._aiArtistMap = {};
      window._aiStats = { total: 0, fetched: 0, archived: 0, filesSaved: 0, dupes: 0, errors: 0 };
      window._aiFailedSongs = [];

      try {
        // ===== PHASE 1: Detect total for each artist =====
        status.textContent = '🔍 در حال شناسایی تعداد ترانه‌ها...';
        let grandExpected = 0;

        for (let ai = 0; ai < artistNames.length; ai++) {
          const artistName = artistNames[ai];
          status.textContent = `🔍 [${ai + 1}/${artistNames.length}] شناسایی ${escapeHtml(artistName)}...`;
          updateAutoProgress(grandExpected, grandExpected + 1, `<span class="auto-progress-teal">شناسایی ${escapeHtml(artistName)}...</span>`);

          // Probe: fetch count=1 to get totalSongs
          try {
            const probeResp = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ artistName, count: 1, start: 1 })
            });
            const probeData = await probeResp.json();

            if (probeData.error) {
              window._aiArtistMap[artistName] = { expected: 0, fetched: 0, status: 'error', error: probeData.error, candidates: probeData.candidates, songs: [] };
              continue;
            }

            const totalSongs = probeData.totalSongs || 1;
            const countToFetch = requestedCount > 0 ? Math.min(requestedCount, totalSongs) : totalSongs;
            console.log(`[AUTO-IMPORT CLIENT] Artist: ${artistName} | totalSongs from probe: ${totalSongs} | countToFetch: ${countToFetch}`);
            window._aiArtistMap[artistName] = { expected: countToFetch, fetched: 0, status: 'pending', songs: [] };
            grandExpected += countToFetch;
          } catch (e) {
            window._aiArtistMap[artistName] = { expected: 0, fetched: 0, status: 'error', error: e.message, songs: [] };
          }
          await new Promise(r => setTimeout(r, 300));
        }

        window._aiStats.total = grandExpected;

        // Show artist summary before fetching
        let summaryLines = ['━━━ خلاصه شناسایی ━━━'];
        for (const [name, data] of Object.entries(window._aiArtistMap)) {
          if (data.error) summaryLines.push(`❌ ${name}: ${data.error}`);
          else summaryLines.push(`🎵 ${name}: ${data.expected} ترانه`);
        }
        summaryLines.push(`📊 جمع کل: ${grandExpected} ترانه`);
        status.textContent = summaryLines.join('\n');
        updateAutoProgress(0, grandExpected, buildProgressDetail());

        // ===== PHASE 2: Fetch all songs for each artist =====
        let processedCount = 0;

        for (const [artistName, artistData] of Object.entries(window._aiArtistMap)) {
          if (artistData.error) continue;

          status.textContent = `🎵 در حال دریافت ${escapeHtml(artistName)} (${artistData.expected} ترانه)...`;
          updateAutoProgress(processedCount, grandExpected, `<span class="auto-progress-teal">دریافت ${escapeHtml(artistName)}...</span><br>${buildProgressDetail()}`);

          const fetchResult = await fetchArtistFromServer(artistName, apiUrl, artistData.expected, (msg) => {
            status.textContent = msg;
          });

          if (fetchResult.error) {
            artistData.status = 'error';
            artistData.error = fetchResult.error;
            artistData.candidates = fetchResult.candidates;
            artistData.songs = fetchResult.results || [];
            artistData.fetched = artistData.songs.length;
            processedCount += artistData.songs.length;
            window._aiStats.fetched += artistData.songs.length;
            window._aiStats.errors += artistData.expected - artistData.songs.length;
            continue;
          }

          // Deduplicate within this artist's results by URL
          const seenUrls = new Set();
          const uniqueSongs = [];
          for (const song of fetchResult.results) {
            if (!seenUrls.has(song.url)) {
              seenUrls.add(song.url);
              uniqueSongs.push(song);
            }
          }

          artistData.songs = uniqueSongs;
          artistData.fetched = uniqueSongs.length;
          artistData.status = 'done';
          window._aiResults.push(...uniqueSongs);
          window._aiStats.fetched += uniqueSongs.length;
          processedCount += uniqueSongs.length;

          updateAutoProgress(processedCount, grandExpected, buildProgressDetail());

          // Show per-artist results
          const okCount = uniqueSongs.filter(s => !s.error).length;
          const errCount = uniqueSongs.filter(s => s.error).length;
          const hColor = errCount > 0 ? '#e24f5b' : 'var(--accent-teal)';
          results.innerHTML += `<div style="padding:8px 10px;margin:8px 0 4px;border-radius:6px;background:rgba(255,255,255,0.04);border-left:3px solid ${hColor};font-weight:700;color:var(--text-primary);font-size:0.9rem;">🎵 ${artistName} <span style="color:var(--text-secondary);font-weight:400;font-size:0.8rem;">(${okCount}/${artistData.expected} موفق${errCount ? ', ' + errCount + ' ناموفق' : ''})</span></div>`;

          uniqueSongs.forEach((song, i) => {
            const key = songUniqueId(song);
            if (song.error) {
              results.innerHTML += `<div style="padding:6px 10px;margin:2px 0 2px 16px;border-radius:6px;background:rgba(255,0,0,0.1);border:1px solid #e24f5b;font-size:0.8rem;">❌ ${song.title}: ${song.error}</div>`;
            } else {
        results.innerHTML += `<div data-action="loadAutoImportSong" data-value="${escapeHtml(String(key))}" style="padding:6px 10px;margin:2px 0 2px 16px;border-radius:6px;background:rgba(63,184,175,0.1);border:1px solid var(--accent-teal);cursor:pointer;font-size:0.8rem;">🎵 ${escapeHtml(song.title)} <span style="color:var(--text-secondary);font-size:0.75rem;">(${escapeHtml(song.key || '-')})</span></div>`;
            }
          });

          await new Promise(r => setTimeout(r, 300));
        }

        // ===== PHASE 3: Save to archive =====
        if (saveToArchive) {
          status.textContent = '📁 در حال ذخیره در آرشیو...';
          const existingSongs = edGetAllSongs();
          let archived = 0, dupes = 0, noText = 0, parseErr = 0;

          for (const song of window._aiResults) {
            if (song.error) { continue; }
            if (!song.rawText || !song.rawText.trim()) {
              noText++;
              continue;
            }
            try {
              const result = saveSongToArchive(song, existingSongs);
              if (result.duplicate) { dupes++; }
              else if (result.saved) { archived++; }
            } catch (e) {
              parseErr++;
              console.log(`[ARCHIVE] PARSE ERROR: ${song.title} — ${e.message}`);
            }
          }

          console.log(`[ARCHIVE] FINAL: archived=${archived}, dupes=${dupes}, noText=${noText}, parseErr=${parseErr}, total=${window._aiResults.length}`);
          console.log(`[ARCHIVE] Songs with rawText: ${window._aiResults.filter(s => !s.error && s.rawText && s.rawText.trim()).length}`);
          console.log(`[ARCHIVE] Songs WITHOUT rawText: ${noText}`);
          edSetAllSongs(existingSongs);
          window._aiStats.archived = archived;
          window._aiStats.dupes = dupes;
          window._aiStats.errors = window._aiFailedSongs.length;
        }

        // ===== PHASE 4: Final Report =====
        const s = window._aiStats;
        let report = '━━━ گزارش نهایی ━━━\n';
        for (const [name, data] of Object.entries(window._aiArtistMap)) {
          if (data.error) report += `❌ ${name}: ${data.error}\n`;
          else report += `🎵 ${name}: ${data.fetched}/${data.expected} دریافت شد\n`;
        }
        report += `\n📊 مجموع تعداد مورد انتظار: ${s.total}\n`;
        report += `📊 تعداد دریافت‌شده: ${s.fetched}\n`;
        report += `📊 ذخیره‌شده در آرشیو: ${s.archived}\n`;
        report += `📊 تکراری: ${s.dupes}\n`;
        report += `📊 ناموفق: ${s.errors}`;
        if (window._aiFailedSongs.length > 0) {
          report += `\n\n❌ موارد ناموفق:\n`;
          window._aiFailedSongs.forEach(f => { report += `  • ${f.artist} — ${f.title}: ${f.error}\n`; });
        }

        status.textContent = report;
        $('autoImportSummary').textContent = report;
        updateAutoProgress(s.fetched, s.total, buildProgressDetail());

        // Show completion UI
        $('autoImportForm').style.display = 'none';
        $('autoImportFooter').style.display = 'none';
        $('autoImportDone').style.display = 'block';

      } catch (e) {
        const isNetworkErr = e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('ERR_CONNECTION');
        status.textContent = isNetworkErr
          ? '❌ سرور پیدا نشد!\n\nلطفاً سرور را اجرا کنید:\n1. ترمینال باز کنید\n2. بروید به پوشه پروژه\n3. بزنید: npm start\n4. بعد دوباره تلاش کنید'
          : '❌ خطا: ' + e.message;
        btn.disabled = false;
        btn.textContent = '🔄 تلاش مجدد';
        $('autoImportDone').style.display = 'block';
      }
    }

    // ---- Retry failed songs only ----
    async function autoRetryFailed() {
      const failed = window._aiFailedSongs;
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

      window._aiFailedSongs = [];
      let retriedCount = 0;

      for (const [artistName, failedSongs] of Object.entries(byArtist)) {
        status.textContent = `🔄 تلاش مجدد ${escapeHtml(artistName)} (${failedSongs.length} ترانه)...`;
        updateAutoProgress(retriedCount, failed.length, `<span class="auto-progress-retry">تلاش مجدد ${escapeHtml(artistName)}...</span>`);

        const fetchResult = await fetchArtistFromServer(artistName, apiUrl, failedSongs.length, (msg) => { status.textContent = msg; });

        if (fetchResult.error) {
          failedSongs.forEach(f => window._aiFailedSongs.push(f));
          retriedCount += failedSongs.length;
          continue;
        }

        // Check which failed songs are now recovered
        const recoveredUrls = new Set(fetchResult.results.filter(r => !r.error).map(r => r.url));
        const recoveredSongs = fetchResult.results.filter(r => !r.error && !r.rawText?.includes(''));

        for (const song of recoveredSongs) {
          if (!song.error && song.rawText) {
            window._aiResults.push(song);
            window._aiStats.fetched++;
            // Add to archive
            const existingSongs = edGetAllSongs();
            const result = saveSongToArchive(song, existingSongs);
            if (result.saved) window._aiStats.archived++;
            else if (result.duplicate) window._aiStats.dupes++;
            edSetAllSongs(existingSongs);
          }
        }

        // Songs still failed
        for (const f of failedSongs) {
          if (!recoveredUrls.has(f.url)) window._aiFailedSongs.push(f);
        }
        retriedCount += failedSongs.length;
        updateAutoProgress(retriedCount, failed.length, buildProgressDetail());
      }

      const stillFailed = window._aiFailedSongs.length;
      status.textContent = `🔄 تلاش مجدد تمام شد\nبازیابی شده: ${failed.length - stillFailed}\nباقی‌مانده ناموفق: ${stillFailed}`;
      updateAutoProgress(window._aiStats.fetched, window._aiStats.total, buildProgressDetail());
      if (stillFailed === 0) toast('✅ همه ترانه‌ها بازیابی شد!');
      else toast(`⚠️ ${stillFailed} ترانه هنوز ناموفق است`);
    }

    // ---- Save to archive (manual button) ----
    function autoImportSaveArchive() {
      const songs = window._aiResults.filter(s => !s.error && s.rawText);
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
      const songs = window._aiResults.filter(s => !s.error && s.rawText);
      if (!songs.length) { toast('فایلی برای ذخیره وجود ندارد'); return; }
      $('autoImportFolderInput').style.display = 'block';
      if (window.showDirectoryPicker) {
        window.showDirectoryPicker({ mode: 'readwrite' }).then(async dirHandle => {
          window._autoImportDirHandle = dirHandle;
          $('autoSavePathInput').value = dirHandle.name;
          $('autoSavePathInput').disabled = true;
        }).catch(() => {
          window._autoImportDirHandle = null;
          $('autoSavePathInput').disabled = false;
          $('autoSavePathInput').value = '';
        });
      } else {
        $('autoSavePathInput').disabled = false;
        $('autoSavePathInput').value = '';
      }
    }

    async function autoImportDoSave() {
      const songs = Array.isArray(window._aiResults)
        ? window._aiResults.filter(song => !song.error && song.rawText)
        : [];

      if (!songs.length) {
        toast('داده‌ای برای ذخیره نیست');
        return;
      }

      // اطمینان از وجود آمار
      window._aiStats = window._aiStats || {};
      window._aiFailedFiles = [];

      // پاک‌سازی نام پوشه و فایل برای ویندوز و File System API
      function sanitizeFilePart(value, fallback = 'Unknown') {
        const cleaned = String(value || fallback)
          .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
          .replace(/\s+/g, ' ')
          .replace(/[.\s]+$/g, '')
          .trim();

        return cleaned || fallback;
      }

      // گروه‌بندی ترانه‌ها براساس خوانندهٔ واقعی هر نتیجه
      const byArtist = {};

      songs.forEach(song => {
        const artistName = sanitizeFilePart(song.artist, 'Unknown');

        if (!byArtist[artistName]) {
          byArtist[artistName] = [];
        }

        byArtist[artistName].push(song);
      });

      const statusEl = $('autoImportStatus');
      const summaryEl = $('autoImportSummary');
      const folderInputEl = $('autoImportFolderInput');

      const totalFiles = songs.length;

      let savedTotal = 0;
      let errorsTotal = 0;

      const perArtistReport = [];
      const failedFiles = [];

      // ساخت متن گزارش نهایی
      function buildSaveReport({
        perArtist = [],
        saved = 0,
        errors = 0,
        skipped = 0,
        failed = []
      }) {
        let report = '━━━ گزارش ذخیره فایل‌ها ━━━\n';

        if (perArtist.length > 0) {
          perArtist.forEach(item => {
            const itemErrors = Number(item.errors) || 0;
            const itemSkipped = Number(item.skipped) || 0;

            let icon = '✅';

            if (itemErrors > 0) {
              icon = '⚠️';
            } else if (itemSkipped > 0) {
              icon = 'ℹ️';
            }

            report += `${icon} ${item.artist}: ${item.saved} از ${item.expected} فایل`;

            const details = [];

            if (itemSkipped > 0) {
              details.push(`${itemSkipped} رد شد`);
            }

            if (itemErrors > 0) {
              details.push(`${itemErrors} خطا`);
            }

            if (details.length > 0) {
              report += ` (${details.join('، ')})`;
            }

            report += '\n';
          });
        }

        report += `\n📊 مجموع: ${saved} از ${totalFiles} فایل با موفقیت ذخیره شد`;

        if (skipped > 0) {
          report += `\n⏭️ ردشده: ${skipped} فایل`;
        }

        if (errors > 0) {
          report += `\n❌ ناموفق: ${errors} فایل`;
        }

        if (failed.length > 0) {
          report += '\n\nجزئیات خطاها:\n';

          failed.forEach(item => {
            report += `  • ${item.artist} — ${item.title}: ${item.error}\n`;
          });
        }

        return report.trim();
      }

      statusEl.style.display = 'block';

      // ============================================================
      // Method 1: Native File System API
      // ذخیره در پوشه‌های جداگانه برای هر خواننده
      // ============================================================
      if (window._autoImportDirHandle) {
        const artistEntries = Object.entries(byArtist);

        try {
          for (let artistIndex = 0; artistIndex < artistEntries.length; artistIndex++) {
            const [artistName, artistSongs] = artistEntries[artistIndex];

            statusEl.textContent =
              `💾 [${artistIndex + 1}/${artistEntries.length}] ` +
              `ذخیرهٔ ترانه‌های ${artistName} (${artistSongs.length} فایل)...`;

            const artistDirName = sanitizeFilePart(artistName, 'Unknown');

            let artistDir;

            try {
              artistDir =
                await window._autoImportDirHandle.getDirectoryHandle(
                  artistDirName,
                  { create: true }
                );
            } catch (error) {
              const errorMessage = error?.message || String(error);

              artistSongs.forEach(song => {
                failedFiles.push({
                  artist: artistName,
                  title: song.title || 'Untitled',
                  error: `ساخت پوشه ناموفق بود: ${errorMessage}`
                });
              });

              errorsTotal += artistSongs.length;

              perArtistReport.push({
                artist: artistName,
                expected: artistSongs.length,
                saved: 0,
                skipped: 0,
                errors: artistSongs.length
              });

              continue;
            }

            let artistSaved = 0;
            let artistErrors = 0;

            /*
             * جلوگیری از یکسان‌شدن نام فایل‌های همین عملیات ذخیره.
             *
             * برای مثال اگر دو نتیجه هر دو این نام را داشته باشند:
             * گوگوش - همخونه.json
             *
             * فایل دوم به شکل زیر ذخیره می‌شود:
             * گوگوش - همخونه (2).json
             */
            const usedFileNames = new Map();

            for (let songIndex = 0; songIndex < artistSongs.length; songIndex++) {
              const song = artistSongs[songIndex];

              try {
                statusEl.textContent =
                  `💾 [${artistIndex + 1}/${artistEntries.length}] ${artistName}\n` +
                  `فایل ${songIndex + 1} از ${artistSongs.length}: ` +
                  `${song.title || 'Untitled'}`;

                const fileArtist = sanitizeFilePart(
                  song.artist || artistName,
                  artistName
                );

                const fileTitle = sanitizeFilePart(
                  song.title,
                  'Untitled'
                );

                const baseName = `${fileArtist} - ${fileTitle}`;
                const normalizedBaseName = baseName.toLocaleLowerCase('fa-IR');

                const occurrence =
                  (usedFileNames.get(normalizedBaseName) || 0) + 1;

                usedFileNames.set(normalizedBaseName, occurrence);

                const finalBaseName =
                  occurrence === 1
                    ? baseName
                    : `${baseName} (${occurrence})`;

                const filename = `${finalBaseName}.json`;

                const fileHandle = await artistDir.getFileHandle(
                  filename,
                  { create: true }
                );

                const writable = await fileHandle.createWritable();

                try {
                  await writable.write(
                    JSON.stringify(song, null, 2)
                  );

                  await writable.close();
                } catch (writeError) {
                  // اگر عملیات نوشتن شکست خورد، تلاش برای لغو stream
                  try {
                    await writable.abort();
                  } catch (_) {
                    // خطای abort اهمیتی برای گزارش اصلی ندارد
                  }

                  throw writeError;
                }

                artistSaved++;
                savedTotal++;
              } catch (error) {
                const errorMessage = error?.message || String(error);

                artistErrors++;
                errorsTotal++;

                failedFiles.push({
                  artist: artistName,
                  title: song.title || 'Untitled',
                  error: errorMessage
                });
              }
            }

            perArtistReport.push({
              artist: artistName,
              expected: artistSongs.length,
              saved: artistSaved,
              skipped: 0,
              errors: artistErrors
            });
          }

          window._aiStats.filesSaved = savedTotal;
          window._aiFailedFiles = failedFiles;

          const report = buildSaveReport({
            perArtist: perArtistReport,
            saved: savedTotal,
            errors: errorsTotal,
            skipped: 0,
            failed: failedFiles
          });

          statusEl.textContent = report;

          if (summaryEl) {
            summaryEl.textContent = report;
          }

          if (folderInputEl) {
            folderInputEl.style.display = 'none';
          }

          if (errorsTotal > 0) {
            toast(
              `⚠️ ${savedTotal} فایل ذخیره شد، ` +
              `${errorsTotal} فایل ناموفق بود`
            );
          } else {
            toast(`✅ ${savedTotal} فایل با موفقیت ذخیره شد`);
          }
        } catch (error) {
          const errorMessage = error?.message || String(error);

          window._aiStats.filesSaved = savedTotal;
          window._aiFailedFiles = failedFiles;

          statusEl.textContent =
            `❌ عملیات ذخیره متوقف شد.\n` +
            `${savedTotal} فایل قبل از بروز خطا ذخیره شد.\n` +
            `خطا: ${errorMessage}`;

          toast(`خطا در ذخیره فایل‌ها: ${errorMessage}`);
        }

        // مهم: پس از روش Native نباید روش سروری اجرا شود
        return;
      }

      // ============================================================
      // Method 2: Server-side save
      // ذخیره توسط مسیر /api/save-to-folder
      // ============================================================
      const savePath = $('autoSavePathInput').value.trim();

      if (!savePath) {
        toast('آدرس پوشه را وارد کنید');
        return;
      }

      statusEl.textContent = '💾 در حال ذخیره فایل‌ها در سرور...';
      toast('در حال ذخیره...');

      try {
        const resp = await fetch('/api/save-to-folder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            savePath,
            songs
          })
        });

        let data;

        try {
          data = await resp.json();
        } catch (_) {
          throw new Error(
            `پاسخ سرور JSON معتبر نیست؛ کد وضعیت: ${resp.status}`
          );
        }

        if (!resp.ok) {
          throw new Error(
            data?.error ||
            `درخواست ذخیره ناموفق بود؛ کد وضعیت: ${resp.status}`
          );
        }

        if (data.error) {
          throw new Error(data.error);
        }

        savedTotal = Number(data.saved) || 0;
        errorsTotal = Number(data.errors) || 0;

        const skippedTotal = Number(data.skipped) || 0;

        window._aiStats.filesSaved = savedTotal;
        window._aiFailedFiles = Array.isArray(data.failedFiles)
          ? data.failedFiles
          : [];

        let serverPerArtist = [];

        if (Array.isArray(data.perArtist)) {
          serverPerArtist = data.perArtist.map(item => ({
            artist: item.artist || 'Unknown',
            expected: Number(item.expected) || 0,
            saved: Number(item.saved) || 0,
            skipped: Number(item.skipped) || 0,
            errors: Number(item.errors) || 0
          }));
        } else {
          /*
           * حالت سازگاری با نسخه‌های قدیمی سرور که هنوز
           * perArtist برنمی‌گردانند.
           */
          serverPerArtist = Object.entries(byArtist).map(
            ([artistName, artistSongs]) => ({
              artist: artistName,
              expected: artistSongs.length,
              saved: 0,
              skipped: 0,
              errors: 0
            })
          );
        }

        const report = buildSaveReport({
          perArtist: serverPerArtist,
          saved: savedTotal,
          errors: errorsTotal,
          skipped: skippedTotal,
          failed: window._aiFailedFiles
        });

        statusEl.textContent = report;

        if (summaryEl) {
          summaryEl.textContent = report;
        }

        if (folderInputEl) {
          folderInputEl.style.display = 'none';
        }

        if (errorsTotal > 0) {
          toast(
            `⚠️ ${savedTotal} فایل ذخیره شد، ` +
            `${errorsTotal} خطا` +
            `${skippedTotal ? `، ${skippedTotal} رد شد` : ''}`
          );
        } else {
          toast(
            `✅ ${savedTotal} فایل ذخیره شد` +
            `${skippedTotal ? `، ${skippedTotal} رد شد` : ''}`
          );
        }
      } catch (error) {
        const errorMessage = error?.message || String(error);

        statusEl.textContent =
          `❌ ذخیره در سرور ناموفق بود:\n${errorMessage}`;

        toast(
          `خطا: ${errorMessage}\n` +
          'مطمئن شوید سرور اجرا شده و مسیر ذخیره معتبر است'
        );
      }
    }

    // ---- Load a song from results into editor ----
    function loadAutoImportSong(key) {
      const song = window._aiResults.find(s => songUniqueId(s) === key);
      if (!song || song.error) return;
      if ($('autoFixChords') && $('autoFixChords').checked) {
        if ($('importAutoFix')) $('importAutoFix').checked = true;
      }
      const parsed = { title: song.title, artist: song.artist, key: song.key, rhythm: song.rhythm, rawText: song.rawText, url: song.url };
      _importParsed = parsed;
      $('importText').value = song.rawText;
      $('importUrl').value = song.url;
      openImportChordModal();
      showImportPreview(parsed);
    }

    async function fetchFromUrl() {
      const url = $('importUrl').value.trim();
      if (!url) { toast('لینک را وارد کنید'); return; }
      // Validate URL format
      let parsedUrl;
      try { parsedUrl = new URL(url); } catch(e) { toast('لینک نامعتبر است'); return; }
      const hostname = parsedUrl.hostname;
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) { toast('پروتکل نامعتبر'); return; }
      toast('در حال دریافت...');
      try {
        let html;
        const isLaminor = hostname === 'laminor.org' || hostname === 'www.laminor.org';
        const isAkord = hostname === 'akord.ir' || hostname === 'www.akord.ir';
        if (isAkord) {
          const proxyResp = await fetch('/api/akord/fetch?url=' + encodeURIComponent(url));
          const proxyData = await proxyResp.json();
          if (proxyData.error) throw new Error(proxyData.error);
          html = proxyData.html;
        } else if (isLaminor) {
          const proxyResp = await fetch('/api/fetch?url=' + encodeURIComponent(url));
          const proxyData = await proxyResp.json();
          if (proxyData.error) throw new Error(proxyData.error);
          html = proxyData.html;
        } else {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          html = await resp.text();
        }
        // برای لامینور از استخراج‌کننده دقیق (پیکسلی) استفاده کن
        if (isLaminor) {
          try {
            const extraction = await window.extractLaminorFromHtml(html);
            if (extraction && extraction.lines && extraction.lines.length > 0) {
              const converted = window.convertExtractedLinesToEdCur(extraction.lines);
              // گام اصلی (original key) و ریتم/امضای زمان از صفحهٔ لامینور استخراج می‌شود
              const extractedKey = extraction.key ? String(extraction.key).trim() : '';
              const extractedRhythm = extraction.rhythm ? String(extraction.rhythm).trim() : '';
              const parsed = {
                title: '',
                artist: '',
                key: extractedKey,
                rhythm: extractedRhythm,
                rawText: converted.lyrics,
                url,
                _extractedChords: converted.chords,
                _extractionWarnings: converted.warnings,
                _extractionValidation: extraction.validation
              };
              _importParsed = parsed;
              showImportPreview(parsed);
              toast('متن و آکوردها با دقت پیکسلی استخراج شد!');
            } else {
              // Fallback به روش متنی
              const parsed = parseChordPage(html, url);
              if (parsed) {
                _importParsed = parsed;
                showImportPreview(parsed);
                toast('متن استخراج شد (روش متنی)');
              } else { toast('نتوانستم متن را استخراج کنم'); }
            }
          } catch (extractErr) {
            console.warn('[Laminor Extractor] Pixel extraction failed, falling back to text:', extractErr);
            const parsed = parseChordPage(html, url);
            if (parsed) {
              _importParsed = parsed;
              showImportPreview(parsed);
              toast('متن استخراج شد (روش متنی)');
            } else { toast('نتوانستم متن را استخراج کنم'); }
          }
        } else {
          const parsed = parseChordPage(html, url);
          if (parsed) {
            _importParsed = parsed;
            showImportPreview(parsed);
            toast('متن استخراج شد!');
          } else { toast('نتوانستم متن را استخراج کنم'); }
        }
      } catch(e) { console.error(e); toast('خطا در دریافت: ' + e.message); }
    }

    function parseChordPage(html, url) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      let title = '', artist = '', key = '', rhythm = '', lyrics = '';

      // Safe hostname check using URL API
      function isLaminorUrl(u) {
        try { var h = new URL(u).hostname; return h === 'laminor.org' || h === 'www.laminor.org'; } catch(e) { return false; }
      }
      function isAkordUrl(u) {
        try { var h = new URL(u).hostname; return h === 'akord.ir' || h === 'www.akord.ir'; } catch(e) { return false; }
      }

      // Laminor specific parsing
      if (url && isLaminorUrl(url)) {
        const titleEl = doc.querySelector('h1');
        title = titleEl ? titleEl.textContent.replace(/آکورد\s+آهنگ\s*/, '').replace(/\s*-\s*لامینور.*$/, '').trim() : '';
        const artistEl = doc.querySelector('h6 a.color-light-blue, .smh-header-right-section a.color-light-blue');
        artist = artistEl ? artistEl.textContent.trim() : '';
        const keyMatch = html.match(/گام اصلی:\s*([A-G][#b]?m?)/);
        key = keyMatch ? keyMatch[1] : '';
        const rhythmEl = doc.querySelector('a[href*="rhythms/"]');
        rhythm = rhythmEl ? rhythmEl.textContent.trim() : '';
        if (!rhythm) {
          const rhythmMatch = html.match(/ریتم\s+پیشنهادی[\s\S]*?(\d+\/\d+)/);
          rhythm = rhythmMatch ? rhythmMatch[1] : '';
        }
        const preEl = doc.querySelector('pre#main-chord, pre.chord');
        if (preEl) {
          lyrics = preEl.textContent;
        } else {
          // Explicit fallback: try any <pre> only if it looks like chord content
          const allPres = doc.querySelectorAll('pre');
          for (const p of allPres) {
            const t = p.textContent || '';
            if (t.length > 20 && (CHORD_ONLY_REGEX.test(t.split('\n')[0].replace(/\s{2,}/g,' ').trim()) || hasPersian(t))) {
              lyrics = t;
              break;
            }
          }
        }
      }

      // Akord.ir specific parsing
      if (url && isAkordUrl(url)) {
        const titleEl = doc.querySelector('.section-title h4');
        title = titleEl ? titleEl.textContent.replace(/^آکورد\s*/, '').trim() : '';
        const breadcrumbLinks = doc.querySelectorAll('.breadcrumbs a');
        breadcrumbLinks.forEach(a => {
          const href = a.getAttribute('href');
          if (href && href.startsWith('/artists/') && href.split('/').filter(Boolean).length === 1) {
            artist = a.textContent.trim();
          }
        });
        const tags = doc.querySelectorAll('.tags');
        tags.forEach(t => {
          const text = t.textContent.trim();
          if (text.includes('گام:')) key = text.replace('گام:', '').trim();
          if (text.includes('ریتم:')) rhythm = text.replace('ریتم:', '').trim();
          if (text.includes('میزان:')) timeSignature = text.replace('میزان:', '').trim();
        });
        const preEl = doc.querySelector('pre#pre, pre');
        if (preEl) lyrics = preEl.textContent;
      }

      // Generic fallback - only if no lyrics found yet
      if (!lyrics) {
        const allPres = doc.querySelectorAll('pre');
        for (const p of allPres) {
          const t = p.textContent || '';
          if (t.length > 20) { lyrics = t; break; }
        }
      }

      if (!title) {
        const h1 = doc.querySelector('h1');
        title = h1 ? h1.textContent.trim() : '';
      }

      return { title, artist, key, rhythm, rawText: normalizeRawText(lyrics), url };
    }

    function parseChordLyricText(rawText) {
      // منطق به js/editor/LyricsParser.js منتقل شده است.
      return requireLyricsParser().parseChordLyricText(rawText);
    }

    function showImportPreview(parsed) {
      const parsed2 = parseChordLyricText(parsed.rawText);
      let preview = `عنوان: ${parsed.title || 'نامشخص'}\n`;
      preview += `خواننده: ${parsed.artist || 'نامشخص'}\n`;
      preview += `گام: ${parsed.key || 'نامشخص'}\n`;
      preview += `ریتم: ${parsed.rhythm || 'نامشخص'}\n`;
      preview += `آکوردها: ${[...parsed2.allChords].join(', ')}\n`;
      preview += `تعداد خطوط: ${parsed2.sections.length} (${parsed2.sections.filter(s=>s.type==='chord').length} خط آکورد + ${parsed2.sections.filter(s=>s.type==='lyric').length} خط شعر)`;
      $('importPreview').textContent = preview;
      $('importPreview').style.display = 'block';
    }

    function applyImportChords() {
      const text = $('importText').value.trim();
      if (!text && !_importParsed) { toast('متنی وارد نشده'); return; }

      let parsed;
      if (_importParsed && text.length === 0) {
        parsed = _importParsed;
      } else {
        parsed = { title: '', artist: '', key: '', rhythm: '', rawText: text, url: '' };
        const firstLines = text.split('\n').slice(0, 5);
        for (const l of firstLines) {
          if (!parsed.title && l.match(/آهنگ|ترانه|song/i)) { parsed.title = l.replace(/.*[:：]\s*/, '').trim(); }
          if (!parsed.artist && l.match(/خواننده|artist|از\s/i)) { parsed.artist = l.replace(/.*[:：]\s*/, '').replace(/از\s+/, '').trim(); }
        }
      }

      // --- Use canonical parser (only authority for positions) ---
      let parsedResult = parseRawSongToEdCur(parsed);

      // --- اگر استخراج پیکسلی انجام شده، آکوردهای دقیق را جایگزین کن ---
      if (parsed._extractedChords && parsed._extractedChords.length > 0) {
        parsedResult.chords = parsed._extractedChords;
        if (parsed._extractionWarnings) {
          parsedResult.warnings = parsedResult.warnings.concat(parsed._extractionWarnings);
        }
      }

      const imported = getEditorSongImportService()?.applyParsedResult(parsedResult);
      if (!imported) {
        toast('ترانه‌ای باز نیست');
        return;
      }

      getEditorDAW().clips = getEditorDAW().clips.filter(c => c.type !== 'chord');

      // --- Update UI ---
      edSyncToolbar();
      edRenderEditor(true);
      edSaveSong();
      renderAll();
      closeImportChordModal();
      toast('ترانه با ' + imported.chordCount + ' آکورد وارد شد: ' + (imported.title || 'بدون نام'));
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
    function resetShortcuts() { SHORTCUTS = {}; localStorage.removeItem('ed_shortcuts'); openShortcutModal(); toast('شرتکات به پیش‌فرض بازگشت'); }

    // ===== MIDI MAP (MIDI Learn) =====
    let MIDI_MAPS = {};
    let midiLearnActive = false;
    let midiLearnTargetId = null;
    function loadMidiMaps() { try { MIDI_MAPS = JSON.parse(localStorage.getItem('ed_midi_maps') || '{}'); } catch(_) { MIDI_MAPS = {}; } }
    function saveMidiMaps() { localStorage.setItem('ed_midi_maps', JSON.stringify(MIDI_MAPS)); }
    function getMidiMap(note) { return MIDI_MAPS['n' + note] || null; }
    function setMidiMap(note, funcId) { MIDI_MAPS['n' + note] = funcId; saveMidiMaps(); }
    function removeMidiMap(note) { delete MIDI_MAPS['n' + note]; saveMidiMaps(); }
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
    (function() {
      let toolbarDragging = false, toolbarOffX = 0, toolbarOffY = 0;
      let toolbarPointerId = null;
      const headerCtrl = $('headerCenterControls');
      const dragHandle = $('toolbarDragHandle');
      const pinBtn = $('toolbarPinBtn');
      if (!headerCtrl || !dragHandle || !pinBtn) return;
      dragHandle.style.touchAction = 'none';

      // Right-click context menu
      const toolbarGroups = [
        { label: 'گام و حالت', selector: '#edKey, #edKeyMode' },
        { label: 'تنظیمات متن', selector: '#edTextSize, #edTextFont, #edTextBold, #edAlignRight, #edAlignCenter, #edAlignLeft' },
        { label: 'تنظیمات آکورد', selector: '#edChordSize, #edChordFont, #edToggleChords' },
        { label: 'ترتیبی', selector: '#edSeqToggle, #edSeqStart, #edSeqPrev, #edSeqNext, #edClStart, #edClUndo, #edClClear, #edClApply, #edSeqModeSeg' },
        { label: 'ترنسپوز', selector: '#edTransDown, #edTransVal, #edTransUp' },
        { label: 'Undo/Redo', selector: '#edUndoBtn, #edRedoBtn' },
        { label: 'قفل ویرایشگر', selector: '#edEditorLockBtn' },
        { label: 'حذف ستاره', selector: '#edRemoveAsterisks' },
        { label: 'برعکس آکورد', selector: '#edReverseChords' },
        { label: 'حذف ستاره + برعکس', selector: '#edDoBoth' },
      ];

      function showToolbarContextMenu(e) {
        e.preventDefault();
        const old = document.querySelector('.toolbar-context-menu');
        if (old) old.remove();

        const menu = document.createElement('div');
        menu.className = 'toolbar-context-menu';

        // Pin/Unpin option
        const pinItem = document.createElement('div');
        pinItem.className = 'ctx-item';
        const isDocked = headerCtrl.classList.contains('floating') || headerCtrl.classList.contains('dock-left') || headerCtrl.classList.contains('dock-right');
        pinItem.innerHTML = `<span class="ctx-check">${isDocked ? '🔗' : '📌'}</span>${isDocked ? 'اتصال به صفحه' : 'جدا کردن'}`;
        pinItem.onclick = () => { toggleToolbarDock(); };
        menu.appendChild(pinItem);

        // Separator
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:#2d3748;margin:4px 0;';
        menu.appendChild(sep);

        // Show all
        const showAllItem = document.createElement('div');
        showAllItem.className = 'ctx-item';
        showAllItem.innerHTML = `<span class="ctx-check">👁‍🗨</span>نمایش همه`;
        showAllItem.onclick = () => {
          headerCtrl.querySelectorAll('.ed-grp, .ed-sep, .toolbar-drag-handle, .toolbar-pin-btn').forEach(el => { el.style.display = ''; });
          menu.remove();
        };
        menu.appendChild(showAllItem);

        // Separator
        const sep2 = document.createElement('div');
        sep2.style.cssText = 'height:1px;background:#2d3748;margin:4px 0;';
        menu.appendChild(sep2);

        // Show/Hide groups
        toolbarGroups.forEach((g, i) => {
          const item = document.createElement('div');
          item.className = 'ctx-item';
          const checkSpan = document.createElement('span');
          checkSpan.className = 'ctx-check';
          const updateIcon = () => {
            const els2 = headerCtrl.querySelectorAll(g.selector);
            const vis = els2.length > 0 && els2[0].offsetParent !== null;
            checkSpan.textContent = vis ? '👁' : '−';
            return vis;
          };
          updateIcon();
          item.appendChild(checkSpan);
          item.appendChild(document.createTextNode(g.label));
          item.onclick = () => {
            const els = headerCtrl.querySelectorAll(g.selector);
            const currentlyVisible = els.length > 0 && els[0].offsetParent !== null;
            els.forEach(el => {
              const grp = el.closest('.ed-grp') || el;
              grp.style.display = currentlyVisible ? 'none' : '';
            });
            updateIcon();
          };
          menu.appendChild(item);
        });

        document.body.appendChild(menu);
        // Position menu
        if (document.documentElement.dir === 'rtl') {
          menu.style.right = Math.min(window.innerWidth - e.clientX, window.innerWidth - 200) + 'px';
          menu.style.left = 'auto';
        } else {
          menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
          menu.style.right = 'auto';
        }
        menu.style.top = Math.min(e.clientY, window.innerHeight - 300) + 'px';

        // Close on click outside
        const closeMenu = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); } };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
      }

      dragHandle.addEventListener('contextmenu', showToolbarContextMenu);

      function toggleToolbarDock() {
        const isFloating = headerCtrl.classList.contains('floating');
        const isDocked = headerCtrl.classList.contains('dock-left') || headerCtrl.classList.contains('dock-right');
        headerCtrl.classList.remove('floating', 'dock-left', 'dock-right');
        if (isFloating || isDocked) {
          headerCtrl.style.cssText = 'flex-wrap:wrap; gap:4px;';
          pinBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 11l-4 4h14l-4-4"/><path d="M12 3v8"/><path d="M3 11h18"/></svg>';
        } else {
          headerCtrl.classList.add('floating');
          headerCtrl.style.left = '50%'; headerCtrl.style.top = '80px';
          headerCtrl.style.transform = 'translateX(-50%)';
          pinBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
        }
      }
      window.toggleToolbarDock = toggleToolbarDock;

      dragHandle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.toolbar-pin-btn') || e.button !== 0) return;
        if (headerCtrl.classList.contains('dock-left') || headerCtrl.classList.contains('dock-right')) {
          headerCtrl.classList.remove('dock-left', 'dock-right');
          headerCtrl.classList.add('floating');
          pinBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
        }
        if (!headerCtrl.classList.contains('floating')) {
          headerCtrl.classList.add('floating');
          const rect = headerCtrl.getBoundingClientRect();
          headerCtrl.style.left = rect.left + 'px'; headerCtrl.style.top = rect.top + 'px';
          headerCtrl.style.transform = 'none';
          pinBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
        }
        toolbarDragging = true;
        toolbarPointerId = e.pointerId;
        const rect = headerCtrl.getBoundingClientRect();
        toolbarOffX = e.clientX - rect.left;
        toolbarOffY = e.clientY - rect.top;
        dragHandle.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      });

      dragHandle.addEventListener('pointermove', (e) => {
        if (!toolbarDragging || e.pointerId !== toolbarPointerId) return;
        let x = e.clientX - toolbarOffX;
        let y = e.clientY - toolbarOffY;
        // Clamp to viewport
        x = Math.max(0, Math.min(x, window.innerWidth - 60));
        y = Math.max(0, Math.min(y, window.innerHeight - 40));
        headerCtrl.style.left = x + 'px'; headerCtrl.style.top = y + 'px';
        headerCtrl.style.transform = 'none';
      });

      dragHandle.addEventListener('pointerup', (e) => {
        if (!toolbarDragging || e.pointerId !== toolbarPointerId) return;
        dragHandle.releasePointerCapture?.(e.pointerId);
        toolbarDragging = false;
        toolbarPointerId = null;
        const rect = headerCtrl.getBoundingClientRect();
        const snapThreshold = 40;
        if (rect.left < snapThreshold) {
          headerCtrl.classList.remove('floating', 'dock-right');
          headerCtrl.classList.add('dock-left');
          headerCtrl.style.cssText = '';
          pinBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
        } else if (rect.right > window.innerWidth - snapThreshold) {
          headerCtrl.classList.remove('floating', 'dock-left');
          headerCtrl.classList.add('dock-right');
          headerCtrl.style.cssText = '';
          pinBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
        }
      });
      dragHandle.addEventListener('pointercancel', () => {
        toolbarDragging = false;
        toolbarPointerId = null;
      });
    })(); // End toolbar IIFE

    // ===== Ruler & Playhead (global scope, uses global refs) =====
    (function() {
      const lanes = $('lanes-container');
      const scroll = $('tl-scroll');
      if (!lanes || !scroll) return;

      const startPointerDrag = (target, startEvent, onMove, onEnd = () => {}) => {
        const pointerId = startEvent.pointerId;
        target.setPointerCapture?.(pointerId);
        const move = (event) => {
          if (event.pointerId === pointerId) onMove(event);
        };
        const end = (event) => {
          if (event.pointerId !== pointerId) return;
          target.releasePointerCapture?.(pointerId);
          target.removeEventListener('pointermove', move);
          target.removeEventListener('pointerup', end);
          target.removeEventListener('pointercancel', end);
          onEnd(event);
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);
      };

      // Scroll wheel zoom on timeline
      // Ctrl+Alt+wheel = vertical zoom (lane height)
      // Ctrl+wheel or Alt+wheel = horizontal zoom (pxPerSecond)
      scroll.addEventListener('wheel', (e) => {
        if (!e.altKey && !e.ctrlKey) return; e.preventDefault();
        if (e.ctrlKey && e.altKey) {
          // Vertical zoom: Ctrl+Alt+wheel
          const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
          setVerticalZoom(getEditorDAW().laneHeight * factor);
        } else {
          // Horizontal zoom: Ctrl+wheel or Alt+wheel
          const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12; setZoom(getEditorDAW().pxPerSecond * factor, e.clientX);
        }
      }, { passive: false });

      const beginScrub = (e) => {
  if (getEditorDAW().isRecording) { toast('در حال ضبط — برای جابه‌جایی پلی‌هد ابتدا توقف کنید'); return; }
  clearEditorTextSelection();
  edClearChordSelection();

  // Shift+click on playhead-hit: toggle playhead selection (draggable)
  if (e.shiftKey && e.currentTarget === $('playhead-hit')) {
    e.preventDefault();
    getEditorDAW().selectedPlayhead = !getEditorDAW().selectedPlayhead;
    $('main-playhead').classList.toggle('selected', getEditorDAW().selectedPlayhead);
    if (getEditorDAW().selectedPlayhead) {
      // Start dragging the selected playhead
      const startX = e.clientX; const origTime = getEditorDAW().playhead;
      const startY = e.clientY; const origPxPerSec = getEditorDAW().pxPerSecond;
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        seekTransport(Math.max(0, origTime + xToTime(dx)), false);
        // Cubase-style vertical zoom: up = zoom in, down = zoom out
        const dy = startY - ev.clientY;
        if (Math.abs(dy) > 3) {
          const zoomFactor = 1 + dy * 0.002;
          setZoom(clamp(origPxPerSec * zoomFactor, 4, 800), ev.clientX);
        }
        // Auto-scroll timeline
        autoScrollToPlayhead();
      };
      startPointerDrag(e.currentTarget, e, onMove);
    }
    return;
  }

  clearSelection();
  getEditorDAW().selectedPlayhead = false; $('main-playhead').classList.remove('selected');
  e.preventDefault();

  // Cubase-style: click on upper half of ruler to set locators
  const ruler = $('timeline-ruler');
  if (ruler) {
    const rulerRect = ruler.getBoundingClientRect();
    const localY = e.clientY - rulerRect.top;
    const isUpperHalf = localY < rulerRect.height * 0.5;

    if (isUpperHalf && getEditorDAW().loopEnabled) {
      const t = clientToTime(e.clientX);
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Click = set right locator
        getEditorDAW().loopB = Math.max(t, getEditorDAW().loopA + 0.5);
        renderLoopRegion(); saveState();
      } else {
        // Click = set left locator
        getEditorDAW().loopA = Math.min(t, getEditorDAW().loopB - 0.5);
        renderLoopRegion(); saveState();
      }
      return;
    }
  }

  seekTransport(clientToTime(e.clientX), true);

        const scrubStartX = e.clientX; const scrubStartY = e.clientY; const scrubOrigPxPerSec = getEditorDAW().pxPerSecond;
        const move = (ev) => {
          seekTransport(clientToTime(ev.clientX), true);
          // Cubase-style vertical zoom: up = zoom in, down = zoom out
          const dy = scrubStartY - ev.clientY;
          if (Math.abs(dy) > 3) {
            const zoomFactor = 1 + dy * 0.002;
            setZoom(clamp(scrubOrigPxPerSec * zoomFactor, 4, 800), ev.clientX);
          }
          // Auto-scroll timeline
          autoScrollToPlayhead();
        };
        startPointerDrag(e.currentTarget, e, move);
      };
      $('timeline-ruler').addEventListener('pointerdown', beginScrub);
      $('playhead-hit').addEventListener('pointerdown', beginScrub);

      // Timeline separator drag: drag up = lanes bigger, drag down = lanes smaller
      const sepEl = $('timelineSep');
      if (sepEl) {
        sepEl.style.touchAction = 'none';
        sepEl.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const startY = e.clientY;
          const origH = getEditorDAW().laneHeight;
          const onMove = (ev) => { const dy = startY - ev.clientY; setVerticalZoom(origH + dy * 0.5); };
          startPointerDrag(sepEl, e, onMove);
        });
      }
      
      toast(t('dawReady'));

      // Global deselect: clicking anywhere clears all selections
      document.addEventListener('mousedown', (e) => {
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

      // Timeline resizable separator
      const sep = $('timelineSep');
      if (sep) {
        sep.style.touchAction = 'none';
        sep.addEventListener('pointerdown', e => {
          e.preventDefault();
          const startY = e.clientY;
          const grid = $('app-container') || document.querySelector('.app-container');
          const startRow = parseInt(getComputedStyle(grid).gridTemplateRows.split(' ')[3]) || 320;
          const move = ev => {
            const delta = startY - ev.clientY;
            const newH = Math.max(120, Math.min(window.innerHeight - 200, startRow + delta));
            grid.style.gridTemplateRows = `75px 1fr 4px ${newH}px`;
          };
          startPointerDrag(sep, e, move);
        });
      }
      // Init sync UI
      initSyncUI();
    })();

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

    let edCur = null;
    window.EditorLegacySongBridge = {
      get: () => edCur,
      set: song => { edCur = song; }
    };
    setEditorSong(edCur);

    // سرویس‌های جدید از reference رسمی runtime می‌خوانند؛
    // متغیر lexical فقط برای کد legacy همین فایل باقی مانده است.
    function getCurrentEditorSong() {
      return window.EditorRuntimeAdapter?.getSong?.() || edCur || null;
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
    function getEditorSongInitializationService() {
      if (
        !edSongInitializationService &&
        (
          typeof window.EditorSongInitializationService?.initializeEditor === 'function' ||
          typeof window.EditorSongInitializationService?.initialize === 'function'
        )
      ) {
        edSongInitializationService = window.EditorSongInitializationService;
      }
      return edSongInitializationService;
    }

    async function edInitSong() {
      const initializationService = getEditorSongInitializationService();
      const initializeEditor = initializationService?.initializeEditor
        || initializationService?.initialize;
      return initializeEditor?.({
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
      });
     }

    // -- Unified Save/Load (Timeline + Lyrics + Audio) --
    // IndexedDB for audio blob storage
    let audioDB = null;
    function openAudioDB() {
      if (audioDB) return Promise.resolve(audioDB);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('AchordAudioDB', 2);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('audioBlobs')) db.createObjectStore('audioBlobs');
          if (!db.objectStoreNames.contains('fileHandles')) db.createObjectStore('fileHandles');
        };
        req.onsuccess = e => { audioDB = e.target.result; resolve(audioDB); };
        req.onerror = () => reject(req.error);
      });
    }

    // ===== ذخیره FileHandle در IndexedDB برای لود اتوماتیک بدون سوال =====
    async function saveFileHandle(bufferKey, handle) {
      try {
        const db = await openAudioDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fileHandles', 'readwrite');
          tx.objectStore('fileHandles').put(handle, bufferKey);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch(e) { console.warn('[HANDLE] Save error:', e); }
    }

    async function getFileHandle(bufferKey) {
      try {
        const db = await openAudioDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fileHandles', 'readonly');
          const req = tx.objectStore('fileHandles').get(bufferKey);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      } catch(e) { return null; }
    }
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

    /**
     * saveAudioBlobToDB — ذخیره Blob فایل صوتی در IndexedDB (نه Base64)
     *
     * این تابع برای حالتی هست که کاربر «نه» می‌زنه ولی فایل در مرورگر هست.
     * قبلاً کد showOpenFilePicker رو صدا می‌زد و دوباره از کاربر فایل می‌خواست.
     * حالا به‌جای اون، همون فایل درگ‌شده رو به‌صورت Blob در IndexedDB ذخیره می‌کنیم.
     * اینطوری برای لود بعدی، نیازی به سوال از کاربر نیست.
     *
     * @param {string} bufferKey - کلید یکتای بافر
     * @param {File|Blob} file - فایل صوتی
     * @param {string} fileName - نام فایل
     */
    async function saveAudioBlobToDB(bufferKey, file, fileName) {
      try {
        const db = await openAudioDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fileHandles', 'readwrite');
          // ذخیره به‌صورت Blob خام (نه Base64) — حجم کمتر و لود سریع‌تر
          const record = {
            type: 'blob',
            blob: file,
            fileName: fileName,
            size: file.size,
            lastModified: file.lastModified || Date.now()
          };
          tx.objectStore('fileHandles').put(record, bufferKey);
          tx.oncomplete = () => {
            console.log(`[BLOB] Saved to IndexedDB: ${fileName} (${(file.size/1024/1024).toFixed(2)} MB)`);
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        });
      } catch(e) {
        console.warn('[BLOB] Save error:', e);
      }
    }

    /**
     * getAudioBlobFromDB — خواندن Blob فایل صوتی از IndexedDB
     * @param {string} bufferKey
     * @returns {Promise<{blob:Blob, fileName:string}|null>}
     */
    async function getAudioBlobFromDB(bufferKey) {
      try {
        const db = await openAudioDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fileHandles', 'readonly');
          const req = tx.objectStore('fileHandles').get(bufferKey);
          req.onsuccess = () => {
            const result = req.result;
            if (result && result.type === 'blob' && result.blob) {
              resolve({ blob: result.blob, fileName: result.fileName });
            } else {
              resolve(null);
            }
          };
          req.onerror = () => reject(req.error);
        });
      } catch(e) { return null; }
    }
    // Event listeners for modal buttons
    document.addEventListener('DOMContentLoaded', () => {
      const yesBtn = $('audioCopyYes');
      const noBtn = $('audioCopyNo');
      if (yesBtn) yesBtn.onclick = () => { const m = $('audioCopyModal'); if (m) m.style.display = 'none'; if (_copyModalResolver) { _copyModalResolver(true); _copyModalResolver = null; } };
      if (noBtn) noBtn.onclick = () => { const m = $('audioCopyModal'); if (m) m.style.display = 'none'; if (_copyModalResolver) { _copyModalResolver(false); _copyModalResolver = null; } };
    });

    /**
     * saveAudioBlobsForProject — ذخیره فایل‌های صوتی embedded در IndexedDB
     *
     * استراتژی جدید (بهبود حجم):
     *   1. اگر فایل اصلی (Blob) در _originalBlob ذخیره شده، همون رو مستقیم ذخیره می‌کنیم
     *      (این حالت بهترین هست چون فایل MP3 اصلی بدون تغییر ذخیره می‌شه)
     *   2. در غیر این صورت، AudioBuffer رو به WAV encode می‌کنیم و با CompressionStream
     *      فشرده می‌کنیم (حدود ۵-۱۰ برابر کوچکتر از Float32Array خام)
     *
     * قبلاً این تابع Float32Array خام رو به‌صورت JSON ذخیره می‌کرد که بسیار حجیم بود
     * (یک آهنگ ۳ دقیقه‌ای = ~۱۵۰ مگابایت).
     */
    async function saveAudioBlobsForProject(projectId) {
      const db = await openAudioDB();
      return new Promise(async (resolve, reject) => {
        const tx = db.transaction('audioBlobs', 'readwrite');
        const store = tx.objectStore('audioBlobs');

        // فقط کلیپ‌هایی که _embedded:true دارند ذخیره میشوند
        const embeddedClips = getEditorDAW().clips.filter(c =>
          c.type !== 'chord' && c.bufferKey && c._embedded
        );

        // First clear old data for this project
        store.delete(projectId);

        if (embeddedClips.length === 0) { resolve(); return; }

        // ─── مرحله 1: ذخیره Blob های اصلی (اگه موجود باشن) ───
        // این fast path هست — اگه فایل MP3 اصلی رو داریم، همون رو ذخیره می‌کنیم
        const allBlobs = [];
        for (const clip of embeddedClips) {
          const key = clip.bufferKey;
          const buffer = getEditorDAW().bufferCache.get(key);
          if (!buffer) continue;

          // اگه Blob اصلی ذخیره شده، از اون استفاده کن
          if (clip._originalBlob) {
            const blob = clip._originalBlob;
            allBlobs.push({
              key,
              format: 'blob',
              mimeType: blob.type || 'audio/mpeg',
              fileName: clip.fileName || clip.name || (key + '.mp3'),
              size: blob.size,
              duration: buffer.duration,
              sampleRate: buffer.sampleRate,
              channels: buffer.numberOfChannels,
              blob: blob
            });
            console.log(`[Audio Save] Saved original blob: ${clip.fileName} (${(blob.size/1024/1024).toFixed(2)} MB)`);
          } else {
            // ─── مرحله 2: encode به WAV و فشرده‌سازی ───
            try {
              const wavBytes = audioBufferToWav(buffer);
              const compressedBlob = await compressBytes(wavBytes);
              allBlobs.push({
                key,
                format: 'wav-deflate',
                mimeType: 'application/octet-stream',
                fileName: (clip.fileName || clip.name || key).replace(/\.[^.]+$/, '') + '.wav.deflate',
                size: compressedBlob.size,
                duration: buffer.duration,
                sampleRate: buffer.sampleRate,
                channels: buffer.numberOfChannels,
                blob: compressedBlob
              });
              console.log(`[Audio Save] Saved WAV+deflate: ${clip.fileName} (raw=${(wavBytes.length/1024/1024).toFixed(2)}MB → compressed=${(compressedBlob.size/1024/1024).toFixed(2)}MB)`);
            } catch (e) {
              console.warn(`[Audio Save] Failed to encode ${clip.fileName}:`, e);
            }
          }
        }

        if (allBlobs.length === 0) { resolve(); return; }
        store.put(allBlobs, projectId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    /**
     * compressBytes — فشرده‌سازی Uint8Array با CompressionStream (deflate)
     */
    async function compressBytes(uint8Arr) {
      try {
        const cs = new CompressionStream('deflate');
        const writer = cs.writable.getWriter();
        writer.write(uint8Arr);
        writer.close();
        const reader = cs.readable.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLen = chunks.reduce((s, c) => s + c.length, 0);
        const result = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
        return new Blob([result], { type: 'application/octet-stream' });
      } catch (e) {
        // fallback: بدون فشرده‌سازی
        return new Blob([uint8Arr], { type: 'application/octet-stream' });
      }
    }
    async function loadAudioBlobsForProject(projectId) {
      const db = await openAudioDB();
      return new Promise(async (resolve, reject) => {
        const tx = db.transaction('audioBlobs', 'readonly');
        const store = tx.objectStore('audioBlobs');
        const req = store.get(projectId);
        req.onsuccess = async () => {
          const allBufs = req.result;
          if (!allBufs) { resolve(); return; }
          ensureAudioCtx();
          for (const entry of allBufs) {
            try {
              let buffer = null;

              if (entry.format === 'blob' && entry.blob) {
                // ─── فرمت جدید: Blob اصلی (MP3, WAV, etc.) ───
                const arrayBuffer = await entry.blob.arrayBuffer();
                buffer = await getEditorDAW().audioCtx.decodeAudioData(arrayBuffer);
                console.log(`[Audio Load] Loaded blob: ${entry.fileName}`);
              } else if (entry.format === 'wav-deflate' && entry.blob) {
                // ─── فرمت جدید: WAV فشرده‌شده با deflate ───
                const compressedBytes = new Uint8Array(await entry.blob.arrayBuffer());
                const wavBytes = await decompressBytes(compressedBytes);
                const wavBlob = new Blob([wavBytes], { type: 'audio/wav' });
                const arrayBuffer = await wavBlob.arrayBuffer();
                buffer = await getEditorDAW().audioCtx.decodeAudioData(arrayBuffer);
                console.log(`[Audio Load] Loaded WAV+deflate: ${entry.fileName}`);
              } else if (entry.data) {
                // ─── فرمت قدیمی: Float32Array ───
                const chData = Array.isArray(entry.data) ? entry.data : [entry.data];
                buffer = getEditorDAW().audioCtx.createBuffer(chData.length, entry.length, entry.sampleRate);
                chData.forEach((ch, i) => { if (i < buffer.numberOfChannels) buffer.getChannelData(i).set(ch); });
                console.log(`[Audio Load] Loaded legacy Float32: ${entry.key}`);
              }

              if (buffer) {
                getEditorDAW().bufferCache.set(entry.key, buffer);
              }
            } catch (e) {
              console.warn(`[Audio Load] Failed to load ${entry.key}:`, e);
            }
          }
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    }
    async function deleteAudioBlobsForProject(projectId) {
      try { const db = await openAudioDB(); return new Promise((resolve) => { const tx = db.transaction('audioBlobs','readwrite'); tx.objectStore('audioBlobs').delete(projectId); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); }); } catch(e) {}
    }

    // ===== AUDIO BACKUP & RECOVERY =====
    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function base64ToUint8(b64) {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 65536) {
        const end = Math.min(i + 65536, binary.length);
        for (let j = i; j < end; j++) bytes[j] = binary.charCodeAt(j);
      }
      return bytes;
    }

    async function decodeWebMToBuffer(webmUint8) {
      const blob = new Blob([webmUint8], { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      try {
        ensureAudioCtx();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await getEditorDAW().audioCtx.decodeAudioData(arrayBuffer);
        URL.revokeObjectURL(url);
        return audioBuffer;
      } catch(e) {
        URL.revokeObjectURL(url);
        throw e;
      }
    }

    // Legacy format helpers (for importing old backup files)
    function resampleFloat32(src, srcRate, dstRate) {
      if (srcRate === dstRate) return src;
      const ratio = srcRate / dstRate;
      const newLen = Math.round(src.length / ratio);
      const out = new Float32Array(newLen);
      for (let i = 0; i < newLen; i++) {
        const pos = i * ratio; const i0 = Math.floor(pos); const i1 = Math.min(i0 + 1, src.length - 1); const frac = pos - i0;
        out[i] = src[i0] * (1 - frac) + src[i1] * frac;
      }
      return out;
    }
    async function decompressBytes(uint8Arr) {
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(uint8Arr); writer.close();
      const reader = ds.readable.getReader();
      const chunks = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
      return result;
    }

    async function refreshStorageInfo() {
      try {
        const infoBar = $('storageInfoBar');
        if (!infoBar) return;
        infoBar.style.display = 'block';

        // Estimate total usage via navigator.storage
        let usageBytes = 0, quotaBytes = 0;
        if (navigator.storage && navigator.storage.estimate) {
          const est = await navigator.storage.estimate();
          usageBytes = est.usage || 0;
          quotaBytes = est.quota || 0;
        }

        // Count audio blobs specifically
        let audioCount = 0, audioBytes = 0;
        try {
          const db = await openAudioDB();
          const tx = db.transaction('audioBlobs', 'readonly');
          const store = tx.objectStore('audioBlobs');
          const allKeys = await new Promise(r => { const req = store.getAllKeys(); req.onsuccess = () => r(req.result); req.onerror = () => r([]); });
          audioCount = allKeys.length;
          for (const key of allKeys) {
            const data = await new Promise(r => { const req2 = store.get(key); req2.onsuccess = () => r(req2.result); req2.onerror = () => r(null); });
            if (data) {
              for (const entry of (Array.isArray(data) ? data : [])) {
                for (const ch of (entry.data || [])) {
                  if (ch) audioBytes += ch.byteLength || 0;
                }
              }
            }
          }
        } catch(_) {}

        // Update UI
        const pct = quotaBytes > 0 ? Math.min(100, (usageBytes / quotaBytes) * 100) : 0;
        const bar = $('storageBarInner');
        const txt = $('storageText');
        if (bar) {
          bar.style.width = pct.toFixed(1) + '%';
          bar.style.background = pct > 80 ? 'linear-gradient(90deg,#e6aa28,#ff4444)' : pct > 50 ? 'linear-gradient(90deg,#22d364,#e6aa28)' : 'linear-gradient(90deg,#22d364,#00F2FE)';
        }
        if (txt) {
          txt.innerHTML = `مجموع: ${formatBytes(usageBytes)} / ${formatBytes(quotaBytes)} (${pct.toFixed(1)}%)` +
            (audioCount > 0 ? `<br>صدا: ${audioCount} فایل · ${formatBytes(audioBytes)}` : '<br>فایل صوتی ذخیره نشده');
        }

        // Warn if near limit
        if (pct > 85) {
          toast('⚠️ حافظه مرورگر پر است! خروجی کامل بگیرید');
        }
      } catch(e) { console.warn('Storage info error:', e); }
    }

    async function edExportProjectFull() {
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

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: 'فایل پروژه کامل', accept: { 'application/json': ['.json'] } }] });
          const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
          toast(`خروجی ذخیره شد (${sizeMB} MB, ${audioCount} کپی + ${linkedCount} لینک)`);
          refreshStorageInfo();
          return;
        } catch (e) { if (e.name === 'AbortError') { toast('لغو شد'); return; } }
      }
      // Fallback: confirm before download
      const linkedInfo = linkedCount > 0 ? `\nلینک‌شده: ${linkedCount} فایل (بدون صدا)` : '';
      if (!confirm(`دانلود فایل: ${defaultName}\nحجم: ${sizeMB} MB\nصدا: ${audioCount} کپی‌شده${linkedInfo}\n\nذخیره در پوشه دانلود؟`)) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = defaultName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(`خروجی ذخیره شد (${sizeMB} MB, ${audioCount} کپی + ${linkedCount} لینک)`);
      refreshStorageInfo();
      } catch(e) { console.error('Export error:', e); toast('خطا در خروجی: ' + e.message); }
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
              const displayKey = song.transpose
                ? (edTransposeKeyName(
                    song.originalKey || song.key,
                    song.transpose
                  ) || song.key)
                : song.key;
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
      if (oldText === newText || !edCur) return;
      // منطق remap به js/editor/LyricPositionMapper.js منتقل شده است.
      edCur.chords.forEach(ch => requireLyricPositionMapper().remapAnchorToNewText(ch, oldText, newText));
      edFilterChordsWithBase(ch => ch.lineIndex >= 0);
    }

    if ($('editor')) {
      $('editor').addEventListener('input', () => {
  if (!edCur) return;

  const oldText = edCur.lyrics;
  const newText = edGetLyricsFromDOM();
  if (oldText === newText) return;

  edCur.lyrics = newText;

  // Remap anchors and sequence points immediately
  edRemapAnchors(oldText, newText);
  edRemapSeqPoints(oldText, newText);

  // Debounced editor refresh
  edScheduleEditorRefresh();

  // Debounced commit for undo stack
  clearTimeout(edCommitTimer);
  edCommitTimer = setTimeout(() => {
    edCommit();
  }, 300);

  // Debounced save
  edScheduleSave();
});

;
      $('editor').addEventListener('paste', e => {
        e.preventDefault();
        let text = (e.clipboardData||window.clipboardData).getData('text/plain');
        // Remove ALL empty lines
        text = text.split('\n').filter(line => line.trim() !== '').join('\n');
        document.execCommand('insertText', false, text);
      });
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
    // Clear selection when clicking empty area
if ($('editorWrap')) {
  $('editorWrap').addEventListener('mousedown', e => {
    if (!edCur) return;

    clearSelection();

    if (!e.altKey &&
        !edAltDown &&
        !e.target.closest('.chord')) {
      edClearChordSelection();
    }
  }, true);
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

    // -- Mousedown on editorWrap: Alt+Click = add chord --
    if ($('editorWrap')) {
      $('editorWrap').addEventListener('mousedown', e => {
        if (!edCur) return;
        if (edCur.editorLocked && !e.target.closest('.chord')) {
          toast('🔒 ویرایشگر قفل است');
          const btn = $('edEditorLockBtn');
          if (btn) { btn.classList.add('editor-lock-blink'); setTimeout(() => btn.classList.remove('editor-lock-blink'), 2000); }
          return;
        }
        const altHeld = e.altKey || edAltDown;
        if (altHeld) {
          if (edCur.editorLocked) { toast('🔒 ویرایشگر قفل است'); return; }
          e.preventDefault(); e.stopPropagation();
          const anchor = anchorFromPoint(e.clientX, e.clientY);
          if (!anchor) return;
          edPendingAnchor = anchor; edChordIdx = null; edOpenChordModal(null);
          return;
        }
      });
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


if ($('edUndoBtn')) {
  $('edUndoBtn').onclick = () => {
    getHistoryService().undo();
  };
}


if ($('edRedoBtn')) {
  $('edRedoBtn').onclick = () => {
    getHistoryService().redo();
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
    function edFillCol(el, items, cb) { el.innerHTML = ''; items.forEach(v => { const d = document.createElement('div'); d.className = 'chord-item'; d.textContent = v === '' ? '—' : v; d.onclick = () => { [...el.children].forEach(c => c.classList.remove('active')); d.classList.add('active'); cb(v); updateChordPreview(); }; el.appendChild(d); }); }

    function edOpenChordModal(idx) {
      if (!edCur) return;
      edChordIdx = idx;
      edChordModalMode = 'editor';
      // Set currentChord from existing chord
      if (idx !== null && edCur.chords[idx]) {
        const parsed = getEditorChordCommandService()?.parseName(edCur.chords[idx].name);
        currentChord = parsed || { root: 'None', type: 'None', tension: '', bass: 'None' };
      } else {
        currentChord = { root: 'None', type: 'None', tension: '', bass: 'None' };
      }
      // Update title and buttons for editor mode
      $('chordModalTitle').textContent = t('editSongChord');
      $('chordModalConfirmBtn').textContent = t('confirmBtn');
      // Update preview and manual input
      const currentChordName = (idx !== null && edCur.chords[idx]) ? edCur.chords[idx].name : '';
      $('chord-preview').textContent = currentChordName || 'None';
      $('chordManual').value = currentChordName;
      $('chord-modal').classList.add('show');
      buildChordEditor();
      // اضافه کردن هندلر کیبورد برای دکمه ESC
      const chordModal = $('chord-modal');
      if (chordModal) {
        // حذف هندلر قبلی اگر وجود دارد
        if (chordModal._escHandlerEd) chordModal.removeEventListener('keydown', chordModal._escHandlerEd);
        chordModal._escHandlerEd = (e) => {
          if (e.key === 'Escape' && edChordModalMode === 'editor') {
            e.preventDefault();
            edCloseChordModal();
          }
        };
        chordModal.addEventListener('keydown', chordModal._escHandlerEd);
        // فوکوس روی مودال برای اینکه ESC بدون کلیک کار کند
        chordModal.focus();
      }
    }

    function edCloseChordModal() { $('chord-modal').classList.remove('show'); edPendingAnchor = null; edChordIdx = null; edChordModalMode = null; }
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
        origLabel.title = 'گام اورجینال: ' + origKey + (origMode === 'min' ? 'm' : '') + ' | کلیک=تغییر | Alt+کلیک=ریست';
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

    // ORIGINAL KEY CHANGE: update baseChordNames and apply
    function applyOriginalKeyChange(newKey, newMode) {
      const result = getEditorKeyCommandService()?.applyOriginalKeyChange(
        edCur,
        newKey,
        newMode
      );
      if (!result?.changed) return;
      refreshKeyUI();
      renderAllChordsAndText();
      edSaveSong();
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

    // Click on original key label → change or reset
    if ($('edOrigKeyLabel')) $('edOrigKeyLabel').addEventListener('click', (e) => {
      if (!edCur) return;

      // Alt+Click → FULL RESET to saved original key
      if (e.altKey) {
        resetToOriginalKey();
        toast('گام به حالت اورجینال برگشت: ' + (edCur.originalKey || '') + ((edCur.originalKeyMode || '') === 'min' ? 'm' : ''));
        return;
      }

      // Normal click → change original key
      const curOrigKey = edCur.originalKey || edCur.key;
      const curOrigMode = edCur.originalKeyMode || edCur.keyMode || 'maj';
      const curOrigStr = curOrigKey + (curOrigMode === 'min' ? 'm' : '');
      const newOrig = prompt('گام اورجینال آهنگ رو مشخص کنید:', curOrigStr);
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
      toast('گام اورجینال ذخیره و اعمال شد: ' + newKey + (newMode === 'min' ? 'm' : ''));
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
      if (!edCur || edCur.editorLocked) return;
      const lines = edCur.lyrics.split('\n');
      if (lines.length === 0) return;
      const shuffled = _shufflePalette();

      if (type === 'text') {
        if (!edCur.lineColors) edCur.lineColors = [];
        for (let i = 0; i < lines.length; i++) {
          edCur.lineColors[i] = shuffled[i % shuffled.length];
        }
        edRenderEditor(false);
        toast('🎨 رنگ متن رندوم شد');
      } else {
        edCur.chords.forEach(ch => {
          ch.color = shuffled[ch.lineIndex % shuffled.length];
        });
        edRenderChords();
        toast('🎨 رنگ آکوردها رندوم شد');
      }
      edSaveSong();
    }

    function resetLineColor(type) {
      if (!edCur) return;
      const defaultTextColor = '#0fa966';
      const defaultChordColor = '#e6aa28';
      if (type === 'text') {
        edCur.lineColors = [];
        edCur.styles.tColor = defaultTextColor;
        edRenderEditor(false);
        toast('🔄 رنگ متن ریست شد');
      } else {
        edCur.chords.forEach(ch => { ch.color = defaultChordColor; });
        edCur.styles.cColor = defaultChordColor;
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
          onToggleRecording: () => toggleRec(),
          onToggleSelectedTrackHeight: () => toggleSelectedTrackHeight(),
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

    // ===== COLOR TOOL (Context-Aware Paint Brush) =====
    const COLOR_PALETTE = [
      '#FF2E93','#FF6B6B','#FFA726','#FFD54F','#AED581','#4DB6AC','#4FC3F7','#7986CB',
      '#BA68C8','#F06292','#E57373','#FF8A65','#FFB74D','#FFF176','#81C784','#4DD0E1',
      '#64B5F6','#9575CD','#E91E63','#F44336','#FF9800','#FFEB3B','#8BC34A','#009688',
      '#2196F3','#3F51B5','#9C27B0','#795548','#607D8B','#000000','#424242','#757575',
      '#9E9E9E','#BDBDBD','#E0E0E0','#FFFFFF','#3FB8AF','#3182CE','#D69E2E','#9F7AEA',
      '#ED64A6','#48BB78','#ED8936','#00B5D8','#E53E3E','#38A169','#FF69B4','#805AD5',
    ];
    const QUICK_COLORS = ['#FF2E93','#FF6B6B','#FFA726','#FFD54F','#4DB6AC','#4FC3F7','#7986CB','#9F7AEA'];

    let colorToolMode = null;
    let currentColor = '#3FB8AF';

    function isColorToolActive() { return colorToolMode === 'brush' || colorToolMode === 'eyedropper'; }

    function initQuickBar() {
      const bar = $('colorQuickBar');
      if (!bar) return;
      bar.innerHTML = '';
      QUICK_COLORS.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'color-quick-swatch' + (c === currentColor ? ' active' : '');
        sw.style.background = c;
        sw.title = c;
        sw.onclick = (e) => { e.stopPropagation(); selectColor(c); };
        bar.appendChild(sw);
      });
    }

    function selectColor(color) {
      currentColor = color;
      const picker = $('colorPickerInput');
      if (picker) picker.value = color;
      document.querySelectorAll('.color-quick-swatch').forEach(el => {
        el.classList.toggle('active', el.style.background === color || rgbToHex(el.style.background) === color);
      });
    }

    function rgbToHex(rgb) {
      if (!rgb || rgb.startsWith('#')) return rgb;
      const m = rgb.match(/(\d+)/g);
      if (!m || m.length < 3) return rgb;
      return '#' + m.slice(0,3).map(x => (+x).toString(16).padStart(2,'0')).join('');
    }

    function toggleColorTool(mode) {
      if (colorToolMode === mode) { deactivateColorTool(); return; }
      colorToolMode = mode;
      const bar = $('colorQuickBar');
      if (mode === 'brush') {
        $('colorBrushBtn').classList.add('active');
        $('colorBrushBtn').classList.remove('active-eyedropper');
        $('colorEyedropperBtn').classList.remove('active', 'active-eyedropper');
        document.body.classList.add('color-tool-brush');
        document.body.classList.remove('color-tool-eyedropper');
      } else {
        $('colorEyedropperBtn').classList.add('active-eyedropper');
        $('colorEyedropperBtn').classList.remove('active');
        $('colorBrushBtn').classList.remove('active', 'active-eyedropper');
        document.body.classList.add('color-tool-eyedropper');
        document.body.classList.remove('color-tool-brush');
      }
      if (bar) { bar.classList.add('show'); initQuickBar(); }
    }

    function deactivateColorTool() {
      colorToolMode = null;
      $('colorBrushBtn')?.classList.remove('active', 'active-eyedropper');
      $('colorEyedropperBtn')?.classList.remove('active', 'active-eyedropper');
      document.body.classList.remove('color-tool-brush', 'color-tool-eyedropper');
      const bar = $('colorQuickBar');
      if (bar) bar.classList.remove('show');
    }

    function applyColorToClip(clip, color) {
      clip.color = color;
      const el = document.querySelector(`.clip[data-clip-id="${clip.id}"]`);
      if (el) {
        if (clip.type === 'chord') {
          el.style.background = `linear-gradient(180deg, ${color}cc, ${color}77)`;
          el.style.borderColor = color;
        } else {
          el.style.background = `linear-gradient(180deg, ${color}bb, ${color}88)`;
        }
      }
    }

    function applyColorToSection(sec, color) {
      sec.color = color;
      const el = document.querySelector(`.section-tag[data-section-id="${sec.id}"]`);
      if (el) {
        el.style.background = `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},0.35)`;
        el.style.borderColor = color;
      }
    }

    // Context-Aware: detect what was clicked and paint/pick it
    // Shift+click = paint ALL items of same type (global)
    // Regular click = paint ONLY this item (per-item)
    function paintContextAware(e) {
      const isGlobal = e.shiftKey;

      if (colorToolMode === 'brush') {
        // 0. Section tag (decoupled from clips)
        const secTagEl = e.target.closest('.section-tag');
        if (secTagEl) {
          const sec = (getEditorDAW().sections || []).find(s => s.id === secTagEl.dataset.sectionId);
          if (!sec) return false;
          if (isGlobal) {
            (getEditorDAW().sections || []).forEach(s => applyColorToSection(s, currentColor));
            saveState(); renderClips();
            toast('همه بخش‌ها رنگ شد');
          } else {
            applyColorToSection(sec, currentColor); saveState();
            toast('رنگ بخش: ' + currentColor);
          }
          return true;
        }
        // 1. Timeline chord clip
        const clipEl = e.target.closest('.clip');
        if (clipEl) {
          const clip = getClip(clipEl.dataset.clipId);
          if (!clip) return false;
          if (isGlobal) {
            getEditorDAW().clips.forEach(c => { if (c.type === clip.type) applyColorToClip(c, currentColor); });
            saveState(); renderClips();
            toast('همه ' + (clip.type === 'chord' ? 'آکوردهای تایم‌لاین' : 'کلیپ‌ها') + ' رنگ شد');
          } else {
            applyColorToClip(clip, currentColor); saveState();
            toast('رنگ کلیپ: ' + currentColor);
          }
          return true;
        }
        // 2. Editor text line (check BEFORE chord — chords overlay text via z-index)
        const eline = e.target.closest('.eline');
        if (eline && edCur) {
          const li = parseInt(eline.dataset.lineIndex);
          if (!edCur.lineColors) edCur.lineColors = [];
          if (isGlobal) {
            edCur.styles.tColor = currentColor;
            edCur.lineColors = [];
            // Apply to ALL eline elements directly
            document.querySelectorAll('#editor .eline').forEach(el => { el.style.color = currentColor; });
            saveState(); edSaveSong();
            toast('رنگ همه متن: ' + currentColor);
          } else if (li >= 0) {
            edCur.lineColors[li] = currentColor;
            // Apply color directly — do NOT call edRenderEditor which may interfere
            eline.style.color = currentColor;
            saveState(); edSaveSong();
            toast('رنگ خط ' + (li + 1) + ': ' + currentColor);
          }
          return true;
        }
        // 3. Editor chord (after text line — so text always gets colored)
        const chordEl = e.target.closest('.chord');
        if (chordEl && edCur) {
          const ci = parseInt(chordEl.dataset.idx);
          if (isGlobal) {
            edCur.styles.cColor = currentColor;
            edCur.chords.forEach(ch => delete ch.color);
            saveState(); edRenderChords(); edSaveSong();
            toast('رنگ همه آکوردها: ' + currentColor);
          } else if (ci >= 0 && edCur.chords[ci]) {
            edCur.chords[ci].color = currentColor;
            saveState(); edRenderChords(); edSaveSong();
            toast('رنگ آکورد: ' + currentColor);
          }
          return true;
        }
        // 4. Editor general area (not on specific element)
        if (e.target.closest('#editor') && edCur) {
          if (isGlobal) {
            edCur.styles.tColor = currentColor;
            edCur.lineColors = [];
            document.querySelectorAll('#editor .eline').forEach(el => { el.style.color = currentColor; });
            saveState(); edSaveSong();
            toast('رنگ همه متن: ' + currentColor);
          }
          return true;
        }
        // 5. Track lane empty area → color all clips on track
        const lane = e.target.closest('.track-lane');
        if (lane) {
          const trackClips = getEditorDAW().clips.filter(c => c.trackId === lane.dataset.trackId);
          trackClips.forEach(c => applyColorToClip(c, currentColor));
          saveState(); renderClips();
          toast(trackClips.length + ' کلیپ رنگ شد'); return true;
        }
        return false;
      } else if (colorToolMode === 'eyedropper') {
        // 0. Section tag → sample color (decoupled)
        const secTagEl = e.target.closest('.section-tag');
        if (secTagEl) {
          const sec = (getEditorDAW().sections || []).find(s => s.id === secTagEl.dataset.sectionId);
          if (sec) { selectColor(sec.color || '#3FB8AF'); toast('رنگ نمونه بخش: ' + currentColor); deactivateColorTool(); return true; }
        }
        // 1. Timeline clip → sample
        const clipEl = e.target.closest('.clip');
        if (clipEl) {
          const clip = getClip(clipEl.dataset.clipId);
          if (clip) { selectColor(clip.color); toast('رنگ نمونه: ' + currentColor); deactivateColorTool(); return true; }
        }
        // 2. Editor text line → sample per-line or global (check before chord)
        const eline = e.target.closest('.eline');
        if (eline && edCur) {
          const li = parseInt(eline.dataset.lineIndex);
          const lineColors = edCur.lineColors || [];
          selectColor(lineColors[li] || edCur.styles.tColor || '#0fa966');
          toast('رنگ نمونه: ' + currentColor); deactivateColorTool(); return true;
        }
        // 3. Editor chord → sample per-chord or global
        const chordEl = e.target.closest('.chord');
        if (chordEl && edCur) {
          const ci = parseInt(chordEl.dataset.idx);
          const ch = ci >= 0 ? edCur.chords[ci] : null;
          selectColor(ch?.color || edCur.styles.cColor || '#e6aa28');
          toast('رنگ نمونه: ' + currentColor); deactivateColorTool(); return true;
        }
        if (e.target.closest('#editor') && edCur) {
          selectColor(edCur.styles.tColor || '#0fa966');
          toast('رنگ نمونه: ' + currentColor); deactivateColorTool(); return true;
        }
        // 4. Track lane → sample first clip color
        const lane = e.target.closest('.track-lane');
        if (lane) {
          const first = getEditorDAW().clips.find(c => c.trackId === lane.dataset.trackId && c.color);
          if (first) { selectColor(first.color); toast('رنگ نمونه: ' + currentColor); deactivateColorTool(); return true; }
        }
        return false;
      }
    }

    // Patch onClipMouseDown for timeline clips
    (function patchClipMouse() {
      const origHandler = onClipMouseDown;
      onClipMouseDown = function(e) {
        if (isColorToolActive() && e.button === 0) {
          const clipId = e.currentTarget?.dataset?.clipId;
          if (clipId) {
            const clip = getClip(clipId);
            if (clip && colorToolMode === 'brush') {
              applyColorToClip(clip, currentColor); saveState();
              e.stopPropagation(); e.preventDefault();
              toast('رنگ کلیپ: ' + currentColor); return;
            } else if (clip && colorToolMode === 'eyedropper') {
              selectColor(clip.color);
              toast('رنگ نمونه: ' + currentColor); deactivateColorTool();
              e.stopPropagation(); e.preventDefault(); return;
            }
          }
        }
        origHandler.call(this, e);
      };
    })();

    // Patch section tag mousedown for color tool
    (function patchSectionTagMouse() {
      const lanes = document.getElementById('lanes-container');
      if (!lanes) return;
      lanes.addEventListener('mousedown', (e) => {
        if (!isColorToolActive() || e.button !== 0) return;
        const secTagEl = e.target.closest('.section-tag');
        if (!secTagEl) return;
        const sec = (getEditorDAW().sections || []).find(s => s.id === secTagEl.dataset.sectionId);
        if (!sec) return;
        if (colorToolMode === 'brush') {
          if (e.shiftKey) {
            (getEditorDAW().sections || []).forEach(s => applyColorToSection(s, currentColor));
            toast('همه بخش‌ها رنگ شد');
          } else {
            applyColorToSection(sec, currentColor);
            toast('رنگ بخش: ' + currentColor);
          }
          saveState(); e.preventDefault(); e.stopPropagation();
        } else if (colorToolMode === 'eyedropper') {
          selectColor(sec.color || '#3FB8AF');
          toast('رنگ نمونه: ' + currentColor); deactivateColorTool();
          e.preventDefault(); e.stopPropagation();
        }
      }, true);
    })();

    // Patch editorWrap for text/chord coloring
    (function patchEditorWrap() {
      const ew = $('editorWrap');
      if (!ew) return;
      ew.addEventListener('mousedown', (e) => {
        if (!isColorToolActive() || e.button !== 0) return;
        if (paintContextAware(e)) { e.preventDefault(); e.stopPropagation(); }
      }, true);
    })();

    // Patch track lane mousedown for empty-area coloring
    (function patchLaneMouse() {
      const lanes = document.getElementById('lanes-container');
      if (!lanes) return;
      lanes.addEventListener('mousedown', (e) => {
        if (!isColorToolActive() || e.button !== 0) return;
        if (e.target.closest('.clip') || e.target.closest('.section-tag')) return;
        if (paintContextAware(e)) { e.preventDefault(); e.stopPropagation(); }
      }, true);
    })();

    // Action -> function mapping
    const ACTION_FUNCTIONS = {
      'play': togglePlay, 'pause': pauseTransport, 'stop': stopTransport,
      'goStart': transportToStart, 'goEnd': transportToEnd,
      'returnToStart': toggleReturnToStart,
      'loop': toggleLoop, 'loopA': setLoopA, 'loopB': setLoopB,
      'setLoopFromSel': setLoopFromSelection,
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
        MIDI_MAPS = {};
        saveMidiMaps();
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

    // Execute MIDI mapped functions on Note On
    function executeMidiMappedFunction(funcId) {
      const fn = ACTION_FUNCTIONS[funcId];
      if (fn) fn();
    }

    // ======== تابع ایمن برای کپی آکوردها ========
    function safeMirrorTimeline() {
      try {
        if (!editorPopupIsOpen(_lyricPopup)) return;
        const popupDoc = editorPopupDocument(_lyricPopup);
        if (!popupDoc) return;
        const targetDiv = popupDoc.getElementById('playerChordMirror');
        if (!targetDiv) return;

        const sourceTimeline = document.querySelector('.track-lane.chord-lane');
        if (!sourceTimeline || sourceTimeline.children.length === 0) return;

        // ۱. کپی برداری بدون حذف هیچ المانی (برای حفظ یکپارچگی ایندکس‌ها)
        const clone = sourceTimeline.cloneNode(true);

        targetDiv.innerHTML = '';
        targetDiv.appendChild(clone);

        // استایل کانتینر — ثابت، بدون اسکرول، پلی‌هد وسطش می‌ماند
        targetDiv.style.direction = 'ltr';
        targetDiv.style.overflow = 'hidden';
        targetDiv.style.position = 'relative';
        targetDiv.style.backgroundColor = '#0D1017';

        const mirrorH = targetDiv.clientHeight || 90;
        const RULER_H = 18;
        clone.style.direction = 'ltr';
        clone.style.position = 'absolute';
        clone.style.top = RULER_H + 'px';
        clone.style.left = '0';
        clone.style.width = sourceTimeline.scrollWidth + 'px';
        clone.style.height = (mirrorH - RULER_H) + 'px';
        clone.style.display = 'block';
        clone.style.backgroundColor = 'transparent';

        // ── خط کشی بالا (شماره میزان) مثل تایم لاین اصلی ──
        let mirrorRuler = targetDiv.querySelector('.mirror-ruler');
        if (!mirrorRuler) {
          mirrorRuler = popupDoc.createElement('div');
          mirrorRuler.className = 'mirror-ruler';
          mirrorRuler.style.cssText = 'position:absolute;top:0;left:0;height:' + RULER_H + 'px;width:100%;overflow:hidden;z-index:5;pointer-events:none;background:rgba(13,16,23,0.95);border-bottom:1px solid rgba(255,255,255,0.1);';
          targetDiv.appendChild(mirrorRuler);
        }
        let rulerInner = mirrorRuler.querySelector('.mirror-ruler-inner');
        if (!rulerInner) {
          rulerInner = popupDoc.createElement('div');
          rulerInner.className = 'mirror-ruler-inner';
          rulerInner.style.cssText = 'position:absolute;top:0;height:100%;white-space:nowrap;font-size:8px;color:rgba(255,255,255,0.5);font-family:JetBrains Mono,monospace;line-height:' + RULER_H + 'px;';
          mirrorRuler.appendChild(rulerInner);
        }
        rulerInner.innerHTML = '';
        rulerInner.style.width = sourceTimeline.scrollWidth + 'px';

        // ── اعداد و پارامترهای گرید ──
        const _glen = getProjectEnd();
        const _gbpm = edCur?.tempo || 120;
        const _gsig = edCur?.timeSignature || '4/4';
        const _gcfg = getTimeSignatureGridConfig(_gsig, _gbpm);
        const _gbeatsPerBar = _gcfg.beatsPerMeasure;
        const _gbeatDur = _gcfg.beatDuration;
        const _gbarDur = _gcfg.measureDuration;
        const _gpxPerSec = getEditorDAW().pxPerSecond;
        const _gpxPerBar = _gbarDur * _gpxPerSec;
        let _gbarStep = 1;
        if (_gpxPerBar > 120) _gbarStep = 1;
        else if (_gpxPerBar > 60) _gbarStep = 2;
        else if (_gpxPerBar > 30) _gbarStep = 4;
        else if (_gpxPerBar > 15) _gbarStep = 8;
        else if (_gpxPerBar > 8) _gbarStep = 16;
        else _gbarStep = 32;

        // شماره میزان‌ها روی رولر
        for (let _bar = 1; _bar * _gbarDur <= _glen; _bar++) {
          if ((_bar - 1) % _gbarStep !== 0) continue;
          const _x = timeToX((_bar - 1) * _gbarDur);
          const _span = popupDoc.createElement('span');
          _span.className = 'mirror-ruler-label';
          _span.style.cssText = 'position:absolute;left:' + _x + 'px;top:0;padding-left:2px;';
          _span.textContent = _bar;
          rulerInner.appendChild(_span);
        }

        // ── رسم خطوط گرید روی کانواس داخل کلون (مثل drawLaneGrid) ──
        let gridCanvas = clone.querySelector('canvas.lane-grid');
        if (!gridCanvas) {
          gridCanvas = popupDoc.createElement('canvas');
          gridCanvas.className = 'lane-grid';
          clone.insertBefore(gridCanvas, clone.firstChild);
        }
        gridCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:0;display:block;';
        gridCanvas.width = Math.min(Math.ceil(sourceTimeline.scrollWidth), 20000);
        gridCanvas.height = (mirrorH - RULER_H);
        gridCanvas.style.width = gridCanvas.width + 'px';
        gridCanvas.style.height = (mirrorH - RULER_H) + 'px';

        const _gctx = gridCanvas.getContext('2d');
        _gctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        // خطوط میزان (پررنگ‌تر)
        _gctx.strokeStyle = 'rgba(255,255,255,0.12)';
        _gctx.lineWidth = 1;
        let _gBarCount = 0;
        for (let _bar = 1; _bar * _gbarDur <= _glen && _gBarCount < 500; _bar++) {
          const _x = Math.round((_bar * _gbarDur) * _gpxPerSec) + 0.5;
          if (_x > gridCanvas.width) break;
          _gctx.beginPath(); _gctx.moveTo(_x, 0); _gctx.lineTo(_x, gridCanvas.height); _gctx.stroke();
          _gBarCount++;
        }
        // خطوط ضرب (کمرنگ‌تر)
        if (_gpxPerSec > 10) {
          _gctx.strokeStyle = 'rgba(255,255,255,0.04)';
          let _gBeatCount = 0;
          for (let _beat = 0; _beat * _gbeatDur <= _glen && _gBeatCount < 500; _beat++) {
            if (_beat % _gbeatsPerBar === 0) continue;
            const _x = Math.round((_beat * _gbeatDur) * _gpxPerSec) + 0.5;
            if (_x > gridCanvas.width) break;
            _gctx.beginPath(); _gctx.moveTo(_x, 0); _gctx.lineTo(_x, gridCanvas.height); _gctx.stroke();
            _gBeatCount++;
          }
        }
        // ساب ضرب (زمانی که زوم خیلی زیاد است)
        if (_gpxPerSec > 40) {
          const _gSubBeatDur = _gbeatDur / _gcfg.subdivisionsPerBeat;
          _gctx.strokeStyle = 'rgba(255,255,255,0.02)';
          let _gSubCount = 0;
          for (let _sub = 0; _sub * _gSubBeatDur <= _glen && _gSubCount < 500; _sub++) {
            if (_sub % _gcfg.subdivisionsPerBeat === 0) continue;
            const _x = Math.round((_sub * _gSubBeatDur) * _gpxPerSec) + 0.5;
            if (_x > gridCanvas.width) break;
            _gctx.beginPath(); _gctx.moveTo(_x, 0); _gctx.lineTo(_x, gridCanvas.height); _gctx.stroke();
            _gSubCount++;
          }
        }

        // ۲. ساخت پلی‌هد — ثابت در وسط کانتینر
        let mirrorPlayhead = targetDiv.querySelector('.mirror-playhead');
        if (!mirrorPlayhead) {
            mirrorPlayhead = popupDoc.createElement('div');
            mirrorPlayhead.className = 'mirror-playhead';
            mirrorPlayhead.style.cssText = 'position: absolute; top: 0; bottom: 0; width: 2px; background: #00F2FE; z-index: 100; box-shadow: 0 0 10px rgba(0,242,254,0.8); pointer-events: none; left: 50%;';
            targetDiv.appendChild(mirrorPlayhead);
        } else {
            // اگر از قبل وجود دارد، مطمئن شو در کانتینر باشد نه در کلون
            mirrorPlayhead.style.left = '50%';
        }

        const sourceClips = sourceTimeline.children;
        const cloneClips = clone.children;

        for (let i = 0; i < cloneClips.length; i++) {
            let clip = cloneClips[i];
            let sourceClip = sourceClips[i]; // تطابق دقیق یک به یک

            if (clip.classList.contains('mirror-playhead')) continue;

            // کانواس گرید را مخفی نکن
            if (clip.tagName === 'CANVAS') continue;

            // مخفی کردن دستگیره‌ها به جای حذف کردن
            if (clip.classList.contains('lane-resize-handle')) {
                clip.style.display = 'none';
                continue;
            }

            let text = clip.textContent || "";
            text = text.trim();

            if (text === '') {
                clip.style.display = 'none';
                continue;
            }

            // ۳. کپی مستقیم موقعیت و سایز از المان اصلی (حل مشکل شیفت میزان)
            if (sourceClip) {
                let cs = window.getComputedStyle(sourceClip);
                clip.style.left = cs.left !== 'auto' ? cs.left : '0px';
                clip.style.right = cs.right !== 'auto' ? cs.right : 'auto';
                clip.style.width = cs.width;
                clip.style.transform = cs.transform;
            }

            // استایل‌دهی بصری — دقیقاً مثل لاین آکورد تایم‌لاین
            clip.style.position = 'absolute';
            clip.style.display = 'flex';
            clip.style.alignItems = 'center';
            clip.style.justifyContent = 'center';
            clip.style.boxSizing = 'border-box';
            clip.style.direction = 'ltr';
            clip.style.opacity = '1';
            clip.style.visibility = 'visible';
            clip.style.background = 'linear-gradient(180deg, #4a2b5e, #2d1b3a)';
            clip.style.color = '#fff';
            clip.style.border = '1px solid #9F7AEA';
            clip.style.borderRadius = '7px';
            clip.style.padding = '0 10px';
            clip.style.fontSize = '18px';
            clip.style.fontWeight = '800';
            clip.style.fontFamily = "'JetBrains Mono', monospace";
            clip.style.height = Math.max(28, mirrorH - 24) + 'px';
            clip.style.top = Math.max(6, (mirrorH - parseInt(clip.style.height)) / 2) + 'px';
            clip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
            clip.style.pointerEvents = 'none';
            clip.style.overflow = 'hidden';

            let innerSpan = clip.querySelector('span, div');
            if (innerSpan) {
                innerSpan.style.direction = 'ltr';
                innerSpan.style.color = '#fff';
                innerSpan.style.fontSize = '18px';
                innerSpan.style.fontWeight = '800';
                innerSpan.style.fontFamily = "'JetBrains Mono', monospace";
                innerSpan.style.display = 'inline';
            }
        }

        targetDiv.scrollLeft = 0;
        startMirrorSync();

      } catch (e) {
        console.error("Mirror Error:", e);
      }
    }

    // ======== موتور همگام‌سازی زنده پلی‌هد و اسکرول ========
    let _mirrorSyncRAF = null;

    function startMirrorSync() {
        if (_mirrorSyncRAF) cancelAnimationFrame(_mirrorSyncRAF);

        function loop() {
            try {
                if (!editorPopupIsOpen(_lyricPopup)) return;
                const popupDoc = editorPopupDocument(_lyricPopup);
                if (!popupDoc) return;
                const targetDiv = popupDoc.getElementById('playerChordMirror');
                if (!targetDiv) return;

                const mainLane = document.querySelector('.track-lane.chord-lane');
                const mainPlayhead = document.querySelector('.playhead, .timeline-playhead, .daw-playhead, #main-playhead');
                const mirrorPlayhead = targetDiv.querySelector('.mirror-playhead');
                const clone = targetDiv.querySelector('.track-lane, [class*="chord"]');

                if (mainLane && mainPlayhead && mirrorPlayhead) {
                    // محاسبه موقعیت پلی‌هد اصلی نسبت به صفحه
                    const mainRect = mainLane.getBoundingClientRect();
                    const phRect = mainPlayhead.getBoundingClientRect();
                    // موقعیت پلی‌هد نسبت به شروع تایم‌لاین (بدون در نظر گرفتن اسکرول)
                    const phLeftInLane = phRect.left - mainRect.left + mainLane.parentElement.scrollLeft;
                    // وسط کانتینر پلیر
                    const containerCenter = targetDiv.clientWidth / 2;
                    // اسکرول کلون تا پلی‌هد وسط بماند
                    if (clone) {
                        clone.style.left = (containerCenter - phLeftInLane) + 'px';
                    }
                    // هماهنگ کردن رولر بالا با حرکت لاین
                    const rulerInner = targetDiv.querySelector('.mirror-ruler-inner');
                    if (rulerInner) {
                        rulerInner.style.left = (containerCenter - phLeftInLane) + 'px';
                    }
                }

            } catch (e) {}

            _mirrorSyncRAF = requestAnimationFrame(loop);
        }

        _mirrorSyncRAF = requestAnimationFrame(loop);
    }

    // History must be attached before lifecycle initialization. The service
    // remains disabled until hydration has completed and explicitly activates.
    if (typeof attachHistoryService === 'function') {
      attachHistoryService();
    }

    window.EditorLifecycleService?.initialize?.({
      initDAW: init,
      initSong: edInitSong,
      initAccidentalSelector,
      applyI18n,
      initHighlightEffect,
      refreshStorageInfo
    });
  
    /**
     * exportAllPlaylistsToFile — خروجی کامل همه پلی‌لیست‌ها در یک فایل JSON
     */
    async function exportAllPlaylistsToFile() {
      if (!arrangers || arrangers.length === 0) {
        toast('⚠ هیچ پلی‌لیستی برای خروجی وجود ندارد');
        return;
      }

      const allSongs = edGetAllSongs();
      
      const exportData = {
        format: 'achord-playlists-backup',
        version: 1,
        exportType: 'all',
        exportedAt: new Date().toISOString(),
        activePlaylistId: editingArr ? editingArr.id : null,
        settings: { repeatMode: 'none' },
        playlists: arrangers.map(arr => ({
          id: arr.id,
          name: arr.name || 'پلی‌لیست',
          createdAt: arr.createdAt || new Date().toISOString(),
          updatedAt: arr.updatedAt || new Date().toISOString(),
          items: Array.isArray(arr.items) ? arr.items.map(it => (typeof it === 'string' ? it : it.songId)) : [],
          crossfade: arr.crossfade || 0,
          pauseBetween: !!arr.pauseBetween,
          _itemSettings: arr._itemSettings || {}
        }))
      };

      const fileName = `achord-playlists-backup-${new Date().toISOString().slice(0, 10)}.json`;

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'JSON Playlists Backup', accept: { 'application/json': ['.json'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(exportData, null, 2));
          await writable.close();
          toast(`✅ خروجی کامل گرفته شد: ${fileName}`);
        } catch (e) {
          if (e.name !== 'AbortError') toast('خطا در خروجی: ' + e.message);
        }
      } else {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        toast(`✅ خروجی کامل گرفته شد: ${fileName}`);
      }
    }

    /**
     * importAllPlaylistsFromFile — ورود کامل همه پلی‌لیست‌ها از فایل پشتیبان
     */
    async function importAllPlaylistsFromFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);

          if (!data || data.format !== 'achord-playlists-backup' || !Array.isArray(data.playlists)) {
            toast('❌ فایل معتبر نیست — فرمت پشتیبان پلی‌لیست نیست');
            return;
          }

          const supportedVersions = [1, '1.0', 2, '2.0'];
          if (data.version && !supportedVersions.includes(data.version)) {
            toast(`❌ نسخه فایل (${data.version}) پشتیبانی نمی‌شود.`);
            return;
          }

          for (let i = 0; i < data.playlists.length; i++) {
            const pl = data.playlists[i];
            if (!pl || !pl.name || !pl.name.trim()) {
              toast(`❌ پلی‌لیست شماره ${i + 1} نام معتبر ندارد.`);
              return;
            }
            if (!Array.isArray(pl.items)) {
              toast(`❌ پلی‌لیست «${pl.name}» آرایه items معتبر ندارد.`);
              return;
            }
          }

          const normalizePlaylistName = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa-IR');
          const existingNames = new Set(arrangers.map(a => normalizePlaylistName(a.name)));
          const importedNames = new Set();
          const duplicateNames = [];

          for (const pl of data.playlists) {
            const normalizedName = normalizePlaylistName(pl.name);
            if (importedNames.has(normalizedName)) {
              duplicateNames.push(pl.name);
            } else {
              importedNames.add(normalizedName);
            }
            if (existingNames.has(normalizedName) && !duplicateNames.includes(pl.name)) {
              duplicateNames.push(pl.name);
            }
          }

          if (duplicateNames.length > 0) {
            toast(`ورود کامل انجام نشد. پلی‌لیست‌های زیر دارای نام تکراری هستند:\n«${duplicateNames.join('»، «')}»`);
            return;
          }

          let importedSongsCount = 0;
          const allSongs = edGetAllSongs();
          if (data.songs && typeof data.songs === 'object') {
            for (const [id, song] of Object.entries(data.songs)) {
              if (song && song.title && !allSongs.find(s => s.id === id)) {
                allSongs.push(song);
                importedSongsCount++;
              }
            }
            if (importedSongsCount > 0) edSetAllSongs(allSongs);
          }

          const newPlaylists = data.playlists.map(pl => ({
            id: 'playlist_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            name: pl.name,
            items: pl.items.map(it => (typeof it === 'string' ? it : it.songId)),
            crossfade: pl.crossfade || 0,
            pauseBetween: !!pl.pauseBetween,
            _itemSettings: pl._itemSettings || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));

          arrangers.unshift(...newPlaylists);
          saveArrangers();
          renderArrangerManager();

          toast(`✅ ${newPlaylists.length} پلی‌لیست وارد شد${importedSongsCount > 0 ? `، ${importedSongsCount} آهنگ جدید` : ''}`);
        } catch (e) {
          console.error('[Import All] Error:', e);
          toast('❌ خطا در بارگذاری فایل: ' + e.message);
        }
      };
      input.click();
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
