const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'core', 'FunctionUtils.js'),
  'utf8'
);

const frames = [];
const timers = new Map();
let nextTimerId = 1;
const sandbox = {
  window: {},
  globalThis: {},
  requestAnimationFrame(callback) {
    frames.push(callback);
  },
  setTimeout(callback) {
    const id = nextTimerId++;
    timers.set(id, callback);
    return id;
  },
  clearTimeout(id) {
    timers.delete(id);
  }
};

vm.runInNewContext(source, sandbox, { filename: 'FunctionUtils.js' });
const utils = sandbox.window.AkordyarFunctionUtils;

assert.ok(utils, 'FunctionUtils must publish its contract');
assert.equal(utils.safeText(null), '');
assert.equal(utils.safeText(42), '42');
assert.equal(utils.arrayShallowEqual([1, 2], [1, 2]), true);
assert.equal(utils.arrayShallowEqual([1, 2], [2, 1]), false);
assert.equal(utils.buildDoneKey([0, 1, 2], 2.5, 1), '0|2|');

const rafCalls = [];
const throttled = utils.rafThrottle(value => rafCalls.push(value));
throttled('first');
throttled('last');
assert.equal(frames.length, 1);
frames.shift()();
assert.deepEqual(rafCalls, ['last']);

const debounceCalls = [];
const debounced = utils.debounce(value => debounceCalls.push(value), 20);
debounced('stale');
debounced('latest');
assert.equal(timers.size, 1);
const timerCallback = [...timers.values()][0];
timerCallback();
assert.deepEqual(debounceCalls, ['latest']);

console.log('Function utils contract tests passed');
