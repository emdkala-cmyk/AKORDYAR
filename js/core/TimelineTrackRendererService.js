/**
 * TimelineTrackRendererService
 *
 * مالک projection مربوط به track header و lane است. تمام تغییرات runtime از
 * طریق callbackهای context انجام می‌شود تا core فقط orchestration عمومی را
 * نگه دارد.
 */
(function attachTimelineTrackRendererService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    getDAW = () => null,
    getSongState = () => null,
    getIconSvg = () => '',
    getIsRecordingChords = () => false,
    setIsRecordingChords = () => {},
    switchChordVersion = () => {},
    addChordVersion = () => {},
    renameChordVersion = () => {},
    saveState = () => {},
    renderAll = () => {},
    renderClips = () => {},
    renderMixer = () => {},
    toast = () => {},
    translate = value => value,
    openFileForTrack = () => {},
    openChordLineImporter = () => {},
    openIconPicker = () => {},
    updateTrackMix = () => {},
    scheduleAllFromPlayhead = () => {},
    ensureAudioCtx = () => {},
    startPointerDrag = () => {},
    setLaneHeight = () => {},
    clearEditorTextSelection = () => {},
    clearChordSelection = () => {},
    clearSelection = () => {},
    clientToTime = () => 0,
    customPrompt = async () => null,
    openChordEditor = () => {},
    uid = prefix => `${prefix}${Date.now()}`,
    roundMs = value => value,
    ensureTimelineFits = () => {},
    cutAtTime = () => {},
    seekTransport = () => {},
    clientToInnerPoint = () => ({ x: 0, y: 0 }),
    onDocumentMouseMove = () => {},
    onDocumentMouseUp = () => {},
    drawLaneGrid = () => {}
  } = {}) {
    const document = documentRef;
    const window = windowRef;
    const getRuntimeDAW = getDAW;
    const requireEditorSongStateService = getSongState;
    let isRecordingChords = Boolean(getIsRecordingChords());

    function updateTrackSelectionUI() {
      const selectedId = getRuntimeDAW().selectedTrackId;
      document
        .querySelectorAll('.track-name[data-track-id], .track-lane[data-track-id]')
        .forEach(element => {
          element.classList.toggle(
            'selected-track',
            element.dataset.trackId === selectedId
          );
        });
    }

    function selectTrack(trackId) {
      const track = getRuntimeDAW().tracks.find(item => item.id === trackId);
      if (!track) return null;
      getRuntimeDAW().selectedTrackId = track.id;
      updateTrackSelectionUI();
      return track;
    }

    function createSectionAt(time, trackId) {
      customPrompt('نام بخش:', 'ورس').then(name => {
        if (!name || !name.trim()) return;
        const section = {
          id: uid('c'),
          trackId,
          label: name.trim(),
          start: roundMs(time),
          duration: 4,
          color: '#3FB8AF'
        };
        getRuntimeDAW().sections.push(section);
        ensureTimelineFits(section.start + section.duration + 5);
        saveState();
        renderClips();
      });
    }

    function renderTracks() {
      const daw = getRuntimeDAW();
      const names = document.getElementById('track-names-container');
      const lanes = document.getElementById('lanes-container');
      if (!names || !lanes) return;

      names.innerHTML = '';
      lanes.innerHTML = '';
      isRecordingChords = Boolean(getIsRecordingChords());

      const tracks = daw.tracks;
      if (!tracks.some(track => track.id === daw.selectedTrackId)) {
        daw.selectedTrackId = tracks[0]?.id || null;
      }

      tracks.forEach(track => {
        const header = document.createElement('div');
        header.className =
          'track-name' +
          (daw.loadTrackId === track.id ? ' active-load' : '') +
          (daw.selectedTrackId === track.id ? ' selected-track' : '');
        header.dataset.trackId = track.id;

        if (track.muted) header.classList.add('muted-track');
        if (
          daw.tracks.some(item => item.solo) &&
          !track.solo &&
          track.type !== 'chord'
        ) {
          header.classList.add('solo-dim-track');
        }

        if (track.type === 'chord') {
          const song = requireEditorSongStateService()?.currentSong?.() || track;
          if (!Array.isArray(song.chordVersions)) song.chordVersions = [];
          const currentVersion = Number.isInteger(song.activeChordVersion)
            ? song.activeChordVersion
            : 0;

          header.innerHTML = `
            <span class="t-icon" data-icon-pick="${track.id}" title="تغییر آیکون">${getIconSvg(track.icon)}</span>
            <span class="t-label">${track.name}</span>
            <div style="display:flex;gap:2px;align-items:center;">
              <button class="t-btn" data-chord-ver-prev="" title="ورژن قبلی" style="font-size:0.55rem;">◀</button>
              <span style="font-size:0.55rem;color:var(--accent-cyan-glow);min-width:46px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-family:'JetBrains Mono';cursor:pointer;" data-chord-ver-label="" title="دوبار کلیک برای تغییر نام ورژن">${song.chordVersions[currentVersion]?.name || `V${currentVersion + 1}`}</span>
              <button class="t-btn" data-chord-ver-next="" title="ورژن بعدی" style="font-size:0.55rem;">▶</button>
              <button class="t-btn" data-chord-ver-add="" title="ورژن جدید" style="font-size:0.55rem;">+</button>
            </div>
            <button class="t-btn ${track.locked ? 'on-lock' : ''}" data-lock="${track.id}" title="قفل">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </button>
            <button class="t-btn ${isRecordingChords ? 'on-rec' : ''}" data-rec="chord" title="ضبط آکورد">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
            </button>
          `;

          const addChordLineButton = (dataKey, title, label, mode) => {
            const button = document.createElement('button');
            button.className = 't-btn';
            button.dataset[dataKey] = '';
            button.title = title;
            button.style.fontSize = '0.7rem';
            button.textContent = label;
            button.addEventListener('click', event => {
              event.stopPropagation();
              openChordLineImporter(mode);
            });
            header.insertBefore(button, header.querySelector('[data-lock]'));
          };
          addChordLineButton(
            'chordImport',
            'ورود MIDI/XML آکورد',
            '📥',
            'file'
          );
          addChordLineButton(
            'chordPaste',
            'ورود XML از کلیپ‌بورد',
            '📋',
            'clipboard'
          );

          header.querySelector('[data-rec]')?.addEventListener('click', event => {
            event.stopPropagation();
            isRecordingChords = !isRecordingChords;
            setIsRecordingChords(isRecordingChords);
            renderAll();
            toast(isRecordingChords ? translate('chordRecOn') : translate('chordRecOff'));
          });
          header.querySelector('[data-lock]')?.addEventListener('click', event => {
            event.stopPropagation();
            track.locked = !track.locked;
            saveState();
            renderTracks();
            renderClips();
            toast(track.locked ? '🔒 آکوردهای کورد لاین قفل شد' : '🔓 آکوردهای کورد لاین باز شد');
          });
          header.querySelector('[data-chord-ver-prev]')?.addEventListener('click', event => {
            event.stopPropagation();
            switchChordVersion(-1);
          });
          header.querySelector('[data-chord-ver-next]')?.addEventListener('click', event => {
            event.stopPropagation();
            switchChordVersion(1);
          });
          header.querySelector('[data-chord-ver-add]')?.addEventListener('click', event => {
            event.stopPropagation();
            addChordVersion();
          });
          header.querySelector('[data-chord-ver-label]')?.addEventListener('dblclick', event => {
            event.stopPropagation();
            renameChordVersion();
          });
        } else if (track.type === 'section') {
          header.innerHTML = `<span class="t-icon" data-icon-pick="${track.id}" title="تغییر آیکون">${getIconSvg(track.icon)}</span><span class="t-label">${track.name}</span>`;
          header.querySelector('[data-icon-pick]')?.addEventListener('click', event => {
            event.stopPropagation();
            openIconPicker(track);
          });
        } else {
          const panPct = ((track.pan + 1) / 2) * 100;
          const panLeftWidth = track.pan < 0 ? Math.abs(track.pan) * 50 : 0;
          const panRightWidth = track.pan > 0 ? track.pan * 50 : 0;
          const panColor =
            track.pan === 0
              ? '#E2E8F0'
              : track.pan < 0
                ? 'var(--accent-neon-pink)'
                : 'var(--accent-teal)';

          header.innerHTML = `
            <div class="track-name-top-row">
              <span class="t-icon" data-icon-pick="${track.id}" title="تغییر آیکون">${getIconSvg(track.icon)}</span>
              <span class="t-label" contenteditable="true" spellcheck="false" style="cursor:text;min-width:40px;outline:none;">${track.name}</span>
              <button class="t-btn" data-load="${track.id}" title="لود آهنگ" style="font-size:0.7rem;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>
            </div>
            <div class="track-name-bottom-row">
              <button class="t-btn ${track.muted ? 'on' : ''}" data-mute="${track.id}">M</button>
              <button class="t-btn ${track.solo ? 'on-solo' : ''}" data-solo="${track.id}">S</button>
              <button class="t-btn ${track.locked ? 'on-lock' : ''}" data-lock="${track.id}" title="قفل ترک"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button>
              <input type="range" class="t-vol" min="0" max="1" step="0.01" value="${track.vol}" data-vol="${track.id}">
              <div class="pan-wrap" data-pan-wrap="${track.id}">
                <div class="pan-track"><div class="pan-fill-left" style="width:${panLeftWidth}%;right:50%;"></div><div class="pan-fill-right" style="width:${panRightWidth}%;left:50%;"></div></div>
                <div class="pan-center"></div><div class="pan-thumb" style="left:${panPct}%;border-color:${panColor};"></div>
                <div class="pan-labels"><span>L</span><span>R</span></div>
              </div>
              <input type="range" class="t-pan" min="-1" max="1" step="0.01" value="${track.pan}" data-pan="${track.id}">
              <div class="t-transpose">
                <button class="t-trans-btn" data-trans-down="${track.id}" title="بمل">♭</button>
                <span class="t-trans-val" data-trans-val="${track.id}">${track.transpose || 0}</span>
                <button class="t-trans-btn" data-trans-up="${track.id}" title="دیز">♯</button>
              </div>
            </div>
          `;

          const label = header.querySelector('.t-label');
          label?.addEventListener('blur', () => {
            track.name = label.textContent.trim() || track.name;
            if (header && document.getElementById('mixerPanel')?.classList.contains('show')) renderMixer();
          });
          label?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              label.blur();
            }
          });
          label?.addEventListener('mousedown', event => event.stopPropagation());
          header.querySelector('[data-load]')?.addEventListener('click', event => {
            event.stopPropagation();
            openFileForTrack(track.id);
          });
          header.querySelector('[data-icon-pick]')?.addEventListener('click', event => {
            event.stopPropagation();
            openIconPicker(track);
          });
          header.querySelector('[data-mute]')?.addEventListener('click', event => {
            event.stopPropagation();
            track.muted = !track.muted;
            updateTrackMix(track.id);
            renderAll();
            if (getRuntimeDAW().isPlaying) scheduleAllFromPlayhead();
          });
          header.querySelector('[data-solo]')?.addEventListener('click', event => {
            event.stopPropagation();
            track.solo = !track.solo;
            getRuntimeDAW().tracks.forEach(item => updateTrackMix(item.id));
            renderAll();
            if (getRuntimeDAW().isPlaying) scheduleAllFromPlayhead();
          });
          header.querySelector('[data-lock]')?.addEventListener('click', event => {
            event.stopPropagation();
            track.locked = !track.locked;
            saveState();
            renderTracks();
            renderClips();
            toast(track.locked ? 'ترک قفل شد' : 'ترک باز شد');
          });
          header.querySelectorAll('button, input, .pan-wrap, .t-transpose').forEach(element => {
            element.draggable = false;
            element.addEventListener('mousedown', event => event.stopPropagation());
          });
          header.querySelector('[data-vol]')?.addEventListener('input', event => {
            event.stopPropagation();
            track.vol = +event.target.value;
            updateTrackMix(track.id);
          });

          const panWrap = header.querySelector(`[data-pan-wrap="${track.id}"]`);
          if (panWrap) {
            const updatePanVisual = () => {
              const panPercent = ((track.pan + 1) / 2) * 100;
              const left = track.pan < 0 ? Math.abs(track.pan) * 50 : 0;
              const right = track.pan > 0 ? track.pan * 50 : 0;
              const color = track.pan === 0 ? '#E2E8F0' : track.pan < 0 ? 'var(--accent-neon-pink)' : 'var(--accent-teal)';
              panWrap.querySelector('.pan-fill-left').style.width = `${left}%`;
              panWrap.querySelector('.pan-fill-right').style.width = `${right}%`;
              panWrap.querySelector('.pan-thumb').style.left = `${panPercent}%`;
              panWrap.querySelector('.pan-thumb').style.borderColor = color;
            };
            const onPanDrag = event => {
              const rect = panWrap.getBoundingClientRect();
              const x = (event.clientX || event.touches?.[0]?.clientX) - rect.left;
              const normalized = Math.max(-1, Math.min(1, (x / rect.width) * 2 - 1));
              track.pan = Math.round(normalized * 100) / 100;
              header.querySelector('[data-pan]').value = track.pan;
              ensureAudioCtx();
              updateTrackMix(track.id);
              updatePanVisual();
            };
            panWrap.addEventListener('pointerdown', event => {
              if (event.button !== 0) return;
              event.stopPropagation();
              event.preventDefault();
              onPanDrag(event);
              startPointerDrag(panWrap, event, onPanDrag, saveState);
            });
            panWrap.addEventListener('click', event => event.stopPropagation());
            panWrap.addEventListener('dblclick', event => {
              event.stopPropagation();
              event.preventDefault();
              track.pan = 0;
              header.querySelector('[data-pan]').value = 0;
              ensureAudioCtx();
              updateTrackMix(track.id);
              updatePanVisual();
              saveState();
            });
          }
          header.querySelector('[data-pan]')?.addEventListener('input', event => {
            event.stopPropagation();
            track.pan = +event.target.value;
            updateTrackMix(track.id);
          });

          const updateTransposeValue = () => {
            const element = header.querySelector(`[data-trans-val="${track.id}"]`);
            if (element) element.textContent = (track.transpose || 0) > 0 ? `+${track.transpose}` : `${track.transpose || 0}`;
          };
          header.querySelector(`[data-trans-down="${track.id}"]`)?.addEventListener('click', event => {
            event.stopPropagation();
            track.transpose = Math.max(-12, (track.transpose || 0) - 1);
            updateTransposeValue();
            if (getRuntimeDAW().isPlaying) scheduleAllFromPlayhead();
            saveState();
          });
          header.querySelector(`[data-trans-up="${track.id}"]`)?.addEventListener('click', event => {
            event.stopPropagation();
            track.transpose = Math.min(12, (track.transpose || 0) + 1);
            updateTransposeValue();
            if (getRuntimeDAW().isPlaying) scheduleAllFromPlayhead();
            saveState();
          });
        }

        names.appendChild(header);
        header.addEventListener('mousedown', event => {
          header.draggable = !event.target.closest('button, input, .pan-wrap, .t-label, .t-transpose, .t-btn, .t-icon');
        });
        header.addEventListener('dragstart', event => {
          if (!header.draggable) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.setData('text/plain', track.id);
          event.dataTransfer.effectAllowed = event.altKey ? 'copy' : 'move';
          header.style.opacity = '0.4';
        });
        header.addEventListener('dragend', () => { header.style.opacity = ''; });
        header.addEventListener('dragover', event => {
          event.preventDefault();
          event.dataTransfer.dropEffect = event.altKey ? 'copy' : 'move';
          header.style.borderTop = '2px solid var(--accent-teal)';
        });
        header.addEventListener('dragleave', () => { header.style.borderTop = ''; });
        header.addEventListener('drop', event => {
          event.preventDefault();
          header.style.borderTop = '';
          const draggedId = event.dataTransfer.getData('text/plain');
          if (!draggedId || draggedId === track.id) return;
          const fromIndex = daw.tracks.findIndex(item => item.id === draggedId);
          const toIndex = daw.tracks.findIndex(item => item.id === track.id);
          if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
          if (event.altKey) {
            const source = daw.tracks[fromIndex];
            const copy = JSON.parse(JSON.stringify(source));
            copy.id = uid('t');
            copy.name = `${source.name} (copy)`;
            daw.tracks.splice(toIndex + 1, 0, copy);
          } else {
            const [moved] = daw.tracks.splice(fromIndex, 1);
            daw.tracks.splice(toIndex, 0, moved);
          }
          saveState();
          renderAll();
        });

        const lane = document.createElement('div');
        lane.className =
          'track-lane' +
          (track.type === 'chord' ? ' chord-lane' : '') +
          (track.type === 'section' ? ' section-lane' : '') +
          (daw.selectedTrackId === track.id ? ' selected-track' : '');
        lane.dataset.trackId = track.id;
        if (track.laneHeight) {
          header.style.setProperty('--lane-h', `${track.laneHeight}px`);
          header.style.height = `${track.laneHeight}px`;
          lane.style.setProperty('--lane-h', `${track.laneHeight}px`);
          lane.style.height = `${track.laneHeight}px`;
        }
        if (track.muted) lane.classList.add('muted-lane');
        if (track.locked) lane.classList.add('locked-lane');
        if (daw.tracks.some(item => item.solo) && !track.solo && track.type !== 'chord') {
          lane.classList.add('solo-dim-lane');
        }

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'lane-resize-handle bottom';
        resizeHandle.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          event.stopPropagation();
          event.preventDefault();
          resizeHandle.classList.add('active');
          const startY = event.clientY;
          const originalHeight = track.laneHeight || daw.laneHeight;
          const onMove = moveEvent => {
            const nextHeight = Math.max(
              32,
              Math.min(240, originalHeight + (moveEvent.clientY - startY))
            );
            setLaneHeight(track.id, nextHeight);
          };
          startPointerDrag(resizeHandle, event, onMove, () => {
            resizeHandle.classList.remove('active');
            saveState();
          });
        });
        lane.appendChild(resizeHandle);
        lane.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          selectTrack(track.id);
          clearEditorTextSelection();
          clearChordSelection();
          if (event.target.closest('.clip') || event.target.closest('.section-tag')) return;
          if (daw.selectedSectionIds.size > 0) {
            daw.selectedSectionIds.clear();
            renderClips();
          }
          if (track.locked) {
            toast('🔒 ترک قفل است');
            return;
          }

          if (track.type === 'section' && event.altKey) {
            event.preventDefault();
            event.stopPropagation();
            createSectionAt(clientToTime(event.clientX), track.id);
            return;
          }

          if (track.type === 'chord' && event.altKey) {
            event.preventDefault();
            event.stopPropagation();
            const chordTrack = daw.tracks.find(item => item.id === track.id);
            if (chordTrack) {
              window._tempChordTrackAnchor = {
                time: clientToTime(event.clientX),
                x: event.clientX,
                y: event.clientY
              };
              window._tempChordTrack = chordTrack;
              openChordEditor(null);
              renderClips();
            }
            return;
          }

          if (track.type === 'section' && event.detail === 2) {
            event.preventDefault();
            event.stopPropagation();
            createSectionAt(clientToTime(event.clientX), track.id);
            return;
          }

          const time = clientToTime(event.clientX);
          if (event.shiftKey) {
            event.preventDefault();
            cutAtTime(time, lane.dataset.trackId);
            return;
          }

          seekTransport(time, true);
          if (!event.ctrlKey && !event.metaKey) clearSelection();
          const marqueePoint = clientToInnerPoint(event.clientX, event.clientY);
          daw.marquee = {
            // Keep the coordinate names aligned with the marquee renderer.
            // Using x/y here while the move handler reads x0/y0 produces
            // NaN bounds, which makes every clip pass the hit test.
            x0: marqueePoint.x,
            y0: marqueePoint.y,
            // Marquee selection is scoped to the lane where it starts. This
            // prevents dragging over the chord lane from selecting every
            // clip on every other track.
            trackId: track.id
          };
          startPointerDrag(lane, event, onDocumentMouseMove, onDocumentMouseUp);
        });
        if (track.type === 'chord') {
          lane.addEventListener('dragover', event => {
            const types = Array.from(event.dataTransfer?.types || []);
            const hasFile = Boolean(event.dataTransfer?.files?.length) ||
              types.includes('Files');
            const hasText = types.includes('text/plain') ||
              types.includes('text/xml') ||
              types.includes('text/uri-list');
            if (!hasFile && !hasText) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            lane.classList.add('chord-drop-target');
          });
          lane.addEventListener('dragleave', () => {
            lane.classList.remove('chord-drop-target');
          });
          lane.addEventListener('drop', event => {
            event.preventDefault();
            event.stopPropagation();
            lane.classList.remove('chord-drop-target');
            const file = event.dataTransfer?.files?.[0];
            if (file) {
              openChordLineImporter('drop', file);
              return;
            }
            const text =
              event.dataTransfer?.getData?.('text/xml') ||
              event.dataTransfer?.getData?.('text/plain') ||
              event.dataTransfer?.getData?.('text/uri-list') ||
              '';
            if (text.trim()) openChordLineImporter('drop', text);
          });
        }

        const grid = document.createElement('canvas');
        grid.className = 'lane-grid';
        lane.appendChild(grid);

        if (
          !daw.clips.some(clip => clip.trackId === track.id) &&
          !(track.type === 'section' && daw.sections.some(section => section.trackId === track.id))
        ) {
          const hint = document.createElement('div');
          hint.className = `empty-lane-hint${track.type === 'section' ? ' section-hint' : ''}`;
          hint.textContent =
            track.type === 'chord'
              ? translate('clickHint')
              : track.type === 'section'
                ? 'دوبار کلیک برای ساخت بخش'
                : translate('loadHint');
          if (track.type === 'section') {
            hint.addEventListener('dblclick', event => {
              event.preventDefault();
              event.stopPropagation();
              createSectionAt(clientToTime(event.clientX), track.id);
            });
          }
          lane.appendChild(hint);
        }

        lanes.appendChild(lane);
        drawLaneGrid(grid, track);
        header.addEventListener('click', event => {
          if (event.target.closest('button, input, select, textarea, .pan-wrap, .t-transpose, .t-icon')) return;
          selectTrack(track.id);
        });
      });
    }

    return Object.freeze({
      renderTracks,
      selectTrack,
      updateTrackSelectionUI
    });
  }

  const service = Object.freeze({ create });
  globalScope.TimelineTrackRendererService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
