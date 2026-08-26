const assert = require('node:assert/strict');
const CoreArrangerSetlistRendererService = require(
  '../app/CoreArrangerSetlistRendererService.js'
);

function createClassList() {
  const classes = new Set();
  return {
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    contains(name) {
      return classes.has(name);
    }
  };
}

function createElement() {
  const listeners = new Map();
  const element = {
    style: {},
    dataset: {},
    children: [],
    className: '',
    classList: createClassList(),
    listeners,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(type, callback) {
      listeners.set(type, callback);
    }
  };
  let html = '';
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return html;
    },
    set(value) {
      html = value;
      if (value === '') this.children = [];
    }
  });
  return element;
}

const elements = { arrSetlist: createElement(), arrSearchInput: { value: '' } };
const documentRef = { createElement: () => createElement() };
const editingArr = {
  items: ['song-1', 'song-2'],
  _itemSettings: {
    'song-1': { transpose: 0, notes: '' },
    'song-2': { transpose: 1, notes: 'یادداشت' }
  }
};
const songs = [
  { id: 'song-1', title: 'Song One', artist: 'Artist One', genre: 'Pop' },
  { id: 'song-2', title: 'Song Two', artist: 'Artist Two', genre: 'Rock' }
];
const calls = [];

const runtime = CoreArrangerSetlistRendererService.create({
  documentRef,
  getElement: id => elements[id],
  getEditingArr: () => editingArr,
  getAllSongs: () => songs,
  getSearchQuery: () => elements.arrSearchInput.value,
  ensureArrItem: (arr, index) => {
    const id = arr.items[index];
    arr._itemSettings[id] ||= { transpose: 0, notes: '' };
    return arr._itemSettings[id];
  },
  saveArrangers: () => calls.push('save'),
  openArrSongNote: index => calls.push(['note', index]),
  translate: key => ({ addFromLeft: 'از سمت چپ اضافه کنید', untitled: 'بدون نام' }[key] || key)
});

runtime.render();
assert.equal(elements.arrSetlist.children.length, 2);
assert.match(elements.arrSetlist.children[0].innerHTML, /Song One/);
assert.match(elements.arrSetlist.children[1].innerHTML, /has-notes/);

const first = elements.arrSetlist.children[0];
first.onclick({
  target: {
    closest: () => ({ dataset: { a: 'trans-up' } })
  }
});
assert.equal(editingArr._itemSettings['song-1'].transpose, 1);
assert.ok(calls.includes('save'));

const firstAfterTranspose = elements.arrSetlist.children[0];
const secondAfterTranspose = elements.arrSetlist.children[1];
firstAfterTranspose.listeners.get('dragstart')();
secondAfterTranspose.listeners.get('drop')({
  preventDefault() {}
});
assert.deepEqual(editingArr.items, ['song-2', 'song-1']);

runtime.render();
elements.arrSearchInput.value = 'song one';
runtime.render();
assert.equal(elements.arrSetlist.children.length, 1);

elements.arrSearchInput.value = '';
runtime.render();
elements.arrSetlist.children[0].onclick({
  target: {
    closest: () => ({ dataset: { a: 'notes' } })
  }
});
assert.deepEqual(calls.at(-1), ['note', 0]);

editingArr.items.length = 0;
runtime.render();
assert.match(elements.arrSetlist.innerHTML, /از سمت چپ اضافه کنید/);

console.log('CoreArrangerSetlistRendererService tests passed');
