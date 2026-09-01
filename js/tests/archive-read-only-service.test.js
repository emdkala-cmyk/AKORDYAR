const assert = require('node:assert/strict');
const ArchiveReadOnlyService = require('../archive/ArchiveReadOnlyService.js');

async function run() {
  const songs = [
    { id: 'source', title: 'منبع', notes: 'یادداشت' },
    { id: 'trash', title: 'حذف‌شده', deletedAt: '2026-08-20' }
  ];
  let currentSong = null;
  let loading = false;
  let readOnly = false;
  let parsed = 0;
  let closed = 0;
  const toasts = [];
  const elements = new Map();
  const banner = {
    id: '',
    style: {},
    styleCssText: '',
    innerHTML: '',
    _actionListenerAttached: false,
    addEventListener(type, listener) {
      this.listener = listener;
    },
    remove() {
      elements.delete('readOnlyBanner');
    }
  };
  const documentRef = {
    body: { appendChild: value => elements.set('readOnlyBanner', value) },
    createElement: () => banner
  };
  const service = ArchiveReadOnlyService.create({
    documentRef,
    getElement: id => elements.get(id),
    getAllSongs: () => songs,
    getCurrentSong: () => currentSong,
    setAllSongs: value => {
      songs.splice(0, songs.length, ...value);
    },
    setSong: song => { currentSong = song; },
    generateId: () => 'copy-id',
    ensureSongParsed: () => { parsed++; },
    closeArchive: () => { closed++; },
    loadProject: async song => { currentSong = song; },
    getLoading: () => loading,
    setLoading: value => { loading = value; },
    setReadOnly: value => { readOnly = value; },
    now: () => '2026-08-25T13:00:00.000Z',
    toast: message => toasts.push(message),
    logError: () => {}
  });

  await service.loadReadOnly('source');
  assert.equal(parsed, 1);
  assert.equal(closed, 1);
  assert.equal(readOnly, true);
  assert.equal(songs[0].lastOpenedAt, '2026-08-25T13:00:00.000Z');
  assert.equal(loading, false);
  assert.ok(elements.has('readOnlyBanner'));
  assert.match(banner.innerHTML, /archExitReadOnly/);
  assert.match(banner.innerHTML, /archCreateEditableCopy/);

  service.exitReadOnly();
  assert.equal(readOnly, false);
  assert.equal(elements.has('readOnlyBanner'), false);

  currentSong = songs[0];
  await service.createEditableCopy();
  assert.equal(songs[0].id, 'copy-id');
  assert.match(songs[0].title, /نسخه قابل ویرایش/);
  assert.equal(songs[0].createdAt, '2026-08-25T13:00:00.000Z');
  assert.equal(currentSong.id, 'copy-id');
  assert.equal(readOnly, false);

  await service.loadReadOnly('trash');
  assert.equal(closed, 1);

  const errorService = ArchiveReadOnlyService.create({
    documentRef,
    getElement: id => elements.get(id),
    getAllSongs: () => [{ id: 'error' }],
    closeArchive: () => {},
    loadProject: async () => { throw new Error('read-only failure'); },
    toast: message => toasts.push(message),
    logError: () => {}
  });
  await errorService.loadReadOnly('error');
  assert.ok(toasts.some(message => message.includes('خطا در لود ترانه')));

  console.log('ArchiveReadOnlyService tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
