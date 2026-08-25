/**
 * EditorShortcutStoreService
 *
 * Stores editor keyboard shortcuts and MIDI-note mappings. Matching and
 * persistence stay here; editor.js keeps only compatibility wrappers and UI.
 */
(function attachEditorShortcutStoreService(globalScope) {
  const SHORTCUT_DEFAULTS = Object.freeze([
    { id: 'undo', label: 'برگشت (Undo)', code: 'KeyZ', ctrl: true, shift: false },
    { id: 'redo', label: 'جلو (Redo)', code: 'KeyY', ctrl: true, shift: false },
    { id: 'play', label: 'پخش / توقف', code: 'Space', ctrl: false, shift: false },
    { id: 'metronome', label: 'روشن/خاموش مترونوم', code: 'KeyC', ctrl: false, shift: false },
    { id: 'split', label: 'برش در پخشگر', code: 'KeyS', ctrl: false, shift: false },
    { id: 'copy', label: 'کپی', code: 'KeyC', ctrl: true, shift: false },
    { id: 'cut', label: 'بریدن', code: 'KeyX', ctrl: true, shift: false },
    { id: 'paste', label: 'چسباندن', code: 'KeyV', ctrl: true, shift: false },
    { id: 'selectAll', label: 'انتخاب همه', code: 'KeyA', ctrl: true, shift: false },
    { id: 'duplicate', label: 'کپی + چسباندن', code: 'KeyD', ctrl: true, shift: false },
    { id: 'delete', label: 'حذف انتخاب‌شده', code: 'Delete', ctrl: false, shift: false },
    { id: 'loop', label: 'روشن/خاموش حلقه', code: 'NumpadDivide', ctrl: false, shift: false },
    { id: 'loopA', label: 'شروع حلقه', code: 'KeyI', ctrl: false, shift: false },
    { id: 'loopB', label: 'پایان حلقه', code: 'KeyO', ctrl: false, shift: false },
    { id: 'fullscreen', label: 'پنجره تمام‌صفحه', code: 'F9', ctrl: false, shift: false },
    { id: 'focusMode', label: 'حالت تمرکز', code: 'F10', ctrl: false, shift: false },
    { id: 'seekBack', label: 'عقب‌رفتن', code: 'ArrowLeft', ctrl: false, shift: false },
    { id: 'seekFwd', label: 'جلورفتن', code: 'ArrowRight', ctrl: false, shift: false },
    { id: 'goStart', label: 'رفتن به ابتدا', code: 'Home', ctrl: false, shift: false },
    { id: 'setLoopFromSel', label: 'محدوده loop از selection', code: 'KeyP', ctrl: false, shift: false }
  ].map(Object.freeze));

  const KEY_NAMES = Object.freeze({
    Space: 'Space',
    Delete: 'Del',
    Backspace: 'Bksp',
    Home: 'Home',
    End: 'End',
    F9: 'F9',
    F10: 'F10',
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
              shift: definition.shift
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
        event.shiftKey === Boolean(shortcut.shift)
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
