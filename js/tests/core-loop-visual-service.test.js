const assert = require('node:assert/strict');
const LoopVisualService = require('../app/CoreLoopVisualService.js');

function classList() {
  const values = new Set();
  return {
    values,
    add: value => values.add(value),
    remove: value => values.delete(value),
    toggle: (value, force) => {
      if (force === undefined ? !values.has(value) : force) {
        values.add(value);
      } else {
        values.delete(value);
      }
    },
    contains: value => values.has(value)
  };
}

const daw = {
  loopA: 2,
  loopB: 8,
  loopEnabled: true
};
const strip = { style: {}, classList: classList() };
const locators = { style: {} };
const left = {
  style: {},
  listeners: {},
  addEventListener: (name, handler) => {
    left.listeners[name] = handler;
  }
};
const right = {
  style: {},
  listeners: {},
  addEventListener: (name, handler) => {
    right.listeners[name] = handler;
  }
};
const inner = {
  getBoundingClientRect: () => ({ left: 10 })
};
const elements = new Map([
  ['loop-strip', strip],
  ['loop-locators', locators],
  ['loop-loc-left', left],
  ['loop-loc-right', right],
  ['tl-inner', inner]
]);
const documentListeners = {};
const calls = [];
let activeDrag = null;

const service = LoopVisualService.create({
  getDAW: () => daw,
  getElement: id => elements.get(id) || null,
  documentRef: {
    addEventListener: (name, handler) => {
      documentListeners[name] = handler;
    },
    removeEventListener: (name, handler) => {
      if (documentListeners[name] === handler) delete documentListeners[name];
    }
  },
  timeToX: value => value * 10,
  xToTime: value => value / 10,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  getProjectEnd: () => 20,
  startPointerDrag: (target, event, onMove, onUp) => {
    calls.push(['drag', target, event]);
    activeDrag = { onMove, onUp };
  },
  saveState: () => calls.push('save')
});

service.renderLoopRegion();
assert.equal(strip.style.display, 'block');
assert.equal(strip.style.left, '20px');
assert.equal(strip.style.width, '60px');
assert.equal(strip.classList.contains('loop-active'), true);
assert.equal(strip.classList.contains('loop-inactive'), false);
assert.equal(locators.style.display, 'block');
assert.equal(left.style.left, '15px');
assert.equal(right.style.left, '75px');

daw.loopEnabled = false;
service.renderLoopRegion();
assert.equal(strip.classList.contains('loop-active'), false);
assert.equal(strip.classList.contains('loop-inactive'), true);

service.bindLoopDrag();
left.listeners.pointerdown({
  button: 0,
  currentTarget: left,
  stopPropagation() {},
  preventDefault() {}
});
assert.equal(calls[0][0], 'drag');
activeDrag.onMove({ clientX: 50 });
assert.equal(daw.loopA, 4);
activeDrag.onUp();
assert.equal(calls.at(-1), 'save');
assert.equal(documentListeners.mousemove, undefined);

daw.loopA = 9;
daw.loopB = 8;
service.renderLoopRegion();
assert.equal(strip.style.display, 'none');
assert.equal(locators.style.display, 'none');

console.log('CoreLoopVisualService tests passed');
