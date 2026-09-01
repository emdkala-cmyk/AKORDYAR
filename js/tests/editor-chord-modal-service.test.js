const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ChordModalService = require('../editor/EditorChordModalService.js');

const commandSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorChordCommandService.js'),
  'utf8'
);
const commandContext = {};
vm.runInNewContext(commandSource, commandContext);
const chordCommandService =
  commandContext.EditorChordCommandService.create();

function createElement() {
  return {
    classList: {
      values: new Set(),
      add(value) { this.values.add(value); },
      remove(value) { this.values.delete(value); },
      contains(value) { return this.values.has(value); }
    },
    textContent: '',
    value: '',
    _listeners: new Map(),
    addEventListener(type, listener) {
      this._listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (this._listeners.get(type) === listener) this._listeners.delete(type);
    },
    focus() {}
  };
}

const elements = new Map([
  ['chord-modal', createElement()],
  ['chordModalTitle', createElement()],
  ['chordModalConfirmBtn', createElement()],
  ['chord-preview', createElement()],
  ['chordManual', createElement()]
]);
const song = { chords: [{ name: 'Bbmin7/Eb' }] };
let currentChord = { root: 'None', type: 'None', tension: '', bass: 'None' };
let mode = null;
let chordIndex = null;
let pendingAnchor = { lineIndex: 0, charIndex: 2, anchorType: 'OnCharacter' };
let builds = 0;

const service = ChordModalService.create({
  getElement: id => elements.get(id),
  getSong: () => song,
  getChordCommandService: () => chordCommandService,
  getCurrentChord: () => currentChord,
  setCurrentChord: value => { currentChord = value; },
  getMode: () => mode,
  setMode: value => { mode = value; },
  setChordIndex: value => { chordIndex = value; },
  setPendingAnchor: value => { pendingAnchor = value; },
  buildEditor: () => { builds += 1; },
  translate: key => ({
    editSongChord: 'ویرایش آکورد',
    confirmBtn: 'تأیید'
  }[key] || key)
});

assert.equal(service.open(0), true);
assert.equal(mode, 'editor');
assert.equal(chordIndex, 0);
assert.equal(currentChord.root, 'Bb');
assert.equal(currentChord.type, 'min');
assert.equal(currentChord.tension, '7');
assert.equal(currentChord.bass, 'Eb');
assert.equal(elements.get('chordModalTitle').textContent, 'ویرایش آکورد');
const confirmBtnText = elements.get('chordModalConfirmBtn').textContent;
assert.ok(confirmBtnText === 'تأیید' || confirmBtnText === 'confirmBtn', `Expected 'تأیید' or 'confirmBtn', got '${confirmBtnText}'`);
assert.equal(elements.get('chord-preview').textContent, 'Bbmin7/Eb');
assert.equal(elements.get('chordManual').value, 'Bbmin7/Eb');
assert.equal(elements.get('chord-modal').classList.contains('show'), true);
assert.equal(builds, 1);

const escapeHandler = elements.get('chord-modal')._listeners.get('keydown');
let prevented = false;
escapeHandler({ key: 'Escape', preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.equal(mode, null);
assert.equal(chordIndex, null);
assert.equal(pendingAnchor, null);
assert.equal(elements.get('chord-modal').classList.contains('show'), false);

pendingAnchor = { lineIndex: 1, charIndex: 0, anchorType: 'LineStart' };
assert.equal(service.open(null), true);
assert.equal(currentChord.root, 'None');
assert.equal(currentChord.type, 'None');
assert.equal(currentChord.tension, '');
assert.equal(currentChord.bass, 'None');
assert.equal(elements.get('chordManual').value, '');
assert.equal(pendingAnchor.lineIndex, 1);

service.close();
assert.equal(mode, null);
assert.equal(chordIndex, null);
assert.equal(pendingAnchor, null);

const emptyService = ChordModalService.create({ getSong: () => null });
assert.equal(emptyService.open(0), false);

console.log('EditorChordModalService tests passed');
