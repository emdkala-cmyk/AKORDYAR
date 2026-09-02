/**
 * MetronomeScheduler tests — look-ahead scheduling (Chris Wilson pattern).
 *
 * Uses a FakeAudioContext so the scheduler can run in Node without a browser.
 */
const assert = require('assert');
const AudioContextService = require('../core/AudioContextService.js');
const MetronomeScheduler = require('../core/MetronomeScheduler.js');
const MetronomeEngine = require('../core/MetronomeEngine.js');
const Meter = require('../core/Meter.js');

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
      start(time) { this.startedAt = time; }, stop() {}
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
  return Meter.getMeterConfig(timeSignature, bpm);
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
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig, isStrongBeat: () => true,
    timer: timer.fn
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

// 3b. Starting mid-timeline skips historical beats and preserves grid phase.
tests.push(() => {
  const { fakeCtx, service } = setup();
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig, isStrongBeat: () => true,
    timer: timer.fn
  });
  // startTime = -2.1181 means the playhead is around 2.1181s.
  assert.strictEqual(sched.start({ bpm: 120, timeSignature: '4/4', startTime: -2.1181 }), true);
  assert.strictEqual(sched.getState().startTime, -2.1181); // engine keeps original
  // The next grid beat is timeline 2.5s, i.e. context time 0.3819s.
  assert.ok(Math.abs(sched.getState().nextNoteTime - 0.3819) < 0.0001);
  assert.strictEqual(fakeCtx._oscs.length, 0, 'historical beats must not play immediately');
  fakeCtx.currentTime = 0.3;
  timer.runNext();
  assert.ok(fakeCtx._oscs.length >= 1, 'next grid beat should be scheduled in look-ahead');
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

// 3c. x/8 seek alignment uses eighth-note beats and the shared meter phase.
tests.push(() => {
  const { fakeCtx, service } = setup();
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig,
    isStrongBeat: FakeMeter.isStrongBeat,
    timer: timer.fn
  });

  // 7/8 @ 120 BPM => 0.25 s per beat. At timeline 2.1181,
  // the next shared grid point is 2.25, or context time 0.1319.
  sched.start({
    bpm: 120,
    timeSignature: '7/8',
    startTime: -2.1181
  });
  assert.strictEqual(sched.getState().beatDuration, 0.25);
  assert.ok(Math.abs(sched.getState().nextNoteTime - 0.1319) < 1e-9);
  fakeCtx.currentTime = 0.05;
  timer.runNext();
  assert.equal(fakeCtx._oscs.length, 1);
  assert.ok(Math.abs(fakeCtx._oscs[0].startedAt - 0.1319) < 1e-9);
  passCount++;
});

// 4b. A delayed UI timer skips missed beats instead of emitting a late burst.
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
  const scheduledBeforeStall = fakeCtx._oscs.length;

  // Simulate a zoom/layout stall that blocks the scheduler past two beats.
  fakeCtx.currentTime = 1.25;
  timer.runNext();

  assert.strictEqual(fakeCtx._oscs.length, scheduledBeforeStall, 'missed beats must not burst late');
  assert.ok(sched.getState().nextNoteTime > fakeCtx.currentTime, 'scheduler must resume on a future beat');
  passCount++;
});

// 4c. Beat times are derived from integer indices, so no drift accumulates.
tests.push(() => {
  const { service } = setup();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig,
    isStrongBeat: FakeMeter.isStrongBeat,
    timer: makeFakeTimer().fn
  });
  sched.start({ bpm: 137, timeSignature: '9/8', startTime: 0.123456789 });
  sched._currentBeat = 1_000_000;
  sched._advanceBeat();
  assert.equal(
    sched.getState().nextNoteTime,
    0.123456789 + 1_000_001 * sched.getState().beatDuration
  );
  passCount++;
});

// 4d. A look-ahead window may cross a loop boundary without duplicating or
// skipping the grid phase.
tests.push(() => {
  const { fakeCtx, service } = setup();
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig,
    isStrongBeat: FakeMeter.isStrongBeat,
    getLoop: () => ({ enabled: true, start: 1, end: 2 }),
    scheduleAheadTime: 1.5,
    timer: timer.fn
  });

  sched.start({ bpm: 120, timeSignature: '4/4', startTime: 0 });
  assert.deepEqual(
    fakeCtx._oscs.map(osc => osc.startedAt),
    [0, 0.5, 1]
  );

  fakeCtx.currentTime = 1.9;
  timer.runNext();
  assert.ok(
    fakeCtx._oscs.some(osc => Math.abs(osc.startedAt - 2) < 1e-9),
    'the first beat at loop start must be scheduled at the exact loop boundary'
  );
  assert.ok(
    fakeCtx._oscs.every(osc => osc.startedAt < 3 + 1e-9),
    'scheduler must not schedule beyond the next loop cycle'
  );
  assert.ok(
    fakeCtx._oscs.every(osc => osc.startedAt < 1.9 || osc.startedAt >= 2 - 1e-9),
    'loop remapping must never re-schedule historical context times'
  );
  assert.deepEqual(
    fakeCtx._oscs.map(osc => Number(osc.startedAt.toFixed(9))),
    [0, 0.5, 1, 2, 2.5, 3],
    'loop beats must remain on the same absolute AudioContext grid'
  );
  passCount++;
});

// 4e. Count-in can reserve the first playback beat in the future while
// preserving the requested timeline position.
tests.push(() => {
  const { fakeCtx, service } = setup();
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig,
    isStrongBeat: FakeMeter.isStrongBeat,
    scheduleAheadTime: 0.1,
    timer: timer.fn
  });
  sched.start({
    bpm: 120,
    timeSignature: '4/4',
    startTime: 0,
    playheadPosition: 2,
    transportStartTime: 2
  });
  assert.equal(sched.getState().nextNoteTime, 2);
  assert.equal(fakeCtx._oscs.length, 0);
  fakeCtx.currentTime = 1.95;
  timer.runNext();
  assert.equal(fakeCtx._oscs[0].startedAt, 2);
  passCount++;
});

// 4f. A future transport start also remains future when the requested
// playhead is already beyond the loop end.
tests.push(() => {
  const { fakeCtx, service } = setup();
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig,
    isStrongBeat: FakeMeter.isStrongBeat,
    getLoop: () => ({ enabled: true, start: 1, end: 2 }),
    scheduleAheadTime: 0.1,
    timer: timer.fn
  });
  sched.start({
    bpm: 120,
    timeSignature: '4/4',
    startTime: 0,
    playheadPosition: 2.5,
    transportStartTime: 2
  });
  assert.equal(sched.getState().nextNoteTime, 2);
  assert.equal(fakeCtx._oscs.length, 0);
  fakeCtx.currentTime = 1.95;
  timer.runNext();
  assert.equal(fakeCtx._oscs[0].startedAt, 2);
  passCount++;
});

// 4g. Restarting after a tempo change keeps the first future click on the
// recalculated grid instead of inheriting the previous beat duration.
tests.push(() => {
  const { fakeCtx, service } = setup();
  const timer = makeFakeTimer();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig,
    isStrongBeat: FakeMeter.isStrongBeat,
    scheduleAheadTime: 0.1,
    timer: timer.fn
  });

  fakeCtx.currentTime = 9.91;
  sched.start({
    bpm: 120,
    timeSignature: '4/4',
    startTime: 8,
    playheadPosition: 2,
    transportStartTime: 10
  });
  const firstRunCount = fakeCtx._oscs.length;
  assert.equal(fakeCtx._oscs[firstRunCount - 1].startedAt, 10);

  sched.stop();
  fakeCtx.currentTime = 9.91;
  sched.start({
    bpm: 150,
    timeSignature: '4/4',
    startTime: 8,
    playheadPosition: 2,
    transportStartTime: 10
  });
  const secondRunStart = fakeCtx._oscs.length - 1;
  assert.equal(fakeCtx._oscs[secondRunStart].startedAt, 10);
  assert.equal(sched.getState().beatDuration, 0.4);
  assert.equal(sched.getState().nextNoteTime, 10.4);
  passCount++;
});

// 4h. A stale UI playhead must never change the phase established by the
// shared AudioContext origin. This is the regression for the one-subdivision
// early clicks seen after the first downbeat.
tests.push(() => {
  const { fakeCtx, service } = setup();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig,
    isStrongBeat: FakeMeter.isStrongBeat,
    scheduleAheadTime: 10,
    timer: makeFakeTimer().fn
  });

  fakeCtx.currentTime = 10;
  sched.start({
    bpm: 50,
    timeSignature: '4/4',
    startTime: 8,
    playheadPosition: 4.5,
    transportStartTime: 12
  });

  assert.deepEqual(
    fakeCtx._oscs.slice(0, 4).map(osc => Number(osc.startedAt.toFixed(9))),
    [12.8, 14, 15.2, 16.4],
    '4/4 clicks must use timelineZeroAudioTime, not a stale playhead'
  );
  passCount++;
});

// 4i. The same canonical-origin rule must hold for 6/8 and for the shorter
// eighth-note beat duration used by that meter.
tests.push(() => {
  const { fakeCtx, service } = setup();
  const sched = new MetronomeScheduler({
    audioContextService: service,
    getMeterConfig,
    isStrongBeat: FakeMeter.isStrongBeat,
    scheduleAheadTime: 10,
    timer: makeFakeTimer().fn
  });

  fakeCtx.currentTime = 10;
  sched.start({
    bpm: 50,
    timeSignature: '6/8',
    startTime: 8,
    playheadPosition: 2.2,
    transportStartTime: 10
  });

  assert.deepEqual(
    fakeCtx._oscs.slice(0, 4).map(osc => Number(osc.startedAt.toFixed(9))),
    [10.4, 11, 11.6, 12.2],
    '6/8 clicks must remain on the eighth-note grid'
  );
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
