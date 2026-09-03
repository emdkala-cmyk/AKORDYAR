const assert = require('node:assert/strict');
const TempoMap = require('../core/TempoMap.js');

function assertNear(actual, expected, tolerance = 1e-9, message = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected}, received ${actual}`
  );
}

const base = TempoMap.create({
  tempo: 120,
  timeSignature: '4/4'
});

const tempoChanged = base.changeAt(2, { tempo: 150 });
const tempoGrid = tempoChanged.getGridPoints(0, 4);
assert.deepEqual(
  tempoGrid.beats.map(point => Number(point.time.toFixed(9))),
  [0, 0.5, 1, 1.5, 2, 2.4, 2.8, 3.2, 3.6, 4],
  'tempo changes must keep every beat on the canonical timeline'
);
const tempoBoundary = tempoGrid.beats.find(point => Math.abs(point.time - 2) < 1e-9);
assert.equal(tempoBoundary.tempo, 150);
assert.equal(tempoBoundary.bar, 2);
assert.equal(tempoBoundary.beatInMeasure, 0);

const signatureChanged = base.changeAt(2, { timeSignature: '6/8' });
const signatureGrid = signatureChanged.getGridPoints(0, 4);
const signatureBoundary = signatureGrid.beats.find(
  point => Math.abs(point.time - 2) < 1e-9
);
assert.equal(signatureBoundary.timeSignature, '6/8');
assert.equal(signatureBoundary.bar, 2);
assert.equal(signatureBoundary.beatInMeasure, 0);
assert.equal(
  signatureGrid.beats.filter(point => Math.abs(point.time - 2) < 1e-9).length,
  1,
  'a segment boundary must produce one canonical grid point'
);
assert.deepEqual(
  signatureGrid.beats
    .filter(point => point.time >= 2 && point.time < 3.5)
    .map(point => Number(point.time.toFixed(9))),
  [2, 2.25, 2.5, 2.75, 3, 3.25],
  '6/8 must use eighth-note beat spacing after the meter change'
);

for (const point of tempoGrid.beats) {
  assertNear(
    tempoChanged.beatToTimeline(point.quarter),
    point.time,
    1e-9,
    'beat/timeline conversion must round-trip'
  );
}

assert.equal(
  tempoChanged.getBeatAtOrAfter(2).tempo,
  150,
  'the boundary lookup must use the new segment'
);
assert.equal(
  tempoChanged.getBeatAtOrAfter(2).bar,
  2,
  'the boundary lookup must retain the correct bar number'
);

console.log('TempoMap tests passed');
