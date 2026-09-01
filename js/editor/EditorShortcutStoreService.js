/**
 * EditorShortcutStoreService
 *
 * Stores editor keyboard shortcuts and MIDI-note mappings. Matching and
 * persistence stay here; editor.js keeps only compatibility wrappers and UI.
 */
(function attachEditorShortcutStoreService(globalScope) {
  const SHORTCUT_DEFAULTS = Object.freeze([
    { id: 'undo', label: 'برگشت (Undo)', code: 'KeyZ', ctrl: true, shift: false, alt: false },
    { id: 'redo', label: 'جلو (Redo)', code: 'KeyY', ctrl: true, shift: false, alt: false },
    { id: 'play', label: 'پخش / توقف', code: 'Space', ctrl: false, shift: false, alt: false },
    { id: 'metronome', label: 'روشن/خاموش مترونوم', code: 'KeyC', ctrl: false, shift: false, alt: false },
    { id: 'split', label: 'برش در پخشگر', code: 'KeyS', ctrl: false, shift: false, alt: false },
    { id: 'copy', label: 'کپی', code: 'KeyC', ctrl: true, shift: false, alt: false },
    { id: 'cut', label: 'بریدن', code: 'KeyX', ctrl: true, shift: false, alt: false },
    { id: 'paste', label: 'چسباندن', code: 'KeyV', ctrl: true, shift: false, alt: false },
    { id: 'selectAll', label: 'انتخاب همه', code: 'KeyA', ctrl: true, shift: false, alt: false },
    { id: 'duplicate', label: 'کپی + چسباندن', code: 'KeyD', ctrl: true, shift: false, alt: false },
    { id: 'delete', label: 'حذف انتخاب‌شده', code: 'Delete', ctrl: false, shift: false, alt: false },
    { id: 'loop', label: 'روشن/خاموش حلقه', code: 'NumpadDivide', ctrl: false, shift: false, alt: false },
    { id: 'loopA', label: 'شروع حلقه', code: 'KeyI', ctrl: false, shift: false, alt: false },
    { id: 'loopB', label: 'پایان حلقه', code: 'KeyO', ctrl: false, shift: false, alt: false },
    { id: 'fullscreen', label: 'پنجره تمام‌صفحه', code: 'F9', ctrl: false, shift: false, alt: false },
    { id: 'focusMode', label: 'حالت تمرکز', code: 'F10', ctrl: false, shift: false, alt: false },
    { id: 'seekBack', label: 'عقب‌رفتن', code: 'ArrowLeft', ctrl: false, shift: false, alt: false },
    { id: 'seekFwd', label: 'جلورفتن', code: 'ArrowRight', ctrl: false, shift: false, alt: false },
    { id: 'goStart', label: 'رفتن به ابتدا', code: 'Home', ctrl: false, shift: false, alt: false },
    { id: 'setLoopFromSel', label: 'محدوده loop از selection', code: 'KeyP', ctrl: false, shift: false, alt: false },
    { id: 'zoomHOut', label: 'بزرگنمایی افقی (کم)', code: 'KeyG', ctrl: false, shift: false, alt: false },
    { id: 'zoomHIn', label: 'بزرگنمایی افقی (زیاد)', code: 'KeyH', ctrl: false, shift: false, alt: false },
    { id: 'zoomVOut', label: 'بزرگنمایی عمودی (کم)', code: 'KeyN', ctrl: false, shift: false, alt: false },
    { id: 'zoomVIn', label: 'بزرگنمایی عمودی (زیاد)', code: 'KeyK', ctrl: false, shift: false, alt: false },
    { id: 'toggleSnap', label: 'اسنپ روشن/خاموش', code: 'KeyJ', ctrl: false, shift: false, alt: false },
    { id: 'zoomToSelection', label: 'بزرگنمایی به انتخاب', code: 'KeyS', ctrl: false, shift: false, alt: true },
    { id: 'zoomFull', label: 'بزرگنمایی کامل', code: 'KeyF', ctrl: false, shift: true, alt: false },
    { id: 'togglePlayheadMode', label: 'حالت پخشگر', code: 'KeyV', ctrl: false, shift: false, alt: false },
    { id: 'toggleRecording', label: 'ضبط', code: 'KeyR', ctrl: false, shift: false, alt: false },
    { id: 'toggleTrackHeight', label: 'ارتفاع ترک', code: 'KeyZ', ctrl: false, shift: false, alt: false },
    { id: 'loopPlay', label: 'پخش با حلقه', code: 'KeyP', ctrl: false, shift: false, alt: true },
    { id: 'colorBrush', label: 'قلمموی رنگ', code: 'KeyC', ctrl: false, shift: true, alt: false },
    { id: 'colorEyedropper', label: 'قطره‌چکان رنگ', code: 'KeyC', ctrl: false, shift: false, alt: true },
    { id: 'toggleInspector', label: 'نمایش/مخفی بازرسی', code: 'ArrowLeft', ctrl: true, shift: true, alt: false },
    { id: 'toggleSidebar', label: 'نمایش/مخفی نوار جانبی', code: 'ArrowRight', ctrl: true, shift: true, alt: false },
    { id: 'toggleTimeline', label: 'نمایش/مخفی خط زمانی', code: 'ArrowDown', ctrl: true, shift: true, alt: false },
    { id: 'tapTempo', label: 'ضربه تمپو', code: 'KeyT', ctrl: false, shift: false, alt: false },
    { id: 'quantizeChords', label: 'کوانتیز آکوردها', code: 'KeyQ', ctrl: false, shift: false, alt: false },
    { id: 'stop', label: 'توقف', code: 'Backspace', ctrl: true, shift: false, alt: false },
    { id: 'goEnd', label: 'رفتن به انتها', code: 'End', ctrl: false, shift: false, alt: false },
    { id: 'toggleWarp', label: 'ابزار Warp', code: 'KeyW', ctrl: false, shift: false, alt: false }
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
