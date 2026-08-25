const assert = require('node:assert/strict');
const ArchiveListViewService = require('../archive/ArchiveListViewService.js');

function element() {
  return {
    dataset: {},
    classList: {
      values: new Set(),
      toggle(name, force) {
        if (force) this.values.add(name);
        else this.values.delete(name);
      }
    }
  };
}

const viewCard = element();
const viewTable = element();
const archiveList = element();
const tabAll = element();
tabAll.dataset.tab = 'all';
const tabFav = element();
tabFav.dataset.tab = 'fav';
const elements = new Map([
  ['archViewCard', viewCard],
  ['archViewTable', viewTable],
  ['archiveList', archiveList]
]);
const storageValues = new Map();
const tabs = [tabAll, tabFav];
const calls = [];
let viewMode = 'card';
let currentTab = 'all';
const service = ArchiveListViewService.create({
  documentRef: { querySelectorAll: () => tabs },
  storage: {
    setItem: (key, value) => storageValues.set(key, value)
  },
  getElement: id => elements.get(id),
  getViewMode: () => viewMode,
  setViewMode: value => { viewMode = value; },
  getCurrentTab: () => currentTab,
  setCurrentTab: value => { currentTab = value; },
  render: () => calls.push('render'),
  loadSong: id => calls.push(`open:${id}`),
  loadSongReadOnly: id => calls.push(`readonly:${id}`),
  editSong: id => calls.push(`edit:${id}`),
  toggleFavorite: id => calls.push(`fav:${id}`),
  duplicateSong: id => calls.push(`duplicate:${id}`),
  exportSong: id => calls.push(`export:${id}`),
  trashSong: id => calls.push(`trash:${id}`),
  restoreSong: id => calls.push(`restore:${id}`),
  permanentDelete: id => calls.push(`delete:${id}`),
  showContextMenu: (_, id) => calls.push(`menu:${id}`)
});

service.setView('table');
assert.equal(viewMode, 'table');
assert.equal(storageValues.get('arch_view_mode'), 'table');
assert.equal(viewCard.classList.values.has('active-blue'), false);
assert.equal(viewTable.classList.values.has('active-blue'), true);
assert.equal(archiveList.classList.values.has('table-view'), true);

service.setTab('fav');
assert.equal(currentTab, 'fav');
assert.equal(tabAll.classList.values.has('active'), false);
assert.equal(tabFav.classList.values.has('active'), true);
assert.equal(calls.filter(call => call === 'render').length, 2);

const card = { dataset: { songId: 'song-1' } };
const action = {
  dataset: { archAction: 'fav' },
  closest: selector => selector === '[data-arch-action]' ? action : null
};
const actionEvent = {
  target: {
    closest: selector => {
      if (selector === '[data-song-id]') return card;
      if (selector === '[data-arch-action]') return action;
      return null;
    }
  },
  stopPropagation: () => calls.push('stopped')
};
service.handleListClick(actionEvent);
assert.ok(calls.includes('fav:song-1'));
assert.ok(calls.includes('stopped'));

service.handleListKeydown({
  key: 'Enter',
  target: { closest: () => card }
});
service.handleListKeydown({
  key: 'Delete',
  target: { closest: () => card }
});
assert.ok(calls.includes('open:song-1'));
assert.ok(calls.includes('trash:song-1'));

for (const [actionName, expected] of [
  ['open', 'open:song-1'],
  ['readonly', 'readonly:song-1'],
  ['edit', 'edit:song-1'],
  ['duplicate', 'duplicate:song-1'],
  ['export', 'export:song-1'],
  ['restore', 'restore:song-1'],
  ['permanent-delete', 'delete:song-1'],
  ['menu', 'menu:song-1']
]) {
  service.dispatchAction(actionName, 'song-1', {});
  assert.ok(calls.includes(expected), actionName);
}

console.log('ArchiveListViewService tests passed');
