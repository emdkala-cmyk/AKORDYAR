const assert = require('node:assert/strict');
const TimelineSectionBridgeService = require(
  '../app/CoreTimelineSectionBridgeService.js'
);

const documentRef = {
  getElementById: id => ({ id })
};
const windowRef = { name: 'window' };
const daw = { sections: [] };
const selectedClips = () => [];
const callbacks = {
  timeToX: value => value * 2,
  xToTime: value => value / 2,
  snapTime: value => Math.round(value),
  roundMs: value => Number(value.toFixed(2)),
  renderClips: () => {},
  startPointerDrag: () => {},
  getTimelineInner: () => ({ id: 'inner' }),
  onDocumentMouseMove: () => {},
  onDocumentMouseUp: () => {},
  saveState: () => {}
};
let factoryCalls = 0;
let receivedOptions = null;
const renderer = { renderSections: () => 'rendered' };

const service = TimelineSectionBridgeService.create({
  documentRef,
  windowRef,
  rendererFactory: () => {
    factoryCalls += 1;
    return options => {
      receivedOptions = options;
      return renderer;
    };
  },
  getDAW: () => daw,
  selectedClips,
  ...callbacks
});

assert.equal(factoryCalls, 0);
assert.equal(service.getTimelineSectionRendererService(), renderer);
assert.equal(factoryCalls, 1);
assert.equal(service.getTimelineSectionRendererService(), renderer);
assert.equal(factoryCalls, 1);
assert.equal(receivedOptions.documentRef, documentRef);
assert.equal(receivedOptions.windowRef, windowRef);
assert.equal(receivedOptions.getDAW(), daw);
assert.equal(receivedOptions.timeToX, callbacks.timeToX);
assert.equal(receivedOptions.xToTime, callbacks.xToTime);
assert.equal(receivedOptions.snapTime, callbacks.snapTime);
assert.equal(receivedOptions.roundMs, callbacks.roundMs);
assert.equal(receivedOptions.renderClips, callbacks.renderClips);
assert.equal(receivedOptions.selectedClips, selectedClips);
assert.equal(receivedOptions.startPointerDrag, callbacks.startPointerDrag);
assert.equal(
  receivedOptions.getTimelineInner,
  callbacks.getTimelineInner
);
assert.equal(
  receivedOptions.onDocumentMouseMove,
  callbacks.onDocumentMouseMove
);
assert.equal(
  receivedOptions.onDocumentMouseUp,
  callbacks.onDocumentMouseUp
);
assert.equal(receivedOptions.saveState, callbacks.saveState);

const unavailable = TimelineSectionBridgeService.create({
  rendererFactory: () => null
});
assert.equal(unavailable.getTimelineSectionRendererService(), null);

console.log('CoreTimelineSectionBridgeService tests passed');
