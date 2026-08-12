const assert = require('node:assert/strict');
const dawState = require('../core/DAWRuntimeState.js');
const perfState = require('../core/PerformanceRuntimeState.js');

const daw = dawState.create();
assert.ok(daw.selectedIds instanceof Set);
assert.ok(daw.bufferCache instanceof Map);
assert.equal(daw.playhead, 0);

const perf = perfState.create({ clipsVersion: 4 });
assert.equal(perf.clipsVersion, 4);
assert.equal(perf.pendingRenderAll, false);

console.log('Runtime state factory tests passed');
