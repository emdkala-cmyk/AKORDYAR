const assert = require('node:assert/strict');
const TimelineTrackRendererService = require('../core/TimelineTrackRendererService.js');

const classChanges = [];
const documentRef = {
  querySelectorAll() {
    return [
      {
        dataset: { trackId: 't1' },
        classList: { toggle: (name, value) => classChanges.push([name, value]) }
      },
      {
        dataset: { trackId: 't2' },
        classList: { toggle: (name, value) => classChanges.push([name, value]) }
      }
    ];
  }
};

const daw = {
  selectedTrackId: 't1',
  tracks: [{ id: 't1' }, { id: 't2' }]
};

const service = TimelineTrackRendererService.create({
  documentRef,
  getDAW: () => daw
});

assert.equal(service.selectTrack('t2'), daw.tracks[1]);
assert.equal(daw.selectedTrackId, 't2');
assert.deepEqual(classChanges, [
  ['selected-track', false],
  ['selected-track', true]
]);
assert.equal(service.selectTrack('missing'), null);

console.log('TimelineTrackRendererService tests passed');
