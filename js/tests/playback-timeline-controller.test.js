const assert = require('node:assert/strict');
const PlaybackTimelineController = require('../core/PlaybackTimelineController.js');

const daw = {
  isPlaying: true,
  playhead: 0,
  clips: [],
  tracks: [],
  bufferCache: new Map()
};
let snapshotOptions = null;
const nodes = {
  'main-playhead': { style: {} },
  'playhead-hit': { style: {} },
  'time-display': { value: '' },
  'ph-label': { textContent: '' },
  'live-chord': { textContent: '' },
  'tl-scroll': {
    scrollLeft: 0,
    scrollWidth: 1000,
    clientWidth: 500
  }
};

const controller = PlaybackTimelineController.create({
  getDAW: () => daw,
  ensureAudioCtx: () => ({ currentTime: 0 }),
  stopAllVoices: () => {},
  getTransportClockSnapshot: options => {
    snapshotOptions = options;
    return {
      timelineTime: 4.25,
      visualTimelineTime: 3.85,
      audioTime: 10,
      transportStartAudioTime: 10
    };
  },
  getNode: id => nodes[id] || null,
  timeToX: seconds => seconds * 100,
  formatTime: seconds => seconds.toFixed(2)
});

assert.equal(controller.getDisplayPlayheadTime(1234), 4.25);
assert.equal(snapshotOptions.visual, false);
assert.equal(snapshotOptions.performanceTime, 1234);

controller.updatePlayheadUI({ performanceTime: 1234 });
assert.equal(
  nodes['main-playhead'].style.transform,
  'translate3d(425px, 0, 0)'
);
assert.equal(nodes['playhead-hit'].style.transform, 'translate3d(425px, 0, 0)');
assert.equal(nodes['time-display'].value, '4.25');

daw.isPlaying = false;
daw.playhead = 2.5;
assert.equal(controller.getDisplayPlayheadTime(2000), 2.5);

console.log('Playback timeline controller tests passed');
