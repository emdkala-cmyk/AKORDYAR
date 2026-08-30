const assert = require('node:assert/strict');
const CorePerformanceUiService = require(
  '../app/CorePerformanceUiService.js'
);

function createClassList() {
  const classes = new Set();
  return {
    add(...names) {
      names.forEach(name => classes.add(name));
    },
    remove(...names) {
      names.forEach(name => classes.delete(name));
    },
    contains(name) {
      return classes.has(name);
    }
  };
}

function createElement(tagName = 'div') {
  const listeners = new Map();
  const element = {
    tagName,
    style: {},
    className: '',
    classList: createClassList(),
    dataset: {},
    textContent: '',
    draggable: false,
    children: [],
    listeners,
    onclick: null,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    getBoundingClientRect() {
      return { top: 20, height: 20 };
    },
    querySelector(selector) {
      if (selector === '.pf-current') {
        return this.children.find(child =>
          child.className.includes('pf-current')
        ) || null;
      }
      return null;
    },
    scrollIntoView(options) {
      this.scrollOptions = options;
    }
  };

  let html = '';
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return html;
    },
    set(value) {
      html = value;
      if (value === '') element.children = [];
    }
  });

  return element;
}

const elements = {
  perfSongNum: createElement(),
  perfSongTitle: createElement(),
  perfSongArtist: createElement(),
  perfSongKey: createElement(),
  perfTransVal: createElement(),
  perfTempoVal: createElement(),
  perfSetlist: createElement('section'),
  perfSectionNav: createElement('nav'),
  perfNoteBadge: createElement(),
  perfNoteText: createElement(),
  perfPlayBtn: createElement('button')
};

const documentRef = {
  createElement: tagName => createElement(tagName)
};

const state = {
  perfModeActive: true,
  arrPerformIdx: 0,
  arrPerformData: {
    items: ['song-a', 'song-b'],
    settings: {
      'song-a': { transpose: 1, notes: 'ورود با مکث' },
      'song-b': {}
    }
  }
};

const songs = [
  { id: 'song-a', title: 'Song A', artist: 'Artist A', key: 'C', tempo: 120 },
  { id: 'song-b', title: 'Song B', key: 'G', tempo: 130 }
];

const calls = [];
const daw = {
  isPlaying: false,
  sections: [
    { id: 'section-verse', label: 'ورس ۱', start: 18 },
    { id: 'section-passage', label: 'پاساژ', start: 6 },
    { id: 'section-metronome', label: 'مترونم', start: 0 },
    { id: 'section-outro', label: 'آورتور', start: 12 }
  ]
};

const runtime = CorePerformanceUiService.create({
  documentRef,
  getElement: id => elements[id],
  getPerformanceState: () => state,
  getAllSongs: () => songs,
  getItemSetting: (arr, songId) => arr.settings[songId] || {},
  getCurrentSong: () => ({ key: 'D', keyMode: 'maj', tempo: 90 }),
  getDAW: () => daw,
  getArrangerEnd: () => 20,
  jumpToSong: index => calls.push(['jump', index]),
  saveArrangers: () => calls.push('save'),
  seekTransport: (...args) => calls.push(['seek', ...args]),
  ensureAudioCtx: () => calls.push('audio'),
  startTransport: () => calls.push('start')
});

runtime.render();

assert.equal(elements.perfSongNum.textContent, '1 / 2');
assert.equal(elements.perfSongTitle.textContent, 'Song A');
assert.equal(elements.perfSongArtist.textContent, 'Artist A');
assert.match(elements.perfSongKey.innerHTML, /C ماژور/);
assert.equal(elements.perfTransVal.textContent, '+1');
assert.equal(elements.perfTempoVal.textContent, 120);
assert.equal(elements.perfSetlist.children.length, 2);
assert.equal(elements.perfSectionNav.children.length, 4);
assert.deepEqual(
  elements.perfSectionNav.children.map(child => child.textContent),
  ['مترونم', 'پاساژ', 'آورتور', 'ورس ۱']
);
assert.deepEqual(
  elements.perfSectionNav.children.map(child => child.dataset.sectionStart),
  ['0', '6', '12', '18']
);
assert.equal(elements.perfNoteText.textContent, 'ورود با مکث');
assert.equal(elements.perfNoteBadge.classList.contains('show'), true);
assert.ok(elements.perfSetlist.querySelector('.pf-current').scrollOptions);

elements.perfSetlist.children[0].onclick();
assert.deepEqual(calls.shift(), ['jump', 0]);

const firstItem = elements.perfSetlist.children[0];
const secondItem = elements.perfSetlist.children[1];
firstItem.listeners.get('dragstart')({
  dataTransfer: {
    effectAllowed: '',
    setData() {}
  }
});
secondItem.getBoundingClientRect = () => ({ top: 20, height: 20 });
secondItem.listeners.get('drop')({
  preventDefault() {},
  clientY: 40
});

assert.deepEqual(state.arrPerformData.items, ['song-b', 'song-a']);
assert.ok(calls.includes('save'));
assert.equal(elements.perfSetlist.children[0].textContent, '');
assert.match(elements.perfSetlist.children[0].innerHTML, /Song B/);

elements.perfSectionNav.children[0].onclick();
assert.deepEqual(calls.find(call => Array.isArray(call) && call[0] === 'seek'), [
  'seek',
  0,
  false,
  true
]);
assert.ok(calls.includes('audio'));
assert.ok(calls.includes('start'));

elements.perfSectionNav.children[1].onclick();
assert.deepEqual(
  calls.find(call => Array.isArray(call) && call[0] === 'seek' && call[1] === 6),
  ['seek', 6, false, true]
);

console.log('CorePerformanceUiService tests passed');
