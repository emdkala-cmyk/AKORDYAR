const assert = require('node:assert/strict');
const HighlightService = require('../app/CoreHighlightService.js');

function classList() {
  const values = new Set();
  return {
    values,
    add: value => values.add(value),
    remove: value => values.delete(value),
    toggle: (value, force) => {
      const shouldAdd = force === undefined ? !values.has(value) : force;
      if (shouldAdd) values.add(value);
      else values.delete(value);
      return shouldAdd;
    },
    contains: value => values.has(value)
  };
}

const editor = { classList: classList() };
const nameElement = { textContent: '' };
const options = ['neon', 'frost', 'shift', 'depth', 'pulse'].map(effect => ({
  dataset: { effect },
  classList: classList()
}));
const popupBody = { classList: classList() };
let popupOpen = true;
let currentEffect = 'depth';
let saved = 0;

const service = HighlightService.create({
  documentRef: {
    getElementById: id => {
      if (id === 'editor') return editor;
      if (id === 'hl-effect-name') return nameElement;
      return null;
    },
    querySelectorAll: selector =>
      selector === '.hl-opt' ? options : []
  },
  getElement: id => {
    if (id === 'editor') return editor;
    if (id === 'hl-effect-name') return nameElement;
    return null;
  },
  getSongState: () => ({
    getPresentationSnapshot: () => ({
      styles: { highlightEffect: currentEffect }
    }),
    setHighlightEffect: (effect, effects) => {
      if (!effects.includes(effect)) return false;
      currentEffect = effect;
      return true;
    }
  }),
  getPopup: () => ({ closed: !popupOpen }),
  isPopupOpen: popup => popupOpen && !popup.closed,
  popupDocument: () => ({ body: popupBody }),
  saveSong: () => {
    saved += 1;
  }
});

service.initHighlightEffect();
assert.equal(nameElement.textContent, 'Double Shadow');
assert.equal(editor.classList.contains('hl-depth'), true);
assert.equal(options[3].classList.contains('active'), true);

service.setHighlightEffect('frost');
assert.equal(currentEffect, 'frost');
assert.equal(nameElement.textContent, 'Frosted Glass');
assert.equal(editor.classList.contains('hl-depth'), false);
assert.equal(editor.classList.contains('hl-frost'), true);
assert.equal(popupBody.classList.contains('hl-frost'), true);
assert.equal(options[1].classList.contains('active'), true);
assert.equal(saved, 1);

service.setHighlightEffect('unknown');
assert.equal(currentEffect, 'frost');
assert.equal(saved, 1);

popupOpen = false;
service.applyHighlightClassToPopup();
assert.equal(popupBody.classList.contains('hl-frost'), true);

console.log('CoreHighlightService tests passed');
