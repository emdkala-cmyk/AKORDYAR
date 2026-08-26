const assert = require('node:assert/strict');
const CoreArrangerSongTransferService = require(
  '../app/CoreArrangerSongTransferService.js'
);

const calls = [];
let editingArr = null;
const arrangers = [];
const currentSong = { id: 'song-1', title: 'Song One' };
const runtime = CoreArrangerSongTransferService.create({
  getCurrentSong: () => currentSong,
  saveCurrentSong: async () => calls.push('archive-save'),
  getArrangers: () => arrangers,
  setEditingArr: value => {
    editingArr = value;
  },
  saveArrangers: () => calls.push('arrangers-save'),
  openArrangerModal: () => calls.push('open-modal'),
  toast: message => calls.push(['toast', message]),
  logger: { error: (...args) => calls.push(['error', ...args]) },
  now: () => 123
});

(async () => {
  await runtime.send();

  assert.equal(arrangers.length, 1);
  assert.equal(arrangers[0].id, 123);
  assert.equal(editingArr, arrangers[0]);
  assert.deepEqual(arrangers[0].items, ['song-1']);
  assert.deepEqual(calls.slice(0, 3), [
    'archive-save',
    'arrangers-save',
    'open-modal'
  ]);
  assert.equal(calls[3][1], 'ترانه به پلی‌لیست اضافه شد');

  await runtime.send();
  assert.deepEqual(arrangers[0].items, ['song-1']);

  const emptyRuntime = CoreArrangerSongTransferService.create({
    getCurrentSong: () => null,
    toast: message => calls.push(['empty-toast', message])
  });
  await emptyRuntime.send();
  assert.equal(calls.at(-1)[1], 'ترانه‌ای باز نیست');

  const failingRuntime = CoreArrangerSongTransferService.create({
    getCurrentSong: () => currentSong,
    saveCurrentSong: async () => {
      throw new Error('archive failed');
    },
    toast: message => calls.push(['failure-toast', message]),
    logger: { error: (...args) => calls.push(['error', ...args]) }
  });
  await failingRuntime.send();
  assert.equal(calls.at(-1)[1], 'خطا در ارسال ترانه به ارنجر');
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'error'));

  console.log('CoreArrangerSongTransferService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
