const assert = require('node:assert/strict');
const KeyboardService = require('../editor/EditorKeyboardService.js');

function createWindow() {
  return {
    listeners: new Map(),
    addEventListener(name, handler) {
      this.listeners.set(name, handler);
    },
    removeEventListener(name, handler) {
      if (this.listeners.get(name) === handler) this.listeners.delete(name);
    },
    dispatch(event) {
      return this.listeners.get(event.type)?.(event);
    }
  };
}

function keyEvent(code, overrides = {}) {
  let prevented = false;
  let stopped = false;
  return {
    type: 'keydown',
    code,
    key: overrides.key || code,
    target: overrides.target || { tagName: 'DIV' },
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault: () => { prevented = true; },
    stopImmediatePropagation: () => { stopped = true; },
    ...overrides,
    get prevented() { return prevented; },
    get stopped() { return stopped; }
  };
}

const windowRef = createWindow();
const calls = [];
const service = KeyboardService.create({
  windowRef,
  isChordModalOpen: () => false,
  isEditorChordModal: () => false,
  isEditorLocked: () => false,
  hasSelectedChords: () => true,
  hasSelectedChordLineClip: () => true,
  onTogglePlay: () => calls.push('play'),
  isSequentialChordingActive: () => false,
  onQuantizeSelectedChords: () => calls.push('quantize'),
  onMoveSelectedChords: direction => calls.push(`move:${direction}`),
  onDeleteSelectedChords: () => calls.push('delete')
});

service.bind();
assert.equal(service.isBound(), true);

const q = keyEvent('KeyQ');
windowRef.dispatch(q);
assert.equal(q.prevented, true);
assert.equal(q.stopped, true);
assert.deepEqual(calls, ['quantize']);

const right = keyEvent('ArrowRight');
windowRef.dispatch(right);
assert.equal(right.prevented, true);
assert.deepEqual(calls, ['quantize', 'move:right']);

const inputRight = keyEvent('ArrowRight', {
  target: { tagName: 'INPUT' }
});
windowRef.dispatch(inputRight);
assert.deepEqual(calls, ['quantize', 'move:right']);

const editorTextChild = keyEvent('Space', {
  target: {
    tagName: 'SPAN',
    closest: selector =>
      selector === '[contenteditable="true"]'
        ? { tagName: 'DIV', contentEditable: 'true' }
        : null
  }
});
assert.equal(service.handleGlobalKeydownCapture(editorTextChild), false);
assert.equal(editorTextChild.prevented, false);
assert.deepEqual(calls, ['quantize', 'move:right']);

const del = keyEvent('Delete');
windowRef.dispatch(del);
assert.equal(del.prevented, true);
assert.deepEqual(calls, ['quantize', 'move:right', 'delete']);

const selectSpace = keyEvent('Space', {
  target: { tagName: 'SELECT' }
});
assert.equal(service.handleGlobalKeydownCapture(selectSpace), true);
assert.equal(selectSpace.prevented, true);
assert.deepEqual(calls, ['quantize', 'move:right', 'delete', 'play']);

service.destroy();
assert.equal(service.isBound(), false);
assert.equal(windowRef.listeners.has('keydown'), false);

console.log('EditorKeyboardService tests passed');
