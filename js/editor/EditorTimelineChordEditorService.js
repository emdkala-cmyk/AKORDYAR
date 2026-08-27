/**
 * EditorTimelineChordEditorService
 *
 * Owns the timeline chord modal UI while receiving editor state and
 * persistence/render callbacks from editor.js.
 */
(function attachEditorTimelineChordEditorService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    getElement = id => documentRef?.getElementById?.(id),
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || {},
    getClip = () => null,
    getMidiChordService = () => null,
    getCurrentChord = () => ({
      root: 'None',
      type: 'None',
      tension: '',
      bass: 'None'
    }),
    setCurrentChord = () => {},
    getModalMode = () => null,
    setModalMode = () => {},
    setChordIndex = () => {},
    setPendingAnchor = () => {},
    confirmEditorChord = () => {},
    deleteEditorChord = () => {},
    saveState = () => {},
    renderClips = () => {},
    renderAll = () => {},
    ensureTimelineFits = () => {},
    saveSong = () => {},
    uid = prefix => `${prefix}${Date.now()}`,
    roundMs = value => value,
    translate = key => key,
    toast = () => {},
    constants = {}
  } = {}) {
    const {
      ROOT_NOTES = [],
      BASS_NOTES = [],
      NOTE_TO_SHARP = {},
      NOTE_SEMITONE = {},
      NOTES = [],
      CHORD_TYPES = [],
      TENSIONS = [],
      CHORD_INTERVALS = {},
      TENSION_INTERVALS = []
    } = constants;

    function buildPiano() {
      const piano = getElement('piano-keys');
      if (!piano) return;
      piano.innerHTML = '';
      const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      const blackNotes = { 'C#': 0, 'D#': 1, 'F#': 3, 'G#': 4, 'A#': 5 };
      for (let octave = 4; octave <= 5; octave++) {
        whiteNotes.forEach(note => {
          const key = documentRef.createElement('div');
          key.className = 'white-key';
          key.dataset.note = note + octave;
          key.textContent = note + octave;
          piano.appendChild(key);
        });
      }
      const whiteWidth = 100 / 14;
      for (let octave = 4; octave <= 5; octave++) {
        const position = (octave - 4) * 7;
        for (const [note, index] of Object.entries(blackNotes)) {
          const key = documentRef.createElement('div');
          key.className = 'black-key';
          key.dataset.note = note + octave;
          key.textContent = note + octave;
          key.style.left =
            `calc(${(position + index + 1) * whiteWidth}% - 12px)`;
          piano.appendChild(key);
        }
      }
    }

    function updateChordPreview() {
      const currentChord = getCurrentChord();
      const name =
        getMidiChordService()?.formatChordName?.(currentChord) || 'None';
      const { root, type, tension, bass } = currentChord;
      const preview = getElement('chord-preview');
      if (preview) preview.textContent = name;
      const manual = getElement('chordManual');
      if (manual) manual.value = name === 'None' ? '' : name;

      documentRef
        .querySelectorAll?.(
          '.piano-keyboard .white-key, .piano-keyboard .black-key'
        )
        ?.forEach?.(key => key.classList?.remove?.('active'));
      if (name === '') return;

      const rootIndex =
        NOTE_SEMITONE[root] != null ? NOTE_SEMITONE[root] : NOTES.indexOf(root);
      const intervals = [
        ...(CHORD_INTERVALS[type] || []),
        ...(TENSION_INTERVALS[tension] || [])
      ];
      intervals.forEach(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        const noteName = NOTES[noteIndex];
        documentRef
          .querySelector?.(
            `.piano-keyboard [data-note="${noteName}4"]`
          )
          ?.classList?.add?.('active');
        documentRef
          .querySelector?.(
            `.piano-keyboard [data-note="${noteName}5"]`
          )
          ?.classList?.add?.('active');
      });
      if (bass !== 'None' && bass !== root) {
        const bassSharp = NOTE_TO_SHARP[bass] || bass;
        documentRef
          .querySelector?.(
            `.piano-keyboard [data-note="${bassSharp}4"]`
          )
          ?.classList?.add?.('active');
        documentRef
          .querySelector?.(
            `.piano-keyboard [data-note="${bassSharp}5"]`
          )
          ?.classList?.add?.('active');
      }
    }

    function buildChordEditor() {
      const currentChord = getCurrentChord();
      const fillColumn = (columnId, values, key) => {
        const column = getElement(columnId);
        if (!column) return;
        column.innerHTML = '';
        values.forEach(value => {
          const item = documentRef.createElement('div');
          item.className =
            'chord-item' + (currentChord[key] === value ? ' active' : '');
          item.textContent =
            value === '' || value === 'None' ? 'None' : value;
          item.onclick = () => {
            currentChord[key] = value;
            column
              .querySelectorAll?.('.chord-item')
              ?.forEach?.(element =>
                element.classList?.remove?.('active')
              );
            item.classList?.add?.('active');
            updateChordPreview();
          };
          column.appendChild(item);
        });
      };
      fillColumn('col-root', ROOT_NOTES, 'root');
      fillColumn('col-type', CHORD_TYPES, 'type');
      fillColumn('col-tension', TENSIONS, 'tension');
      fillColumn('col-bass', BASS_NOTES, 'bass');
      buildPiano();
      updateChordPreview();
    }

    function closeChordEditor() {
      getElement('chord-modal')?.classList?.remove?.('show');
      const daw = getDAW();
      daw.editingChordClipId = null;
      if (getModalMode?.() === 'editor') {
        setModalMode(null);
        setChordIndex(null);
        setPendingAnchor(null);
      }
    }

    function openChordEditor(clipId = null) {
      const daw = getDAW();
      daw.editingChordClipId = clipId;
      setModalMode(null);
      if (clipId) {
        const clip = getClip(clipId);
        const match = clip?.name?.match(
          /^([A-G][#b]?)(maj|m(?:in)?|dim|aug|sus2|sus4)?(M7|7|9|b9|#9|11|#11|13|6)?(?:\/([A-G][#b]?))?$/
        );
        if (match) {
          let type = match[2] || 'None';
          if (type === 'm') type = 'min';
          setCurrentChord({
            root: match[1] || 'None',
            type,
            tension: match[3] || '',
            bass: match[4] || 'None'
          });
        } else {
          setCurrentChord({
            root: 'None',
            type: 'None',
            tension: '',
            bass: 'None'
          });
        }
      } else {
        setCurrentChord({
          root: 'None',
          type: 'None',
          tension: '',
          bass: 'None'
        });
      }

      const title = getElement('chordModalTitle');
      if (title) title.textContent = translate('chordEditor');
      const confirm = getElement('chordModalConfirmBtn');
      if (confirm) confirm.textContent = translate('placeOnTimeline');
      getElement('chord-modal')?.classList?.add?.('show');
      buildChordEditor();

      const chordModal = getElement('chord-modal');
      if (!chordModal) return;
      if (chordModal._escHandler) {
        chordModal.removeEventListener?.('keydown', chordModal._escHandler);
      }
      chordModal._escHandler = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeChordEditor();
        }
      };
      chordModal.addEventListener?.('keydown', chordModal._escHandler);
      chordModal.focus?.();
    }

    function chordModalConfirm() {
      if (getModalMode?.() === 'editor') confirmEditorChord();
      else placeChordOnTimeline();
    }

    function chordModalDelete() {
      if (getModalMode?.() === 'editor') {
        deleteEditorChord();
        return;
      }
      const daw = getDAW();
      if (daw.editingChordClipId) {
        const clip = getClip(daw.editingChordClipId);
        if (clip) {
          clip.name = '';
          renderClips();
          saveState();
        }
      }
      closeChordEditor();
    }

    function placeChordOnTimeline() {
      const manualElement = getElement('chordManual');
      let name = (manualElement?.value || '').trim();
      if (name) {
        name = name.replace(/^([A-G][#b]?)maj$/, '$1');
        name = name.replace(/^([A-G][#b]?)min/i, '$1m');
      } else {
        const currentChord = getCurrentChord();
        const { root, type } = currentChord;
        if (root === 'None' || type === 'None') {
          toast(translate('selectCompleteChord'));
          return;
        }
        name =
          getMidiChordService()?.formatChordName?.(currentChord) || 'None';
      }

      const daw = getDAW();
      if (daw.editingChordClipId) {
        const clip = getClip(daw.editingChordClipId);
        if (clip) {
          clip.name = name;
          daw.editingChordClipId = null;
          saveState();
          renderAll();
          closeChordEditor();
          toast(`${translate('chordEditedTo')} ${name}`);
          return;
        }
      }

      let targetTime = daw.playhead;
      if (windowRef._tempChordTrackAnchor && windowRef._tempChordTrack) {
        targetTime = windowRef._tempChordTrackAnchor.time;
        delete windowRef._tempChordTrackAnchor;
        delete windowRef._tempChordTrack;
      }
      const chordTrack = daw.tracks.find(track => track.type === 'chord');
      if (!chordTrack) return;
      const clip = {
        id: uid('c'),
        type: 'chord',
        trackId: chordTrack.id,
        name,
        start: roundMs(targetTime),
        duration: 4,
        color: '#9F7AEA'
      };
      daw.clips.push(clip);
      daw.selectedIds = new Set([clip.id]);
      saveState();
      ensureTimelineFits(clip.start + clip.duration + 5);
      renderAll();
      closeChordEditor();
      toast(`${translate('chordPlaced')} ${name}`);
      saveSong();
    }

    return Object.freeze({
      buildChordEditor,
      buildPiano,
      updateChordPreview,
      openChordEditor,
      closeChordEditor,
      chordModalConfirm,
      chordModalDelete,
      placeChordOnTimeline
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorTimelineChordEditorService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
