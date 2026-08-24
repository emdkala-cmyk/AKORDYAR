const assert = require('node:assert/strict');
const ArrangerPlaybackPolicyService = require('../editor/ArrangerPlaybackPolicyService.js');

const boundary = ArrangerPlaybackPolicyService.createBoundary({
  clips: [
    { start: 0, duration: 12 },
    { start: 4, duration: 3 }
  ],
  sections: [{ start: 13, duration: 5 }],
  arrangerMarkers: {
    enabled: true,
    start: 2,
    end: 17
  },
  fallbackEnd: 30
});

assert.equal(boundary.start, 2);
assert.equal(boundary.end, 17);
assert.equal(boundary.selectionEnd, 17);
assert.deepEqual(boundary.markers, {
  start: 2,
  end: 17
});

const emptyBoundary = ArrangerPlaybackPolicyService.createBoundary({
  clips: [],
  sections: [],
  fallbackEnd: 30
});
assert.equal(emptyBoundary.start, 0);
assert.equal(emptyBoundary.end, 30);
assert.equal(emptyBoundary.selectionEnd, 30);

const disabledMarkerBoundary = ArrangerPlaybackPolicyService.createBoundary({
  clips: [{ start: 0, duration: 20 }],
  arrangerMarkers: {
    enabled: false,
    start: 4,
    end: 12
  },
  legacyLoopState: { loopA: 4, loopB: 12 },
  fallbackEnd: 30
});
assert.equal(disabledMarkerBoundary.start, 0);
assert.equal(disabledMarkerBoundary.end, 20);

const invalidBoundary = ArrangerPlaybackPolicyService.createBoundary({
  clips: [{ start: 0, duration: 8 }],
  arrangerMarkers: {
    enabled: true,
    start: 12,
    end: 20
  },
  fallbackEnd: 30
});
assert.deepEqual(
  {
    start: invalidBoundary.start,
    end: invalidBoundary.end
  },
  {
    start: 0,
    end: 8
  }
);

const daw = {
  loopEnabled: true,
  loopA: 8,
  loopB: 16,
  arrangerMarkers: { enabled: true, start: 3, end: 11 }
};
assert.equal(ArrangerPlaybackPolicyService.applyToDAW(daw), true);
assert.deepEqual(daw, {
  loopEnabled: false,
  loopA: 8,
  loopB: 16,
  arrangerMarkers: { enabled: true, start: 3, end: 11 }
});

console.log('ArrangerPlaybackPolicyService tests passed');
