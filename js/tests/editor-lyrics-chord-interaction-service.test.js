const assert = require('node:assert/strict');
const InteractionService =
  require('../editor/EditorLyricsChordInteractionService.js');

function element() {
  const listeners = new Map();
  return {
    innerText: '',
    addEventListener(type, handler, capture = false) {
      const current = listeners.get(type) || [];
      current.push({ handler, capture });
      listeners.set(type, current);
    },
    removeEventListener(type, handler, capture = false) {
      const current = listeners.get(type) || [];
      listeners.set(
        type,
        current.filter(item => item.handler !== handler || item.capture !== capture)
      );
    },
    dispatch(type, event = {}) {
      const current = [...(listeners.get(type) || [])]
        .sort((left, right) => Number(right.capture) - Number(left.capture));
      const dispatched = {
        preventDefault() { dispatched.prevented = true; },
        stopPropagation() { dispatched.stopped = true; },
        target: this,
        ...event
      };
      for (const item of current) {
        item.handler(dispatched);
      }
      return dispatched;
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    }
  };
}

const editor = element();
const wrap = element();
const documentRef = element();
let clearedEditorTextSelection = 0;
documentRef.getSelection = () => ({
  removeAllRanges: () => {}
});
let song = { lyrics: 'old', editorLocked: false };
let lyrics = 'old';
const state = {
  currentSong: () => song,
  getLyrics: () => lyrics,
  setLyrics: value => {
    lyrics = value;
    song.lyrics = value;
  }
};
const remappedAnchors = [];
const remappedSequencePoints = [];
const refreshes = [];
const commits = [];
const saves = [];
const clearSelections = [];
const clearChordSelections = [];
const commands = [];
const locked = [];
const pendingAnchors = [];
const chordIndices = [];
const openedModals = [];
let altDown = false;

const service = InteractionService.create({
  documentRef,
  getSongState: () => state,
  getEditor: () => editor,
  getEditorWrap: () => wrap,
  getEditorText: () => editor.innerText,
  executeCommand: (...args) => commands.push(args),
  remapAnchors: (...args) => remappedAnchors.push(args),
  remapSequencePoints: (...args) => remappedSequencePoints.push(args),
  scheduleEditorRefresh: () => refreshes.push(true),
  scheduleCommit: () => commits.push(true),
  scheduleSave: () => saves.push(true),
  clearEditorTextSelection: () => { clearedEditorTextSelection++; },
  clearSelection: () => clearSelections.push(true),
  clearChordSelection: () => clearChordSelections.push(true),
  isAltDown: () => altDown,
  anchorFromPoint: () => ({ lineIndex: 0, charIndex: 2 }),
  onLocked: () => locked.push(true),
  setPendingAnchor: value => pendingAnchors.push(value),
  setChordIndex: value => chordIndices.push(value),
  openChordModal: value => openedModals.push(value),
  toast: message => locked.push(message)
});

assert.equal(service.bind(), true);
assert.equal(service.bind(), true);
assert.equal(editor.listenerCount('input'), 1);
assert.equal(documentRef.listenerCount('pointerdown'), 1);
assert.equal(wrap.listenerCount('mousedown'), 2);

editor.innerText = 'new\ntext';
editor.dispatch('input');
assert.equal(lyrics, 'new\ntext');
assert.deepEqual(remappedAnchors, [['old', 'new\ntext']]);
assert.deepEqual(remappedSequencePoints, [['old', 'new\ntext']]);
assert.equal(refreshes.length, 1);
assert.equal(commits.length, 1);
assert.equal(saves.length, 1);

editor.dispatch('paste', {
  clipboardData: {
    getData: () => 'line one\n\n line two'
  }
});
assert.deepEqual(commands, [['insertText', false, 'line one\n line two']]);

documentRef.dispatch('pointerdown', { target: editor });
assert.equal(clearedEditorTextSelection, 0);
documentRef.dispatch('pointerdown', { target: { tagName: 'DIV' } });
assert.equal(clearedEditorTextSelection, 1);

const normalEvent = {};
wrap.dispatch('mousedown', normalEvent);
assert.equal(clearSelections.length, 1);
assert.equal(clearChordSelections.length, 1);

const altEvent = { altKey: true, clientX: 12, clientY: 20 };
const altDispatched = wrap.dispatch('mousedown', altEvent);
assert.equal(clearSelections.length, 2);
assert.equal(clearChordSelections.length, 1);
assert.equal(altDispatched.prevented, true);
assert.equal(altDispatched.stopped, true);
assert.deepEqual(pendingAnchors, [{ lineIndex: 0, charIndex: 2 }]);
assert.deepEqual(chordIndices, [null]);
assert.deepEqual(openedModals, [null]);

song.editorLocked = true;
wrap.dispatch('mousedown', {});
assert.equal(locked.includes(true), true);
assert.equal(locked.includes('🔒 ویرایشگر قفل است'), true);

const chordTarget = { closest: selector => selector === '.chord' ? {} : null };
wrap.dispatch('mousedown', { target: chordTarget });
assert.equal(locked.filter(value => value === '🔒 ویرایشگر قفل است').length, 1);

assert.equal(service.destroy(), true);
assert.equal(service.destroy(), false);
assert.equal(editor.listenerCount('input'), 0);
assert.equal(wrap.listenerCount('mousedown'), 0);
assert.equal(documentRef.listenerCount('pointerdown'), 0);

console.log('EditorLyricsChordInteractionService tests passed');
