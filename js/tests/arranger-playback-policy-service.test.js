const assert = require('node:assert/strict');
const ArrangerPlaybackPolicyService = require('../editor/ArrangerPlaybackPolicyService.js');

const boundary = ArrangerPlaybackPolicyService.createBoundary({
  clips: [
    { start: 0, duration: 12 },
    { start: 4, duration: 3 }
  ],
  sections: [{ start: 13, duration: 5 }],
  arrangerMarkers: {
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

const invalidBoundary = ArrangerPlaybackPolicyService.createBoundary({
  clips: [{ start: 0, duration: 8 }],
  arrangerMarkers: {
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
  arrangerMarkers: { start: 3, end: 11 }
};
assert.equal(ArrangerPlaybackPolicyService.applyToDAW(daw), true);
assert.deepEqual(daw, {
  loopEnabled: false,
  loopA: 8,
  loopB: 16,
  arrangerMarkers: { start: 3, end: 11 }
});

console.log('ArrangerPlaybackPolicyService tests passed');
