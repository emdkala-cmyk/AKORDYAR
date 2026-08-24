const assert = require('node:assert/strict');
const ArchiveTransferService = require('../archive/ArchiveTransferService.js');

class FakeBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options.type;
  }
}

function createDocument(clicks) {
  return {
    createElement: tagName => {
      assert.equal(tagName, 'a');
      return {
        click: () => clicks.push(true)
      };
    }
  };
}

function jsonFile(value) {
  return {
    text: async () => JSON.stringify(value)
  };
}

(async () => {
  const songs = [
    {
      id: 'existing',
      title: 'قدیمی',
      artist: 'الف',
      _audioPaths: ['remove-me']
    },
    {
      id: 'deleted',
      title: 'حذف‌شده',
      deletedAt: '2026-08-01T00:00:00.000Z'
    }
  ];
  const toasts = [];
  const calls = [];
  const writes = [];
  const clicks = [];
  let lastBlob = null;
  const service = ArchiveTransferService.create({
    documentRef: createDocument(clicks),
    BlobCtor: class extends FakeBlob {
      constructor(parts, options) {
        super(parts, options);
        lastBlob = this;
      }
    },
    URLRef: {
      createObjectURL: blob => {
        assert.equal(blob, lastBlob);
        return 'blob:test';
      },
      revokeObjectURL: url => assert.equal(url, 'blob:test')
    },
    getAllSongs: () => songs,
    getSelectedIds: () => new Set(['existing']),
    setAllSongs: value => {
      calls.push(['save', value]);
    },
    prepareSong: song => {
      song.prepared = true;
    },
    normalizeSong: song => ({ ...song, id: String(song.id) }),
    confirmImport: async count => {
      assert.equal(count, 2);
      return true;
    },
    resetSearchCache: () => calls.push('reset'),
    renderArchive: () => calls.push('render'),
    renderArtists: () => calls.push('artists'),
    toast: message => toasts.push(message),
    now: () => new Date('2026-08-24T12:00:00.000Z')
  });

  const importResult = await service.processFullArchive(
    jsonFile([
      { id: 'existing', title: 'به‌روز', artist: 'الف' },
      { id: 'new', title: 'جدید', artist: 'ب' }
    ])
  );
  assert.deepEqual(importResult, { added: 1, updated: 1 });
  assert.equal(songs.find(song => song.id === 'existing').title, 'به‌روز');
  assert.equal(songs.find(song => song.id === 'new').prepared, true);
  assert.equal(toasts.at(-1), '1 اضافه شد، 1 به‌روزرسانی');

  const exportedSong = service.exportSong('existing');
  assert.equal(exportedSong.filename, 'به‌روز.json');
  const exportedSongData = JSON.parse(lastBlob.parts[0]);
  assert.equal(exportedSongData._audioPaths, undefined);
  assert.equal(clicks.length, 1);

  const exportAllResult = service.exportAll();
  assert.equal(exportAllResult.filename, 'archive_all_2026-08-24.json');
  const exportedAll = JSON.parse(lastBlob.parts[0]);
  assert.equal(exportedAll.length, 2);
  assert.equal(toasts.at(-1), '2 ترانه دانلود شد');

  const directoryService = ArchiveTransferService.create({
    getAllSongs: () => songs,
    getSelectedIds: () => new Set(['existing']),
    showDirectoryPicker: async () => ({
      getFileHandle: async name => ({
        createWritable: async () => ({
          write: async value => writes.push([name, value]),
          close: async () => {}
        })
      })
    }),
    toast: message => toasts.push(message),
    now: () => new Date('2026-08-24T12:00:00.000Z')
  });
  assert.deepEqual(
    await directoryService.bulkExport(),
    { saved: 1, selected: 1 }
  );
  assert.equal(writes[0][0], 'به‌روز.json');
  assert.equal(toasts.at(-1), '1 فایل ذخیره شد');

  const cancelled = ArchiveTransferService.create({
    getAllSongs: () => songs,
    confirmImport: async () => false,
    toast: message => toasts.push(message)
  });
  assert.deepEqual(
    await cancelled.processFullArchive(jsonFile([{ id: 'cancelled' }])),
    { added: 0, updated: 0, cancelled: true }
  );

  console.log('ArchiveTransferService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
