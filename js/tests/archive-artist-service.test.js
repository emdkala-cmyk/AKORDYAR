const assert = require('node:assert/strict');
const ArchiveArtistService = require('../archive/ArchiveArtistService.js');

const defaults = [
  {
    normalizedName: 'hayedeh',
    displayName: 'هایده',
    aliases: ['Haydeh']
  },
  {
    normalizedName: 'custom-artist',
    displayName: 'خواننده خاص',
    aliases: ['خاص']
  }
];
const service = ArchiveArtistService.create({
  normalizeText: value => String(value).trim().toLowerCase(),
  getDefaultArtists: () => defaults
});

assert.equal(service.artistKey('هایده'), 'hayedeh');
assert.equal(service.artistKey('Haydeh'), 'hayedeh');
assert.equal(service.artistKey(''), '_unknown');
assert.equal(service.artistKey('هنرمند جدید'), 'هنرمند جدید');
assert.equal(service.matchDefaultArtist('Haydeh'), defaults[0]);
assert.equal(service.matchDefaultArtist('خاص'), defaults[1]);
assert.equal(service.matchDefaultArtist('ناشناخته'), null);

console.log('ArchiveArtistService tests passed');
