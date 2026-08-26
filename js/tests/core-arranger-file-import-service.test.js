const assert = require('node:assert/strict');
const CoreArrangerFileImportService = require(
  '../app/CoreArrangerFileImportService.js'
);

let inputRef = null;
let changePromise = null;
const documentRef = {
  createElement: tagName => {
    assert.equal(tagName, 'input');
    inputRef = {
      type: '',
      accept: '',
      onchange: null,
      click() {
        changePromise = this.onchange({
          target: {
            files: [
              {
                name: 'setlist.json',
                async text() {
                  return JSON.stringify({
                    version: '1.0',
                    name: 'اجرای تست',
                    items: ['song-1', { songId: 'song-2' }],
                    crossfade: 3,
                    pauseBetween: true,
                    _itemSettings: { 'song-2': { transpose: 2 } },
                    songs: {
                      'song-2': { id: 'song-2', title: 'Song Two' }
                    }
                  });
                }
              }
            ]
          }
        });
      }
    };
    return inputRef;
  }
};

const arrangers = [];
const songs = [{ id: 'song-1', title: 'Song One' }];
let editingArr = null;
let savedSongs = null;
const calls = [];

const runtime = CoreArrangerFileImportService.create({
  documentRef,
  getArrangers: () => arrangers,
  setEditingArr: value => {
    editingArr = value;
  },
  getAllSongs: () => songs,
  setAllSongs: value => {
    savedSongs = value;
  },
  playlistNameExists: () => false,
  saveArrangers: () => calls.push('save'),
  renderArrangerManager: () => calls.push('render'),
  openArrEditor: () => calls.push('open-editor'),
  toast: message => calls.push(['toast', message]),
  logger: { log: (...args) => calls.push(['log', ...args]), error() {} },
  now: () => 123,
  isoNow: () => '2026-08-26T00:00:00.000Z'
});

(async () => {
  await runtime.importFromFile();
  await changePromise;

  assert.equal(inputRef.type, 'file');
  assert.equal(inputRef.accept, '.json,application/json');
  assert.equal(arrangers.length, 1);
  assert.equal(arrangers[0].id, 'playlist_123');
  assert.equal(arrangers[0].name, 'اجرای تست');
  assert.deepEqual(arrangers[0].items, ['song-1', 'song-2']);
  assert.equal(arrangers[0].crossfade, 3);
  assert.equal(arrangers[0].pauseBetween, true);
  assert.equal(savedSongs.length, 2);
  assert.equal(editingArr, arrangers[0]);
  assert.deepEqual(
    calls.filter(call => typeof call === 'string'),
    ['save', 'render', 'open-editor']
  );
  assert.match(
    calls.find(call => Array.isArray(call) && call[0] === 'toast')[1],
    /آهنگ جدید/
  );

  console.log('CoreArrangerFileImportService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
