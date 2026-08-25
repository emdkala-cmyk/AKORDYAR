const assert = require('node:assert/strict');
const CoreChordLinePopupService = require(
  '../app/CoreChordLinePopupService.js'
);

const popup = { closed: false };
const controls = {
  clpSyncBtn: {},
  clpTransUp: {},
  clpTransDown: {},
  clpTransVal: { textContent: '' },
  clpCopyBtn: {},
  clpBody: {
    children: [],
    scrollTop: 0,
    getBoundingClientRect: () => ({ top: 0, left: 0 })
  }
};
const doc = {
  title: '',
  documentElement: {},
  head: { innerHTML: '' },
  body: { innerHTML: '' },
  getElementById: id => controls[id],
  createElement: () => ({
    style: {},
    classList: { toggle() {} }
  })
};

const songState = {
  getPresentationSnapshot: () => ({
    title: 'آهنگ تست',
    artist: 'هنرمند',
    key: 'C',
    keyMode: 'maj',
    lyrics: 'خط اول\nخط دوم',
    styles: {
      tSize: 24,
      tColor: '#0fa966',
      tFont: 'Vazirmatn',
      tBold: true,
      align: 'center',
      cSize: 20,
      cColor: '#e6aa28',
      cFont: 'JetBrains Mono'
    },
    chordLineClips: [],
    transpose: 0
  })
};

let currentPopup = null;
let opened = 0;
let focused = 0;
const runtime = CoreChordLinePopupService.create({
  getPopup: () => currentPopup,
  setPopup: popupValue => {
    currentPopup = popupValue;
  },
  getSongState: () => songState,
  isPopupOpen: value => value === popup,
  popupDocument: () => doc,
  openPopupWindow: () => {
    opened++;
    return popup;
  },
  focusPopupWindow: () => {
    focused++;
  },
  popupWindowBridge: {
    onMessage: () => null
  },
  transposeChord: name => name
});

runtime.openChordLinePopup();
assert.equal(opened, 1);
assert.equal(currentPopup, popup);
assert.match(doc.body.innerHTML, /clpSyncBtn/);
assert.match(doc.body.innerHTML, /خط اول/);
assert.equal(doc.title, 'آهنگ تست — هنرمند | Chord Line');

runtime.openChordLinePopup();
assert.equal(focused, 1);

currentPopup = { closed: true };
runtime.syncChordLinePopup();
assert.equal(opened, 1);

console.log('CoreChordLinePopupService tests passed');
