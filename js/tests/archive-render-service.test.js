const assert = require('node:assert/strict');
const ArchiveRenderService = require('../archive/ArchiveRenderService.js');

function createElement() {
  return {
    className: '',
    dataset: {},
    style: {},
    innerHTML: '',
    children: [],
    tabIndex: 0,
    setAttribute() {},
    appendChild(child) {
      this.children.push(child);
    }
  };
}

const documentRef = {
  createElement: () => createElement()
};
const list = createElement();
let syncCount = 0;
const service = ArchiveRenderService.create({
  documentRef,
  requestFrame: callback => callback(),
  escapeHtml: value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;'),
  syncSelectAll: () => { syncCount++; }
});

const songs = [
  {
    id: 'song-1',
    title: '<ترانه>',
    artist: 'خواننده',
    favorite: true,
    key: 'C',
    keyMode: 'min',
    tempo: 100,
    timeSignature: '4/4',
    genre: 'pop',
    categories: ['زنده'],
    updatedAt: '2026-08-20T10:00:00.000Z'
  },
  {
    id: 'song-2',
    title: 'حذف‌شده',
    deletedAt: '2026-08-21T10:00:00.000Z',
    updatedAt: '2026-08-21T10:00:00.000Z'
  }
];
const selectedIds = new Set(['song-1']);

service.render(list, songs, {
  viewMode: 'table',
  selectMode: true,
  selectedIds,
  activeId: 'song-1'
});
assert.match(list.innerHTML, /archive-table-header/);
assert.match(list.innerHTML, /selected-row/);
assert.match(list.innerHTML, /&lt;ترانه&gt;/);
assert.match(list.innerHTML, /arch-select-all-cb/);
assert.equal(syncCount, 1);

list.innerHTML = '';
list.children = [];
service.render(list, songs, {
  viewMode: 'card',
  selectMode: true,
  selectedIds,
  activeId: 'song-1'
});
assert.equal(list.children.length, 2);
assert.match(list.children[0].innerHTML, /archive-card-title/);
assert.match(list.children[0].innerHTML, /archive-tag-genre/);
assert.match(list.children[0].innerHTML, /data-arch-action="fav"/);
assert.match(list.children[1].innerHTML, /permanent-delete/);
assert.equal(syncCount, 2);

list.innerHTML = '';
list.children = [];
service.render(list, [{
  id: 'heavy-6-8',
  title: 'Heavy 6/8',
  genre: 'heavy-6-8'
}], {
  viewMode: 'card',
  selectMode: false,
  selectedIds: new Set(),
  activeId: null
});
assert.match(list.children[0].innerHTML, /6\/8 سنگین/);

service.renderEmpty(list, {
  query: 'missing',
  isTrash: false,
  currentTab: 'all'
});
assert.ok(list.innerHTML.includes('نتیجه‌ای یافت نشد') || list.innerHTML.includes('noResults'), `Expected 'نتیجه‌ای یافت نشد' or 'noResults' in innerHTML`);

console.log('ArchiveRenderService tests passed');
