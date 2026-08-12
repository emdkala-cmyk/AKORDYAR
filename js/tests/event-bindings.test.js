const assert = require('node:assert/strict');
const EventBindings = require('../core/EventBindings.js');

function createTarget() {
  return {
    added: [],
    removed: [],
    addEventListener(eventName, handler, options) {
      this.added.push({ eventName, handler, options });
    },
    removeEventListener(eventName, handler, options) {
      this.removed.push({ eventName, handler, options });
    },
    querySelector() {
      return null;
    },
    getElementById() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
}

const documentRef = createTarget();
const windowRef = createTarget();
const keyupEvents = [];
const pointerEvents = [];
let inlineActionCalls = 0;
const inlineGroup = createTarget();
inlineGroup.contains = () => true;
inlineGroup.addEventListener = function(eventName, handler, options) {
  this.added.push({ eventName, handler, options });
};
documentRef.querySelectorAll = () => [inlineGroup];

const bindings = new EventBindings({
  documentRef,
  windowRef,
  actions: {
    save: () => { inlineActionCalls++; }
  },
  onGlobalKeyup: (event) => keyupEvents.push(event),
  onGlobalMousedownCapture: (event) => pointerEvents.push(event)
});

bindings.init();

assert.equal(bindings.initialized, true);
assert.equal(windowRef.added.some((item) => item.eventName === 'keyup'), true);
assert.equal(
  documentRef.added.some(
    (item) => item.eventName === 'mousedown' && item.options === true
  ),
  true
);

const keyupHandler = windowRef.added.find((item) => item.eventName === 'keyup').handler;
const pointerHandler = documentRef.added.find((item) => item.eventName === 'mousedown').handler;
keyupHandler({ key: 'Shift' });
pointerHandler({ type: 'mousedown' });

assert.equal(keyupEvents.length, 1);
assert.equal(pointerEvents.length, 1);

const inlineClickHandler = inlineGroup.added.find(item => item.eventName === 'click').handler;
inlineClickHandler({
  target: {
    closest: () => ({ dataset: { action: 'save' } })
  }
});
assert.equal(inlineActionCalls, 1);

bindings.destroy();
assert.equal(bindings.initialized, false);
assert.equal(windowRef.removed.length, windowRef.added.length);
assert.equal(documentRef.removed.length, documentRef.added.length);

console.log('EventBindings tests passed');
