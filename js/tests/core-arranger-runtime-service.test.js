const assert = require('node:assert/strict');
const CoreArrangerRuntimeService = require(
  '../app/CoreArrangerRuntimeService.js'
);

const created = [];
const invoked = [];
const arranger = {
  id: 'arr-1',
  name: 'تمرین',
  items: ['song-1'],
  _itemSettings: {}
};
const storage = {
  values: new Map([['arrangers_v1', JSON.stringify([arranger])]]),
  getItem(key) {
    return this.values.get(key) || null;
  },
  setItem(key, value) {
    this.values.set(key, value);
  }
};
const elements = new Map();
const documentRef = {
  createElement: () => ({
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}
  }),
  getElementById: id => elements.get(id)
};

function child(name, methods) {
  return {
    create(config) {
      created.push({ name, config });
      return Object.freeze(methods);
    }
  };
}

const services = {
  fileExportService: child('file-export', {
    exportArranger: value => invoked.push(['export', value])
  }),
  managerRendererService: child('manager', {
    render: () => invoked.push('manager-render')
  }),
  songsOverviewService: child('songs-overview', {
    render: () => invoked.push('songs-render')
  }),
  fileImportService: child('file-import', {
    importFromFile: () => invoked.push('import')
  }),
  songTransferService: child('song-transfer', {
    send: () => invoked.push('transfer')
  }),
  editorActionsService: child('editor-actions', {
    switchArrTab: tab => invoked.push(['tab', tab]),
    closeArrEditor: () => invoked.push('close-editor'),
    exportCurrentArranger: () => invoked.push('export-current')
  }),
  controlsService: child('controls', {
    arrSetCrossfade: value => invoked.push(['crossfade', value]),
    arrTogglePauseBetween: () => invoked.push('pause'),
    arrAutoTranspose: () => invoked.push('transpose'),
    arrClearNotes: () => invoked.push('clear-notes'),
    arrFilterSongs: () => invoked.push('filter')
  }),
  songNoteService: child('song-note', {
    openArrSongNote: index => invoked.push(['open-note', index]),
    closeArrSongNote: () => invoked.push('close-note'),
    saveArrSongNote: () => invoked.push('save-note')
  }),
  setlistRendererService: child('setlist', {
    render: () => invoked.push('setlist-render')
  }),
  poolRendererService: child('pool', {
    render: () => invoked.push('pool-render')
  }),
  editorService: child('editor', {
    open: () => invoked.push('open-editor')
  }),
  modalService: child('modal', {
    open: value => invoked.push(['modal-open', value]),
    close: () => invoked.push('modal-close')
  }),
  creationService: child('creation', {
    createNewArranger: () => invoked.push('create-arranger')
  }),
  saveService: child('save', {
    saveCurrentArranger: () => invoked.push('save-current'),
    saveCurrentArrangerDebounced: () => invoked.push('save-debounced')
  })
};

const runtime = CoreArrangerRuntimeService.create({
  state: { storage },
  actions: {
    getAllSongs: () => [{ id: 'song-1' }],
    getCurrentSong: () => ({ id: 'song-1' }),
    saveCurrentSong: async () => invoked.push('save-song'),
    customPrompt: async () => 'new',
    confirm: () => true,
    translate: key => key,
    toast: message => invoked.push(['toast', message]),
    startPointerDrag: () => invoked.push('drag')
  },
  ui: {
    documentRef,
    getElement: id => elements.get(id)
  },
  timing: {
    now: () => 1,
    isoNow: () => '2026-08-27T00:00:00.000Z',
    schedule: callback => callback(),
    cancel: () => {}
  },
  services
});

assert.deepEqual(runtime.getArrangers()[0], arranger);
assert.equal(runtime.getEditingArr(), null);
assert.equal(runtime.normalizePlaylistName('  تمرین   '), 'تمرین');
assert.equal(runtime.playlistNameExists('تمرین'), true);
const storedArranger = runtime.getArrangers()[0];
assert.deepEqual(runtime.ensureArrItem(storedArranger, 0), {
  transpose: 0,
  notes: ''
});
assert.deepEqual(runtime.getArrItemSetting(storedArranger, 'missing'), {
  transpose: 0,
  notes: ''
});

runtime.setEditingArr(storedArranger);
assert.equal(runtime.getEditingArr(), storedArranger);
runtime.saveArrangers();
assert.deepEqual(JSON.parse(storage.getItem('arrangers_v1')), [storedArranger]);

runtime.renderArrangerManager();
runtime.sendCurrentSongToArranger();
runtime.openArrEditor('arr-1');
runtime.exportArranger(arranger);
runtime.importArrangerFromFile();
runtime.renderArrSongsList();
runtime.switchArrTab('songs');
runtime.closeArrEditor();
runtime.exportCurrentArranger();
runtime.arrSetCrossfade(3);
runtime.arrTogglePauseBetween();
runtime.arrAutoTranspose();
runtime.arrClearNotes();
runtime.arrFilterSongs();
runtime.openArrSongNote(0);
runtime.closeArrSongNote();
runtime.saveArrSongNote();
runtime.renderArrSetlist();
runtime.renderArrPool();
runtime.openArrangerModal(arranger);
runtime.closeArrangerModal();
runtime.createNewArranger();
runtime.saveCurrentArranger();
runtime.saveCurrentArrangerDebounced();

assert.ok(invoked.some(value => value === 'manager-render'));
assert.ok(invoked.some(value => value === 'transfer'));
assert.ok(invoked.some(value => value === 'open-editor'));
assert.ok(invoked.some(value => Array.isArray(value) && value[0] === 'crossfade'));
assert.ok(invoked.some(value => Array.isArray(value) && value[0] === 'open-note'));
assert.ok(invoked.some(value => Array.isArray(value) && value[0] === 'modal-open'));
assert.ok(invoked.some(value => value === 'save-debounced'));
assert.deepEqual(
  created.map(entry => entry.name),
  [
    'file-export',
    'manager',
    'songs-overview',
    'file-import',
    'song-transfer',
    'editor-actions',
    'controls',
    'song-note',
    'setlist',
    'pool',
    'editor',
    'modal',
    'creation',
    'save'
  ]
);

console.log('CoreArrangerRuntimeService tests passed');
