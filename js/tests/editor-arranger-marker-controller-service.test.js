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
let stateSaves = 0;
let songSaves = 0;
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

daw.playhead = 12;
controller.setArrangerB();
assert.equal(daw.arrangerMarkers.end, 12);
assert.equal(stateSaves, 2);

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
