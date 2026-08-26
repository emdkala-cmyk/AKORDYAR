const assert = require('node:assert/strict');
const CoreArrangerEditorService = require(
  '../app/CoreArrangerEditorService.js'
);

function createClassList() {
  const values = new Set();
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    contains: value => values.has(value)
  };
}

const elements = new Map([
  ['arrManager', { style: {} }],
  ['arrEditor', { style: {} }],
  ['arrangerModal', { classList: createClassList() }],
  ['arrName', { value: '' }],
  ['arrCrossfadeRange', { value: '' }],
  ['arrCrossfadeVal', { textContent: '' }],
  ['arrPauseBtn', { classList: createClassList() }]
]);
const calls = [];
const editingArr = {
  name: 'Live Set',
  crossfade: 2,
  pauseBetween: true
};
const runtime = CoreArrangerEditorService.create({
  getElement: id => elements.get(id),
  getEditingArr: () => editingArr,
  renderArrPool: () => calls.push('pool'),
  renderArrSetlist: () => calls.push('setlist'),
  switchArrTab: tab => calls.push(['tab', tab]),
  renderArrangerManager: () => calls.push('manager'),
  logger: { log: message => calls.push(['log', message]) }
});

runtime.open();

assert.equal(elements.get('arrEditor').style.display, 'block');
assert.equal(elements.get('arrangerModal').classList.contains('show'), true);
assert.equal(elements.get('arrName').value, 'Live Set');
assert.equal(elements.get('arrCrossfadeRange').value, 2);
assert.equal(elements.get('arrCrossfadeVal').textContent, '2s');
assert.equal(
  elements.get('arrPauseBtn').classList.contains('arr-stl-active'),
  true
);
assert.deepEqual(calls.slice(0, 4), [
  'pool',
  'setlist',
  ['tab', 'editor'],
  'manager'
]);
assert.match(calls[4][1], /Editor opened for: "Live Set"/);

const emptyRuntime = CoreArrangerEditorService.create({
  getEditingArr: () => null,
  renderArrPool: () => {
    throw new Error('must not render');
  }
});
assert.equal(emptyRuntime.open(), undefined);

console.log('CoreArrangerEditorService tests passed');
