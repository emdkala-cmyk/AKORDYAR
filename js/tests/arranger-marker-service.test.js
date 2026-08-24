const assert = require('node:assert/strict');
const ArrangerMarkerService = require('../editor/ArrangerMarkerService.js');

assert.deepEqual(
  ArrangerMarkerService.normalize({ enabled: true, start: 2, end: 14 }),
  { enabled: true, start: 2, end: 14 }
);

assert.deepEqual(
  ArrangerMarkerService.fromSong({
    _arrangerMarkers: { enabled: true, start: 4, end: 19 },
    _dawLoop: { loopA: 1, loopB: 9 }
  }),
  { enabled: true, start: 4, end: 19 }
);

assert.deepEqual(
  ArrangerMarkerService.fromSong({
    _arrangerMarkers: { start: 0, end: 0 },
    _dawLoop: { loopA: 3, loopB: 12 }
  }),
  { enabled: false, start: 0, end: 0 }
);

assert.deepEqual(
  ArrangerMarkerService.fromSong({
    _arrangerMarkers: { start: 4, end: 19 },
    _dawLoop: { loopA: 1, loopB: 9 }
  }),
  { enabled: false, start: 4, end: 19 }
);

assert.deepEqual(
  ArrangerMarkerService.fromSong({
    _dawLoop: { loopA: 3, loopB: 12 }
  }),
  { enabled: false, start: 0, end: 0 }
);

assert.deepEqual(
  ArrangerMarkerService.fromDAW({
    arrangerMarkers: { enabled: true, start: 6, end: 22 },
    loopA: 1,
    loopB: 5
  }),
  { enabled: true, start: 6, end: 22 }
);

console.log('ArrangerMarkerService tests passed');
