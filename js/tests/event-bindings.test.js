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
const documentKeydownEvents = [];
let globalCaptureCalls = 0;
let globalKeydownCalls = 0;
let inlineActionCalls = 0;
let inputActionCalls = 0;
let formActionCalls = 0;
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
    save: () => { inlineActionCalls++; },
    saveDebounced: () => { inputActionCalls++; },
    applyFormValue: () => { formActionCalls++; }
  },
  onGlobalKeydownCapture: () => { globalCaptureCalls++; },
  onGlobalKeydown: () => { globalKeydownCalls++; },
  onGlobalKeyup: (event) => keyupEvents.push(event),
  onGlobalDocumentKeydown: (event) => documentKeydownEvents.push(event),
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
assert.equal(
  documentRef.added.some(item => item.eventName === 'keydown'),
  true
);

const keyupHandler = windowRef.added.find((item) => item.eventName === 'keyup').handler;
const pointerHandler = documentRef.added.find((item) => item.eventName === 'mousedown').handler;
const documentKeydownHandler = documentRef.added.find(item => item.eventName === 'keydown').handler;
keyupHandler({ key: 'Shift' });
pointerHandler({ type: 'mousedown' });
documentKeydownHandler({ type: 'keydown', key: 'c' });

assert.equal(keyupEvents.length, 1);
assert.equal(pointerEvents.length, 1);
assert.equal(documentKeydownEvents.length, 1);

const windowCaptureHandler = windowRef.added.find(
  item => item.eventName === 'keydown' && item.options === true
).handler;
const windowKeydownHandler = windowRef.added.find(
  item => item.eventName === 'keydown' && item.options !== true
).handler;
const editableRoot = {
  contentEditable: 'true',
  getAttribute: name => name === 'contenteditable' ? 'true' : null
};
const editableText = {
  tagName: 'SPAN',
  closest: selector => selector === '[contenteditable]' ? editableRoot : null
};
let editablePropagationStopped = false;
const editableSpace = {
  code: 'Space',
  target: editableText,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  stopPropagation: () => { editablePropagationStopped = true; }
};
windowCaptureHandler(editableSpace);
windowKeydownHandler(editableSpace);
documentKeydownHandler(editableSpace);
assert.equal(globalCaptureCalls, 0);
assert.equal(globalKeydownCalls, 0);
assert.equal(documentKeydownEvents.length, 1);
assert.equal(editablePropagationStopped, true);

const plainSpace = {
  code: 'Space',
  target: { tagName: 'DIV' },
  ctrlKey: false,
  metaKey: false,
  altKey: false
};
windowCaptureHandler(plainSpace);
windowKeydownHandler(plainSpace);
assert.equal(globalCaptureCalls, 1);
assert.equal(globalKeydownCalls, 1);

const inlineClickHandler = inlineGroup.added.find(item => item.eventName === 'click').handler;
inlineClickHandler({
  target: {
    closest: () => ({ dataset: { action: 'save' } })
  }
});
assert.equal(inlineActionCalls, 1);

const inlineInputHandler = inlineGroup.added.find(item => item.eventName === 'input').handler;
inlineInputHandler({
  target: {
    closest: () => ({
      dataset: { action: 'save', inputAction: 'saveDebounced' }
    })
  }
});
assert.equal(inputActionCalls, 1);

const formControl = {
  tagName: 'SELECT',
  dataset: { action: 'applyFormValue' }
};
const inlineChangeHandler = inlineGroup.added.find(item => item.eventName === 'change').handler;
const inlineFormClickHandler = inlineGroup.added.find(item => item.eventName === 'click').handler;
inlineFormClickHandler({
  target: { closest: () => formControl }
});
inlineChangeHandler({
  target: { closest: () => formControl }
});
assert.equal(formActionCalls, 1);

bindings.destroy();
assert.equal(bindings.initialized, false);
assert.equal(windowRef.removed.length, windowRef.added.length);
assert.equal(documentRef.removed.length, documentRef.added.length);

console.log('EventBindings tests passed');
