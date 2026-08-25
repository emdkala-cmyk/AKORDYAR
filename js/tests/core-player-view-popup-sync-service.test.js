const assert = require('node:assert/strict');
const CorePlayerViewPopupSyncService = require(
  '../app/CorePlayerViewPopupSyncService.js'
);

const calls = [];
const line = {
  textContent: 'old',
  style: {},
  classList: { toggle() {} }
};
const body = {
  offsetHeight: 0,
  querySelectorAll: () => [line],
  innerHTML: '',
  getElementById: () => null
};
const doc = {
  querySelector: selector =>
    selector === 'script[data-pv="chord"]' ? {} : null,
  getElementById: id => (id === 'popupBody' ? body : null)
};
const values = new Map([['_pStructureVersion', 0], ['_pCfg', {}]]);
const runtime = CorePlayerViewPopupSyncService.create({
  popup: { closed: false },
  documentRef: () => doc,
  popupWindowBridge: {
    get: (_popup, key) => values.get(key),
    set: (_popup, key, value) => values.set(key, value),
    call: (_popup, method, reason) => {
      calls.push([method, reason]);
      return true;
    },
    dispatch: (_popup, event) => calls.push(['dispatch', event.type])
  },
  getSnapshot: () => ({
    lyrics: 'new',
    transpose: 0,
    chords: [{ lineIndex: 0, charIndex: 0, anchorType: 'LineStart', name: 'C' }],
    styles: {
      tSize: 24,
      tColor: '#0fa966',
      tFont: 'Vazirmatn',
      tBold: 'bold',
      align: 'center'
    }
  }),
  transposeChord: name => name,
  getSettings: () => ({
    tSize: 30,
    tColor: '#fff',
    font: 'Lalezar',
    bold: true,
    cSize: 20,
    cColor: '#e6aa28'
  }),
  schedule: () => {}
});

assert.equal(runtime.syncExistingPopup(), true);
assert.match(body.innerHTML, /data-li="0"/);
assert.equal(line.style.fontSize, '30px');
assert.equal(values.get('_pChords')[0]._name, 'C');
assert.ok(calls.some(([method]) => method === '_pScheduleChordRender'));
assert.equal(runtime.syncExistingPopup(), true);

const emptyRuntime = CorePlayerViewPopupSyncService.create({
  documentRef: { querySelector: () => null }
});
assert.equal(emptyRuntime.syncExistingPopup(), false);

console.log('CorePlayerViewPopupSyncService tests passed');
