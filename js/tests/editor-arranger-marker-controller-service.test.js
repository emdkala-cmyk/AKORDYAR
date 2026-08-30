const assert = require('node:assert/strict');
const ControllerService = require(
  '../editor/EditorArrangerMarkerControllerService.js'
);
const MarkerService = require('../editor/ArrangerMarkerService.js');

function element() {
  const listeners = new Map();
  return {
    style: {},
    title: '',
    attributes: {},
    classList: {
      values: new Set(),
      toggle(name, enabled) {
        if (enabled) this.values.add(name);
        else this.values.delete(name);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    getListener(name) {
      return listeners.get(name);
    },
    getBoundingClientRect() {
      return { left: 100 };
    }
  };
}

const elements = new Map([
  ['arranger-marker-toggle', element()],
  ['arranger-marker-controls', element()],
  ['arranger-markers-overlay', element()],
  ['arranger-markers-timeline-overlay', element()],
  ['arranger-marker-a', element()],
  ['arranger-marker-b', element()],
  ['arranger-marker-line-a', element()],
  ['arranger-marker-line-b', element()],
  ['tl-inner', element()]
]);

const daw = {
  playhead: 4,
  pxPerSecond: 100,
  loopA: 2,
  loopB: 8,
  arrangerMarkers: null
};
let performing = false;
let snapEnabled = false;
let snapCalls = 0;
let stateSaves = 0;
let songSaves = 0;
let dragCallbacks = null;
const toasts = [];

const controller = ControllerService.create({
  getDAW: () => daw,
  markerService: MarkerService,
  getProjectEnd: () => 20,
  timeToX: value => value * 100,
  xToTime: value => value / 100,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  getElement: id => elements.get(id),
  documentRef: {
    removeEventListener() {}
  },
  isPerforming: () => performing,
  isSnapEnabled: () => snapEnabled,
  snapTime: value =>
    (snapCalls += 1, Math.round(value * 2) / 2),
  startPointerDrag: (target, startEvent, onMove, onEnd) => {
    dragCallbacks = { target, startEvent, onMove, onEnd };
  },
  saveState: () => { stateSaves += 1; },
  saveSong: () => { songSaves += 1; },
  toast: message => toasts.push(message),
  formatTime: value => String(value)
});

controller.setArrangerA();
assert.deepEqual(daw.arrangerMarkers, {
  enabled: true,
  start: 4,
  end: 9
});
assert.equal(daw.loopA, 2);
assert.equal(daw.loopB, 8);
assert.equal(stateSaves, 1);
assert.equal(songSaves, 1);
assert.equal(elements.get('arranger-marker-a').style.left, '392px');
assert.equal(elements.get('arranger-marker-b').style.left, '892px');

daw.playhead = 4.24;
controller.setArrangerA();
assert.equal(daw.arrangerMarkers.start, 4.24);
assert.equal(snapCalls, 0);

snapEnabled = true;
controller.setArrangerA();
assert.equal(daw.arrangerMarkers.start, 4);
assert.equal(snapCalls, 1);

daw.playhead = 12;
controller.setArrangerB();
assert.equal(daw.arrangerMarkers.end, 12);
assert.equal(stateSaves, 4);

controller.bindDrag();
const markerAElement = elements.get('arranger-marker-a');
markerAElement.getListener('pointerdown')({
  button: 0,
  currentTarget: markerAElement,
  stopPropagation() {},
  preventDefault() {}
});
dragCallbacks.onMove({ clientX: 570 });
assert.equal(daw.arrangerMarkers.start, 4.5);
dragCallbacks.onEnd();
assert.equal(stateSaves, 5);

snapEnabled = false;
const markerBElement = elements.get('arranger-marker-b');
markerBElement.getListener('pointerdown')({
  button: 0,
  currentTarget: markerBElement,
  stopPropagation() {},
  preventDefault() {}
});
dragCallbacks.onMove({ clientX: 1237 });
assert.equal(daw.arrangerMarkers.end, 11.37);
assert.equal(snapCalls, 2);
dragCallbacks.onEnd();
assert.equal(stateSaves, 6);

controller.toggleArrangerMarkers();
assert.equal(daw.arrangerMarkers.enabled, false);
controller.toggleArrangerMarkers();
assert.equal(daw.arrangerMarkers.enabled, true);

performing = true;
daw.playhead = 1;
controller.setArrangerA();
assert.equal(daw.arrangerMarkers.start, 4);
assert.match(toasts.at(-1), /قابل تغییر نیستند/);
performing = false;

controller.clearArrangerMarkers();
assert.deepEqual(daw.arrangerMarkers, {
  enabled: false,
  start: 0,
  end: 0
});

console.log('EditorArrangerMarkerControllerService tests passed');
