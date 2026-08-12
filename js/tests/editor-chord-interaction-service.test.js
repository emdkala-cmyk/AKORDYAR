const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorChordInteractionService.js'),
  'utf8'
);

const context = {
  getSelection: () => ({ removeAllRanges() {} }),
  requestAnimationFrame: callback => {
    callback();
    return 1;
  },
  cancelAnimationFrame() {}
};
vm.runInNewContext(source, context);

function fakeElement(offsetLeft = 10) {
  const listeners = {};
  return {
    style: {},
    offsetLeft,
    addEventListener(name, callback) {
      (listeners[name] ||= []).push(callback);
    },
    removeEventListener(name, callback) {
      listeners[name] = (listeners[name] || []).filter(item => item !== callback);
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    emit(name, event) {
      (listeners[name] || []).slice().forEach(callback => callback(event));
    },
    listeners
  };
}

const chordElement = fakeElement(20);
const editor = {
  children: [{ textContent: 'abcd' }],
  blur() {}
};
const wrap = {
  getBoundingClientRect: () => ({ left: 0, right: 200, top: 0, bottom: 100 })
};
const song = {
  chords: [{ lineIndex: 0, charIndex: 1, name: 'C' }]
};
let selected = [0];
let dragging = false;
let rendered = 0;
let committed = 0;
let moved = null;
const service = context.EditorChordInteractionService.create({
  getSong: () => song,
  getSelected: () => selected,
  getEditor: () => editor,
  getWrap: () => wrap,
  getChordElement: () => chordElement,
  geometry: {
    findAnchorSelectionPosition: () => 0,
    findNearestChar: () => 3
  },
  mutations: {
    moveChordsByDelta: (...args) => {
      moved = args;
      return { changed: true };
    },
    deleteChords: () => ({ changed: true })
  },
  render: () => { rendered += 1; },
  commit: () => { committed += 1; },
  setDragging: value => { dragging = value; }
});

service.attach(chordElement, 0);
chordElement.emit('pointerdown', {
  button: 0,
  pointerId: 1,
  detail: 1,
  clientX: 10,
  clientY: 20,
  stopPropagation() {},
  preventDefault() {}
});
chordElement.emit('pointermove', {
  pointerId: 1,
  clientX: 30,
  clientY: 20
});
assert.equal(dragging, true);
chordElement.emit('pointerup', {
  pointerId: 1,
  clientX: 40,
  clientY: 20
});
assert.equal(dragging, false);
assert.equal(rendered, 1);
assert.equal(committed, 1);
assert.equal(moved[2], 2);

let opened = 0;
const doubleClickElement = fakeElement();
const doubleClickService = context.EditorChordInteractionService.create({
  getSong: () => song,
  getSelected: () => selected,
  isLocked: () => false,
  openChordModal: () => { opened += 1; }
});
doubleClickService.attach(doubleClickElement, 0);
doubleClickElement.emit('pointerdown', {
  button: 0,
  pointerId: 2,
  detail: 2,
  clientX: 0,
  clientY: 0,
  stopPropagation() {},
  preventDefault() {}
});
assert.equal(opened, 1);

console.log('EditorChordInteractionService tests passed');
