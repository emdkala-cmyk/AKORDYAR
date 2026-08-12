const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorChordRenderer.js'),
  'utf8'
);

const context = {
  requestAnimationFrame: callback => {
    callback();
    return 1;
  },
  document: {
    fonts: null,
    createElement() {
      return {
        className: '',
        classList: { add() {} },
        dataset: {},
        style: {},
        offsetWidth: 0,
        textContent: '',
        addEventListener() {}
      };
    }
  },
  getComputedStyle: () => ({ direction: 'ltr' })
};
vm.runInNewContext(source, context);

const layer = {
  innerHTML: '',
  style: {},
  appendChild() {}
};
const state = {
  song: { styles: {}, chords: [] },
  editor: { children: [] },
  layer,
  wrap: { scrollTop: 0, getBoundingClientRect: () => ({ top: 0 }) },
  chordsVisible: false
};
const renderer = context.EditorChordRenderer.create({
  getState: () => state,
  anchorRectIn: () => ({
    rect: { left: 0, right: 10, top: 0 },
    lineRect: {}
  }),
  attachDrag: () => {}
});

renderer.render(true);
assert.equal(layer.style.display, 'none');

state.chordsVisible = true;
renderer.render(true);
assert.equal(layer.style.display, '');

let selectedClassApplied = false;
context.document.createElement = () => ({
  className: '',
  classList: { add(name) { if (name === 'selected') selectedClassApplied = true; } },
  dataset: {},
  style: {},
  offsetWidth: 0,
  textContent: '',
  addEventListener() {}
});
state.song = {
  styles: {},
  chords: [{ lineIndex: 0, charIndex: 0, anchorType: 'LineStart', name: '' }],
};
state.editor.children = [{}];
state.sequenceActive = true;
state.sequenceModeActive = false;
state.sequencePoints = [{ lineIndex: 0, charIndex: 0, anchorType: 'LineStart' }];
state.sequenceCursor = 0;
renderer.render(true);
assert.equal(selectedClassApplied, true);

console.log('EditorChordRenderer tests passed');
