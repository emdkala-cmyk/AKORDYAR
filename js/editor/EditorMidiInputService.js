/**
 * EditorMidiInputService
 *
 * Owns MIDI note handling, chord evaluation and the small UI/runtime effects
 * that follow a recognised chord. Mutable editor state is supplied through
 * accessors so this service does not depend on legacy globals.
 */
(function attachEditorMidiInputService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    notes = [],
    noteNames = notes,
    getMidiTransportService = () => null,
    getMidiChordService = () => null,
    updateMidiMonitor = () => {},
    updateMidiStatusDot = () => {},
    updateMidiChordDisplay = () => {},
    logMidiMsg = () => {},
    getActiveMidiNotes = () => new Set(),
    getMidiTimeout = () => null,
    setMidiTimeout = () => {},
    schedule = globalScope.setTimeout,
    cancel = globalScope.clearTimeout,
    getMidiLearnActive = () => false,
    handleMidiLearnInput = () => {},
    getMidiMap = () => null,
    executeMidiMappedFunction = () => {},
    getRecordingState = () => ({ active: false, clipId: null }),
    setRecordingClipId = () => {},
    getClip = () => null,
    getTimelineState = () => null,
    saveState = () => {},
    renderAll = () => {},
    renderClips = () => {},
    ensureTimelineFits = () => {},
    uid = prefix => `${prefix}${Date.now()}`,
    roundMs = value => value,
    getCurrentChord = () => null,
    setCurrentChord = () => {},
    updateChordPreview = () => {},
    getModalMode = () => null,
    getCurrentEditorSong = () => null,
    getSelectedChords = () => [],
    syncBaseChordName = () => {},
    renderEditorChords = () => {},
    commitEditor = () => {},
    getEditorSongStateService = () => null,
    getSequentialChordingActive = () => false,
    setSequentialChordingActive = () => {},
    getSequentialPoints = () => [],
    setSequentialPoints = () => {},
    getSequentialCursor = () => 0,
    setSequentialCursor = () => {},
    filterChordsWithBase = () => {},
    getSyncActive = () => false,
    setSyncActive = () => {},
    translate = key => key,
    toast = () => {},
    constants = {}
  } = {}) {
    const {
      ROOT_NOTES = [],
      CHORD_TYPES = [],
      TENSIONS = [],
      BASS_NOTES = []
    } = constants;

    function getNotes() {
      const activeNotes = getActiveMidiNotes?.();
      return activeNotes instanceof Set ? activeNotes : new Set(activeNotes || []);
    }

    function isChordModalOpen() {
      return Boolean(getElement('chord-modal')?.classList?.contains?.('show'));
    }

    function highlightPianoKey(midiNote, on) {
      const noteName =
        notes[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
      const keyElement = documentRef?.querySelector?.(
        `.piano-keyboard [data-note="${noteName}"]`
      );
      if (!keyElement) return;
      if (on) keyElement.classList?.add?.('active');
      else keyElement.classList?.remove?.('active');
    }

    function updateLiveChordEditor(chord) {
      setCurrentChord(chord);
      updateChordPreview();
      documentRef
        ?.querySelectorAll?.('.chord-item')
        ?.forEach?.(element => element.classList?.remove?.('active'));

      const rootIndex = ROOT_NOTES.indexOf(chord.root);
      const typeIndex = CHORD_TYPES.indexOf(chord.type);
      const tensionIndex = TENSIONS.indexOf(chord.tension);
      const bassIndex = BASS_NOTES.indexOf(chord.bass);
      if (rootIndex > -1) {
        documentRef
          ?.querySelector?.(`#col-root .chord-item:nth-child(${rootIndex + 1})`)
          ?.classList?.add?.('active');
      }
      if (typeIndex > -1) {
        documentRef
          ?.querySelector?.(`#col-type .chord-item:nth-child(${typeIndex + 1})`)
          ?.classList?.add?.('active');
      }
      if (tensionIndex > -1) {
        documentRef
          ?.querySelector?.(
            `#col-tension .chord-item:nth-child(${tensionIndex + 1})`
          )
          ?.classList?.add?.('active');
      }
      if (bassIndex > -1) {
        documentRef
          ?.querySelector?.(`#col-bass .chord-item:nth-child(${bassIndex + 1})`)
          ?.classList?.add?.('active');
      }
    }

    function updateChordModal(name) {
      const manual = getElement('chordManual');
      if (manual) manual.value = name;
      const preview = getElement('chord-preview');
      if (preview) preview.textContent = name;
    }

    function finishRecordedClip(clipId) {
      if (!clipId) return;
      const clip = getClip(clipId);
      const timeline = getTimelineState() || {};
      if (clip) {
        clip.duration = roundMs(
          Math.max(0.5, (timeline.playhead || 0) - clip.start)
        );
      }
      setRecordingClipId(null);
      saveState();
      renderAll();
    }

    function closeRecordedClip(clipId, playhead) {
      if (!clipId) return;
      const clip = getClip(clipId);
      if (clip) {
        clip.duration = roundMs(Math.max(0.5, playhead - clip.start));
      }
    }

    function updateSelectedEditorChords(name, isEditorChordModalOpen) {
      const song = getCurrentEditorSong();
      const selectedChords = getSelectedChords() || [];
      if (!song || selectedChords.length === 0 || isEditorChordModalOpen) {
        return;
      }
      selectedChords.forEach(index => {
        if (song.chords?.[index]) {
          song.chords[index].name = name;
          syncBaseChordName(index);
        }
      });
      renderEditorChords();
      commitEditor();
    }

    function updateSequentialChord(name, isEditorChordModalOpen) {
      if (
        !getSequentialChordingActive() ||
        !getCurrentEditorSong() ||
        isEditorChordModalOpen
      ) {
        return false;
      }

      const songState = getEditorSongStateService();
      const song = songState?.currentSong?.();
      const chords = songState?.getChords?.() || [];
      const points = getSequentialPoints() || [];
      let cursor = getSequentialCursor() || 0;
      const chordIndex = chords.length - points.length + cursor;

      if (song && chords[chordIndex]) {
        songState.setChordName?.(chordIndex, name);
        syncBaseChordName(chordIndex);
        commitEditor();
        renderEditorChords();
        if (cursor < points.length - 1) {
          cursor++;
          setSequentialCursor(cursor);
        } else {
          const sequenceStart = chords.length - points.length;
          filterChordsWithBase((chord, index) =>
            index < sequenceStart || chord.name
          );
          setSequentialChordingActive(false);
          setSequentialPoints([]);
          songState.setSeqPoints?.([]);
          commitEditor();
          renderEditorChords();
          toast(translate('chordDone'));
        }
      }
      return true;
    }

    function updateTimelineRecording(name) {
      const recording = getRecordingState() || {};
      const timeline = getTimelineState();
      if (!recording.active || !timeline) return false;

      const clipId = recording.clipId;
      const existingClip = clipId ? getClip(clipId) : null;
      if (!clipId || existingClip?.name !== name) {
        if (clipId) closeRecordedClip(clipId, timeline.playhead || 0);
        const chordTrack = timeline.tracks?.find(track => track.type === 'chord');
        if (!chordTrack) return true;

        const newClip = {
          id: uid('c'),
          type: 'chord',
          trackId: chordTrack.id,
          name,
          start: roundMs(timeline.playhead || 0),
          duration: 2,
          color: '#9F7AEA'
        };
        timeline.clips.push(newClip);
        setRecordingClipId(newClip.id);
        ensureTimelineFits(newClip.start + newClip.duration + 5);
        renderAll();
      } else {
        existingClip.duration = roundMs(
          Math.max(0.5, (timeline.playhead || 0) - existingClip.start)
        );
        renderClips();
      }
      return true;
    }

    function updateSelectedTimelineChord(name) {
      const timeline = getTimelineState();
      if (timeline?.selectedIds?.size !== 1) return;
      const selectedId = [...timeline.selectedIds][0];
      const clip = getClip(selectedId);
      if (clip && clip.type === 'chord' && clip.name !== name) {
        clip.name = name;
        renderClips();
      }
    }

    function evaluateInput() {
      const isEditorOpen = isChordModalOpen();
      const isEditorChordModalOpen =
        getModalMode() === 'editor' && isEditorOpen;
      const activeNotes = getNotes();

      if (activeNotes.size === 0) {
        const recording = getRecordingState() || {};
        if (recording.active && recording.clipId) {
          finishRecordedClip(recording.clipId);
        }
        return;
      }

      const chordService = getMidiChordService();
      const chord = chordService?.identifyChord?.([...activeNotes]);
      if (!chord) return;

      const name = chordService?.formatChordName?.(chord) || 'None';
      const noteDisplay = [...activeNotes]
        .map(
          note =>
            noteNames[note % 12] + (Math.floor(note / 12) - 1)
        )
        .join(', ');
      updateMidiChordDisplay(name, noteDisplay);
      logMidiMsg('SYS', [0, 0, 0]);

      if (isEditorOpen) updateLiveChordEditor(chord);
      if (isEditorChordModalOpen) updateChordModal(name);

      updateSelectedEditorChords(name, isEditorChordModalOpen);
      if (updateSequentialChord(name, isEditorChordModalOpen)) return;
      if (updateTimelineRecording(name)) return;
      updateSelectedTimelineChord(name);
    }

    function handleMessage(event) {
      const data = event?.data || [];
      const [status] = data;

      updateMidiMonitor(data);
      updateMidiStatusDot();

      if (getMidiTransportService()?.handleMessage?.(data)) return;

      const note = data[1];
      const velocity = data[2];
      if (status === 144 && velocity > 0) {
        if (getMidiLearnActive()) {
          handleMidiLearnInput(note);
          return;
        }
        const mappedFunction = getMidiMap(note);
        if (mappedFunction) {
          executeMidiMappedFunction(mappedFunction);
          return;
        }
        getActiveMidiNotes()?.add?.(note);
        highlightPianoKey(note, true);
      } else if (
        status === 128 ||
        (status === 144 && velocity === 0)
      ) {
        getActiveMidiNotes()?.delete?.(note);
        highlightPianoKey(note, false);
      }

      cancel(getMidiTimeout());
      setMidiTimeout(schedule(evaluateInput, 50));
    }

    function toggleSync() {
      const active = !getSyncActive();
      setSyncActive(active);
      getElement('tab-midi-sync')?.classList?.toggle?.('active-pink', active);
      const label = getElement('midiSyncLabel');
      if (label) label.textContent = active ? 'ON' : 'OFF';
      toast(active ? 'همگام‌سازی فعال شد' : 'همگام‌سازی غیرفعال شد');
      return active;
    }

    return Object.freeze({
      handleMessage,
      evaluateInput,
      highlightPianoKey,
      toggleSync
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorMidiInputService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
