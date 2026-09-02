const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const meterSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'core', 'Meter.js'),
  'utf8'
);
const gridSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'core', 'TimelineGrid.js'),
  'utf8'
);

const strokes = [];
const context2d = {
  clearRect() {},
  beginPath() { this._segments = []; },
  moveTo(x, y) {
    this._segments.push({ from: { x, y }, to: null });
  },
  lineTo(x, y) {
    const segment = this._segments[this._segments.length - 1];
    if (segment) segment.to = { x, y };
  },
  stroke() {
    strokes.push(...(this._segments || []));
  }
};

function element(tagName) {
  return {
    tagName,
    style: {},
    children: [],
    innerHTML: '',
    appendChild(child) { this.children.push(child); },
    querySelectorAll() { return []; },
    remove() {},
    getContext() { return context2d; }
  };
}

const documentRef = {
  createElement: tagName => element(tagName),
  documentElement: {}
};
const context = {
  window: {},
  document: documentRef,
  console,
  getComputedStyle: () => ({ getPropertyValue: () => '64' })
};
vm.runInNewContext(meterSource, context);
vm.runInNewContext(gridSource, context);

const grid = context.window.TimelineGrid || context.TimelineGrid;
assert.ok(grid);

const compactSpec = grid.getAdaptiveGridSpec({
  timeSignature: '4/4',
  bpm: 120,
  pxPerSec: 1
});
const mediumSpec = grid.getAdaptiveGridSpec({
  timeSignature: '4/4',
  bpm: 120,
  pxPerSec: 20
});
const detailedSpec = grid.getAdaptiveGridSpec({
  timeSignature: '4/4',
  bpm: 120,
  pxPerSec: 120
});
const closeSpec = grid.getAdaptiveGridSpec({
  timeSignature: '4/4',
  bpm: 120,
  pxPerSec: 260
});
assert.equal(compactSpec.majorBarStep, 32);
assert.equal(compactSpec.barGridStep, 32);
assert.equal(mediumSpec.majorBarStep, 2);
assert.equal(mediumSpec.showBeats, false);
assert.equal(mediumSpec.showSubdivisions, false);
assert.equal(detailedSpec.showSubdivisions, true);
assert.equal(closeSpec.showBeatLabels, true);
assert.ok(
  compactSpec.majorBarStep >= mediumSpec.majorBarStep,
  'adaptive ruler must show fewer major labels when zoomed out'
);

for (const signature of ['6/8', '7/8', '9/8', '12/8']) {
  const structure = grid.getGridStructure({
    timeSignature: signature,
    bpm: 120,
    durationInSeconds: 6
  });
  assert.equal(structure.config.denominator, 8);
  assert.equal(structure.config.beatDuration, 0.25);
  structure.beats.forEach((beat, index) => {
    assert.equal(beat.time, index * 0.25);
  });
}

const ruler = element('div');
const labels = element('div');
const inner = element('div');
const lanes = element('div');
grid.renderRuler({
  total: 1.5,
  timeToX: time => time * 100,
  tempo: 120,
  timeSignature: '6/8',
  pxPerSec: 100,
  rulerEl: ruler,
  labelsEl: labels,
  tlInnerEl: inner,
  lanesEl: lanes
});

const subBeatXs = strokes
  .filter(stroke => stroke.from?.y === 28)
  .map(stroke => stroke.from.x)
  .filter(x => x < 150);
assert.deepEqual(
  subBeatXs,
  [13.5, 38.5, 63.5, 88.5, 113.5, 138.5],
  '6/8 ruler must render the eighth-note sub-grid inside every beat'
);
assert.equal(
  ruler.children[0].style.cssText.includes('width:150px'),
  true,
  'ruler canvas must keep the same capped pixel width as lane grids'
);

strokes.length = 0;
grid.renderRuler({
  total: 2,
  timeToX: time => time * 260,
  tempo: 120,
  timeSignature: '4/4',
  pxPerSec: 260,
  detail: false,
  rulerEl: element('div'),
  labelsEl: element('div'),
  tlInnerEl: element('div'),
  lanesEl: element('div')
});
assert.equal(
  strokes.some(stroke => stroke.from?.y === 28 || stroke.from?.y === 24),
  false,
  'lightweight zoom rendering must defer subdivision and beat lines'
);

const closeRuler = element('div');
const closeLabels = element('div');
grid.renderRuler({
  total: 2,
  timeToX: time => time * 260,
  tempo: 120,
  timeSignature: '4/4',
  pxPerSec: 260,
  rulerEl: closeRuler,
  labelsEl: closeLabels,
  tlInnerEl: element('div'),
  lanesEl: element('div')
});
const closeLabelTexts = closeLabels.children.map(child => child.textContent);
assert.deepEqual(
  closeLabelTexts,
  ['1', '1.2', '1.3', '1.4', '2'],
  'major and beat labels must remain in timeline order at close zoom'
);

console.log('TimelineGrid tests passed');
