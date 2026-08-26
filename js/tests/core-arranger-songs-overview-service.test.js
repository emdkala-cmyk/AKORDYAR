const assert = require('node:assert/strict');
const CoreArrangerSongsOverviewService = require(
  '../app/CoreArrangerSongsOverviewService.js'
);

const box = { innerHTML: '' };
const songs = [
  {
    id: 'song-1',
    title: 'Song One',
    artist: 'Artist',
    key: 'C',
    rhythm: '4/4'
  },
  { id: 'song-2', title: 'Song Two' }
];
const editingArr = {
  items: ['song-1', 'missing', 'song-2']
};
const runtime = CoreArrangerSongsOverviewService.create({
  getElement: id => (id === 'arrSongsList' ? box : null),
  getEditingArr: () => editingArr,
  getAllSongs: () => songs,
  getItemSetting: (_arr, songId) =>
    songId === 'song-1'
      ? { transpose: 2, notes: 'note' }
      : { transpose: 0, notes: '' }
});

runtime.render();
assert.match(box.innerHTML, /Song One/);
assert.match(box.innerHTML, /Artist/);
assert.match(box.innerHTML, /گام: C/);
assert.match(box.innerHTML, /تغییر گام: \+2/);
assert.match(box.innerHTML, /📝 note/);
assert.match(box.innerHTML, /Song Two/);
assert.doesNotMatch(box.innerHTML, /missing/);

const emptyRuntime = CoreArrangerSongsOverviewService.create({
  getElement: () => box,
  getEditingArr: () => ({ items: [] })
});
emptyRuntime.render();
assert.match(box.innerHTML, /ترانه‌ای در این ارنجر وجود ندارد/);

console.log('CoreArrangerSongsOverviewService tests passed');
