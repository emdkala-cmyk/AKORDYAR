const assert = require('node:assert/strict');
const Adapter = require('../core/PerformanceRuntimeAdapter.js');

const state = { count: 1 };
const runtime = Adapter.create(state);
assert.equal(runtime.getState(), state);
assert.equal(runtime.read('count'), 1);
assert.equal(runtime.write('count', 2), 2);
runtime.update({ active: true });
assert.deepEqual(state, { count: 2, active: true });
runtime.reset();
assert.deepEqual(state, {});

console.log('PerformanceRuntimeAdapter tests passed');
