const assert = require('node:assert/strict');
const ShortcutStoreService = require(
  '../editor/EditorShortcutStoreService.js'
);

const values = new Map([
  ['ed_shortcuts', JSON.stringify({
    play: { code: 'KeyP', ctrl: true, shift: false }
  })],
  ['ed_midi_maps', JSON.stringify({ n60: 'play' })]
]);
const storage = {
  getItem: key => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
};

const store = ShortcutStoreService.create({ storage });
assert.equal(store.shortcutDefaults.length, 41);

store.loadShortcuts();
assert.deepEqual(store.getShortcut('toggleSnap'), {
  code: 'KeyJ',
  ctrl: false,
  shift: false,
  alt: false
});
assert.equal(store.getShortcut('zoomVOut').code, 'KeyN');
assert.deepEqual(store.getShortcut('play'), {
  code: 'KeyP',
  ctrl: true,
  shift: false
});
assert.equal(
  store.matchShortcut(
    { code: 'KeyP', ctrlKey: true, metaKey: false, shiftKey: false },
    'play'
  ),
  true
);
assert.equal(
  store.matchShortcut(
    { code: 'KeyP', ctrlKey: false, metaKey: false, shiftKey: false },
    'play'
  ),
  false
);
assert.equal(
  store.matchShortcut(
    { code: 'KeyJ', ctrlKey: false, metaKey: false, shiftKey: false },
    'toggleSnap'
  ),
  true
);
assert.equal(
  store.matchShortcut(
    { code: 'KeyS', ctrlKey: false, metaKey: false, shiftKey: false },
    'toggleSnap'
  ),
  false
);
assert.equal(store.formatKeyName('KeyA'), 'A');
assert.equal(store.formatKeyName('ArrowLeft'), '←');
assert.equal(store.formatKeyName('UnknownCode'), 'UnknownCode');

store.shortcuts.copy = {
  code: 'KeyC',
  ctrl: true,
  shift: false
};
store.saveShortcuts();
assert.deepEqual(
  JSON.parse(values.get('ed_shortcuts')).copy,
  { code: 'KeyC', ctrl: true, shift: false }
);
store.resetShortcuts();
assert.deepEqual(store.shortcuts, {});
assert.equal(values.has('ed_shortcuts'), false);

store.loadMidiMaps();
assert.equal(store.getMidiMap(60), 'play');
store.setMidiMap(61, 'split');
assert.equal(store.getMidiMap(61), 'split');
store.removeMidiMap(60);
assert.equal(store.getMidiMap(60), null);
store.clearMidiMaps();
assert.deepEqual(store.midiMaps, {});
assert.deepEqual(JSON.parse(values.get('ed_midi_maps')), {});

console.log('EditorShortcutStoreService tests passed');
