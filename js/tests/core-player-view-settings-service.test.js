const assert = require('node:assert/strict');
const CorePlayerViewSettingsService = require(
  '../app/CorePlayerViewSettingsService.js'
);

const stored = {
  achord_player_view_settings: JSON.stringify({
    tSize: 30,
    cSize: 21,
    bold: false
  })
};
const storage = {
  getItem: key => stored[key] || null,
  setItem: (key, value) => {
    stored[key] = value;
  }
};

const makeElement = (id, extra = {}) => ({
  id,
  style: {},
  dataset: {},
  classList: { toggle() {} },
  addEventListener() {},
  ...extra
});

const controls = {
  'pv-settings-toggle': makeElement('pv-settings-toggle'),
  'pv-settings': makeElement('pv-settings', {
    contains: () => false,
    style: { display: 'none' }
  }),
  'pv-font': makeElement('pv-font'),
  'pv-tColor': makeElement('pv-tColor'),
  'pv-cColor': makeElement('pv-cColor'),
  'pv-bgColor': makeElement('pv-bgColor'),
  'pv-tSize': makeElement('pv-tSize'),
  'pv-cSize': makeElement('pv-cSize'),
  'pv-tSizeVal': makeElement('pv-tSizeVal', { textContent: '' }),
  'pv-cSizeVal': makeElement('pv-cSizeVal', { textContent: '' }),
  'pv-scaleLock': makeElement('pv-scaleLock'),
  'pv-bold': makeElement('pv-bold'),
  chordMirrorHandle: makeElement('chordMirrorHandle'),
  chordMirrorResize: makeElement('chordMirrorResize', { offsetHeight: 94 }),
  playerChordMirror: makeElement('playerChordMirror')
};
const toggles = [];
let playhead = 2.5;
const lines = [
  makeElement('line-0', {
    dataset: { li: '0' },
    classList: { toggle: (...args) => toggles.push(args) },
    offsetTop: 10,
    offsetHeight: 20,
    style: {}
  }),
  makeElement('line-1', {
    dataset: { li: '1' },
    classList: { toggle: (...args) => toggles.push(args) },
    offsetTop: 120,
    offsetHeight: 20,
    style: {}
  })
];
const body = {
  style: {},
  children: lines,
  scrollTop: 0,
  addEventListener() {},
  querySelectorAll: selector => selector === '.eline' ? lines : [],
  querySelector: () => lines[1],
  getElementById: () => null,
  scrollTo: options => {
    body.lastScroll = options;
  },
  clientHeight: 100
};
const doc = {
  body,
  getElementById: id => id === 'popupBody' ? body : controls[id],
  querySelectorAll: selector => selector === '.eline' ? lines : [],
  addEventListener() {}
};
const popup = { closed: false };
const bridgeValues = new Map();
let loopInstalled = 0;
const runtime = CorePlayerViewSettingsService.create({
  storage,
  getPopup: () => popup,
  popupDocument: () => doc,
  popupWindowBridge: {
    get: (_popup, key) => bridgeValues.get(key),
    set: (_popup, key, value) => bridgeValues.set(key, value),
    call: () => true,
    dispatch: () => true
  },
  getSongState: () => ({ getSyncTimes: () => [0, 2] }),
  getDAW: () => ({ isPlaying: false, playhead }),
  installPopupHighlightLoop: () => {
    loopInstalled++;
  },
  schedule: () => {}
});

bridgeValues.set('_pCfg', { cSize: 1, cColor: '#000' });
runtime.initialize();

assert.equal(runtime.getSettings().tSize, 30);
assert.equal(runtime.getSettings().cSize, 21);
assert.equal(controls['pv-tSize'].value, 30);
assert.equal(controls['pv-cSize'].value, 21);
assert.equal(controls['pv-bold'].checked, false);
assert.equal(loopInstalled, 1);
assert.equal(bridgeValues.get('_pCfg').cSize, 21);

runtime.syncHighlight();
runtime.syncHighlight();
assert.ok(toggles.some(([name, value]) => name === 'active' && value === false));
assert.ok(toggles.some(([name, value]) => name === 'active' && value === true));
assert.deepEqual(body.lastScroll, {
  top: 80,
  behavior: 'smooth'
});
assert.equal(lines[1].style.color, '');
assert.equal(lines[0].style.color, '#0fa966');

body.lastScroll = null;
body.scrollTop = 80;
playhead = -1;
runtime.syncHighlight();
playhead = 2.5;
runtime.syncHighlight();
assert.equal(
  body.lastScroll,
  null,
  'خط فعال داخل محدوده امن نباید اسکرول جدید ایجاد کند'
);

// Regression: Electron can expose the popup before its first layout pass.
// The same active line must be retried once its dimensions are available.
body.lastScroll = null;
body.scrollTop = 0;
body.clientHeight = 0;
runtime.apply(doc);
assert.equal(body.lastScroll, null);
body.clientHeight = 100;
runtime.syncHighlight();
runtime.syncHighlight();
assert.deepEqual(body.lastScroll, {
  top: 80,
  behavior: 'smooth'
});

controls['pv-tSize'].value = 35;
controls['pv-tSize'].oninput();
assert.equal(runtime.getSettings().tSize, 35);
assert.equal(runtime.getSettings().cSize, 25);
assert.equal(JSON.parse(stored.achord_player_view_settings).tSize, 35);

console.log('CorePlayerViewSettingsService tests passed');
