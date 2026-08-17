const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorToolbarService.js'),
  'utf8'
);

function classList() {
  const values = new Set();
  return {
    toggle(name, enabled) {
      if (enabled) values.add(name);
      else values.delete(name);
    },
    contains(name) {
      return values.has(name);
    }
  };
}

function element(tagName = 'INPUT') {
  return {
    tagName,
    type: tagName === 'INPUT' ? 'text' : undefined,
    value: '',
    options: [],
    selectedIndex: 0,
    style: {},
    classList: classList(),
    add(option) {
      this.options.push(option);
    },
    dispatchEvent() {},
    addEventListener() {}
  };
}

const elements = new Map();
const header = element('DIV');
const documentRef = {
  querySelector: selector => selector === '.header-center-controls' ? header : null,
  createElement: tagName => element(tagName.toUpperCase())
};

[
  'edArtist', 'edTitle', 'edTextSize', 'edTextColor', 'edTextFont',
  'edChordSize', 'edChordColor', 'edChordFont', 'edTextBold',
  'edAlignRight', 'edAlignCenter', 'edAlignLeft', 'edKey', 'edKeyMode',
  'edTimeSig', 'edTempo', 'edGenre', 'edSizeLockBtn', 'edEditorLockBtn',
  'edTextFont', 'edChordFont', 'edRemoveAsterisks', 'edReverseChords',
  'edDoBoth', 'editor'
].forEach(id => elements.set(id, element()));
elements.get('edKey').tagName = 'SELECT';
elements.get('edKeyMode').tagName = 'SELECT';
elements.get('edTimeSig').tagName = 'SELECT';
elements.get('edGenre').tagName = 'SELECT';

const song = {
  artist: 'Artist',
  title: 'Title',
  key: 'C',
  keyMode: 'maj',
  timeSignature: '4/4',
  tempo: 120,
  genre: 'Pop',
  styles: {
    tSize: 24,
    tColor: '#0fa966',
    tFont: 'Vazirmatn',
    cSize: 22,
    cColor: '#e6aa28',
    cFont: 'Vazirmatn',
    tBold: false,
    align: 'center'
  }
};

let renderCount = 0;
let chordRenderCount = 0;
let saveCount = 0;
let appliedKey = null;
let timingChangeCount = 0;
const context = {
  Event,
  setTimeout: callback => callback()
};
vm.runInNewContext(source, context);

const service = context.EditorToolbarService.create({
  documentRef,
  getSong: () => song,
  getElement: id => elements.get(id),
  archArtistKey: artist => `key:${artist}`,
  render: () => { renderCount += 1; },
  renderChords: () => { chordRenderCount += 1; },
  save: () => { saveCount += 1; },
  applyKeyChange: (key, mode) => { appliedKey = { key, mode }; },
  onTimingChange: () => { timingChangeCount += 1; },
  refreshKeyUI: () => {},
  noteNames: ['C', 'D']
});

service.bind();
assert.deepEqual(elements.get('edKey').options.map(option => option.value), ['C', 'D']);

service.syncToolbar();
assert.equal(elements.get('edArtist').value, 'Artist');
assert.equal(elements.get('edTextSize').value, 24);
assert.equal(elements.get('edAlignCenter').classList.contains('active'), true);

elements.get('edTextSize').type = 'number';
elements.get('edTextSize').value = '28';
elements.get('edTextSize').oninput();
assert.equal(song.styles.tSize, 28);
assert.equal(renderCount, 1);
assert.equal(chordRenderCount, 1);
assert.equal(saveCount, 1);

assert.equal(service.toggleSizeLock(), true);
elements.get('edTextSize').value = '30';
elements.get('edTextSize').oninput();
assert.equal(song.styles.cSize, 30);
assert.equal(elements.get('edChordSize').value, 30);

elements.get('edArtist').value = 'New Artist';
elements.get('edArtist').oninput();
assert.equal(song.artist, 'New Artist');
assert.equal(song.artistKey, 'key:New Artist');

elements.get('edKey').value = 'G';
elements.get('edKeyMode').value = 'min';
elements.get('edKey').onchange();
assert.deepEqual(appliedKey, { key: 'G', mode: 'min' });

elements.get('edTimeSig').value = '7/8';
elements.get('edTimeSig').onchange();
assert.equal(song.timeSignature, '7/8');
elements.get('edTempo').value = '137';
elements.get('edTempo').oninput();
assert.equal(song.tempo, 137);
assert.equal(timingChangeCount, 2);

assert.equal(service.toggleEditorLock(), true);
assert.equal(song.editorLocked, true);
assert.equal(elements.get('editor').contentEditable, 'false');
assert.equal(service.updateStyle('tSize', 40), false);
assert.equal(service.toggleEditorLock(), false);
assert.equal(song.editorLocked, false);

console.log('EditorToolbarService tests passed');
