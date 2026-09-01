const assert = require('node:assert/strict');
const ArchiveSongLoadService = require('../archive/ArchiveSongLoadService.js');
const ArchiveReadOnlyService = require('../archive/ArchiveReadOnlyService.js');
const ArchiveTransferService = require('../archive/ArchiveTransferService.js');
const ArchiveBatchImportService = require('../archive/ArchiveBatchImportService.js');

(async () => {
  const toasts = [];
  let loading = false;
  const songLoad = ArchiveSongLoadService.create({
    getLoading: () => loading,
    setLoading: value => {
      loading = value;
    },
    getAllSongs: () => [],
    toast: message => toasts.push(message)
  });
  await songLoad.load('missing');
  assert.equal(loading, false);
  assert.ok(toasts.at(-1) === 'ترانه یافت نشد' || toasts.at(-1) === 'songNotFoundSingle', `Expected Persian or i18n key, got '${toasts.at(-1)}'`);

  const loadFailure = ArchiveSongLoadService.create({
    getLoading: () => false,
    setLoading: value => {
      loading = value;
    },
    getAllSongs: () => [{ id: 'song-1' }],
    getCurrentSong: () => null,
    closeArchive: () => {},
    loadProject: async () => {
      throw new Error('load failed');
    },
    toast: message => toasts.push(message),
    logError: () => {}
  });
  await loadFailure.load('song-1');
  assert.equal(loading, false);
  assert.ok(toasts.at(-1).includes('load failed') || toasts.at(-1).match(/خطا در لود ترانه: load failed/), `Expected error toast, got '${toasts.at(-1)}'`);

  const readOnlyFailure = ArchiveReadOnlyService.create({
    getLoading: () => false,
    setLoading: value => {
      loading = value;
    },
    getAllSongs: () => [{ id: 'song-2' }],
    closeArchive: () => {},
    loadProject: async () => {
      throw new Error('read-only failed');
    },
    toast: message => toasts.push(message),
    logError: () => {}
  });
  await readOnlyFailure.loadReadOnly('song-2');
  assert.equal(loading, false);
  assert.ok(toasts.at(-1).includes('read-only failed') || toasts.at(-1).match(/خطا در لود ترانه: read-only failed/), `Expected error toast, got '${toasts.at(-1)}'`);

  const transfer = ArchiveTransferService.create({
    getAllSongs: () => [],
    toast: message => toasts.push(message)
  });
  const transferResult = await transfer.processFullArchive({
    text: async () => '{broken'
  });
  assert.equal(transferResult.added, 0);
  assert.ok(toasts.at(-1) === 'فرمت JSON نامعتبر' || toasts.at(-1) === 'invalidPlaylistFormat', 'Expected Persian or i18n key');

  const batch = ArchiveBatchImportService.create({
    getAllSongs: () => [],
    setAllSongs: () => {},
    resetSearchCache: () => {},
    renderArchive: () => {},
    renderArtists: () => {},
    toast: message => toasts.push(message)
  });
  const batchResult = await batch.processFiles([{
    name: 'broken.json',
    text: async () => '{broken'
  }]);
  assert.deepEqual(batchResult, { added: 0, updated: 0, errors: 1 });
  assert.match(toasts.at(-1), /۱|1/);
  assert.match(toasts.at(-1), /خطا/);

  console.log('Archive error-path tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
