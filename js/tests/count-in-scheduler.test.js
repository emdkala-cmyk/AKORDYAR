const assert = require('node:assert/strict');
const CountInScheduler = require('../core/CountInScheduler.js');
const TempoMap = require('../core/TempoMap.js');

function meterConfig(timeSignature, bpm) {
  const [numerator, denominator] = String(timeSignature).split('/').map(Number);
  if (!(numerator > 0) || !(denominator > 0) || !(bpm > 0)) {
    return { isValid: false };
  }
  const beatDuration = 60 / bpm * (4 / denominator);
  return {
    isValid: true,
    beatsPerMeasure: numerator,
    beatDuration
  };
}

function createFakeTimer() {
  const calls = [];
  return {
    calls,
    set: (callback, ms) => {
      const id = { callback, ms, cancelled: false };
      calls.push(id);
      return id;
    },
    clear: id => {
      if (id) id.cancelled = true;
    },
    runNext: () => {
      const next = calls.shift();
      if (next && !next.cancelled) next.callback();
      return next;
    }
  };
}

function createFakeAudioService() {
  const clicks = [];
  let stopAllCalls = 0;
  const context = { currentTime: 10 };
  return {
    clicks,
    context,
    get stopAllCalls() { return stopAllCalls; },
    getContext: () => context,
    playClickAt: (accent, soundType, when) => {
      clicks.push({ accent, soundType, when });
      return true;
    },
    stopAll: () => { stopAllCalls += 1; }
  };
}

// A two-bar 4/4 count-in schedules every click on the shared audio clock and
// does not complete until its finite duration has elapsed.
{
  const timer = createFakeTimer();
  const audio = createFakeAudioService();
  let completed = null;
  const scheduler = new CountInScheduler({
    audioContextService: audio,
    getMeterConfig: meterConfig,
    isStrongBeat: beat => beat === 0,
    timer: timer.set,
    clearTimer: timer.clear,
    leadTime: 0.08
  });

  const result = scheduler.start({
    bars: 2,
    bpm: 120,
    timeSignature: '4/4',
    soundType: 'beep',
    onComplete: value => { completed = value; }
  });

  assert.equal(result.running, true);
  assert.equal(result.totalBeats, 8);
  assert.equal(result.beatDuration, 0.5);
  assert.equal(result.startTime, 10.08);
  assert.equal(result.endTime, 14.08);
  assert.equal(timer.calls.length, 1);
  assert.equal(timer.calls[0].ms, 4080);
  assert.equal(audio.clicks.length, 8);
  assert.equal(audio.clicks[0].when, 10.08);
  assert.equal(audio.clicks[7].when, 13.58);
  assert.equal(audio.clicks[0].accent, true);
  assert.equal(audio.clicks[1].accent, false);
  assert.equal(audio.clicks[4].accent, true);
  assert.equal(completed, null);

  timer.runNext();
  assert.equal(completed.running, false);
  assert.equal(completed.endTime, 14.08);
  assert.equal(scheduler.getState().running, false);
  assert.equal(audio.stopAllCalls, 1);
}

// Cancelling a count-in clears its completion callback and stops pending
// metronome nodes so pressing play again cannot trigger a stale start.
{
  const timer = createFakeTimer();
  const audio = createFakeAudioService();
  let completed = false;
  const scheduler = new CountInScheduler({
    audioContextService: audio,
    getMeterConfig: meterConfig,
    isStrongBeat: () => false,
    timer: timer.set,
    clearTimer: timer.clear
  });

  scheduler.start({
    bars: 1,
    bpm: 120,
    timeSignature: '3/4',
    onComplete: () => { completed = true; }
  });
  assert.equal(scheduler.cancel(), true);
  assert.equal(scheduler.getState().running, false);
  assert.equal(timer.calls[0].cancelled, true);
  assert.equal(audio.stopAllCalls, 1);
  timer.runNext();
  assert.equal(completed, false);
}

// If the audio service cannot schedule all clicks, no delayed transport
// completion is created.
{
  const timer = createFakeTimer();
  const audio = createFakeAudioService();
  audio.playClickAt = () => false;
  const scheduler = new CountInScheduler({
    audioContextService: audio,
    getMeterConfig: meterConfig,
    isStrongBeat: () => true,
    timer: timer.set,
    clearTimer: timer.clear
  });

  assert.equal(scheduler.start({ bars: 1, bpm: 120, timeSignature: '4/4' }), null);
  assert.equal(timer.calls.length, 0);
  assert.equal(audio.stopAllCalls, 1);
}

// The shared TempoMap supplies the effective meter and tempo at the
// requested timeline position. Accents must use that effective signature,
// not a stale caller-side signature.
{
  const timer = createFakeTimer();
  const audio = createFakeAudioService();
  const tempoMap = TempoMap.create({
    tempo: 120,
    timeSignature: '4/4'
  }).changeAt(0, {
    tempo: 150,
    timeSignature: '9/8'
  });
  const scheduler = new CountInScheduler({
    audioContextService: audio,
    getMeterConfig: meterConfig,
    isStrongBeat: (beat, signature) =>
      require('../core/Meter.js').isStrongBeat(beat, signature),
    timer: timer.set,
    clearTimer: timer.clear
  });

  const result = scheduler.start({
    bars: 1,
    bpm: 120,
    timeSignature: '4/4',
    tempoMap,
    timelinePosition: 0
  });

  assert.equal(result.totalBeats, 9);
  assert.equal(result.beatDuration, 0.2);
  assert.deepEqual(
    audio.clicks.map(click => click.accent),
    [true, false, false, true, false, false, true, false, false]
  );
  assert.deepEqual(
    audio.clicks.map(click => Number(click.when.toFixed(9))),
    [10.08, 10.28, 10.48, 10.68, 10.88, 11.08, 11.28, 11.48, 11.68]
  );
}

console.log('CountInScheduler tests passed');
