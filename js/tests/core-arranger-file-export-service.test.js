const assert = require('node:assert/strict');
const CoreArrangerFileExportService = require(
  '../app/CoreArrangerFileExportService.js'
);

const arranger = {
  name: 'Live / Setlist',
  items: ['song-1', 'song-2'],
  crossfade: 3,
  pauseBetween: true,
  _itemSettings: { 'song-2': { transpose: 2 } }
};
const songs = [
  { id: 'song-1', title: 'Song One' },
  { id: 'song-2', title: 'Song Two' }
];
const writes = [];
const pickerCalls = [];
const toasts = [];
const runtime = CoreArrangerFileExportService.create({
  windowRef: {
    async showSaveFilePicker(options) {
      pickerCalls.push(options);
      return {
        async createWritable() {
          return {
            async write(value) {
              writes.push(value);
            },
            async close() {}
          };
        }
      };
    }
  },
  getAllSongs: () => songs,
  toast: message => toasts.push(message)
});

(async () => {
  await runtime.exportArranger(arranger);

  assert.equal(pickerCalls.length, 1);
  assert.equal(pickerCalls[0].suggestedName, 'Live _ Setlist.json');
  assert.deepEqual(JSON.parse(writes[0]), {
    type: 'akordyar-playlist',
    version: '1.0',
    name: arranger.name,
    items: arranger.items,
    crossfade: 3,
    pauseBetween: true,
    _itemSettings: arranger._itemSettings,
    songs: {
      'song-1': songs[0],
      'song-2': songs[1]
    },
    exportDate: JSON.parse(writes[0]).exportDate
  });
  assert.match(toasts[0], /^✅ اکسپورت شد: Live _ Setlist\.json$/);

  await runtime.exportArranger(null);
  assert.equal(toasts[1], '⚠ پلی‌لیست نامعتبر');
  console.log('CoreArrangerFileExportService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
