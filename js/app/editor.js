// ==========================================
// PART 4: Timeline Rendering & UI Event Listeners
// ==========================================

// Keep selection state initialized before DOM setup can register handlers.
let edSelectedChords = [];

/**
 * Ø±Ù†Ø¯Ø± Ú©Ø±Ø¯Ù† Ø¸Ø§Ù‡Ø± ØªØ±Ø§Ú©â€ŒÙ‡Ø§ Ø±ÙˆÛŒ ØªØ§ÛŒÙ…â€ŒÙ„Ø§ÛŒÙ†
 */
function renderTimeline() {
  const container = document.getElementById('timeline-tracks-container');
  if (!container) return;
  container.innerHTML = '';

  DAW.tracks.forEach(track => {
    const trackEl = document.createElement('div');
    trackEl.className = 'track-row';
    trackEl.innerHTML = `
      <div class="track-header">${track.name}</div>
      <div class="track-content"></div>
    `;
    container.appendChild(trackEl);
  });
}

// Ø§ØªØµØ§Ù„ Ø±ÙˆÛŒØ¯Ø§Ø¯Ù‡Ø§ÛŒ Ø§ÙˆÙ„ÛŒÙ‡ ØµÙØ­Ù‡ Ù¾Ø³ Ø§Ø² Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ DOM
document.addEventListener('DOMContentLoaded', () => {
  const audioInput = document.getElementById('audio-file-input');
  if (audioInput) {
    audioInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];

      if (!file) {
        return;
      }

      const copy = confirm("Ø¢ÛŒØ§ Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡ÛŒØ¯ ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ Ø¯Ø± Ù¾ÙˆØ´Ù‡ Ù¾Ø±ÙˆÚ˜Ù‡ Ú©Ù¾ÛŒ Ø´ÙˆØ¯ØŸ");

      try {
        await handleAudioImport(file, copy);
      } catch (error) {
        console.error('[AudioImport] Failed to import audio file:', error);

        if (typeof toast === 'function') {
          toast('Ø®Ø·Ø§ Ø¯Ø± ÙˆØ§Ø±Ø¯ Ú©Ø±Ø¯Ù† ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ');
        }
      } finally {
        e.target.value = '';
      }
    });
  }
});

    /**
     * Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ UI Ø¨Ø¹Ø¯ Ø§Ø² ØªØºÛŒÛŒØ± Ø¢Ù‡Ù†Ú¯ â€” ÙØ±Ø§Ø®ÙˆØ§Ù†ÛŒ Ù…Ø´ØªØ±Ú© Ø¨ÛŒÙ† loadArrSong Ùˆ hotSwapToNextSong
     */
    // ØªØ§Ø¨Ø¹ Ø§ÛŒÙ…Ù† Ø¨Ø±Ø§ÛŒ Ú©Ù¾ÛŒ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø§Ø² ØªØ§ÛŒÙ…â€ŒÙ„Ø§ÛŒÙ† Ø¨Ù‡ Ù¾Ù„ÛŒØ±
    function syncUIAfterSongChange() {
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
      if (_lyricPopup && !_lyricPopup.closed) {
        try {
          const _script = _lyricPopup.document.querySelector('script[data-pv="chord"]');
          if (_script) _script.remove();
        } catch(_) {}
        setTimeout(() => { try { syncLyricPopup(); } catch(_) {} }, 50);
        setTimeout(() => { try { syncLyricPopup(); } catch(_) {} }, 300);
        setTimeout(() => { try { safeMirrorTimeline(); } catch(_) {} }, 1000);
      }
      if (_lyricOnlyPopup && !_lyricOnlyPopup.closed) {
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

      // â”€â”€â”€ Reset prep log flags after successful swap â”€â”€â”€
      _arrHasLoggedNoNextSong = false;
      _arrPrepStartedForIndex = -1;

      console.log(`[Arranger] Hot-swapping to song ${ns.idx + 1}: "${ns.song?.title || 'Untitled'}"`);

      stopAllVoices();

      // â”€â”€â”€ Ù¾Ø§Ú©â€ŒØ³Ø§Ø²ÛŒ Ù†ÙˆØ¯Ù‡Ø§ÛŒ ØµÙˆØªÛŒ ØªØ±Ú©â€ŒÙ‡Ø§ÛŒ Ù‚Ø¯ÛŒÙ…ÛŒ â”€â”€â”€
      // Ø§ÛŒÙ† Ù†ÙˆØ¯Ù‡Ø§ Ù‡Ù†ÙˆØ² Ø¨Ù‡ masterGain ÙˆØµÙ„ÛŒ Ù‡Ø³ØªÙ† Ùˆ Ø¨Ø§ÛŒØ¯ Ù‚Ø·Ø¹ Ø¨Ø´Ù† ØªØ§ bleed ØµØ¯Ø§ Ù†Ø¯Ø§Ø´ØªÙ‡ Ø¨Ø§Ø´ÛŒÙ…
      DAW.tracks.forEach(tr => {
        if (tr._gainNode) { try { tr._gainNode.disconnect(); } catch(_){} tr._gainNode = null; }
        if (tr._pannerNode) { try { tr._pannerNode.disconnect(); } catch(_){} tr._pannerNode = null; }
      });

      DAW.clips = ns.clips;
      DAW.sections = ns.sections;
      DAW.tracks = ns.tracks;
      updateNextIdFromClips();
      DAW.selectedIds.clear(); DAW.selectedSectionIds = new Set();
      DAW.loopEnabled = ns.loopState.loopEnabled;
      DAW.loopA = ns.loopState.loopA;
      DAW.loopB = ns.loopState.loopB;
      selectionEnd = ns.selectionEnd;
      isRecordingChords = false; currentRecordingClipId = null;

      edCur = ns.edCur;

      ensureAudioCtx();
      // Ø³Ø§Ø®Øª Ù†ÙˆØ¯Ù‡Ø§ÛŒ ØµÙˆØªÛŒ Ø¬Ø¯ÛŒØ¯ Ø¨Ø±Ø§ÛŒ ØªØ±Ú©â€ŒÙ‡Ø§ÛŒ Ø¢Ù‡Ù†Ú¯ Ø¬Ø¯ÛŒØ¯
      DAW.tracks.forEach(tr => {
        if (tr.type === 'audio') {
          if (tr.transpose === undefined) tr.transpose = 0;
          tr._pannerNode = DAW.audioCtx.createStereoPanner();
          tr._gainNode = DAW.audioCtx.createGain();
          tr._pannerNode.connect(tr._gainNode);
          tr._gainNode.connect(DAW.masterGain);
          updateTrackMix(tr.id);
        }
      });

      // Ø¨Ø±Ø±Ø³ÛŒ: Ø¢ÛŒØ§ Ø¨Ø§ÙØ±Ù‡Ø§ÛŒ ØµÙˆØªÛŒ Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ø´Ø¯Ù†ØŸ
      const audioClips = DAW.clips.filter(c => c.type !== 'chord' && c.bufferKey);
      const loadedClips = audioClips.filter(c => DAW.bufferCache.has(c.bufferKey));
      const missingClips = audioClips.filter(c => !DAW.bufferCache.has(c.bufferKey));
      console.log(`[Arranger] Audio clips: ${loadedClips.length}/${audioClips.length} loaded` + (missingClips.length > 0 ? `, ${missingClips.length} missing: ${missingClips.map(c=>c.fileName||c.bufferKey).join(', ')}` : ''));

      DAW.playhead = 0;
      var _ori2 = PlayheadMath.createOrigin(performance.now(), 0); DAW.playOriginPerf = _ori2.playOriginPerf;
      DAW.playOriginTime = _ori2.playOriginTime;
      scheduleAllFromPlayhead();

      undoStack = []; undoIndex = -1; PERF.lastSerializedState = '';
      edSyncToolbar(); edRenderEditor(true); renderAll(); saveState();
      initHighlightEffect();

      // Update perf UI
      renderPerfUI();

      toast(`${t('songN')} ${ns.idx + 1}/${(arrPerformData||editingArr).items.length}: ${ns.song.title || t('untitled')}`);

      // If pause mode, stop playback and wait for manual next
      if (perfPauseMode) {
        pauseTransport();
        $('perfPlayBtn').textContent = 'â–¶';
      }

      // Check if we should auto-advance after crossfade
      if (arrPerformActive && ns.idx + 1 < (arrPerformData||editingArr).items.length) prepareNextArrSong();
      // Sync popup windows, SongDocument, and embedded view
      syncUIAfterSongChange();
      // Ø¢ÛŒÙ†Ù‡ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø¯Ø± Ù¾Ø§Ù¾â€ŒØ¢Ù¾
      setTimeout(safeMirrorTimeline, 1000);

      return true;
    }

    /**
     * Ø¨Ø¹Ø¯ Ø§Ø² Ù‡Ø± ØªØ¹ÙˆÛŒØ¶ ØªØ±Ú©/Ø¢Ù‡Ù†Ú¯ ØµØ¯Ø§ Ø²Ø¯Ù‡ Ø´ÙˆØ¯.
     * rebuild + full render embedded + popupÙ‡Ø§
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

      // â”€â”€â”€ Reset prep state â”€â”€â”€
      // ÙˆÙ‚ØªÛŒ Ú©Ø§Ø±Ø¨Ø± Ø¯Ø³ØªÛŒ Ø¢Ù‡Ù†Ú¯ÛŒ Ø±Ùˆ Ø§Ù†ØªØ®Ø§Ø¨ Ù…ÛŒâ€ŒÚ©Ù†Ù‡ØŒ state Ù‡Ø§ÛŒ prep Ù‚Ø¨Ù„ÛŒ Ø±Ùˆ Ù¾Ø§Ú© Ú©Ù†
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
      DAW.clips = []; DAW.sections = []; DAW.selectedIds.clear(); DAW.selectedSectionIds = new Set();

      // â”€â”€â”€ Ù…Ù‡Ù…: bufferCache Ø±Ùˆ Ù¾Ø§Ú© Ù†Ú©Ù†! â”€â”€â”€
      // Ù‚Ø¨Ù„Ø§Ù‹ Ø§ÛŒÙ†Ø¬Ø§ DAW.bufferCache.clear() Ø¨ÙˆØ¯ Ú©Ù‡ Ù‡Ù…Ù‡ Ø¨Ø§ÙØ±Ù‡Ø§ÛŒ preload Ø´Ø¯Ù‡ Ø±Ùˆ Ù¾Ø§Ú© Ù…ÛŒâ€ŒÚ©Ø±Ø¯.
      // Ø§ÛŒÙ† Ø¨Ø§Ø¹Ø« Ù…ÛŒâ€ŒØ´Ø¯ Ù‡Ø± Ø¨Ø§Ø± Ú©Ù‡ Ø¢Ù‡Ù†Ú¯ Ù„ÙˆØ¯ Ù…ÛŒâ€ŒØ´Ù‡ØŒ Ù‡Ù…Ù‡ ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ Ø¯ÙˆØ¨Ø§Ø±Ù‡ Ø§Ø² Ø§ÙˆÙ„ Ù„ÙˆØ¯ Ø¨Ø´Ù†.
      // Ø¨Ù‡â€ŒØ¬Ø§Ø´ØŒ ÙÙ‚Ø· waveCache (ØªØµØ§ÙˆÛŒØ± waveform) Ø±Ùˆ Ù¾Ø§Ú© Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ… Ú©Ù‡ Ø§ÙˆÙ† Ù‡Ù… Ø¨Ø¹Ø¯Ø§Ù‹ rebuild Ù…ÛŒâ€ŒØ´Ù‡.
      DAW.waveCache.clear();

      DAW.loopEnabled = false; DAW.loopA = 0; DAW.loopB = 10;
      selectionEnd = 0;
      isRecordingChords = false; currentRecordingClipId = null;

      edCur = JSON.parse(JSON.stringify(song));
      window.edCur = edCur; // sync global reference after loading song
      // Ø§Ú¯Ø± lyrics Ø®Ø§Ù„ÛŒÙ‡ ÙˆÙ„ÛŒ rawText Ø¯Ø§Ø±ÛŒÙ…ØŒ parse Ú©Ù†
      if (typeof ensureSongParsed === 'function') ensureSongParsed(edCur);
      if (!edCur.styles) edCur.styles = {};
      const defaults = { tSize:23,tColor:'#0fa966',tFont:'Vazirmatn',tBold:true,align:'center',cSize:23,cColor:'#e6aa28',cFont:'JetBrains Mono' };
      Object.keys(defaults).forEach(k => { if (edCur.styles[k] === undefined) edCur.styles[k] = defaults[k]; });

      if (edCur._dawTracks) DAW.tracks = JSON.parse(JSON.stringify(edCur._dawTracks));
      if (edCur._dawClips) DAW.clips = JSON.parse(JSON.stringify(edCur._dawClips));
      if (edCur._dawSections) DAW.sections = JSON.parse(JSON.stringify(edCur._dawSections)); else DAW.sections = [];
      updateNextIdFromClips();
      const _oldSec = DAW.clips.filter(c => c.type === 'section');
      if (_oldSec.length) { _oldSec.forEach(c => { DAW.sections.push({ id: c.id, trackId: c.trackId, label: c.name, start: c.start, duration: c.duration, color: c.color }); }); DAW.clips = DAW.clips.filter(c => c.type !== 'section'); }
      if (edCur._dawLoop) { DAW.loopEnabled = !!edCur._dawLoop.loopEnabled; DAW.loopA = edCur._dawLoop.loopA || 0; DAW.loopB = edCur._dawLoop.loopB || 10; }
      selectionEnd = (DAW.loopA < DAW.loopB) ? DAW.loopB : 0;

      // Apply per-song transpose
      const setting = getArrItemSetting(arr, song.id);
      if (setting.transpose) {
        DAW.tracks.forEach(t => { if (t.type === 'audio') t.transpose = (t.transpose || 0) + setting.transpose; });
      }

      // â”€â”€â”€ Ù¾Ø§Ú©â€ŒØ³Ø§Ø²ÛŒ Ù†ÙˆØ¯Ù‡Ø§ÛŒ ØµÙˆØªÛŒ Ù‚Ø¯ÛŒÙ…ÛŒ Ù‚Ø¨Ù„ Ø§Ø² Ø³Ø§Ø®Øª Ù†ÙˆØ¯Ù‡Ø§ÛŒ Ø¬Ø¯ÛŒØ¯ â”€â”€â”€
      DAW.tracks.forEach(tr => {
        if (tr._gainNode) { try { tr._gainNode.disconnect(); } catch(_){} tr._gainNode = null; }
        if (tr._pannerNode) { try { tr._pannerNode.disconnect(); } catch(_){} tr._pannerNode = null; }
      });

      ensureAudioCtx();
      DAW.tracks.forEach(t => { if (t.type === 'audio') { if (t.transpose === undefined) t.transpose = 0; t._pannerNode = DAW.audioCtx.createStereoPanner(); t._gainNode = DAW.audioCtx.createGain(); t._pannerNode.connect(t._gainNode); t._gainNode.connect(DAW.masterGain); updateTrackMix(t.id); } });

      // Ù„ÙˆØ¯ Ú©Ø§Ù…Ù„ ØµØ¯Ø§ Ø§Ø² ØªÙ…Ø§Ù… Ù…Ù†Ø§Ø¨Ø¹ (IndexedDBØŒ filePathØŒ FileHandleØŒ dirHandle)
      // Ø§ÛŒÙ† Ø®Ø· Ù‚Ø¨Ù„Ø§Ù‹ ÙÙ‚Ø· loadAudioBlobsForProject Ø±Ùˆ ØµØ¯Ø§ Ù…ÛŒâ€ŒØ²Ø¯ Ùˆ ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ÛŒ linked Ù„ÙˆØ¯ Ù†Ù…ÛŒâ€ŒØ´Ø¯Ù†
      try {
        const restoreResult = await restoreAudioForProjectSilently(edCur.id, true);
        if (restoreResult.missing > 0) {
          console.warn(`[Arranger] ${restoreResult.missing} audio clip(s) could not be loaded:`, restoreResult.missingNames);
          toast(`âš  ${restoreResult.missing} ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯ â€” ${restoreResult.missingNames.slice(0, 2).join(', ')}${restoreResult.missingNames.length > 2 ? '...' : ''}`);
        } else {
          console.log(`[Arranger] âœ“ Audio loaded for "${song.title}" (${restoreResult.loaded} clips)`);
        }
      } catch(e) {
        console.warn('Audio load error:', e);
        toast('âš  Ø®Ø·Ø§ Ø¯Ø± Ù„ÙˆØ¯ ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ');
      }

      undoStack = []; undoIndex = -1; PERF.lastSerializedState = '';
      edSyncToolbar(); edRenderEditor(true); renderAll(); saveState();
      initHighlightEffect();
      // Sync popup windows, SongDocument, and embedded view
      syncUIAfterSongChange();

      toast(`${t('songN')} ${idx + 1}/${arr.items.length}: ${song.title || t('untitled')}`);
      seekTransport(0, false);
      ensureAudioCtx();
      if (arrPerformActive && !DAW.isPlaying && !perfPauseMode) startTransport();
      if (arrPerformActive && idx + 1 < arr.items.length) {
        // â”€â”€â”€ Ø´Ø±ÙˆØ¹ prep Ø¢Ù‡Ù†Ú¯ Ø¨Ø¹Ø¯ÛŒ Ø¨Ø§ delay Ú©ÙˆØªØ§Ù‡ â”€â”€â”€
        // ØªØ§ playback ÙØ¹Ù„ÛŒ Ø´Ø±ÙˆØ¹ Ø¨Ø´Ù‡ Ùˆ Ø¨Ø¹Ø¯ prep Ø´Ø±ÙˆØ¹ Ø´Ù‡
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
      // Ø¢ÛŒÙ†Ù‡ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø¯Ø± Ù¾Ø§Ù¾â€ŒØ¢Ù¾
      setTimeout(safeMirrorTimeline, 1000);
    }

    function setZoom(pps, anchorClientX) {
      const scroll = $('tl-scroll'); const oldPps = DAW.pxPerSecond; const newPps = clamp(pps, 5, 260);
      if (Math.abs(newPps - oldPps) < 0.01) return;
      let anchorTime = DAW.playhead; if (typeof anchorClientX === 'number') anchorTime = clientToTime(anchorClientX);
      const rel = timeToX(anchorTime) - scroll.scrollLeft; DAW.pxPerSecond = newPps; $('zoom-range').value = String(Math.round(newPps));
      // Ø®ÙˆØ¯Ú©Ø§Ø± Ø¨Ø²Ø±Ú¯ Ú©Ø±Ø¯Ù† ØªØ§ÛŒÙ…â€ŒÙ„Ø§ÛŒÙ† Ø¨Ø± Ø§Ø³Ø§Ø³ Ø¹Ø±Ø¶ ØµÙØ­Ù‡ Ù†Ù…Ø§ÛŒØ´
      const visibleTime = scroll.clientWidth / newPps;
      ensureTimelineFits(visibleTime + 10);
      DAW.clips.forEach(c => refreshClipWaveImage(c)); requestRenderAll(); scroll.scrollLeft = Math.max(0, timeToX(anchorTime) - rel);
      updateZoomFontScale();
    }

    function setVerticalZoom(newH) {
      newH = clamp(Math.round(newH), 24, 200);
      if (Math.abs(newH - DAW.laneHeight) < 1) return;
      DAW.laneHeight = newH;
      document.documentElement.style.setProperty('--lane-h', newH + 'px');
      // Reset all per-lane heights to follow global zoom
      DAW.tracks.forEach(t => { t.laneHeight = null; });
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
      const vScale = DAW.laneHeight / DEFAULT_LANE_H;
      const hScale = DAW.pxPerSecond / DEFAULT_PPS;
      const combined = Math.sqrt(vScale * hScale);
      const scaled = clamp(BASE_FONT * combined, 10, 32);
      document.documentElement.style.setProperty('--zoom-font', scaled + 'px');
    }

    function setLaneHeight(trackId, newH) {
      newH = clamp(Math.round(newH), 24, 200);
      const track = DAW.tracks.find(t => t.id === trackId);
      if (!track) return;
      track.laneHeight = newH;
      const lane = document.querySelector(`.track-lane[data-track-id="${trackId}"]`);
      const name = document.querySelector(`.track-name[data-track-id="${trackId}"]`);
      if (lane) { lane.style.setProperty('--lane-h', newH + 'px'); lane.style.height = newH + 'px'; drawLaneGrid(lane.querySelector('.lane-grid')); }
      if (name) { name.style.setProperty('--lane-h', newH + 'px'); name.style.height = newH + 'px'; }
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
      DAW.editingChordClipId = clipId;
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
      // Ø§Ø¶Ø§ÙÙ‡ Ú©Ø±Ø¯Ù† Ù‡Ù†Ø¯Ù„Ø± Ú©ÛŒØ¨ÙˆØ±Ø¯ Ø¨Ø±Ø§ÛŒ Ø¯Ú©Ù…Ù‡ ESC
      const chordModal = $('chord-modal');
      if (chordModal) {
        // Ø­Ø°Ù Ù‡Ù†Ø¯Ù„Ø± Ù‚Ø¨Ù„ÛŒ Ø§Ú¯Ø± ÙˆØ¬ÙˆØ¯ Ø¯Ø§Ø±Ø¯
        if (chordModal._escHandler) chordModal.removeEventListener('keydown', chordModal._escHandler);
        chordModal._escHandler = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            closeChordEditor();
          }
        };
        chordModal.addEventListener('keydown', chordModal._escHandler);
        // ÙÙˆÚ©ÙˆØ³ Ø±ÙˆÛŒ Ù…ÙˆØ¯Ø§Ù„ Ø¨Ø±Ø§ÛŒ Ø§ÛŒÙ†Ú©Ù‡ ESC Ø¨Ø¯ÙˆÙ† Ú©Ù„ÛŒÚ© Ú©Ø§Ø± Ú©Ù†Ø¯
        chordModal.focus();
      }
    }

    function closeChordEditor() {
      $('chord-modal').classList.remove('show');
      DAW.editingChordClipId = null;
      if (edChordModalMode === 'editor') { edChordModalMode = null; edChordIdx = null; edPendingAnchor = null; }
    }

    // Unified chord modal confirm/delete â€” dispatches based on mode
    function chordModalConfirm() {
      if (edChordModalMode === 'editor') { edConfirmChord(); }
      else { placeChordOnTimeline(); }
    }
    function chordModalDelete() {
      if (edChordModalMode === 'editor') { edDeleteChord(); }
      else {
        if (DAW.editingChordClipId) {
          const c = getClip(DAW.editingChordClipId);
          if (c) { c.name = ''; renderClips(); saveState(); }
        }
        closeChordEditor();
      }
    }

    function placeChordOnTimeline() {
      // Ø§Ú¯Ø± Ú©Ø§Ø±Ø¨Ø± Ù†Ø§Ù…ÛŒ Ø¯Ø³ØªÛŒ ØªØ§ÛŒÙ¾ Ú©Ø±Ø¯Ù‡ØŒ Ø§Ø² Ø¢Ù† Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù† (Ù‡Ù…Ø§Ù‡Ù†Ú¯ Ø¨Ø§ ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø± Ø¢Ú©ÙˆØ±Ø¯)
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
      if (DAW.editingChordClipId) {
        const clip = getClip(DAW.editingChordClipId);
        if (clip) { clip.name = name; DAW.editingChordClipId = null; saveState(); renderAll(); closeChordEditor(); toast(`${t('chordEditedTo')} ${name}`); return; }
      }
      // Check if we're placing from Alt+Click on chord track (use mouse position)
      let targetTime = DAW.playhead;
      if (window._tempChordTrackAnchor && window._tempChordTrack) {
        targetTime = window._tempChordTrackAnchor.time;
        // Clean up temp variables to prevent interference with future clicks
        delete window._tempChordTrackAnchor;
        delete window._tempChordTrack;
      }
      const chordTrack = DAW.tracks.find(t => t.type === 'chord'); if (!chordTrack) return;
      const clip = { id: uid('c'), type: 'chord', trackId: chordTrack.id, name, start: roundMs(targetTime), duration: 4, color: '#9F7AEA' };
      DAW.clips.push(clip); DAW.selectedIds = new Set([clip.id]); saveState(); ensureTimelineFits(clip.start + clip.duration + 5);
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
            toast('MIDI ÙˆØµÙ„ Ø´Ø¯ - Ù¾ÛŒØ§Ù…â€ŒÙ‡Ø§ Ø¯Ø±ÛŒØ§ÙØª Ù…ÛŒØ´Ù‡');
            if (!midiSyncActive) {
              midiSyncActive = true;
              $('tab-midi-sync').classList.add('active-pink');
              $('midiSyncLabel').textContent = 'ON';
              toast('Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ Ø®ÙˆØ¯Ú©Ø§Ø± ÙØ¹Ø§Ù„ Ø´Ø¯');
            }
          }).catch(function(e) { console.error('MIDI Error:', e); toast('Ø®Ø·Ø§ Ø¯Ø± Ø§ØªØµØ§Ù„ MIDI: ' + (e.message || e)); });
        } else { toast('MIDI Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ Ù†Ù…ÛŒØ´Ù‡ (HTTPS Ù„Ø§Ø²Ù…Ù‡)'); }
      } else {
        if (midiAccess) { midiAccess.inputs.forEach(input => input.onmidimessage = null); }
        midiSyncActive = false;
        $('tab-midi-sync')?.classList.remove('active-pink');
        if ($('midiSyncLabel')) $('midiSyncLabel').textContent = 'OFF';
        toast('MIDI Ù‚Ø·Ø¹ Ø´Ø¯');
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
          if (!DAW.isPlaying) startTransport();
        }
        return;
      }
      // MIDI Stop (0xFC)
      if (status === 0xFC) {
        midiClockRunning = false;
        if (midiSyncActive && DAW.isPlaying) {
          pauseTransport();
        }
        return;
      }
      // MIDI Continue (0xFB)
      if (status === 0xFB) {
        midiClockRunning = true;
        if (midiSyncActive && !DAW.isPlaying) {
          startTransport();
        }
        return;
      }
      // MIDI Clock (0xF8)
      if (status === 0xF8) {
        if (midiSyncActive) {
          const now = performance.now();

          if (!midiClockRunning) {
            // Ø´Ø±ÙˆØ¹ Ù¾Ø®Ø´
            midiClockRunning = true;
            clockIntervals = [];
            clockCount = 0;
            midiSyncStartTime = now;
            if (!DAW.isPlaying) {
              seekTransport(0, false);
              startTransport();
            }
          }

          // Ù…Ø­Ø§Ø³Ø¨Ù‡ ØªÙ…Ù¾Ùˆ Ø§Ø² ÙØ§ØµÙ„Ù‡ Ø¨ÛŒÙ† Ù¾Ø§Ù„Ø³â€ŒÙ‡Ø§
          // MIDI Clock = 24 pulses per beat
          // BPM = 60 / (interval_per_beat)
          // interval_per_beat = avg_interval * 24
          if (lastClockTime > 0) {
            const interval = now - lastClockTime;
            if (interval > 5 && interval < 100) { // ÙÙ‚Ø· ÙØ§ØµÙ„Ù‡â€ŒÙ‡Ø§ÛŒ Ù…Ø¹Ù‚ÙˆÙ„
              clockIntervals.push(interval);
              if (clockIntervals.length > 48) clockIntervals.shift(); // Ø­Ø¯Ø§Ú©Ø«Ø± Û´Û¸ Ù¾Ø§Ù„Ø³ Ø¢Ø®Ø±

              // Ù…Ø­Ø§Ø³Ø¨Ù‡ Ù…ÛŒØ§Ù†Ú¯ÛŒÙ† ÙØ§ØµÙ„Ù‡
              if (clockCount % 24 === 0 && clockIntervals.length >= 12) {
                const avgInterval = clockIntervals.reduce((a, b) => a + b, 0) / clockIntervals.length;
                const beatInterval = avgInterval * 24; // ÙØ§ØµÙ„Ù‡ Ù‡Ø± Ø¨ÛŒØª
                const newBPM = Math.round(60000 / beatInterval);

                // ÙÙ‚Ø· Ø§Ú¯Ù‡ ØªÙ…Ù¾Ùˆ ØªØºÛŒÛŒØ± Ú©Ø±Ø¯Ù‡ØŒ Ø¢Ù¾Ø¯ÛŒØª Ú©Ù†
                if (newBPM >= 20 && newBPM <= 300 && newBPM !== midiSyncBPM) {
                  midiSyncBPM = newBPM;
                  $('edTempo').value = newBPM;
                  if (edCur) { edCur.tempo = newBPM; edSaveSong(); }
                  toast(`ØªÙ…Ù¾ÙˆÛŒ Ú©ÛŒÙˆØ¨ÛŒØ³: ${newBPM} BPM`);
                }
              }
            }
          }
          lastClockTime = now;
          clockCount++;

          // ØªØ§ÛŒÙ…Ø± ØªÙˆÙ‚Ù
          clearTimeout(clockDetectTimer);
          clockDetectTimer = setTimeout(() => {
            if (midiClockRunning && midiSyncActive) {
              midiClockRunning = false;
              lastClockTime = 0;
              clockIntervals = [];
              if (DAW.isPlaying) pauseTransport();
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
          const c = getClip(currentRecordingClipId); if (c) c.duration = roundMs(Math.max(0.5, DAW.playhead - c.start));
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
        const seqIdx = edCur.chords.length - edSeqPoints.length + edSeqCursor;
        if (edCur.chords[seqIdx]) {
          edCur.chords[seqIdx].name = name;
          edSyncBaseChordName(seqIdx);
          edCommit(); edRenderChords();
          if (edSeqCursor < edSeqPoints.length - 1) {
            edSeqCursor++;
          } else {
            const seqStart = edCur.chords.length - edSeqPoints.length;
            edFilterChordsWithBase((c, i) => i < seqStart || c.name);
            edSeqChordingActive = false;
            edSeqPoints = []; edCur.seqPoints = [];
            edCommit(); edRenderChords();
            toast(t('chordDone'));
          }
        }
        return;
      }

      // Update DAW timeline recording
      if (isRecordingChords) {
        if (!currentRecordingClipId || getClip(currentRecordingClipId)?.name !== name) {
          if (currentRecordingClipId) { const oldC = getClip(currentRecordingClipId); if (oldC) oldC.duration = roundMs(Math.max(0.5, DAW.playhead - oldC.start)); }
          const chordTrack = DAW.tracks.find(t => t.type === 'chord');
          if (chordTrack) {
            const newClip = { id: uid('c'), type: 'chord', trackId: chordTrack.id, name, start: roundMs(DAW.playhead), duration: 2, color: '#9F7AEA' };
            DAW.clips.push(newClip); currentRecordingClipId = newClip.id; ensureTimelineFits(newClip.start + newClip.duration + 5); renderAll();
          }
        } else {
          const clip = getClip(currentRecordingClipId); if (clip) { clip.duration = roundMs(Math.max(0.5, DAW.playhead - clip.start)); renderClips(); }
        }
      } else if (DAW.selectedIds.size === 1) {
        const selId = [...DAW.selectedIds][0]; const clip = getClip(selId);
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
      toast(midiSyncActive ? 'Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ ÙØ¹Ø§Ù„ Ø´Ø¯' : 'Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ ØºÛŒØ±ÙØ¹Ø§Ù„ Ø´Ø¯');
    }

    function toggleTab(id) { const tab = $(id); if (id === 'tab-sync') tab.classList.toggle('active-teal'); else if (id === 'tab-midi') tab.classList.toggle('active-pink'); }

    /* ===================== KEYBOARD ===================== */
    // ===== SHORTCUT SYSTEM =====
    const SHORTCUT_DEFAULTS = [
      { id: 'undo',          label: 'Ø¨Ø±Ú¯Ø´Øª (Undo)',           code: 'KeyZ',    ctrl: true,  shift: false },
      { id: 'redo',          label: 'Ø¬Ù„Ùˆ (Redo)',              code: 'KeyY',    ctrl: true,  shift: false },
      { id: 'play',          label: 'Ù¾Ø®Ø´ / ØªÙˆÙ‚Ù',             code: 'Space',   ctrl: false, shift: false },
      { id: 'split',         label: 'Ø¨Ø±Ø´ Ø¯Ø± Ù¾Ø®Ø´Ú¯Ø±',           code: 'KeyS',    ctrl: false, shift: false },
      { id: 'copy',          label: 'Ú©Ù¾ÛŒ',                    code: 'KeyC',    ctrl: true,  shift: false },
      { id: 'cut',           label: 'Ø¨Ø±ÛŒØ¯Ù†',                   code: 'KeyX',    ctrl: true,  shift: false },
      { id: 'paste',         label: 'Ú†Ø³Ø¨Ø§Ù†Ø¯Ù†',                 code: 'KeyV',    ctrl: true,  shift: false },
      { id: 'selectAll',     label: 'Ø§Ù†ØªØ®Ø§Ø¨ Ù‡Ù…Ù‡',              code: 'KeyA',    ctrl: true,  shift: false },
      { id: 'duplicate',     label: 'Ú©Ù¾ÛŒ + Ú†Ø³Ø¨Ø§Ù†Ø¯Ù†',            code: 'KeyD',    ctrl: true,  shift: false },
      { id: 'delete',        label: 'Ø­Ø°Ù Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡',          code: 'Delete',  ctrl: false, shift: false },
      { id: 'loop',          label: 'Ø±ÙˆØ´Ù†/Ø®Ø§Ù…ÙˆØ´ Ø­Ù„Ù‚Ù‡',         code: 'NumpadDivide', ctrl: false, shift: false },
      { id: 'loopA',         label: 'Ø´Ø±ÙˆØ¹ Ø­Ù„Ù‚Ù‡',               code: 'KeyI',    ctrl: false, shift: false },
      { id: 'loopB',         label: 'Ù¾Ø§ÛŒØ§Ù† Ø­Ù„Ù‚Ù‡',              code: 'KeyO',    ctrl: false, shift: false },
      { id: 'fullscreen',    label: 'Ù¾Ù†Ø¬Ø±Ù‡ ØªÙ…Ø§Ù…â€ŒØµÙØ­Ù‡',         code: 'F9',      ctrl: false, shift: false },
      { id: 'focusMode',     label: 'Ø­Ø§Ù„Øª ØªÙ…Ø±Ú©Ø²',              code: 'F10',     ctrl: false, shift: false },
      { id: 'seekBack',      label: 'Ø¹Ù‚Ø¨â€ŒØ±ÙØªÙ†',               code: 'ArrowLeft',  ctrl: false, shift: false },
      { id: 'seekFwd',       label: 'Ø¬Ù„ÙˆØ±ÙØªÙ†',                 code: 'ArrowRight', ctrl: false, shift: false },
      { id: 'goStart',       label: 'Ø±ÙØªÙ† Ø¨Ù‡ Ø§Ø¨ØªØ¯Ø§',           code: 'Home',    ctrl: false, shift: false },
      { id: 'setLoopFromSel',label: 'Ù…Ø­Ø¯ÙˆØ¯Ù‡ loop Ø§Ø² selection',  code: 'KeyP',    ctrl: false, shift: false },
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
      const map = { 'Space':'Space','KeyA':'A','KeyB':'B','KeyC':'C','KeyD':'D','KeyE':'E','KeyF':'F','KeyG':'G','KeyH':'H','KeyI':'I','KeyJ':'J','KeyK':'K','KeyL':'L','KeyM':'M','KeyN':'N','KeyO':'O','KeyP':'P','KeyQ':'Q','KeyR':'R','KeyS':'S','KeyT':'T','KeyU':'U','KeyV':'V','KeyW':'W','KeyX':'X','KeyY':'Y','KeyZ':'Z','Delete':'Del','Backspace':'Bksp','Home':'Home','End':'End','F9':'F9','F10':'F10','ArrowLeft':'â†','ArrowRight':'â†’','ArrowUp':'â†‘','ArrowDown':'â†“' };
      return map[code] || code;
    }
    loadShortcuts();

    let _editingShortcutId = null;
    // ===== IMPORT FROM URL/TEXT =====
    let _importParsed = null;
    function openImportChordModal() { $('importChordModal').classList.add('show'); $('importText').value = ''; $('importUrl').value = ''; $('importPreview').style.display = 'none'; _importParsed = null; }
    function closeImportChordModal() { $('importChordModal').classList.remove('show'); _importParsed = null; }

    // ===== AUTO IMPORT (Rewritten â€” multi-artist, progress, retry, accurate counts) =====

    // ---- State ----
    window._aiResults = [];       // flat array of all fetched songs (with status tracking)
    window._aiArtistMap = {};     // { artistName: { expected, fetched, status, songs:[] } }
    window._aiStats = { total: 0, fetched: 0, archived: 0, filesSaved: 0, dupes: 0, errors: 0 };
    window._aiFailedSongs = [];   // songs that failed after all retries

    // ---- Helpers ----
    function parseArtistNames(raw) {
      return raw.split(/[,\nØŒ]+/).map(s => s.trim()).filter(s => s.length > 0);
    }
    function updateAutoArtistTags() {
      const names = parseArtistNames($('autoArtistName')?.value || '');
      const el = $('autoArtistTags');
      if (!el) return;
      el.innerHTML = names.map((n, i) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(63,184,175,0.15);border:1px solid var(--accent-teal);border-radius:6px;padding:3px 10px;font-size:0.8rem;color:var(--accent-cyan-glow);font-weight:700;">ðŸŽµ ${n}${names.length > 1 ? ` <span style="opacity:0.5;font-size:0.7rem;">#${i + 1}</span>` : ''}</span>`
      ).join('');
    }
    function normalizeKey(s) { return (s || '').replace(/\s+/g, '').toLowerCase(); }
    function songUniqueId(song) {
      // Ø§Ú¯Ù‡ URL Ø¯Ø§Ø±ÛŒÙ…ØŒ Ø§Ø² Ø§ÙˆÙ† Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù† (Ù‡Ø± ØµÙØ­Ù‡ ÛŒÚ©ØªØ§â€ŒØ³Øª)
      if (song.url) return normalizeKey(song.url);
      // Ø§Ú¯Ù‡ URL Ù†Ø¯Ø§Ø±ÛŒÙ…ØŒ artist + title
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
      $('autoImportBtn').textContent = 'ðŸš€ Ø´Ø±ÙˆØ¹ ÙˆØ±ÙˆØ¯ÛŒ Ø§ØªÙˆÙ…Ø§Øª';
      hideProgressBar();
    }

    // ---- Fetch ALL songs for one artist (server handles everything) ----
    async function fetchArtistFromServer(artistName, apiUrl, totalCount, onProgress) {
      if (onProgress) onProgress(`ðŸŽµ ${artistName} â€” Ø¯Ø± Ø­Ø§Ù„ Ø¯Ø±ÛŒØ§ÙØª ØªÙ…Ø§Ù… ${totalCount} ØªØ±Ø§Ù†Ù‡...`);
      console.log(`[FETCH] Starting: ${artistName} â€” requesting ${totalCount} songs from server`);

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
        console.log(`[FETCH] DONE: ${artistName} â€” server returned ${got} songs (imported: ${data.imported}, failed: ${data.failed})`);
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
      return line.replace(/[â”‚â”ƒâ”ƒâ”‚â”†â”‡â”Šâ”‹â•Žâ•â•‘â–ºâ–¶â—†â—‡â—‹â—â˜…â˜†â™¦â™£â™ â™¥â™ªâ™«]/g, ' ').replace(/\s{2,}/g, ' ').trim();
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
    //    Example: "Ø¹Ø´*Ù‚" -> anchor points to "Ù‚".
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
      // Ù…Ù†Ø·Ù‚ Ø¨Ù‡ js/editor/LyricPositionMapper.js Ù…Ù†ØªÙ‚Ù„ Ø´Ø¯Ù‡ Ø§Ø³Øª.
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

    // ---- Common Parser: rawText â†’ { lyrics, chords } ----
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
          if (/^[-=_~â”€â”â•â”â”â”€ï¹ï¹Žï¼¿]{3,}$/.test(info.detectionLine.replace(/\s/g, ''))) { info.type = 'empty'; continue; }
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
        // Ú†Ú© URL
        if (songUrlNorm && es.url && normalizeKey(es.url) === songUrlNorm) {
          return { saved: false, duplicate: true };
        }
        // Ú†Ú© artist + title
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
      d += `<span class="apd-ok">âœ“ Ù…ÙˆÙÙ‚: ${a.archived}</span>  `;
      d += `<span class="apd-fail">âœ— Ù†Ø§Ù…ÙˆÙÙ‚: ${a.errors}</span>  `;
      d += `<span class="apd-dup">â‰ˆ ØªÚ©Ø±Ø§Ø±ÛŒ: ${a.dupes}</span>  `;
      d += `<span class="apd-pending">â—¯ Ø¨Ø§Ù‚ÛŒâ€ŒÙ…Ø§Ù†Ø¯Ù‡: ${Math.max(0, a.total - a.fetched)}</span>`;
      return d;
    }

    // ---- MAIN: Start Auto Import ----
    async function startAutoImport() {
      const rawInput = $('autoArtistName').value.trim();
      const requestedCount = parseInt($('autoSongCount').value) || 0;
      const saveToArchive = $('autoSaveArchive').checked;

      const artistNames = parseArtistNames(rawInput);
      if (!artistNames.length) { toast('Ù†Ø§Ù… Ø®ÙˆØ§Ù†Ù†Ø¯Ù‡ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯'); return; }

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
        status.textContent = 'ðŸ” Ø¯Ø± Ø­Ø§Ù„ Ø´Ù†Ø§Ø³Ø§ÛŒÛŒ ØªØ¹Ø¯Ø§Ø¯ ØªØ±Ø§Ù†Ù‡â€ŒÙ‡Ø§...';
        let grandExpected = 0;

        for (let ai = 0; ai < artistNames.length; ai++) {
          const artistName = artistNames[ai];
          status.textContent = `ðŸ” [${ai + 1}/${artistNames.length}] Ø´Ù†Ø§Ø³Ø§ÛŒÛŒ ${artistName}...`;
          updateAutoProgress(grandExpected, grandExpected + 1, `<span style="color:var(--accent-teal);">Ø´Ù†Ø§Ø³Ø§ÛŒÛŒ ${artistName}...</span>`);

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
        let summaryLines = ['â”â”â” Ø®Ù„Ø§ØµÙ‡ Ø´Ù†Ø§Ø³Ø§ÛŒÛŒ â”â”â”'];
        for (const [name, data] of Object.entries(window._aiArtistMap)) {
          if (data.error) summaryLines.push(`âŒ ${name}: ${data.error}`);
          else summaryLines.push(`ðŸŽµ ${name}: ${data.expected} ØªØ±Ø§Ù†Ù‡`);
        }
        summaryLines.push(`ðŸ“Š Ø¬Ù…Ø¹ Ú©Ù„: ${grandExpected} ØªØ±Ø§Ù†Ù‡`);
        status.textContent = summaryLines.join('\n');
        updateAutoProgress(0, grandExpected, buildProgressDetail());

        // ===== PHASE 2: Fetch all songs for each artist =====
        let processedCount = 0;

        for (const [artistName, artistData] of Object.entries(window._aiArtistMap)) {
          if (artistData.error) continue;

          status.textContent = `ðŸŽµ Ø¯Ø± Ø­Ø§Ù„ Ø¯Ø±ÛŒØ§ÙØª ${artistName} (${artistData.expected} ØªØ±Ø§Ù†Ù‡)...`;
          updateAutoProgress(processedCount, grandExpected, `<span style="color:var(--accent-teal);">Ø¯Ø±ÛŒØ§ÙØª ${artistName}...</span>\n${buildProgressDetail()}`);

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
          results.innerHTML += `<div style="padding:8px 10px;margin:8px 0 4px;border-radius:6px;background:rgba(255,255,255,0.04);border-left:3px solid ${hColor};font-weight:700;color:var(--text-primary);font-size:0.9rem;">ðŸŽµ ${artistName} <span style="color:var(--text-secondary);font-weight:400;font-size:0.8rem;">(${okCount}/${artistData.expected} Ù…ÙˆÙÙ‚${errCount ? ', ' + errCount + ' Ù†Ø§Ù…ÙˆÙÙ‚' : ''})</span></div>`;

          uniqueSongs.forEach((song, i) => {
            const key = songUniqueId(song);
            if (song.error) {
              results.innerHTML += `<div style="padding:6px 10px;margin:2px 0 2px 16px;border-radius:6px;background:rgba(255,0,0,0.1);border:1px solid #e24f5b;font-size:0.8rem;">âŒ ${song.title}: ${song.error}</div>`;
            } else {
              results.innerHTML += `<div style="padding:6px 10px;margin:2px 0 2px 16px;border-radius:6px;background:rgba(63,184,175,0.1);border:1px solid var(--accent-teal);cursor:pointer;font-size:0.8rem;" onclick="loadAutoImportSong('${key}')">ðŸŽµ ${song.title} <span style="color:var(--text-secondary);font-size:0.75rem;">(${song.key || '-'})</span></div>`;
            }
          });

          await new Promise(r => setTimeout(r, 300));
        }

        // ===== PHASE 3: Save to archive =====
        if (saveToArchive) {
          status.textContent = 'ðŸ“ Ø¯Ø± Ø­Ø§Ù„ Ø°Ø®ÛŒØ±Ù‡ Ø¯Ø± Ø¢Ø±Ø´ÛŒÙˆ...';
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
              console.log(`[ARCHIVE] PARSE ERROR: ${song.title} â€” ${e.message}`);
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
        let report = 'â”â”â” Ú¯Ø²Ø§Ø±Ø´ Ù†Ù‡Ø§ÛŒÛŒ â”â”â”\n';
        for (const [name, data] of Object.entries(window._aiArtistMap)) {
          if (data.error) report += `âŒ ${name}: ${data.error}\n`;
          else report += `ðŸŽµ ${name}: ${data.fetched}/${data.expected} Ø¯Ø±ÛŒØ§ÙØª Ø´Ø¯\n`;
        }
        report += `\nðŸ“Š Ù…Ø¬Ù…ÙˆØ¹ ØªØ¹Ø¯Ø§Ø¯ Ù…ÙˆØ±Ø¯ Ø§Ù†ØªØ¸Ø§Ø±: ${s.total}\n`;
        report += `ðŸ“Š ØªØ¹Ø¯Ø§Ø¯ Ø¯Ø±ÛŒØ§ÙØªâ€ŒØ´Ø¯Ù‡: ${s.fetched}\n`;
        report += `ðŸ“Š Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ Ø¯Ø± Ø¢Ø±Ø´ÛŒÙˆ: ${s.archived}\n`;
        report += `ðŸ“Š ØªÚ©Ø±Ø§Ø±ÛŒ: ${s.dupes}\n`;
        report += `ðŸ“Š Ù†Ø§Ù…ÙˆÙÙ‚: ${s.errors}`;
        if (window._aiFailedSongs.length > 0) {
          report += `\n\nâŒ Ù…ÙˆØ§Ø±Ø¯ Ù†Ø§Ù…ÙˆÙÙ‚:\n`;
          window._aiFailedSongs.forEach(f => { report += `  â€¢ ${f.artist} â€” ${f.title}: ${f.error}\n`; });
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
          ? 'âŒ Ø³Ø±ÙˆØ± Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯!\n\nÙ„Ø·ÙØ§Ù‹ Ø³Ø±ÙˆØ± Ø±Ø§ Ø§Ø¬Ø±Ø§ Ú©Ù†ÛŒØ¯:\n1. ØªØ±Ù…ÛŒÙ†Ø§Ù„ Ø¨Ø§Ø² Ú©Ù†ÛŒØ¯\n2. Ø¨Ø±ÙˆÛŒØ¯ Ø¨Ù‡ Ù¾ÙˆØ´Ù‡ Ù¾Ø±ÙˆÚ˜Ù‡\n3. Ø¨Ø²Ù†ÛŒØ¯: npm start\n4. Ø¨Ø¹Ø¯ Ø¯ÙˆØ¨Ø§Ø±Ù‡ ØªÙ„Ø§Ø´ Ú©Ù†ÛŒØ¯'
          : 'âŒ Ø®Ø·Ø§: ' + e.message;
        btn.disabled = false;
        btn.textContent = 'ðŸ”„ ØªÙ„Ø§Ø´ Ù…Ø¬Ø¯Ø¯';
        $('autoImportDone').style.display = 'block';
      }
    }

    // ---- Retry failed songs only ----
    async function autoRetryFailed() {
      const failed = window._aiFailedSongs;
      if (!failed.length) { toast('Ù…ÙˆØ±Ø¯ Ù†Ø§Ù…ÙˆÙÙ‚ÛŒ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯'); return; }

      const status = $('autoImportStatus');
      const results = $('autoImportResults');
      const source = $('autoSource').value;
      const apiUrl = source === 'akord' ? '/api/akord/auto-import' : '/api/auto-import';
      showProgressBar();

      status.textContent = `ðŸ”„ ØªÙ„Ø§Ø´ Ù…Ø¬Ø¯Ø¯ Ø¨Ø±Ø§ÛŒ ${failed.length} ØªØ±Ø§Ù†Ù‡ Ù†Ø§Ù…ÙˆÙÙ‚...`;

      // Group failed by artist
      const byArtist = {};
      failed.forEach(f => { (byArtist[f.artist] = byArtist[f.artist] || []).push(f); });

      window._aiFailedSongs = [];
      let retriedCount = 0;

      for (const [artistName, failedSongs] of Object.entries(byArtist)) {
        status.textContent = `ðŸ”„ ØªÙ„Ø§Ø´ Ù…Ø¬Ø¯Ø¯ ${artistName} (${failedSongs.length} ØªØ±Ø§Ù†Ù‡)...`;
        updateAutoProgress(retriedCount, failed.length, `<span style="color:#D69E2E;">ØªÙ„Ø§Ø´ Ù…Ø¬Ø¯Ø¯ ${artistName}...</span>`);

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
      status.textContent = `ðŸ”„ ØªÙ„Ø§Ø´ Ù…Ø¬Ø¯Ø¯ ØªÙ…Ø§Ù… Ø´Ø¯\nØ¨Ø§Ø²ÛŒØ§Ø¨ÛŒ Ø´Ø¯Ù‡: ${failed.length - stillFailed}\nØ¨Ø§Ù‚ÛŒâ€ŒÙ…Ø§Ù†Ø¯Ù‡ Ù†Ø§Ù…ÙˆÙÙ‚: ${stillFailed}`;
      updateAutoProgress(window._aiStats.fetched, window._aiStats.total, buildProgressDetail());
      if (stillFailed === 0) toast('âœ… Ù‡Ù…Ù‡ ØªØ±Ø§Ù†Ù‡â€ŒÙ‡Ø§ Ø¨Ø§Ø²ÛŒØ§Ø¨ÛŒ Ø´Ø¯!');
      else toast(`âš ï¸ ${stillFailed} ØªØ±Ø§Ù†Ù‡ Ù‡Ù†ÙˆØ² Ù†Ø§Ù…ÙˆÙÙ‚ Ø§Ø³Øª`);
    }

    // ---- Save to archive (manual button) ----
    function autoImportSaveArchive() {
      const songs = window._aiResults.filter(s => !s.error && s.rawText);
      if (!songs.length) { toast('ØªØ±Ø§Ù†Ù‡â€ŒØ§ÛŒ Ø¨Ø±Ø§ÛŒ Ø°Ø®ÛŒØ±Ù‡ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯'); return;
      }
      if (!confirm(`Ø¢ÛŒØ§ ${songs.length} ØªØ±Ø§Ù†Ù‡ Ø¯Ø± Ø¢Ø±Ø´ÛŒÙˆ Ø°Ø®ÛŒØ±Ù‡ Ø´ÙˆØ¯ØŸ`)) return;

      const existingSongs = edGetAllSongs();
      let saved = 0, dupes = 0;
      for (const song of songs) {
        const result = saveSongToArchive(song, existingSongs);
        if (result.saved) saved++;
        else if (result.duplicate) dupes++;
      }
      edSetAllSongs(existingSongs);
      toast(`ðŸ“ ${saved} ØªØ±Ø§Ù†Ù‡ Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯${dupes ? 'ØŒ ' + dupes + ' ØªÚ©Ø±Ø§Ø±ÛŒ Ø±Ø¯ Ø´Ø¯' : ''}`);
    }

    // ---- Save files to folder ----
    function autoImportSaveConfirm() {
      const songs = window._aiResults.filter(s => !s.error && s.rawText);
      if (!songs.length) { toast('ÙØ§ÛŒÙ„ÛŒ Ø¨Ø±Ø§ÛŒ Ø°Ø®ÛŒØ±Ù‡ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯'); return; }
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
        toast('Ø¯Ø§Ø¯Ù‡â€ŒØ§ÛŒ Ø¨Ø±Ø§ÛŒ Ø°Ø®ÛŒØ±Ù‡ Ù†ÛŒØ³Øª');
        return;
      }

      // Ø§Ø·Ù…ÛŒÙ†Ø§Ù† Ø§Ø² ÙˆØ¬ÙˆØ¯ Ø¢Ù…Ø§Ø±
      window._aiStats = window._aiStats || {};
      window._aiFailedFiles = [];

      // Ù¾Ø§Ú©â€ŒØ³Ø§Ø²ÛŒ Ù†Ø§Ù… Ù¾ÙˆØ´Ù‡ Ùˆ ÙØ§ÛŒÙ„ Ø¨Ø±Ø§ÛŒ ÙˆÛŒÙ†Ø¯ÙˆØ² Ùˆ File System API
      function sanitizeFilePart(value, fallback = 'Unknown') {
        const cleaned = String(value || fallback)
          .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
          .replace(/\s+/g, ' ')
          .replace(/[.\s]+$/g, '')
          .trim();

        return cleaned || fallback;
      }

      // Ú¯Ø±ÙˆÙ‡â€ŒØ¨Ù†Ø¯ÛŒ ØªØ±Ø§Ù†Ù‡â€ŒÙ‡Ø§ Ø¨Ø±Ø§Ø³Ø§Ø³ Ø®ÙˆØ§Ù†Ù†Ø¯Ù‡Ù” ÙˆØ§Ù‚Ø¹ÛŒ Ù‡Ø± Ù†ØªÛŒØ¬Ù‡
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

      // Ø³Ø§Ø®Øª Ù…ØªÙ† Ú¯Ø²Ø§Ø±Ø´ Ù†Ù‡Ø§ÛŒÛŒ
      function buildSaveReport({
        perArtist = [],
        saved = 0,
        errors = 0,
        skipped = 0,
        failed = []
      }) {
        let report = 'â”â”â” Ú¯Ø²Ø§Ø±Ø´ Ø°Ø®ÛŒØ±Ù‡ ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ â”â”â”\n';

        if (perArtist.length > 0) {
          perArtist.forEach(item => {
            const itemErrors = Number(item.errors) || 0;
            const itemSkipped = Number(item.skipped) || 0;

            let icon = 'âœ…';

            if (itemErrors > 0) {
              icon = 'âš ï¸';
            } else if (itemSkipped > 0) {
              icon = 'â„¹ï¸';
            }

            report += `${icon} ${item.artist}: ${item.saved} Ø§Ø² ${item.expected} ÙØ§ÛŒÙ„`;

            const details = [];

            if (itemSkipped > 0) {
              details.push(`${itemSkipped} Ø±Ø¯ Ø´Ø¯`);
            }

            if (itemErrors > 0) {
              details.push(`${itemErrors} Ø®Ø·Ø§`);
            }

            if (details.length > 0) {
              report += ` (${details.join('ØŒ ')})`;
            }

            report += '\n';
          });
        }

        report += `\nðŸ“Š Ù…Ø¬Ù…ÙˆØ¹: ${saved} Ø§Ø² ${totalFiles} ÙØ§ÛŒÙ„ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯`;

        if (skipped > 0) {
          report += `\nâ­ï¸ Ø±Ø¯Ø´Ø¯Ù‡: ${skipped} ÙØ§ÛŒÙ„`;
        }

        if (errors > 0) {
          report += `\nâŒ Ù†Ø§Ù…ÙˆÙÙ‚: ${errors} ÙØ§ÛŒÙ„`;
        }

        if (failed.length > 0) {
          report += '\n\nØ¬Ø²Ø¦ÛŒØ§Øª Ø®Ø·Ø§Ù‡Ø§:\n';

          failed.forEach(item => {
            report += `  â€¢ ${item.artist} â€” ${item.title}: ${item.error}\n`;
          });
        }

        return report.trim();
      }

      statusEl.style.display = 'block';

      // ============================================================
      // Method 1: Native File System API
      // Ø°Ø®ÛŒØ±Ù‡ Ø¯Ø± Ù¾ÙˆØ´Ù‡â€ŒÙ‡Ø§ÛŒ Ø¬Ø¯Ø§Ú¯Ø§Ù†Ù‡ Ø¨Ø±Ø§ÛŒ Ù‡Ø± Ø®ÙˆØ§Ù†Ù†Ø¯Ù‡
      // ============================================================
      if (window._autoImportDirHandle) {
        const artistEntries = Object.entries(byArtist);

        try {
          for (let artistIndex = 0; artistIndex < artistEntries.length; artistIndex++) {
            const [artistName, artistSongs] = artistEntries[artistIndex];

            statusEl.textContent =
              `ðŸ’¾ [${artistIndex + 1}/${artistEntries.length}] ` +
              `Ø°Ø®ÛŒØ±Ù‡Ù” ØªØ±Ø§Ù†Ù‡â€ŒÙ‡Ø§ÛŒ ${artistName} (${artistSongs.length} ÙØ§ÛŒÙ„)...`;

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
                  error: `Ø³Ø§Ø®Øª Ù¾ÙˆØ´Ù‡ Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯: ${errorMessage}`
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
             * Ø¬Ù„ÙˆÚ¯ÛŒØ±ÛŒ Ø§Ø² ÛŒÚ©Ø³Ø§Ù†â€ŒØ´Ø¯Ù† Ù†Ø§Ù… ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ÛŒ Ù‡Ù…ÛŒÙ† Ø¹Ù…Ù„ÛŒØ§Øª Ø°Ø®ÛŒØ±Ù‡.
             *
             * Ø¨Ø±Ø§ÛŒ Ù…Ø«Ø§Ù„ Ø§Ú¯Ø± Ø¯Ùˆ Ù†ØªÛŒØ¬Ù‡ Ù‡Ø± Ø¯Ùˆ Ø§ÛŒÙ† Ù†Ø§Ù… Ø±Ø§ Ø¯Ø§Ø´ØªÙ‡ Ø¨Ø§Ø´Ù†Ø¯:
             * Ú¯ÙˆÚ¯ÙˆØ´ - Ù‡Ù…Ø®ÙˆÙ†Ù‡.json
             *
             * ÙØ§ÛŒÙ„ Ø¯ÙˆÙ… Ø¨Ù‡ Ø´Ú©Ù„ Ø²ÛŒØ± Ø°Ø®ÛŒØ±Ù‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯:
             * Ú¯ÙˆÚ¯ÙˆØ´ - Ù‡Ù…Ø®ÙˆÙ†Ù‡ (2).json
             */
            const usedFileNames = new Map();

            for (let songIndex = 0; songIndex < artistSongs.length; songIndex++) {
              const song = artistSongs[songIndex];

              try {
                statusEl.textContent =
                  `ðŸ’¾ [${artistIndex + 1}/${artistEntries.length}] ${artistName}\n` +
                  `ÙØ§ÛŒÙ„ ${songIndex + 1} Ø§Ø² ${artistSongs.length}: ` +
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
                  // Ø§Ú¯Ø± Ø¹Ù…Ù„ÛŒØ§Øª Ù†ÙˆØ´ØªÙ† Ø´Ú©Ø³Øª Ø®ÙˆØ±Ø¯ØŒ ØªÙ„Ø§Ø´ Ø¨Ø±Ø§ÛŒ Ù„ØºÙˆ stream
                  try {
                    await writable.abort();
                  } catch (_) {
                    // Ø®Ø·Ø§ÛŒ abort Ø§Ù‡Ù…ÛŒØªÛŒ Ø¨Ø±Ø§ÛŒ Ú¯Ø²Ø§Ø±Ø´ Ø§ØµÙ„ÛŒ Ù†Ø¯Ø§Ø±Ø¯
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
              `âš ï¸ ${savedTotal} ÙØ§ÛŒÙ„ Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯ØŒ ` +
              `${errorsTotal} ÙØ§ÛŒÙ„ Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯`
            );
          } else {
            toast(`âœ… ${savedTotal} ÙØ§ÛŒÙ„ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯`);
          }
        } catch (error) {
          const errorMessage = error?.message || String(error);

          window._aiStats.filesSaved = savedTotal;
          window._aiFailedFiles = failedFiles;

          statusEl.textContent =
            `âŒ Ø¹Ù…Ù„ÛŒØ§Øª Ø°Ø®ÛŒØ±Ù‡ Ù…ØªÙˆÙ‚Ù Ø´Ø¯.\n` +
            `${savedTotal} ÙØ§ÛŒÙ„ Ù‚Ø¨Ù„ Ø§Ø² Ø¨Ø±ÙˆØ² Ø®Ø·Ø§ Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯.\n` +
            `Ø®Ø·Ø§: ${errorMessage}`;

          toast(`Ø®Ø·Ø§ Ø¯Ø± Ø°Ø®ÛŒØ±Ù‡ ÙØ§ÛŒÙ„â€ŒÙ‡Ø§: ${errorMessage}`);
        }

        // Ù…Ù‡Ù…: Ù¾Ø³ Ø§Ø² Ø±ÙˆØ´ Native Ù†Ø¨Ø§ÛŒØ¯ Ø±ÙˆØ´ Ø³Ø±ÙˆØ±ÛŒ Ø§Ø¬Ø±Ø§ Ø´ÙˆØ¯
        return;
      }

      // ============================================================
      // Method 2: Server-side save
      // Ø°Ø®ÛŒØ±Ù‡ ØªÙˆØ³Ø· Ù…Ø³ÛŒØ± /api/save-to-folder
      // ============================================================
      const savePath = $('autoSavePathInput').value.trim();

      if (!savePath) {
        toast('Ø¢Ø¯Ø±Ø³ Ù¾ÙˆØ´Ù‡ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯');
        return;
      }

      statusEl.textContent = 'ðŸ’¾ Ø¯Ø± Ø­Ø§Ù„ Ø°Ø®ÛŒØ±Ù‡ ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ Ø¯Ø± Ø³Ø±ÙˆØ±...';
      toast('Ø¯Ø± Ø­Ø§Ù„ Ø°Ø®ÛŒØ±Ù‡...');

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
            `Ù¾Ø§Ø³Ø® Ø³Ø±ÙˆØ± JSON Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³ØªØ› Ú©Ø¯ ÙˆØ¶Ø¹ÛŒØª: ${resp.status}`
          );
        }

        if (!resp.ok) {
          throw new Error(
            data?.error ||
            `Ø¯Ø±Ø®ÙˆØ§Ø³Øª Ø°Ø®ÛŒØ±Ù‡ Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯Ø› Ú©Ø¯ ÙˆØ¶Ø¹ÛŒØª: ${resp.status}`
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
           * Ø­Ø§Ù„Øª Ø³Ø§Ø²Ú¯Ø§Ø±ÛŒ Ø¨Ø§ Ù†Ø³Ø®Ù‡â€ŒÙ‡Ø§ÛŒ Ù‚Ø¯ÛŒÙ…ÛŒ Ø³Ø±ÙˆØ± Ú©Ù‡ Ù‡Ù†ÙˆØ²
           * perArtist Ø¨Ø±Ù†Ù…ÛŒâ€ŒÚ¯Ø±Ø¯Ø§Ù†Ù†Ø¯.
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
            `âš ï¸ ${savedTotal} ÙØ§ÛŒÙ„ Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯ØŒ ` +
            `${errorsTotal} Ø®Ø·Ø§` +
            `${skippedTotal ? `ØŒ ${skippedTotal} Ø±Ø¯ Ø´Ø¯` : ''}`
          );
        } else {
          toast(
            `âœ… ${savedTotal} ÙØ§ÛŒÙ„ Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯` +
            `${skippedTotal ? `ØŒ ${skippedTotal} Ø±Ø¯ Ø´Ø¯` : ''}`
          );
        }
      } catch (error) {
        const errorMessage = error?.message || String(error);

        statusEl.textContent =
          `âŒ Ø°Ø®ÛŒØ±Ù‡ Ø¯Ø± Ø³Ø±ÙˆØ± Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯:\n${errorMessage}`;

        toast(
          `Ø®Ø·Ø§: ${errorMessage}\n` +
          'Ù…Ø·Ù…Ø¦Ù† Ø´ÙˆÛŒØ¯ Ø³Ø±ÙˆØ± Ø§Ø¬Ø±Ø§ Ø´Ø¯Ù‡ Ùˆ Ù…Ø³ÛŒØ± Ø°Ø®ÛŒØ±Ù‡ Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª'
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
      if (!url) { toast('Ù„ÛŒÙ†Ú© Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯'); return; }
      // Validate URL format
      let parsedUrl;
      try { parsedUrl = new URL(url); } catch(e) { toast('Ù„ÛŒÙ†Ú© Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª'); return; }
      const hostname = parsedUrl.hostname;
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) { toast('Ù¾Ø±ÙˆØªÚ©Ù„ Ù†Ø§Ù…Ø¹ØªØ¨Ø±'); return; }
      toast('Ø¯Ø± Ø­Ø§Ù„ Ø¯Ø±ÛŒØ§ÙØª...');
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
        // Ø¨Ø±Ø§ÛŒ Ù„Ø§Ù…ÛŒÙ†ÙˆØ± Ø§Ø² Ø§Ø³ØªØ®Ø±Ø§Ø¬â€ŒÚ©Ù†Ù†Ø¯Ù‡ Ø¯Ù‚ÛŒÙ‚ (Ù¾ÛŒÚ©Ø³Ù„ÛŒ) Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù†
        if (isLaminor) {
          try {
            const extraction = await window.extractLaminorFromHtml(html);
            if (extraction && extraction.lines && extraction.lines.length > 0) {
              const converted = window.convertExtractedLinesToEdCur(extraction.lines);
              // Ú¯Ø§Ù… Ø§ØµÙ„ÛŒ (original key) Ùˆ Ø±ÛŒØªÙ…/Ø§Ù…Ø¶Ø§ÛŒ Ø²Ù…Ø§Ù† Ø§Ø² ØµÙØ­Ù‡Ù” Ù„Ø§Ù…ÛŒÙ†ÙˆØ± Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ù…ÛŒâ€ŒØ´ÙˆØ¯
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
              toast('Ù…ØªÙ† Ùˆ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø¨Ø§ Ø¯Ù‚Øª Ù¾ÛŒÚ©Ø³Ù„ÛŒ Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø´Ø¯!');
            } else {
              // Fallback Ø¨Ù‡ Ø±ÙˆØ´ Ù…ØªÙ†ÛŒ
              const parsed = parseChordPage(html, url);
              if (parsed) {
                _importParsed = parsed;
                showImportPreview(parsed);
                toast('Ù…ØªÙ† Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø´Ø¯ (Ø±ÙˆØ´ Ù…ØªÙ†ÛŒ)');
              } else { toast('Ù†ØªÙˆØ§Ù†Ø³ØªÙ… Ù…ØªÙ† Ø±Ø§ Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ú©Ù†Ù…'); }
            }
          } catch (extractErr) {
            console.warn('[Laminor Extractor] Pixel extraction failed, falling back to text:', extractErr);
            const parsed = parseChordPage(html, url);
            if (parsed) {
              _importParsed = parsed;
              showImportPreview(parsed);
              toast('Ù…ØªÙ† Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø´Ø¯ (Ø±ÙˆØ´ Ù…ØªÙ†ÛŒ)');
            } else { toast('Ù†ØªÙˆØ§Ù†Ø³ØªÙ… Ù…ØªÙ† Ø±Ø§ Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ú©Ù†Ù…'); }
          }
        } else {
          const parsed = parseChordPage(html, url);
          if (parsed) {
            _importParsed = parsed;
            showImportPreview(parsed);
            toast('Ù…ØªÙ† Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø´Ø¯!');
          } else { toast('Ù†ØªÙˆØ§Ù†Ø³ØªÙ… Ù…ØªÙ† Ø±Ø§ Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ú©Ù†Ù…'); }
        }
      } catch(e) { console.error(e); toast('Ø®Ø·Ø§ Ø¯Ø± Ø¯Ø±ÛŒØ§ÙØª: ' + e.message); }
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
        title = titleEl ? titleEl.textContent.replace(/Ø¢Ú©ÙˆØ±Ø¯\s+Ø¢Ù‡Ù†Ú¯\s*/, '').replace(/\s*-\s*Ù„Ø§Ù…ÛŒÙ†ÙˆØ±.*$/, '').trim() : '';
        const artistEl = doc.querySelector('h6 a.color-light-blue, .smh-header-right-section a.color-light-blue');
        artist = artistEl ? artistEl.textContent.trim() : '';
        const keyMatch = html.match(/Ú¯Ø§Ù… Ø§ØµÙ„ÛŒ:\s*([A-G][#b]?m?)/);
        key = keyMatch ? keyMatch[1] : '';
        const rhythmEl = doc.querySelector('a[href*="rhythms/"]');
        rhythm = rhythmEl ? rhythmEl.textContent.trim() : '';
        if (!rhythm) {
          const rhythmMatch = html.match(/Ø±ÛŒØªÙ…\s+Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯ÛŒ[\s\S]*?(\d+\/\d+)/);
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
        title = titleEl ? titleEl.textContent.replace(/^Ø¢Ú©ÙˆØ±Ø¯\s*/, '').trim() : '';
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
          if (text.includes('Ú¯Ø§Ù…:')) key = text.replace('Ú¯Ø§Ù…:', '').trim();
          if (text.includes('Ø±ÛŒØªÙ…:')) rhythm = text.replace('Ø±ÛŒØªÙ…:', '').trim();
          if (text.includes('Ù…ÛŒØ²Ø§Ù†:')) timeSignature = text.replace('Ù…ÛŒØ²Ø§Ù†:', '').trim();
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
      // Ù…Ù†Ø·Ù‚ Ø¨Ù‡ js/editor/LyricsParser.js Ù…Ù†ØªÙ‚Ù„ Ø´Ø¯Ù‡ Ø§Ø³Øª.
      return requireLyricsParser().parseChordLyricText(rawText);
    }

    function showImportPreview(parsed) {
      const parsed2 = parseChordLyricText(parsed.rawText);
      let preview = `Ø¹Ù†ÙˆØ§Ù†: ${parsed.title || 'Ù†Ø§Ù…Ø´Ø®Øµ'}\n`;
      preview += `Ø®ÙˆØ§Ù†Ù†Ø¯Ù‡: ${parsed.artist || 'Ù†Ø§Ù…Ø´Ø®Øµ'}\n`;
      preview += `Ú¯Ø§Ù…: ${parsed.key || 'Ù†Ø§Ù…Ø´Ø®Øµ'}\n`;
      preview += `Ø±ÛŒØªÙ…: ${parsed.rhythm || 'Ù†Ø§Ù…Ø´Ø®Øµ'}\n`;
      preview += `Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§: ${[...parsed2.allChords].join(', ')}\n`;
      preview += `ØªØ¹Ø¯Ø§Ø¯ Ø®Ø·ÙˆØ·: ${parsed2.sections.length} (${parsed2.sections.filter(s=>s.type==='chord').length} Ø®Ø· Ø¢Ú©ÙˆØ±Ø¯ + ${parsed2.sections.filter(s=>s.type==='lyric').length} Ø®Ø· Ø´Ø¹Ø±)`;
      $('importPreview').textContent = preview;
      $('importPreview').style.display = 'block';
    }

    function applyImportChords() {
      const text = $('importText').value.trim();
      if (!text && !_importParsed) { toast('Ù…ØªÙ†ÛŒ ÙˆØ§Ø±Ø¯ Ù†Ø´Ø¯Ù‡'); return; }

      let parsed;
      if (_importParsed && text.length === 0) {
        parsed = _importParsed;
      } else {
        parsed = { title: '', artist: '', key: '', rhythm: '', rawText: text, url: '' };
        const firstLines = text.split('\n').slice(0, 5);
        for (const l of firstLines) {
          if (!parsed.title && l.match(/Ø¢Ù‡Ù†Ú¯|ØªØ±Ø§Ù†Ù‡|song/i)) { parsed.title = l.replace(/.*[:ï¼š]\s*/, '').trim(); }
          if (!parsed.artist && l.match(/Ø®ÙˆØ§Ù†Ù†Ø¯Ù‡|artist|Ø§Ø²\s/i)) { parsed.artist = l.replace(/.*[:ï¼š]\s*/, '').replace(/Ø§Ø²\s+/, '').trim(); }
        }
      }

      // --- Use canonical parser (only authority for positions) ---
      let parsedResult = parseRawSongToEdCur(parsed);

      // --- Ø§Ú¯Ø± Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ù¾ÛŒÚ©Ø³Ù„ÛŒ Ø§Ù†Ø¬Ø§Ù… Ø´Ø¯Ù‡ØŒ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ÛŒ Ø¯Ù‚ÛŒÙ‚ Ø±Ø§ Ø¬Ø§ÛŒÚ¯Ø²ÛŒÙ† Ú©Ù† ---
      if (parsed._extractedChords && parsed._extractedChords.length > 0) {
        parsedResult.chords = parsed._extractedChords;
        if (parsed._extractionWarnings) {
          parsedResult.warnings = parsedResult.warnings.concat(parsed._extractionWarnings);
        }
      }

      // --- Apply parsed result to edCur (no post-parse mutations) ---
      if (!edCur) edCur = edBlankSong();
      window.edCur = edCur; // sync global reference after ensuring song exists
      edCur.lyrics = parsedResult.lyrics;
      edCur.chords = parsedResult.chords;

      // --- Apply metadata ---
      if (parsedResult.title) edCur.title = parsedResult.title;
      if (parsedResult.artist) edCur.artist = parsedResult.artist;
      if (parsedResult.key) {
        const cleanKey = parsedResult.key.replace('m', '');
        if (typeof etIsValidNote === 'function' && etIsValidNote(cleanKey)) edCur.key = cleanKey;
        if (parsedResult.keyMode === 'min') edCur.keyMode = 'min';
      }
      if (parsedResult.timeSignature) edCur.timeSignature = parsedResult.timeSignature;

      // --- Set originalKey as source of truth (Bug 2 fix) ---
      // The imported key IS the original key. Never fall back to a wrong default.
      edCur.originalKey = edCur.key || 'C';
      edCur.originalKeyMode = edCur.keyMode || 'maj';
      edCur.transpose = 0;
      // Initialize baseChordNames from imported chords (original names, no positions)
      edCur.baseChordNames = (edCur.chords || []).map(ch => ch.name || '');
      // Initialize chordLineClips for independent Chord Line state (Bug fix: prevent auto-overwrite from Lyrics)
      if (!edCur.chordLineClips) edCur.chordLineClips = [];
      if (!edCur.hasManualChordLineEdits) edCur.hasManualChordLineEdits = false;

      DAW.clips = DAW.clips.filter(c => c.type !== 'chord');

      // --- Update UI ---
      edSyncToolbar();
      edRenderEditor(true);
      edSaveSong();
      renderAll();
      closeImportChordModal();
      toast('ØªØ±Ø§Ù†Ù‡ Ø¨Ø§ ' + edCur.chords.length + ' Ø¢Ú©ÙˆØ±Ø¯ ÙˆØ§Ø±Ø¯ Ø´Ø¯: ' + (parsedResult.title || 'Ø¨Ø¯ÙˆÙ† Ù†Ø§Ù…'));
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
        const midiLabel = midiNote ? 'ðŸŽ¹N' + midiNote[0].replace('n','') : '';
        const midiRemoveBtn = midiNote ? `<button class="ed-btn" onclick="removeMidiMap(${midiNote[0].replace('n','')});openShortcutModal();" title="Ø­Ø°Ù MIDI" style="font-size:0.6rem;min-width:18px;height:24px;padding:0 3px;background:#e24f5b;color:#fff;border-color:#e24f5b;">âœ•</button>` : '';
        div.innerHTML = `<span class="shortcut-label">${sk.label}</span><div style="display:flex;gap:4px;align-items:center;"><div class="shortcut-key" data-sid="${sk.id}"><kbd>${keyParts.join(' + ')}</kbd></div><button class="ed-btn" onclick="startMidiLearn('${sk.id}')" title="MIDI Learn" style="font-size:0.7rem;min-width:28px;height:24px;padding:0 4px;${midiNote ? 'background:#9F7AEA;color:#fff;border-color:#9F7AEA;' : ''}">ðŸŽ¹${midiLabel}</button>${midiRemoveBtn}</div>`;
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
      if (el) { el.classList.add('editing'); el.querySelector('kbd').textContent = '...Ú©Ù„ÛŒØ¯ Ø±Ø§ Ø¨Ø²Ù†ÛŒØ¯'; }
    }
    function finishEditShortcut(code, ctrl, shift) {
      if (!_editingShortcutId) return;
      SHORTCUTS[_editingShortcutId] = { code, ctrl: !!ctrl, shift: !!shift };
      saveShortcuts(); _editingShortcutId = null;
      openShortcutModal(); // re-render
      toast('Ø´Ø±ØªÚ©Ø§Øª Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯');
    }
    function resetShortcuts() { SHORTCUTS = {}; localStorage.removeItem('ed_shortcuts'); openShortcutModal(); toast('Ø´Ø±ØªÚ©Ø§Øª Ø¨Ù‡ Ù¾ÛŒØ´â€ŒÙØ±Ø¶ Ø¨Ø§Ø²Ú¯Ø´Øª'); }

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
      toastEl.textContent = 'ðŸŽ¹ Â«' + label + 'Â» â€” Ù†Øª MIDI Ø±Ø§ Ø¨Ø²Ù†ÛŒØ¯...';
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
      toast('ðŸŽ¹ MIDI mapping Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯: Note ' + note);
    }
    loadMidiMaps();

    // Global shortcut capture for editing.
    // EventBindings is responsible for registering this handler.
    function handleGlobalKeydownCapture(e) {
      // Skip if editing a shortcut
      if (_editingShortcutId) {
        e.preventDefault(); e.stopPropagation();
        if (e.key === 'Escape') { _editingShortcutId = null; openShortcutModal(); return; }
        if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return;
        finishEditShortcut(e.code, e.ctrlKey || e.metaKey, e.shiftKey);
        return;
      }
      // Alt+P: intercept in capture phase before browser menu activates
      if (e.altKey && e.code === 'KeyP') {
        e.preventDefault(); e.stopPropagation();
        setLoopFromSelectionAndPlay();
        return;
      }
      // Space in perf mode: intercept in capture phase before buttons can steal focus
      if (e.code === 'Space' && perfModeActive && !e.target.closest('input,textarea,[contenteditable]')) {
        e.preventDefault(); e.stopPropagation();
        perfTogglePlay();
        return;
      }
      // Space in editor: play/pause (capture phase to prevent button focus issues)
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest('input,textarea,[contenteditable],.arr-perf-panel')) {
        e.preventDefault(); e.stopPropagation();
        togglePlay();
        return;
      }
      // Mapping mode: Ctrl+Shift+Alt held
      if (e.ctrlKey && e.shiftKey && e.altKey) {
        e.preventDefault(); e.stopPropagation();
      }
    }

    // Main global shortcuts handler.
    // EventBindings is responsible for registering this handler.
    function handleGlobalKeydown(e) {
      // Skip if editing a shortcut
      if (_editingShortcutId) return;
      const tag = (e.target && e.target.tagName) || '';
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const isContentEditable = e.target && (e.target.isContentEditable || e.target.contentEditable === 'true');

      // Undo/Redo: always work globally
      if (matchShortcut(e, 'undo')) { e.preventDefault(); undo(); return; }
      if (matchShortcut(e, 'redo')) { e.preventDefault(); redo(); return; }

      // F9: Singer (monitor Ú†Ù¾) + Player (monitor Ù„Ù¾â€ŒØªØ§Ù¾) + Ù¾Ø®Ø´
      if (matchShortcut(e, 'fullscreen')) {
        e.preventDefault();
        if (!DAW.isPlaying) { ensureAudioCtx(); if (DAW.playhead <= 0) seekTransport(0, false); startTransport(); }
        // Singer View â€” monitor 2 (Ú†Ù¾)
        openLyricOnlyPopup();
        // Player View â€” monitor 1 (Ù„Ù¾â€ŒØªØ§Ù¾)
        setTimeout(openLyricPopup, 300);
        return;
      }
      // Focus mode
      if (matchShortcut(e, 'focusMode')) { e.preventDefault(); toggleFocusMode(); return; }

      // Arrow keys: playhead seeking OR chord movement (skip when Ctrl/Shift held for panel shortcuts)
      if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !isInput && !isContentEditable && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if ($('chord-modal')?.classList.contains('show')) return;
        // If chords are selected in editor, let the chord handler deal with it
        if (edSelectedChords.length > 0 && edCur) return;
        const barDur = getTimeSignatureGridConfig(($('edTimeSig')?.value || '4/4'), (parseInt($('edTempo')?.value) || 120)).measureDuration;
        const step = e.shiftKey ? barDur : 0.05;
        e.preventDefault();
        seekTransport(DAW.playhead + (e.code === 'ArrowRight' ? step : -step), true, true);
        return;
      }

      // Delete â€” when NOT in text field and clips selected
      if (matchShortcut(e, 'delete') && !isInput && !isContentEditable && DAW.selectedIds.size > 0) {
        e.preventDefault(); deleteSelected();
        return;
      }

      // Don't handle DAW shortcuts when in any text input
      if (isInput || isContentEditable) return;

      if (matchShortcut(e, 'delete')) { e.preventDefault(); deleteSelected(); }
      else if (matchShortcut(e, 'split')) { e.preventDefault(); splitSelectedAtPlayhead(); }
      else if (matchShortcut(e, 'copy')) { e.preventDefault(); copySelected(); }
      else if (matchShortcut(e, 'cut')) { e.preventDefault(); cutSelected(); }
      else if (matchShortcut(e, 'paste')) { e.preventDefault(); pasteClipboard(); }
      else if (matchShortcut(e, 'selectAll')) { e.preventDefault(); setSelection(DAW.clips.map(c => c.id)); }
      else if (matchShortcut(e, 'duplicate')) { e.preventDefault(); duplicateSelected(); }
      else if (matchShortcut(e, 'goStart')) { transportToStart(); }
      else if (matchShortcut(e, 'setLoopFromSel')) { e.preventDefault(); setLoopFromSelection(); }
      else if (matchShortcut(e, 'loop')) { e.preventDefault(); toggleLoop(); }
      else if (matchShortcut(e, 'loopA')) { e.preventDefault(); setLoopA(); }
      else if (matchShortcut(e, 'loopB')) { e.preventDefault(); setLoopB(); }
      else if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey && !e.altKey && !isInput && !isContentEditable) { e.preventDefault(); togglePlayheadMode(); }
      else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey && !isInput && !isContentEditable) { e.preventDefault(); toggleRec(); }
      // Q: Ú©ÙˆØ§Ù†ØªØ§ÛŒØ² Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ÛŒ Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡ Ø¯Ø± Ú©ÙˆØ±Ø¯ Ù„Ø§ÛŒÙ†
      else if (e.code === 'KeyQ' && !e.ctrlKey && !e.metaKey && !e.altKey && !isInput && !isContentEditable) {
        e.preventDefault();
        quantizeSelectedChords();
      }
      else if (e.key === 'Escape') {
        if (_focusMode) { toggleFocusMode(); return; }
        if (syncActive) { exitSyncMode(); const tab = $('tab-sync'); if (tab) tab.classList.remove('active-teal'); return; }
        clearSelection();
      }
    }

    /* ===================== INIT & INTERACTIONS ===================== */
    function init() {
      ensureAudioCtx();
      DAW.tracks = [
        { id: 't0', name: 'Chord Line', icon: 'â™«', type: 'chord' },
        { id: 't0s', name: 'Section', icon: 'ðŸ·', type: 'section' },
        { id: 't1', name: 'Vocals', icon: 'ðŸŽ¤', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't2', name: 'Guitar', icon: 'ðŸŽ¸', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't3', name: 'Bass', icon: 'ðŸŽµ', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't4', name: 'Keys', icon: 'ðŸŽ¹', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
        { id: 't5', name: 'Drums', icon: 'ðŸ¥', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 }
      ];
      DAW.tracks.forEach(t => {
        if (t.type === 'audio') {
          t._pannerNode = DAW.audioCtx.createStereoPanner(); t._gainNode = DAW.audioCtx.createGain();
          t._pannerNode.connect(t._gainNode); t._gainNode.connect(DAW.masterGain); updateTrackMix(t.id);
        }
      });
      ensureRecLane();
      DAW.sections = []; DAW.selectedSectionIds = new Set();
      DAW.timelineDuration = 120; DAW.pxPerSecond = 70; saveState(); renderAll();
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
      window.addEventListener('keyup', (e) => { if (e.key === 'Shift') $('cut-guide').style.display = 'none'; });

    } // End init()

    // ===== TOOLBAR DRAG & DOCK =====
    (function() {
      let toolbarDragging = false, toolbarOffX = 0, toolbarOffY = 0;
      const headerCtrl = $('headerCenterControls');
      const dragHandle = $('toolbarDragHandle');
      const pinBtn = $('toolbarPinBtn');
      if (!headerCtrl || !dragHandle || !pinBtn) return;

      // Right-click context menu
      const toolbarGroups = [
        { label: 'Ú¯Ø§Ù… Ùˆ Ø­Ø§Ù„Øª', selector: '#edKey, #edKeyMode' },
        { label: 'ØªÙ†Ø¸ÛŒÙ…Ø§Øª Ù…ØªÙ†', selector: '#edTextSize, #edTextFont, #edTextBold, #edAlignRight, #edAlignCenter, #edAlignLeft' },
        { label: 'ØªÙ†Ø¸ÛŒÙ…Ø§Øª Ø¢Ú©ÙˆØ±Ø¯', selector: '#edChordSize, #edChordFont, #edToggleChords' },
        { label: 'ØªØ±ØªÛŒØ¨ÛŒ', selector: '#edSeqToggle, #edSeqStart, #edSeqPrev, #edSeqNext, #edClStart, #edClUndo, #edClClear, #edClApply, #edSeqModeSeg' },
        { label: 'ØªØ±Ù†Ø³Ù¾ÙˆØ²', selector: '#edTransDown, #edTransVal, #edTransUp' },
        { label: 'Undo/Redo', selector: '#edUndoBtn, #edRedoBtn' },
        { label: 'Ù‚ÙÙ„ ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø±', selector: '#edEditorLockBtn' },
        { label: 'Ø­Ø°Ù Ø³ØªØ§Ø±Ù‡', selector: '#edRemoveAsterisks' },
        { label: 'Ø¨Ø±Ø¹Ú©Ø³ Ø¢Ú©ÙˆØ±Ø¯', selector: '#edReverseChords' },
        { label: 'Ø­Ø°Ù Ø³ØªØ§Ø±Ù‡ + Ø¨Ø±Ø¹Ú©Ø³', selector: '#edDoBoth' },
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
        pinItem.innerHTML = `<span class="ctx-check">${isDocked ? 'ðŸ”—' : 'ðŸ“Œ'}</span>${isDocked ? 'Ø§ØªØµØ§Ù„ Ø¨Ù‡ ØµÙØ­Ù‡' : 'Ø¬Ø¯Ø§ Ú©Ø±Ø¯Ù†'}`;
        pinItem.onclick = () => { toggleToolbarDock(); };
        menu.appendChild(pinItem);

        // Separator
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:#2d3748;margin:4px 0;';
        menu.appendChild(sep);

        // Show all
        const showAllItem = document.createElement('div');
        showAllItem.className = 'ctx-item';
        showAllItem.innerHTML = `<span class="ctx-check">ðŸ‘â€ðŸ—¨</span>Ù†Ù…Ø§ÛŒØ´ Ù‡Ù…Ù‡`;
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
            checkSpan.textContent = vis ? 'ðŸ‘' : 'âˆ’';
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

      dragHandle.addEventListener('mousedown', (e) => {
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
        const rect = headerCtrl.getBoundingClientRect();
        toolbarOffX = e.clientX - rect.left;
        toolbarOffY = e.clientY - rect.top;
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!toolbarDragging) return;
        let x = e.clientX - toolbarOffX;
        let y = e.clientY - toolbarOffY;
        // Clamp to viewport
        x = Math.max(0, Math.min(x, window.innerWidth - 60));
        y = Math.max(0, Math.min(y, window.innerHeight - 40));
        headerCtrl.style.left = x + 'px'; headerCtrl.style.top = y + 'px';
        headerCtrl.style.transform = 'none';
      });

      document.addEventListener('mouseup', (e) => {
        if (!toolbarDragging) return;
        toolbarDragging = false;
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
    })(); // End toolbar IIFE

    // ===== Ruler & Playhead (global scope, uses global refs) =====
    (function() {
      const lanes = $('lanes-container');
      const scroll = $('tl-scroll');
      if (!lanes || !scroll) return;

      // Scroll wheel zoom on timeline
      // Ctrl+Alt+wheel = vertical zoom (lane height)
      // Ctrl+wheel or Alt+wheel = horizontal zoom (pxPerSecond)
      scroll.addEventListener('wheel', (e) => {
        if (!e.altKey && !e.ctrlKey) return; e.preventDefault();
        if (e.ctrlKey && e.altKey) {
          // Vertical zoom: Ctrl+Alt+wheel
          const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
          setVerticalZoom(DAW.laneHeight * factor);
        } else {
          // Horizontal zoom: Ctrl+wheel or Alt+wheel
          const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12; setZoom(DAW.pxPerSecond * factor, e.clientX);
        }
      }, { passive: false });

      const beginScrub = (e) => {
  if (DAW.isRecording) { toast('Ø¯Ø± Ø­Ø§Ù„ Ø¶Ø¨Ø· â€” Ø¨Ø±Ø§ÛŒ Ø¬Ø§Ø¨Ù‡â€ŒØ¬Ø§ÛŒÛŒ Ù¾Ù„ÛŒâ€ŒÙ‡Ø¯ Ø§Ø¨ØªØ¯Ø§ ØªÙˆÙ‚Ù Ú©Ù†ÛŒØ¯'); return; }
  clearEditorTextSelection();
  edClearChordSelection();

  // Shift+click on playhead-hit: toggle playhead selection (draggable)
  if (e.shiftKey && e.currentTarget === $('playhead-hit')) {
    e.preventDefault();
    DAW.selectedPlayhead = !DAW.selectedPlayhead;
    $('main-playhead').classList.toggle('selected', DAW.selectedPlayhead);
    if (DAW.selectedPlayhead) {
      // Start dragging the selected playhead
      const startX = e.clientX; const origTime = DAW.playhead;
      const startY = e.clientY; const origPxPerSec = DAW.pxPerSecond;
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
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    }
    return;
  }

  clearSelection();
  DAW.selectedPlayhead = false; $('main-playhead').classList.remove('selected');
  e.preventDefault();

  // Cubase-style: click on upper half of ruler to set locators
  const ruler = $('timeline-ruler');
  if (ruler) {
    const rulerRect = ruler.getBoundingClientRect();
    const localY = e.clientY - rulerRect.top;
    const isUpperHalf = localY < rulerRect.height * 0.5;

    if (isUpperHalf && DAW.loopEnabled) {
      const t = clientToTime(e.clientX);
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Click = set right locator
        DAW.loopB = Math.max(t, DAW.loopA + 0.5);
        renderLoopRegion(); saveState();
      } else {
        // Click = set left locator
        DAW.loopA = Math.min(t, DAW.loopB - 0.5);
        renderLoopRegion(); saveState();
      }
      return;
    }
  }

  seekTransport(clientToTime(e.clientX), true);

        const scrubStartX = e.clientX; const scrubStartY = e.clientY; const scrubOrigPxPerSec = DAW.pxPerSecond;
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
        const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      };
      $('timeline-ruler').addEventListener('mousedown', beginScrub);
      $('playhead-hit').addEventListener('mousedown', beginScrub);

      // Timeline separator drag: drag up = lanes bigger, drag down = lanes smaller
      const sepEl = $('timelineSep');
      if (sepEl) {
        sepEl.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const startY = e.clientY;
          const origH = DAW.laneHeight;
          const onMove = (ev) => { const dy = startY - ev.clientY; setVerticalZoom(origH + dy * 0.5); };
          const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
          document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
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
      if (loopBtn) loopBtn.classList.toggle('loop-active', DAW.loopEnabled);
      renderLoopRegion();

      // ===== DRAG & DROP audio files onto timeline =====
      const tlScroll = $('tl-scroll');
      tlScroll.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; tlScroll.style.outline = '2px dashed var(--accent-teal)'; });
      tlScroll.addEventListener('dragleave', () => { tlScroll.style.outline = ''; });
      tlScroll.addEventListener('drop', async (e) => {
        e.preventDefault();
        tlScroll.style.outline = '';
        const files = [...(e.dataTransfer.files || [])].filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name));
        if (files.length === 0) return;

        // Clear all selections before import
        clearSelection();
        ensureAudioCtx();
        
        // Detect which track lane the file was dropped on
        const droppedLane = e.target.closest('.track-lane');
        let targetTrackId = null;
        if (droppedLane) {
          const laneTrackId = droppedLane.dataset.trackId;
          const targetTrack = DAW.tracks.find(t => t.id === laneTrackId);
          // Only accept drop on audio tracks (not section or chord)
          if (targetTrack && targetTrack.type === 'audio') {
            targetTrackId = laneTrackId;
          }
        }
        
        let audioTracks = DAW.tracks.filter(t => t.type === 'audio');
        
        // If dropped on a specific audio track, use only that track
        if (targetTrackId) {
          audioTracks = [DAW.tracks.find(t => t.id === targetTrackId)];
        }

        // Ø§Ú¯Ù‡ ØªØ±Ú© ØµÙˆØªÛŒ Ú©Ù…ØªØ± Ø§Ø² ØªØ¹Ø¯Ø§Ø¯ ÙØ§ÛŒÙ„Ù‡Ø§Ø³ØªØŒ Ø®ÙˆØ¯Ú©Ø§Ø± ØªØ±Ú© Ø¬Ø¯ÛŒØ¯ Ø¨Ø³Ø§Ø²
        while (audioTracks.length < files.length) {
          addNewTrack();
          audioTracks = DAW.tracks.filter(t => t.type === 'audio');
        }

        const doCopy = await askAudioCopyMode(`${files.length} ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ`);

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const trackIdx = i % audioTracks.length;
          const trackId = audioTracks[trackIdx].id;
          try {
            toast(`Ù„ÙˆØ¯ ${i + 1}/${files.length}: ${file.name}`);
            const { buffer } = await decodeFileToBuffer(file);
            const bufferKey = 'buf_' + uid('b') + '_' + file.name;
            DAW.bufferCache.set(bufferKey, buffer);

            // Start each file after the previous one ends
            const lastClipEnd = DAW.clips.filter(c => c.trackId === trackId).reduce((max, c) => Math.max(max, c.start + c.duration), 0);

            const clip = {
              id: uid('c'), type: 'audio', trackId,
              name: file.name.replace(/\.[^.]+$/, ''),
              fileName: file.name,
              start: roundMs(Math.max(lastClipEnd, DAW.playhead)),
              duration: buffer.duration, offset: 0,
              sourceDuration: buffer.duration,
              color: COLORS[DAW.clips.length % COLORS.length],
              bufferKey,
              _peaks: peaksFromBuffer(buffer, 2000),
              waveUrl: null,
              _embedded: doCopy,
              // â”€â”€â”€ Ø°Ø®ÛŒØ±Ù‡ Blob Ø§ØµÙ„ÛŒ Ø¨Ø±Ø§ÛŒ Ø°Ø®ÛŒØ±Ù‡ Ø­Ø¬Ù… (Ø¨Ù‡â€ŒØ¬Ø§ÛŒ Base64) â”€â”€â”€
              _originalBlob: doCopy ? file : null
            };
            // Ø°Ø®ÛŒØ±Ù‡ Ù…Ø³ÛŒØ±/Ù‡Ù†Ø¯Ù„ ÙØ§ÛŒÙ„ Ø¨Ø±Ø§ÛŒ Ù„ÛŒÙ†Ú©â€ŒØ´Ø¯Ù‡â€ŒÙ‡Ø§
            if (!doCopy) {
              if (isElectron && file.path) {
                clip._filePath = file.path;
                console.log(`[DROP] Electron file path saved: ${file.name} â†’ ${file.path}`);
              } else if (isElectron) {
                // Ø¯Ø± Ø§Ù„Ú©ØªØ±ÙˆÙ† ÙˆÙ„ÛŒ file.path Ù…ÙˆØ¬ÙˆØ¯ Ù†ÛŒØ³Øª (Ø§Ù„Ú©ØªØ±ÙˆÙ† 32+)
                console.warn(`[DROP] Electron but file.path is missing for: ${file.name}`);
                // fallback: Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø§Ø² webUtils.getPathForFile Ø§Ú¯Ù‡ Ù…ÙˆØ¬ÙˆØ¯ Ø¨Ø§Ø´Ù‡
                if (window.electronAPI && window.electronAPI.getPathForFile) {
                  try {
                    const filePath = await window.electronAPI.getPathForFile(file);
                    if (filePath) {
                      clip._filePath = filePath;
                      console.log(`[DROP] Got path via webUtils: ${file.name} â†’ ${filePath}`);
                    }
                  } catch(_) {}
                }
                // Ø§Ú¯Ù‡ Ù‡Ù†ÙˆØ² Ù…Ø³ÛŒØ± Ù†Ø¯Ø§Ø±ÛŒÙ…ØŒ ÙØ§ÛŒÙ„ Ø±Ùˆ Ø¨Ù‡â€ŒØµÙˆØ±Øª Blob Ø°Ø®ÛŒØ±Ù‡ Ú©Ù†
                if (!clip._filePath) {
                  try {
                    await saveAudioBlobToDB(bufferKey, file, file.name);
                    console.log(`[DROP] Saved as blob fallback: ${file.name}`);
                  } catch(_) {}
                }
              } else {
                // â”€â”€â”€ Ø¯Ø± Ù…Ø±ÙˆØ±Ú¯Ø±: ÙØ§ÛŒÙ„ Ø¯Ø±Ú¯â€ŒØ´Ø¯Ù‡ Ø±Ùˆ Ø¨Ù‡â€ŒØµÙˆØ±Øª Blob Ø¯Ø± IndexedDB Ø°Ø®ÛŒØ±Ù‡ Ú©Ù† â”€â”€â”€
                try {
                  await saveAudioBlobToDB(bufferKey, file, file.name);
                } catch(_) {}
              }
            }
            refreshClipWaveImage(clip);
            DAW.clips.push(clip);
            ensureTimelineFits(clip.start + clip.duration + 5);
          } catch (err) {
            console.error(err);
            toast(`Ø®Ø·Ø§ Ø¯Ø± Ù„ÙˆØ¯ ${file.name}`);
          }
        }

        if (doCopy) saveAudioBlobsForProject(edCur.id).catch(() => {});
        // Ø°Ø®ÛŒØ±Ù‡ Ù…Ø³ÛŒØ± ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ÛŒ Ù„ÛŒÙ†Ú©â€ŒØ´Ø¯Ù‡ Ø¯Ø± edCur._audioPaths
        if (!doCopy) {
          if (!edCur._audioPaths) edCur._audioPaths = [];
          for (const clip of DAW.clips.slice(-files.length)) {
            if (!clip._embedded && clip.bufferKey) {
              const existing = edCur._audioPaths.find(p => p.bufferKey === clip.bufferKey);
              if (!existing) {
                edCur._audioPaths.push({
                  bufferKey: clip.bufferKey,
                  fileName: clip.fileName || clip.name,
                  trackId: clip.trackId,
                  filePath: clip._filePath || null
                });
              }
            }
          }
        }
        DAW.selectedIds = new Set(DAW.clips.slice(-files.length).map(c => c.id));
        saveState(); renderAll();
        toast(`${files.length} ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ Ù„ÙˆØ¯ Ø´Ø¯`);
        edSaveSong();
      });

      // Timeline resizable separator
      const sep = $('timelineSep');
      if (sep) {
        sep.addEventListener('mousedown', e => {
          e.preventDefault();
          const startY = e.clientY;
          const grid = $('app-container') || document.querySelector('.app-container');
          const startRow = parseInt(getComputedStyle(grid).gridTemplateRows.split(' ')[3]) || 320;
          const move = ev => {
            const delta = startY - ev.clientY;
            const newH = Math.max(120, Math.min(window.innerHeight - 200, startRow + delta));
            grid.style.gridTemplateRows = `75px 1fr 4px ${newH}px`;
          };
          const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
          document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
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
    window.edCur = edCur; // expose to global scope for projecthub.js and other modules
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

    async function edInitSong() {
      const saved = localStorage.getItem('ed_current_song');
      if (saved) { try { edCur = JSON.parse(saved); } catch(e) { edCur = null; } }
      if (!edCur) edCur = edBlankSong();
      window.edCur = edCur; // sync global reference
      if (!edCur.styles) edCur.styles = {};
      if (!edCur.lineColors) edCur.lineColors = [];
      if (!edCur.chordVersions) edCur.chordVersions = [];
      if (edCur.activeChordVersion === undefined) edCur.activeChordVersion = 0;
      // Restore editor lock state
      if (edCur.editorLocked) {
        const editor = $('editor');
        if (editor) editor.contentEditable = 'false';
        const lockBtn = $('edEditorLockBtn');
        if (lockBtn) lockBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      }
      const defaults = { tSize:38,tColor:'#0fa966',tFont:'Vazirmatn',tBold:true,align:'center', cSize:38,cColor:'#e6aa28',cFont:'JetBrains Mono' };
      Object.keys(defaults).forEach(k => { if (edCur.styles[k] === undefined) edCur.styles[k] = defaults[k]; });
      if (edCur._dawTracks) {
        DAW.tracks = edCur._dawTracks;
        ensureAudioCtx();
        DAW.tracks.forEach(t => {
          if (t.type === 'audio') {
            t._pannerNode = DAW.audioCtx.createStereoPanner();
            t._gainNode = DAW.audioCtx.createGain();
            t._pannerNode.connect(t._gainNode);
            t._gainNode.connect(DAW.masterGain);
            updateTrackMix(t.id);
          }
        });
      }
      if (edCur._dawClips) DAW.clips = edCur._dawClips;
      if (edCur._dawSections) DAW.sections = JSON.parse(JSON.stringify(edCur._dawSections));
      updateNextIdFromClips();
      // Migrate any old section clips from DAW.clips to DAW.sections
      const oldSections = DAW.clips.filter(c => c.type === 'section');
      if (oldSections.length > 0) {
        oldSections.forEach(c => { DAW.sections.push({ id: c.id, trackId: c.trackId, label: c.name, start: c.start, duration: c.duration, color: c.color }); });
        DAW.clips = DAW.clips.filter(c => c.type !== 'section');
      }
      // Restore loop state
      if (edCur._dawLoop) { DAW.loopEnabled = !!edCur._dawLoop.loopEnabled; DAW.loopA = edCur._dawLoop.loopA || 0; DAW.loopB = edCur._dawLoop.loopB || 10; }
      // Restore audio blobs from IndexedDB
      try {
        await loadAudioBlobsForProject(edCur.id);
        DAW.clips.forEach(c => {
          if (c.type !== 'chord' && c.bufferKey && DAW.bufferCache.has(c.bufferKey)) {
            const buffer = DAW.bufferCache.get(c.bufferKey);
            c.sourceDuration = buffer.duration;
            c._peaks = peaksFromBuffer(buffer, 2000);
            refreshClipWaveImage(c);
          }
        });
      } catch(e) { console.warn('Audio init load error:', e); }

      // Ù„ÙˆØ¯ Ø§ØªÙˆÙ…Ø§ØªÛŒÚ© Ø§Ø² Ù…Ø³ÛŒØ± ÙØ§ÛŒÙ„ Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ (Ù„ÛŒÙ†Ú©â€ŒØ´Ø¯Ù‡â€ŒÙ‡Ø§ â€” Ù…Ø«Ù„ Ú©ÛŒÙˆØ¨ÛŒØ³)
      const missingClips = DAW.clips.filter(c => c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey));
      console.log(`[Audio Init] ${missingClips.length} clip(s) need audio loading. isElectron=${isElectron}, _audioPaths=${edCur._audioPaths?.length || 0}`);
      if (missingClips.length > 0 && edCur._audioPaths && edCur._audioPaths.length > 0) {
        // Ø§ÙˆÙ„ Ø§Ø² filePath (Electron) Ù„ÙˆØ¯ Ú©Ù†
        if (isElectron && window.electronAPI) {
          for (const ap of edCur._audioPaths) {
            if (!ap.filePath) { console.warn('[LINK] No filePath for:', ap.fileName); continue; }
            const clip = DAW.clips.find(c => c.type !== 'chord' && c.bufferKey === ap.bufferKey);
            if (!clip || DAW.bufferCache.has(clip.bufferKey)) continue;
            try {
              console.log('[LINK] Loading from path:', ap.filePath);
              const audioBuffer = await loadAudioFromHardDrive(ap.filePath);
              DAW.bufferCache.set(clip.bufferKey, audioBuffer);
              clip.sourceDuration = audioBuffer.duration;
              clip._peaks = peaksFromBuffer(audioBuffer, 2000);
              clip._filePath = ap.filePath;
              refreshClipWaveImage(clip);
              console.log('[LINK] âœ“ Loaded:', ap.fileName);
            } catch (e) {
              console.warn('[LINK] File not found at path:', ap.filePath, e.message);
            }
          }
        }

        // â”€â”€â”€ Ù„ÙˆØ¯ Ø§Ø² Blob Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ Ø¯Ø± IndexedDB (Ø¨Ø¯ÙˆÙ† Ø³ÙˆØ§Ù„ Ø§Ø² Ú©Ø§Ø±Ø¨Ø±) â”€â”€â”€
        // Ø§ÛŒÙ† Ù…Ø±Ø­Ù„Ù‡ Ø¬Ø¯ÛŒØ¯ Ù‡Ø³Øª â€” Ù‚Ø¨Ù„Ø§Ù‹ ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ÛŒ Â«Ù†Ù‡Â» Ø°Ø®ÛŒØ±Ù‡ Ù†Ù…ÛŒâ€ŒØ´Ø¯Ù† Ùˆ Ø¯ÙˆØ¨Ø§Ø±Ù‡ Ø§Ø² Ú©Ø§Ø±Ø¨Ø± Ù¾Ø±Ø³ÛŒØ¯Ù‡ Ù…ÛŒâ€ŒØ´Ø¯
        const stillAfterPathBlob = DAW.clips.filter(c => c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey));
        if (stillAfterPathBlob.length > 0) {
          for (const clip of stillAfterPathBlob) {
            try {
              const blobRecord = await getAudioBlobFromDB(clip.bufferKey);
              if (!blobRecord) continue;
              const { buffer } = await decodeFileToBuffer(blobRecord.blob);
              DAW.bufferCache.set(clip.bufferKey, buffer);
              clip.sourceDuration = buffer.duration;
              clip._peaks = peaksFromBuffer(buffer, 2000);
              refreshClipWaveImage(clip);
              console.log('[BLOB] Auto-reloaded:', blobRecord.fileName);
            } catch(e) { console.warn('[BLOB] Auto-reload failed for', clip.bufferKey, e.message); }
          }
        }

        // Ù„ÙˆØ¯ Ø§Ø² FileHandle Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ Ø¯Ø± IndexedDB (Ø¨Ø¯ÙˆÙ† Ø³ÙˆØ§Ù„ Ø§Ø² Ú©Ø§Ø±Ø¨Ø±)
        const stillAfterPath = DAW.clips.filter(c => c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey));
        if (stillAfterPath.length > 0) {
          for (const clip of stillAfterPath) {
            try {
              const handle = await getFileHandle(clip.bufferKey);
              if (!handle) continue;
              if (handle.requestPermission) {
                const perm = await handle.requestPermission({ mode: 'read' });
                if (perm !== 'granted') continue;
                const file = await handle.getFile();
                const { buffer } = await decodeFileToBuffer(file);
                DAW.bufferCache.set(clip.bufferKey, buffer);
                clip.sourceDuration = buffer.duration;
                clip._peaks = peaksFromBuffer(buffer, 2000);
                refreshClipWaveImage(clip);
                console.log('[HANDLE] Auto-reloaded:', clip.fileName);
              }
            } catch(e) { console.warn('[HANDLE] Auto-reload failed for', clip.bufferKey, e.message); }
          }
        }

        // Ø¨Ø¹Ø¯ Ø§Ø² Ù¾ÙˆØ´Ù‡ Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ (_audioDirHandle) Ù„ÙˆØ¯ Ú©Ù†
        const stillMissing = DAW.clips.filter(c => c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey));
        if (stillMissing.length > 0) {
          let dirHandle = _audioDirHandle;
          if (!dirHandle) { try { await loadDirHandle(); dirHandle = _audioDirHandle; } catch(_){} }
          if (dirHandle) {
            try {
              const perm = await dirHandle.requestPermission({ mode: 'read' });
              if (perm === 'granted') {
                const notFound = [];
                for (const ap of edCur._audioPaths) {
                  const clip = DAW.clips.find(c => c.type !== 'chord' && c.bufferKey === ap.bufferKey);
                  if (!clip || DAW.bufferCache.has(clip.bufferKey)) continue;
                  const candidates = [ap.fileName, ap.fileName ? ap.fileName.replace(/\.[^.]+$/, '') : ''];
                  let loaded = false;
                  for (const name of candidates) {
                    if (!name) continue;
                    try {
                      const fileHandle = await dirHandle.getFileHandle(name);
                      const file = await fileHandle.getFile();
                      const { buffer } = await decodeFileToBuffer(file);
                      DAW.bufferCache.set(clip.bufferKey, buffer);
                      clip.sourceDuration = buffer.duration;
                      clip._peaks = peaksFromBuffer(buffer, 2000);
                      refreshClipWaveImage(clip);
                      loaded = true;
                      break;
                    } catch(_) {}
                  }
                  if (!loaded) notFound.push(ap.fileName || 'Ù†Ø§Ù…â€ŒÙ†Ø§Ø´Ù†Ø§Ø®ØªÙ‡');
                }
                if (notFound.length > 0) toast('ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ÛŒ ØµÙˆØªÛŒ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯: ' + notFound.join(', '));
              }
            } catch(_) {}
          }

          // Ø¨Ø±Ø§ÛŒ ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ÛŒÛŒ Ú©Ù‡ Ù‡Ù†ÙˆØ² Ú¯Ù… Ø´Ø¯Ù†Ø¯ØŒ Ø§Ù†ØªØ®Ø§Ø¨ Ø¯Ø³ØªÛŒ Ø§Ø² Ú©Ø§Ø±Ø¨Ø±
          const stillMissing2 = DAW.clips.filter(c => c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey));
          if (stillMissing2.length > 0 && !isElectron) {
            try {
              const newDirHandle = await window.showDirectoryPicker({ mode: 'read' });
              await saveDirHandle(newDirHandle);
              const perm = await newDirHandle.requestPermission({ mode: 'read' });
              if (perm === 'granted') {
                for (const ap of edCur._audioPaths) {
                  const clip = DAW.clips.find(c => c.type !== 'chord' && c.bufferKey === ap.bufferKey);
                  if (!clip || DAW.bufferCache.has(clip.bufferKey)) continue;
                  for (const n of [ap.fileName, ap.fileName ? ap.fileName.replace(/\.[^.]+$/, '') : '']) {
                    if (!n) continue;
                    try {
                      const fh = await newDirHandle.getFileHandle(n);
                      const f = await fh.getFile();
                      const { buffer } = await decodeFileToBuffer(f);
                      DAW.bufferCache.set(clip.bufferKey, buffer);
                      clip.sourceDuration = buffer.duration;
                      clip._peaks = peaksFromBuffer(buffer, 2000);
                      refreshClipWaveImage(clip);
                      break;
                    } catch(_) {}
                  }
                }
              }
            } catch(_) { /* Ú©Ø§Ø±Ø¨Ø± Ú©Ù†Ø³Ù„ Ú©Ø±Ø¯ */ }
          }
        }
      }
      edSyncToolbar();
      edRenderEditor();

      undoStack = [];
      undoIndex = -1;
      PERF.lastSerializedState = '';

      edSyncToolbar();
      edRenderEditor(true);
      renderAll();
      saveState();

      // Apply highlight effect
      initHighlightEffect();
      // === Performance Architecture v2: init SongDocument ===
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
      // === Performance Architecture v2: init per-view settings ===
      if (typeof syncViewStylesFromEdCur === 'function') syncViewStylesFromEdCur();
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

    // ===== Ø°Ø®ÛŒØ±Ù‡ FileHandle Ø¯Ø± IndexedDB Ø¨Ø±Ø§ÛŒ Ù„ÙˆØ¯ Ø§ØªÙˆÙ…Ø§ØªÛŒÚ© Ø¨Ø¯ÙˆÙ† Ø³ÙˆØ§Ù„ =====
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
    // ===== Ù…ÙˆØ¯Ø§Ù„ Ø³ÙØ§Ø±Ø´ÛŒ Ø¨Ù„Ù‡/Ù†Ù‡ Ø¬Ø§ÛŒ confirm() =====
    let _copyModalResolver = null;
    function askAudioCopyMode(fileName) {
  // Ø¯Ø± Ù†Ø³Ø®Ù‡ Ù†ØµØ¨ÛŒ (Electron)ØŒ ØµØ¯Ø§ Ù‡Ù…ÛŒØ´Ù‡ Ø¨Ù‡ ØµÙˆØ±Øª Ù…Ø³ÛŒØ± Ø°Ø®ÛŒØ±Ù‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯
  if (isElectron) {
    toast(`Â«${fileName}Â» Ø¨Ù‡â€ŒØµÙˆØ±Øª Ù…Ø³ÛŒØ± Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯ (Ø­Ø¬Ù… Ú©Ù…)`);
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
        _copyModalResolver = resolve;
        const modal = $('audioCopyModal');
        const text = $('audioCopyModalText');
        if (text) text.textContent = `ÙØ§ÛŒÙ„ Â«${fileName}Â» Ø¯Ø± Ù¾Ø±ÙˆÚ˜Ù‡ Ú©Ù¾ÛŒ Ø´ÙˆØ¯ØŸ`;
        if (modal) modal.style.display = 'flex';
      });
    }

    /**
     * saveAudioBlobToDB â€” Ø°Ø®ÛŒØ±Ù‡ Blob ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ Ø¯Ø± IndexedDB (Ù†Ù‡ Base64)
     *
     * Ø§ÛŒÙ† ØªØ§Ø¨Ø¹ Ø¨Ø±Ø§ÛŒ Ø­Ø§Ù„ØªÛŒ Ù‡Ø³Øª Ú©Ù‡ Ú©Ø§Ø±Ø¨Ø± Â«Ù†Ù‡Â» Ù…ÛŒâ€ŒØ²Ù†Ù‡ ÙˆÙ„ÛŒ ÙØ§ÛŒÙ„ Ø¯Ø± Ù…Ø±ÙˆØ±Ú¯Ø± Ù‡Ø³Øª.
     * Ù‚Ø¨Ù„Ø§Ù‹ Ú©Ø¯ showOpenFilePicker Ø±Ùˆ ØµØ¯Ø§ Ù…ÛŒâ€ŒØ²Ø¯ Ùˆ Ø¯ÙˆØ¨Ø§Ø±Ù‡ Ø§Ø² Ú©Ø§Ø±Ø¨Ø± ÙØ§ÛŒÙ„ Ù…ÛŒâ€ŒØ®ÙˆØ§Ø³Øª.
     * Ø­Ø§Ù„Ø§ Ø¨Ù‡â€ŒØ¬Ø§ÛŒ Ø§ÙˆÙ†ØŒ Ù‡Ù…ÙˆÙ† ÙØ§ÛŒÙ„ Ø¯Ø±Ú¯â€ŒØ´Ø¯Ù‡ Ø±Ùˆ Ø¨Ù‡â€ŒØµÙˆØ±Øª Blob Ø¯Ø± IndexedDB Ø°Ø®ÛŒØ±Ù‡ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ….
     * Ø§ÛŒÙ†Ø·ÙˆØ±ÛŒ Ø¨Ø±Ø§ÛŒ Ù„ÙˆØ¯ Ø¨Ø¹Ø¯ÛŒØŒ Ù†ÛŒØ§Ø²ÛŒ Ø¨Ù‡ Ø³ÙˆØ§Ù„ Ø§Ø² Ú©Ø§Ø±Ø¨Ø± Ù†ÛŒØ³Øª.
     *
     * @param {string} bufferKey - Ú©Ù„ÛŒØ¯ ÛŒÚ©ØªØ§ÛŒ Ø¨Ø§ÙØ±
     * @param {File|Blob} file - ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ
     * @param {string} fileName - Ù†Ø§Ù… ÙØ§ÛŒÙ„
     */
    async function saveAudioBlobToDB(bufferKey, file, fileName) {
      try {
        const db = await openAudioDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fileHandles', 'readwrite');
          // Ø°Ø®ÛŒØ±Ù‡ Ø¨Ù‡â€ŒØµÙˆØ±Øª Blob Ø®Ø§Ù… (Ù†Ù‡ Base64) â€” Ø­Ø¬Ù… Ú©Ù…ØªØ± Ùˆ Ù„ÙˆØ¯ Ø³Ø±ÛŒØ¹â€ŒØªØ±
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
     * getAudioBlobFromDB â€” Ø®ÙˆØ§Ù†Ø¯Ù† Blob ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ Ø§Ø² IndexedDB
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
     * saveAudioBlobsForProject â€” Ø°Ø®ÛŒØ±Ù‡ ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ÛŒ ØµÙˆØªÛŒ embedded Ø¯Ø± IndexedDB
     *
     * Ø§Ø³ØªØ±Ø§ØªÚ˜ÛŒ Ø¬Ø¯ÛŒØ¯ (Ø¨Ù‡Ø¨ÙˆØ¯ Ø­Ø¬Ù…):
     *   1. Ø§Ú¯Ø± ÙØ§ÛŒÙ„ Ø§ØµÙ„ÛŒ (Blob) Ø¯Ø± _originalBlob Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯Ù‡ØŒ Ù‡Ù…ÙˆÙ† Ø±Ùˆ Ù…Ø³ØªÙ‚ÛŒÙ… Ø°Ø®ÛŒØ±Ù‡ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ…
     *      (Ø§ÛŒÙ† Ø­Ø§Ù„Øª Ø¨Ù‡ØªØ±ÛŒÙ† Ù‡Ø³Øª Ú†ÙˆÙ† ÙØ§ÛŒÙ„ MP3 Ø§ØµÙ„ÛŒ Ø¨Ø¯ÙˆÙ† ØªØºÛŒÛŒØ± Ø°Ø®ÛŒØ±Ù‡ Ù…ÛŒâ€ŒØ´Ù‡)
     *   2. Ø¯Ø± ØºÛŒØ± Ø§ÛŒÙ† ØµÙˆØ±ØªØŒ AudioBuffer Ø±Ùˆ Ø¨Ù‡ WAV encode Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ… Ùˆ Ø¨Ø§ CompressionStream
     *      ÙØ´Ø±Ø¯Ù‡ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ… (Ø­Ø¯ÙˆØ¯ Ûµ-Û±Û° Ø¨Ø±Ø§Ø¨Ø± Ú©ÙˆÚ†Ú©ØªØ± Ø§Ø² Float32Array Ø®Ø§Ù…)
     *
     * Ù‚Ø¨Ù„Ø§Ù‹ Ø§ÛŒÙ† ØªØ§Ø¨Ø¹ Float32Array Ø®Ø§Ù… Ø±Ùˆ Ø¨Ù‡â€ŒØµÙˆØ±Øª JSON Ø°Ø®ÛŒØ±Ù‡ Ù…ÛŒâ€ŒÚ©Ø±Ø¯ Ú©Ù‡ Ø¨Ø³ÛŒØ§Ø± Ø­Ø¬ÛŒÙ… Ø¨ÙˆØ¯
     * (ÛŒÚ© Ø¢Ù‡Ù†Ú¯ Û³ Ø¯Ù‚ÛŒÙ‚Ù‡â€ŒØ§ÛŒ = ~Û±ÛµÛ° Ù…Ú¯Ø§Ø¨Ø§ÛŒØª).
     */
    async function saveAudioBlobsForProject(projectId) {
      const db = await openAudioDB();
      return new Promise(async (resolve, reject) => {
        const tx = db.transaction('audioBlobs', 'readwrite');
        const store = tx.objectStore('audioBlobs');

        // ÙÙ‚Ø· Ú©Ù„ÛŒÙ¾â€ŒÙ‡Ø§ÛŒÛŒ Ú©Ù‡ _embedded:true Ø¯Ø§Ø±Ù†Ø¯ Ø°Ø®ÛŒØ±Ù‡ Ù…ÛŒØ´ÙˆÙ†Ø¯
        const embeddedClips = DAW.clips.filter(c =>
          c.type !== 'chord' && c.bufferKey && c._embedded
        );

        // First clear old data for this project
        store.delete(projectId);

        if (embeddedClips.length === 0) { resolve(); return; }

        // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 1: Ø°Ø®ÛŒØ±Ù‡ Blob Ù‡Ø§ÛŒ Ø§ØµÙ„ÛŒ (Ø§Ú¯Ù‡ Ù…ÙˆØ¬ÙˆØ¯ Ø¨Ø§Ø´Ù†) â”€â”€â”€
        // Ø§ÛŒÙ† fast path Ù‡Ø³Øª â€” Ø§Ú¯Ù‡ ÙØ§ÛŒÙ„ MP3 Ø§ØµÙ„ÛŒ Ø±Ùˆ Ø¯Ø§Ø±ÛŒÙ…ØŒ Ù‡Ù…ÙˆÙ† Ø±Ùˆ Ø°Ø®ÛŒØ±Ù‡ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ…
        const allBlobs = [];
        for (const clip of embeddedClips) {
          const key = clip.bufferKey;
          const buffer = DAW.bufferCache.get(key);
          if (!buffer) continue;

          // Ø§Ú¯Ù‡ Blob Ø§ØµÙ„ÛŒ Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯Ù‡ØŒ Ø§Ø² Ø§ÙˆÙ† Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù†
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
            // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 2: encode Ø¨Ù‡ WAV Ùˆ ÙØ´Ø±Ø¯Ù‡â€ŒØ³Ø§Ø²ÛŒ â”€â”€â”€
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
              console.log(`[Audio Save] Saved WAV+deflate: ${clip.fileName} (raw=${(wavBytes.length/1024/1024).toFixed(2)}MB â†’ compressed=${(compressedBlob.size/1024/1024).toFixed(2)}MB)`);
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
     * compressBytes â€” ÙØ´Ø±Ø¯Ù‡â€ŒØ³Ø§Ø²ÛŒ Uint8Array Ø¨Ø§ CompressionStream (deflate)
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
        // fallback: Ø¨Ø¯ÙˆÙ† ÙØ´Ø±Ø¯Ù‡â€ŒØ³Ø§Ø²ÛŒ
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
                // â”€â”€â”€ ÙØ±Ù…Øª Ø¬Ø¯ÛŒØ¯: Blob Ø§ØµÙ„ÛŒ (MP3, WAV, etc.) â”€â”€â”€
                const arrayBuffer = await entry.blob.arrayBuffer();
                buffer = await DAW.audioCtx.decodeAudioData(arrayBuffer);
                console.log(`[Audio Load] Loaded blob: ${entry.fileName}`);
              } else if (entry.format === 'wav-deflate' && entry.blob) {
                // â”€â”€â”€ ÙØ±Ù…Øª Ø¬Ø¯ÛŒØ¯: WAV ÙØ´Ø±Ø¯Ù‡â€ŒØ´Ø¯Ù‡ Ø¨Ø§ deflate â”€â”€â”€
                const compressedBytes = new Uint8Array(await entry.blob.arrayBuffer());
                const wavBytes = await decompressBytes(compressedBytes);
                const wavBlob = new Blob([wavBytes], { type: 'audio/wav' });
                const arrayBuffer = await wavBlob.arrayBuffer();
                buffer = await DAW.audioCtx.decodeAudioData(arrayBuffer);
                console.log(`[Audio Load] Loaded WAV+deflate: ${entry.fileName}`);
              } else if (entry.data) {
                // â”€â”€â”€ ÙØ±Ù…Øª Ù‚Ø¯ÛŒÙ…ÛŒ: Float32Array â”€â”€â”€
                const chData = Array.isArray(entry.data) ? entry.data : [entry.data];
                buffer = DAW.audioCtx.createBuffer(chData.length, entry.length, entry.sampleRate);
                chData.forEach((ch, i) => { if (i < buffer.numberOfChannels) buffer.getChannelData(i).set(ch); });
                console.log(`[Audio Load] Loaded legacy Float32: ${entry.key}`);
              }

              if (buffer) {
                DAW.bufferCache.set(entry.key, buffer);
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

    /**
     * restoreAudioForProjectSilently â€” Ù„ÙˆØ¯ Ú©Ø§Ù…Ù„ ØµØ¯Ø§ Ø¨Ø±Ø§ÛŒ Ù¾Ø±ÙˆÚ˜Ù‡ Ø¨Ø¯ÙˆÙ† Ù¾Ø±Ø³Ø´ Ø§Ø² Ú©Ø§Ø±Ø¨Ø±
     *
     * Ø§ÛŒÙ† ØªØ§Ø¨Ø¹ Ù…Ø¹Ø§Ø¯Ù„ edInitSong Ø¨Ø±Ø§ÛŒ Ù„ÙˆØ¯ ØµØ¯Ø§ Ù‡Ø³ØªØŒ ÙˆÙ„ÛŒ:
     *   - Ø¯Ø± arranger Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´Ù‡ (Ú©Ù‡ Ù†Ø¨Ø§ÛŒØ¯ Ø§Ø² Ú©Ø§Ø±Ø¨Ø± Ø³ÙˆØ§Ù„ Ø¨Ù¾Ø±Ø³Ù‡)
     *   - Ø§Ú¯Ø± Ø¯Ø± Ø­Ø§Ù„Øª silent Ø¨Ø§Ø´Ù‡ØŒ showDirectoryPicker ØµØ¯Ø§ Ø²Ø¯Ù‡ Ù†Ù…ÛŒâ€ŒØ´Ù‡
     *
     * ØªØ±ØªÛŒØ¨ Ú†Ú© Ú©Ø±Ø¯Ù† Ù…Ù†Ø§Ø¨Ø¹:
     *   1. IndexedDB (embedded blobs)
     *   2. filePath Ø¯Ø± Electron
     *   3. FileHandle Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ Ø¯Ø± IndexedDB
     *   4. _audioDirHandle Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡
     *   5. (ÙÙ‚Ø· Ø§Ú¯Ø± silent=false) showDirectoryPicker
     *
     * @param {string} projectId - ID Ù¾Ø±ÙˆÚ˜Ù‡ (edCur.id)
     * @param {boolean} silent - Ø§Ú¯Ø± trueØŒ Ø§Ø² showDirectoryPicker Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù†Ú©Ù†
     * @returns {Promise<{loaded:number, missing:number, missingNames:string[]}>}
     */
    async function restoreAudioForProjectSilently(projectId, silent = true) {
      const result = { loaded: 0, missing: 0, missingNames: [] };
      if (!edCur) return result;

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 1: IndexedDB (embedded blobs) â”€â”€â”€
      try {
        await loadAudioBlobsForProject(projectId);
      } catch (e) {
        console.warn('[Audio Restore] IndexedDB load failed:', e);
      }

      // Ø¢Ù¾Ø¯ÛŒØª sourceDuration Ùˆ peaks Ø¨Ø±Ø§ÛŒ Ú©Ù„ÛŒÙ¾â€ŒÙ‡Ø§ÛŒ Ú©Ù‡ Ù„ÙˆØ¯ Ø´Ø¯Ù†
      DAW.clips.forEach(c => {
        if (c.type !== 'chord' && c.bufferKey && DAW.bufferCache.has(c.bufferKey)) {
          const buffer = DAW.bufferCache.get(c.bufferKey);
          if (buffer) {
            c.sourceDuration = buffer.duration;
            c._peaks = peaksFromBuffer(buffer, 2000);
            refreshClipWaveImage(c);
            result.loaded++;
          }
        }
      });

      // Ø§Ú¯Ø± Ù‡Ù…Ù‡ Ú©Ù„ÛŒÙ¾â€ŒÙ‡Ø§ Ù„ÙˆØ¯ Ø´Ø¯Ù†ØŒ Ù†ÛŒØ§Ø² Ø¨Ù‡ Ø¨Ù‚ÛŒÙ‡ Ù…Ø±Ø§Ø­Ù„ Ù†ÛŒØ³Øª
      let missing = DAW.clips.filter(c =>
        c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey)
      );
      if (missing.length === 0) {
        console.log('[Audio Restore] All audio restored from IndexedDB');
        return result;
      }

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 2: filePath Ø¯Ø± Electron â”€â”€â”€
      if (isElectron && window.electronAPI && edCur._audioPaths) {
        for (const ap of edCur._audioPaths) {
          if (!ap.filePath) continue;
          const clip = DAW.clips.find(c =>
            c.type !== 'chord' && c.bufferKey === ap.bufferKey
          );
          if (!clip || DAW.bufferCache.has(clip.bufferKey)) continue;
          try {
            console.log('[Audio Restore] Loading from path:', ap.filePath);
            const audioBuffer = await loadAudioFromHardDrive(ap.filePath);
            DAW.bufferCache.set(clip.bufferKey, audioBuffer);
            clip.sourceDuration = audioBuffer.duration;
            clip._peaks = peaksFromBuffer(audioBuffer, 2000);
            clip._filePath = ap.filePath;
            refreshClipWaveImage(clip);
            result.loaded++;
          } catch (e) {
            console.warn('[Audio Restore] File not found at path:', ap.filePath, e.message);
            // Ø¹Ù„Ø§Ù…Øªâ€ŒÚ¯Ø°Ø§Ø±ÛŒ Ø¨Ù‡â€ŒØ¹Ù†ÙˆØ§Ù† missing ÙˆÙ„ÛŒ Ø§Ø¯Ø§Ù…Ù‡ ÙØ±Ø¢ÛŒÙ†Ø¯
            result.missing++; 
            result.missingNames.push(ap.fileName || ap.bufferKey);
          }
        }
      }

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 3a: Blob Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ Ø¯Ø± IndexedDB (Ø­Ø§Ù„Øª Â«Ù†Ù‡Â» Ø¯Ø± Ù…Ø±ÙˆØ±Ú¯Ø±) â”€â”€â”€
      missing = DAW.clips.filter(c =>
        c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey)
      );
      if (missing.length > 0) {
        for (const clip of missing) {
          try {
            const blobRecord = await getAudioBlobFromDB(clip.bufferKey);
            if (!blobRecord) continue;
            const { buffer } = await decodeFileToBuffer(blobRecord.blob);
            DAW.bufferCache.set(clip.bufferKey, buffer);
            clip.sourceDuration = buffer.duration;
            clip._peaks = peaksFromBuffer(buffer, 2000);
            refreshClipWaveImage(clip);
            result.loaded++;
            console.log('[Audio Restore] Auto-reloaded from Blob:', blobRecord.fileName);
          } catch (e) {
            console.warn('[Audio Restore] Blob reload failed for', clip.bufferKey, e.message);
          }
        }
      }

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 3b: FileHandle Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ Ø¯Ø± IndexedDB (Ù…Ø±ÙˆØ±Ú¯Ø± Ù‚Ø¯ÛŒÙ…ÛŒ) â”€â”€â”€
      missing = DAW.clips.filter(c =>
        c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey)
      );
      if (missing.length > 0) {
        for (const clip of missing) {
          try {
            const handle = await getFileHandle(clip.bufferKey);
            if (!handle) continue;
            if (handle.requestPermission) {
              const perm = await handle.requestPermission({ mode: 'read' });
              if (perm !== 'granted') continue;
              const file = await handle.getFile();
              const { buffer } = await decodeFileToBuffer(file);
              DAW.bufferCache.set(clip.bufferKey, buffer);
              clip.sourceDuration = buffer.duration;
              clip._peaks = peaksFromBuffer(buffer, 2000);
              refreshClipWaveImage(clip);
              result.loaded++;
              console.log('[Audio Restore] Auto-reloaded from FileHandle:', clip.fileName);
            }
          } catch (e) {
            console.warn('[Audio Restore] FileHandle reload failed for', clip.bufferKey, e.message);
          }
        }
      }

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 4: _audioDirHandle Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ â”€â”€â”€
      missing = DAW.clips.filter(c =>
        c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey)
      );
      if (missing.length > 0 && edCur._audioPaths) {
        let dirHandle = _audioDirHandle;
        if (!dirHandle) {
          try { await loadDirHandle(); dirHandle = _audioDirHandle; } catch (_) {}
        }
        if (dirHandle) {
          try {
            const perm = await dirHandle.requestPermission({ mode: 'read' });
            if (perm === 'granted') {
              for (const ap of edCur._audioPaths) {
                const clip = DAW.clips.find(c =>
                  c.type !== 'chord' && c.bufferKey === ap.bufferKey
                );
                if (!clip || DAW.bufferCache.has(clip.bufferKey)) continue;
                const candidates = [
                  ap.fileName,
                  ap.fileName ? ap.fileName.replace(/\.[^.]+$/, '') : ''
                ];
                for (const name of candidates) {
                  if (!name) continue;
                  try {
                    const fileHandle = await dirHandle.getFileHandle(name);
                    const file = await fileHandle.getFile();
                    const { buffer } = await decodeFileToBuffer(file);
                    DAW.bufferCache.set(clip.bufferKey, buffer);
                    clip.sourceDuration = buffer.duration;
                    clip._peaks = peaksFromBuffer(buffer, 2000);
                    refreshClipWaveImage(clip);
                    result.loaded++;
                    break;
                  } catch (_) {}
                }
              }
            }
          } catch (_) {}
        }
      }

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 5: (ÙÙ‚Ø· ØºÛŒØ±-silent) showDirectoryPicker â”€â”€â”€
      if (!silent) {
        missing = DAW.clips.filter(c =>
          c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey)
        );
        if (missing.length > 0 && !isElectron && window.showDirectoryPicker) {
          try {
            const newDirHandle = await window.showDirectoryPicker({ mode: 'read' });
            await saveDirHandle(newDirHandle);
            const perm = await newDirHandle.requestPermission({ mode: 'read' });
            if (perm === 'granted') {
              for (const ap of edCur._audioPaths) {
                const clip = DAW.clips.find(c =>
                  c.type !== 'chord' && c.bufferKey === ap.bufferKey
                );
                if (!clip || DAW.bufferCache.has(clip.bufferKey)) continue;
                for (const n of [
                  ap.fileName,
                  ap.fileName ? ap.fileName.replace(/\.[^.]+$/, '') : ''
                ]) {
                  if (!n) continue;
                  try {
                    const fh = await newDirHandle.getFileHandle(n);
                    const f = await fh.getFile();
                    const { buffer } = await decodeFileToBuffer(f);
                    DAW.bufferCache.set(clip.bufferKey, buffer);
                    clip.sourceDuration = buffer.duration;
                    clip._peaks = peaksFromBuffer(buffer, 2000);
                    refreshClipWaveImage(clip);
                    result.loaded++;
                    break;
                  } catch (_) {}
                }
              }
            }
          } catch (_) { /* Ú©Ø§Ø±Ø¨Ø± Ú©Ù†Ø³Ù„ Ú©Ø±Ø¯ */ }
        }
      }

      // â”€â”€â”€ Ú¯Ø²Ø§Ø±Ø´ Ù†Ù‡Ø§ÛŒÛŒ â”€â”€â”€
      const finalMissing = DAW.clips.filter(c =>
        c.type !== 'chord' && c.bufferKey && !DAW.bufferCache.has(c.bufferKey)
      );
      result.missing = finalMissing.length;
      result.missingNames = finalMissing.map(c => c.fileName || c.bufferKey);
      if (finalMissing.length > 0) {
        console.warn(`[Audio Restore] ${finalMissing.length} clip(s) still missing:`, result.missingNames);
      } else {
        console.log(`[Audio Restore] All audio restored. Loaded: ${result.loaded}`);
      }
      return result;
    }

    /**
     * preloadAudioForSong â€” Ù„ÙˆØ¯ Ú©Ø§Ù…Ù„ ØµØ¯Ø§ Ø¨Ø±Ø§ÛŒ ÛŒÚ© Ø¢Ù‡Ù†Ú¯ Ù…Ø´Ø®ØµØŒ Ø¨Ø¯ÙˆÙ† Ø¯Ø³Øª Ø²Ø¯Ù† Ø¨Ù‡ DAW.clips ÛŒØ§ edCur
     *
     * Ø§ÛŒÙ† ØªØ§Ø¨Ø¹ Ø¨Ø±Ø§ÛŒ preload Ø¢Ù‡Ù†Ú¯ Ø¨Ø¹Ø¯ÛŒ Ø¯Ø± Ø§Ø±Ù†Ø¬Ø± Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´Ù‡.
     * Ø¨Ø±Ø®Ù„Ø§Ù restoreAudioForProjectSilentlyØŒ Ø§ÛŒÙ† ØªØ§Ø¨Ø¹ Ù…Ø³ØªÙ‚Ù„ Ø§Ø² DAW.clips Ø¹Ù…Ù„ Ù…ÛŒâ€ŒÚ©Ù†Ù‡
     * Ùˆ Ù…Ø³ØªÙ‚ÛŒÙ…Ø§Ù‹ Ø§Ø² clips Ø¯Ø§Ø®Ù„ songData Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù…ÛŒâ€ŒÚ©Ù†Ù‡.
     *
     * @param {Object} songData - Ø¯Ø§Ø¯Ù‡â€ŒÙ‡Ø§ÛŒ Ø¢Ù‡Ù†Ú¯ (Ø´Ø§Ù…Ù„ _dawClips, _audioPaths, id)
     * @returns {Promise<{loaded:number, missing:number, missingNames:string[]}>}
     */
    async function preloadAudioForSong(songData) {
      const result = { loaded: 0, missing: 0, missingNames: [] };
      if (!songData) return result;

      const clips = songData._dawClips || [];
      const audioPaths = songData._audioPaths || [];

      // Ø³Ø§Ø®Øª lookup: bufferKey â†’ clip (ÙÙ‚Ø· Ú©Ù„ÛŒÙ¾â€ŒÙ‡Ø§ÛŒ ØµÙˆØªÛŒ)
      const clipsByBufferKey = new Map();
      for (const clip of clips) {
        if (clip.type !== 'chord' && clip.bufferKey) {
          clipsByBufferKey.set(clip.bufferKey, clip);
        }
      }

      if (clipsByBufferKey.size === 0) {
        console.log('[Preload] No audio clips in song:', songData.title || songData.id);
        return result;
      }

      // Ø´Ù…Ø§Ø±Ø´ Ú©Ù„ÛŒÙ¾â€ŒÙ‡Ø§ÛŒÛŒ Ú©Ù‡ Ù‚Ø¨Ù„Ø§Ù‹ Ù„ÙˆØ¯ Ø´Ø¯Ù†
      let missingCount = 0;
      for (const [bufferKey, clip] of clipsByBufferKey) {
        if (DAW.bufferCache.has(bufferKey)) {
          result.loaded++;
        } else {
          missingCount++;
        }
      }

      if (missingCount === 0) {
        console.log(`[Preload] All ${result.loaded} clip(s) already cached for: ${songData.title || songData.id}`);
        return result;
      }

      console.log(`[Preload] Loading ${missingCount} audio clip(s) for: ${songData.title || songData.id}`);

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 1: IndexedDB (embedded blobs) â”€â”€â”€
      try {
        await loadAudioBlobsForProject(songData.id);
      } catch (e) {
        console.warn('[Preload] IndexedDB load failed:', e);
      }

      // Ø¨Ø±Ø±Ø³ÛŒ Ù…Ø¬Ø¯Ø¯: Ú†Ù‡ Ú©Ù„ÛŒÙ¾â€ŒÙ‡Ø§ÛŒÛŒ Ù‡Ù†ÙˆØ² Ú¯Ù… Ø´Ø¯Ù†
      let stillMissing = [...clipsByBufferKey.entries()].filter(([k]) => !DAW.bufferCache.has(k));

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 2: filePath Ø¯Ø± Electron â”€â”€â”€
      if (stillMissing.length > 0 && isElectron && window.electronAPI && audioPaths.length > 0) {
        for (const ap of audioPaths) {
          if (!ap.filePath) continue;
          const clip = clipsByBufferKey.get(ap.bufferKey);
          if (!clip || DAW.bufferCache.has(ap.bufferKey)) continue;
          try {
            console.log('[Preload] Loading from path:', ap.filePath);
            const audioBuffer = await loadAudioFromHardDrive(ap.filePath);
            DAW.bufferCache.set(ap.bufferKey, audioBuffer);
            result.loaded++;
          } catch (e) {
            console.warn('[Preload] File not found at path:', ap.filePath, e.message);
            result.missing++;
            result.missingNames.push(ap.fileName || ap.bufferKey);
          }
        }
        stillMissing = [...clipsByBufferKey.entries()].filter(([k]) => !DAW.bufferCache.has(k));
      }

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 3a: Blob Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ Ø¯Ø± IndexedDB (Ø­Ø§Ù„Øª Â«Ù†Ù‡Â» Ø¯Ø± Ù…Ø±ÙˆØ±Ú¯Ø±) â”€â”€â”€
      if (stillMissing.length > 0) {
        for (const [bufferKey, clip] of stillMissing) {
          try {
            const blobRecord = await getAudioBlobFromDB(bufferKey);
            if (!blobRecord) continue;
            const { buffer } = await decodeFileToBuffer(blobRecord.blob);
            DAW.bufferCache.set(bufferKey, buffer);
            result.loaded++;
            console.log('[Preload] Auto-reloaded from Blob:', blobRecord.fileName);
          } catch (e) {
            console.warn('[Preload] Blob reload failed for', bufferKey, e.message);
          }
        }
        stillMissing = [...clipsByBufferKey.entries()].filter(([k]) => !DAW.bufferCache.has(k));
      }

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 3b: FileHandle Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ Ø¯Ø± IndexedDB (Ù…Ø±ÙˆØ±Ú¯Ø± Ù‚Ø¯ÛŒÙ…ÛŒ) â”€â”€â”€
      if (stillMissing.length > 0) {
        for (const [bufferKey, clip] of stillMissing) {
          try {
            const handle = await getFileHandle(bufferKey);
            if (!handle) continue;
            // Ø§Ú¯Ø± handle ÛŒÚ© FileSystemFileHandle Ù‡Ø³Øª
            if (handle.requestPermission) {
              const perm = await handle.requestPermission({ mode: 'read' });
              if (perm !== 'granted') continue;
              const file = await handle.getFile();
              const { buffer } = await decodeFileToBuffer(file);
              DAW.bufferCache.set(bufferKey, buffer);
              result.loaded++;
              console.log('[Preload] Auto-reloaded from FileHandle:', clip.fileName);
            }
          } catch (e) {
            console.warn('[Preload] FileHandle reload failed for', bufferKey, e.message);
          }
        }
        stillMissing = [...clipsByBufferKey.entries()].filter(([k]) => !DAW.bufferCache.has(k));
      }

      // â”€â”€â”€ Ù…Ø±Ø­Ù„Ù‡ 4: _audioDirHandle Ø°Ø®ÛŒØ±Ù‡â€ŒØ´Ø¯Ù‡ â”€â”€â”€
      if (stillMissing.length > 0 && audioPaths.length > 0) {
        let dirHandle = _audioDirHandle;
        if (!dirHandle) {
          try { await loadDirHandle(); dirHandle = _audioDirHandle; } catch (_) {}
        }
        if (dirHandle) {
          try {
            const perm = await dirHandle.requestPermission({ mode: 'read' });
            if (perm === 'granted') {
              for (const ap of audioPaths) {
                const clip = clipsByBufferKey.get(ap.bufferKey);
                if (!clip || DAW.bufferCache.has(ap.bufferKey)) continue;
                const candidates = [
                  ap.fileName,
                  ap.fileName ? ap.fileName.replace(/\.[^.]+$/, '') : ''
                ];
                for (const name of candidates) {
                  if (!name) continue;
                  try {
                    const fileHandle = await dirHandle.getFileHandle(name);
                    const file = await fileHandle.getFile();
                    const { buffer } = await decodeFileToBuffer(file);
                    DAW.bufferCache.set(ap.bufferKey, buffer);
                    result.loaded++;
                    break;
                  } catch (_) {}
                }
              }
            }
          } catch (_) {}
        }
      }

      // â”€â”€â”€ Ú¯Ø²Ø§Ø±Ø´ Ù†Ù‡Ø§ÛŒÛŒ â”€â”€â”€
      const finalMissing = [...clipsByBufferKey.entries()].filter(([k]) => !DAW.bufferCache.has(k));
      result.missing = finalMissing.length;
      result.missingNames = finalMissing.map(([k, c]) => c.fileName || k);

      if (finalMissing.length > 0) {
        console.warn(`[Preload] ${finalMissing.length} clip(s) still missing for "${songData.title}":`, result.missingNames);
      } else {
        console.log(`[Preload] âœ“ All audio loaded for "${songData.title}". Total cached: ${result.loaded}`);
      }
      return result;
    }

    // ===== AUDIO BACKUP & RECOVERY =====
    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Fast base64 encode for Uint8Array
    function uint8ToBase64(uint8Arr) {
      const chunkSize = 65536;
      let binary = '';
      for (let i = 0; i < uint8Arr.length; i += chunkSize) {
        const chunk = uint8Arr.subarray(i, Math.min(i + chunkSize, uint8Arr.length));
        binary += String.fromCharCode.apply(null, chunk);
      }
      return btoa(binary);
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

    // ===== Audio encoding via OfflineAudioContext (instant, no real-time wait) =====
    async function encodeAudioToWebM(buffer, bitrate) {
      // Use OfflineAudioContext for instant offline rendering (no real-time delay)
      const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      const src = offlineCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(offlineCtx.destination);
      src.start(0);
      const rendered = await offlineCtx.startRendering();
      // Convert rendered buffer to WAV (fast, reliable, no MediaRecorder needed)
      return audioBufferToWav(rendered);
    }

    function audioBufferToWav(buffer) {
      const numCh = buffer.numberOfChannels;
      const sr = buffer.sampleRate;
      const length = buffer.length;
      const bytesPerSample = 2;
      const blockAlign = numCh * bytesPerSample;
      const dataSize = length * blockAlign;
      const headerSize = 44;
      const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
      const view = new DataView(arrayBuffer);
      const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numCh, true);
      view.setUint32(24, sr, true);
      view.setUint32(28, sr * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, dataSize, true);
      let offset = 44;
      for (let ch = 0; ch < numCh; ch++) {
        const channelData = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          const sample = Math.max(-1, Math.min(1, channelData[i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
          offset += 2;
        }
      }
      return new Uint8Array(arrayBuffer);
    }

    async function decodeWebMToBuffer(webmUint8) {
      const blob = new Blob([webmUint8], { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      try {
        ensureAudioCtx();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await DAW.audioCtx.decodeAudioData(arrayBuffer);
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
          txt.innerHTML = `Ù…Ø¬Ù…ÙˆØ¹: ${formatBytes(usageBytes)} / ${formatBytes(quotaBytes)} (${pct.toFixed(1)}%)` +
            (audioCount > 0 ? `<br>ØµØ¯Ø§: ${audioCount} ÙØ§ÛŒÙ„ Â· ${formatBytes(audioBytes)}` : '<br>ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ Ø°Ø®ÛŒØ±Ù‡ Ù†Ø´Ø¯Ù‡');
        }

        // Warn if near limit
        if (pct > 85) {
          toast('âš ï¸ Ø­Ø§ÙØ¸Ù‡ Ù…Ø±ÙˆØ±Ú¯Ø± Ù¾Ø± Ø§Ø³Øª! Ø®Ø±ÙˆØ¬ÛŒ Ú©Ø§Ù…Ù„ Ø¨Ú¯ÛŒØ±ÛŒØ¯');
        }
      } catch(e) { console.warn('Storage info error:', e); }
    }

    async function edExportProjectFull() {
      if (!edCur) { toast('ØªØ±Ø§Ù†Ù‡â€ŒØ§ÛŒ Ø¨Ø§Ø² Ù†ÛŒØ³Øª'); return; }
      try {
      SongMetadata.syncFromDom(edCur, {includeKey: false});

      edCur._dawTracks = DAW.tracks.map(tr => ({
        id: tr.id, name: tr.name, icon: tr.icon, muted: tr.muted,
        solo: tr.solo, vol: tr.vol, pan: tr.pan, type: tr.type, transpose: tr.transpose || 0, laneHeight: tr.laneHeight || null
      }));
      edCur._dawClips = DAW.clips.map(c => {
        const cp = { ...c }; delete cp._peaks; delete cp.waveUrl; delete cp._fileHandle; delete cp._originalBlob;
        return cp;
      });
      edCur._dawSections = (DAW.sections || []).map(s => ({ ...s }));
      edCur._dawLoop = { loopEnabled: DAW.loopEnabled, loopA: DAW.loopA, loopB: DAW.loopB };
      // Ø¯Ø± Ù†Ø³Ø®Ù‡ Ù†ØµØ¨ÛŒØŒ ØµØ¯Ø§ Ø¯Ø§Ø®Ù„ ÙØ§ÛŒÙ„ Ù¾Ø±ÙˆÚ˜Ù‡ Ø°Ø®ÛŒØ±Ù‡ Ù†Ù…ÛŒâ€ŒØ´ÙˆØ¯
      if (isElectron) edCur._embeddedAudio = {};

      // ÙÙ‚Ø· Ú©Ù„ÛŒÙ¾â€ŒÙ‡Ø§ÛŒ Ú©Ù¾ÛŒâ€ŒØ´Ø¯Ù‡ (_embedded:true) Ø±Ù…Ø²Ú¯Ø°Ø§Ø±ÛŒ Ø¨Ø´Ù†
      const audioData = {};
      const audioClips = DAW.clips.filter(c => c.type !== 'chord' && c.bufferKey && c._embedded);
      if (audioClips.length > 0) {
        let idx = 0;
        for (const clip of audioClips) {
          const buffer = DAW.bufferCache.get(clip.bufferKey);
          if (!buffer) continue;
          idx++;
          toast(`Ø±Ù…Ø²Ú¯Ø°Ø§Ø±ÛŒ ØµØ¯Ø§ ${idx}/${audioClips.length}...`);
          try {
            const encoded = await encodeAudioToWebM(buffer, 128000);
            audioData[clip.bufferKey] = { format: 'wav', data: uint8ToBase64(encoded) };
          } catch(e) {
            console.warn('WAV encode failed, using fallback:', e);
            try {
              const channels = [];
              for (let i = 0; i < buffer.numberOfChannels; i++) {
                channels.push(uint8ToBase64(new Uint8Array(buffer.getChannelData(i).buffer)));
              }
              audioData[clip.bufferKey] = { format: 'float32-b64', sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, length: buffer.length, data: channels };
            } catch(e2) { console.warn('Fallback encode also failed:', e2); }
          }
        }
      }
      edCur._embeddedAudio = audioData;

      const linkedCount = DAW.clips.filter(c => c.type !== 'chord' && c.bufferKey && !c._embedded).length;
      const defaultName = (edCur.title || 'ØªØ±Ø§Ù†Ù‡ Ø¬Ø¯ÛŒØ¯') + ' (Ú©Ø§Ù…Ù„).json';
      const data = JSON.stringify(edCur);
      const blob = new Blob([data], { type: 'application/json' });

      const sizeMB = (blob.size / (1024*1024)).toFixed(1);
      const audioCount = Object.keys(audioData).length;

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: 'ÙØ§ÛŒÙ„ Ù¾Ø±ÙˆÚ˜Ù‡ Ú©Ø§Ù…Ù„', accept: { 'application/json': ['.json'] } }] });
          const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
          toast(`Ø®Ø±ÙˆØ¬ÛŒ Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯ (${sizeMB} MB, ${audioCount} Ú©Ù¾ÛŒ + ${linkedCount} Ù„ÛŒÙ†Ú©)`);
          refreshStorageInfo();
          return;
        } catch (e) { if (e.name === 'AbortError') { toast('Ù„ØºÙˆ Ø´Ø¯'); return; } }
      }
      // Fallback: confirm before download
      const linkedInfo = linkedCount > 0 ? `\nÙ„ÛŒÙ†Ú©â€ŒØ´Ø¯Ù‡: ${linkedCount} ÙØ§ÛŒÙ„ (Ø¨Ø¯ÙˆÙ† ØµØ¯Ø§)` : '';
      if (!confirm(`Ø¯Ø§Ù†Ù„ÙˆØ¯ ÙØ§ÛŒÙ„: ${defaultName}\nØ­Ø¬Ù…: ${sizeMB} MB\nØµØ¯Ø§: ${audioCount} Ú©Ù¾ÛŒâ€ŒØ´Ø¯Ù‡${linkedInfo}\n\nØ°Ø®ÛŒØ±Ù‡ Ø¯Ø± Ù¾ÙˆØ´Ù‡ Ø¯Ø§Ù†Ù„ÙˆØ¯ØŸ`)) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = defaultName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(`Ø®Ø±ÙˆØ¬ÛŒ Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯ (${sizeMB} MB, ${audioCount} Ú©Ù¾ÛŒ + ${linkedCount} Ù„ÛŒÙ†Ú©)`);
      refreshStorageInfo();
      } catch(e) { console.error('Export error:', e); toast('Ø®Ø·Ø§ Ø¯Ø± Ø®Ø±ÙˆØ¬ÛŒ: ' + e.message); }
    }

    async function edSaveSong() {
  if (!edCur) return;

  SongMetadata.syncFromDom(edCur);
  edCur.artistKey = archArtistKey(edCur.artist);

  edCur._dawTracks = DAW.tracks.map(t => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    muted: t.muted,
    solo: t.solo,
    vol: t.vol,
    pan: t.pan,
    type: t.type,
    transpose: t.transpose || 0,
    laneHeight: t.laneHeight || null
  }));

  edCur._dawClips = DAW.clips.map(c => {
    const cp = { ...c };
    delete cp._peaks;
    delete cp.waveUrl;
    delete cp._fileHandle; // ØºÛŒØ±Ù‚Ø§Ø¨Ù„ serialize
    delete cp._originalBlob; // Blob Ø®Ø§Ù… ØºÛŒØ±Ù‚Ø§Ø¨Ù„ serialize
    return cp;
  });

  edCur._dawSections = (DAW.sections || []).map(s => ({ ...s }));

  edCur._dawLoop = { loopEnabled: DAW.loopEnabled, loopA: DAW.loopA, loopB: DAW.loopB };

  // â”€â”€â”€ Ø°Ø®ÛŒØ±Ù‡ Ù…Ø³ÛŒØ± ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ÛŒ ØµÙˆØªÛŒ (Ù…Ù‡Ù… Ø¨Ø±Ø§ÛŒ Ù„ÙˆØ¯ Ù…Ø¬Ø¯Ø¯ Ø¯Ø± Ø§Ù„Ú©ØªØ±ÙˆÙ†) â”€â”€â”€
  edCur._audioPaths = [];
  for (const clip of DAW.clips) {
    if (clip.type === 'chord' || !clip.bufferKey) continue;
    edCur._audioPaths.push({
      bufferKey: clip.bufferKey,
      fileName: clip.fileName || clip.name,
      trackId: clip.trackId,
      filePath: clip._filePath || null
    });
  }

  try {
    localStorage.setItem('ed_current_song', JSON.stringify(edCur));
  } catch (e) {
    console.warn('Project save error:', e);
  }

  // Save heavy audio buffers separately with debounce
  scheduleAudioBlobSave();
  // === Performance Architecture v2: sync after save ===
  if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
  // === Performance Architecture v2: save per-view settings ===
  if (typeof syncViewStylesToEdCur === 'function') syncViewStylesToEdCur();
}



    // ===== ARCHIVE SYSTEM â€” Ù…Ù†ØªÙ‚Ù„â€ŒØ´Ø¯Ù‡ Ø¨Ù‡ js/archive/ArchiveModule.js (Commit 3) =====
    // Ø§Ø¹Ù„Ø§Ù† _audioDirHandle Ø¹Ù…Ø¯Ø§Ù‹ Ø§ÛŒÙ†Ø¬Ø§ Ù…ÛŒâ€ŒÙ…Ø§Ù†Ø¯ Ú†ÙˆÙ† Ù†Ø§Ø­ÛŒÙ‡Ù” Storage (Ø¨Ø§Ù„Ø§ÛŒ ÙØ§ÛŒÙ„) Ø¨Ù‡ Ø¢Ù† Ù†ÛŒØ§Ø² Ø¯Ø§Ø±Ø¯:
    let _audioDirHandle = null;


    function edSyncToolbar() {
      if (!edCur) return;
      const st = edCur.styles;
      if ($('edArtist')) $('edArtist').value = edCur.artist;
      if ($('edTitle')) $('edTitle').value = edCur.title;
      refreshKeyUI();
      if ($('edTextSize')) $('edTextSize').value = st.tSize;
      if ($('edTextColor')) $('edTextColor').value = st.tColor;
      if ($('edTextFont')) $('edTextFont').value = st.tFont;
      if ($('edTextBold')) $('edTextBold').classList.toggle('active', st.tBold);
      if ($('edChordSize')) $('edChordSize').value = st.cSize;
      if ($('edChordColor')) $('edChordColor').value = st.cColor;
      if ($('edChordFont')) $('edChordFont').value = st.cFont;
      ['edAlignRight','edAlignCenter','edAlignLeft'].forEach(b => {
        if ($(b)) $(b).classList.toggle('active', ({right:'edAlignRight',center:'edAlignCenter',left:'edAlignLeft'})[st.align] === b);
      });
      if ($('edTimeSig')) $('edTimeSig').value = edCur.timeSignature || '4/4';
      if ($('edTempo')) $('edTempo').value = edCur.tempo || 120;
      if ($('edGenre')) $('edGenre').value = edCur.genre || '';
    }

    function edRenderEditor(rebuildContent) {
  if (!edCur) return;
  const ed = $('editor');
  if (!ed) return;

  const st = edCur.styles || {};
  if (!edCur.lineColors) edCur.lineColors = [];

  ed.style.fontSize = st.tSize + 'px';
  ed.style.color = st.tColor;
  ed.style.fontFamily = st.tFont;
  ed.style.fontWeight = st.tBold ? 'bold' : 'normal';
  ed.style.textAlign = st.align || 'center';

  const displayKey = edCur.transpose ? (edTransposeKeyName(edCur.originalKey || edCur.key, edCur.transpose) || edCur.key) : edCur.key;
  const keyStr = displayKey + (edCur.keyMode === 'min' ? 'm' : '');
  const sub = [
    edCur.artist,
    edCur.key ? (currentLang === 'fa' ? 'Ú¯Ø§Ù…: ' : 'Key: ') + keyStr : null,
    edCur.transpose
      ? ((currentLang === 'fa' ? 'ØªØ±Ù†Ø³Ù¾ÙˆØ² ' : 'Transpose ') +
         (edCur.transpose > 0 ? '+' : '') + edCur.transpose)
      : null
  ].filter(Boolean).join('  Â·  ');

  if ($('edPrintTitle')) $('edPrintTitle').textContent = edCur.title || t('untitled');
  if ($('edPrintSub')) $('edPrintSub').textContent = sub;

  if (rebuildContent !== false) {
    const frag = document.createDocumentFragment();

    edCur.lyrics.split('\n').forEach((line, li) => {
      const d = document.createElement('div');
      d.className = 'eline';
      d.dir = 'auto';
      d.dataset.lineIndex = li;
      const lineColor = edCur.lineColors[li];
      d.style.fontSize = st.tSize + 'px';
      d.style.color = lineColor || st.tColor;
      d.style.fontFamily = st.tFont;
      d.style.fontWeight = st.tBold ? 'bold' : 'normal';
      d.style.textAlign = st.align || 'center';
      d.textContent = line || '\u200B';
      frag.appendChild(d);
    });

    ed.innerHTML = '';
    ed.appendChild(frag);
  } else {
    ed.querySelectorAll('.eline').forEach((el, li) => {
      const lineColor = edCur.lineColors[li];
      el.style.fontSize = st.tSize + 'px';
      el.style.color = lineColor || st.tColor;
      el.style.fontFamily = st.tFont;
      el.style.fontWeight = st.tBold ? 'bold' : 'normal';
      el.style.textAlign = st.align || 'center';
    });
  }

  edRenderChords();
  // Update song stats panel
  if (edCur) {
    const chordCount = (edCur.chords || []).filter(c => c.name).length;
    const lineCount = (edCur.lyrics || '').split('\n').length;
    if ($('statChordCount')) $('statChordCount').textContent = chordCount;
    if ($('statLineCount')) $('statLineCount').textContent = lineCount;
  }
}


    // -- Chord Rendering --
    function anchorRectIn(editorEl, ch) {
      const lineEl = editorEl.children[ch.lineIndex]; if (!lineEl) return null;
      const segs = []; let total = 0, node;
      const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
      while (node = walker.nextNode()) { segs.push({ node, start: total, len: node.textContent.length }); total += node.textContent.length; }
      if (!segs.length) return null;
      const len = total; const r = document.createRange();
      if (ch.anchorType === 'LineStart') { const s = segs[0]; r.setStart(s.node,0); r.setEnd(s.node,Math.min(1,s.len)); }
      else if (ch.anchorType === 'LineEnd') { const s = segs[segs.length-1]; const p = Math.max(0,s.len-1); r.setStart(s.node,p); r.setEnd(s.node,Math.min(p+1,s.len)); }
      else { const i = Math.min(ch.charIndex, Math.max(0, len-1)); const s = segs.find(sg => i >= sg.start && i < sg.start+sg.len) || segs[segs.length-1]; const local = Math.max(0, i-s.start); r.setStart(s.node, Math.min(local,s.len)); r.setEnd(s.node, Math.min(local+1,s.len)); }
      return { rect: r.getBoundingClientRect(), lineRect: lineEl.getBoundingClientRect(), type: ch.anchorType };
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

    function edSyncBaseChordName(index) {
      if (!edCur || !edCur.chords[index]) return;
      if (!Array.isArray(edCur.baseChordNames)) edCur.baseChordNames = [];
      edCur.baseChordNames[index] = edBaseNameFromDisplayed(edCur.chords[index].name);
    }

    function edRemoveChordAt(index) {
      if (!edCur || index < 0 || index >= edCur.chords.length) return;
      edCur.chords.splice(index, 1);
      if (Array.isArray(edCur.baseChordNames)) edCur.baseChordNames.splice(index, 1);
    }

    function edFilterChordsWithBase(predicate) {
      if (!edCur || !Array.isArray(edCur.chords)) return;
      const baseNames = Array.isArray(edCur.baseChordNames) ? edCur.baseChordNames : [];
      const nextChords = [];
      const nextBaseNames = [];
      edCur.chords.forEach((chord, index) => {
        if (!predicate(chord, index)) return;
        nextChords.push(chord);
        const baseName = baseNames[index];
        nextBaseNames.push(
          typeof baseName === 'string' && (baseName.trim() || !chord?.name)
            ? baseName
            : edBaseNameFromDisplayed(chord?.name || '')
        );
      });
      edCur.chords = nextChords;
      edCur.baseChordNames = nextBaseNames;
    }

    function edEnsureBaseChordNamesAligned() {
      if (!edCur) return [];
      const chords = Array.isArray(edCur.chords) ? edCur.chords : [];
      if (!Array.isArray(edCur.baseChordNames)) edCur.baseChordNames = [];
      if (edCur.baseChordNames.length > chords.length) {
        edCur.baseChordNames.splice(chords.length);
      }
      chords.forEach((ch, index) => {
        const baseName = edCur.baseChordNames[index];
        if (typeof baseName !== 'string' || ((ch?.name || '') && !baseName.trim())) {
          edCur.baseChordNames[index] = edBaseNameFromDisplayed(ch?.name || '');
        }
      });
      return edCur.baseChordNames;
    }

    // ===== Ø¯ÛŒØ²/Ø¨Ù…Ù„/Ø®ÙˆØ¯Ú©Ø§Ø± selector =====
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
      label.textContent = 'Ù†Øª:';
      label.style.cssText = 'font-size:0.7rem;color:var(--text-secondary);';
      const sel = document.createElement('select');
      sel.id = 'edAccidentalSel';
      sel.style.cssText = 'background:#0D1117;color:#E2E8F0;border:1px solid #30363D;border-radius:6px;padding:2px 6px;font-size:0.75rem;cursor:pointer;';
      const opts = [['auto','Ø®ÙˆØ¯Ú©Ø§Ø±'],['sharp','Ø¯ÛŒØ² â™¯'],['flat','Ø¨Ù…Ù„ â™­']];
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
        toast('Ù†Ù…Ø§ÛŒØ´ Ù†Øª: ' + (ED_ACCIDENTAL_PREF === 'sharp' ? 'Ø¯ÛŒØ² â™¯' : ED_ACCIDENTAL_PREF === 'flat' ? 'Ø¨Ù…Ù„ â™­' : 'Ø®ÙˆØ¯Ú©Ø§Ø±'));
      });
      wrap.appendChild(label);
      wrap.appendChild(sel);
      header.appendChild(wrap);
    }

    function edShiftNote(n, semi) {
      if (!n) return n;
      if (typeof window.TransposeService === 'object' && window.TransposeService && typeof window.TransposeService.transposeNote === 'function') {
        return window.TransposeService.transposeNote(n, semi, resolveAccidentalPreference());
      }
      // fallback (legacy) â€” never reachable if sharedEngine loaded first
      const map = NOTE_SEMITONE || {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11};
      if (!(n in map)) return n;
      const sharp = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const idx = (map[n] + semi%12 + 12) % 12;
      const pref = resolveAccidentalPreference();
      if (pref === false) {
        const flat = ED_FLAT_MAP || {1:'Db',3:'Eb',6:'Gb',8:'Ab',10:'Bb'};
        return flat[idx] || sharp[idx];
      }
      if (n.includes('b') && pref !== true) {
        const flat = ED_FLAT_MAP || {1:'Db',3:'Eb',6:'Gb',8:'Ab',10:'Bb'};
        return flat[idx] || sharp[idx];
      }
      return sharp[idx];
    }
    function edTransposeChord(name, semi) {
      if (!semi || !name) return name;
      if (typeof window.TransposeService === 'object' && window.TransposeService && typeof window.TransposeService.transposeChordName === 'function') {
        return window.TransposeService.transposeChordName(name, semi, resolveAccidentalPreference());
      }
      // fallback (legacy)
      return name.split('/').map(part => part.replace(/^([A-G][b#]?)/, (_,root) => edShiftNote(root,semi))).join('/');
    }

    let edRenderChordsToken = 0;

function edRenderChords(immediate) {
  const token = ++edRenderChordsToken;

  const run = () => {
    // Ø§Ú¯Ø± Ø¯Ø± Ø§ÛŒÙ† ÙØ§ØµÙ„Ù‡ ÛŒÚ© render Ø¬Ø¯ÛŒØ¯â€ŒØªØ± Ø¯Ø±Ø®ÙˆØ§Ø³Øª Ø´Ø¯Ù‡ØŒ Ø§ÛŒÙ† ÛŒÚ©ÛŒ Ø±Ø§ Ù†Ø§Ø¯ÛŒØ¯Ù‡ Ø¨Ú¯ÛŒØ±
    if (token !== edRenderChordsToken) return;

    if (!edCur) return;
    const ed = $('editor');
    const layer = $('chordLayer');
    const wrap = $('editorWrap');
    if (!ed || !layer || !wrap) return;

    layer.innerHTML = '';

    // Chord visibility toggle
    if (!edChordsVisible) {
      layer.style.display = 'none';
      return;
    }
    layer.style.display = '';

    const wrapRect = wrap.getBoundingClientRect();
    const scrollTop = wrap.scrollTop;
    const st = edCur.styles || {};
    const cSize = st.cSize || 23;
    const GAP = Math.max(10, cSize * 0.6);
    const cColor = st.cColor || '#e6aa28';
    const isRTL = window.getComputedStyle(ed).direction === 'rtl';
    const MARGIN = 5;

    edCur.chords.forEach((ch, idx) => {
      const a = anchorRectIn(ed, ch);
      if (!a) return;

      const el = document.createElement('span');
      el.className = 'chord';
      el.dataset.idx = idx;
      if (edSelectedChords && edSelectedChords.includes(idx)) {
        el.classList.add('selected');
      }

      let txt = ch.name;

      if (!txt && edSeqChordingActive) {
        const seqIdx = idx - (edCur.chords.length - edSeqPoints.length);
        if (seqIdx >= 0 && seqIdx < edSeqPoints.length) {
          txt = (seqIdx === edSeqCursor) ? '...' : String(seqIdx + 1);
          if (seqIdx === edSeqCursor) el.classList.add('selected');
        }
      }

      if (!txt && !edSeqChordingActive) return;

      el.textContent = txt;
      const chColor = ch.color || cColor;
      el.style.cssText =
        `font-size:${cSize}px;color:${chColor};font-family:${st.cFont || 'JetBrains Mono'};`;

      let x;
      if (ch.anchorType === 'LineStart') {
        x = isRTL ? a.rect.right + MARGIN : a.rect.left - MARGIN;
      } else if (ch.anchorType === 'LineEnd') {
        x = isRTL ? a.rect.left - MARGIN : a.rect.right + MARGIN;
      } else if (ch.anchorType === 'BetweenCharacters') {
        x = a.rect.right;
      } else {
        x = (a.rect.left + a.rect.right) / 2;
      }

      layer.appendChild(el);

      const top =
        a.rect.top - wrapRect.top +
        scrollTop - cSize - GAP;

      el.style.top = top + 'px';
      el.style.left =
        (x - wrapRect.left - el.offsetWidth / 2) + 'px';

      const line = document.createElement('div');
      line.className = 'chord-anchor-line';
      line.style.cssText =
        `background:${cColor};opacity:.6;left:${x - wrapRect.left}px;` +
        `top:${top + cSize}px;height:${Math.max(4, GAP)}px;`;

      layer.appendChild(line);
      edAttachChordDrag(el, idx);
    });

    if (edSeqModeActive) {
      edSeqPoints.forEach((p, idx) => {
        const a = anchorRectIn(ed, p);
        if (!a) return;

        const el = document.createElement('span');
        el.className = 'chord';
        el.textContent = String(idx + 1);
        el.style.cssText =
          `font-size:${cSize}px;color:#999;font-family:${st.cFont || 'JetBrains Mono'};`;

        let x;
        if (p.anchorType === 'LineStart') {
          x = isRTL ? a.rect.right + MARGIN : a.rect.left - MARGIN;
        } else if (p.anchorType === 'LineEnd') {
          x = isRTL ? a.rect.left - MARGIN : a.rect.right + MARGIN;
        } else {
          x = (a.rect.left + a.rect.right) / 2;
        }

        layer.appendChild(el);

        const top =
          a.rect.top - wrapRect.top +
          scrollTop - cSize - GAP;

        el.style.top = top + 'px';
        el.style.left =
          (x - wrapRect.left - el.offsetWidth / 2) + 'px';
      });
    }
  };

  if (immediate) {
    run();
  } else if (document.fonts && document.fonts.ready) {
    document.fonts.ready
      .then(() => requestAnimationFrame(() => requestAnimationFrame(run)))
      .catch(() => requestAnimationFrame(() => requestAnimationFrame(run)));
  } else {
    requestAnimationFrame(() => requestAnimationFrame(run));
  }
  // Sync detached popup if open
  if (_lyricPopup && !_lyricPopup.closed) { setTimeout(() => syncLyricPopup(), 100); }
}



    // -- caret/anchor from mouse position (from file 2) --
    function caretFromPoint(x, y) { if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y); if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) { const r = document.createRange(); r.setStart(p.offsetNode, p.offset); r.collapse(true); return r; } } return null; }

    function anchorFromPoint(x, y) {
      let r = caretFromPoint(x, y);
      if (!r) r = caretFromPoint(x, y + 15);
      if (!r) r = caretFromPoint(x, y + 30);
      let lineEl = null;
      if (r) { let node = r.startContainer; lineEl = (node.nodeType === 3 ? node.parentElement : node)?.closest?.('.eline'); }
      else { const el = document.elementFromPoint(x, y); lineEl = el?.closest?.('.eline'); }
      if (!lineEl) return null;
      const editor = lineEl.closest('#editor');
      if (!editor || editor !== $('editor')) return null;
      const lineIndex = [...editor.children].indexOf(lineEl);
      const text = lineEl.textContent.replace(/\u200B/g,'');
      const isRTL = window.getComputedStyle(lineEl).direction === 'rtl';
      const lineRect = lineEl.getBoundingClientRect();
      if (!text.length) return { lineIndex, charIndex: 0, anchorType: 'LineStart' };
      const firstCharRect = anchorRectIn($('editor'), { lineIndex, charIndex: 0, anchorType: 'OnCharacter' })?.rect;
      const lastCharRect = anchorRectIn($('editor'), { lineIndex, charIndex: text.length-1, anchorType: 'OnCharacter' })?.rect;
      const textLeft = isRTL ? lastCharRect.left : firstCharRect.left;
      const textRight = isRTL ? firstCharRect.right : lastCharRect.right;
      if (x >= textRight && x <= lineRect.right) { return isRTL ? { lineIndex, charIndex: 0, anchorType: 'LineStart' } : { lineIndex, charIndex: text.length, anchorType: 'LineEnd' }; }
      else if (x <= textLeft && x >= lineRect.left) { return isRTL ? { lineIndex, charIndex: text.length, anchorType: 'LineEnd' } : { lineIndex, charIndex: 0, anchorType: 'LineStart' }; }
      else if (x > lineRect.right) { return isRTL ? { lineIndex, charIndex: 0, anchorType: 'LineStart' } : { lineIndex, charIndex: text.length, anchorType: 'LineEnd' }; }
      else if (x < lineRect.left) { return isRTL ? { lineIndex, charIndex: text.length, anchorType: 'LineEnd' } : { lineIndex, charIndex: 0, anchorType: 'LineStart' }; }
      if (!r) return null;
      let node = r.startContainer;
      let charIndex = 0, found = false;
      const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
      let tn;
      while (tn = walker.nextNode()) { if (tn === node) { charIndex += Math.min(r.startOffset, tn.textContent.length); found = true; break; } charIndex += tn.textContent.length; }
      if (!found) charIndex = text.length;
      let anchorType = 'OnCharacter'; if (charIndex <= 0) anchorType = 'LineStart'; else if (charIndex >= text.length) { anchorType = 'LineEnd'; charIndex = text.length; }
      return { lineIndex, charIndex: Math.max(0, Math.min(charIndex, text.length)), anchorType };
    }

    // -- Editor Input --
    function edGetLyricsFromDOM() { return $('editor')?.innerText?.replace(/\u200B/g,'').replace(/\r\n?/g,'\n') || ''; }

    function edRemapAnchors(oldText, newText) {
      if (oldText === newText || !edCur) return;
      // Ù…Ù†Ø·Ù‚ remap Ø¨Ù‡ js/editor/LyricPositionMapper.js Ù…Ù†ØªÙ‚Ù„ Ø´Ø¯Ù‡ Ø§Ø³Øª.
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
    function edClearChordSelection() {
      edSelectedChords = [];
      document.querySelectorAll('.chord')
      .forEach(el => el.classList.remove('selected'));
}

    // -- Chord Selection --
    function edSelectChord(idx, isShift) {
      if (isShift) { const i = edSelectedChords.indexOf(idx); if (i > -1) edSelectedChords.splice(i, 1); else edSelectedChords.push(idx); }
      else { edSelectedChords = [idx]; }
      document.querySelectorAll('.chord').forEach(el => { const cIdx = parseInt(el.dataset.idx); el.classList.toggle('selected', edSelectedChords.includes(cIdx)); });
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



    // Redraw chords on scroll â€” immediate render for smooth sync
    if ($('editorWrap')) {
      let _edScrollRaf = null;
      $('editorWrap').addEventListener('scroll', () => {
        if (!edCur || edChordDragActive) return;
        if (_edScrollRaf) cancelAnimationFrame(_edScrollRaf);
        _edScrollRaf = requestAnimationFrame(() => { _edScrollRaf = null; edRenderChords(true); });
      });
    }

    // -- Chord Drag --
function edAttachChordDrag(el, idx) {
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (edCur && edCur.editorLocked) return;

    window.getSelection()?.removeAllRanges();
    // Blur editor so space bar can play
    if ($('editor')) $('editor').blur();

    e.stopPropagation();
    e.preventDefault();

    if (e.detail === 2) {
      if (edCur && edCur.editorLocked) { toast('ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø± Ù‚ÙÙ„ Ø§Ø³Øª'); return; }
      edOpenChordModal(idx);
      return;
    }

    if (!edSelectedChords.includes(idx))
      edSelectChord(idx, e.shiftKey);

    const isCopy = e.altKey;

        const ch = edCur.chords[idx]; if (!ch) return;
        const startX = e.clientX;
        const snapshots = [];
        edSelectedChords.forEach(i => { const cEl = document.querySelector(`.chord[data-idx="${i}"]`); if (cEl) snapshots.push({ idx: i, el: cEl, origLeft: cEl.offsetLeft }); });
        let dragging = false, rafId = null, pendingDx = 0;
        const move = ev => {
          if (!dragging && Math.abs(ev.clientX - startX) > 3) { dragging = true; edChordDragActive = true; snapshots.forEach(s => { s.el.style.zIndex='10'; s.el.style.opacity='.85'; s.el.style.pointerEvents='none'; }); }
          if (dragging) { pendingDx = ev.clientX - startX; if (!rafId) rafId = requestAnimationFrame(() => { const dx=pendingDx; rafId=null; snapshots.forEach(s => { s.el.style.left=(s.origLeft+dx)+'px'; }); }); }
        };
        const up = ev => {
          document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
          if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
          const wasDrag = dragging; dragging = false; edChordDragActive = false;
          snapshots.forEach(s => { s.el.style.zIndex=''; s.el.style.opacity=''; s.el.style.pointerEvents=''; });
          if (!wasDrag) return;
          const wrapRect = $('editorWrap').getBoundingClientRect();
          if (ev.clientX < wrapRect.left || ev.clientX > wrapRect.right || ev.clientY < wrapRect.top || ev.clientY > wrapRect.bottom) {
            edSelectedChords.sort((a,b)=>b-a).forEach(i => edRemoveChordAt(i)); edSelectedChords = [];
          } else {
            function findNearestChar(lineEl, mouseX) {
              const text = lineEl.textContent.replace(/\u200B/g,''); if (!text.length) return 0;
              let bestChar = 0, bestDist = Infinity, charCount = 0;
              const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT); let node;
              while (node = walker.nextNode()) { for (let j = 0; j < node.textContent.length; j++) { try { const r = document.createRange(); r.setStart(node,j); r.setEnd(node,j+1); const rect = r.getBoundingClientRect(); if (rect.width===0) continue; const dist = Math.abs(mouseX-(rect.left+rect.width/2)); if (dist<bestDist) { bestDist=dist; bestChar=charCount; } } catch(ex) {} charCount++; } }
              return Math.max(0, Math.min(bestChar, text.length));
            }
            let anchorIdx=0, anchorDist=Infinity;
            edSelectedChords.forEach((i,si) => { const c=edCur.chords[i]; if(!c)return; const le=$('editor').children[c.lineIndex]; if(!le)return; const lr=le.getBoundingClientRect(); const midX=lr.left+c.charIndex*(lr.width/Math.max(le.textContent.replace(/\u200B/g,'').length,1)); const d=Math.abs(ev.clientX-midX); if(d<anchorDist){anchorDist=d;anchorIdx=si;} });
            const anchorOrig=edCur.chords[edSelectedChords[anchorIdx]];
            const anchorLine=$('editor').children[anchorOrig.lineIndex];
            const anchorNewChar=findNearestChar(anchorLine, ev.clientX);
            const charDelta=anchorNewChar-anchorOrig.charIndex;
            edSelectedChords.forEach(i => { const c=edCur.chords[i]; if(!c)return; const lineEl=$('editor').children[c.lineIndex]; const textLen=lineEl?lineEl.textContent.replace(/\u200B/g,'').length:0; let newChar=c.charIndex+charDelta; newChar=Math.max(0,Math.min(newChar,textLen)); if(isCopy){edCur.chords.push({lineIndex:c.lineIndex,charIndex:newChar,anchorType:newChar<=0?'LineStart':newChar>=textLen?'LineEnd':'OnCharacter',name:c.name});if(!Array.isArray(edCur.baseChordNames))edCur.baseChordNames=[];edCur.baseChordNames.push(edBaseNameFromDisplayed(c.name));}else{c.charIndex=newChar;c.anchorType=newChar<=0?'LineStart':newChar>=textLen?'LineEnd':'OnCharacter';} });
          }
          edRenderChords();
          edCommit();

        };
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      });
    }
    // Redraw chords on window resize
    window.addEventListener('resize', () => { if (edCur) edRenderChords(); });

    // -- Global Alt key tracker --
    let edAltDown = false;
    window.addEventListener('keydown', e => { if (e.key === 'Alt') edAltDown = true; });
    window.addEventListener('keyup', e => { if (e.key === 'Alt') edAltDown = false; });
    window.addEventListener('blur', () => { edAltDown = false; });

    // -- Mousedown on editorWrap: Alt+Click = add chord --
    if ($('editorWrap')) {
      $('editorWrap').addEventListener('mousedown', e => {
        if (!edCur) return;
        if (edCur.editorLocked && !e.target.closest('.chord')) {
          toast('ðŸ”’ ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø± Ù‚ÙÙ„ Ø§Ø³Øª');
          const btn = $('edEditorLockBtn');
          if (btn) { btn.classList.add('editor-lock-blink'); setTimeout(() => btn.classList.remove('editor-lock-blink'), 2000); }
          return;
        }
        const altHeld = e.altKey || edAltDown;
        if (altHeld) {
          if (edCur.editorLocked) { toast('ðŸ”’ ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø± Ù‚ÙÙ„ Ø§Ø³Øª'); return; }
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
    function edCommit() {
  if (!edCur || isApplyingHistory) return;

  SongMetadata.syncFromDom(edCur, {includeTimeSig: false, includeTempo: false, includeGenre: false});
  edCur.seqPoints = edSeqPoints;

  saveState();
  // === Performance Architecture v2: sync key/transpose ===
  if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
}

function edRestoreSelectionState(state) {
  if (!state) return;

  const editor = $('editor');
  const sel = document.getSelection();
  if (!editor || !sel) return;

  const range = createRangeFromEditorOffsets(editor, state.start, state.end);
  if (!range) return;

  sel.removeAllRanges();
  sel.addRange(range);

  editor.focus();
}




    function edRestore(stateStr) {
  applyState(stateStr);
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


    if ($('edRedoBtn')) {
  $('edRedoBtn').onclick = () => {
    redo();
  };
}

if ($('edRemoveAsterisks')) {
  $('edRemoveAsterisks').onclick = () => {
    if (!edCur || edCur.editorLocked) return;
    const lines = edCur.lyrics.split('\n');
    if (!lines.some(l => l.includes('*'))) {
      toast('Ø³ØªØ§Ø±Ù‡â€ŒØ§ÛŒ Ø¯Ø± Ù…ØªÙ† ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯');
      return;
    }
    // Adjust chord charIndex: for each line, count asterisks before each chord's position
    lines.forEach((line, li) => {
      if (!line.includes('*')) return;
      edCur.chords.forEach(ch => {
        if (ch.lineIndex !== li) return;
        let shift = 0;
        for (let ci = 0; ci < line.length && ci < ch.charIndex; ci++) {
          if (line[ci] === '*') shift++;
        }
        ch.charIndex = Math.max(0, ch.charIndex - shift);
      });
    });
    // Remove asterisks from lyrics
    edCur.lyrics = lines.map(l => l.replace(/\*/g, '')).join('\n');
    edRenderEditor(true);
    edSaveSong();
    toast('ØªÙ…Ø§Ù… Ø³ØªØ§Ø±Ù‡â€ŒÙ‡Ø§ Ø­Ø°Ù Ø´Ø¯Ù†Ø¯');
  };
}

if ($('edReverseChords')) {
  $('edReverseChords').onclick = () => {
    // âš ï¸ Ø§ÛŒÙ† Ø¯Ú©Ù…Ù‡ ÙÙ‚Ø· Ø¨Ø±Ø§ÛŒ Ù…ÙˆØ§Ø±Ø¯ Ø®Ø§Øµ Ø§Ø³Øª Ú©Ù‡ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø¹Ù…Ø¯Ø§Ù‹ Ø¨Ø±Ø¹Ú©Ø³ ÙˆØ§Ø±Ø¯ Ø´Ø¯Ù‡â€ŒØ§Ù†Ø¯
    // Ø¯Ø± Ø­Ø§Ù„Øª Ø¹Ø§Ø¯ÛŒ Ù†Ø¨Ø§ÛŒØ¯ Ø§Ø² Ø§ÛŒÙ† Ø¯Ú©Ù…Ù‡ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ø±Ø¯ Ú†ÙˆÙ† ØªØ±ØªÛŒØ¨ Ù…ÙˆØ³ÛŒÙ‚Ø§ÛŒÛŒ Ø±Ø§ Ø¨Ø±Ø¹Ú©Ø³ Ù…ÛŒâ€ŒÚ©Ù†Ø¯
    if (!edCur || edCur.editorLocked || !edCur.chords.length) {
      toast('Ø¢Ú©ÙˆØ±Ø¯ÛŒ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯');
      return;
    }
    if (!confirm('âš ï¸ Ø¢ÛŒØ§ Ù…Ø·Ù…Ø¦Ù† Ù‡Ø³ØªÛŒØ¯ØŸ Ø§ÛŒÙ† Ú©Ø§Ø± ØªØ±ØªÛŒØ¨ Ù…ÙˆØ³ÛŒÙ‚Ø§ÛŒÛŒ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø±Ø§ Ø¯Ø± Ù‡Ø± Ø®Ø· Ø¨Ø±Ø¹Ú©Ø³ Ù…ÛŒâ€ŒÚ©Ù†Ø¯ Ùˆ ÙÙ‚Ø· Ø¨Ø±Ø§ÛŒ Ù…ÙˆØ§Ø±Ø¯ Ø®Ø§Øµ Ú©Ø§Ø±Ø¨Ø±Ø¯ Ø¯Ø§Ø±Ø¯.')) {
      return;
    }
    // Group chords by line, sort by charIndex, reverse positions
    const byLine = {};
    edCur.chords.forEach((ch, i) => {
      (byLine[ch.lineIndex] = byLine[ch.lineIndex] || []).push({ idx: i, ch });
    });
    Object.values(byLine).forEach(group => {
      if (group.length < 2) return;
      group.sort((a, b) => a.ch.charIndex - b.ch.charIndex);
      // Save target values first (reversed[i].ch are the same objects!)
      const targets = group.map((g, i) => ({
        charIndex: group[group.length - 1 - i].ch.charIndex,
        anchorType: group[group.length - 1 - i].ch.anchorType
      }));
      group.forEach((g, i) => {
        g.ch.charIndex = targets[i].charIndex;
        g.ch.anchorType = targets[i].anchorType;
      });
    });
    edRenderEditor(true);
    edSaveSong();
    toast('ØªØ±ØªÛŒØ¨ Ø¢Ú©ÙˆØ±Ø¯ Ù‡Ø± Ø®Ø· Ø¨Ø±Ø¹Ú©Ø³ Ø´Ø¯ (ÙÙ‚Ø· Ø¨Ø±Ø§ÛŒ Ù…ÙˆØ§Ø±Ø¯ Ø®Ø§Øµ)');
  };
}

if ($('edDoBoth')) {
  $('edDoBoth').onclick = () => {
    if (!edCur || edCur.editorLocked) return;
    // Step 1: Remove asterisks
    const lines = edCur.lyrics.split('\n');
    if (lines.some(l => l.includes('*'))) {
      lines.forEach((line, li) => {
        if (!line.includes('*')) return;
        edCur.chords.forEach(ch => {
          if (ch.lineIndex !== li) return;
          let shift = 0;
          for (let ci = 0; ci < line.length && ci < ch.charIndex; ci++) {
            if (line[ci] === '*') shift++;
          }
          ch.charIndex = Math.max(0, ch.charIndex - shift);
        });
      });
      edCur.lyrics = lines.map(l => l.replace(/\*/g, '')).join('\n');
    }
    // Step 2: Reverse chords
    if (edCur.chords.length) {
      const byLine = {};
      edCur.chords.forEach((ch, i) => {
        (byLine[ch.lineIndex] = byLine[ch.lineIndex] || []).push({ idx: i, ch });
      });
      Object.values(byLine).forEach(group => {
        if (group.length < 2) return;
        group.sort((a, b) => a.ch.charIndex - b.ch.charIndex);
        const targets = group.map((g, i) => ({
          charIndex: group[group.length - 1 - i].ch.charIndex,
          anchorType: group[group.length - 1 - i].ch.anchorType
        }));
        group.forEach((g, i) => {
          g.ch.charIndex = targets[i].charIndex;
          g.ch.anchorType = targets[i].anchorType;
        });
      });
    }
    edRenderEditor(true);
    edSaveSong();
    toast('Ø³ØªØ§Ø±Ù‡â€ŒÙ‡Ø§ Ø­Ø°Ù Ùˆ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø¨Ø±Ø¹Ú©Ø³ Ø´Ø¯Ù†Ø¯');
  };
}


    // -- Chord Version System --
    function ensureChordVersionsInit() {
      if (!edCur) return;
      if (!edCur.chordVersions) edCur.chordVersions = [];
      if (edCur.activeChordVersion === undefined) edCur.activeChordVersion = 0;
      // Auto-save current chords+clips to V1 if no versions exist yet
      if (edCur.chordVersions.length === 0) {
        const chordTrack = DAW.tracks.find(t => t.type === 'chord');
        const clips = chordTrack ? DAW.clips.filter(c => c.type === 'chord' && c.trackId === chordTrack.id) : [];
        edCur.chordVersions.push({
          name: 'V1',
          chords: JSON.parse(JSON.stringify(edCur.chords)),
          clips: JSON.parse(JSON.stringify(clips.map(c => ({ start: c.start, duration: c.duration, color: c.color })))),
          transpose: edCur.transpose || 0,
          key: edCur.key || 'C',
          keyMode: edCur.keyMode || 'maj'
        });
        edCur.activeChordVersion = 0;
      }
    }

    function saveCurrentVersion() {
      if (!edCur || !edCur.chordVersions) return;
      const curVer = edCur.activeChordVersion || 0;
      if (!edCur.chordVersions[curVer]) return;
      edCur.chordVersions[curVer].chords = JSON.parse(JSON.stringify(edCur.chords));
      // Ø°Ø®ÛŒØ±Ù‡ ØªØ±Ù†Ø³Ù¾ÙˆØ² Ùˆ Ú¯Ø§Ù… Ø¨Ù‡â€ŒØµÙˆØ±Øª Ù…Ø³ØªÙ‚Ù„ Ø¨Ø±Ø§ÛŒ Ù‡Ø± ÙˆØ±Ú˜Ù†
      edCur.chordVersions[curVer].transpose = edCur.transpose || 0;
      edCur.chordVersions[curVer].key = edCur.key || 'C';
      edCur.chordVersions[curVer].keyMode = edCur.keyMode || 'maj';
      // Also save timeline clip positions
      const chordTrack = DAW.tracks.find(t => t.type === 'chord');
      if (chordTrack) {
        const clips = DAW.clips.filter(c => c.type === 'chord' && c.trackId === chordTrack.id);
        edCur.chordVersions[curVer].clips = JSON.parse(JSON.stringify(clips.map(c => ({ start: c.start, duration: c.duration, color: c.color, name: c.name }))));
      }
    }

    function loadVersionToTimeline(verIdx) {
      if (!edCur || !edCur.chordVersions[verIdx]) return;
      const ver = edCur.chordVersions[verIdx];
      const chordTrack = DAW.tracks.find(t => t.type === 'chord');
      if (!chordTrack) return;
      // Remove existing chord clips
      DAW.clips = DAW.clips.filter(c => !(c.type === 'chord' && c.trackId === chordTrack.id));
      // Add clips from version snapshot (Ù‡Ø± Ú©Ù„ÛŒÙ¾ Ù†Ø§Ù… Ø®ÙˆØ¯Ø´ Ø±Ø§ Ø¯Ø§Ø±Ø¯)
      const savedClips = Array.isArray(ver.clips) ? ver.clips : [];
      savedClips.forEach((saved, i) => {
        const name = (saved && saved.name) || (ver.chords && ver.chords[i] && ver.chords[i].name) || '';
        if (!name) return;
        const start = saved && saved.start != null ? saved.start : roundMs(i * 2);
        const duration = saved && saved.duration ? saved.duration : 2;
        const color = saved && saved.color ? saved.color : '#9F7AEA';
        DAW.clips.push({ id: uid('c'), type: 'chord', trackId: chordTrack.id, name, start, duration, color });
      });
    }

    function switchChordVersion(dir) {
      if (!edCur) return;
      ensureChordVersionsInit();
      // Save current state first
      saveCurrentVersion();
      // Switch version
      const curVer = edCur.activeChordVersion || 0;
      let newVer = curVer + dir;
      if (newVer < 0) newVer = 0;
      if (newVer >= edCur.chordVersions.length) newVer = edCur.chordVersions.length - 1;
      if (newVer === curVer) { toast('ÙˆØ±Ú˜Ù† ' + (curVer + 1) + ' (Ø¢Ø®Ø±ÛŒÙ†)'); return; }
      // Load target version
      const ver = edCur.chordVersions[newVer];
      edCur.activeChordVersion = newVer;
      edCur.chords = JSON.parse(JSON.stringify(ver.chords || []));
      // Ø¨Ø§Ø²ÛŒØ§Ø¨ÛŒ ØªØ±Ù†Ø³Ù¾ÙˆØ² Ùˆ Ú¯Ø§Ù… Ù…Ø®ØªØµ Ù‡Ù…ÛŒÙ† ÙˆØ±Ú˜Ù†
      edCur.transpose = ver.transpose !== undefined ? ver.transpose : 0;
      if (ver.key) edCur.key = ver.key;
      if (ver.keyMode) edCur.keyMode = ver.keyMode;
      // Rebuild editor + timeline
      edRenderEditor(true);
      loadVersionToTimeline(newVer);
      saveState();
      renderTracks();
      renderClips();
      if (typeof refreshKeyUI === 'function') refreshKeyUI();
      toast('ÙˆØ±Ú˜Ù†: ' + (ver.name || 'V' + (newVer + 1)));
    }

    function addChordVersion() {
      if (!edCur) return;
      ensureChordVersionsInit();
      if (edCur.chordVersions.length >= 10) { toast('Ø­Ø¯Ø§Ú©Ø«Ø± Û±Û° ÙˆØ±Ú˜Ù†'); return; }
      // Save current state
      saveCurrentVersion();
      // Create new empty version
      const newVer = edCur.chordVersions.length;
      edCur.chordVersions.push({ name: 'V' + (newVer + 1), chords: [], clips: [], transpose: edCur.transpose || 0, key: edCur.key || 'C', keyMode: edCur.keyMode || 'maj' });
      edCur.activeChordVersion = newVer;
      edCur.chords = [];
      // Clear timeline chord clips
      const chordTrack = DAW.tracks.find(t => t.type === 'chord');
      if (chordTrack) DAW.clips = DAW.clips.filter(c => !(c.type === 'chord' && c.trackId === chordTrack.id));
      edRenderEditor(true);
      saveState();
      renderTracks();
      renderClips();
      toast('ÙˆØ±Ú˜Ù† Ø¬Ø¯ÛŒØ¯: V' + (newVer + 1));
    }

    async function renameChordVersion() {
      if (!edCur || !edCur.chordVersions) return;
      const curVer = edCur.activeChordVersion || 0;
      const ver = edCur.chordVersions[curVer];
      if (!ver) return;
      const newName = await customPrompt('Ù†Ø§Ù… ÙˆØ±Ú˜Ù†:', ver.name || 'V' + (curVer + 1));
      if (newName !== null && newName.trim()) {
        ver.name = newName.trim();
        saveState();
        renderTracks();
        toast('Ù†Ø§Ù… ÙˆØ±Ú˜Ù†: ' + ver.name);
      }
    }

    // -- Sync transpose/key changes to timeline chord clips --
    function syncTransposeToTimelineChords() {
      if (!edCur) return;
      const chordTrack = DAW.tracks.find(t => t.type === 'chord');
      if (!chordTrack) return;
      // Only update existing timeline chord clips in place (never add/remove)
      const existingClips = DAW.clips.filter(c => c.type === 'chord' && c.trackId === chordTrack.id);
      // Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø¯Ø± edCur.chords Ø¨Ù‡ ØªØ±ØªÛŒØ¨ Ù…ÙˆØ³ÛŒÙ‚Ø§ÛŒÛŒ Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯Ù‡â€ŒØ§Ù†Ø¯ (Ø§Ø² Ø¨ÛŒØª Ø§ÙˆÙ„ ØªØ§ Ø¢Ø®Ø±)
      // Chord Line ÙÙ‚Ø· Ø¬Ù‡Øª Ù†Ù…Ø§ÛŒØ´ LTR Ø¯Ø§Ø±Ø¯ â€” ØªØ±ØªÛŒØ¨ Ù…ÙˆØ³ÛŒÙ‚Ø§ÛŒÛŒ Ø¨Ø§ÛŒØ¯ Ø­ÙØ¸ Ø´ÙˆØ¯
      existingClips.forEach((clip, i) => {
        if (i < edCur.chords.length && edCur.chords[i].name) {
          clip.name = edCur.chords[i].name;
        }
      });
      saveState();
      renderClips();
    }
    function edFillCol(el, items, cb) { el.innerHTML = ''; items.forEach(v => { const d = document.createElement('div'); d.className = 'chord-item'; d.textContent = v === '' ? 'â€”' : v; d.onclick = () => { [...el.children].forEach(c => c.classList.remove('active')); d.classList.add('active'); cb(v); updateChordPreview(); }; el.appendChild(d); }); }

    function edOpenChordModal(idx) {
      if (!edCur) return;
      edChordIdx = idx;
      edChordModalMode = 'editor';
      // Set currentChord from existing chord
      if (idx !== null && edCur.chords[idx]) {
        const m = edCur.chords[idx].name.match(/^([A-G][#b]?)(maj|m(?:in)?|dim|aug|sus2|sus4)?(M7|7|9|b9|#9|11|#11|13|6)?(?:\/([A-G][#b]?))?$/);
        if (m) { let tp = m[2] || 'None'; if (tp === 'm') tp = 'min'; currentChord = { root: m[1] || 'None', type: tp, tension: m[3] || '', bass: m[4] || 'None' }; }
        else currentChord = { root: 'None', type: 'None', tension: '', bass: 'None' };
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
      // Ø§Ø¶Ø§ÙÙ‡ Ú©Ø±Ø¯Ù† Ù‡Ù†Ø¯Ù„Ø± Ú©ÛŒØ¨ÙˆØ±Ø¯ Ø¨Ø±Ø§ÛŒ Ø¯Ú©Ù…Ù‡ ESC
      const chordModal = $('chord-modal');
      if (chordModal) {
        // Ø­Ø°Ù Ù‡Ù†Ø¯Ù„Ø± Ù‚Ø¨Ù„ÛŒ Ø§Ú¯Ø± ÙˆØ¬ÙˆØ¯ Ø¯Ø§Ø±Ø¯
        if (chordModal._escHandlerEd) chordModal.removeEventListener('keydown', chordModal._escHandlerEd);
        chordModal._escHandlerEd = (e) => {
          if (e.key === 'Escape' && edChordModalMode === 'editor') {
            e.preventDefault();
            edCloseChordModal();
          }
        };
        chordModal.addEventListener('keydown', chordModal._escHandlerEd);
        // ÙÙˆÚ©ÙˆØ³ Ø±ÙˆÛŒ Ù…ÙˆØ¯Ø§Ù„ Ø¨Ø±Ø§ÛŒ Ø§ÛŒÙ†Ú©Ù‡ ESC Ø¨Ø¯ÙˆÙ† Ú©Ù„ÛŒÚ© Ú©Ø§Ø± Ú©Ù†Ø¯
        chordModal.focus();
      }
    }

    function edCloseChordModal() { $('chord-modal').classList.remove('show'); edPendingAnchor = null; edChordIdx = null; edChordModalMode = null; }
    function edConfirmChord() {
      if (!edCur || edChordModalMode !== 'editor') return;
      let name = ($('chordManual')?.value || '').trim();
      name = name.replace(/^([A-G][#b]?)maj$/, '$1');
      name = name.replace(/^([A-G][#b]?)min/i, '$1m');
      if (!name) { edCloseChordModal(); return; }
      if (edChordIdx !== null && edCur.chords[edChordIdx]) {
        edCur.chords[edChordIdx].name = name;
      } else if (edPendingAnchor) {
        edCur.chords.push({ ...edPendingAnchor, name });
      }
      // Keep baseChordNames in sync with chord edits
      if (!edCur.baseChordNames) edCur.baseChordNames = [];
      if (edChordIdx !== null && edCur.chords[edChordIdx]) {
        edSyncBaseChordName(edChordIdx);
      } else if (edPendingAnchor) {
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
          edSeqPoints = []; edCur.seqPoints = [];
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
    function edTransposeKeyName(key, semitones) {
      if (!key || !semitones) return key;
      if (typeof window.TransposeService === 'object' && window.TransposeService && typeof window.TransposeService.transposeKeyName === 'function') {
        return window.TransposeService.transposeKeyName(key, semitones, resolveAccidentalPreference());
      }
      // fallback (legacy)
      const idx = ED_SEMITONE[key];
      if (idx == null) return key;
      const newIdx = ((idx + semitones) % 12 + 12) % 12;
      const pref = resolveAccidentalPreference();
      if (pref === false) {
        return ED_FLAT_NOTES[newIdx] || ED_NOTES[newIdx];
      }
      if (key.includes('b') && pref !== true) {
        return ED_FLAT_NOTES[newIdx] || ED_NOTES[newIdx];
      }
      return ED_NOTES[newIdx];
    }

    // ===== Convert Accidental Spelling (Ø¯ÛŒØ²/Ø¨Ù…Ù„ toggle) =====
    // Toggles the accidental spelling of ALL current chords WITHOUT changing the key.
    // If chords currently use sharps â†’ convert to flats; if flats â†’ convert to sharps.
    function edToggleAccidental() {
      if (!edCur || edCur.editorLocked) { toast('ðŸ”’ ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø± Ù‚ÙÙ„ Ø§Ø³Øª'); return; }
      const cc = typeof window.TransposeService === 'object' && window.TransposeService &&
        typeof window.TransposeService.convertAccidentals === 'function'
        ? window.TransposeService.convertAccidentals
        : null;
      if (!cc) { toast('Ù…ÙˆØªÙˆØ± Ø¢Ú©ÙˆØ±Ø¯ Ø¯Ø± Ø¯Ø³ØªØ±Ø³ Ù†ÛŒØ³Øª'); return; }

      // Determine current dominant spelling by looking at first accidental chord
      let toFlat = true; // default: convert sharps â†’ flats
      const withAcc = (edCur.chords || []).map(c => c.name || '').filter(n => /[#â™¯]|[bâ™­]/.test(n));
      if (withAcc.length && withAcc.every(n => /[bâ™­]/.test(n))) toFlat = false; // currently flats â†’ to sharp

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
      if (converted === 0) { toast('Ø¢Ú©ÙˆØ±Ø¯ÛŒ Ø¨Ø±Ø§ÛŒ ØªØ¨Ø¯ÛŒÙ„ ÛŒØ§ÙØª Ù†Ø´Ø¯'); return; }
      edRenderChords(true);
      edRenderEditor(false);
      syncTransposeToTimelineChords();
      edSaveSong();
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
      toast(toFlat ? 'Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø¨Ù‡ Ø¨Ù…Ù„ â™­ ØªØ¨Ø¯ÛŒÙ„ Ø´Ø¯Ù†Ø¯ (' + converted + ')' : 'Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø¨Ù‡ Ø¯ÛŒØ² â™¯ ØªØ¨Ø¯ÛŒÙ„ Ø´Ø¯Ù†Ø¯ (' + converted + ')');
    }

    // ===== CENTRAL KEY/TRANSPOSE FUNCTIONS =====
    function keyToSemi(key) { return ED_SEMITONE[key] != null ? ED_SEMITONE[key] : -1; }
    function keyDelta(fromKey, toKey) {
      if (typeof window.TransposeService === 'object' && window.TransposeService && typeof window.TransposeService.keyDelta === 'function') {
        return window.TransposeService.keyDelta(fromKey, toKey);
      }
      return ((keyToSemi(toKey) - keyToSemi(fromKey)) % 12 + 12) % 12;
    }

    // Only modify ch.name in place â€” preserves position, spacing, alignment, everything
    function transposeChordNamesInPlace(chords, semitones) {
      if (!chords || !chords.length || !semitones) return;
      for (const ch of chords) {
        if (ch.name) ch.name = edTransposeChord(ch.name, semitones);
      }
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
        origLabel.textContent = 'ðŸŽµ ' + origKey + (origMode === 'min' ? 'm' : '');
        origLabel.title = 'Ú¯Ø§Ù… Ø§ÙˆØ±Ø¬ÛŒÙ†Ø§Ù„: ' + origKey + (origMode === 'min' ? 'm' : '') + ' | Ú©Ù„ÛŒÚ©=ØªØºÛŒÛŒØ± | Alt+Ú©Ù„ÛŒÚ©=Ø±ÛŒØ³Øª';
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
      if (!edCur || edCur.editorLocked) return;
      const names = edEnsureBaseChordNamesAligned();
      edCur.chords.forEach((ch, i) => {
        const baseName = (i < names.length) ? names[i] : ch.name;
        if (baseName) ch.name = edTransposeChord(baseName, newTranspose);
      });
      edCur.transpose = newTranspose;
      edCur.key = edTransposeKeyName(edCur.originalKey || edCur.key, newTranspose) || edCur.key;
      edCur.keyMode = edCur.keyMode || 'maj';
      // Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ ØªØ±Ù†Ø³Ù¾Ø² Ø¨Ø§ ÙˆØ±Ú˜Ù† ÙØ¹Ø§Ù„ ÙØ¹Ù„ÛŒ
      if (typeof saveCurrentVersion === 'function') saveCurrentVersion();
      refreshKeyUI();
      renderAllChordsAndText();
      edSaveSong();
      // === Performance Architecture v2: sync transpose immediately ===
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
    }

    // KEY CHANGE: only modify chord names in current state (from baseChordNames)
    function applyKeyChange(newKey, newMode) {
      if (!edCur || edCur.editorLocked) return;
      const origKey = edCur.originalKey || edCur.key;
      const delta = keyDelta(origKey, newKey);
      // Restore original names first, then apply new key
      const names = edEnsureBaseChordNamesAligned();
      edCur.chords.forEach((ch, i) => {
        const baseName = (i < names.length) ? names[i] : ch.name;
        if (baseName) ch.name = edTransposeChord(baseName, delta);
      });
      edCur.key = newKey;
      edCur.keyMode = newMode;
      edCur.transpose = 0;
      refreshKeyUI();
      renderAllChordsAndText();
      edSaveSong();
      // === Performance Architecture v2: sync key change ===
      if (typeof rebuildSongDocumentFromEdCur === 'function') rebuildSongDocumentFromEdCur();
    }

    // ORIGINAL KEY CHANGE: update baseChordNames and apply
    function applyOriginalKeyChange(newKey, newMode) {
      if (!edCur) return;
      const oldOrigKey = edCur.originalKey || edCur.key;
      const delta = keyDelta(oldOrigKey, newKey);
      edEnsureBaseChordNamesAligned();
      // Update baseChordNames
      if (delta && edCur.baseChordNames.length) {
        edCur.baseChordNames = edCur.baseChordNames.map(name => name ? edTransposeChord(name, delta) : name);
      }
      // Apply to current chords
      if (delta) transposeChordNamesInPlace(edCur.chords, delta);
      edCur.originalKey = newKey;
      edCur.originalKeyMode = newMode;
      edCur.key = newKey;
      edCur.keyMode = newMode;
      edCur.transpose = 0;
      refreshKeyUI();
      renderAllChordsAndText();
      edSaveSong();
    }

    // RESET TO ORIGINAL: restore chord names from baseChordNames, preserve positions
    function resetToOriginalKey() {
      if (!edCur) return;
      const names = edCur.baseChordNames || [];
      edCur.chords.forEach((ch, i) => {
        if (i < names.length && names[i]) ch.name = names[i];
      });
      edCur.key = edCur.originalKey || edCur.key;
      edCur.keyMode = edCur.originalKeyMode || edCur.keyMode || 'maj';
      edCur.transpose = 0;
      refreshKeyUI();
      renderAllChordsAndText();
      edSaveSong();
    }
    if ($('edTransUp')) $('edTransUp').onclick = () => { if (edCur && edCur.editorLocked) { toast('ðŸ”’ ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø± Ù‚ÙÙ„ Ø§Ø³Øª'); return; } if (edCur) applyTranspose((edCur.transpose || 0) + 1); };
    if ($('edTransDown')) $('edTransDown').onclick = () => { if (edCur && edCur.editorLocked) { toast('ðŸ”’ ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø± Ù‚ÙÙ„ Ø§Ø³Øª'); return; } if (edCur) applyTranspose((edCur.transpose || 0) - 1); };
    if ($('edTransVal')) $('edTransVal').addEventListener('dblclick', () => { if (edCur) applyTranspose(0); });
    // Toggle Ø¯ÛŒØ²/Ø¨Ù…Ù„ Ø¨Ø±Ø§ÛŒ Ù‡Ù…Ù‡ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ (Ø¨Ø¯ÙˆÙ† ØªØºÛŒÛŒØ± Ú¯Ø§Ù…)
    if ($('edToggleAccidental')) $('edToggleAccidental').onclick = () => edToggleAccidental();

    // Click on original key label â†’ change or reset
    if ($('edOrigKeyLabel')) $('edOrigKeyLabel').addEventListener('click', (e) => {
      if (!edCur) return;

      // Alt+Click â†’ FULL RESET to saved original key
      if (e.altKey) {
        resetToOriginalKey();
        toast('Ú¯Ø§Ù… Ø¨Ù‡ Ø­Ø§Ù„Øª Ø§ÙˆØ±Ø¬ÛŒÙ†Ø§Ù„ Ø¨Ø±Ú¯Ø´Øª: ' + (edCur.originalKey || '') + ((edCur.originalKeyMode || '') === 'min' ? 'm' : ''));
        return;
      }

      // Normal click â†’ change original key
      const curOrigKey = edCur.originalKey || edCur.key;
      const curOrigMode = edCur.originalKeyMode || edCur.keyMode || 'maj';
      const curOrigStr = curOrigKey + (curOrigMode === 'min' ? 'm' : '');
      const newOrig = prompt('Ú¯Ø§Ù… Ø§ÙˆØ±Ø¬ÛŒÙ†Ø§Ù„ Ø¢Ù‡Ù†Ú¯ Ø±Ùˆ Ù…Ø´Ø®Øµ Ú©Ù†ÛŒØ¯:', curOrigStr);
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
        toast('Ú¯Ø§Ù… Ù†Ø§Ù…Ø¹ØªØ¨Ø±: ' + newKey);
        return;
      }
      applyOriginalKeyChange(newKey, newMode);
      toast('Ú¯Ø§Ù… Ø§ÙˆØ±Ø¬ÛŒÙ†Ø§Ù„ Ø°Ø®ÛŒØ±Ù‡ Ùˆ Ø§Ø¹Ù…Ø§Ù„ Ø´Ø¯: ' + newKey + (newMode === 'min' ? 'm' : ''));
    });

    // -- Style Bindings --
    function edBindStyle(id, key, isColor) {
      const el = $(id); if (!el) return;
      const handler = () => { if (!edCur || edCur.editorLocked) return; edCur.styles[key] = isColor ? el.value : (el.type==='number' ? +el.value : el.value); edRenderEditor(false); setTimeout(() => edRenderChords(true), 0); edSaveSong(); };
      if (el.tagName === 'SELECT') el.onchange = handler; else el.oninput = handler;
    }
    edBindStyle('edTextSize','tSize'); edBindStyle('edTextFont','tFont');
    edBindStyle('edChordSize','cSize'); edBindStyle('edChordFont','cFont');

    // Hook up size lock sync to size inputs
    if ($('edTextSize')) $('edTextSize').addEventListener('input', () => syncSizeLocked('edTextSize'));
    if ($('edChordSize')) $('edChordSize').addEventListener('input', () => syncSizeLocked('edChordSize'));
    // ===== SIZE LOCK: sync text and chord sizes =====
    let _sizeLocked = false;

    function toggleSizeLock() {
      _sizeLocked = !_sizeLocked;
      const btn = $('edSizeLockBtn');
      if (btn) {
        // Locked: closed lock icon; Unlocked: open lock icon
        btn.innerHTML = _sizeLocked
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
        btn.classList.toggle('active', _sizeLocked);
      }
      toast(_sizeLocked ? 'ðŸ”— Ù‚ÙÙ„ Ø§Ù†Ø¯Ø§Ø²Ù‡ ÙØ¹Ø§Ù„ â€” Ù…ØªÙ† Ùˆ Ø¢Ú©ÙˆØ±Ø¯ Ù‡Ù…Ø²Ù…Ø§Ù† ØªØºÛŒÛŒØ± Ù…ÛŒâ€ŒÚ©Ù†Ù†Ø¯' : 'ðŸ”“ Ù‚ÙÙ„ Ø§Ù†Ø¯Ø§Ø²Ù‡ ØºÛŒØ±ÙØ¹Ø§Ù„');
    }

    // Sync text size to chord size and vice versa when locked
    function syncSizeLocked(changedId) {
      if (!_sizeLocked || !edCur || edCur.editorLocked) return;
      const val = parseInt($(changedId).value) || 23;
      if (changedId === 'edTextSize') {
        edCur.styles.cSize = val;
        if ($('edChordSize')) $('edChordSize').value = val;
      } else {
        edCur.styles.tSize = val;
        if ($('edTextSize')) $('edTextSize').value = val;
      }
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
        toast('ðŸŽ¨ Ø±Ù†Ú¯ Ù…ØªÙ† Ø±Ù†Ø¯ÙˆÙ… Ø´Ø¯');
      } else {
        edCur.chords.forEach(ch => {
          ch.color = shuffled[ch.lineIndex % shuffled.length];
        });
        edRenderChords();
        toast('ðŸŽ¨ Ø±Ù†Ú¯ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø±Ù†Ø¯ÙˆÙ… Ø´Ø¯');
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
        toast('ðŸ”„ Ø±Ù†Ú¯ Ù…ØªÙ† Ø±ÛŒØ³Øª Ø´Ø¯');
      } else {
        edCur.chords.forEach(ch => { ch.color = defaultChordColor; });
        edCur.styles.cColor = defaultChordColor;
        edRenderChords();
        toast('ðŸ”„ Ø±Ù†Ú¯ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ Ø±ÛŒØ³Øª Ø´Ø¯');
      }
      edSaveSong();
    }

    // Editor lock replaces old size lock
    function toggleEditorLock() {
      if (!edCur) return;
      edCur.editorLocked = !edCur.editorLocked;
      const btn = $('edEditorLockBtn');
      if (btn) {
        btn.innerHTML = edCur.editorLocked ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
        btn.classList.toggle('editor-lock-blink', edCur.editorLocked);
      }
      const editor = $('editor');
      if (editor) editor.contentEditable = edCur.editorLocked ? 'false' : 'true';
      const controls = ['edTextSize', 'edChordSize', 'edTextFont', 'edChordFont', 'edTextBold',
        'edAlignRight', 'edAlignCenter', 'edAlignLeft', 'edRemoveAsterisks', 'edReverseChords', 'edDoBoth'];
      controls.forEach(id => { if ($(id)) $(id).disabled = edCur.editorLocked; });
      toast(edCur.editorLocked ? 'ðŸ”’ ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø± Ù‚ÙÙ„ Ø´Ø¯' : 'ðŸ”“ ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø± Ø¨Ø§Ø² Ø´Ø¯');
    }
    // Size lock is now part of editor lock â€” remove old sync behavior
    if ($('edTextBold')) $('edTextBold').onclick = () => { if (!edCur || edCur.editorLocked) return; edCur.styles.tBold = !edCur.styles.tBold; $('edTextBold').classList.toggle('active', edCur.styles.tBold); edRenderEditor(false); edSaveSong(); };
    [['edAlignRight','right'],['edAlignCenter','center'],['edAlignLeft','left']].forEach(([id,v]) => { if ($(id)) $(id).onclick = () => { if (!edCur || edCur.editorLocked) return; edCur.styles.align = v; edSyncToolbar(); edRenderEditor(false); edSaveSong(); }; });

    // -- Toolbar Input Handlers --
    if ($('edArtist')) $('edArtist').oninput = () => { if (edCur) { edCur.artist = $('edArtist').value; edCur.artistKey = archArtistKey(edCur.artist); edRenderEditor(false); edSaveSong(); } };
    if ($('edTitle')) $('edTitle').oninput = () => { if (edCur) { edCur.title = $('edTitle').value; edRenderEditor(false); edSaveSong(); } };
    if ($('edKey')) $('edKey').onchange = () => { if (_edSyncingKey) return; if (!edCur) return; if (edCur.editorLocked) { toast('ðŸ”’ ÙˆÛŒØ±Ø§ÛŒØ´Ú¯Ø± Ù‚ÙÙ„ Ø§Ø³Øª'); $('edKey').value = edCur.key; return; } applyKeyChange($('edKey').value, $('edKeyMode')?.value || edCur.keyMode || 'maj'); };
    if ($('edKeyMode')) $('edKeyMode').onchange = () => { if (_edSyncingKey) return; if (edCur) { applyKeyChange(edCur.key, $('edKeyMode').value); } };
    if ($('edTimeSig')) $('edTimeSig').onchange = () => { if (edCur) { edCur.timeSignature = $('edTimeSig').value; edSaveSong(); renderTracks(); renderRuler(); renderClips(); } };
    if ($('edTempo')) $('edTempo').oninput = () => { if (edCur) { edCur.tempo = parseInt($('edTempo').value) || 120; edSaveSong(); } };
    if ($('edGenre')) $('edGenre').onchange = () => { if (edCur) { edCur.genre = $('edGenre').value; edSaveSong(); } };

    // Populate key select (both sharp and flat options)
    ED_ALL_NOTE_NAMES.forEach(n => { if ($('edKey')) $('edKey').add(new Option(n, n)); });

    // -- Mouse wheel on toolbar inputs (number + select) --
    document.querySelector('.header-center-controls')?.addEventListener('wheel', e => {
      const el = e.target;
      if (el.type === 'number') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const min = parseFloat(el.min) || -Infinity;
        const max = parseFloat(el.max) || Infinity;
        const val = parseFloat(el.value) || 0;
        el.value = Math.max(min, Math.min(max, val + (e.deltaY < 0 ? step : -step)));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (el.tagName === 'SELECT') {
        e.preventDefault();
        const opts = el.options; if (!opts.length) return;
        el.selectedIndex = (el.selectedIndex + (e.deltaY < 0 ? -1 : 1) + opts.length) % opts.length;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }, { passive: false });

    // -- Keyboard Shortcuts for Editor (chord modal + chord movement) --
    window.addEventListener('keydown', e => {
      const isInput = e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA' || e.target?.tagName === 'SELECT';
      const isEditing = e.target?.isContentEditable;

      if (e.key === 'Escape' && edChordModalMode === 'editor' && $('chord-modal')?.classList.contains('show')) { edCloseChordModal(); return; }
      if (e.code === 'Enter' && edChordModalMode === 'editor' && $('chord-modal')?.classList.contains('show')) { e.preventDefault(); edConfirmChord(); return; }

      // TAP TEMPO shortcut (T key, not in input/editor)
      if (e.key === 't' && !isInput && !isEditing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); tapTempo(); return; }

      // Chord-line tap: Ø¹Ø¯Ø¯ Û° Ù‡Ø± Ø¨Ø§Ø± ÛŒÚ© Ù†Ù‚Ø·Ù‡ Ø±ÙˆÛŒ ØªØ§ÛŒÙ… Ù„Ø§ÛŒÙ† Ù…ÛŒâ€ŒÚ¯Ø°Ø§Ø±Ø¯ (ÙÙ‚Ø· ÙˆÙ‚ØªÛŒ âº ÙØ¹Ø§Ù„ Ø§Ø³Øª)
      if ((e.code === 'Digit0' || e.code === 'Numpad0') && edClTapActive && !isInput && !isEditing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        edClTap();
        return;
      }

      // Sequential chording: Enter opens chord modal for current position
      if (edSeqChordingActive && e.code === 'Enter' && !isInput && !isEditing && !($('chord-modal')?.classList.contains('show') && edChordModalMode === 'editor')) {
        e.preventDefault();
        const seqIdx = edCur.chords.length - edSeqPoints.length + edSeqCursor;
        edOpenChordModal(seqIdx);
        return;
      }

      // When chord modal is open, ArrowLeft/Right navigate between chords
      if ($('chord-modal')?.classList.contains('show') && edChordModalMode === 'editor' && typeof edChordIdx !== 'undefined' && edChordIdx !== null) {
        if (e.code === 'ArrowRight') { e.preventDefault(); edNavigateChord(1); return; }
        if (e.code === 'ArrowLeft') { e.preventDefault(); edNavigateChord(-1); return; }
      }

      // Arrow keys to move selected chords
if (
  edSelectedChords.length > 0 &&
  (e.code === 'ArrowLeft' || e.code === 'ArrowRight') &&
  !($('chord-modal')?.classList.contains('show') &&
    edChordModalMode === 'editor') &&
  !isInput &&
  !(edCur && edCur.editorLocked)
) {
  e.preventDefault();

  edSelectedChords.forEach(idx => {
    const ch = edCur.chords[idx];
    if (!ch) return;

    const lineEl = $('editor')?.children[ch.lineIndex];
    if (!lineEl) return;

    const textLen = lineEl.textContent.replace(/\u200B/g,'').length;
    const isRTL = window.getComputedStyle(lineEl).direction === 'rtl';

    if (e.code === 'ArrowRight') {
      ch.charIndex = isRTL
        ? Math.max(0, ch.charIndex - 1)
        : Math.min(textLen, ch.charIndex + 1);
    } else {
      ch.charIndex = isRTL
        ? Math.min(textLen, ch.charIndex + 1)
        : Math.max(0, ch.charIndex - 1);
    }

    if (ch.charIndex <= 0) ch.anchorType = 'LineStart';
    else if (ch.charIndex >= textLen) ch.anchorType = 'LineEnd';
    else ch.anchorType = 'OnCharacter';
  });

  edRenderChords();
  edCommit();
}


      // Delete selected chords â€” only when not locked
if (
  (e.code === 'Delete' || e.code === 'Backspace') &&
  edSelectedChords.length > 0 &&
  !($('chord-modal')?.classList.contains('show') &&
    edChordModalMode === 'editor') &&
  !(edCur && edCur.editorLocked)
) {
  e.preventDefault();

  edSelectedChords
    .sort((a,b) => b-a)
    .forEach(i => edRemoveChordAt(i));

  edSelectedChords = [];
  edRenderChords();
  edCommit();
}

    });

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
          const sec = (DAW.sections || []).find(s => s.id === secTagEl.dataset.sectionId);
          if (!sec) return false;
          if (isGlobal) {
            (DAW.sections || []).forEach(s => applyColorToSection(s, currentColor));
            saveState(); renderClips();
            toast('Ù‡Ù…Ù‡ Ø¨Ø®Ø´â€ŒÙ‡Ø§ Ø±Ù†Ú¯ Ø´Ø¯');
          } else {
            applyColorToSection(sec, currentColor); saveState();
            toast('Ø±Ù†Ú¯ Ø¨Ø®Ø´: ' + currentColor);
          }
          return true;
        }
        // 1. Timeline chord clip
        const clipEl = e.target.closest('.clip');
        if (clipEl) {
          const clip = getClip(clipEl.dataset.clipId);
          if (!clip) return false;
          if (isGlobal) {
            DAW.clips.forEach(c => { if (c.type === clip.type) applyColorToClip(c, currentColor); });
            saveState(); renderClips();
            toast('Ù‡Ù…Ù‡ ' + (clip.type === 'chord' ? 'Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ÛŒ ØªØ§ÛŒÙ…â€ŒÙ„Ø§ÛŒÙ†' : 'Ú©Ù„ÛŒÙ¾â€ŒÙ‡Ø§') + ' Ø±Ù†Ú¯ Ø´Ø¯');
          } else {
            applyColorToClip(clip, currentColor); saveState();
            toast('Ø±Ù†Ú¯ Ú©Ù„ÛŒÙ¾: ' + currentColor);
          }
          return true;
        }
        // 2. Editor text line (check BEFORE chord â€” chords overlay text via z-index)
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
            toast('Ø±Ù†Ú¯ Ù‡Ù…Ù‡ Ù…ØªÙ†: ' + currentColor);
          } else if (li >= 0) {
            edCur.lineColors[li] = currentColor;
            // Apply color directly â€” do NOT call edRenderEditor which may interfere
            eline.style.color = currentColor;
            saveState(); edSaveSong();
            toast('Ø±Ù†Ú¯ Ø®Ø· ' + (li + 1) + ': ' + currentColor);
          }
          return true;
        }
        // 3. Editor chord (after text line â€” so text always gets colored)
        const chordEl = e.target.closest('.chord');
        if (chordEl && edCur) {
          const ci = parseInt(chordEl.dataset.idx);
          if (isGlobal) {
            edCur.styles.cColor = currentColor;
            edCur.chords.forEach(ch => delete ch.color);
            saveState(); edRenderChords(); edSaveSong();
            toast('Ø±Ù†Ú¯ Ù‡Ù…Ù‡ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§: ' + currentColor);
          } else if (ci >= 0 && edCur.chords[ci]) {
            edCur.chords[ci].color = currentColor;
            saveState(); edRenderChords(); edSaveSong();
            toast('Ø±Ù†Ú¯ Ø¢Ú©ÙˆØ±Ø¯: ' + currentColor);
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
            toast('Ø±Ù†Ú¯ Ù‡Ù…Ù‡ Ù…ØªÙ†: ' + currentColor);
          }
          return true;
        }
        // 5. Track lane empty area â†’ color all clips on track
        const lane = e.target.closest('.track-lane');
        if (lane) {
          const trackClips = DAW.clips.filter(c => c.trackId === lane.dataset.trackId);
          trackClips.forEach(c => applyColorToClip(c, currentColor));
          saveState(); renderClips();
          toast(trackClips.length + ' Ú©Ù„ÛŒÙ¾ Ø±Ù†Ú¯ Ø´Ø¯'); return true;
        }
        return false;
      } else if (colorToolMode === 'eyedropper') {
        // 0. Section tag â†’ sample color (decoupled)
        const secTagEl = e.target.closest('.section-tag');
        if (secTagEl) {
          const sec = (DAW.sections || []).find(s => s.id === secTagEl.dataset.sectionId);
          if (sec) { selectColor(sec.color || '#3FB8AF'); toast('Ø±Ù†Ú¯ Ù†Ù…ÙˆÙ†Ù‡ Ø¨Ø®Ø´: ' + currentColor); deactivateColorTool(); return true; }
        }
        // 1. Timeline clip â†’ sample
        const clipEl = e.target.closest('.clip');
        if (clipEl) {
          const clip = getClip(clipEl.dataset.clipId);
          if (clip) { selectColor(clip.color); toast('Ø±Ù†Ú¯ Ù†Ù…ÙˆÙ†Ù‡: ' + currentColor); deactivateColorTool(); return true; }
        }
        // 2. Editor text line â†’ sample per-line or global (check before chord)
        const eline = e.target.closest('.eline');
        if (eline && edCur) {
          const li = parseInt(eline.dataset.lineIndex);
          const lineColors = edCur.lineColors || [];
          selectColor(lineColors[li] || edCur.styles.tColor || '#0fa966');
          toast('Ø±Ù†Ú¯ Ù†Ù…ÙˆÙ†Ù‡: ' + currentColor); deactivateColorTool(); return true;
        }
        // 3. Editor chord â†’ sample per-chord or global
        const chordEl = e.target.closest('.chord');
        if (chordEl && edCur) {
          const ci = parseInt(chordEl.dataset.idx);
          const ch = ci >= 0 ? edCur.chords[ci] : null;
          selectColor(ch?.color || edCur.styles.cColor || '#e6aa28');
          toast('Ø±Ù†Ú¯ Ù†Ù…ÙˆÙ†Ù‡: ' + currentColor); deactivateColorTool(); return true;
        }
        if (e.target.closest('#editor') && edCur) {
          selectColor(edCur.styles.tColor || '#0fa966');
          toast('Ø±Ù†Ú¯ Ù†Ù…ÙˆÙ†Ù‡: ' + currentColor); deactivateColorTool(); return true;
        }
        // 4. Track lane â†’ sample first clip color
        const lane = e.target.closest('.track-lane');
        if (lane) {
          const first = DAW.clips.find(c => c.trackId === lane.dataset.trackId && c.color);
          if (first) { selectColor(first.color); toast('Ø±Ù†Ú¯ Ù†Ù…ÙˆÙ†Ù‡: ' + currentColor); deactivateColorTool(); return true; }
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
              toast('Ø±Ù†Ú¯ Ú©Ù„ÛŒÙ¾: ' + currentColor); return;
            } else if (clip && colorToolMode === 'eyedropper') {
              selectColor(clip.color);
              toast('Ø±Ù†Ú¯ Ù†Ù…ÙˆÙ†Ù‡: ' + currentColor); deactivateColorTool();
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
        const sec = (DAW.sections || []).find(s => s.id === secTagEl.dataset.sectionId);
        if (!sec) return;
        if (colorToolMode === 'brush') {
          if (e.shiftKey) {
            (DAW.sections || []).forEach(s => applyColorToSection(s, currentColor));
            toast('Ù‡Ù…Ù‡ Ø¨Ø®Ø´â€ŒÙ‡Ø§ Ø±Ù†Ú¯ Ø´Ø¯');
          } else {
            applyColorToSection(sec, currentColor);
            toast('Ø±Ù†Ú¯ Ø¨Ø®Ø´: ' + currentColor);
          }
          saveState(); e.preventDefault(); e.stopPropagation();
        } else if (colorToolMode === 'eyedropper') {
          selectColor(sec.color || '#3FB8AF');
          toast('Ø±Ù†Ú¯ Ù†Ù…ÙˆÙ†Ù‡: ' + currentColor); deactivateColorTool();
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

    // Keyboard shortcut: C for brush, Alt+C for eyedropper
    document.addEventListener('keydown', (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleColorTool('brush'); }
      if (e.key === 'c' && e.altKey) { e.preventDefault(); toggleColorTool('eyedropper'); }
      if (e.key === 'Escape' && isColorToolActive()) { deactivateColorTool(); }
      // Escape cancels mapping mode
      if (e.key === 'Escape' && _mappingTarget) { cancelMapping(); }
      // Escape closes perf mode
      if (e.key === 'Escape' && perfModeActive) { perfStop(); return; }
      // Panel visibility toggles: Shift+Ctrl+Arrow
      if (e.shiftKey && (e.ctrlKey || e.metaKey)) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); togglePanel('inspector'); }
        if (e.key === 'ArrowRight') { e.preventDefault(); togglePanel('sidebar'); }
        if (e.key === 'ArrowDown') { e.preventDefault(); togglePanel('timeline'); }
      }
      // Performance mode shortcuts (space handled in capture phase)
      if (perfModeActive) {
        if (e.key === 'ArrowRight' && !e.ctrlKey) { e.preventDefault(); perfNextSong(); }
        if (e.key === 'ArrowLeft' && !e.ctrlKey) { e.preventDefault(); perfPrevSong(); }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); perfRestartSong(); }
        if (e.key === 'F11') { e.preventDefault(); perfToggleStageMode(); }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); perfTranspose(1); }
        if (e.key === '-') { e.preventDefault(); perfTranspose(-1); }
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); perfTogglePauseMode(); }
      }
    });

    // ===== BUTTON MAPPING (Ctrl+Shift+Alt + Click) =====
    let _mappingTarget = null; // function id being mapped
    let _mappingEl = null; // the button element being mapped

    // Action -> function mapping
    const ACTION_FUNCTIONS = {
      'play': togglePlay, 'pause': pauseTransport, 'stop': stopTransport,
      'goStart': transportToStart, 'goEnd': transportToEnd,
      'returnToStart': toggleReturnToStart,
      'loop': toggleLoop, 'loopA': setLoopA, 'loopB': setLoopB,
      'setLoopFromSel': setLoopFromSelection,
      'undo': undo, 'redo': redo,
      'fullscreen': () => { if (!DAW.isPlaying) { ensureAudioCtx(); if (DAW.playhead <= 0) seekTransport(0, false); startTransport(); } openLyricOnlyPopup(); setTimeout(openLyricPopup, 300); },
      'singerView': openLyricOnlyPopup,
      'playerView': (typeof openPlayerView === 'function') ? openPlayerView : openLyricPopup,
      'split': splitSelectedAtPlayhead, 'copy': copySelected, 'cut': cutSelected, 'paste': pasteClipboard,
      'projectHubOpen': () => window.ProjectHub?.open(),
      'archiveOpen': edOpenArchive,
      'quickSearchOpen': () => window.openQuickSearchPanel(),
      'archiveSave': () => edSaveToArchive().then(() => toast('Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯')),
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
    };

    let eventBindings = null;

    function initializeEventBindings() {
      if (document.readyState === 'loading') return;
      if (eventBindings || typeof window.EventBindings !== 'function') return;

      eventBindings = new window.EventBindings({
        actions: ACTION_FUNCTIONS,
        onGlobalKeydownCapture: handleGlobalKeydownCapture,
        onGlobalKeydown: handleGlobalKeydown
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

    // Detect Ctrl+Shift+Alt + Click on any button with data-action
    document.addEventListener('mousedown', (e) => {
      if (!e.ctrlKey || !e.shiftKey || !e.altKey) return;
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      startMapping(btn.dataset.action, btn);
    }, true);

    function startMapping(actionId, el) {
      // Deactivate any active tools
      if (isColorToolActive()) deactivateColorTool();
      _mappingTarget = actionId;
      _mappingEl = el;
      el.classList.add('mapping-active');
      // Show toast
      let toastEl = document.querySelector('.mapping-toast');
      if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'mapping-toast'; document.body.appendChild(toastEl); }
      const label = SHORTCUT_DEFAULTS.find(s => s.id === actionId)?.label || actionId;
      toastEl.textContent = 'ðŸŽ¹ Â«' + label + 'Â» â€” Ú©Ù„ÛŒØ¯ ÛŒØ§ Ù†Øª MIDI Ø±Ø§ Ø¨Ø²Ù†ÛŒØ¯...';
      toastEl.style.display = 'block';
      // Listen for next key or MIDI
      document.addEventListener('keydown', onMappingKeyHandler, true);
      document.addEventListener('mousedown', onMappingMidiHandler, true);
    }

    function onMappingKeyHandler(e) {
      if (!_mappingTarget) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { cancelMapping(); return; }
      if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return;
      // Save keyboard mapping
      SHORTCUTS[_mappingTarget] = { code: e.code, ctrl: !!e.ctrlKey, shift: !!e.shiftKey };
      saveShortcuts();
      finishMapping('Ú©Ù„ÛŒØ¯: ' + formatKeyName(e.code) + (e.ctrlKey ? '+Ctrl' : '') + (e.shiftKey ? '+Shift' : ''));
    }

    function onMappingMidiHandler(e) {
      if (!_mappingTarget) return;
      // Check if click is NOT on the mapped button itself (to allow normal clicks)
      if (e.target.closest('[data-action]') === _mappingEl) return;
    }

    function cancelMapping() {
      if (_mappingEl) _mappingEl.classList.remove('mapping-active');
      _mappingTarget = null; _mappingEl = null;
      document.removeEventListener('keydown', onMappingKeyHandler, true);
      const toastEl = document.querySelector('.mapping-toast');
      if (toastEl) toastEl.style.display = 'none';
    }

    function finishMapping(info) {
      if (_mappingEl) _mappingEl.classList.remove('mapping-active');
      const toastEl = document.querySelector('.mapping-toast');
      if (toastEl) { toastEl.textContent = 'âœ… Ø°Ø®ÛŒØ±Ù‡ Ø´Ø¯: ' + info; setTimeout(() => toastEl.style.display = 'none', 1500); }
      _mappingTarget = null; _mappingEl = null;
      document.removeEventListener('keydown', onMappingKeyHandler, true);
    }

    // Execute MIDI mapped functions on Note On
    function executeMidiMappedFunction(funcId) {
      const fn = ACTION_FUNCTIONS[funcId];
      if (fn) fn();
    }

    // ======== ØªØ§Ø¨Ø¹ Ø§ÛŒÙ…Ù† Ø¨Ø±Ø§ÛŒ Ú©Ù¾ÛŒ Ø¢Ú©ÙˆØ±Ø¯Ù‡Ø§ ========
    function safeMirrorTimeline() {
      try {
        if (!_lyricPopup || _lyricPopup.closed) return;
        const targetDiv = _lyricPopup.document.getElementById('playerChordMirror');
        if (!targetDiv) return;

        const sourceTimeline = document.querySelector('.track-lane.chord-lane');
        if (!sourceTimeline || sourceTimeline.children.length === 0) return;

        // Û±. Ú©Ù¾ÛŒ Ø¨Ø±Ø¯Ø§Ø±ÛŒ Ø¨Ø¯ÙˆÙ† Ø­Ø°Ù Ù‡ÛŒÚ† Ø§Ù„Ù…Ø§Ù†ÛŒ (Ø¨Ø±Ø§ÛŒ Ø­ÙØ¸ ÛŒÚ©Ù¾Ø§Ø±Ú†Ú¯ÛŒ Ø§ÛŒÙ†Ø¯Ú©Ø³â€ŒÙ‡Ø§)
        const clone = sourceTimeline.cloneNode(true);

        targetDiv.innerHTML = '';
        targetDiv.appendChild(clone);

        // Ø§Ø³ØªØ§ÛŒÙ„ Ú©Ø§Ù†ØªÛŒÙ†Ø± â€” Ø«Ø§Ø¨ØªØŒ Ø¨Ø¯ÙˆÙ† Ø§Ø³Ú©Ø±ÙˆÙ„ØŒ Ù¾Ù„ÛŒâ€ŒÙ‡Ø¯ ÙˆØ³Ø·Ø´ Ù…ÛŒâ€ŒÙ…Ø§Ù†Ø¯
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

        // â”€â”€ Ø®Ø· Ú©Ø´ÛŒ Ø¨Ø§Ù„Ø§ (Ø´Ù…Ø§Ø±Ù‡ Ù…ÛŒØ²Ø§Ù†) Ù…Ø«Ù„ ØªØ§ÛŒÙ… Ù„Ø§ÛŒÙ† Ø§ØµÙ„ÛŒ â”€â”€
        let mirrorRuler = targetDiv.querySelector('.mirror-ruler');
        if (!mirrorRuler) {
          mirrorRuler = _lyricPopup.document.createElement('div');
          mirrorRuler.className = 'mirror-ruler';
          mirrorRuler.style.cssText = 'position:absolute;top:0;left:0;height:' + RULER_H + 'px;width:100%;overflow:hidden;z-index:5;pointer-events:none;background:rgba(13,16,23,0.95);border-bottom:1px solid rgba(255,255,255,0.1);';
          targetDiv.appendChild(mirrorRuler);
        }
        let rulerInner = mirrorRuler.querySelector('.mirror-ruler-inner');
        if (!rulerInner) {
          rulerInner = _lyricPopup.document.createElement('div');
          rulerInner.className = 'mirror-ruler-inner';
          rulerInner.style.cssText = 'position:absolute;top:0;height:100%;white-space:nowrap;font-size:8px;color:rgba(255,255,255,0.5);font-family:JetBrains Mono,monospace;line-height:' + RULER_H + 'px;';
          mirrorRuler.appendChild(rulerInner);
        }
        rulerInner.innerHTML = '';
        rulerInner.style.width = sourceTimeline.scrollWidth + 'px';

        // â”€â”€ Ø§Ø¹Ø¯Ø§Ø¯ Ùˆ Ù¾Ø§Ø±Ø§Ù…ØªØ±Ù‡Ø§ÛŒ Ú¯Ø±ÛŒØ¯ â”€â”€
        const _glen = getProjectEnd();
        const _gbpm = edCur?.tempo || 120;
        const _gsig = edCur?.timeSignature || '4/4';
        const _gcfg = getTimeSignatureGridConfig(_gsig, _gbpm);
        const _gbeatsPerBar = _gcfg.beatsPerMeasure;
        const _gbeatDur = _gcfg.beatDuration;
        const _gbarDur = _gcfg.measureDuration;
        const _gpxPerSec = DAW.pxPerSecond;
        const _gpxPerBar = _gbarDur * _gpxPerSec;
        let _gbarStep = 1;
        if (_gpxPerBar > 120) _gbarStep = 1;
        else if (_gpxPerBar > 60) _gbarStep = 2;
        else if (_gpxPerBar > 30) _gbarStep = 4;
        else if (_gpxPerBar > 15) _gbarStep = 8;
        else if (_gpxPerBar > 8) _gbarStep = 16;
        else _gbarStep = 32;

        // Ø´Ù…Ø§Ø±Ù‡ Ù…ÛŒØ²Ø§Ù†â€ŒÙ‡Ø§ Ø±ÙˆÛŒ Ø±ÙˆÙ„Ø±
        for (let _bar = 1; _bar * _gbarDur <= _glen; _bar++) {
          if ((_bar - 1) % _gbarStep !== 0) continue;
          const _x = timeToX((_bar - 1) * _gbarDur);
          const _span = _lyricPopup.document.createElement('span');
          _span.className = 'mirror-ruler-label';
          _span.style.cssText = 'position:absolute;left:' + _x + 'px;top:0;padding-left:2px;';
          _span.textContent = _bar;
          rulerInner.appendChild(_span);
        }

        // â”€â”€ Ø±Ø³Ù… Ø®Ø·ÙˆØ· Ú¯Ø±ÛŒØ¯ Ø±ÙˆÛŒ Ú©Ø§Ù†ÙˆØ§Ø³ Ø¯Ø§Ø®Ù„ Ú©Ù„ÙˆÙ† (Ù…Ø«Ù„ drawLaneGrid) â”€â”€
        let gridCanvas = clone.querySelector('canvas.lane-grid');
        if (!gridCanvas) {
          gridCanvas = _lyricPopup.document.createElement('canvas');
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
        // Ø®Ø·ÙˆØ· Ù…ÛŒØ²Ø§Ù† (Ù¾Ø±Ø±Ù†Ú¯â€ŒØªØ±)
        _gctx.strokeStyle = 'rgba(255,255,255,0.12)';
        _gctx.lineWidth = 1;
        let _gBarCount = 0;
        for (let _bar = 1; _bar * _gbarDur <= _glen && _gBarCount < 500; _bar++) {
          const _x = Math.round((_bar * _gbarDur) * _gpxPerSec) + 0.5;
          if (_x > gridCanvas.width) break;
          _gctx.beginPath(); _gctx.moveTo(_x, 0); _gctx.lineTo(_x, gridCanvas.height); _gctx.stroke();
          _gBarCount++;
        }
        // Ø®Ø·ÙˆØ· Ø¶Ø±Ø¨ (Ú©Ù…Ø±Ù†Ú¯â€ŒØªØ±)
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
        // Ø³Ø§Ø¨ Ø¶Ø±Ø¨ (Ø²Ù…Ø§Ù†ÛŒ Ú©Ù‡ Ø²ÙˆÙ… Ø®ÛŒÙ„ÛŒ Ø²ÛŒØ§Ø¯ Ø§Ø³Øª)
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

        // Û². Ø³Ø§Ø®Øª Ù¾Ù„ÛŒâ€ŒÙ‡Ø¯ â€” Ø«Ø§Ø¨Øª Ø¯Ø± ÙˆØ³Ø· Ú©Ø§Ù†ØªÛŒÙ†Ø±
        let mirrorPlayhead = targetDiv.querySelector('.mirror-playhead');
        if (!mirrorPlayhead) {
            mirrorPlayhead = _lyricPopup.document.createElement('div');
            mirrorPlayhead.className = 'mirror-playhead';
            mirrorPlayhead.style.cssText = 'position: absolute; top: 0; bottom: 0; width: 2px; background: #00F2FE; z-index: 100; box-shadow: 0 0 10px rgba(0,242,254,0.8); pointer-events: none; left: 50%;';
            targetDiv.appendChild(mirrorPlayhead);
        } else {
            // Ø§Ú¯Ø± Ø§Ø² Ù‚Ø¨Ù„ ÙˆØ¬ÙˆØ¯ Ø¯Ø§Ø±Ø¯ØŒ Ù…Ø·Ù…Ø¦Ù† Ø´Ùˆ Ø¯Ø± Ú©Ø§Ù†ØªÛŒÙ†Ø± Ø¨Ø§Ø´Ø¯ Ù†Ù‡ Ø¯Ø± Ú©Ù„ÙˆÙ†
            mirrorPlayhead.style.left = '50%';
        }

        const sourceClips = sourceTimeline.children;
        const cloneClips = clone.children;

        for (let i = 0; i < cloneClips.length; i++) {
            let clip = cloneClips[i];
            let sourceClip = sourceClips[i]; // ØªØ·Ø§Ø¨Ù‚ Ø¯Ù‚ÛŒÙ‚ ÛŒÚ© Ø¨Ù‡ ÛŒÚ©

            if (clip.classList.contains('mirror-playhead')) continue;

            // Ú©Ø§Ù†ÙˆØ§Ø³ Ú¯Ø±ÛŒØ¯ Ø±Ø§ Ù…Ø®ÙÛŒ Ù†Ú©Ù†
            if (clip.tagName === 'CANVAS') continue;

            // Ù…Ø®ÙÛŒ Ú©Ø±Ø¯Ù† Ø¯Ø³ØªÚ¯ÛŒØ±Ù‡â€ŒÙ‡Ø§ Ø¨Ù‡ Ø¬Ø§ÛŒ Ø­Ø°Ù Ú©Ø±Ø¯Ù†
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

            // Û³. Ú©Ù¾ÛŒ Ù…Ø³ØªÙ‚ÛŒÙ… Ù…ÙˆÙ‚Ø¹ÛŒØª Ùˆ Ø³Ø§ÛŒØ² Ø§Ø² Ø§Ù„Ù…Ø§Ù† Ø§ØµÙ„ÛŒ (Ø­Ù„ Ù…Ø´Ú©Ù„ Ø´ÛŒÙØª Ù…ÛŒØ²Ø§Ù†)
            if (sourceClip) {
                let cs = window.getComputedStyle(sourceClip);
                clip.style.left = cs.left !== 'auto' ? cs.left : '0px';
                clip.style.right = cs.right !== 'auto' ? cs.right : 'auto';
                clip.style.width = cs.width;
                clip.style.transform = cs.transform;
            }

            // Ø§Ø³ØªØ§ÛŒÙ„â€ŒØ¯Ù‡ÛŒ Ø¨ØµØ±ÛŒ â€” Ø¯Ù‚ÛŒÙ‚Ø§Ù‹ Ù…Ø«Ù„ Ù„Ø§ÛŒÙ† Ø¢Ú©ÙˆØ±Ø¯ ØªØ§ÛŒÙ…â€ŒÙ„Ø§ÛŒÙ†
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

    // ======== Ù…ÙˆØªÙˆØ± Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ Ø²Ù†Ø¯Ù‡ Ù¾Ù„ÛŒâ€ŒÙ‡Ø¯ Ùˆ Ø§Ø³Ú©Ø±ÙˆÙ„ ========
    let _mirrorSyncRAF = null;

    function startMirrorSync() {
        if (_mirrorSyncRAF) cancelAnimationFrame(_mirrorSyncRAF);

        function loop() {
            try {
                if (!_lyricPopup || _lyricPopup.closed) return;

                const targetDiv = _lyricPopup.document.getElementById('playerChordMirror');
                if (!targetDiv) return;

                const mainLane = document.querySelector('.track-lane.chord-lane');
                const mainPlayhead = document.querySelector('.playhead, .timeline-playhead, .daw-playhead, #main-playhead');
                const mirrorPlayhead = targetDiv.querySelector('.mirror-playhead');
                const clone = targetDiv.querySelector('.track-lane, [class*="chord"]');

                if (mainLane && mainPlayhead && mirrorPlayhead) {
                    // Ù…Ø­Ø§Ø³Ø¨Ù‡ Ù…ÙˆÙ‚Ø¹ÛŒØª Ù¾Ù„ÛŒâ€ŒÙ‡Ø¯ Ø§ØµÙ„ÛŒ Ù†Ø³Ø¨Øª Ø¨Ù‡ ØµÙØ­Ù‡
                    const mainRect = mainLane.getBoundingClientRect();
                    const phRect = mainPlayhead.getBoundingClientRect();
                    // Ù…ÙˆÙ‚Ø¹ÛŒØª Ù¾Ù„ÛŒâ€ŒÙ‡Ø¯ Ù†Ø³Ø¨Øª Ø¨Ù‡ Ø´Ø±ÙˆØ¹ ØªØ§ÛŒÙ…â€ŒÙ„Ø§ÛŒÙ† (Ø¨Ø¯ÙˆÙ† Ø¯Ø± Ù†Ø¸Ø± Ú¯Ø±ÙØªÙ† Ø§Ø³Ú©Ø±ÙˆÙ„)
                    const phLeftInLane = phRect.left - mainRect.left + mainLane.parentElement.scrollLeft;
                    // ÙˆØ³Ø· Ú©Ø§Ù†ØªÛŒÙ†Ø± Ù¾Ù„ÛŒØ±
                    const containerCenter = targetDiv.clientWidth / 2;
                    // Ø§Ø³Ú©Ø±ÙˆÙ„ Ú©Ù„ÙˆÙ† ØªØ§ Ù¾Ù„ÛŒâ€ŒÙ‡Ø¯ ÙˆØ³Ø· Ø¨Ù…Ø§Ù†Ø¯
                    if (clone) {
                        clone.style.left = (containerCenter - phLeftInLane) + 'px';
                    }
                    // Ù‡Ù…Ø§Ù‡Ù†Ú¯ Ú©Ø±Ø¯Ù† Ø±ÙˆÙ„Ø± Ø¨Ø§Ù„Ø§ Ø¨Ø§ Ø­Ø±Ú©Øª Ù„Ø§ÛŒÙ†
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

    // Init DAW (may fail if no AudioContext)
    try { init(); } catch(ex) { console.warn('DAW init error:', ex); }
    // Always init song editor
    edInitSong();
    // Init Ø¯ÛŒØ²/Ø¨Ù…Ù„/Ø®ÙˆØ¯Ú©Ø§Ø± selector
    initAccidentalSelector();
    // Apply language
    applyI18n();
    // Init highlight effect
    initHighlightEffect();
    // Auto-check storage and show warning if needed
    setTimeout(() => {
      refreshStorageInfo();
    }, 3000);
  
    /**
     * exportAllPlaylistsToFile â€” Ø®Ø±ÙˆØ¬ÛŒ Ú©Ø§Ù…Ù„ Ù‡Ù…Ù‡ Ù¾Ù„ÛŒâ€ŒÙ„ÛŒØ³Øªâ€ŒÙ‡Ø§ Ø¯Ø± ÛŒÚ© ÙØ§ÛŒÙ„ JSON
     */
    async function exportAllPlaylistsToFile() {
      if (!arrangers || arrangers.length === 0) {
        toast('âš  Ù‡ÛŒÚ† Ù¾Ù„ÛŒâ€ŒÙ„ÛŒØ³ØªÛŒ Ø¨Ø±Ø§ÛŒ Ø®Ø±ÙˆØ¬ÛŒ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯');
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
          name: arr.name || 'Ù¾Ù„ÛŒâ€ŒÙ„ÛŒØ³Øª',
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
          toast(`âœ… Ø®Ø±ÙˆØ¬ÛŒ Ú©Ø§Ù…Ù„ Ú¯Ø±ÙØªÙ‡ Ø´Ø¯: ${fileName}`);
        } catch (e) {
          if (e.name !== 'AbortError') toast('Ø®Ø·Ø§ Ø¯Ø± Ø®Ø±ÙˆØ¬ÛŒ: ' + e.message);
        }
      } else {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        toast(`âœ… Ø®Ø±ÙˆØ¬ÛŒ Ú©Ø§Ù…Ù„ Ú¯Ø±ÙØªÙ‡ Ø´Ø¯: ${fileName}`);
      }
    }

    /**
     * importAllPlaylistsFromFile â€” ÙˆØ±ÙˆØ¯ Ú©Ø§Ù…Ù„ Ù‡Ù…Ù‡ Ù¾Ù„ÛŒâ€ŒÙ„ÛŒØ³Øªâ€ŒÙ‡Ø§ Ø§Ø² ÙØ§ÛŒÙ„ Ù¾Ø´ØªÛŒØ¨Ø§Ù†
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
            toast('âŒ ÙØ§ÛŒÙ„ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª â€” ÙØ±Ù…Øª Ù¾Ø´ØªÛŒØ¨Ø§Ù† Ù¾Ù„ÛŒâ€ŒÙ„ÛŒØ³Øª Ù†ÛŒØ³Øª');
            return;
          }

          const supportedVersions = [1, '1.0', 2, '2.0'];
          if (data.version && !supportedVersions.includes(data.version)) {
            toast(`âŒ Ù†Ø³Ø®Ù‡ ÙØ§ÛŒÙ„ (${data.version}) Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ Ù†Ù…ÛŒâ€ŒØ´ÙˆØ¯.`);
            return;
          }

          for (let i = 0; i < data.playlists.length; i++) {
            const pl = data.playlists[i];
            if (!pl || !pl.name || !pl.name.trim()) {
              toast(`âŒ Ù¾Ù„ÛŒâ€ŒÙ„ÛŒØ³Øª Ø´Ù…Ø§Ø±Ù‡ ${i + 1} Ù†Ø§Ù… Ù…Ø¹ØªØ¨Ø± Ù†Ø¯Ø§Ø±Ø¯.`);
              return;
            }
            if (!Array.isArray(pl.items)) {
              toast(`âŒ Ù¾Ù„ÛŒâ€ŒÙ„ÛŒØ³Øª Â«${pl.name}Â» Ø¢Ø±Ø§ÛŒÙ‡ items Ù…Ø¹ØªØ¨Ø± Ù†Ø¯Ø§Ø±Ø¯.`);
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
            toast(`ÙˆØ±ÙˆØ¯ Ú©Ø§Ù…Ù„ Ø§Ù†Ø¬Ø§Ù… Ù†Ø´Ø¯. Ù¾Ù„ÛŒâ€ŒÙ„ÛŒØ³Øªâ€ŒÙ‡Ø§ÛŒ Ø²ÛŒØ± Ø¯Ø§Ø±Ø§ÛŒ Ù†Ø§Ù… ØªÚ©Ø±Ø§Ø±ÛŒ Ù‡Ø³ØªÙ†Ø¯:\nÂ«${duplicateNames.join('Â»ØŒ Â«')}Â»`);
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

          toast(`âœ… ${newPlaylists.length} Ù¾Ù„ÛŒâ€ŒÙ„ÛŒØ³Øª ÙˆØ§Ø±Ø¯ Ø´Ø¯${importedSongsCount > 0 ? `ØŒ ${importedSongsCount} Ø¢Ù‡Ù†Ú¯ Ø¬Ø¯ÛŒØ¯` : ''}`);
        } catch (e) {
          console.error('[Import All] Error:', e);
          toast('âŒ Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ ÙØ§ÛŒÙ„: ' + e.message);
        }
      };
      input.click();
    }

/**
 * Ø¯Ø±ÛŒØ§ÙØª Ù…Ø³ÛŒØ± ÙØ§ÛŒÙ„ ØµÙˆØªÛŒ Ø¨Ø±Ø§ÛŒ ÛŒÚ© Ú©Ù„ÛŒÙ¾ (Ø¨Ø¯ÙˆÙ† Ù„ÙˆØ¯ Ú©Ø±Ø¯Ù†)
 */
function getClipFilePath(clip, projectFilePath = null) {
  let filePath = null;
  
  // Ø¨Ø±Ø±Ø³ÛŒ Ø­Ø§Ù„Øªâ€ŒÙ‡Ø§ÛŒ Ù…Ø®ØªÙ„Ù Ø°Ø®ÛŒØ±Ù‡â€ŒØ³Ø§Ø²ÛŒ
  if (clip.storage && clip.storage.mode === 'copy') {
    const projRoot = projectFilePath ? pathDirname(projectFilePath) : DAW.projectRoot;
    if (!projRoot || !clip.storage.projectPath) {
      return null;
    }
    filePath = (window.electronAPI?.resolvePath)
               ? window.electronAPI.resolvePath(projRoot, clip.storage.projectPath)
               : pathJoin(projRoot, clip.storage.projectPath);
  } else if (clip.storage && clip.storage.mode === 'reference') {
    filePath = clip.storage.externalPath;
  } else if (clip.relativePath) {
    const projRoot = projectFilePath ? pathDirname(projectFilePath) : DAW.projectRoot;
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

// Ø§Ø·Ù…ÛŒÙ†Ø§Ù† Ø§Ø² Ø§ÛŒÙ†Ú©Ù‡ ØªØ§Ø¨Ø¹ getClipFilePath Ø¯Ø± global scope Ù‚Ø§Ø¨Ù„ Ø¯Ø³ØªØ±Ø³ÛŒ Ù‡Ø³Øª
if (typeof window !== 'undefined') {
  window.getClipFilePath = getClipFilePath;
}

// core.js defines the bridge, while editor.js owns the editor callbacks and
// state it injects. Attach only after both scripts have finished evaluating.
if (typeof attachHistoryService === 'function') {
  attachHistoryService();
}

