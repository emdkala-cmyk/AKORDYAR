const assert = require('node:assert/strict');
const CoreArrangerPoolRendererService = require(
  '../app/CoreArrangerPoolRendererService.js'
);

function createElement() {
  const element = {
    className: '',
    children: [],
    appendChild(child) {
      this.children.push(child);
    }
  };
  let html = '';
  Object.defineProperty(element, 'innerHTML', {
    get: () => html,
    set: value => {
      html = value;
      element.children = [];
    }
  });
  return element;
}

const pool = createElement();
const elements = new Map([['arrPool', pool]]);
const songs = [
  { id: 'song-1', title: 'First', artist: 'Singer', key: 'C', genre: 'Pop' },
  { id: 'song-2', title: 'Second', artist: 'Band', key: 'Dm', genre: 'Rock' },
  { id: 'song-3', title: '', artist: '', key: '', genre: '' }
];
const editingArr = { items: ['song-1'] };
const calls = [];
let query = '';

const runtime = CoreArrangerPoolRendererService.create({
  documentRef: { createElement },
  getElement: id => elements.get(id),
  getEditingArr: () => editingArr,
  getAllSongs: () => songs,
  getSearchQuery: () => query,
  saveArrangers: () => calls.push('save'),
  renderArrSetlist: () => calls.push('setlist'),
  translate: key => ({ allInSetlist: 'All in setlist', untitled: 'Untitled' }[key] || key)
});

runtime.render();
assert.equal(pool.children.length, 2);
assert.match(pool.children[0].innerHTML, /Second/);
assert.match(pool.children[1].innerHTML, /Untitled/);
pool.children[0].onclick();
assert.deepEqual(editingArr.items, ['song-1', 'song-2']);
assert.deepEqual(calls, ['save', 'setlist']);

query = 'rock';
runtime.render();
assert.equal(pool.children.length, 0);
assert.match(pool.innerHTML, /No|نتیجه/);

query = 'does-not-exist';
runtime.render();
assert.equal(pool.children.length, 0);
assert.match(pool.innerHTML, /نتیجه‌ای یافت نشد/);

console.log('CoreArrangerPoolRendererService tests passed');
