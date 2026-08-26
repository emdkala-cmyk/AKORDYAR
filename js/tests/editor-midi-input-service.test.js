const assert = require('node:assert/strict');
const MidiInputService = require('../editor/EditorMidiInputService.js');

function classList() {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    },
    toggle(value, force) {
      const next = force == null ? !values.has(value) : Boolean(force);
      if (next) values.add(value);
      else values.delete(value);
      return next;
    },
    has(value) {
      return values.has(value);
    }
  };
}

function element() {
  return { classList: classList(), value: '', textContent: '' };
}

const chordModal = element();
const chordManual = element();
const chordPreview = element();
const rootItem = element();
const typeItem = element();
const tensionItem = element();
const bassItem = element();
const pianoKey = element();
const elements = new Map([
  ['chord-modal', chordModal],
  ['chordManual', chordManual],
  ['chord-preview', chordPreview],
  ['tab-midi-sync', element()],
  ['midiSyncLabel', element()]
]);

const selectors = new Map([
  ['#col-root .chord-item:nth-child(2)', rootItem],
  ['#col-type .chord-item:nth-child(2)', typeItem],
  ['#col-tension .chord-item:nth-child(1)', tensionItem],
  ['#col-bass .chord-item:nth-child(1)', bassItem],
  ['.piano-keyboard [data-note="C4"]', pianoKey]
]);
const chordItems = [rootItem, typeItem, tensionItem, bassItem];
const documentRef = {
  getElementById: id => elements.get(id) || null,
  querySelector: selector => selectors.get(selector) || null,
  querySelectorAll: selector =>
    selector === '.chord-item' ? chordItems : []
};

const activeMidiNotes = new Set();
let midiTimeout = null;
let scheduledCallback = null;
let currentChord = null;
let recordingActive = false;
let recordingClipId = null;
let syncActive = false;
let timeline = {
  playhead: 3,
  tracks: [{ id: 'chords', type: 'chord' }],
  clips: [],
  selectedIds: new Set()
};
let song = { chords: [] };
const monitorMessages = [];
const chordDisplays = [];
const toasts = [];
const transportMessages = [];
const renderCalls = [];
let identifyCalls = 0;

const chord = { root: 'C', type: 'maj', tension: '', bass: 'None' };
const chordService = {
  identifyChord(notes) {
    identifyCalls += 1;
    return notes.length >= 3 ? chord : null;
  },
  formatChordName() {
    return 'C';
  }
};

const service = MidiInputService.create({
  documentRef,
  getElement: id => elements.get(id) || null,
  notes: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  noteNames: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  getMidiTransportService: () => ({
    handleMessage(data) {
      transportMessages.push(data);
      return false;
    }
  }),
  getMidiChordService: () => chordService,
  updateMidiMonitor: data => monitorMessages.push(data),
  updateMidiStatusDot: () => {},
  updateMidiChordDisplay: (name, notes) => chordDisplays.push({ name, notes }),
  logMidiMsg: () => {},
  getActiveMidiNotes: () => activeMidiNotes,
  getMidiTimeout: () => midiTimeout,
  setMidiTimeout: value => {
    midiTimeout = value;
  },
  schedule: callback => {
    scheduledCallback = callback;
    return 'timer';
  },
  cancel: () => {},
  getRecordingState: () => ({
    active: recordingActive,
    clipId: recordingClipId
  }),
  setRecordingClipId: value => {
    recordingClipId = value;
  },
  getClip: clipId => timeline.clips.find(clip => clip.id === clipId),
  getTimelineState: () => timeline,
  saveState: () => renderCalls.push('save'),
  renderAll: () => renderCalls.push('all'),
  renderClips: () => renderCalls.push('clips'),
  ensureTimelineFits: value => renderCalls.push(['fit', value]),
  uid: () => `c${timeline.clips.length + 1}`,
  roundMs: value => value,
  setCurrentChord: value => {
    currentChord = value;
  },
  updateChordPreview: () => {},
  getModalMode: () => 'editor',
  getCurrentEditorSong: () => song,
  getSelectedChords: () => [],
  getEditorSongStateService: () => null,
  getSequentialChordingActive: () => false,
  getSyncActive: () => syncActive,
  setSyncActive: value => {
    syncActive = value;
  },
  toast: message => toasts.push(message),
  constants: {
    ROOT_NOTES: ['None', 'C'],
    CHORD_TYPES: ['None', 'maj'],
    TENSIONS: [''],
    BASS_NOTES: ['None']
  }
});

service.handleMessage({ data: [0x90, 60, 100] });
service.handleMessage({ data: [0x90, 64, 100] });
service.handleMessage({ data: [0x90, 67, 100] });
assert.deepEqual([...activeMidiNotes], [60, 64, 67]);
assert.equal(pianoKey.classList.has('active'), true);
assert.equal(monitorMessages.length, 3);
assert.equal(transportMessages.length, 3);
assert.equal(typeof scheduledCallback, 'function');
scheduledCallback();
assert.equal(identifyCalls, 1);
assert.deepEqual(chordDisplays.at(-1), { name: 'C', notes: 'C4, E4, G4' });

chordModal.classList.add('show');
recordingActive = false;
service.evaluateInput();
assert.equal(currentChord, chord);
assert.equal(rootItem.classList.has('active'), true);
assert.equal(typeItem.classList.has('active'), true);

chordModal.classList.remove('show');
recordingActive = true;
recordingClipId = null;
timeline.playhead = 3;
service.evaluateInput();
assert.equal(timeline.clips.length, 1);
assert.equal(timeline.clips[0].name, 'C');
assert.equal(recordingClipId, 'c1');

activeMidiNotes.clear();
timeline.playhead = 5;
service.evaluateInput();
assert.equal(timeline.clips[0].duration, 2);
assert.equal(recordingClipId, null);
assert.equal(renderCalls.includes('save'), true);
recordingActive = false;

service.handleMessage({ data: [0x80, 60, 0] });
assert.equal(activeMidiNotes.has(60), false);

assert.equal(service.toggleSync(), true);
assert.equal(elements.get('tab-midi-sync').classList.has('active-pink'), true);
assert.equal(elements.get('midiSyncLabel').textContent, 'ON');
assert.equal(service.toggleSync(), false);
assert.equal(elements.get('tab-midi-sync').classList.has('active-pink'), false);

console.log('EditorMidiInputService tests passed');
