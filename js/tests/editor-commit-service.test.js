const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorCommitService.js'),
  'utf8'
);
const context = { console };
vm.runInNewContext(source, context);

const song = { id: 1 };
let historyApplying = false;
let metadataOptions = null;
let saved = 0;
let rebuilt = 0;
let points = null;

const service = context.EditorCommitService.create({
  getSong: () => song,
  isHistoryApplying: () => historyApplying,
  syncMetadata: (_, options) => { metadataOptions = options; },
  getSeqPoints: () => [1, 2],
  setSeqPoints: value => { points = value; },
  saveState: () => { saved += 1; },
  rebuildSongDocument: () => { rebuilt += 1; }
});

assert.equal(service.commit(), true);
assert.deepEqual(JSON.parse(JSON.stringify(metadataOptions)), {
  includeTimeSig: false,
  includeTempo: false,
  includeGenre: false
});
assert.deepEqual(points, [1, 2]);
assert.equal(saved, 1);
assert.equal(rebuilt, 1);

historyApplying = true;
assert.equal(service.commit(), false);
assert.equal(saved, 1);

console.log('EditorCommitService tests passed');
