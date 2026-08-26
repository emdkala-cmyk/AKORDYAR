const assert = require('node:assert/strict');
const ArrangerEditorActionsService = require(
  '../app/CoreArrangerEditorActionsService.js'
);

function createClassList() {
  const values = new Set();
  return {
    values,
    toggle(name, force) {
      const shouldAdd = force === undefined ? !values.has(name) : force;
      if (shouldAdd) values.add(name);
      else values.delete(name);
    },
    contains(name) {
      return values.has(name);
    }
  };
}

const tabs = [
  { dataset: { tab: 'editor' }, classList: createClassList() },
  { dataset: { tab: 'songs' }, classList: createClassList() }
];
const elements = {
  arrTabEditor: { style: {} },
  arrTabSongs: { style: {} },
  arrEditor: { style: {} }
};
const editingArr = { id: 'arr-1', name: 'Set', items: ['song-1'] };
const calls = [];
const documentRef = {
  querySelectorAll: selector => selector === '.arr-tab' ? tabs : []
};
const runtime = ArrangerEditorActionsService.create({
  documentRef,
  getElement: id => elements[id],
  getEditingArr: () => editingArr,
  setEditingArr: value => calls.push(['editing', value]),
  saveArrangers: () => calls.push('save'),
  renderArrangerManager: () => calls.push('manager'),
  renderArrSongsList: () => calls.push('songs'),
  saveCurrentArranger: () => calls.push('save-current'),
  exportArranger: arr => calls.push(['export', arr.id]),
  toast: message => calls.push(['toast', message])
});

runtime.switchArrTab('songs');
assert.equal(tabs[0].classList.contains('active'), false);
assert.equal(tabs[1].classList.contains('active'), true);
assert.equal(elements.arrTabEditor.style.display, 'none');
assert.equal(elements.arrTabSongs.style.display, '');
assert.ok(calls.includes('songs'));

runtime.closeArrEditor();
assert.equal(elements.arrEditor.style.display, 'none');
assert.deepEqual(calls.slice(-3), [
  'save',
  ['editing', null],
  'manager'
]);

runtime.exportCurrentArranger();
assert.deepEqual(calls.slice(-2), ['save-current', ['export', 'arr-1']]);

const emptyRuntime = ArrangerEditorActionsService.create({
  getEditingArr: () => null,
  toast: message => calls.push(['empty', message])
});
emptyRuntime.exportCurrentArranger();
assert.deepEqual(calls.at(-1), [
  'empty',
  '⚠ هیچ پلی‌لیستی در حال ویرایش نیست'
]);

console.log('CoreArrangerEditorActionsService tests passed');
