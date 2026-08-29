const assert = require('node:assert/strict');
const CoreLyricOnlyPopupService = require(
  '../app/CoreLyricOnlyPopupService.js'
);

function createClassList() {
  const classes = new Set();
  return {
    toggle(name, enabled) {
      if (enabled) classes.add(name);
      else classes.delete(name);
    },
    contains(name) {
      return classes.has(name);
    }
  };
}

function createLine(index) {
  return {
    dataset: { li: String(index) },
    classList: createClassList(),
    offsetTop: index * 40,
    offsetHeight: 20
  };
}

const singerBody = {
  children: [],
  clientHeight: 100,
  scrollTo(options) {
    this.scrollOptions = options;
  },
  querySelector(selector) {
    const match = selector.match(/data-li="(\d+)"/);
    if (!match) return null;
    return this.children.find(line => line.dataset.li === match[1]) || null;
  }
};

const popupBody = {
  attributes: {},
  html: '',
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
};
Object.defineProperty(popupBody, 'innerHTML', {
  get() {
    return this.html;
  },
  set(value) {
    this.html = value;
    singerBody.children = [...value.matchAll(/data-li="(\d+)"/g)]
      .map(match => createLine(Number(match[1])));
  }
});

const popupDocument = {
  title: '',
  documentElement: {},
  head: { innerHTML: '' },
  body: popupBody,
  getElementById(id) {
    return id === 'lopBody' ? singerBody : null;
  }
};

const popup = { name: 'singer-popup' };
let popupOpen = true;
let messageConfig = null;
let cleanupCount = 0;
const bridgeSetCalls = [];
let loopCall = null;
const daw = { isPlaying: false, playhead: 1.5 };

const runtime = CoreLyricOnlyPopupService.create({
  getPopup: () => popup,
  isPopupOpen: () => popupOpen,
  popupDocument: () => popupDocument,
  getSnapshot: () => ({
    title: 'آهنگ تست',
    artist: 'خواننده تست',
    lyrics: 'خط اول\nخط دوم',
    styles: {
      tSize: 24,
      tColor: '#ffffff',
      tFont: 'Vazirmatn',
      tBold: true,
      align: 'center'
    }
  }),
  popupWindowBridge: {
    onMessage(config) {
      messageConfig = config;
      return () => {
        cleanupCount += 1;
      };
    },
    set(...args) {
      bridgeSetCalls.push(args);
    }
  },
  windowRef: { name: 'main-window' },
  getDAW: () => daw,
  getTransportPlayhead: () => daw.playhead,
  getTransportVisualPlayhead: () => daw.playhead,
  getSyncTimes: () => [0, 1],
  installPopupHighlightLoop: (...args) => {
    loopCall = args;
  }
});

runtime.sync();

assert.equal(popupDocument.title, 'آهنگ تست — خواننده تست | خواننده');
assert.equal(popupDocument.documentElement.dir, 'rtl');
assert.equal(popupDocument.documentElement.lang, 'fa');
assert.equal(popupBody.attributes['data-popup-role'], 'singer');
assert.equal(singerBody.children.length, 2);
assert.match(popupDocument.head.innerHTML, /Vazirmatn/);
assert.equal(messageConfig.windowRef.name, 'main-window');
assert.equal(messageConfig.type, 'syncUpdate');
assert.deepEqual(loopCall, [popup, popupDocument]);
assert.equal(
  singerBody.children[1].classList.contains('lop-active'),
  true
);

messageConfig.handler({ data: { activeIdx: 1 } });
assert.equal(singerBody.children[0].classList.contains('lop-active'), false);
assert.equal(singerBody.children[1].classList.contains('lop-active'), true);
assert.equal(singerBody.scrollOptions.behavior, 'smooth');

const highlightSetter = bridgeSetCalls.find(call => call[1] === '_syncHighlight');
assert.equal(typeof highlightSetter[2], 'function');
highlightSetter[2]();
assert.equal(singerBody.children[1].classList.contains('lop-active'), true);

daw.isPlaying = true;
daw.playhead = 0.85;
highlightSetter[2]();
assert.equal(
  singerBody.children[0].classList.contains('lop-active'),
  false
);
assert.equal(
  singerBody.children[1].classList.contains('lop-active'),
  true,
  'هایلایت در زمان پخش باید کمی پیش از نقطه سینک شروع شود'
);

runtime.sync();
assert.equal(cleanupCount, 1);

popupOpen = false;
messageConfig.handler({ data: { activeIdx: 0 } });
assert.equal(cleanupCount, 2);

console.log('CoreLyricOnlyPopupService tests passed');
