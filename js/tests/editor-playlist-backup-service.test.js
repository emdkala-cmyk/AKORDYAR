const assert = require('node:assert/strict');
const BackupService = require(
  '../editor/EditorPlaylistBackupService.js'
);

const fixedIso = '2026-08-26T12:00:00.000Z';
const arrangers = [
  {
    id: 'playlist-1',
    name: 'Live',
    items: ['song-1', { songId: 'song-2' }],
    crossfade: 2,
    pauseBetween: true,
    _itemSettings: { 'song-2': { transpose: 1 } }
  }
];
const songs = [{ id: 'song-1', title: 'Existing song' }];
const toasts = [];
const pickerWrites = [];
const pickerCalls = [];

const pickerService = BackupService.create({
  windowRef: {
    async showSaveFilePicker(options) {
      pickerCalls.push(options);
      return {
        async createWritable() {
          return {
            async write(value) {
              pickerWrites.push(value);
            },
            async close() {}
          };
        }
      };
    }
  },
  getArrangers: () => arrangers,
  getEditingArr: () => arrangers[0],
  toast: message => toasts.push(message),
  isoNow: () => fixedIso
});

(async () => {
  const exportResult = await pickerService.exportAllPlaylistsToFile();
  assert.equal(exportResult.success, true);
  assert.equal(exportResult.method, 'picker');
  assert.equal(
    pickerCalls[0].suggestedName,
    'achord-playlists-backup-2026-08-26.json'
  );
  const exported = JSON.parse(pickerWrites[0]);
  assert.equal(exported.format, 'achord-playlists-backup');
  assert.equal(exported.version, 1);
  assert.equal(exported.activePlaylistId, 'playlist-1');
  assert.deepEqual(exported.playlists[0].items, ['song-1', 'song-2']);
  assert.equal(exported.playlists[0].createdAt, fixedIso);
  assert.equal(toasts[0], '✅ خروجی کامل گرفته شد: achord-playlists-backup-2026-08-26.json');

  const emptyToasts = [];
  const emptyService = BackupService.create({
    getArrangers: () => [],
    toast: message => emptyToasts.push(message)
  });
  const emptyResult = await emptyService.exportAllPlaylistsToFile();
  assert.equal(emptyResult.reason, 'empty');
  assert.deepEqual(emptyToasts, ['⚠ هیچ پلی‌لیستی برای خروجی وجود ندارد']);

  const importedArrangers = [
    { id: 'existing', name: 'Existing', items: [] }
  ];
  let importedSongs = [{ id: 'old', title: 'Old song' }];
  let saved = 0;
  let rendered = 0;
  const importToasts = [];
  const importService = BackupService.create({
    documentRef: {
      createElement() {
        return {
          click() {},
          type: '',
          accept: '',
          onchange: null
        };
      }
    },
    getArrangers: () => importedArrangers,
    getAllSongs: () => importedSongs,
    setAllSongs: value => {
      importedSongs = value;
    },
    saveArrangers: () => {
      saved += 1;
    },
    renderArrangerManager: () => {
      rendered += 1;
    },
    toast: message => importToasts.push(message),
    isoNow: () => fixedIso,
    now: () => 123,
    random: () => 0.5,
    logger: { log() {}, error() {} }
  });
  const backupFile = {
    async text() {
      return JSON.stringify({
        format: 'achord-playlists-backup',
        version: 1,
        playlists: [
          {
            name: 'New A',
            items: ['new-song'],
            crossfade: 3
          },
          {
            name: 'New B',
            items: [{ songId: 'old' }],
            pauseBetween: true
          }
        ],
        songs: {
          'new-song': { id: 'new-song', title: 'New song' },
          old: { id: 'old', title: 'Duplicate song' }
        }
      });
    }
  };
  const importResult = await importService.importFile(backupFile);
  assert.equal(importResult.success, true);
  assert.equal(importResult.playlists.length, 2);
  assert.equal(importResult.importedSongsCount, 1);
  assert.equal(importedArrangers.length, 3);
  assert.equal(importedArrangers[0].name, 'New A');
  assert.deepEqual(importedArrangers[1].items, ['old']);
  assert.equal(importedArrangers[0].createdAt, fixedIso);
  assert.equal(importedSongs.length, 2);
  assert.equal(saved, 1);
  assert.equal(rendered, 1);
  assert.equal(importToasts[0], '✅ 2 پلی‌لیست وارد شد، 1 آهنگ جدید');

  const duplicateToasts = [];
  const duplicateService = BackupService.create({
    getArrangers: () => [{ name: 'Existing Name' }],
    toast: message => duplicateToasts.push(message)
  });
  const duplicateResult = await duplicateService.importFile({
    async text() {
      return JSON.stringify({
        format: 'achord-playlists-backup',
        playlists: [
          { name: 'Existing   Name', items: [] },
          { name: 'existing name', items: [] }
        ]
      });
    }
  });
  assert.equal(duplicateResult.reason, 'duplicate-names');
  assert.match(duplicateToasts[0], /نام تکراری/);

  const invalidToasts = [];
  const invalidService = BackupService.create({
    toast: message => invalidToasts.push(message)
  });
  const invalidResult = await invalidService.importFile({
    async text() {
      return JSON.stringify({ format: 'other', playlists: [] });
    }
  });
  assert.equal(invalidResult.reason, 'invalid-backup');
  assert.equal(
    invalidToasts[0],
    '❌ فایل معتبر نیست — فرمت پشتیبان پلی‌لیست نیست'
  );

  const input = importService.importAllPlaylistsFromFile();
  assert.equal(input.type, 'file');
  assert.equal(input.accept, '.json,application/json');
  assert.equal(typeof input.onchange, 'function');

  console.log('EditorPlaylistBackupService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
