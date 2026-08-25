const assert = require('node:assert/strict');
const ArchiveArtistCatalogService = require(
  '../archive/ArchiveArtistCatalogService.js'
);

const artists = ArchiveArtistCatalogService.getAll();
assert.ok(Array.isArray(artists));
assert.equal(artists.length, 21);
assert.equal(
  artists.find(artist => artist.id === 'hayedeh').displayName,
  'هایده'
);
assert.equal(ArchiveArtistCatalogService.getDisplayName('hayedeh'), 'هایده');
assert.equal(ArchiveArtistCatalogService.getDisplayName('سعادتمند'), 'شهره');
assert.equal(
  ArchiveArtistCatalogService.getDisplayName('unknown-artist'),
  'unknown-artist'
);
assert.equal(ArchiveArtistCatalogService.getDisplayName(''), '');

console.log('ArchiveArtistCatalogService tests passed');
