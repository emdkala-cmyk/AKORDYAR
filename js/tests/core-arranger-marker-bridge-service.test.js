const assert = require('node:assert/strict');
const MarkerBridgeService = require(
  '../app/CoreArrangerMarkerBridgeService.js'
);

const options = {
  getDAW: () => ({ arrangerMarkers: {} }),
  markerService: { normalize() {} },
  getProjectEnd: () => 12,
  timeToX: value => value * 2,
  xToTime: value => value / 2,
  clamp: value => value,
  getElement: id => ({ id }),
  documentRef: { body: {} },
  isPerforming: () => false,
  startPointerDrag: () => {},
  saveState: () => {},
  saveSong: () => {},
  toast: () => {},
  formatTime: value => `t${value}`
};
let factoryCalls = 0;
let received = null;
let bindCalls = 0;
const controller = {
  bindDrag() {
    bindCalls += 1;
  },
  getArrangerMarkers: () => 'markers',
  persistArrangerMarkers: () => 'persisted',
  setArrangerA: () => 'a',
  setArrangerB: () => 'b',
  clearArrangerMarkers: () => 'clear',
  toggleArrangerMarkers: () => 'toggle',
  renderArrangerMarkers: () => 'render'
};

const runtime = MarkerBridgeService.create({
  ...options,
  controllerFactory: () => {
    factoryCalls += 1;
    return config => {
      received = config;
      return controller;
    };
  }
});

assert.equal(factoryCalls, 1);
assert.equal(bindCalls, 1);
assert.equal(received.getDAW, options.getDAW);
assert.equal(received.markerService, options.markerService);
assert.equal(received.getProjectEnd, options.getProjectEnd);
assert.equal(received.timeToX, options.timeToX);
assert.equal(received.xToTime, options.xToTime);
assert.equal(received.clamp, options.clamp);
assert.equal(received.getElement, options.getElement);
assert.equal(received.documentRef, options.documentRef);
assert.equal(received.isPerforming, options.isPerforming);
assert.equal(received.startPointerDrag, options.startPointerDrag);
assert.equal(received.saveState, options.saveState);
assert.equal(received.saveSong, options.saveSong);
assert.equal(received.toast, options.toast);
assert.equal(received.formatTime, options.formatTime);
assert.equal(runtime.getArrangerMarkers(), 'markers');
assert.equal(runtime.persistArrangerMarkers(), 'persisted');
assert.equal(runtime.setArrangerA(), 'a');
assert.equal(runtime.setArrangerB(), 'b');
assert.equal(runtime.clearArrangerMarkers(), 'clear');
assert.equal(runtime.toggleArrangerMarkers(), 'toggle');
assert.equal(runtime.renderArrangerMarkers(), 'render');

assert.equal(
  MarkerBridgeService.create({ controllerFactory: () => null }),
  null
);

console.log('CoreArrangerMarkerBridgeService tests passed');
