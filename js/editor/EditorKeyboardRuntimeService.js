/**
 * EditorKeyboardRuntimeService
 *
 * Builds the editor keyboard runtime from grouped application callbacks.
 * The event-dispatch policy remains in EditorKeyboardService; this adapter
 * keeps app/editor.js focused on lifecycle and state ownership.
 */
(function attachEditorKeyboardRuntimeService(globalScope) {
  function create({
    keyboardService = globalScope.EditorKeyboardService,
    windowRef = globalScope,
    state = {},
    shortcuts = {},
    transport = {},
    ui = {},
    color = {},
    performance = {},
    chord = {}
  } = {}) {
    if (typeof keyboardService?.create !== 'function') return null;

    const {
      isChordModalOpen = () => false,
      isEditorChordModal = () => false,
      getChordIndex = () => null,
      isEditorLocked = () => false,
      hasSelectedChords = () => false,
      hasSelectedChordLineClip = () => false,
      isSequentialChordingActive = () => false,
      isShortcutEditing = () => false,
      isFocusMode = () => false,
      isSyncActive = () => false,
      isPerfModeActive = () => false,
      isColorToolActive = () => false,
      getMappingTarget = () => null
    } = state;
    const {
      getShortcutMatch = () => false,
      onCancelShortcutEdit = () => {},
      onFinishShortcutEdit = () => {}
    } = shortcuts;
    const {
      getDAW = () => null,
      getGridConfig = () => ({ measureDuration: 1 }),
      onSetLoopFromSelectionAndPlay = () => {},
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
      onSyncTap = () => {},
      onExitSyncMode = () => {},
      onClearSelection = () => {}
    } = transport;
    const {
      onHideCutGuide = () => {},
      onTogglePanel = () => {},
      onCancelMapping = () => {}
    } = ui;
    const {
      onToggleColorBrush = () => {},
      onToggleColorEyedropper = () => {},
      onDeactivateColorTool = () => {}
    } = color;
    const {
      onPerfStop = () => {},
      onPerfNextSong = () => {},
      onPerfPrevSong = () => {},
      onPerfRestartSong = () => {},
      onPerfToggleStageMode = () => {},
      onPerfTranspose = () => {},
      onPerfTogglePauseMode = () => {}
    } = performance;
    const {
      onCloseChordModal = () => {},
      onConfirmChord = () => {},
      onTapTempo = () => {},
      onQuantizeSelectedChords = () => {},
      onChordLineTap = () => {},
      onSequentialEnter = () => {},
      onNavigateChord = () => {},
      onMoveSelectedChords = () => {},
      onDeleteSelectedChords = () => {}
    } = chord;

    return keyboardService.create({
      windowRef,
      isChordModalOpen,
      isEditorChordModal,
      getChordIndex,
      isEditorLocked,
      hasSelectedChords,
      hasSelectedChordLineClip,
      isSequentialChordingActive,
      isShortcutEditing,
      getShortcutMatch,
      getDAW,
      getGridConfig,
      onCancelShortcutEdit,
      onFinishShortcutEdit,
      onSetLoopFromSelectionAndPlay,
      isPerfModeActive,
      onPerfTogglePlay,
      onTogglePlay,
      onUndo,
      onRedo,
      onFullscreen,
      onFocusMode,
      onSeek,
      onDeleteSelectedClips,
      onSplitSelected,
      onCopySelected,
      onCutSelected,
      onPasteClipboard,
      onSelectAllClips,
      onDuplicateSelected,
      onGoStart,
      onSetLoopFromSelection,
      onToggleLoop,
      onSetLoopA,
      onSetLoopB,
      onTogglePlayheadMode,
      onToggleMetronome,
      onToggleRecording,
      onToggleSelectedTrackHeight,
      onZoomHorizontal,
      onZoomVertical,
      onZoomToSelection,
      onZoomFull,
      isFocusMode,
      isSyncActive,
      onSyncTap,
      onExitSyncMode,
      onClearSelection,
      onHideCutGuide,
      isColorToolActive,
      onToggleColorBrush,
      onToggleColorEyedropper,
      onDeactivateColorTool,
      getMappingTarget,
      onCancelMapping,
      onTogglePanel,
      onPerfStop,
      onPerfNextSong,
      onPerfPrevSong,
      onPerfRestartSong,
      onPerfToggleStageMode,
      onPerfTranspose,
      onPerfTogglePauseMode,
      onCloseChordModal,
      onConfirmChord,
      onTapTempo,
      onQuantizeSelectedChords,
      onChordLineTap,
      onSequentialEnter,
      onNavigateChord,
      onMoveSelectedChords,
      onDeleteSelectedChords
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorKeyboardRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
