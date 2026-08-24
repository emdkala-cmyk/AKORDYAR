const assert = require('node:assert/strict');
const PopupWindowService = require('../core/PopupWindowService.js');

const calls = [];
const popup = {
  closed: false,
  document: { body: {} },
  focus() {
    calls.push('focus');
  },
  close() {
    calls.push('close');
    this.closed = true;
  }
};
const windowRef = {
  open(url, name, features) {
    calls.push({ url, name, features });
    return popup;
  }
};

const service = PopupWindowService.create({
  windowRef,
  windowBridge: {
    isOpen: value => value === popup && !value.closed,
    getDocument: value => value?.document || null,
    open: options => options.windowRef.open(options.url, options.name, options.features),
    focus: value => {
      value.focus();
      return true;
    },
    close: value => {
      value.close();
      return true;
    }
  }
});

assert.equal(service.isOpen(popup), true);
assert.deepEqual(service.getDocument(popup), { body: {} });
assert.equal(service.open({ name: 'lyrics', features: 'width=10' }), popup);
assert.deepEqual(calls[0], {
  url: '',
  name: 'lyrics',
  features: 'width=10'
});
assert.equal(service.focus(popup), true);
assert.equal(calls.includes('focus'), true);
assert.equal(service.close(popup), true);
assert.equal(calls.includes('close'), true);
assert.equal(service.isOpen(popup), false);
assert.equal(service.getDocument(popup), null);

const fallbackPopup = {
  closed: false,
  document: { id: 'fallback' },
  focus() {
    this.focused = true;
  },
  close() {
    this.closed = true;
  }
};
const fallbackService = PopupWindowService.create({
  windowRef: {
    open() {
      return fallbackPopup;
    }
  },
  windowBridge: null
});

assert.equal(fallbackService.isOpen(fallbackPopup), true);
assert.deepEqual(fallbackService.getDocument(fallbackPopup), { id: 'fallback' });
assert.equal(fallbackService.open({ name: 'fallback' }), fallbackPopup);
assert.equal(fallbackService.focus(fallbackPopup), true);
assert.equal(fallbackPopup.focused, true);
assert.equal(fallbackService.close(fallbackPopup), true);
assert.equal(fallbackService.isOpen(fallbackPopup), false);

console.log('PopupWindowService tests passed');
