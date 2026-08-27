/**
 * EditorKeyboardService
 *
 * Owns editor-specific keyboard dispatch. The service deliberately keeps
 * application actions injected so legacy wrapper names and event ordering
 * remain controlled by app/editor.js.
 */
(function attachEditorKeyboardService(globalScope) {
  function isEditableTarget(target) {
    let element = target;
    if (element?.nodeType === 3) {
      element = element.parentElement || element.parentNode;
    }

    const tagName = String(element?.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return true;
    if (element?.isContentEditable === true) return true;

    const contentEditable = String(element?.contentEditable || '').toLowerCase();
    if (
      contentEditable === 'true' ||
      contentEditable === 'plaintext-only'
    ) {
      return true;
    }

    const editableAncestor = element?.closest?.('[contenteditable]');
    if (!editableAncestor) return false;
    const ancestorValue = editableAncestor.getAttribute?.('contenteditable');
    return (
      ancestorValue == null ||
      String(ancestorValue).toLowerCase() !== 'false'
    );
  }

  function isSelectTarget(target) {
    return (
      target?.tagName === 'SELECT' ||
      Boolean(target?.closest?.('select'))
    );
  }

  function create({
    windowRef = globalScope,
    isChordModalOpen = () => false,
    isEditorChordModal = () => false,
    getChordIndex = () => null,
    isEditorLocked = () => false,
    hasSelectedChords = () => false,
    hasSelectedChordLineClip = () => false,
    isSequentialChordingActive = () => false,
    isShortcutEditing = () => false,
    getShortcutMatch = () => false,
    getDAW = () => null,
    getGridConfig = () => ({ measureDuration: 1 }),
    onCancelShortcutEdit = () => {},
    onFinishShortcutEdit = () => {},
    onSetLoopFromSelectionAndPlay = () => {},
    isPerfModeActive = () => false,
    onPerfTogglePlay = () => {},
    onTogglePlay = () => {},
    onUndo = () => {},
    onRedo = () => {},
    onFullscreen = () => {},
    onFocusMode = () => {},
    onSeek = () => {},
    onDeleteSelectedClips = () => {},
    onSplitSelected = () => {},
    onCopySelected = () => {},
    onCutSelected = () => {},
    onPasteClipboard = () => {},
    onSelectAllClips = () => {},
    onDuplicateSelected = () => {},
    onGoStart = () => {},
    onSetLoopFromSelection = () => {},
    onToggleLoop = () => {},
    onSetLoopA = () => {},
    onSetLoopB = () => {},
    onTogglePlayheadMode = () => {},
    onToggleMetronome = () => {},
    onToggleRecording = () => {},
    onToggleSelectedTrackHeight = () => {},
    onZoomHorizontal = () => {},
    onZoomVertical = () => {},
    onZoomToSelection = () => {},
    onZoomFull = () => {},
    onClearSelection = () => {},
    isFocusMode = () => false,
    isSyncActive = () => false,
    onSyncTap = () => {},
    onExitSyncMode = () => {},
    onHideCutGuide = () => {},
    isColorToolActive = () => false,
    onToggleColorBrush = () => {},
    onToggleColorEyedropper = () => {},
    onDeactivateColorTool = () => {},
    getMappingTarget = () => null,
    onCancelMapping = () => {},
    onTogglePanel = () => {},
    onPerfStop = () => {},
    onPerfNextSong = () => {},
    onPerfPrevSong = () => {},
    onPerfRestartSong = () => {},
    onPerfToggleStageMode = () => {},
    onPerfTranspose = () => {},
    onPerfTogglePauseMode = () => {},
    onCloseChordModal = () => {},
    onConfirmChord = () => {},
    onTapTempo = () => {},
    onQuantizeSelectedChords = () => {},
    onChordLineTap = () => {},
    onSequentialEnter = () => {},
    onNavigateChord = () => {},
    onMoveSelectedChords = () => {},
    onDeleteSelectedChords = () => {}
  } = {}) {
    let bound = false;

    function handleGlobalKeydownCapture(event) {
      if (isShortcutEditing()) {
        event.preventDefault?.();
        event.stopPropagation?.();
        if (event.key === 'Escape') {
          onCancelShortcutEdit(event);
          return true;
        }
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
          return true;
        }
        onFinishShortcutEdit(
          event.code,
          event.ctrlKey || event.metaKey,
          event.shiftKey,
          event
        );
        return true;
      }

      if (event.altKey && event.code === 'KeyP') {
        event.preventDefault?.();
        event.stopPropagation?.();
        onSetLoopFromSelectionAndPlay(event);
        return true;
      }

      const editable = isEditableTarget(event.target);
      const isSpace = event.code === 'Space';
      const hasModifier = event.ctrlKey || event.metaKey || event.altKey;

      // A focused native select consumes Space to open its dropdown before the
      // normal editor shortcut handler gets a chance to toggle playback.
      // Keep text fields editable, but let Space retain its transport meaning
      // when Song Properties focus is on a select control.
      if (isSpace && isSelectTarget(event.target) && !hasModifier) {
        event.preventDefault?.();
        event.stopPropagation?.();
        if (isPerfModeActive()) onPerfTogglePlay(event);
        else onTogglePlay(event);
        return true;
      }

      if (
        isSpace &&
        isPerfModeActive() &&
        !editable
      ) {
        event.preventDefault?.();
        event.stopPropagation?.();
        onPerfTogglePlay(event);
        return true;
      }

      if (
        isSpace &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !editable &&
        !event.target?.closest?.('.arr-perf-panel')
      ) {
        event.preventDefault?.();
        event.stopPropagation?.();
        onTogglePlay(event);
        return true;
      }

      if (event.ctrlKey && event.shiftKey && event.altKey) {
        event.preventDefault?.();
        event.stopPropagation?.();
        return true;
      }

      return false;
    }

    function handleGlobalKeydown(event) {
      if (isShortcutEditing()) return false;

      const editable = isEditableTarget(event.target);
      const daw = getDAW() || {};
      const selectedClipCount = Number(daw.selectedIds?.size) || 0;

      if (
        event.code === 'Space' &&
        event.ctrlKey &&
        isSyncActive() &&
        !editable
      ) {
        event.preventDefault?.();
        onSyncTap(event);
        return true;
      }

      if (getShortcutMatch(event, 'undo')) {
        event.preventDefault?.();
        onUndo(event);
        return true;
      }
      if (getShortcutMatch(event, 'redo')) {
        event.preventDefault?.();
        onRedo(event);
        return true;
      }
      if (getShortcutMatch(event, 'fullscreen')) {
        event.preventDefault?.();
        onFullscreen(event);
        return true;
      }
      if (getShortcutMatch(event, 'focusMode')) {
        event.preventDefault?.();
        onFocusMode(event);
        return true;
      }

      if (
        !editable &&
        !isChordModalOpen() &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        (event.code === 'KeyG' || event.code === 'KeyH')
      ) {
        event.preventDefault?.();
        onZoomHorizontal(event.code === 'KeyH', event);
        return true;
      }

      if (
        !editable &&
        !isChordModalOpen() &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        (event.code === 'KeyJ' || event.code === 'KeyK')
      ) {
        event.preventDefault?.();
        onZoomVertical(event.code === 'KeyK', event);
        return true;
      }

      if (
        !editable &&
        !isChordModalOpen() &&
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.code === 'KeyS'
      ) {
        event.preventDefault?.();
        onZoomToSelection(event);
        return true;
      }

      if (
        !editable &&
        !isChordModalOpen() &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.code === 'KeyF'
      ) {
        event.preventDefault?.();
        onZoomFull(event);
        return true;
      }

      if (
        (event.code === 'ArrowLeft' || event.code === 'ArrowRight') &&
        !editable &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        if (isChordModalOpen()) return false;
        if (hasSelectedChords() && getDAW()) return false;
        const config = getGridConfig() || {};
        const step = event.shiftKey
          ? (Number(config.measureDuration) || 0.05)
          : 0.05;
        event.preventDefault?.();
        onSeek(
          (Number(daw.playhead) || 0) +
            (event.code === 'ArrowRight' ? step : -step),
          true,
          true,
          event
        );
        return true;
      }

      if (
        getShortcutMatch(event, 'delete') &&
        !editable &&
        selectedClipCount > 0
      ) {
        event.preventDefault?.();
        onDeleteSelectedClips(event);
        return true;
      }

      if (editable) return false;

      if (getShortcutMatch(event, 'delete')) {
        event.preventDefault?.();
        onDeleteSelectedClips(event);
      } else if (getShortcutMatch(event, 'split')) {
        event.preventDefault?.();
        onSplitSelected(event);
      } else if (getShortcutMatch(event, 'copy')) {
        event.preventDefault?.();
        onCopySelected(event);
      } else if (getShortcutMatch(event, 'cut')) {
        event.preventDefault?.();
        onCutSelected(event);
      } else if (getShortcutMatch(event, 'paste')) {
        event.preventDefault?.();
        onPasteClipboard(event);
      } else if (getShortcutMatch(event, 'selectAll')) {
        event.preventDefault?.();
        onSelectAllClips(event);
      } else if (getShortcutMatch(event, 'duplicate')) {
        event.preventDefault?.();
        onDuplicateSelected(event);
      } else if (getShortcutMatch(event, 'goStart')) {
        onGoStart(event);
      } else if (getShortcutMatch(event, 'setLoopFromSel')) {
        event.preventDefault?.();
        onSetLoopFromSelection(event);
      } else if (getShortcutMatch(event, 'loop')) {
        event.preventDefault?.();
        onToggleLoop(event);
      } else if (getShortcutMatch(event, 'loopA')) {
        event.preventDefault?.();
        onSetLoopA(event);
      } else if (getShortcutMatch(event, 'loopB')) {
        event.preventDefault?.();
        onSetLoopB(event);
      } else if (
        getShortcutMatch(event, 'metronome') &&
        !event.altKey
      ) {
        event.preventDefault?.();
        onToggleMetronome(event);
      } else if (
        event.code === 'KeyV' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault?.();
        onTogglePlayheadMode(event);
      } else if (
        event.code === 'KeyR' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault?.();
        onToggleRecording(event);
      } else if (
        event.code === 'KeyZ' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault?.();
        onToggleSelectedTrackHeight(event);
      } else if (event.key === 'Escape') {
        if (isFocusMode()) {
          onFocusMode(event);
          return true;
        }
        if (isSyncActive()) {
          onExitSyncMode(event);
          return true;
        }
        onClearSelection(event);
      }

      return false;
    }

    function handleGlobalKeyup(event) {
      if (event.key === 'Shift') onHideCutGuide(event);
    }

    function handleAuxiliaryKeydown(event) {
      if (isEditableTarget(event?.target)) return false;

      const key = String(event.key || '').toLowerCase();
      if (
        key === 'c' &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault?.();
        onToggleColorBrush(event);
      }
      if (key === 'c' && event.altKey) {
        event.preventDefault?.();
        onToggleColorEyedropper(event);
      }
      if (event.key === 'Escape' && isColorToolActive()) {
        onDeactivateColorTool(event);
      }
      if (event.key === 'Escape' && getMappingTarget()) {
        onCancelMapping(event);
      }
      if (event.key === 'Escape' && isPerfModeActive()) {
        onPerfStop(event);
        return true;
      }

      if (event.shiftKey && (event.ctrlKey || event.metaKey)) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault?.();
          onTogglePanel('inspector', event);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault?.();
          onTogglePanel('sidebar', event);
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault?.();
          onTogglePanel('timeline', event);
        }
      }

      if (isPerfModeActive()) {
        if (event.key === 'ArrowRight' && !event.ctrlKey) {
          event.preventDefault?.();
          onPerfNextSong(event);
        }
        if (event.key === 'ArrowLeft' && !event.ctrlKey) {
          event.preventDefault?.();
          onPerfPrevSong(event);
        }
        if (event.key === 'r' || event.key === 'R') {
          event.preventDefault?.();
          onPerfRestartSong(event);
        }
        if (event.key === 'F11') {
          event.preventDefault?.();
          onPerfToggleStageMode(event);
        }
        if (event.key === '+' || event.key === '=') {
          event.preventDefault?.();
          onPerfTranspose(1, event);
        }
        if (event.key === '-') {
          event.preventDefault?.();
          onPerfTranspose(-1, event);
        }
        if (event.key === 'n' || event.key === 'N') {
          event.preventDefault?.();
          onPerfTogglePauseMode(event);
        }
      }

      return false;
    }

    function handleKeydown(event) {
      const editable = isEditableTarget(event?.target);
      const modalOpen = Boolean(isChordModalOpen());
      const editorModal = modalOpen && Boolean(isEditorChordModal());

      if (
        event.key === 'Escape' &&
        editorModal
      ) {
        onCloseChordModal(event);
        return true;
      }

      if (
        event.code === 'Enter' &&
        editorModal
      ) {
        event.preventDefault?.();
        onConfirmChord(event);
        return true;
      }

      if (
        event.key === 't' &&
        !editable &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault?.();
        onTapTempo(event);
        return true;
      }

      if (
        event.code === 'KeyQ' &&
        !editable &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        hasSelectedChordLineClip()
      ) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        onQuantizeSelectedChords(event);
        return true;
      }

      if (
        (event.code === 'Digit0' || event.code === 'Numpad0') &&
        isSequentialChordingActive() &&
        !editable &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault?.();
        onChordLineTap(event);
        return true;
      }

      if (
        isSequentialChordingActive() &&
        event.code === 'Enter' &&
        !editable &&
        !(
          modalOpen &&
          editorModal
        )
      ) {
        event.preventDefault?.();
        onSequentialEnter(event);
        return true;
      }

      const chordIndex = getChordIndex();
      if (
        modalOpen &&
        editorModal &&
        chordIndex !== null &&
        chordIndex !== undefined &&
        !editable
      ) {
        if (event.code === 'ArrowRight') {
          event.preventDefault?.();
          onNavigateChord(1, event);
          return true;
        }
        if (event.code === 'ArrowLeft') {
          event.preventDefault?.();
          onNavigateChord(-1, event);
          return true;
        }
      }

      if (
        hasSelectedChords() &&
        (event.code === 'ArrowLeft' || event.code === 'ArrowRight') &&
        !editorModal &&
        !editable &&
        !isEditorLocked()
      ) {
        event.preventDefault?.();
        onMoveSelectedChords(
          event.code === 'ArrowRight' ? 'right' : 'left',
          event
        );
        return true;
      }

      if (
        (event.code === 'Delete' || event.code === 'Backspace') &&
        hasSelectedChords() &&
        !editorModal &&
        !editable &&
        !isEditorLocked()
      ) {
        event.preventDefault?.();
        onDeleteSelectedChords(event);
        return true;
      }

      return false;
    }

    function bind() {
      if (bound || !windowRef?.addEventListener) return;
      bound = true;
      windowRef.addEventListener('keydown', handleKeydown);
    }

    function destroy() {
      if (!bound || !windowRef?.removeEventListener) return;
      windowRef.removeEventListener('keydown', handleKeydown);
      bound = false;
    }

    return Object.freeze({
      bind,
      destroy,
      handleKeydown,
      handleGlobalKeydownCapture,
      handleGlobalKeydown,
      handleGlobalKeyup,
      handleAuxiliaryKeydown,
      isBound: () => bound
    });
  }

  globalScope.EditorKeyboardService = Object.freeze({
    create,
    isEditableTarget
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.EditorKeyboardService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
