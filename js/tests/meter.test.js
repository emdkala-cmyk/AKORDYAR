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
const cfg44 = meter.getMeterConfig('4/4', 120);
const cfg68 = meter.getMeterConfig('6/8', 120);
const cfg78 = meter.getMeterConfig('7/8', 120);
const cfg98 = meter.getMeterConfig('9/8', 120);
const cfg128 = meter.getMeterConfig('12/8', 120);

assert.equal(cfg44.beatDuration, 0.5);
assert.equal(cfg68.beatDuration, 0.25);
assert.equal(cfg68.beatDuration, cfg44.beatDuration / 2);
assert.equal(cfg78.measureDuration, 1.75);
assert.equal(cfg98.measureDuration, 2.25);
assert.equal(cfg128.measureDuration, 3);
assert.equal(cfg128.unitsPerMeasure, 24);

assert.equal(meter.getGridStep(cfg68, '1/4'), 0.25);
assert.equal(meter.getGridStep(cfg68, '1/8'), 0.125);
assert.equal(meter.getGridStep(cfg68, '1/32'), 0.03125);
assert.equal(meter.snapTimeToGrid(0.094, 0.03125), 0.09375);

const boundary68 = meter.timeToBarBeat(1.5, '6/8', 120);
assert.equal(boundary68.bar, 2);
assert.equal(boundary68.beat, 1);
assert.equal(boundary68.beatDur, 0.25);
assert.equal(boundary68.barDur, 1.5);
assert.equal(boundary68.beatsPerBar, 6);
assert.equal(meter.barBeatToTime(2, 1, '6/8', 120), 1.5);
assert.equal(meter.barBeatToTime(3, 7, '7/8', 120), 5);

const longBeat = 1_000_000;
const longBeatTime = meter.beatIndexToTime(longBeat, cfg78);
assert.equal(meter.beatIndexAtTime(longBeatTime, cfg78), longBeat);
assert.equal(meter.nextBeatIndexAtOrAfter(longBeatTime, cfg78), longBeat);

assert.equal(meter.getMeterConfig('BadSig', 120).isValid, false);
assert.equal(meter.getMeterConfig(null, null).isValid, true);

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
