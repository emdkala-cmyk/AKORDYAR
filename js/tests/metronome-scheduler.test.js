/**
 * MetronomeScheduler tests — look-ahead scheduling (Chris Wilson pattern).
 *
 * Uses a FakeAudioContext so the scheduler can run in Node without a browser.
 */
const assert = require('assert');
const AudioContextService = require('../core/AudioContextService.js');
const MetronomeScheduler = require('../core/MetronomeScheduler.js');
const MetronomeEngine = require('../core/MetronomeEngine.js');

// ─── Fake Audio Context (minimal for scheduling tests) ───
class FakeAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = { connect: () => {} };
    this._gains = [];
    this._oscs = [];
    this._buffers = [];
    this._sources = [];
  }
  createGain() {
    const gains = this._gains;
    let value = 1;
    return {
      gain: {
        get value() { return value; },
        set value(v) { value = v; },
        setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}
      },
      connect() { gains.push(this); }
    };
  }
  createOscillator() {
    const oscs = this._oscs;
    return {
      type: 'square', frequency: { value: 600 },
      connect() { oscs.push(this); },
      start() {}, stop() {}
    };
  }
  createBuffer(channels, length, sampleRate) {
    const buf = { numberOfChannels: channels, length, sampleRate, _data: [] };
    for (let i = 0; i < channels; i++) buf._data.push(new Float32Array(length));
    this._buffers.push(buf);
    return buf;
  }
  createBufferSource() {
    const src = { buffer: null, connect() { this._connected = true; }, start() {} };
    this._sources.push(src);
    return src;
  }
  getChannelData(ch) { return this._data[ch]; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

// ─── Fake Meter (isStrongBeat) ───
const FakeMeter = {
  isStrongBeat(beatInMeasure) { return beatInMeasure === 0; }
};

// ─── getMeterConfig from TimelineGrid logic (simplified for tests) ───
function getMeterConfig(timeSignature, bpm) {
  const parts = (timeSignature || '4/4').split('/');
  if (parts.length !== 2) return null;
  const num = Number(parts[0]);
  const den = Number(parts[1]);
  if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) return null;
  const beatUnit = den;
  const beatsPerMeasure = num;
  const beatDuration = 60 / (bpm || 120) * (4 / beatUnit);
  const measureDuration = beatDuration * beatsPerMeasure;
  return {
    numerator: num, denominator: den,
    beatUnit, beatsPerMeasure,
    subdivisionsPerBeat: 2,
    unitsPerMeasure: beatsPerMeasure * 2,
    measureDuration, beatDuration
  };
}

// ─── Fake timer capture (injectable setTimeout) ───
function makeFakeTimer() {
  const calls = [];
  return {
    fn: (cb, ms) => { calls.push({ cb, ms }); return calls.length; },
    calls,
    runNext() { calls.splice(0).forEach(c => c.cb()); }
  };
}

function setup() {
  const fakeCtx = new FakeAudioContext();
  const service = new AudioContextService({ AudioContextCtor: FakeAudioContext });
  service._ctx = fakeCtx;
  service._masterGain = fakeCtx.createGain();
  const engine = new MetronomeEngine({ getMeterConfig, isStrongBeat: FakeMeter.isStrongBeat });
  return { fakeCtx, service, engine };
}

// ─── Tests ───
let passCount = 0;
const tests = [];

// 1. Constructor requires required deps
tests.push(() => {
  assert.throws(() => new MetronomeScheduler({}), TypeError); // no audioContextService
  assert.throws(() => new MetronomeScheduler({ audioContextService: {}, getMeterConfig: () => true }), TypeError); // no isStrongBeat
  assert.throws(() => new MetronomeScheduler({ audioContextService: {}, isStrongBeat: () => true }), TypeError); // no getMeterConfig
  passCount++;
});

// 2. start() returns false without an AudioContext
tests.push(() => {
  const service = new AudioContextService({ AudioContextCtor: null });
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig, isStrongBeat: () => true
  });
  assert.strictEqual(sched.start({ bpm: 120, timeSignature: '4/4' }), false);
  passCount++;
});

// 3. start() returns true and sets state correctly
tests.push(() => {
  const { fakeCtx, service } = setup();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig, isStrongBeat: () => true,
    timer: makeFakeTimer().fn
  });
  assert.strictEqual(sched.start({ bpm: 120, timeSignature: '4/4', startTime: 0 }), true);
  assert.strictEqual(sched.running, true);
  assert.strictEqual(sched.getState().beatDuration, 0.5);
  assert.strictEqual(sched.getState().beatsPerMeasure, 4);
  assert.strictEqual(sched.getState().startTime, 0);
  // After start(), the first beat (t=0) is reserved and the clock advances.
  assert.strictEqual(sched.getState().nextNoteTime, 0.5);
  assert.strictEqual(sched.getState().currentBeat, 1);
  passCount++;
});

// 3b. Negative startTime is clamped to 0 (AudioParam times must be non-negative)
tests.push(() => {
  const { fakeCtx, service } = setup();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig, isStrongBeat: () => true,
    timer: makeFakeTimer().fn
  });
  // startTime = -2.1181 (playhead ahead of ctx.currentTime)
  assert.strictEqual(sched.start({ bpm: 120, timeSignature: '4/4', startTime: -2.1181 }), true);
  assert.strictEqual(sched.getState().startTime, -2.1181); // engine keeps original
  // First beat was scheduled at clamped t=0, then advanced by beatDuration.
  // All scheduled AudioParam times are non-negative (no RangeError).
  assert.strictEqual(sched.getState().nextNoteTime, 0.5);
  assert.ok(fakeCtx._oscs.length >= 1, 'first beat scheduled at t=0 without RangeError');
  passCount++;
});

// 4. Look-ahead loop reserves beats within the window (Chris Wilson pattern)
tests.push(() => {
  const { fakeCtx, service } = setup();
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig, isStrongBeat: FakeMeter.isStrongBeat,
    lookahead: 25, scheduleAheadTime: 0.1,
    timer: timer.fn
  });
  sched.start({ bpm: 120, timeSignature: '4/4', startTime: 0 });

  // currentTime = 0, scheduleAheadTime = 0.1 → beats at 0, 0.5 sit inside
  // (beatDuration = 0.5) — so 1 beat (the first) is reserved initially.
  assert.ok(fakeCtx._oscs.length >= 1, 'expected at least 1 oscillator allocated');

  // Advance fake context time and run the timer again.
  fakeCtx.currentTime = 0.2;
  timer.runNext();
  // Now nextNoteTime=0.5 < 0.2+0.1=0.3? no — 0.5 > 0.3. So only 1 beat remains scheduled.
  assert.ok(fakeCtx._oscs.length >= 1);

  // Advance further so more beats fall in the window.
  fakeCtx.currentTime = 0.5;
  timer.runNext();
  // 0.5 < 0.5+0.1 → schedule at 0.5; next 1.0 > 0.6 → stop
  assert.ok(fakeCtx._oscs.length >= 2, 'expected 2 oscillators after second tick');

  passCount++;
});

// 5. isAccent correctly detected via meter (strong beat = first beat of measure)
tests.push(() => {
  const { fakeCtx, service } = setup();
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig, isStrongBeat: FakeMeter.isStrongBeat,
    lookahead: 25, scheduleAheadTime: 0.1,
    timer: timer.fn
  });
  // 4/4 at 120 BPM: beatDuration 0.5s
  sched.start({ bpm: 120, timeSignature: '4/4', startTime: 0 });

  // Beat 0 (strong), beat 1 (weak), beat 2 (weak), beat 3 (weak)
  // At t=0: schedule 1 beat. Check the first oscillator frequency (accent → 1000)
  const firstOsc = fakeCtx._oscs[0];
  assert.strictEqual(firstOsc.frequency.value, 1000, 'first beat should be accent (1000Hz)');

  // Advance to beat 1
  fakeCtx.currentTime = 0.5;
  timer.runNext();
  const secondOsc = fakeCtx._oscs[1];
  assert.strictEqual(secondOsc.frequency.value, 600, 'second beat should be weak (600Hz)');
  passCount++;
});

// 6. MetronomeEngine is used for beat tracking when provided
tests.push(() => {
  const { fakeCtx, service, engine } = setup();
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    metronomeEngine: engine,
    getMeterConfig, isStrongBeat: FakeMeter.isStrongBeat,
    lookahead: 25, scheduleAheadTime: 0.1,
    timer: timer.fn
  });
  sched.start({ bpm: 120, timeSignature: '4/4', startTime: 0 });

  // Engine should be started
  assert.strictEqual(engine.running, true);
  // start() immediately reserves the first beat (t=0), so lastBeat = 0
  assert.strictEqual(engine.getState().lastBeat, 0);
  assert.ok(engine.getState().lastBeat >= 0, 'engine should track at least one beat');
  passCount++;
});

// 7. stop() cancels the timer, stops the engine, and calls stopAll on the service
tests.push(() => {
  const { fakeCtx, service, engine } = setup();
  const timer = makeFakeTimer();
  let stopAllCalled = false;
  const origStopAll = service.stopAll;
  service.stopAll = function () {
    stopAllCalled = true;
    if (origStopAll) origStopAll.call(this);
  };

  const sched = new MetronomeScheduler({
    audioContextService: service,
    metronomeEngine: engine,
    getMeterConfig, isStrongBeat: FakeMeter.isStrongBeat,
    lookahead: 25, scheduleAheadTime: 0.1,
    timer: timer.fn
  });
  sched.start({ bpm: 120, timeSignature: '4/4', startTime: 0 });
  sched.stop();

  assert.strictEqual(sched.running, false);
  assert.strictEqual(engine.running, false);
  assert.strictEqual(sched.getState().hasTimer, false);
  assert.strictEqual(stopAllCalled, true, 'stop() must call stopAll() on the service');
  passCount++;
});

// 8. getState() reflects scheduler state
tests.push(() => {
  const { fakeCtx, service } = setup();
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig, isStrongBeat: () => true,
    timer: timer.fn
  });
  const s0 = sched.getState();
  assert.strictEqual(s0.running, false);
  assert.strictEqual(s0.bpm, 120);
  assert.strictEqual(s0.timeSignature, '4/4');

  sched.start({ bpm: 150, timeSignature: '3/4', startTime: 0 });
  const s1 = sched.getState();
  assert.strictEqual(s1.running, true);
  assert.strictEqual(s1.bpm, 150);
  assert.strictEqual(s1.timeSignature, '3/4');
  assert.strictEqual(s1.beatDuration, 0.4); // 60/150
  assert.strictEqual(s1.beatsPerMeasure, 3);
  sched.stop();
  passCount++;
});

// 9. Invalid time signature returns false from start()
tests.push(() => {
  const { fakeCtx, service } = setup();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig, isStrongBeat: () => true,
    timer: makeFakeTimer().fn
  });
  assert.strictEqual(sched.start({ bpm: 120, timeSignature: 'BadSig' }), false);
  assert.strictEqual(sched.running, false);
  passCount++;
});

// Run tests
tests.forEach((t, i) => { t(); console.log(`✓ Test ${i + 1} passed`); });
console.log(`\n${passCount} MetronomeScheduler tests passed`);
