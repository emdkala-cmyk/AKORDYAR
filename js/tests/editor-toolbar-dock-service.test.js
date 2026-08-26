const assert = require('node:assert/strict');
const DockService = require('../editor/EditorToolbarDockService.js');

function createClassList() {
  const values = new Set();
  return {
    add(...names) {
      names.forEach(name => values.add(name));
    },
    remove(...names) {
      names.forEach(name => values.delete(name));
    },
    contains(name) {
      return values.has(name);
    },
    toggle(name, force) {
      const next = force === undefined ? !values.has(name) : force;
      if (next) values.add(name);
      else values.delete(name);
      return next;
    }
  };
}

function createElement(tagName = 'DIV') {
  const listeners = new Map();
  const element = {
    tagName: tagName.toUpperCase(),
    style: { cssText: '' },
    classList: createClassList(),
    children: [],
    innerHTML: '',
    textContent: '',
    offsetParent: {},
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    dispatch(event) {
      return listeners.get(event.type)?.(event);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    querySelectorAll() {
      return [];
    },
    closest(selector) {
      return selector === '.toolbar-pin-btn' && this.isPin ? this : null;
    },
    contains(target) {
      return target === this || this.children.includes(target);
    },
    remove() {
      this.removed = true;
    },
    setPointerCapture(pointerId) {
      this.captured = pointerId;
    },
    releasePointerCapture(pointerId) {
      this.released = pointerId;
    }
  };
  return element;
}

const header = createElement('div');
const dragHandle = createElement('div');
const pin = createElement('button');
pin.isPin = true;
let rect = { left: 100, top: 80, right: 400, bottom: 120 };
header.getBoundingClientRect = () => ({ ...rect });

const elements = new Map([
  ['headerCenterControls', header],
  ['toolbarDragHandle', dragHandle],
  ['toolbarPinBtn', pin]
]);
const documentListeners = new Map();
const scheduled = [];
const documentRef = {
  documentElement: { dir: 'ltr' },
  body: {
    children: [],
    appendChild(element) {
      this.children.push(element);
    }
  },
  createElement(tagName) {
    return createElement(tagName);
  },
  createTextNode(text) {
    return { textContent: text };
  },
  querySelector() {
    return null;
  },
  addEventListener(name, handler) {
    documentListeners.set(name, handler);
  },
  removeEventListener(name, handler) {
    if (documentListeners.get(name) === handler) {
      documentListeners.delete(name);
    }
  }
};
const windowRef = {
  innerWidth: 1000,
  innerHeight: 700
};

const service = DockService.create({
  documentRef,
  windowRef,
  getElement: id => elements.get(id),
  schedule: callback => {
    scheduled.push(callback);
  }
});

assert.equal(service.bind(), true);
assert.equal(service.bind(), true);
assert.equal(service.isBound(), true);
assert.equal(dragHandle.style.touchAction, 'none');

const contextMenuEvent = {
  type: 'contextmenu',
  clientX: 100,
  clientY: 200,
  preventDefault() {
    this.prevented = true;
  }
};
dragHandle.dispatch(contextMenuEvent);
assert.equal(contextMenuEvent.prevented, true);
assert.equal(documentRef.body.children.length, 1);
assert.equal(documentRef.body.children[0].className, 'toolbar-context-menu');
assert.equal(scheduled.length, 1);
scheduled.shift()();
assert.equal(documentListeners.has('click'), true);

assert.equal(service.toggleToolbarDock(), true);
assert.equal(header.classList.contains('floating'), true);
assert.equal(header.style.left, '50%');
assert.equal(pin.innerHTML.includes('M10 13'), true);

assert.equal(service.toggleToolbarDock(), false);
assert.equal(header.classList.contains('floating'), false);
assert.equal(header.style.cssText, 'flex-wrap:wrap; gap:4px;');
assert.equal(pin.innerHTML.includes('M12 17'), true);

const pointerDown = {
  type: 'pointerdown',
  button: 0,
  pointerId: 7,
  clientX: 120,
  clientY: 90,
  target: { closest: () => null },
  preventDefault() {
    this.prevented = true;
  }
};
dragHandle.dispatch(pointerDown);
assert.equal(pointerDown.prevented, true);
assert.equal(dragHandle.captured, 7);
assert.equal(header.classList.contains('floating'), true);

dragHandle.dispatch({
  type: 'pointermove',
  pointerId: 7,
  clientX: 900,
  clientY: 650
});
assert.equal(header.style.left, '880px');
assert.equal(header.style.top, '640px');
assert.equal(header.style.transform, 'none');

rect = { left: 10, top: 80, right: 300, bottom: 120 };
dragHandle.dispatch({
  type: 'pointerup',
  pointerId: 7
});
assert.equal(dragHandle.released, 7);
assert.equal(header.classList.contains('dock-left'), true);
assert.equal(header.classList.contains('floating'), false);
assert.equal(header.style.cssText, '');
assert.equal(pin.innerHTML.includes('M10 13'), true);

const ignoredPointer = {
  type: 'pointerdown',
  button: 0,
  pointerId: 8,
  clientX: 0,
  clientY: 0,
  target: { closest: () => pin }
};
dragHandle.dispatch(ignoredPointer);
assert.equal(dragHandle.captured, 7);

console.log('EditorToolbarDockService tests passed');
