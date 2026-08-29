const assert = require('node:assert/strict');
const TimelineGridService = require('../app/CoreTimelineGridService.js');

const calls = [];
const daw = {
  pxPerSecond: 80,
  isPlaying: true,
  timelineDuration: 0
};
const transportState = {
  metroActive: true,
  snapValue: null
};
const elements = new Map([
  ['timeline-ruler', { id: 'ruler' }],
  ['ruler-labels', { id: 'labels' }],
  ['tl-inner', { id: 'inner' }],
  ['lanes-container', { id: 'lanes' }]
]);
const config = {
  timeSignature: '6/8',
  tempo: 120,
  measureDuration: 1.5
};
const timelineGrid = {
  drawLaneGrid(canvas, options) {
    calls.push(['draw', canvas, options]);
    return 'drawn';
  },
  renderRuler(options) {
    calls.push(['ruler', options]);
    options.onDurationChange(18);
    return 'rendered';
  }
};

const service = TimelineGridService.create({
  timelineGrid,
  getDAW: () => daw,
  getTimingContext: () => ({
    timeSignature: '6/8',
    tempo: 120
  }),
  getProjectEnd: () => 12,
  timeToX: value => value * 80,
  getElement: id => elements.get(id),
  getTimeSignatureGridConfig: () => config,
  getActiveQuantizeGridStep: value => value.measureDuration / 6,
  getTransportState: () => transportState,
  renderTracks: () => calls.push(['tracks']),
  renderClips: options => calls.push(['clips', options]),
  updatePlayheadUI: () => calls.push(['playhead']),
  refreshPopupTimeline: () => calls.push(['popup-timeline']),
  startMetronome: () => calls.push(['metronome'])
});

const canvas = { id: 'lane-grid' };
assert.equal(service.drawLaneGrid(canvas), 'drawn');
assert.equal(calls[0][0], 'draw');
assert.equal(calls[0][1], canvas);
assert.equal(calls[0][2].total, 12);
assert.equal(calls[0][2].timeToX(2), 160);
assert.equal(calls[0][2].tempo, 120);
assert.equal(calls[0][2].timeSignature, '6/8');
assert.equal(calls[0][2].pxPerSec, 80);

assert.equal(service.renderRuler(), 'rendered');
const rulerCall = calls[1];
assert.equal(rulerCall[0], 'ruler');
assert.equal(rulerCall[1].total, 12);
assert.equal(rulerCall[1].tempo, 120);
assert.equal(rulerCall[1].timeSignature, '6/8');
assert.equal(rulerCall[1].pxPerSec, 80);
assert.deepEqual(
  [
    rulerCall[1].rulerEl,
    rulerCall[1].labelsEl,
    rulerCall[1].tlInnerEl,
    rulerCall[1].lanesEl
  ],
  [
    elements.get('timeline-ruler'),
    elements.get('ruler-labels'),
    elements.get('tl-inner'),
    elements.get('lanes-container')
  ]
);
assert.equal(daw.timelineDuration, 18);

service.handleTimingChange();
assert.equal(transportState.snapValue, 0.25);
assert.deepEqual(calls.slice(2).map(call => call[0]), [
  'tracks',
  'ruler',
  'clips',
  'playhead',
  'popup-timeline',
  'metronome'
]);
assert.equal(calls[3][1].total, 12);
assert.equal(calls[3][1].timeSignature, '6/8');
assert.deepEqual(calls[4][1], { preserveWaveforms: true });
assert.equal(daw.timelineDuration, 18);

console.log('CoreTimelineGridService tests passed');
