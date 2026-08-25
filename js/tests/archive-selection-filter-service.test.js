const assert = require('node:assert/strict');
const ArchiveSelectionFilterService = require(
  '../archive/ArchiveSelectionFilterService.js'
);

function element() {
  return {
    value: '',
    checked: false,
    indeterminate: false,
    classList: {
      values: new Set(),
      toggle(name, force) {
        if (force) this.values.add(name);
        else this.values.delete(name);
      },
      add(name) {
        this.values.add(name);
      },
      remove(name) {
        this.values.delete(name);
      }
    },
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

const elementMap = new Map();
[
  'archSelectBtn',
  'archiveBulkBar',
  'bulkCount',
  'archiveList',
  'archiveSearch',
  'archiveSearchClear',
  'filterSig',
  'filterGenre',
  'filterTempo',
  'filterKey',
  'filterSort'
].forEach(id => elementMap.set(id, element()));

const rows = [{ dataset: { songId: 'a' } }, { dataset: { songId: 'b' } }];
const checkbox = element();
elementMap.get('archiveList').querySelectorAll = () => rows;
elementMap.get('archiveList').querySelector = selector =>
  selector === '.arch-select-all-cb' ? checkbox : null;

const selectedIds = new Set();
let selectMode = false;
let currentTab = 'all';
let artistFilter = 'artist';
const songs = [
  { id: 'a', favorite: true },
  { id: 'b', favorite: false },
  { id: 'trash', favorite: true, deletedAt: '2026-08-01' }
];
const calls = [];
const service = ArchiveSelectionFilterService.create({
  getElement: id => elementMap.get(id),
  selectedIds,
  getSelectMode: () => selectMode,
  setSelectMode: value => {
    selectMode = value;
  },
  render: () => calls.push('render'),
  getCurrentTab: () => currentTab,
  getAllSongs: () => songs,
  setArtistFilter: value => {
    artistFilter = value;
  },
  renderArtists: () => calls.push('artists'),
  updateActiveFilters: () => calls.push('active-filters')
});

service.toggleMode();
assert.equal(selectMode, true);
assert.equal(selectedIds.size, 0);
assert.equal(elementMap.get('archiveBulkBar').classList.values.has('show'), true);

service.toggle('a');
assert.equal(selectedIds.has('a'), true);
assert.equal(elementMap.get('bulkCount').textContent, '1 انتخاب شده');

service.selectAll(true);
assert.deepEqual([...selectedIds].sort(), ['a', 'b']);
service.syncSelectAllCheckbox();
assert.equal(checkbox.checked, true);
assert.equal(checkbox.indeterminate, false);

service.toggle('a');
service.syncSelectAllCheckbox();
assert.equal(checkbox.checked, false);
assert.equal(checkbox.indeterminate, true);

currentTab = 'fav';
assert.deepEqual(service.getFilteredSongs().map(song => song.id), ['a']);
currentTab = 'trash';
assert.deepEqual(service.getFilteredSongs().map(song => song.id), ['trash']);

elementMap.get('archiveSearch').value = 'query';
elementMap.get('filterSig').value = '4/4';
service.clearFilters();
assert.equal(elementMap.get('archiveSearch').value, '');
assert.equal(elementMap.get('filterSig').value, '');
assert.equal(elementMap.get('filterSort').value, 'newest');
assert.equal(artistFilter, null);
assert.ok(calls.includes('artists'));
assert.ok(calls.includes('active-filters'));

console.log('ArchiveSelectionFilterService tests passed');
