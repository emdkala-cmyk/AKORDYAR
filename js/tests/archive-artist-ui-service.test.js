const assert = require('node:assert/strict');
const ArchiveArtistUiService = require(
  '../archive/ArchiveArtistUiService.js'
);

const elements = new Map();
const documentRef = {
  createElement: tagName => ({
    tagName,
    className: '',
    tabIndex: 0,
    dataset: {},
    style: {},
    classList: {
      values: new Set(),
      add(name) { this.values.add(name); },
      remove(name) { this.values.delete(name); },
      toggle(name, force) {
        if (force) this.values.add(name);
        else this.values.delete(name);
      }
    },
    setAttribute() {},
    appendChild() {},
    querySelectorAll: () => [],
    querySelector: () => null
  }),
  querySelector: () => null
};

const defaultArtists = [
  { normalizedName: 'artist-a', displayName: 'Artist A', aliases: ['A'] },
  { normalizedName: 'artist-b', displayName: 'Artist B' }
];
const songs = [
  { id: '1', artist: 'A', updatedAt: '2026-08-20' },
  { id: '2', artist: 'Artist B', updatedAt: '2026-08-21' },
  { id: '3', artist: 'New Artist', deletedAt: '2026-08-22' }
];

let artistFilter = null;
let cache = null;
const contextMenu = {
  style: {},
  classList: { add() {}, remove() {} },
  querySelectorAll: () => [{ style: {} }, { style: {} }, { style: {} }, { style: {} }, { style: {} }]
};
elements.set('artistCtxMenu', contextMenu);
let contextRenders = 0;
const service = ArchiveArtistUiService.create({
  documentRef,
  getElement: id => elements.get(id),
  getAllSongs: () => songs,
  getDefaultArtists: () => defaultArtists,
  artistKey: value => String(value || '').trim().toLowerCase().replace(/\s+/g, '-'),
  matchDefaultArtist: value =>
    value === 'A' ? defaultArtists[0] : value === 'Artist B' ? defaultArtists[1] : null,
  normalizeText: value => String(value || '').trim().toLowerCase(),
  getArtistCache: () => cache,
  setArtistCache: value => { cache = value; },
  getArtistFilter: () => artistFilter,
  setArtistFilter: value => { artistFilter = value; },
  getArtistImage: () => 'data:image/jpeg;base64,test',
  refreshArtists: () => { contextRenders++; },
  toast: () => {},
  requestFrame: () => 1,
  cancelFrame: () => {}
});

const artists = service.buildArtistList();
assert.deepEqual(
  artists.map(artist => [artist.normalizedName, artist.count]),
  [['artist-a', 1], ['artist-b', 1]]
);
assert.equal(artists.some(artist => artist.normalizedName === 'new-artist'), false);
service.showArtistContext({
  clientX: 10,
  clientY: 20,
  preventDefault() {},
  stopPropagation() {}
}, 'artist-a');
service.artistContextAction('remove-image');
assert.equal(contextRenders, 1);

const section = documentRef.createElement('section');
elements.set('artistSliderSection', section);
let collapsed = false;
const persisted = [];
const sectionService = ArchiveArtistUiService.create({
  documentRef,
  getElement: id => elements.get(id),
  storage: { setItem: (key, value) => persisted.push([key, value]) },
  getSectionCollapsed: () => collapsed,
  setSectionCollapsed: value => { collapsed = value; }
});
sectionService.toggleArtistSection();
assert.equal(collapsed, true);
assert.deepEqual(persisted, [['arch_artists_collapsed', true]]);
assert.equal(section.classList.values.has('collapsed'), true);

let fullscreen = false;
const fullscreenService = ArchiveArtistUiService.create({
  documentRef: {
    ...documentRef,
    querySelector: () => null
  },
  getFullscreen: () => fullscreen,
  setFullscreen: value => { fullscreen = value; }
});
fullscreenService.toggleFullscreen();
assert.equal(fullscreen, true);

console.log('ArchiveArtistUiService tests passed');
