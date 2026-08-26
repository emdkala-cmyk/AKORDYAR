const assert = require('node:assert/strict');
const SongNoteService = require('../app/CoreArrangerSongNoteService.js');

function createClassList() {
  const values = new Set();
  return {
    values,
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    }
  };
}

const elements = {
  arrSongNoteTitle: { textContent: '' },
  arrSongNoteText: { value: '' },
  arrSongNoteOverlay: { classList: createClassList() }
};
const editingArr = {
  items: ['song-1'],
  settings: { notes: 'یادداشت قبلی' }
};
const songs = [{ id: 'song-1', title: 'Song One' }];
const calls = [];
const runtime = SongNoteService.create({
  getEditingArr: () => editingArr,
  getAllSongs: () => songs,
  getElement: id => elements[id],
  ensureArrItem: () => editingArr.settings,
  saveArrangers: () => calls.push('save'),
  renderArrSetlist: () => calls.push('render')
});

runtime.openArrSongNote(0);
assert.equal(
  elements.arrSongNoteTitle.textContent,
  'Song One — یادداشت اجرا'
);
assert.equal(elements.arrSongNoteText.value, 'یادداشت قبلی');
assert.equal(elements.arrSongNoteOverlay.classList.contains('show'), true);

elements.arrSongNoteText.value = 'یادداشت جدید';
runtime.saveArrSongNote();
assert.equal(editingArr.settings.notes, 'یادداشت جدید');
assert.equal(elements.arrSongNoteOverlay.classList.contains('show'), false);
assert.deepEqual(calls, ['save', 'render']);

runtime.closeArrSongNote();
assert.equal(elements.arrSongNoteOverlay.classList.contains('show'), false);

const unavailable = SongNoteService.create({
  getEditingArr: () => null,
  getElement: id => elements[id]
});
assert.equal(unavailable.openArrSongNote(0), undefined);
assert.equal(unavailable.saveArrSongNote(), undefined);

console.log('CoreArrangerSongNoteService tests passed');
