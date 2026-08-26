const assert = require('node:assert/strict');
const CorePlayerViewPopupBuilderService = require(
  '../app/CorePlayerViewPopupBuilderService.js'
);

let initialized = 0;
let highlighted = 0;
const appended = [];
const doc = {
  title: '',
  documentElement: {},
  head: { innerHTML: '' },
  body: {
    innerHTML: '',
    setAttribute: (name, value) => {
      doc.body[name] = value;
    },
    appendChild: node => appended.push(node)
  }
};
const runtime = CorePlayerViewPopupBuilderService.create({
  popup: { closed: false },
  popupWindowBridge: {
    set: (_popup, key, value) => {
      doc[key] = value;
    }
  },
  chordRenderer: {
    createScript: (_doc, chords, config) => ({
      data: { chords, config }
    })
  },
  settingsRuntime: {
    getSettings: () => ({ cSize: 22, cColor: '#fff' }),
    initialize: () => {
      initialized++;
    }
  },
  applyHighlightClassToPopup: () => {
    highlighted++;
  }
});

runtime.render({
  documentRef: doc,
  title: 'Song',
  sub: 'Artist  ·  Key: C',
  lines: ['Line one', 'Line two'],
  styles: {
    tSize: 24,
    tColor: '#0fa966',
    tFont: 'Vazirmatn',
    tBold: 'bold',
    align: 'center',
    cSize: 20,
    cColor: '#e6aa28',
    cFont: 'JetBrains Mono'
  },
  chords: [{ lineIndex: 0, charIndex: 0, _name: 'C' }]
});

assert.equal(doc.title, 'Song — Artist | نوازنده');
assert.equal(doc.documentElement.dir, 'rtl');
assert.match(doc.body.innerHTML, /popupBody/);
assert.match(doc.body.innerHTML, /Line one/);
assert.equal(doc.body['data-popup-role'], 'player');
assert.equal(highlighted, 1);
assert.equal(initialized, 1);
assert.equal(appended.length, 1);
assert.equal(doc._pCfg.cSize, 22);

console.log('CorePlayerViewPopupBuilderService tests passed');
