const assert = require('node:assert/strict');
const ArchiveSongLoadService = require('../archive/ArchiveSongLoadService.js');

async function run() {
  const songs = [
    { id: 'old', title: 'قدیمی' },
    { id: 'target', title: 'هدف' },
    { id: 'trash', title: 'حذف‌شده', deletedAt: '2026-08-20' }
  ];
  let currentSong = songs[0];
  let loading = false;
  let parsed = 0;
  let saved = 0;
  let closed = 0;
  let loaded = 0;
  let confirmCalls = 0;
  const toasts = [];

  const service = ArchiveSongLoadService.create({
    getAllSongs: () => songs,
    getCurrentSong: () => currentSong,
    getLoading: () => loading,
    setLoading: value => { loading = value; },
    ensureSongParsed: () => { parsed++; },
    hasUnsavedChanges: () => true,
    confirmUnsaved: async () => {
      confirmCalls++;
      return false;
    },
    saveCurrent: async () => { saved++; },
    closeArchive: () => { closed++; },
    loadProject: async song => {
      loaded++;
      currentSong = song;
    },
    setAllSongs: value => {
      songs.splice(0, songs.length, ...value);
    },
    now: () => '2026-08-25T12:00:00.000Z',
    toast: message => toasts.push(message),
    logError: () => {}
  });

  await service.load('target');
  assert.equal(parsed, 1);
  assert.equal(confirmCalls, 1);
  assert.equal(saved, 0);
  assert.equal(closed, 1);
  assert.equal(loaded, 1);
  assert.equal(songs[1].lastOpenedAt, '2026-08-25T12:00:00.000Z');
  assert.equal(loading, false);
  assert.ok(toasts.some(message => message.includes('پروژه لود شد')));

  await service.load('missing');
  assert.equal(closed, 1);
  await service.load('trash');
  assert.equal(closed, 1);

  currentSong = songs[0];
  const saveService = ArchiveSongLoadService.create({
    getAllSongs: () => songs,
    getCurrentSong: () => currentSong,
    hasUnsavedChanges: () => true,
    confirmUnsaved: async () => true,
    saveCurrent: async () => { saved++; },
    closeArchive: () => { closed++; },
    loadProject: async song => { currentSong = song; },
    setAllSongs: () => {},
    toast: () => {},
    logError: () => {}
  });
  await saveService.load('target');
  assert.equal(saved, 1);
  assert.equal(closed, 2);

  const errorService = ArchiveSongLoadService.create({
    getAllSongs: () => [{ id: 'error' }],
    getCurrentSong: () => null,
    closeArchive: () => { throw new Error('close should not run'); },
    loadProject: async () => { throw new Error('load failed'); },
    toast: message => toasts.push(message),
    logError: () => {}
  });
  await errorService.load('error');
  assert.ok(toasts.some(message => message.includes('خطا در لود ترانه')));

  console.log('ArchiveSongLoadService tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
