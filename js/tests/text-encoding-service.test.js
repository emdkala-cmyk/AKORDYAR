const assert = require('node:assert/strict');
const TextEncodingService = require('../core/TextEncodingService.js');

const healthy = 'آهنگ فارسی';
assert.equal(TextEncodingService.repairText(healthy), healthy);

const mojibake = 'Ø¢Ù‡Ù†Ú¯ ÙØ§Ø±Ø³ÛŒ';
assert.equal(TextEncodingService.repairText(mojibake), healthy);

const song = {
  title: mojibake,
  artist: 'خواننده',
  lyrics: [mojibake, healthy],
  chords: [{ name: 'Am' }]
};
const repaired = TextEncodingService.repairSong(song);
assert.equal(repaired.title, healthy);
assert.equal(repaired.artist, song.artist);
assert.equal(repaired.lyrics[1], healthy);
assert.equal(song.title, mojibake);

console.log('TextEncodingService tests passed');
