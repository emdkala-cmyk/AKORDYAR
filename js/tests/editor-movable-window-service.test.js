const assert = require('node:assert/strict');
const EditorMovableWindowService = require(
  '../core/EditorMovableWindowService.js'
);

let pointerDownHandler = null;
let removedHandler = null;
const documentRef = {
  addEventListener: (type, handler) => {
    assert.equal(type, 'pointerdown');
    pointerDownHandler = handler;
  },
  removeEventListener: (type, handler) => {
    assert.equal(type, 'pointerdown');
    removedHandler = handler;
  }
};
const panel = {
  style: {},
  offsetWidth: 200,
  offsetHeight: 100,
  getBoundingClientRect: () => ({ left: 100, top: 50 })
};
const head = {
  closest: selector => {
    if (selector === 'h3, h4, .mv-head, .shortcut-panel-header') return head;
    if (selector === '#arrangerModal') return null;
    if (selector === '.mv-window') return panel;
    return null;
  }
};
const dragCalls = [];
const service = EditorMovableWindowService.create({
  documentRef,
  windowRef: { innerWidth: 800, innerHeight: 600 },
  startPointerDrag: (target, event, move) => {
    dragCalls.push({ target, event });
    move({ clientX: 900, clientY: -100 });
  }
});

const unbind = service.bind();
assert.equal(typeof pointerDownHandler, 'function');

let prevented = false;
pointerDownHandler({
  button: 0,
  target: {
    closest: selector => {
      if (selector === 'h3, h4, .mv-head, .shortcut-panel-header') return head;
      if (selector === 'button, input, select, textarea') return null;
      return null;
    }
  },
  clientX: 150,
  clientY: 90,
  preventDefault: () => {
    prevented = true;
  }
});
assert.equal(prevented, true);
assert.equal(dragCalls.length, 1);
assert.equal(dragCalls[0].target, head);
assert.equal(panel.style.position, 'fixed');
assert.equal(panel.style.left, '760px');
assert.equal(panel.style.top, '0px');

const beforeSecondaryButton = dragCalls.length;
pointerDownHandler({
  button: 2,
  target: { closest: () => head },
  preventDefault: () => {
    throw new Error('secondary button must be ignored');
  }
});
assert.equal(dragCalls.length, beforeSecondaryButton);

unbind();
assert.equal(removedHandler, pointerDownHandler);

console.log('EditorMovableWindowService tests passed');
