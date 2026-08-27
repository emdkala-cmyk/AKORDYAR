const assert = require('node:assert/strict');
const TransportSchedulingService = require('../core/TransportSchedulingService.js');

function meterConfig(timeSignature, bpm) {
  const [numerator, denominator] = String(timeSignature).split('/').map(Number);
  const beatDuration = 60 / Number(bpm) * (4 / denominator);
  return {
    isValid: numerator > 0 && denominator > 0 && Number(bpm) > 0,
    numerator,
    denominator,
    beatsPerMeasure: numerator,
    beatDuration,
    measureDuration: numerator * beatDuration
  };
}

function createAudioContextService() {
  const context = { currentTime: 10 };
  const clicks = [];
  return class FakeAudioContextService {
    constructor(options = {}) {
      this.contextProvider = options.contextProvider;
      this.context = null;
      this.clicks = clicks;
      this.setContextCalls = [];
    }

    getContext() {
      if (!this.context) this.context = this.contextProvider?.() || context;
      return this.context;
    }

    setContext(value) {
      this.setContextCalls.push(value);
      this.context = value;
      return value;
    }

    playClick(isAccent, soundType) {
      this.clicks.push({ isAccent, soundType });
      return true;
    }

    playClickAt(isAccent, soundType, when) {
      this.clicks.push({ isAccent, soundType, when });
      return true;
    }

    stopAll() {}
  };
}

class FakeMetronomeEngine {
  constructor() {
    this.running = false;
    this.lastBeat = -1;
  }

  start() {
    this.running = true;
    this.lastBeat = -1;
  }

  stop() {
    this.running = false;
    this.lastBeat = 0;
  }

  nextBeat(playheadTime, { timeSignature } = {}) {
    if (!this.running) return null;
    const beatIndex = Math.floor(playheadTime / 0.5);
    if (beatIndex === this.lastBeat) return null;
    this.lastBeat = beatIndex;
    return {
      beatIndex,
      beatInMeasure: beatIndex % 4,
      isAccent: beatIndex % 4 === 0,
      timeSignature
    };
  }
}

class FakeMetronomeScheduler {
  constructor(options) {
    this.options = options;
    this.running = false;
    this.startOptions = null;
    this.stopCalls = 0;
  }

  start(options) {
    this.startOptions = options;
    this.running = true;
    return true;
  }

  stop() {
    this.stopCalls += 1;
    this.running = false;
  }
}

class FakeCountInScheduler {
  constructor() {
    this.running = false;
    this.cancelCalls = 0;
  }

  start() {
    this.running = true;
    return { running: true };
  }

  cancel() {
    this.cancelCalls += 1;
    this.running = false;
    return true;
  }
}

const daw = {
  isPlaying: true,
  playhead: 2,
  loopEnabled: true,
  loopA: 1,
  loopB: 4
};
const AudioContextServiceCtor = createAudioContextService();
const service = TransportSchedulingService.create({
  getDAW: () => daw,
  getMeterConfig: meterConfig,
  getLoop: () => ({ enabled: daw.loopEnabled, start: daw.loopA, end: daw.loopB }),
  getClockSnapshot: () => ({
    timelineZeroAudioTime: 8,
    transportStartAudioTime: 10
  }),
  contextProvider: () => ({ currentTime: 10 }),
  AudioContextServiceCtor,
  MetronomeEngineCtor: FakeMetronomeEngine,
  MetronomeSchedulerCtor: FakeMetronomeScheduler,
  CountInSchedulerCtor: FakeCountInScheduler,
  isStrongBeat: beat => beat === 0,
  logger: { log() {} }
});

const audio = service.getAudioContextService();
assert.ok(audio);
assert.equal(service.startMetronome({
  bpm: 120,
  timeSignature: '4/4',
  sound: 'beep'
}), true);

const scheduler = service.getMetronomeScheduler();
assert.ok(scheduler);
assert.deepEqual(scheduler.startOptions, {
  bpm: 120,
  timeSignature: '4/4',
  startTime: 8,
  playheadPosition: 2,
  transportStartTime: 10,
  soundType: 'beep'
});
assert.equal(scheduler.options.getMeterConfig('4/4', 120).beatDuration, 0.5);

service.stopMetronome();
assert.equal(scheduler.running, false);

const countIn = service.getCountInScheduler();
assert.equal(service.isCountInRunning(), false);
assert.deepEqual(countIn.start({ bars: 1 }), { running: true });
assert.equal(service.isCountInRunning(), true);
assert.equal(service.cancelCountIn(), true);
assert.equal(countIn.cancelCalls, 1);

const fallbackService = TransportSchedulingService.create({
  getDAW: () => daw,
  getMeterConfig: meterConfig,
  AudioContextServiceCtor,
  MetronomeEngineCtor: FakeMetronomeEngine,
  MetronomeSchedulerCtor: null,
  CountInSchedulerCtor: null,
  isStrongBeat: beat => beat === 0,
  logger: { log() {} }
});

assert.equal(fallbackService.startMetronome({
  bpm: 120,
  timeSignature: '4/4'
}), true);
assert.equal(
  fallbackService.checkMetronomeTick(0, { bpm: 120, timeSignature: '4/4' }).isAccent,
  true
);
assert.equal(fallbackService.checkMetronomeTick(0, {
  bpm: 120,
  timeSignature: '4/4'
}), null);
fallbackService.stopMetronome();

console.log('Transport scheduling service tests passed');
