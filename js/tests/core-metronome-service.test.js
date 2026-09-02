const assert = require('node:assert/strict');
const MetronomeService = require('../app/CoreMetronomeService.js');

const elements = {
  metroToggleBtn: { textContent: '' },
  edTempo: { value: '96' },
  edTimeSig: { value: '3/4' }
};
const state = {
  metroActive: false,
  metroTimer: null,
  countInBars: 0
};
const timing = {
  tempo: 96,
  timeSignature: '3/4'
};
const daw = {
  playhead: 0.37,
  isPlaying: false
};
const calls = [];
const scheduling = {
  getMetronomeScheduler: () => ({ available: true }),
  isCountInRunning: () => true,
  cancelCountIn: () => {
    calls.push('cancel');
    return true;
  },
  startMetronome: options => {
    calls.push(['start', options]);
    return true;
  },
  stopMetronome: () => calls.push('stop'),
  checkMetronomeTick: (time, options) => {
    calls.push(['tick', time, options]);
    return 'tick-result';
  }
};

const service = MetronomeService.create({
  getElement: id => elements[id],
  getTransportState: () => state,
  getTimingContext: () => timing,
  getDAW: () => daw,
  getProjectEnd: () => 20,
  seekTransport: (...args) => calls.push(['seek', ...args]),
  stopAllVoices: () => calls.push('voices-stopped'),
  updatePlayheadUI: () => calls.push('ui'),
  playheadMath: {
    snapToNearestMeasureStart: (current, measureDuration, projectEnd) => {
      calls.push(['align', current, measureDuration, projectEnd]);
      return 2;
    }
  },
  getGridConfig: (sig, bpm) => ({ sig, bpm, measureDuration: 2 }),
  getSchedulingService: () => scheduling,
  getCountInScheduler: () => ({ start: () => true }),
  ensureAudioCtx: () => calls.push('audio'),
  getMetroSound: () => 'wood'
});

assert.equal(service.setCountInBars(2), undefined);
assert.equal(state.countInBars, 2);
assert.deepEqual(calls.splice(0, 3), [
  'cancel',
  ['align', 0.37, 2, 20],
  'voices-stopped'
]);
assert.equal(daw.playhead, 2);
assert.equal(calls.shift(), 'ui');

daw.isPlaying = true;
service.toggleMetronome();
assert.equal(state.metroActive, true);
assert.equal(elements.metroToggleBtn.textContent, '🔊');
assert.equal(calls.shift(), 'audio');
assert.deepEqual(calls.shift(), ['start', {
  bpm: 96,
  timeSignature: '3/4',
  sound: 'wood'
}]);

elements.edTempo.value = '50';
elements.edTimeSig.value = '6/8';
assert.equal(service.startMetronome(), true);
assert.equal(calls.shift(), 'audio');
assert.deepEqual(calls.shift(), ['start', {
  bpm: 96,
  timeSignature: '3/4',
  sound: 'wood'
}]);

assert.equal(service.checkMetronomeTick(4.5), 'tick-result');
assert.deepEqual(calls.shift(), ['tick', 4.5, {
  bpm: 96,
  timeSignature: '3/4'
}]);

service.toggleMetronome();
assert.equal(elements.metroToggleBtn.textContent, '🔇');
assert.equal(state.metroTimer, null);
assert.equal(calls.shift(), 'stop');

assert.equal(service.getMetronomeSchedulerBridge().available, true);
assert.equal(service.getCountInScheduler().start(), true);

console.log('CoreMetronomeService tests passed');
