const assert = require('node:assert/strict');
const CoreArrangerModalService = require(
  '../app/CoreArrangerModalService.js'
);

function createClassList() {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    }
  };
}

const editor = {
  style: { left: '10px', top: '20px' },
  getBoundingClientRect: () => ({ left: 100, top: 200 })
};
let pointerHandler = null;
let keyHandler = null;
let focusCount = 0;
const modal = {
  classList: createClassList(),
  querySelector: selector => selector === '.chord-editor' ? editor : null,
  focus: () => {
    focusCount++;
  },
  addEventListener: (type, handler) => {
    if (type === 'keydown') keyHandler = handler;
  }
};
const handle = {
  addEventListener: (type, handler) => {
    if (type === 'pointerdown') pointerHandler = handler;
  }
};
const editorPanel = { style: {} };
const elements = new Map([
  ['arrangerModal', modal],
  ['arrModalDragHandle', handle],
  ['arrEditor', editorPanel]
]);
const arrangers = [{ id: 'arr-1' }];
let editingArr = null;
const calls = [];
let dragMove = null;
let dragStop = null;

const runtime = CoreArrangerModalService.create({
  getElement: id => elements.get(id),
  getArrangers: () => arrangers,
  setEditingArr: value => {
    editingArr = value;
  },
  renderArrangerManager: () => calls.push('manager'),
  openArrEditor: () => calls.push('editor'),
  startPointerDrag: (_handle, _event, move, stop) => {
    dragMove = move;
    dragStop = stop;
  }
});

runtime.open();
assert.equal(modal.classList.contains('show'), true);
assert.equal(editingArr, arrangers[0]);
assert.deepEqual(calls, ['manager', 'editor']);
assert.equal(focusCount, 1);
assert.equal(typeof pointerHandler, 'function');
assert.equal(typeof keyHandler, 'function');

pointerHandler({
  button: 0,
  target: { tagName: 'H3' },
  clientX: 110,
  clientY: 220,
  preventDefault() {}
});
dragMove({ clientX: 130, clientY: 250 });
assert.equal(editor.style.left, '120px');
assert.equal(editor.style.top, '230px');
dragStop();
dragMove({ clientX: 200, clientY: 300 });
assert.equal(editor.style.left, '120px');
assert.equal(editor.style.top, '230px');

keyHandler({
  key: 'Escape',
  preventDefault() {}
});
assert.equal(modal.classList.contains('show'), false);
assert.equal(editingArr, null);
assert.equal(editor.style.left, '');
assert.equal(editor.style.top, '');

runtime.open();
assert.equal(focusCount, 2);
assert.equal(pointerHandler, pointerHandler);
runtime.open();
assert.equal(focusCount, 3);

const emptyEditorPanel = { style: {} };
const emptyRuntime = CoreArrangerModalService.create({
  getElement: id =>
    id === 'arrangerModal'
      ? { classList: createClassList(), querySelector: () => null }
      : emptyEditorPanel,
  getArrangers: () => [],
  openArrEditor: () => {
    throw new Error('empty arranger must not open editor');
  }
});
emptyRuntime.open();
assert.equal(emptyEditorPanel.style.display, 'none');

console.log('CoreArrangerModalService tests passed');
