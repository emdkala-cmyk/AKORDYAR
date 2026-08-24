const assert = require('node:assert/strict');
const ArchiveMigrationService = require('../archive/ArchiveMigrationService.js');

let savedSongs = null;
let idCounter = 0;
const service = ArchiveMigrationService.create({
  schemaVersion: 1,
  cryptoRef: {
    randomUUID: () => `generated-${++idCounter}`
  },
  now: () => '2026-08-24T00:00:00.000Z',
  setSongs: songs => {
    savedSongs = songs;
  }
});

const songs = [
  { id: 'same', title: 'اول' },
  { id: 'same', title: 'دوم' },
  { title: 'سوم' }
];

assert.equal(service.migrate(songs), songs);
assert.equal(songs[0].id, 'same');
assert.equal(songs[1].id, 'generated-1');
assert.equal(songs[2].id, 'generated-2');
assert.equal(songs[0].schemaVersion, 1);
assert.equal(songs[0].deletedAt, null);
assert.equal(songs[0].favorite, false);
assert.deepEqual(songs[0].categories, []);
assert.deepEqual(songs[0].tags, []);
assert.equal(songs[0].createdAt, '2026-08-24T00:00:00.000Z');
assert.equal(songs[0].updatedAt, '2026-08-24T00:00:00.000Z');
assert.equal(songs[0].status, 'active');
assert.equal(savedSongs, songs);

savedSongs = null;
service.migrate(songs);
assert.equal(savedSongs, null);

const fallbackId = ArchiveMigrationService.generateId({
  randomUUID: () => 'uuid-id'
});
assert.equal(fallbackId, 'uuid-id');

console.log('ArchiveMigrationService tests passed');
