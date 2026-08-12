const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'core', 'Meter.js'),
  'utf8'
);
const context = { window: {} };
vm.runInNewContext(source, context);

const meter = context.window.Meter;
assert.equal(meter.isStrongBeat(0, '6/8'), true);
for (const beat of [1, 2, 3, 4, 5]) {
  assert.equal(
    meter.isStrongBeat(beat, '6/8'),
    false,
    `6/8 beat ${beat + 1} must be unaccented`
  );
}
assert.equal(
  meter.isStrongBeat(3, '9/8'),
  true,
  '9/8 keeps its existing secondary accent behavior'
);

console.log('Meter tests passed');
