const assert = require('node:assert/strict');
const CorePublicApi = require('../core/CorePublicApi.js');

const target = {};
const api = CorePublicApi.create({
  target,
  namespace: 'TestCoreApi'
});

const startTransport = () => 'started';
const pauseTransport = () => 'paused';

const firstSnapshot = api.publish({
  startTransport,
  pauseTransport
});

assert.equal(target.startTransport, startTransport);
assert.equal(target.pauseTransport, pauseTransport);
assert.equal(target.TestCoreApi.startTransport, startTransport);
assert.equal(api.get('startTransport'), startTransport);
assert.equal(api.has('pauseTransport'), true);
assert.equal(api.has('missing'), false);
assert.equal(firstSnapshot.startTransport, startTransport);
assert.equal(Object.isFrozen(firstSnapshot), true);

const stopTransport = () => 'stopped';
api.publish({ stopTransport });
assert.equal(target.TestCoreApi.stopTransport, stopTransport);
assert.equal(api.snapshot().pauseTransport, pauseTransport);
assert.equal(api.snapshot().stopTransport, stopTransport);

assert.throws(
  () => api.publish({ invalid: true }),
  TypeError
);
assert.throws(
  () => CorePublicApi.create({ target: null }),
  TypeError
);

console.log('Core public API tests passed');
