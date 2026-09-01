const assert = require('node:assert/strict');
const ArchiveMetadataEditService = require(
  '../archive/ArchiveMetadataEditService.js'
);

function createElement(value = '') {
  return {
    value,
    options: [],
    classList: {
      values: new Set(),
      add(name) {
        this.values.add(name);
      },
      remove(name) {
        this.values.delete(name);
      }
    },
    add(option) {
      this.options.push(option);
    }
  };
}

const elements = new Map([
  ['aeTitle', createElement()],
  ['aeArtist', createElement()],
  ['aeAlbum', createElement()],
  ['aeKey', createElement()],
  ['aeKeyMode', createElement()],
  ['aeBpm', createElement()],
  ['aeTimeSig', createElement()],
  ['aeGenre', createElement()],
  ['aeCategory', createElement()],
  ['aeNotes', createElement()],
  ['archiveEditOverlay', createElement()]
]);
const songs = [{
  id: 'song-1',
  title: 'عنوان قبلی',
  artist: 'هنرمند قبلی',
  album: 'آلبوم قبلی',
  key: 'D',
  keyMode: 'min',
  tempo: 96,
  timeSignature: '3/4',
  genre: 'پاپ',
  categories: ['قدیمی'],
  notes: 'یادداشت قبلی'
}];

let editSongId = null;
let undoLabel = null;
let searchResetCount = 0;
let artistResetCount = 0;
let renderCount = 0;
let artistRenderCount = 0;
let filterUpdateCount = 0;
let savedSongs = null;
let toastMessage = null;

function FakeOption(text, value) {
  this.text = text;
  this.value = value;
}

const service = ArchiveMetadataEditService.create({
  getElement: id => elements.get(id),
  getAllSongs: () => songs,
  setAllSongs: value => {
    savedSongs = value;
  },
  getEditSongId: () => editSongId,
  setEditSongId: value => {
    editSongId = value;
  },
  artistKey: value => String(value).trim().toLowerCase().replace(/\s+/g, '-'),
  pushUndo: label => {
    undoLabel = label;
  },
  resetSearchCache: () => {
    searchResetCount++;
  },
  resetArtistCache: () => {
    artistResetCount++;
  },
  render: () => {
    renderCount++;
  },
  renderArtists: () => {
    artistRenderCount++;
  },
  updateActiveFilters: () => {
    filterUpdateCount++;
  },
  toast: message => {
    toastMessage = message;
  },
  now: () => '2026-08-25T13:00:00.000Z',
  OptionCtor: FakeOption
});

service.open('song-1');
assert.equal(editSongId, 'song-1');
assert.equal(elements.get('aeTitle').value, 'عنوان قبلی');
assert.equal(elements.get('aeArtist').value, 'هنرمند قبلی');
assert.equal(elements.get('aeBpm').value, 96);
assert.equal(elements.get('aeCategory').value, 'قدیمی');
assert.equal(elements.get('aeKey').options.length, 12);
assert.equal(
  elements.get('archiveEditOverlay').classList.values.has('show'),
  true
);

elements.get('aeTitle').value = ' ';
elements.get('aeArtist').value = ' هنرمند جدید ';
elements.get('aeAlbum').value = ' آلبوم جدید ';
elements.get('aeKey').value = 'F';
elements.get('aeKeyMode').value = 'maj';
elements.get('aeBpm').value = 'نامعتبر';
elements.get('aeTimeSig').value = '6/8';
elements.get('aeGenre').value = 'راک';
elements.get('aeCategory').value = ' زنده, , تمرین ';
elements.get('aeNotes').value = ' یادداشت جدید ';

service.save();
assert.equal(undoLabel, 'ویرایش مشخصات');
assert.equal(savedSongs, songs);
assert.equal(songs[0].title, 'بدون نام');
assert.equal(songs[0].artist, 'هنرمند جدید');
assert.equal(songs[0].artistKey, 'هنرمند-جدید');
assert.equal(songs[0].album, 'آلبوم جدید');
assert.equal(songs[0].key, 'F');
assert.equal(songs[0].tempo, 120);
assert.equal(songs[0].bpm, 120);
assert.equal(songs[0].timeSignature, '6/8');
assert.equal(songs[0].genre, 'راک');
assert.deepEqual(songs[0].categories, ['زنده', 'تمرین']);
assert.equal(songs[0].notes, 'یادداشت جدید');
assert.equal(songs[0].updatedAt, '2026-08-25T13:00:00.000Z');
assert.equal(editSongId, null);
assert.equal(searchResetCount, 1);
assert.equal(artistResetCount, 1);
assert.equal(renderCount, 1);
assert.equal(artistRenderCount, 1);
assert.equal(filterUpdateCount, 1);
assert.equal(toastMessage, 'مشخصات به‌روزرسانی شد');
assert.equal(
  elements.get('archiveEditOverlay').classList.values.has('show'),
  false
);

service.close();
assert.equal(editSongId, null);

console.log('ArchiveMetadataEditService tests passed');
