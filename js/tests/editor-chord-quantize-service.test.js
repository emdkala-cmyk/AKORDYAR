const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorChordQuantizeService.js'),
  'utf8'
);

const context = {};
vm.runInNewContext(source, context);
const service = context.EditorChordQuantizeService;
const config = {
  beatDuration: 0.25,
  measureDuration: 1.5
};

assert.equal(service.gridStepForPreset(config, '1/4'), 0.25);
assert.equal(service.gridStepForPreset(config, '1/2'), 0.75);
assert.equal(service.gridStepForPreset(config, 'triplet'), 0.25 / 3);

const clips = [
  { id: 'chord-1', type: 'chord', start: 0.37 },
  { id: 'audio-1', type: 'audio', start: 0.37 },
  { id: 'chord-2', type: 'chord', start: 0.75 }
];

const result = service.quantizeSelectedChords(
  clips,
  new Set(['chord-1', 'audio-1', 'chord-2']),
  service.gridStepForPreset(config, '1/4')
);

assert.equal(result.changed, true);
assert.equal(result.count, 1);
assert.equal(result.selectedCount, 2);
assert.equal(clips[0].start, 0.25);
assert.equal(clips[1].start, 0.37);
assert.equal(clips[2].start, 0.75);

console.log('EditorChordQuantizeService tests passed');
