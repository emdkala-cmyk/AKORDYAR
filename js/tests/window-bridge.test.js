const assert = require('node:assert/strict');
const WindowBridge = require('../core/WindowBridge.js');

const messages = [];
const windowRef = {
  listeners: new Map(),
  addEventListener(name, handler) {
    this.listeners.set(name, handler);
  },
  removeEventListener(name, handler) {
    if (this.listeners.get(name) === handler) this.listeners.delete(name);
  },
  open(url, name, features) {
    return {
      url,
      name,
      features,
      closed: false,
      document: { body: {} },
      focus() { this.focused = true; },
      close() { this.closed = true; },
      postMessage(payload, origin) {
        this.lastMessage = { payload, origin };
      }
    };
  }
};

const popup = WindowBridge.open({
  windowRef,
  name: 'test-popup',
  features: 'width=10'
});
assert.equal(popup.name, 'test-popup');
assert.equal(WindowBridge.isOpen(popup), true);
assert.deepEqual(WindowBridge.getDocument(popup), { body: {} });
WindowBridge.focus(popup);
assert.equal(popup.focused, true);

popup._pCfg = { cSize: 20 };
popup._pChordEls = {
  first: { remove() { this.removed = true; } }
};
let renderReason = null;
popup._pScheduleChordRender = reason => {
  renderReason = reason;
};
let dispatchContext = null;
popup.dispatchEvent = function dispatchEvent(event) {
  dispatchContext = this;
  this.lastEvent = event;
};
assert.equal(WindowBridge.get(popup, '_pCfg').cSize, 20);
assert.equal(WindowBridge.set(popup, '_pCfg', { cSize: 24 }), true);
assert.equal(WindowBridge.get(popup, '_pCfg').cSize, 24);
assert.equal(
  WindowBridge.call(popup, '_pScheduleChordRender', 'style'),
  true
);
assert.equal(renderReason, 'style');
assert.equal(WindowBridge.dispatch(popup, { type: 'resize' }), true);
assert.equal(dispatchContext, popup);
assert.deepEqual(popup.lastEvent, { type: 'resize' });
assert.equal(WindowBridge.clearManagedNodes(popup, ['_pChordEls']), true);
assert.equal(Object.keys(popup._pChordEls).length, 0);

const off = WindowBridge.onMessage({
  windowRef,
  getSource: () => popup,
  type: 'syncUpdate',
  handler: event => messages.push(event.data)
});
const listener = windowRef.listeners.get('message');
listener({ source: {}, origin: 'null', data: { type: 'syncUpdate' } });
listener({ source: popup, origin: 'null', data: { type: 'other' } });
listener({ source: popup, origin: 'null', data: { type: 'syncUpdate', value: 1 } });
assert.deepEqual(messages, [{ type: 'syncUpdate', value: 1 }]);

WindowBridge.postMessage(popup, { type: 'ping' });
assert.deepEqual(popup.lastMessage, {
  payload: { type: 'ping' },
  origin: '*'
});

off();
assert.equal(windowRef.listeners.has('message'), false);
WindowBridge.close(popup);
assert.equal(WindowBridge.isOpen(popup), false);
assert.equal(WindowBridge.getDocument(popup), null);

console.log('WindowBridge tests passed');
