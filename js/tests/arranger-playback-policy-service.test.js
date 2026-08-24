const assert = require('node:assert/strict');
const ArrangerPlaybackPolicyService = require('../editor/ArrangerPlaybackPolicyService.js');

const boundary = ArrangerPlaybackPolicyService.createBoundary({
  clips: [
    { start: 0, duration: 12 },
    { start: 4, duration: 3 }
  ],
  sections: [{ start: 13, duration: 5 }],
  fallbackEnd: 30
});

assert.equal(boundary.end, 18);
assert.equal(boundary.selectionEnd, 0);
assert.deepEqual(boundary.loopState, {
  loopEnabled: false,
  loopA: 0,
  loopB: 10
});

const emptyBoundary = ArrangerPlaybackPolicyService.createBoundary({
  clips: [],
  sections: [],
  fallbackEnd: 30
});
assert.equal(emptyBoundary.end, 30);

const daw = {
  loopEnabled: true,
  loopA: 8,
  loopB: 16
};
assert.equal(ArrangerPlaybackPolicyService.applyToDAW(daw), true);
assert.deepEqual(daw, {
  loopEnabled: false,
  loopA: 0,
  loopB: 10
});

console.log('ArrangerPlaybackPolicyService tests passed');
