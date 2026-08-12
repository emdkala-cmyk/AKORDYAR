const assert = require('node:assert/strict');
const mappingModule = require('../editor/KeyboardMappingService.js');

function createDocument() {
  return {
    listeners: new Map(),
    body: { appendChild() {} },
    querySelector: () => null,
    createElement: () => ({
      className: '',
      style: {},
      textContent: ''
    }),
    addEventListener(name, handler) {
      this.listeners.set(name, handler);
    },
    removeEventListener(name, handler) {
      if (this.listeners.get(name) === handler) this.listeners.delete(name);
    }
  };
}

function createElement() {
  const classes = new Set();
  return {
    classList: {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      has: value => classes.has(value)
    }
  };
}

const documentRef = createDocument();
const element = createElement();
const saved = [];
const service = mappingModule.create({
  documentRef,
  getLabel: id => `label:${id}`,
  saveShortcut: (id, shortcut) => saved.push({ id, shortcut }),
  formatKeyName: code => `name:${code}`,
  toast: message => saved.push({ toast: message })
});

assert.equal(service.start('save', element), true);
assert.equal(service.isActive(), true);
assert.equal(service.getTarget(), 'save');
assert.equal(element.classList.has('mapping-active'), true);
assert.equal(documentRef.listeners.has('keydown'), true);
assert.equal(documentRef.listeners.has('mousedown'), true);

let prevented = false;
let stopped = false;
documentRef.listeners.get('keydown')({
  key: 's',
  code: 'KeyS',
  ctrlKey: true,
  metaKey: false,
  shiftKey: true,
  preventDefault: () => { prevented = true; },
  stopPropagation: () => { stopped = true; }
});

assert.equal(prevented, true);
assert.equal(stopped, true);
assert.deepEqual(saved[0], {
  id: 'save',
  shortcut: { code: 'KeyS', ctrl: true, shift: true }
});
assert.equal(service.isActive(), false);
assert.equal(element.classList.has('mapping-active'), false);
assert.equal(documentRef.listeners.has('keydown'), false);
assert.equal(documentRef.listeners.has('mousedown'), false);

service.start('delete', element);
documentRef.listeners.get('keydown')({
  key: 'Escape',
  code: 'Escape',
  preventDefault() {},
  stopPropagation() {}
});
assert.equal(service.isActive(), false);
assert.equal(documentRef.listeners.has('keydown'), false);

console.log('KeyboardMappingService tests passed');
