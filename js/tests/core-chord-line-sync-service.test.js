const assert = require('node:assert/strict');
const CoreChordLineSync = require('../app/CoreChordLineSyncService.js');
const ChordLineSync = require('../editor/ChordLineSyncService.js');

const song = { id: 'song-1' };
const popup = { id: 'chord-line-popup' };
const calls = [];
const daw = {
  tracks: [
    { id: 'audio-track', type: 'audio' },
    { id: 'chord-track', type: 'chord' }
  ],
  clips: [
    { id: 'late', type: 'chord', trackId: 'chord-track', start: 8, name: 'X' },
    { id: 'early', type: 'chord', trackId: 'chord-track', start: 2, name: 'Y' },
    { id: 'audio', type: 'audio', trackId: 'audio-track', start: 0, name: 'voice' }
  ]
};
const songState = {
  currentSong: () => song,
  getChords: () => [
    { lineIndex: 1, charIndex: 0, name: 'G' },
    { lineIndex: 0, charIndex: 2, name: 'Am' }
  ],
  markChordLineSynced: value => calls.push(['mark', value])
};

const service = CoreChordLineSync.create({
  getSongState: () => songState,
  getDAW: () => daw,
  getChordLineSyncService: () => ChordLineSync,
  isPopupOpen: value => value === popup,
  getChordLinePopup: () => popup,
  syncChordLinePopup: () => calls.push('popup'),
  saveState: () => calls.push('save'),
  renderAll: () => calls.push('render'),
  toast: value => calls.push(['toast', value])
});

service.syncChordLineFromLyrics();
assert.deepEqual(
  daw.clips
    .filter(clip => clip.type === 'chord')
    .sort((a, b) => a.start - b.start)
    .map(clip => clip.name),
  ['Am', 'G']
);
assert.deepEqual(calls, [
  ['mark', song],
  'popup',
  'save',
  'render',
  ['toast', '✔ Chord Line با موفقیت از Lyrics Chord همگام شد (2 آکورد).']
]);

const noSongCalls = [];
const noSong = CoreChordLineSync.create({
  getSongState: () => ({
    currentSong: () => null,
    getChords: () => []
  }),
  toast: value => noSongCalls.push(value)
});
noSong.syncChordLineFromLyrics();
assert.deepEqual(noSongCalls, ['سندی برای سینک وجود ندارد']);

const noChordsCalls = [];
const noChords = CoreChordLineSync.create({
  getSongState: () => ({
    currentSong: () => song,
    getChords: () => []
  }),
  toast: value => noChordsCalls.push(value)
});
noChords.syncChordLineFromLyrics();
assert.deepEqual(noChordsCalls, ['هیچ آکوردی در Lyrics Chord وجود ندارد.']);

const noClipsCalls = [];
const noClips = CoreChordLineSync.create({
  getSongState: () => songState,
  getDAW: () => ({
    tracks: [{ id: 'chord-track', type: 'chord' }],
    clips: []
  }),
  getChordLineSyncService: () => ChordLineSync,
  toast: value => noClipsCalls.push(value)
});
noClips.syncChordLineFromLyrics();
assert.deepEqual(noClipsCalls, [
  'برای همگام‌سازی، ابتدا حداقل یک آکورد در Chord Line ایجاد کنید.'
]);

console.log('CoreChordLineSyncService tests passed');
