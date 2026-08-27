const assert = require('node:assert/strict');
const Controller = require(
  '../editor/EditorKeyCommandControllerService.js'
);

(async () => {

const elements = new Map();

function createElement(tagName = 'div', id = '') {
  let currentId = id;
  const listeners = new Map();
  const node = {
    get id() {
      return currentId;
    },
    set id(value) {
      currentId = value;
      if (value) elements.set(value, node);
    },
    tagName: tagName.toUpperCase(),
    value: '',
    textContent: '',
    title: '',
    style: {},
    children: [],
    options: [],
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    dispatch(type, event = {}) {
      for (const handler of listeners.get(type) || []) {
        handler({ target: node, ...event });
      }
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    },
    appendChild(child) {
      node.children.push(child);
      if (child.tagName === 'OPTION') node.options.push(child);
      if (child.id) elements.set(child.id, child);
      return child;
    },
    add(child) {
      return node.appendChild(child);
    }
  };
  if (id) elements.set(id, node);
  return node;
}

for (const id of [
  'edKey',
  'edKeyMode',
  'edOrigKeyLabel',
  'edTransUp',
  'edTransDown',
  'edTransVal',
  'edToggleAccidental',
  'headerCenterControls'
]) {
  createElement('div', id);
}

const documentRef = {
  getElementById: id => elements.get(id) || null,
  createElement: tagName => createElement(tagName)
};

const storageState = { ed_accidental_pref: 'flat' };
const storage = {
  getItem(key) {
    return storageState[key] ?? null;
  },
  setItem(key, value) {
    storageState[key] = value;
  }
};

const song = {
  key: 'C',
  keyMode: 'maj',
  originalKey: 'C',
  originalKeyMode: 'maj',
  transpose: 0,
  chords: [{ name: 'C#' }, { name: 'Am' }],
  baseChordNames: ['C#', 'Am']
};

const operationLog = [];
const toasts = [];
let commandOptions = null;

const notationService = {
  transposeChord(name, semitones, preferSharp) {
    return `${name}:${semitones}:${String(preferSharp)}`;
  },
  transposeKey(key, semitones, preferSharp) {
    return `${key}:${semitones}:${String(preferSharp)}`;
  },
  keyDelta(fromKey, toKey) {
    return fromKey === toKey ? 0 : 2;
  }
};

const transposeService = {
  keySignaturePreference: key => key === 'F' ? false : null,
  convertAccidentals(name, toFlat) {
    if (name === 'C#') return toFlat ? 'Db' : 'C#';
    return name;
  }
};

const commandServiceFactory = {
  create(options) {
    commandOptions = options;
    return {
      transposeKeyName: (key, semitones, preferSharp) =>
        options.transposeKey(key, semitones, preferSharp),
      keyToSemi: key => ({ C: 0, Bb: 10 }[key] ?? -1),
      keyDelta: (fromKey, toKey) => options.keyDelta(fromKey, toKey),
      transposeChordNamesInPlace(chords, semitones) {
        let changed = 0;
        chords.forEach(chord => {
          const next = options.transposeChord(chord.name, semitones);
          if (next !== chord.name) {
            chord.name = next;
            changed += 1;
          }
        });
        return changed;
      },
      applyTranspose(target, value, preferSharp) {
        operationLog.push(['mutate', 'transpose', value, preferSharp]);
        target.transpose = value;
        target.key = 'D';
        return { changed: true };
      },
      applyKeyChange(target, key, mode) {
        operationLog.push(['mutate', 'key', key, mode]);
        target.key = key;
        target.keyMode = mode;
        return { changed: true };
      },
      applyOriginalKeyChange(target, key, mode) {
        operationLog.push(['mutate', 'original', key, mode]);
        target.originalKey = key;
        target.originalKeyMode = mode;
        return { changed: true };
      },
      syncProjectKeyToOriginal(target) {
        operationLog.push(['mutate', 'sync-original']);
        target.key = target.originalKey;
        target.keyMode = target.originalKeyMode;
        return { changed: true };
      },
      resetToOriginalKey(target) {
        operationLog.push(['mutate', 'reset']);
        target.transpose = 0;
        return { changed: true };
      }
    };
  }
};

const controller = Controller.create({
  getSong: () => song,
  documentRef,
  storage,
  notationService,
  transposeService,
  commandServiceFactory,
  renderChords: immediate => operationLog.push(['render-chords', immediate]),
  renderEditor: rebuild => operationLog.push(['render-editor', rebuild]),
  syncTransposeToTimelineChords: () => operationLog.push(['sync-timeline']),
  saveSong: () => operationLog.push(['save-song']),
  saveCurrentVersion: () => operationLog.push(['save-version']),
  rebuildPerformanceSongDocument: () => operationLog.push(['rebuild-performance']),
  toast: message => toasts.push(message),
  customPrompt: () => Promise.resolve('Bb')
});

assert.equal(controller.isValidNote('Bb'), true);
assert.equal(controller.isValidNote('H'), false);
assert.equal(controller.resolveAccidentalPreference(), null);
assert.equal(controller.baseNameFromDisplayed('C#', {
  ...song,
  transpose: 0
}), 'C#');
assert.equal(controller.transposeKeyName('C', 2), 'C:2:null');
assert.equal(controller.keyToSemi('Bb'), 10);
assert.equal(controller.keyDelta('C', 'D'), 2);
assert.equal(commandOptions.ensureBaseChordNamesAligned, undefined);

controller.initAccidentalSelector();
const selector = elements.get('edAccidentalSel');
assert.ok(selector);
assert.equal(selector.value, 'flat');
selector.value = 'sharp';
selector.dispatch('change');
assert.equal(storageState.ed_accidental_pref, 'sharp');

operationLog.length = 0;
assert.equal(controller.applyTranspose(2), true);
assert.deepEqual(operationLog, [
  ['mutate', 'transpose', 2, true],
  ['save-version'],
  ['render-chords', true],
  ['render-editor', false],
  ['sync-timeline'],
  ['save-song'],
  ['rebuild-performance']
]);
assert.equal(documentRef.getElementById('edKey').value, 'D');
assert.equal(documentRef.getElementById('edTransVal').textContent, '+2');

operationLog.length = 0;
assert.equal(controller.applyKeyChange('F', 'maj'), true);
assert.deepEqual(operationLog, [
  ['mutate', 'key', 'F', 'maj'],
  ['render-chords', true],
  ['render-editor', false],
  ['sync-timeline'],
  ['save-song'],
  ['rebuild-performance']
]);

operationLog.length = 0;
assert.equal(controller.toggleAccidental(), true);
assert.equal(song.chords[0].name, 'Db');
assert.equal(song.baseChordNames[0], 'Db');
assert.deepEqual(operationLog.at(-3), ['sync-timeline']);
assert.deepEqual(operationLog.at(-2), ['save-song']);
assert.match(toasts.at(-1), /بمل/);

controller.bind();
assert.equal(elements.get('edTransUp').listenerCount('click'), 1);
controller.bind();
assert.equal(elements.get('edTransUp').listenerCount('click'), 1);

operationLog.length = 0;
elements.get('edTransUp').dispatch('click');
assert.equal(operationLog[0][0], 'mutate');
assert.equal(song.transpose, 3);

song.originalKey = 'C';
song.originalKeyMode = 'maj';
song.key = 'D';
song.keyMode = 'maj';
elements.get('edOrigKeyLabel').dispatch('click', { altKey: true });
assert.equal(song.key, 'C');
assert.equal(song.keyMode, 'maj');

elements.get('edOrigKeyLabel').dispatch('click', { altKey: false });
await Promise.resolve();
assert.equal(song.originalKey, 'Bb');
assert.equal(song.originalKeyMode, 'maj');

  console.log('EditorKeyCommandControllerService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
