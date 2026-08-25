/**
 * EditorChordModalService
 *
 * Owns the DOM/state orchestration for the lyrics chord modal.
 * Chord-name parsing and song mutation remain in EditorChordCommandService
 * and editor.js respectively.
 */
(function attachEditorChordModalService(globalScope) {
  const EMPTY_CHORD = Object.freeze({
    root: 'None',
    type: 'None',
    tension: '',
    bass: 'None'
  });

  function create({
    getElement = id => globalScope.document?.getElementById?.(id),
    getSong = () => null,
    getChordCommandService = () => null,
    getCurrentChord = () => EMPTY_CHORD,
    setCurrentChord = () => {},
    getMode = () => null,
    setMode = () => {},
    getChordIndex = () => null,
    setChordIndex = () => {},
    setPendingAnchor = () => {},
    buildEditor = () => {},
    translate = key => key
  } = {}) {
    function open(index) {
      const song = getSong();
      if (!song) return false;

      setChordIndex(index);
      setMode('editor');

      const existingChord =
        index !== null && song.chords?.[index] ? song.chords[index] : null;
      const parsed = existingChord
        ? getChordCommandService()?.parseName?.(existingChord.name)
        : null;
      setCurrentChord(parsed || { ...EMPTY_CHORD });

      const title = getElement('chordModalTitle');
      const confirmButton = getElement('chordModalConfirmBtn');
      const preview = getElement('chord-preview');
      const manualInput = getElement('chordManual');
      if (title) title.textContent = translate('editSongChord');
      if (confirmButton) confirmButton.textContent = translate('confirmBtn');

      const currentChordName = existingChord?.name || '';
      if (preview) preview.textContent = currentChordName || 'None';
      if (manualInput) manualInput.value = currentChordName;

      const modal = getElement('chord-modal');
      if (!modal) return false;
      modal.classList.add('show');
      buildEditor(getCurrentChord());

      if (modal._escHandlerEd) {
        modal.removeEventListener('keydown', modal._escHandlerEd);
      }
      modal._escHandlerEd = event => {
        if (event.key !== 'Escape' || getMode() !== 'editor') return;
        event.preventDefault();
        close();
      };
      modal.addEventListener('keydown', modal._escHandlerEd);
      modal.focus?.();
      return true;
    }

    function close() {
      const modal = getElement('chord-modal');
      modal?.classList.remove('show');
      setPendingAnchor(null);
      setChordIndex(null);
      setMode(null);
      return true;
    }

    return Object.freeze({ open, close });
  }

  const service = Object.freeze({ create });
  globalScope.EditorChordModalService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
