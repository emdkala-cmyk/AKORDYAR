const assert = require('node:assert/strict');
const CorePopupRuntimeService = require(
  '../app/CorePopupRuntimeService.js'
);

const calls = [];
const popup = { id: 'player', closed: false };
const lyricOnlyPopup = { id: 'singer', closed: false };
const chordLinePopup = { id: 'chord-line', closed: false };
const state = {};
const windowRef = {
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  NodeFilter: { SHOW_TEXT: 4 },
  Event: class Event {
    constructor(type) {
      this.type = type;
    }
  },
  setTimeout: callback => {
    if (typeof callback === 'function') callback();
    return 1;
  }
};
const documentRef = {
  body: { appendChild() {} },
  getElementById: () => null
};

function service(name, methods = {}) {
  return {
    create() {
      calls.push(name);
      return methods;
    }
  };
}

const runtime = CorePopupRuntimeService.create({
  state,
  window: {
    documentRef,
    windowRef,
    navigatorRef: windowRef.navigator,
    nodeFilter: windowRef.NodeFilter,
    popupWindowBridge: {
      set: () => {},
      get: () => null,
      call: () => false
    },
    isPopupOpen: value => Boolean(value && !value.closed),
    popupDocument: () => null,
    openPopupWindow: name => {
      calls.push(['open', name]);
      return name === 'lyricPopup' ? popup : lyricOnlyPopup;
    },
    focusPopupWindow: value => calls.push(['focus', value.id]),
    EventCtor: windowRef.Event,
    schedule: callback => {
      if (typeof callback === 'function') callback();
      return 1;
    },
    safeMirrorTimeline: () => calls.push('mirror')
  },
  actions: {
    getSongState: () => ({
      getPresentationSnapshot: () => ({})
    }),
    getDAW: () => ({}),
    getTransportPlayhead: () => 0,
    getSyncTimes: () => [],
    transposeChord: name => name,
    renderChords: () => {},
    toast: message => calls.push(['toast', message]),
    translate: key => key,
    getCurrentLang: () => 'fa',
    applyHighlightClassToPopup: () => {}
  },
  services: {
    focusMode: service('focus', { toggleFocusMode: () => calls.push('focus-toggle') }),
    lyricOnlyPopup: service('lyric-only', { sync: () => calls.push('lyric-sync') }),
    chordLinePopup: service('chord-line', {
      openChordLinePopup: () => calls.push('chord-open'),
      syncChordLinePopup: () => calls.push('chord-sync')
    }),
    playerViewSettings: service('settings', {
      getSettings: () => ({}),
      save: () => {},
      apply: () => {},
      setupWheelHandlers: () => {},
      syncHighlight: () => {},
      initialize: () => {},
      fontFamily: value => value
    }),
    playerViewPopupSync: service('popup-sync', {
      syncExistingPopup: () => false
    }),
    playerViewPopupBuilder: service('popup-builder', {
      render: () => calls.push('player-render')
    }),
    playerViewPopup: service('player', {
      sync: () => calls.push('player-sync')
    }),
    chordRenderer: {}
  }
});

assert.deepEqual(calls, [
  'focus',
  'lyric-only',
  'chord-line',
  'settings',
  'popup-sync',
  'popup-builder',
  'player'
]);
assert.equal(runtime.getLyricPopup(), null);
assert.equal(runtime.getFocusMode(), false);

runtime.openLyricPopup();
assert.equal(runtime.getLyricPopup(), popup);
assert.ok(calls.includes('player-sync'));
assert.ok(calls.includes('mirror'));

runtime.openLyricPopup();
assert.ok(
  calls.some(entry => Array.isArray(entry) && entry[0] === 'focus' && entry[1] === 'player')
);
assert.equal(calls.filter(entry => entry === 'player-sync').length, 2);

runtime.openLyricOnlyPopup();
assert.equal(runtime.getLyricOnlyPopup(), lyricOnlyPopup);
assert.ok(calls.includes('lyric-sync'));

runtime.openLyricOnlyPopup();
assert.ok(
  calls.some(entry => Array.isArray(entry) && entry[0] === 'focus' && entry[1] === 'singer')
);
assert.equal(calls.filter(entry => entry === 'lyric-sync').length, 2);

runtime.openChordLinePopup();
runtime.syncChordLinePopup();
runtime.toggleFocusMode();
assert.ok(calls.includes('chord-open'));
assert.ok(calls.includes('chord-sync'));
assert.ok(calls.includes('focus-toggle'));

console.log('CorePopupRuntimeService tests passed');
