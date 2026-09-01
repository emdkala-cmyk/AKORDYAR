/**
 * EditorShortcutStoreService
 *
 * Stores editor keyboard shortcuts and MIDI-note mappings. Matching and
 * persistence stay here; editor.js keeps only compatibility wrappers and UI.
 */
(function attachEditorShortcutStoreService(globalScope) {
  const SHORTCUT_DEFAULTS = Object.freeze([
    { id: 'undo', labelKey: 'scUndo', code: 'KeyZ', ctrl: true, shift: false, alt: false },
    { id: 'redo', labelKey: 'scRedo', code: 'KeyY', ctrl: true, shift: false, alt: false },
    { id: 'play', labelKey: 'scPlay', code: 'Space', ctrl: false, shift: false, alt: false },
    { id: 'metronome', labelKey: 'scMetronome', code: 'KeyC', ctrl: false, shift: false, alt: false },
    { id: 'split', labelKey: 'scSplit', code: 'KeyS', ctrl: false, shift: false, alt: false },
    { id: 'copy', labelKey: 'scCopy', code: 'KeyC', ctrl: true, shift: false, alt: false },
    { id: 'cut', labelKey: 'scCut', code: 'KeyX', ctrl: true, shift: false, alt: false },
    { id: 'paste', labelKey: 'scPaste', code: 'KeyV', ctrl: true, shift: false, alt: false },
    { id: 'selectAll', labelKey: 'scSelectAll', code: 'KeyA', ctrl: true, shift: false, alt: false },
    { id: 'duplicate', labelKey: 'scDuplicate', code: 'KeyD', ctrl: true, shift: false, alt: false },
    { id: 'delete', label: 'حذف انتخاب‌شده', code: 'Delete', ctrl: false, shift: false, alt: false },
    { id: 'loop', labelKey: 'scLoop', code: 'NumpadDivide', ctrl: false, shift: false, alt: false },
    { id: 'loopA', labelKey: 'scLoopA', code: 'KeyI', ctrl: false, shift: false, alt: false },
    { id: 'loopB', labelKey: 'scLoopB', code: 'KeyO', ctrl: false, shift: false, alt: false },
    { id: 'fullscreen', labelKey: 'scFullscreen', code: 'F9', ctrl: false, shift: false, alt: false },
    { id: 'focusMode', labelKey: 'scFocusMode', code: 'F10', ctrl: false, shift: false, alt: false },
    { id: 'seekBack', labelKey: 'scSeekBack', code: 'ArrowLeft', ctrl: false, shift: false, alt: false },
    { id: 'seekFwd', labelKey: 'scSeekFwd', code: 'ArrowRight', ctrl: false, shift: false, alt: false },
    { id: 'goStart', labelKey: 'scGoStart', code: 'Home', ctrl: false, shift: false, alt: false },
    { id: 'setLoopFromSel', labelKey: 'scSetLoopFromSel', code: 'KeyP', ctrl: false, shift: false, alt: false },
    { id: 'zoomHOut', labelKey: 'scZoomHOut', code: 'KeyG', ctrl: false, shift: false, alt: false },
    { id: 'zoomHIn', labelKey: 'scZoomHIn', code: 'KeyH', ctrl: false, shift: false, alt: false },
    { id: 'zoomVOut', labelKey: 'scZoomVOut', code: 'KeyJ', ctrl: false, shift: false, alt: false },
    { id: 'zoomVIn', labelKey: 'scZoomVIn', code: 'KeyK', ctrl: false, shift: false, alt: false },
    { id: 'zoomToSelection', labelKey: 'scZoomToSelection', code: 'KeyS', ctrl: false, shift: false, alt: true },
    { id: 'zoomFull', labelKey: 'scZoomFull', code: 'KeyF', ctrl: false, shift: true, alt: false },
    { id: 'togglePlayheadMode', labelKey: 'scTogglePlayheadMode', code: 'KeyV', ctrl: false, shift: false, alt: false },
    { id: 'toggleRecording', labelKey: 'scToggleRecording', code: 'KeyR', ctrl: false, shift: false, alt: false },
    { id: 'toggleTrackHeight', labelKey: 'scToggleTrackHeight', code: 'KeyZ', ctrl: false, shift: false, alt: false },
    { id: 'loopPlay', labelKey: 'scLoopPlay', code: 'KeyP', ctrl: false, shift: false, alt: true },
    { id: 'colorBrush', labelKey: 'scColorBrush', code: 'KeyC', ctrl: false, shift: true, alt: false },
    { id: 'colorEyedropper', labelKey: 'scColorEyedropper', code: 'KeyC', ctrl: false, shift: false, alt: true },
    { id: 'toggleInspector', label: 'نمایش/مخفی بازرسی', code: 'ArrowLeft', ctrl: true, shift: true, alt: false },
    { id: 'toggleSidebar', label: 'نمایش/مخفی نوار جانبی', code: 'ArrowRight', ctrl: true, shift: true, alt: false },
    { id: 'toggleTimeline', label: 'نمایش/مخفی خط زمانی', code: 'ArrowDown', ctrl: true, shift: true, alt: false },
    { id: 'tapTempo', label: 'ضربه تمپو', code: 'KeyT', ctrl: false, shift: false, alt: false },
    { id: 'quantizeChords', label: 'کوانتیز آکوردها', code: 'KeyQ', ctrl: false, shift: false, alt: false },
    { id: 'stop', label: 'stop', code: 'Backspace', ctrl: true, shift: false, alt: false },
    { id: 'goEnd', label: 'رفتن به انتها', code: 'End', ctrl: false, shift: false, alt: false }
  ].map(Object.freeze));

  const KEY_NAMES = Object.freeze({
    Space: 'Space',
    Delete: 'Del',
    Backspace: 'Bksp',
    Home: 'Home',
    End: 'End',
    F9: 'F9',
    F10: 'F10',
    NumpadDivide: '/',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓'
  });

  function create({
    storage = globalScope.localStorage,
    shortcutKey = 'ed_shortcuts',
    midiMapKey = 'ed_midi_maps'
  } = {}) {
    const shortcuts = {};
    const midiMaps = {};

    function readObject(key) {
      try {
        const parsed = JSON.parse(storage?.getItem(key) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed
          : {};
      } catch (_) {
        return {};
      }
    }

    function replaceContents(target, source) {
      Object.keys(target).forEach(key => delete target[key]);
      Object.assign(target, source);
      return target;
    }

    function loadShortcuts() {
      return replaceContents(shortcuts, readObject(shortcutKey));
    }

    function saveShortcuts() {
      storage?.setItem(shortcutKey, JSON.stringify(shortcuts));
    }

    function resetShortcuts() {
      replaceContents(shortcuts, {});
      storage?.removeItem(shortcutKey);
    }

    function getShortcut(id) {
      const definition = SHORTCUT_DEFAULTS.find(item => item.id === id);
      return shortcuts[id] || (
        definition
          ? {
              code: definition.code,
              ctrl: definition.ctrl,
              shift: definition.shift,
              alt: definition.alt
            }
          : null
      );
    }

    function matchShortcut(event, id) {
      const shortcut = getShortcut(id);
      if (!shortcut) return false;
      const modifier = event.ctrlKey || event.metaKey;
      return (
        event.code === shortcut.code &&
        modifier === Boolean(shortcut.ctrl) &&
        !!event.shiftKey === Boolean(shortcut.shift) &&
        !!event.altKey === Boolean(shortcut.alt)
      );
    }

    function formatKeyName(code) {
      if (KEY_NAMES[code]) return KEY_NAMES[code];
      if (/^Key[A-Z]$/.test(code)) return code.slice(3);
      return code;
    }

    function loadMidiMaps() {
      return replaceContents(midiMaps, readObject(midiMapKey));
    }

    function saveMidiMaps() {
      storage?.setItem(midiMapKey, JSON.stringify(midiMaps));
    }

    function getMidiMap(note) {
      return midiMaps['n' + note] || null;
    }

    function setMidiMap(note, functionId) {
      midiMaps['n' + note] = functionId;
      saveMidiMaps();
    }

    function removeMidiMap(note) {
      delete midiMaps['n' + note];
      saveMidiMaps();
    }

    function clearMidiMaps() {
      replaceContents(midiMaps, {});
      saveMidiMaps();
    }

    return Object.freeze({
      shortcutDefaults: SHORTCUT_DEFAULTS,
      shortcuts,
      midiMaps,
      loadShortcuts,
      saveShortcuts,
      resetShortcuts,
      getShortcut,
      matchShortcut,
      formatKeyName,
      loadMidiMaps,
      saveMidiMaps,
      getMidiMap,
      setMidiMap,
      removeMidiMap,
      clearMidiMaps
    });
  }

  const service = Object.freeze({ create, shortcutDefaults: SHORTCUT_DEFAULTS });
  globalScope.EditorShortcutStoreService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
