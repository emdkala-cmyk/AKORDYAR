const assert = require('node:assert/strict');
const ArrangerControlsService = require('../app/CoreArrangerControlsService.js');

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

const elements = {
  arrCrossfadeVal: { textContent: '' },
  arrPauseBtn: { classList: createClassList() }
};
const editingArr = {
  items: ['song-1', 'song-2'],
  settings: [
    { transpose: 1, notes: 'a' },
    { transpose: 0, notes: 'b' }
  ]
};
const calls = [];
let promptValue = '2';
let confirmValue = true;

async function run() {
  const runtime = ArrangerControlsService.create({
    getEditingArr: () => editingArr,
    getElement: id => elements[id],
    ensureArrItem: (_, index) => editingArr.settings[index],
    customPrompt: () => Promise.resolve(promptValue),
    confirm: () => confirmValue,
    saveArrangers: () => calls.push('save'),
    renderArrPool: () => calls.push('pool'),
    renderArrSetlist: () => calls.push('setlist')
  });

  runtime.arrSetCrossfade(3);
  assert.equal(editingArr.crossfade, 3);
  assert.equal(elements.arrCrossfadeVal.textContent, '3s');

  runtime.arrTogglePauseBetween();
  assert.equal(editingArr.pauseBetween, true);
  assert.equal(
    elements.arrPauseBtn.classList.contains('arr-stl-active'),
    true
  );

  await runtime.arrAutoTranspose();
  assert.deepEqual(
    editingArr.settings.map(setting => setting.transpose),
    [3, 2]
  );

  runtime.arrClearNotes();
  assert.deepEqual(
    editingArr.settings.map(setting => setting.notes),
    ['', '']
  );

  runtime.arrFilterSongs();
  assert.deepEqual(calls, [
    'save',
    'save',
    'save',
    'setlist',
    'save',
    'setlist',
    'pool',
    'setlist'
  ]);

  promptValue = 'not-a-number';
  await runtime.arrAutoTranspose();
  assert.deepEqual(
    editingArr.settings.map(setting => setting.transpose),
    [3, 2]
  );

  confirmValue = false;
  runtime.arrClearNotes();
  assert.deepEqual(
    editingArr.settings.map(setting => setting.notes),
    ['', '']
  );

  const emptyRuntime = ArrangerControlsService.create({
    getEditingArr: () => null,
    renderArrPool: () => calls.push('empty-pool'),
    renderArrSetlist: () => calls.push('empty-setlist')
  });
  emptyRuntime.arrTogglePauseBetween();
  await emptyRuntime.arrAutoTranspose();
  emptyRuntime.arrClearNotes();

  console.log('CoreArrangerControlsService tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
