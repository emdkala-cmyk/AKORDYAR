const assert = require('node:assert/strict');
const ChordEditorService = require(
  '../editor/EditorTimelineChordEditorService.js'
);

class MockElement {
  constructor() {
    this.children = [];
    this.className = '';
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.value = '';
    this._innerHTML = '';
    this._listeners = new Map();
    const values = new Set();
    this.classList = {
      add: value => values.add(value),
      remove: value => values.delete(value),
      contains: value => values.has(value)
    };
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelectorAll(selector) {
    if (selector === '.chord-item') {
      return this.children.filter(child =>
        child.className.includes('chord-item')
      );
    }
    return [];
  }

  addEventListener(type, listener) {
    this._listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this._listeners.get(type) === listener) {
      this._listeners.delete(type);
    }
  }

  focus() {
    this.focused = true;
  }
}

const elementIds = [
  'col-root',
  'col-type',
  'col-tension',
  'col-bass',
  'piano-keys',
  'chord-preview',
  'chordManual',
  'chordModalTitle',
  'chordModalConfirmBtn',
  'chord-modal'
];
const elements = new Map(
  elementIds.map(id => [id, new MockElement()])
);
const piano = elements.get('piano-keys');
const documentRef = {
  createElement: () => new MockElement(),
  getElementById: id => elements.get(id),
  querySelectorAll: selector => {
    if (selector !== '.piano-keyboard .white-key, .piano-keyboard .black-key') {
      return [];
    }
    return piano.children.filter(child =>
      child.className.includes('white-key') ||
      child.className.includes('black-key')
    );
  },
  querySelector: selector => {
    const match = selector.match(/\[data-note="([^"]+)"\]/);
    return match
      ? piano.children.find(child => child.dataset.note === match[1]) || null
      : null;
  }
};

const daw = {
  editingChordClipId: null,
  playhead: 2,
  tracks: [{ id: 'chords', type: 'chord' }],
  clips: [],
  selectedIds: new Set()
};
let currentChord = {
  root: 'None',
  type: 'None',
  tension: '',
  bass: 'None'
};
let modalMode = null;
let chordIndex = null;
let pendingAnchor = null;
let nextId = 0;
let savedStates = 0;
let renderedClips = 0;
let renderedAll = 0;
let fittedTo = null;
let savedSongs = 0;
let editorConfirmations = 0;
let editorDeletions = 0;
const toasts = [];

const service = ChordEditorService.create({
  documentRef,
  windowRef: {},
  getElement: id => elements.get(id),
  getDAW: () => daw,
  getClip: id => daw.clips.find(clip => clip.id === id),
  getMidiChordService: () => ({
    formatChordName: chord => {
      if (chord.root === 'None' || chord.type === 'None') return 'None';
      return `${chord.root}${chord.type}${chord.tension}`;
    }
  }),
  getCurrentChord: () => currentChord,
  setCurrentChord: value => {
    currentChord = value;
  },
  getModalMode: () => modalMode,
  setModalMode: value => {
    modalMode = value;
  },
  setChordIndex: value => {
    chordIndex = value;
  },
  setPendingAnchor: value => {
    pendingAnchor = value;
  },
  confirmEditorChord: () => {
    editorConfirmations += 1;
  },
  deleteEditorChord: () => {
    editorDeletions += 1;
  },
  saveState: () => {
    savedStates += 1;
  },
  renderClips: () => {
    renderedClips += 1;
  },
  renderAll: () => {
    renderedAll += 1;
  },
  ensureTimelineFits: value => {
    fittedTo = value;
  },
  saveSong: () => {
    savedSongs += 1;
  },
  uid: () => `c-${++nextId}`,
  roundMs: value => Math.round(value * 100) / 100,
  translate: key => ({
    chordEditor: 'Chord editor',
    placeOnTimeline: 'Place',
    selectCompleteChord: 'Select a chord',
    chordPlaced: 'Placed',
    chordEditedTo: 'Edited to'
  }[key] || key),
  toast: message => {
    toasts.push(message);
  },
  constants: {
    ROOT_NOTES: ['None', 'C', 'D'],
    BASS_NOTES: ['None', 'C', 'G'],
    NOTE_TO_SHARP: { Bb: 'A#' },
    NOTE_SEMITONE: { C: 0, D: 2, G: 7 },
    NOTES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    CHORD_TYPES: ['None', 'maj', 'min'],
    TENSIONS: ['', '7'],
    CHORD_INTERVALS: { maj: [0, 4, 7], min: [0, 3, 7] },
    TENSION_INTERVALS: { 7: [10] }
  }
});

service.openChordEditor();
assert.equal(elements.get('chord-modal').classList.contains('show'), true);
assert.equal(elements.get('chordModalTitle').textContent, 'Chord editor');
assert.equal(elements.get('chordModalConfirmBtn').textContent, 'Place');
assert.equal(elements.get('col-root').children.length, 3);
assert.equal(elements.get('col-type').children.length, 3);
assert.equal(
  elements.get('piano-keys').children.filter(child =>
    child.className === 'white-key'
  ).length,
  14
);
assert.equal(
  elements.get('piano-keys').children.filter(child =>
    child.className === 'black-key'
  ).length,
  10
);

elements.get('col-root').children[1].onclick();
elements.get('col-type').children[1].onclick();
assert.equal(elements.get('chordManual').value, 'Cmaj');
service.placeChordOnTimeline();
assert.deepEqual(daw.clips[0], {
  id: 'c-1',
  type: 'chord',
  trackId: 'chords',
  name: 'C',
  start: 2,
  duration: 4,
  color: '#9F7AEA'
});
assert.deepEqual([...daw.selectedIds], ['c-1']);
assert.equal(savedStates, 1);
assert.equal(renderedAll, 1);
assert.equal(fittedTo, 11);
assert.equal(savedSongs, 1);
assert.equal(elements.get('chord-modal').classList.contains('show'), false);

service.openChordEditor('c-1');
assert.equal(currentChord.root, 'C');
assert.equal(currentChord.type, 'None');
elements.get('chordManual').value = 'Dmin';
service.placeChordOnTimeline();
assert.equal(daw.clips[0].name, 'Dm');
assert.equal(renderedAll, 2);
assert.equal(savedSongs, 1);
assert.equal(toasts.at(-1), 'Edited to Dm');

modalMode = 'editor';
service.chordModalConfirm();
service.chordModalDelete();
assert.equal(editorConfirmations, 1);
assert.equal(editorDeletions, 1);

modalMode = null;
daw.editingChordClipId = 'c-1';
daw.clips[0].name = 'Dm';
service.chordModalDelete();
assert.equal(daw.clips[0].name, '');
assert.equal(renderedClips, 1);
assert.equal(savedStates, 3);

modalMode = 'editor';
chordIndex = 4;
pendingAnchor = { lineIndex: 1 };
service.closeChordEditor();
assert.equal(modalMode, null);
assert.equal(chordIndex, null);
assert.equal(pendingAnchor, null);

service.openChordEditor();
elements.get('chordManual').value = '';
service.placeChordOnTimeline();
assert.equal(toasts.at(-1), 'Select a chord');
assert.equal(daw.clips.length, 1);

console.log('EditorTimelineChordEditorService tests passed');
