const assert = require('node:assert/strict');
const ArchiveRenderCoordinatorService = require(
  '../archive/ArchiveRenderCoordinatorService.js'
);

function element(value = '') {
  return {
    value,
    textContent: '',
    innerHTML: '',
    style: {}
  };
}

const elements = new Map([
  ['archiveSearch', element()],
  ['filterSig', element()],
  ['filterGenre', element()],
  ['filterTempo', element()],
  ['filterKey', element()],
  ['filterSort', element('newest')],
  ['tabCountAll', element()],
  ['tabCountFav', element()],
  ['tabCountTrash', element()],
  ['archiveTotalCount', element()],
  ['archiveResultCount', element()],
  ['archiveStatusText', element()],
  ['archiveFilterBar', element()],
  ['archiveList', element()]
]);
const songs = [
  {
    id: 'song-1',
    title: 'آهنگ اول',
    artist: 'خواننده اول',
    favorite: false,
    createdAt: '2026-08-01',
    tempo: 100,
    key: 'C',
    keyMode: 'maj',
    timeSignature: '4/4',
    genre: 'پاپ'
  },
  {
    id: 'song-2',
    title: 'آهنگ دوم',
    artist: 'خواننده دوم',
    favorite: true,
    createdAt: '2026-08-02',
    tempo: 170,
    key: 'Am',
    keyMode: 'min',
    timeSignature: '6/8',
    genre: 'راک'
  },
  {
    id: 'song-3',
    title: 'ترانه حذف‌شده',
    artist: 'خواننده سوم',
    deletedAt: '2026-08-03',
    favorite: true,
    createdAt: '2026-08-03',
    tempo: 80
  }
];
let currentTab = 'all';
let artistFilter = null;
const renders = [];
const emptyRenders = [];
const service = ArchiveRenderCoordinatorService.create({
  getElement: id => elements.get(id),
  getAllSongs: () => songs,
  normalizeText: value => String(value ?? '').trim().toLowerCase(),
  extractSearchText: song =>
    `${song.title} ${song.artist}`.trim().toLowerCase(),
  getCurrentTab: () => currentTab,
  getArtistFilter: () => artistFilter,
  matchDefaultArtist: artist => (
    artist === 'خواننده اول' ? { normalizedName: 'خواننده اول' } : null
  ),
  artistKey: value => String(value ?? '').trim().toLowerCase(),
  getViewMode: () => 'table',
  getSelectMode: () => true,
  getSelectedIds: () => new Set(['song-2']),
  getActiveSongId: () => 'song-2',
  renderList: (list, visibleSongs, options) => {
    renders.push({ list, ids: visibleSongs.map(song => song.id), options });
  },
  renderEmpty: (list, options) => {
    emptyRenders.push({ list, options });
  }
});

service.render();
assert.equal(elements.get('tabCountAll').textContent, 2);
assert.equal(elements.get('tabCountFav').textContent, 1);
assert.equal(elements.get('tabCountTrash').textContent, 1);
assert.equal(elements.get('archiveResultCount').textContent, '2 نتیجه');
assert.deepEqual(renders.at(-1).ids, ['song-2', 'song-1']);
assert.equal(renders.at(-1).options.viewMode, 'table');
assert.equal(renders.at(-1).options.selectMode, true);

currentTab = 'trash';
service.render();
assert.deepEqual(renders.at(-1).ids, ['song-3']);
assert.equal(elements.get('archiveStatusText').textContent, 'سطل زباله');
assert.equal(elements.get('archiveFilterBar').style.display, 'none');

currentTab = 'all';
artistFilter = 'خواننده اول';
elements.get('archiveSearch').value = 'اول';
elements.get('filterTempo').value = 'mid';
elements.get('filterKey').value = '_maj';
service.render();
assert.deepEqual(renders.at(-1).ids, ['song-1']);

elements.get('archiveSearch').value = 'بدون نتیجه';
service.render();
assert.equal(emptyRenders.at(-1).options.query, 'بدون نتیجه');
assert.equal(emptyRenders.at(-1).options.isTrash, false);

console.log('ArchiveRenderCoordinatorService tests passed');
