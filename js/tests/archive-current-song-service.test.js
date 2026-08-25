const assert = require('node:assert/strict');
const ArchiveCurrentSongService = require(
  '../archive/ArchiveCurrentSongService.js'
);

const song = {
  id: 'song-1',
  _arrangerMarkers: { enabled: true, start: 4, end: 12 }
};
const daw = { clips: [] };
let resetCount = 0;
let markerService = null;
const service = ArchiveCurrentSongService.create({
  runtimeAdapter: {
    getSongOrThrow: () => song,
    getSong: () => song,
    getDAWOrThrow: () => daw,
    resetPerformanceSerialization: () => {
      resetCount++;
    }
  },
  getArrangerMarkerService: () => markerService
});

assert.equal(service.getSong(), song);
assert.equal(service.getSongOrNull(), song);
assert.equal(service.getDAW(), daw);
service.resetPerformanceSerialization();
assert.equal(resetCount, 1);
assert.deepEqual(service.getArrangerMarkers(song), {
  enabled: true,
  start: 4,
  end: 12
});

markerService = {
  fromSong: value => ({
    enabled: false,
    start: value.id === 'song-1' ? 2 : 0,
    end: 8
  })
};
assert.deepEqual(service.getArrangerMarkers(song), {
  enabled: false,
  start: 2,
  end: 8
});

const fallbackService = ArchiveCurrentSongService.create({
  runtimeAdapter: {
    getSong: () => song,
    getDAW: () => daw
  }
});
assert.equal(fallbackService.getSong(), song);
assert.equal(fallbackService.getSongOrNull(), song);
assert.equal(fallbackService.getDAW(), daw);

const unavailableService = ArchiveCurrentSongService.create({
  runtimeAdapter: {
    getSong: () => null,
    getDAW: () => null
  }
});
assert.throws(
  () => unavailableService.getSong(),
  /editor song is unavailable/
);
assert.throws(
  () => unavailableService.getDAW(),
  /DAW is unavailable/
);

console.log('ArchiveCurrentSongService tests passed');
