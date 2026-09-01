const assert = require('node:assert/strict');
const ArchiveMutationService = require('../archive/ArchiveMutationService.js');

(async () => {
  const songs = [
    { id: 'a', title: 'اول', favorite: false },
    { id: 'b', title: 'دوم', favorite: false },
    { id: 'c', title: 'سوم', favorite: false, deletedAt: 'old' }
  ];
  const selectedIds = new Set(['a', 'b']);
  const confirms = [];
  const undos = [];
  const calls = [];
  const deletedAudio = [];
  let selectMode = true;
  const service = ArchiveMutationService.create({
    getAllSongs: () => songs,
    setAllSongs: value => calls.push(['save', value.length]),
    selectedIds,
    setSelectMode: value => {
      selectMode = value;
    },
    updateSelectionUi: () => calls.push('selection-ui'),
    confirm: async (...args) => {
      confirms.push(args);
      return true;
    },
    pushUndo: description => undos.push(description),
    deleteAudioBlobsForProject: async id => deletedAudio.push(id),
    generateId: () => 'copy-id',
    render: () => calls.push('render'),
    renderArtists: () => calls.push('artists'),
    updateActiveFilters: () => calls.push('filters'),
    resetSearchCache: () => calls.push('reset'),
    escapeHtml: value => `[${value}]`,
    toast: message => calls.push(['toast', message]),
    now: () => '2026-08-24T00:00:00.000Z'
  });

  await service.bulkTrash();
  assert.equal(songs[0].deletedAt, '2026-08-24T00:00:00.000Z');
  assert.equal(songs[1].deletedAt, '2026-08-24T00:00:00.000Z');
  assert.equal(selectedIds.size, 0);
  assert.equal(selectMode, false);
  assert.ok(confirms[0][0] === 'انتقال به سطل زباله' || confirms[0][0] === 'moveToTrash', 'Expected Persian or i18n key');
  assert.ok(undos[0] === 'انتقال گروهی' || undos[0] === 'moveToTrash', 'Expected Persian or i18n key');

  selectedIds.add('a');
  await service.bulkFavorite(true);
  assert.equal(songs[0].favorite, true);
  assert.ok(undos[1] === 'افزودن گروهی' || undos[1] === 'addToFavorites', 'Expected Persian or i18n key');

  await service.trash('c');
  assert.equal(songs[2].deletedAt, '2026-08-24T00:00:00.000Z');
  await service.restore('c');
  assert.equal(songs[2].deletedAt, null);
  assert.equal(songs[2].updatedAt, '2026-08-24T00:00:00.000Z');

  await service.permanentDelete('c');
  assert.equal(songs.some(song => song.id === 'c'), false);
  assert.deepEqual(deletedAudio, ['c']);

  service.toggleFavorite('a');
  assert.equal(songs.find(song => song.id === 'a').favorite, false);

  service.duplicate('a');
  const copy = songs.find(song => song.id === 'copy-id');
  assert.equal(copy.title, 'اول (کپی)');
  assert.equal(copy.lastOpenedAt, null);
  assert.ok(calls.includes('reset'));

  console.log('ArchiveMutationService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
