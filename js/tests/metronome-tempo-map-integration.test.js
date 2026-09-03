const assert = require('node:assert/strict');
const CountInScheduler = require('../core/CountInScheduler.js');
const Meter = require('../core/Meter.js');
const MetronomeScheduler = require('../core/MetronomeScheduler.js');
const TempoMap = require('../core/TempoMap.js');

function assertNear(actual, expected, tolerance = 0.001, message = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected}, received ${actual}`
  );
}

function createSchedulerHarness({
  now = 0,
  scheduleAheadTime = 1.5,
  loop = null
} = {}) {
  const context = { currentTime: now };
  const records = [];
  const active = [];
  const timers = [];
  const audioContextService = {
    getContext: () => context,
    playClickAt: (isAccent, soundType, when) => {
      const record = {
        isAccent,
        soundType,
        when,
        cancelled: false
      };
      records.push(record);
      active.push(record);
      return true;
    },
    stopAll: () => {
      active.forEach(record => {
        record.cancelled = true;
      });
      active.length = 0;
    }
  };
  const scheduler = new MetronomeScheduler({
    audioContextService,
    getMeterConfig: (timeSignature, bpm) =>
      Meter.getMeterConfig(timeSignature, bpm),
    isStrongBeat: (beatInMeasure, timeSignature) =>
      Meter.isStrongBeat(beatInMeasure, timeSignature),
    getLoop: () => loop,
    scheduleAheadTime,
    timer: (callback, ms) => {
      const timer = { callback, ms, cancelled: false };
      timers.push(timer);
      return timer;
    },
    clearTimer: timer => {
      if (timer) timer.cancelled = true;
    }
  });

  return {
    context,
    records,
    active,
    timers,
    scheduler,
    runNextTimer() {
      const timer = timers.shift();
      if (timer && !timer.cancelled) timer.callback();
      return timer;
    }
  };
}

function activeTimes(harness) {
  return harness.active
    .filter(record => !record.cancelled)
    .map(record => record.when);
}

// 1. Starting from a non-grid position uses the shared map, not the stale
// playhead snapshot, and stays within one millisecond of the grid.
{
  const map = TempoMap.create({ tempo: 120, timeSignature: '4/4' });
  const harness = createSchedulerHarness({
    now: 10,
    scheduleAheadTime: 1
  });
  const started = harness.scheduler.start({
    bpm: 120,
    timeSignature: '4/4',
    startTime: 7.8819,
    playheadPosition: 2.1181,
    transportStartTime: 10,
    tempoMap: map
  });
  assert.equal(started, true);
  const firstGrid = map.getBeatAtOrAfter(2.1181);
  assertNear(
    activeTimes(harness)[0],
    7.8819 + firstGrid.time,
    0.001,
    '4/4 start from the middle must land on the next grid beat'
  );
}

// 2. 6/8 uses eighth-note beat spacing and the same canonical origin.
{
  const map = TempoMap.create({ tempo: 120, timeSignature: '6/8' });
  const harness = createSchedulerHarness({
    now: 10,
    scheduleAheadTime: 1
  });
  assert.equal(
    harness.scheduler.start({
      bpm: 120,
      timeSignature: '6/8',
      startTime: 7.8,
      playheadPosition: 2.2,
      transportStartTime: 10,
      tempoMap: map
    }),
    true
  );
  assert.deepEqual(
    activeTimes(harness).map(time => Number(time.toFixed(9))),
    [10.05, 10.3, 10.55, 10.8],
    '6/8 clicks must follow the eighth-note grid'
  );
  assert.equal(harness.active[3].isAccent, true);
}

// 3. A tempo change is piecewise and does not accumulate drift.
{
  const map = TempoMap.create({ tempo: 120, timeSignature: '4/4' })
    .changeAt(2, { tempo: 150 });
  const harness = createSchedulerHarness({
    scheduleAheadTime: 5
  });
  assert.equal(
    harness.scheduler.start({
      bpm: 120,
      timeSignature: '4/4',
      startTime: 0,
      tempoMap: map
    }),
    true
  );
  const expected = map.getGridPoints(0, 4).beats.map(point => point.time);
  const actual = activeTimes(harness).slice(0, expected.length);
  assert.equal(actual.length, expected.length);
  actual.forEach((time, index) => {
    assertNear(
      time,
      expected[index],
      0.001,
      `tempo-map click ${index} must not drift`
    );
  });
}

// 4. Updating tempo while running cancels only the old reservations and
// keeps the next future beat on the new map without a duplicate active click.
{
  const oldMap = TempoMap.create({ tempo: 120, timeSignature: '4/4' });
  const newMap = oldMap.changeAt(2, { tempo: 150 });
  const harness = createSchedulerHarness({
    scheduleAheadTime: 1
  });
  harness.scheduler.start({
    bpm: 120,
    timeSignature: '4/4',
    startTime: 0,
    tempoMap: oldMap
  });
  harness.context.currentTime = 1.9;
  assert.equal(
    harness.scheduler.updateTiming({
      bpm: 150,
      timeSignature: '4/4',
      tempoMap: newMap
    }),
    true
  );
  assert.deepEqual(
    activeTimes(harness).map(time => Number(time.toFixed(9))),
    [2, 2.4, 2.8],
    'tempo update must preserve the boundary beat and schedule future beats'
  );
  assert.equal(
    activeTimes(harness).filter(time => Math.abs(time - 2) < 1e-9).length,
    1
  );
  assert.equal(
    harness.records.filter(record => record.cancelled).length,
    2,
    'old reservations must be cancelled before the new map is scheduled'
  );
}

// 5. Pause/resume re-anchors the same timeline position without changing
// musical phase.
{
  const map = TempoMap.create({ tempo: 120, timeSignature: '4/4' });
  const harness = createSchedulerHarness({ scheduleAheadTime: 0.1 });
  harness.scheduler.start({
    bpm: 120,
    timeSignature: '4/4',
    startTime: 0,
    tempoMap: map
  });
  harness.context.currentTime = 1.1;
  harness.scheduler.stop();
  harness.context.currentTime = 2;
  assert.equal(
    harness.scheduler.start({
      bpm: 120,
      timeSignature: '4/4',
      startTime: 0.9,
      playheadPosition: 1.1,
      transportStartTime: 2,
      tempoMap: map
    }),
    true
  );
  assertNear(
    harness.scheduler.getState().nextNoteTime,
    2.4,
    0.001,
    'resume must continue from the next 4/4 grid beat'
  );
  harness.context.currentTime = 2.31;
  harness.runNextTimer();
  assertNear(activeTimes(harness)[0], 2.4, 0.001);
}

// 6. Count-in and playback share one AudioContext boundary.
{
  const countInContext = { currentTime: 10 };
  const countInClicks = [];
  const countInTimers = [];
  const countInAudio = {
    getContext: () => countInContext,
    playClickAt: (isAccent, soundType, when) => {
      countInClicks.push({ isAccent, soundType, when });
      return true;
    },
    stopAll() {}
  };
  const countIn = new CountInScheduler({
    audioContextService: countInAudio,
    getMeterConfig: (timeSignature, bpm) =>
      Meter.getMeterConfig(timeSignature, bpm),
    isStrongBeat: (beatInMeasure, timeSignature) =>
      Meter.isStrongBeat(beatInMeasure, timeSignature),
    leadTime: 0.08,
    timer: (callback, ms) => {
      countInTimers.push({ callback, ms });
      return countInTimers.length;
    },
    clearTimer() {}
  });
  const result = countIn.start({
    bars: 1,
    bpm: 120,
    timeSignature: '6/8',
    soundType: 'classic'
  });
  assert.equal(result.totalBeats, 6);
  assertNear(result.endTime, 11.58, 0.001);
  assert.deepEqual(
    countInClicks.map(click => Number(click.when.toFixed(9))),
    [10.08, 10.33, 10.58, 10.83, 11.08, 11.33]
  );
  assert.equal(countInClicks[0].isAccent, true);
  assert.equal(countInClicks[1].isAccent, false);
}

// 7. A normal loop schedules the first click of the next cycle exactly at
// the AudioContext loop boundary and never duplicates that boundary.
{
  const harness = createSchedulerHarness({
    scheduleAheadTime: 1.5,
    loop: { enabled: true, start: 1, end: 2 }
  });
  harness.scheduler.start({
    bpm: 120,
    timeSignature: '4/4',
    startTime: 0
  });
  harness.context.currentTime = 1.9;
  harness.runNextTimer();
  const times = activeTimes(harness).map(time => Number(time.toFixed(9)));
  assert.deepEqual(times, [0, 0.5, 1, 2, 2.5, 3]);
  assert.equal(times.filter(time => time === 2).length, 1);
}

// 8. A pathological sub-beat loop is throttled across timer ticks instead
// of causing an unbounded look-ahead loop.
{
  const harness = createSchedulerHarness({
    scheduleAheadTime: 1.5,
    loop: { enabled: true, start: 1, end: 1.01 }
  });
  const startedAt = Date.now();
  assert.equal(
    harness.scheduler.start({
      bpm: 120,
      timeSignature: '4/4',
      startTime: 0
    }),
    true
  );
  const initialElapsed = Date.now() - startedAt;
  assert.ok(initialElapsed < 100, 'short loop scheduling must remain bounded');
  assert.ok(
    harness.records.length <= 68,
    'one look-ahead tick must not reserve hundreds of short-loop clicks'
  );
}

console.log('Metronome TempoMap integration tests passed');
