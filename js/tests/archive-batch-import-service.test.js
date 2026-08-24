const assert = require('node:assert/strict');
const ArchiveBatchImportService = require(
  '../archive/ArchiveBatchImportService.js'
);

function file(name, value) {
  return {
    name,
    text: async () => typeof value === 'string' ? value : JSON.stringify(value)
  };
}

function directory(entries) {
  return {
    kind: 'directory',
    async *entries() {
      for (const entry of entries) yield entry;
    }
  };
}

function fileHandle(name, value) {
  return {
    kind: 'file',
    getFile: async () => file(name, value)
  };
}

(async () => {
  const songs = [{ id: 'existing', artist: 'الف', title: 'قدیمی' }];
  const toasts = [];
  const calls = [];
  const modal = {
    classList: {
      contains: value => value === 'show'
    }
  };
  const service = ArchiveBatchImportService.create({
    getElement: () => modal,
    getAllSongs: () => songs,
    setAllSongs: value => {
      calls.push(['save', value]);
    },
    prepareSong: song => {
      song.prepared = true;
    },
    normalizeSong: (song, sourceName) => ({
      ...song,
      id: String(song.id || ''),
      sourceFileName: sourceName
    }),
    generateId: () => 'generated-id',
    resetSearchCache: () => calls.push('reset-cache'),
    renderArchive: () => calls.push('render'),
    renderArtists: () => calls.push('artists'),
    openArchive: () => calls.push('open'),
    toast: message => toasts.push(message),
    now: () => '2026-08-24T00:00:00.000Z'
  });

  const fileResult = await service.importFiles([
    file('new.json', { id: 'new', artist: 'ب', title: 'جدید' }),
    file('duplicate.json', { id: 'existing', artist: 'الف', title: 'به‌روز' }),
    file('bad.json', '{bad json')
  ]);
  assert.deepEqual(fileResult, { added: 1, updated: 1, errors: 1 });
  assert.equal(songs.find(song => song.id === 'existing').title, 'به‌روز');
  assert.equal(songs.find(song => song.id === 'new').sourceFileName, 'new.json');
  assert.equal(songs.find(song => song.id === 'existing').prepared, true);
  assert.equal(toasts.at(-1), '1 وارد شد، 1 به‌روزرسانی، 1 خطا');
  assert.deepEqual(calls.slice(-3), ['reset-cache', 'render', 'artists']);

  const folder = directory([
    ['root.json', fileHandle('root.json', { id: 'root', artist: 'ج', title: 'ریشه' })],
    ['nested', directory([
      ['nested.json', fileHandle('nested.json', { id: 'nested', artist: 'د', title: 'تودرتو' })],
      ['ignored.txt', fileHandle('ignored.txt', { id: 'ignored' })]
    ])]
  ]);
  const folderResult = await service.importFolder(folder);
  assert.deepEqual(folderResult, { added: 2, updated: 0, errors: 0, files: 2 });
  assert.equal(songs.some(song => song.id === 'root'), true);
  assert.equal(songs.some(song => song.id === 'nested'), true);
  assert.match(toasts.at(-1), /۲ فایل|2 فایل/);

  const unsupported = ArchiveBatchImportService.create({
    showDirectoryPicker: null,
    toast: message => toasts.push(message),
    getAllSongs: () => [],
    setAllSongs: () => {}
  });
  assert.deepEqual(
    await unsupported.importFolder(),
    { added: 0, updated: 0, errors: 0, files: 0 }
  );

  console.log('ArchiveBatchImportService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
