const assert = require('node:assert/strict');
const ArrangerMarkerService = require('../editor/ArrangerMarkerService.js');

assert.deepEqual(
  ArrangerMarkerService.normalize({ start: 2, end: 14 }),
  { start: 2, end: 14 }
);

assert.deepEqual(
  ArrangerMarkerService.fromSong({
    _arrangerMarkers: { start: 4, end: 19 },
    _dawLoop: { loopA: 1, loopB: 9 }
  }),
  { start: 4, end: 19 }
);

assert.deepEqual(
  ArrangerMarkerService.fromSong({
    _arrangerMarkers: { start: 0, end: 0 },
    _dawLoop: { loopA: 3, loopB: 12 }
  }),
  { start: 0, end: 0 }
);

assert.deepEqual(
  ArrangerMarkerService.fromSong({
    _dawLoop: { loopA: 3, loopB: 12 }
  }),
  { start: 3, end: 12 }
);

assert.deepEqual(
  ArrangerMarkerService.fromDAW({
    arrangerMarkers: { start: 6, end: 22 },
    loopA: 1,
    loopB: 5
  }),
  { start: 6, end: 22 }
);

console.log('ArrangerMarkerService tests passed');
