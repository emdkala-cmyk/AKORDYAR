const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const PopupTimelineSyncService = require(
  '../editor/EditorPopupTimelineSyncService.js'
);

const parentDom = new JSDOM(`
  <!doctype html>
  <html><body>
    <div class="track-lane chord-lane">
      <div class="chord-clip" style="left:10px;width:120px">C</div>
      <div class="lane-resize-handle"></div>
    </div>
  </body></html>
`);
const popupDom = new JSDOM(`
  <!doctype html>
  <html><body><div id="playerChordMirror"></div></body></html>
`);
Object.defineProperty(popupDom.window, 'devicePixelRatio', {
  configurable: true,
  value: 2
});

const sourceTimeline = parentDom.window.document.querySelector(
  '.track-lane.chord-lane'
);
const targetDiv = popupDom.window.document.getElementById('playerChordMirror');
Object.defineProperty(sourceTimeline, 'scrollWidth', { value: 560 });
Object.defineProperty(targetDiv, 'clientHeight', { value: 90 });
Object.defineProperty(targetDiv, 'clientWidth', { value: 400 });

const context = {
  clearRect() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {}
};
popupDom.window.HTMLCanvasElement.prototype.getContext = () => context;

const popup = {
  closed: false,
  document: popupDom.window.document
};
let songTiming = { tempo: 120, timeSignature: '4/4' };
const daw = {
  pxPerSecond: 70,
  playhead: 0,
  isPlaying: false
};
let transportPlayhead = 0;
let snapshotOptions = null;
const bridgeCalls = [];

const service = PopupTimelineSyncService.create({
  documentRef: parentDom.window.document,
  windowRef: parentDom.window,
  bridge: {
    set: (windowRef, property, value) => {
      bridgeCalls.push([windowRef, property]);
      windowRef[property] = value;
      return true;
    }
  },
  getPopup: () => popup,
  isOpen: value => value === popup && !value.closed,
  getDocument: value => value.document,
  getSong: () => songTiming,
  getDAW: () => daw,
  getProjectEnd: () => 8,
  getTimeSignatureGridConfig: () => ({
    beatsPerMeasure: 4,
    beatDuration: 0.5,
    measureDuration: 2,
    subdivisionsPerBeat: 4
  }),
  timeToX: value => value * daw.pxPerSecond,
  getTransportPlayhead: () => transportPlayhead,
  getTransportClockSnapshot: options => {
    snapshotOptions = options;
    return {
      timelineTime: transportPlayhead,
      visualTimelineTime: transportPlayhead - 0.4
    };
  },
  logger: {
    error: (...args) => {
      throw new Error(args.join(' '));
    }
  }
});

service.render();
assert.equal(bridgeCalls.length, 1);
assert.equal(bridgeCalls[0][1], '_syncMirrorTimeline');
assert.equal(targetDiv.dataset.mirrorPps, '70');
assert.ok(targetDiv.querySelector('.mirror-ruler'));
assert.ok(targetDiv.querySelector('.mirror-ruler-inner'));
assert.ok(targetDiv.querySelector('.mirror-ruler-label'));
assert.ok(targetDiv.querySelector('.mirror-playhead'));
assert.ok(targetDiv.querySelector('.mirror-scene'));
assert.ok(targetDiv.querySelector('.mirror-grid'));
assert.ok(targetDiv.querySelector('.mirror-chord'));
assert.equal(targetDiv.querySelector('canvas.lane-grid'), null);
assert.equal(targetDiv.dataset.mirrorRenderer, 'lightweight-v1');
assert.equal(popupDom.window.document.body.querySelectorAll('script').length, 1);

daw.isPlaying = true;
transportPlayhead = 2.01;
popup._syncMirrorTimeline();
assert.equal(snapshotOptions.visual, false);
assert.match(
  targetDiv.querySelector('.mirror-scene').style.transform,
  /translate3d\(59.3px,0,0\)/
);

daw.isPlaying = false;
songTiming = { tempo: 120, timeSignature: '3/4' };
popup._syncMirrorTimeline();
assert.equal(targetDiv.dataset.mirrorTiming, '3/4:120');

daw.pxPerSecond = 100;
popup._syncMirrorTimeline();
assert.equal(targetDiv.dataset.mirrorPps, '100');

popup.closed = true;
assert.equal(service.start(), false);

console.log('EditorPopupTimelineSyncService tests passed');
