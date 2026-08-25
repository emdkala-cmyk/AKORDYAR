const assert = require('node:assert/strict');
const GeometryService = require('../app/CoreTimelineGeometryService.js');

const daw = {
  pxPerSecond: 70,
  timelineDuration: 18,
  clips: [{ start: 10, duration: 3 }],
  sections: [{ start: 4, duration: 2 }]
};
const inner = {
  getBoundingClientRect: () => ({ left: 100, top: 40 })
};
const timing = {
  timeSignature: '4/4',
  tempo: 120
};
let autoScrollCalls = 0;
const service = GeometryService.create({
  getDAW: () => daw,
  getTimelineInner: () => inner,
  getTimingContext: () => timing,
  meter: {
    timeToBarBeat: (seconds, signature, tempo) =>
      [seconds, signature, tempo],
    barBeatToTime: (bar, beat, signature, tempo) =>
      [bar, beat, signature, tempo]
  },
  syncTimelineViewportToPlayhead: () => {
    autoScrollCalls += 1;
    return 'synced';
  }
});

assert.equal(service.timeToX(2), 140);
assert.equal(service.xToTime(140), 2);
assert.deepEqual(service.timeToBarBeat(3), [3, '4/4', 120]);
assert.deepEqual(service.barBeatToTime(2, 1), [2, 1, '4/4', 120]);
assert.equal(service.getProjectEnd(), 38);
assert.equal(service.ensureTimelineFits(25), 25);
assert.equal(daw.timelineDuration, 25);
assert.equal(service.ensureTimelineFits(12), 25);
assert.equal(service.clientToTime(240), 2);
assert.deepEqual(service.clientToInnerPoint(240, 75), {
  x: 140,
  y: 35
});
assert.equal(service.autoScrollToPlayhead(), 'synced');
assert.equal(autoScrollCalls, 1);

const missingInner = GeometryService.create({
  getDAW: () => ({ pxPerSecond: 50, timelineDuration: 10 }),
  getTimelineInner: () => null
});
assert.equal(missingInner.clientToTime(100), 0);
assert.deepEqual(missingInner.clientToInnerPoint(100, 20), {
  x: 100,
  y: 20
});

console.log('CoreTimelineGeometryService tests passed');
