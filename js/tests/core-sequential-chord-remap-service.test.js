const assert = require('node:assert/strict');
const RemapService = require(
  '../app/CoreSequentialChordRemapService.js'
);

const calls = [];
const points = [
  { anchorType: 'OnCharacter', lineIndex: 0, charIndex: 1 },
  { anchorType: 'LineStart', lineIndex: 3, charIndex: 0 },
  { anchorType: 'OnCharacter', lineIndex: -1, charIndex: 0 }
];
const songState = {
  getSeqPoints: () => points,
  setSeqPoints: value => calls.push(['song', value])
};
const mapper = {
  remapAnchorToNewText(point, oldText, newText) {
    calls.push(['map', point, oldText, newText]);
    if (point.lineIndex === 3) point.lineIndex = 1;
    if (point.lineIndex === -1) point.lineIndex = -1;
  }
};
let active = false;
let runtimePoints = null;
const runtime = RemapService.create({
  getSongState: () => songState,
  getPositionMapper: () => mapper,
  getSeqModeActive: () => active,
  setRuntimeSeqPoints: value => {
    runtimePoints = value;
  }
});

runtime.remap('old', 'new');
assert.equal(calls.filter(call => call[0] === 'map').length, 3);
assert.equal(calls.at(-1)[0], 'song');
assert.deepEqual(calls.at(-1)[1].map(point => point.lineIndex), [0, 1]);
assert.equal(runtimePoints, null);

active = true;
runtime.remap('old-2', 'new-2');
assert.deepEqual(
  runtimePoints.map(point => point.lineIndex),
  [0, 1]
);
assert.equal(calls.filter(call => call[0] === 'song').length, 2);

const empty = RemapService.create({
  getSongState: () => ({
    getSeqPoints: () => [],
    setSeqPoints: () => {
      throw new Error('empty sequence must not write');
    }
  }),
  getPositionMapper: () => {
    throw new Error('empty sequence must not map');
  }
});
empty.remap('a', 'b');

console.log('CoreSequentialChordRemapService tests passed');
