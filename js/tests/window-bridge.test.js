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
