const assert = require('node:assert/strict');
const PopupBridge = require('../app/CorePopupWindowBridgeService.js');

const calls = [];
const windowRef = { id: 'window' };
const windowBridge = {
  open: options => {
    calls.push(['bridge-open', options.name]);
    return { closed: false };
  },
  focus: popup => {
    calls.push(['bridge-focus', popup]);
    return true;
  }
};
const popup = { closed: false, document: { id: 'popup-document' } };
const popupDocument = { body: { id: 'body' } };
let factoryCalls = 0;

const service = PopupBridge.create({
  windowRef,
  windowBridge,
  popupServiceFactory: () => {
    factoryCalls += 1;
    return options => {
      assert.equal(options.windowRef, windowRef);
      assert.equal(options.windowBridge, windowBridge);
      return {
        isOpen: value => value === popup,
        getDocument: value => value === popup ? popupDocument : null,
        open: options => {
          calls.push(['service-open', options.name]);
          return popup;
        },
        focus: value => {
          calls.push(['service-focus', value]);
          return true;
        }
      };
    };
  }
});

assert.equal(factoryCalls, 1);
assert.equal(service.windowBridge, windowBridge);
assert.equal(service.isPopupOpen(popup), true);
assert.equal(service.isPopupOpen({ closed: true }), false);
assert.equal(service.popupDocument(popup), popupDocument);
assert.equal(service.openPopupWindow('lyricPopup', 'width=1'), popup);
assert.equal(service.focusPopupWindow(popup), true);
assert.deepEqual(calls, [
  ['service-open', 'lyricPopup'],
  ['service-focus', popup]
]);

const fallback = PopupBridge.create({
  windowRef,
  windowBridge,
  popupServiceFactory: () => null
});
const fallbackPopup = fallback.openPopupWindow('fallback', '');
assert.equal(fallbackPopup.closed, false);
assert.equal(fallback.focusPopupWindow(fallbackPopup), true);
assert.deepEqual(calls.slice(-2), [
  ['bridge-open', 'fallback'],
  ['bridge-focus', fallbackPopup]
]);

console.log('CorePopupWindowBridgeService tests passed');
