const assert = require('node:assert/strict');
const PlayheadMath = require('../core/PlayheadMath.js');

assert.equal(PlayheadMath.snapToNearestMeasureStart(1.1, 2), 2);
assert.equal(PlayheadMath.snapToNearestMeasureStart(0.9, 2), 0);
assert.equal(PlayheadMath.snapToNearestMeasureStart(5.1, 2, 5.5), 5.5);
assert.equal(PlayheadMath.snapToNearestMeasureStart(2, 0), 2);

assert.equal(PlayheadMath.getAudioElapsed(42.75, 40, 7.25), 10);
assert.equal(PlayheadMath.getTimelineZeroAudioTime(40, 7.25), 32.75);
assert.equal(PlayheadMath.getTimelineZeroAudioTime(null, 7.25), null);

console.log('PlayheadMath measure alignment tests passed');
