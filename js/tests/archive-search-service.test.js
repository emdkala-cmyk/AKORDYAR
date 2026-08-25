const assert = require('node:assert/strict');
const ArchiveSearchService = require('../archive/ArchiveSearchService.js');

let extractionCount = 0;
const service = ArchiveSearchService.create({
  normalizeText: value => String(value || '').trim().toLowerCase(),
  extractSearchText: song => {
    extractionCount++;
    return `${song.title} ${song.artist}`.toLowerCase();
  }
});

const song = { id: 'song-1', title: 'آواز شب', artist: 'خواننده' };
assert.equal(service.query('  آواز  '), 'آواز');
assert.equal(service.matches(song, 'خواننده'), true);
assert.equal(service.matches(song, 'ناموجود'), false);
assert.equal(service.getSearchText(song), 'آواز شب خواننده');
assert.equal(service.getSearchText(song), 'آواز شب خواننده');
assert.equal(extractionCount, 1);

const songs = [
  song,
  { id: 'song-2', title: 'صبح', artist: 'دیگری' }
];
assert.deepEqual(
  service.filter(songs, 'آواز').map(item => item.id),
  ['song-1']
);

service.clear();
service.getSearchText(song);
assert.equal(extractionCount, 3);

console.log('ArchiveSearchService tests passed');
