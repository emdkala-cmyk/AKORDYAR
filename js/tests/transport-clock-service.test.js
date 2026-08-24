const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const TransportClockService = require('../core/TransportClockService.js');
const PlayheadMath = require('../core/PlayheadMath.js');

const projectRoot = path.resolve(__dirname, '..', '..');
const coreSource = fs.readFileSync(
  path.join(projectRoot, 'js', 'app', 'core.js'),
  'utf8'
);

assert.match(coreSource, /TransportClockService\?\.create/);
assert.doesNotMatch(coreSource, /function getTransportClockSnapshot\(/);

let performanceTime = 1000;
const daw = {
  playhead: 4,
  isPlaying: true,
  audioCtx: {
    currentTime: 20,
    getOutputTimestamp: () => ({
      contextTime: 19.5,
      performanceTime: 900
    })
  }
};

const service = TransportClockService.create({
  getDAW: () => daw,
  playheadMath: PlayheadMath,
  getNow: () => performanceTime
});

assert.equal(service.setOrigin(4, 18), 18);
const running = service.getSnapshot({ visual: true, performanceTime });
assert.equal(running.timelineTime, 6);
assert.ok(Math.abs(running.visualTimelineTime - 5.6) < 1e-9);
assert.equal(running.transportStartAudioTime, 18);
assert.equal(service.getPlayhead(), 6);

// Regression: a song hot-swap must re-anchor the AudioContext clock together
// with the new song's A marker. Reusing the old audio origin makes scheduling
// begin near the previous song's B point.
daw.audioCtx.currentTime = 30;
assert.equal(service.setOrigin(11), 30);
assert.equal(service.getSnapshot().timelineTime, 11);
assert.equal(service.getSnapshot().transportStartAudioTime, 30);

daw.isPlaying = false;
daw.playhead = 7;
assert.equal(service.getSnapshot().timelineTime, 7);

daw.isPlaying = true;
daw.playOriginAudio = null;
daw.playOriginPerf = 1500;
daw.playOriginTime = 2;
performanceTime = 2000;
assert.equal(service.getSnapshot().timelineTime, 2.5);

console.log('Transport clock service tests passed');
