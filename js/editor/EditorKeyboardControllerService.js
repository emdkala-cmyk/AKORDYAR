/**
 * EditorKeyboardControllerService
 *
 * Keeps keyboard-runtime composition outside app/editor.js. The application
 * still owns state and domain actions; this controller only adapts them to
 * EditorKeyboardRuntimeService and creates the runtime lazily.
 */
(function attachEditorKeyboardControllerService(globalScope) {
  const noop = () => {};

  function create({
    runtimeService = globalScope.EditorKeyboardRuntimeService,
    windowRef = globalScope,
    state = {},
    shortcuts = {},
    actions = {},
    ui = {},
    color = {},
    performance = {},
    chord = {},
    services = {}
  } = {}) {
    if (typeof runtimeService?.create !== 'function') return null;

    const action = (name, fallback = noop) =>
      typeof actions[name] === 'function' ? actions[name] : fallback;
    const stateValue = (name, fallback = () => false) =>
      typeof state[name] === 'function' ? state[name] : fallback;
    const shortcut = (name, fallback = noop) =>
      typeof shortcuts[name] === 'function' ? shortcuts[name] : fallback;
    const uiAction = (name, fallback = noop) =>
      typeof ui[name] === 'function' ? ui[name] : fallback;
    const colorAction = (name, fallback = noop) =>
      typeof color[name] === 'function' ? color[name] : fallback;
    const performanceAction = (name, fallback = noop) =>
      typeof performance[name] === 'function'
        ? performance[name]
        : fallback;
    const chordAction = (name, fallback = noop) =>
      typeof chord[name] === 'function' ? chord[name] : fallback;
    const service = (name, fallback = noop) =>
      typeof services[name] === 'function' ? services[name] : fallback;

    let keyboardRuntime = null;

    function createRuntime() {
      const getDAW = action('getDAW');
      const getElement = service(
        'getElement',
        id => windowRef.document?.getElementById(id)
      );
      const getCurrentSong = stateValue('getCurrentSong', () => null);
      const getSelectedChords = stateValue('getSelectedChords', () => []);
      const getSequencePoints = stateValue('getSequencePoints', () => []);
      const getSequenceCursor = stateValue('getSequenceCursor', () => 0);
      const getMutationService = service('getMutationService');
      const getSongStateService = service('getSongStateService');
      const renderChords = service('renderChords');
      const commit = service('commit');
      const clearChordSelection = service('clearChordSelection');

      const onFullscreen = () => {
        const daw = getDAW() || {};
        action('openLyricOnlyPopup')();
        // Build Player View before starting transport. Waiting 300 ms here
        // made the first popup frame inherit a later playhead position.
        action('openLyricPopup')();
        if (!daw.isPlaying) {
          action('ensureAudioCtx')();
          if (daw.playhead <= 0) action('seekTransport')(0, false);
          action('startTransport')();
        }
      };

      const onSelectAllClips = () => {
        const daw = getDAW() || {};
        action('setSelection')((daw.clips || []).map(clip => clip.id));
      };

      const onExitSyncMode = event => {
        action('exitSyncMode')(event);
        getElement('tab-sync')?.classList.remove('active-teal');
      };

      const onSequentialEnter = () => {
        const chords = getSongStateService()?.getChords?.() || [];
        const seqIdx =
          chords.length - getSequencePoints().length + getSequenceCursor();
        action('openChordModal')(seqIdx);
      };

      const onMoveSelectedChords = direction => {
        const changed = getMutationService()?.moveChords(
          getCurrentSong(),
          getSelectedChords(),
          direction,
          lineIndex =>
            getElement('editor')?.children[lineIndex]?.textContent
              ?.replace(/\u200B/g, '').length || 0,
          service('isEditorVisualRTL', () => false)()
        )?.changed;
        if (changed) {
          renderChords();
          commit();
        }
      };

      const onDeleteSelectedChords = () => {
        const deleted = getMutationService()?.deleteChords(
          getCurrentSong(),
          getSelectedChords()
        )?.changed;
        if (deleted) {
          clearChordSelection();
          renderChords();
          commit();
        }
      };

      return runtimeService.create({
        windowRef,
        state: {
          isChordModalOpen: stateValue('isChordModalOpen'),
          isEditorChordModal: stateValue('isEditorChordModal'),
          getChordIndex: stateValue('getChordIndex', () => null),
          isEditorLocked: stateValue('isEditorLocked'),
          hasSelectedChords: stateValue('hasSelectedChords'),
          hasSelectedChordLineClip: stateValue('hasSelectedChordLineClip'),
          isSequentialChordingActive: stateValue(
            'isSequentialChordingActive'
          ),
          isShortcutEditing: stateValue('isShortcutEditing'),
          isFocusMode: stateValue('isFocusMode'),
          isSyncActive: stateValue('isSyncActive'),
          isPerfModeActive: stateValue('isPerfModeActive'),
          isColorToolActive: stateValue('isColorToolActive'),
          getMappingTarget: stateValue('getMappingTarget', () => null)
        },
        shortcuts: {
          getShortcutMatch: shortcut('getShortcutMatch', () => false),
          onCancelShortcutEdit: shortcut('onCancelShortcutEdit'),
          onFinishShortcutEdit: shortcut('onFinishShortcutEdit')
        },
        transport: {
          getDAW,
          getGridConfig: action('getGridConfig', () => ({
            measureDuration: 1
          })),
          onSetLoopFromSelectionAndPlay: action(
            'setLoopFromSelectionAndPlay'
          ),
          onPerfTogglePlay: action('perfTogglePlay'),
          onTogglePlay: action('togglePlay'),
          onUndo: action('undo'),
          onRedo: action('redo'),
          onFullscreen,
          onFocusMode: action('toggleFocusMode'),
          onSeek: action('seekTransport'),
          onDeleteSelectedClips: action('deleteSelectedClips'),
          onSplitSelected: action('splitSelectedAtPlayhead'),
          onCopySelected: action('copySelected'),
          onCutSelected: action('cutSelected'),
          onPasteClipboard: action('pasteClipboard'),
          onSelectAllClips,
          onDuplicateSelected: action('duplicateSelected'),
          onGoStart: action('transportToStart'),
          onSetLoopFromSelection: action('setLoopFromSelection'),
          onToggleLoop: action('toggleLoop'),
          onSetLoopA: action('setLoopA'),
          onSetLoopB: action('setLoopB'),
          onTogglePlayheadMode: action('togglePlayheadMode'),
          onToggleMetronome: action('toggleMetronome'),
          onToggleSnap: action('toggleSnap'),
          onToggleRecording: action('toggleRecording'),
          onToggleSelectedTrackHeight: action('toggleSelectedTrackHeight'),
          onZoomHorizontal: zoomIn =>
            action('zoomHorizontal')(zoomIn ? 1 : -1),
          onZoomVertical: zoomIn =>
            action('zoomVertical')(zoomIn ? 1 : -1),
          onZoomToSelection: action('zoomToSelection'),
          onZoomFull: action('zoomFull'),
          onSyncTap: action('syncTap'),
          onExitSyncMode,
          onClearSelection: action('clearSelection')
        },
        ui: {
          onHideCutGuide: uiAction('hideCutGuide'),
          onCancelMapping: uiAction('cancelMapping'),
          onTogglePanel: uiAction('togglePanel')
        },
        color: {
          onToggleColorBrush: colorAction('toggleBrush'),
          onToggleColorEyedropper: colorAction('toggleEyedropper'),
          onDeactivateColorTool: colorAction('deactivate')
        },
        performance: {
          onPerfStop: performanceAction('stop'),
          onPerfNextSong: performanceAction('nextSong'),
          onPerfPrevSong: performanceAction('previousSong'),
          onPerfRestartSong: performanceAction('restartSong'),
          onPerfToggleStageMode: performanceAction('toggleStageMode'),
          onPerfTranspose: performanceAction('transpose'),
          onPerfTogglePauseMode: performanceAction('togglePauseMode')
        },
        chord: {
          onCloseChordModal: chordAction('closeModal'),
          onConfirmChord: chordAction('confirm'),
          onTapTempo: chordAction('tapTempo'),
          onQuantizeSelectedChords: chordAction('quantize'),
          onChordLineTap: chordAction('lineTap'),
          onSequentialEnter,
          onNavigateChord: chordAction('navigate'),
          onMoveSelectedChords,
          onDeleteSelectedChords
        }
      });
    }

    return Object.freeze({
      get() {
        if (!keyboardRuntime) keyboardRuntime = createRuntime();
        return keyboardRuntime;
      }
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorKeyboardControllerService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
