const assert = require('node:assert/strict');
const EditorTransportRuntimeService = require(
  '../core/EditorTransportRuntimeService.js'
);

const calls = [];
const clock = {
  setOrigin: (...args) => calls.push(['origin', args]),
  getSnapshot: (...args) => ({ args, timelineZeroAudioTime: 0 }),
  getPlayhead: (...args) => ({ args, value: 3 })
};
const audio = { setContext: () => {} };
const countIn = { start: () => {}, cancel: () => {} };
const scheduling = {
  getAudioContextService: () => audio,
  getCountInScheduler: () => countIn
};
const daw = { loopEnabled: false, loopA: 0, loopB: 10 };
const meter = () => ({ beatDuration: 0.5 });
const service = EditorTransportRuntimeService.create({
  getDAW: () => daw,
  getMeterConfig: meter,
  getLoop: () => ({
    enabled: daw.loopEnabled,
    start: daw.loopA,
    end: daw.loopB
  }),
  contextProvider: () => null,
  playheadMath: {},
  getNow: () => 100,
  clockServiceFactory: options => {
    assert.equal(options.getDAW(), daw);
    assert.equal(options.playheadMath instanceof Object, true);
    return clock;
  },
  schedulingServiceFactory: options => {
    assert.equal(options.getDAW(), daw);
    assert.equal(options.getMeterConfig, meter);
    assert.deepEqual(options.getLoop(), {
      enabled: false,
      start: 0,
      end: 10
    });
    assert.deepEqual(options.getClockSnapshot(), {
      args: [],
      timelineZeroAudioTime: 0
    });
    return scheduling;
  }
});

assert.equal(service.clockService, clock);
assert.equal(service.schedulingService, scheduling);
assert.equal(service.audioContextService, audio);
assert.equal(service.countInScheduler, countIn);
assert.deepEqual(service.getClockSnapshot('visual'), {
  args: ['visual'],
  timelineZeroAudioTime: 0
});
assert.deepEqual(service.getPlayhead(), {
  args: [],
  value: 3
});
service.setOrigin(4);
assert.deepEqual(calls, [['origin', [4]]]);

assert.throws(
  () => EditorTransportRuntimeService.create({
    getDAW: () => daw,
    getMeterConfig: meter,
    clockServiceFactory: null,
    schedulingServiceFactory: () => scheduling
  }),
  /TransportClockService/
);
assert.throws(
  () => EditorTransportRuntimeService.create({
    getDAW: () => daw,
    getMeterConfig: meter,
    clockServiceFactory: () => clock,
    schedulingServiceFactory: null
  }),
  /TransportSchedulingService/
);

console.log('EditorTransportRuntimeService tests passed');
