const assert = require('node:assert/strict');
const MidiTransportService = require('../editor/EditorMidiTransportService.js');

function createHarness({ syncActive = true, isPlaying = false } = {}) {
  const daw = { isPlaying };
  const seeks = [];
  let starts = 0;
  let pauses = 0;
  let now = 0;
  const tempos = [];
  const scheduled = [];
  const canceled = [];

  const service = MidiTransportService.create({
    getSyncActive: () => syncActive,
    getDAW: () => daw,
    seekTransport: (time, snap) => seeks.push({ time, snap }),
    startTransport: () => {
      starts += 1;
      daw.isPlaying = true;
    },
    pauseTransport: () => {
      pauses += 1;
      daw.isPlaying = false;
    },
    getNow: () => {
      now += 20;
      return now;
    },
    onTempoChange: tempo => tempos.push(tempo),
    schedule: (callback, delay) => {
      scheduled.push({ callback, delay });
      return scheduled.length;
    },
    cancel: timer => {
      if (timer !== null) canceled.push(timer);
    }
  });

  return {
    service,
    daw,
    seeks,
    get starts() { return starts; },
    get pauses() { return pauses; },
    tempos,
    scheduled,
    canceled
  };
}

const transport = createHarness({ isPlaying: false });
assert.equal(transport.service.handleMessage([0xFA]), true);
assert.deepEqual(transport.seeks, [{ time: 0, snap: false }]);
assert.equal(transport.starts, 1);

assert.equal(transport.service.handleMessage([0xFC]), true);
assert.equal(transport.pauses, 1);

transport.daw.isPlaying = false;
assert.equal(transport.service.handleMessage([0xFB]), true);
assert.equal(transport.starts, 2);

const clock = createHarness({ isPlaying: false });
for (let index = 0; index < 25; index += 1) {
  assert.equal(clock.service.handleMessage([0xF8]), true);
}
assert.deepEqual(clock.seeks, [{ time: 0, snap: false }]);
assert.equal(clock.starts, 1);
assert.equal(clock.tempos.includes(125), true);
assert.equal(clock.scheduled.at(-1).delay, 500);

clock.daw.isPlaying = true;
clock.scheduled.at(-1).callback();
assert.equal(clock.pauses, 1);
assert.equal(clock.canceled.length > 0, true);

const mtc = createHarness();
assert.equal(
  mtc.service.handleMessage([0xF0, 0x7F, 0x01, 0x01, 0x01, 1, 2, 3, 15, 0]),
  true
);
assert.deepEqual(mtc.seeks, [{ time: 3723.5, snap: false }]);

assert.equal(mtc.service.handleMessage([0xF0]), true);
assert.equal(mtc.service.handleMessage([0xF1]), true);
assert.equal(mtc.service.handleMessage([0x90, 60, 100]), false);

console.log('EditorMidiTransportService tests passed');
