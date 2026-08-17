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
  beginPath() {},
  moveTo(x, y) { this._from = { x, y }; },
  lineTo(x, y) { this._to = { x, y }; },
  stroke() {
    strokes.push({ from: this._from, to: this._to });
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
  .map(stroke => stroke.from.x - 0.5)
  .filter(x => x < 150);
assert.deepEqual(
  subBeatXs,
  [12.5, 37.5, 62.5, 87.5, 112.5, 137.5],
  '6/8 ruler must render the eighth-note sub-grid inside every beat'
);

console.log('TimelineGrid tests passed');
