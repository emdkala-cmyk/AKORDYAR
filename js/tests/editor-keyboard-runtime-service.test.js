const assert = require('node:assert/strict');
const KeyboardRuntimeService = require(
  '../editor/EditorKeyboardRuntimeService.js'
);

let received = null;
const keyboardService = {
  create: options => {
    received = options;
    return { handleKeydown: () => true };
  }
};

const callbacks = {
  isEditorLocked: () => true,
  getShortcutMatch: () => true,
  getDAW: () => ({ playhead: 4 }),
  onTogglePlay: () => {},
  onToggleSnap: () => {},
  onHideCutGuide: () => {},
  onPerfStop: () => {},
  onConfirmChord: () => {}
};

const runtime = KeyboardRuntimeService.create({
  keyboardService,
  windowRef: { id: 'window' },
  state: {
    isEditorLocked: callbacks.isEditorLocked
  },
  shortcuts: {
    getShortcutMatch: callbacks.getShortcutMatch
  },
  transport: {
    getDAW: callbacks.getDAW,
    onTogglePlay: callbacks.onTogglePlay,
    onToggleSnap: callbacks.onToggleSnap
  },
  ui: {
    onHideCutGuide: callbacks.onHideCutGuide
  },
  performance: {
    onPerfStop: callbacks.onPerfStop
  },
  chord: {
    onConfirmChord: callbacks.onConfirmChord
  }
});

assert.deepEqual(runtime, { handleKeydown: runtime.handleKeydown });
assert.equal(received.windowRef.id, 'window');
assert.equal(received.isEditorLocked, callbacks.isEditorLocked);
assert.equal(received.getShortcutMatch, callbacks.getShortcutMatch);
assert.equal(received.getDAW, callbacks.getDAW);
assert.equal(received.onTogglePlay, callbacks.onTogglePlay);
assert.equal(received.onToggleSnap, callbacks.onToggleSnap);
assert.equal(received.onHideCutGuide, callbacks.onHideCutGuide);
assert.equal(received.onPerfStop, callbacks.onPerfStop);
assert.equal(received.onConfirmChord, callbacks.onConfirmChord);
assert.equal(
  KeyboardRuntimeService.create({ keyboardService: {} }),
  null
);

console.log('EditorKeyboardRuntimeService tests passed');
