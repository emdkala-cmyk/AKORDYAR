const assert = require('node:assert/strict');
const ArchiveLifecycleService = require('../archive/ArchiveLifecycleService.js');

function element() {
  return {
    value: '',
    style: {},
    listeners: new Map(),
    classList: {
      values: new Set(),
      toggle(name, force) {
        if (force === undefined) {
          if (this.values.has(name)) this.values.delete(name);
          else this.values.add(name);
        } else if (force) this.values.add(name);
        else this.values.delete(name);
      },
      add(name) {
        this.values.add(name);
      },
      remove(name) {
        this.values.delete(name);
      },
      contains(name) {
        return this.values.has(name);
      }
    },
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    }
  };
}

const ids = [
  'archiveList',
  'archiveSearch',
  'archiveSearchClear',
  'archiveModal',
  'archiveCtxMenu',
  'filterSig',
  'filterGenre',
  'filterTempo',
  'filterKey',
  'filterSort'
];
const elements = new Map(ids.map(id => [id, element()]));
const calls = [];
const dialog = element();
let fullscreen = true;
const service = ArchiveLifecycleService.create({
  getElement: id => elements.get(id),
  documentRef: {
    querySelector: selector => {
      assert.equal(selector, '.archive-modal-dialog');
      return dialog;
    }
  },
  getViewMode: () => 'table',
  render: () => calls.push('render'),
  renderArtists: () => calls.push('artists'),
  initArtistSection: () => calls.push('artist-init'),
  applyFilters: () => calls.push('filters'),
  handleListClick: () => calls.push('list-click'),
  handleListKeydown: () => calls.push('list-keydown'),
  stopAutoScroll: () => calls.push('stop-scroll'),
  isFullscreen: () => fullscreen,
  setFullscreen: value => {
    fullscreen = value;
    calls.push(['fullscreen', value]);
  }
});

service.open();
service.open();
assert.equal(elements.get('archiveList').classList.contains('table-view'), true);
assert.deepEqual(calls.slice(0, 6), [
  'render',
  'artists',
  'artist-init',
  'render',
  'artists',
  'artist-init'
]);
assert.equal(elements.get('archiveSearch').listeners.size, 1);
assert.equal(elements.get('archiveModal').listeners.size, 2);
assert.equal(elements.get('archiveList').listeners.size, 2);
assert.equal(elements.get('filterSig').listeners.size, 1);

elements.get('archiveModal').listeners.get('keydown')({ key: 'Escape' });
assert.equal(elements.get('archiveModal').classList.contains('show'), false);
assert.equal(fullscreen, false);
assert.equal(dialog.style.width, '');
assert.equal(dialog.style.borderRadius, '');
assert.ok(calls.includes('stop-scroll'));

console.log('ArchiveLifecycleService tests passed');
