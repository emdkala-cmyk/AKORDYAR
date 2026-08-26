const assert = require('node:assert/strict');
const CoreArrangerCrossfadeService = require(
  '../app/CoreArrangerCrossfadeService.js'
);

const calls = [];
const scheduled = [];
const gain = {
  value: 0.8,
  cancelScheduledValues: value => calls.push(['cancel', value]),
  setValueAtTime: (...args) => calls.push(['set', ...args]),
  linearRampToValueAtTime: (...args) => calls.push(['ramp', ...args])
};
const context = { currentTime: 10 };
const state = {
  crossfade: 2,
  hasNext: true,
  isCrossfading: false
};
const runtime = CoreArrangerCrossfadeService.create({
  getCrossfadeDuration: () => state.crossfade,
  hasNextState: () => state.hasNext,
  setIsCrossfading: value => {
    state.isCrossfading = value;
  },
  ensureAudioCtx: () => calls.push('ensure-audio'),
  getDAW: () => ({
    audioCtx: context,
    masterGain: { gain }
  }),
  stopAllVoices: () => calls.push('stop-voices'),
  hotSwapToNextSong: () => calls.push('hot-swap'),
  schedule: (callback, delay) => {
    scheduled.push({ callback, delay });
  },
  logger: {
    log: (...args) => calls.push(['log', ...args]),
    error: (...args) => calls.push(['error', ...args])
  }
});

runtime.swap();
assert.equal(state.isCrossfading, true);
assert.equal(scheduled.length, 1);
assert.equal(scheduled[0].delay, 1000);
assert.ok(calls.includes('ensure-audio'));
assert.deepEqual(calls.filter(call => Array.isArray(call) && call[0] === 'ramp'), [
  ['ramp', 0, 11]
]);

context.currentTime = 11;
scheduled[0].callback();
assert.equal(state.isCrossfading, false);
assert.ok(calls.includes('stop-voices'));
assert.ok(calls.includes('hot-swap'));
assert.deepEqual(calls.filter(call => Array.isArray(call) && call[0] === 'ramp'), [
  ['ramp', 0, 11],
  ['ramp', 0.8, 12]
]);

state.crossfade = 0;
state.hasNext = false;
runtime.swap();
assert.equal(calls.filter(call => call === 'hot-swap').length, 2);
assert.equal(scheduled.length, 1);

state.crossfade = 1;
state.hasNext = true;
const errorRuntime = CoreArrangerCrossfadeService.create({
  getCrossfadeDuration: () => state.crossfade,
  hasNextState: () => state.hasNext,
  setIsCrossfading: value => {
    state.isCrossfading = value;
  },
  ensureAudioCtx: () => {},
  getDAW: () => ({
    audioCtx: { currentTime: 0 },
    masterGain: {
      gain: {
        value: 1,
        cancelScheduledValues() {},
        setValueAtTime() {},
        linearRampToValueAtTime() {}
      }
    }
  }),
  stopAllVoices: () => {
    throw new Error('stop failed');
  },
  schedule: callback => callback(),
  logger: {
    log() {},
    error: (...args) => calls.push(['error', ...args])
  }
});
errorRuntime.swap();
assert.equal(state.isCrossfading, false);
assert.ok(calls.some(call => call[0] === 'error'));

console.log('CoreArrangerCrossfadeService tests passed');
