const assert = require('assert');
const MetronomeEngine = require('../core/MetronomeEngine.js');

function getMeterConfig(timeSignature, bpm) {
  const [numerator = 4, denominator = 4] = String(
    timeSignature || '4/4'
  ).split('/').map(Number);

  return {
    beatsPerMeasure: numerator,
    beatDuration: (60 / (bpm || 120)) * (4 / denominator)
  };
}

function isStrongBeat(beatIndex, timeSignature) {
  return beatIndex === 0;
}

const engine = new MetronomeEngine({
  getMeterConfig,
  isStrongBeat
});

assert.strictEqual(engine.nextBeat(0), null, 'stopped engine must be silent');

engine.start();

assert.deepStrictEqual(
  engine.nextBeat(0, { bpm: 120, timeSignature: '4/4' }),
  { beatIndex: 0, beatInMeasure: 0, isAccent: true }
);

assert.strictEqual(
  engine.nextBeat(0.2, { bpm: 120, timeSignature: '4/4' }),
  null,
  'same beat must not emit twice'
);

assert.deepStrictEqual(
  engine.nextBeat(0.5, { bpm: 120, timeSignature: '4/4' }),
  { beatIndex: 1, beatInMeasure: 1, isAccent: false }
);

engine.start();

assert.deepStrictEqual(
  engine.nextBeat(0.75, { bpm: 120, timeSignature: '6/8' }),
  { beatIndex: 3, beatInMeasure: 3, isAccent: false },
  '6/8 must keep only the first beat accented'
);

engine.stop();
assert.strictEqual(
  engine.nextBeat(1, { bpm: 120, timeSignature: '4/4' }),
  null
);
assert.deepStrictEqual(engine.getState(), { running: false, lastBeat: 0 });

console.log('MetronomeEngine tests passed');
