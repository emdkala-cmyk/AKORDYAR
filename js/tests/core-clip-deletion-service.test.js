const assert = require('node:assert/strict');
const Deletion = require('../app/CoreClipDeletionService.js');

const daw = {
  clips: [{ id: 'c1' }, { id: 'c2' }],
  sections: [{ id: 's1' }],
  selectedIds: new Set(['c1']),
  selectedSectionIds: new Set(['s1']),
  isPlaying: true
};
const calls = [];
const service = Deletion.create({
  getDAW: () => daw,
  stopAllVoices: () => calls.push('stop'),
  saveState: () => calls.push('save'),
  renderAll: () => calls.push('render'),
  scheduleAllFromPlayhead: () => calls.push('schedule'),
  toast: message => calls.push(['toast', message]),
  translate: key => key
});

assert.equal(service.deleteSelected(), true);
assert.deepEqual(daw.clips, [{ id: 'c2' }]);
assert.deepEqual(daw.sections, []);
assert.equal(daw.selectedIds.size, 0);
assert.equal(daw.selectedSectionIds.size, 0);
assert.deepEqual(calls, [
  'stop',
  'save',
  'render',
  'schedule',
  ['toast', 'deleted']
]);

const emptyCalls = [];
const empty = Deletion.create({
  getDAW: () => ({
    clips: [],
    sections: [],
    selectedIds: new Set(),
    selectedSectionIds: new Set()
  }),
  toast: message => emptyCalls.push(message),
  translate: key => `tr:${key}`
});
assert.equal(empty.deleteSelected(), false);
assert.deepEqual(emptyCalls, ['tr:nothingSelected']);

console.log('CoreClipDeletionService tests passed');
