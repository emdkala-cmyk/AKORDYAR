const assert = require('node:assert/strict');
const Engine = require('../core/HitpointAnalysisEngine.js');

function makeBuffer(sampleRate, seconds, bursts) {
  const data = new Float32Array(Math.round(sampleRate * seconds));
  for (let index = 0; index < data.length; index += 1) {
    data[index] = 0.02 * Math.sin(
      (2 * Math.PI * 30 * index) / sampleRate
    );
  }
  bursts.forEach(time => {
    const start = Math.round(time * sampleRate);
    for (let offset = 0; offset < 18; offset += 1) {
      data[start + offset] += 1 - offset / 18;
    }
  });
  return {
    sampleRate,
    length: data.length,
    numberOfChannels: 1,
    getChannelData: () => data
  };
}

{
  const result = Engine.calculateHitpoints(
    makeBuffer(1000, 2.2, [0.4, 1.2, 1.8]),
    {
      windowSize: 64,
      hopSize: 16,
      threshold: 0.15,
      intensity: 0.02,
      minimumLength: 0.1
    }
  );
  assert.equal(result.ok, true, 'analysis succeeds');
  assert.equal(result.hitpoints.length, 3, 'three transients remain');
  assert.ok(
    result.hitpoints.every((hitpoint, index) =>
      Math.abs(hitpoint.sourceTime - [0.4, 1.2, 1.8][index]) < 0.06
    ),
    'transients map to source times'
  );
  assert.ok(
    result.hitpoints.every(hitpoint =>
      Number.isInteger(hitpoint.sourceSample)
    ),
    'source sample coordinates are integers'
  );
}

{
  const filtered = Engine.filterHitpoints(
    [
      { id: 'a', sourceSample: 100, strength: 0.8, energy: 0.7 },
      { id: 'b', sourceSample: 130, strength: 0.9, energy: 0.8 },
      { id: 'c', sourceSample: 300, strength: 0.7, energy: 0.7 }
    ],
    {
      threshold: 0.5,
      intensity: 0.5,
      minimumLength: 0.1,
      sampleRate: 1000
    }
  );
  assert.equal(filtered.length, 2, 'minimum length removes close hit');
  assert.equal(filtered[0].id, 'b', 'stronger close hit is retained');
  assert.equal(filtered[1].id, 'c', 'distant hit remains');
}

console.log('hitpoint-analysis-engine.test.js — all assertions passed.');
