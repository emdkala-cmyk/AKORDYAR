const assert = require('node:assert/strict');
const TrackSetup = require('../app/CoreTrackSetupService.js');

function createClassList() {
  const values = new Set();
  return {
    toggle(name, force) {
      const next = force === undefined ? !values.has(name) : force;
      if (next) values.add(name);
      else values.delete(name);
    },
    add(name) {
      values.add(name);
    },
    remove(name) {
      values.delete(name);
    },
    contains(name) {
      return values.has(name);
    }
  };
}

function createElement() {
  const listeners = {};
  const element = {
    listeners,
    children: [],
    classList: createClassList(),
    className: '',
    innerHTML: '',
    addEventListener(name, handler) {
      listeners[name] = handler;
    },
    appendChild(child) {
      this.children.push(child);
    }
  };
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return this._innerHTML || '';
    },
    set(value) {
      this._innerHTML = value;
      if (value === '') this.children = [];
    }
  });
  return element;
}

const grid = createElement();
const overlay = createElement();
const elements = {
  iconPickerGrid: grid,
  iconPickerOverlay: overlay
};
const documentRef = {
  createElement: () => createElement()
};
const calls = [];
const contextCalls = [];
const audioContext = {
  createStereoPanner() {
    const node = {
      connect(target) {
        contextCalls.push(['panner-connect', target]);
      }
    };
    contextCalls.push('panner');
    return node;
  },
  createGain() {
    const node = {
      connect(target) {
        contextCalls.push(['gain-connect', target]);
      }
    };
    contextCalls.push('gain');
    return node;
  }
};
const daw = {
  tracks: [],
  audioCtx: audioContext,
  masterGain: { id: 'master' }
};

const service = TrackSetup.create({
  documentRef,
  getElement: id => elements[id] || null,
  getDAW: () => daw,
  getIconRegistry: () => ({
    getAll: () => ({
      custom: '<svg>custom</svg>'
    })
  }),
  ensureAudioCtx: () => calls.push('ensure-audio'),
  uid: prefix => `${prefix}-1`,
  saveState: () => calls.push('save'),
  renderAll: () => calls.push('render'),
  toast: value => calls.push(['toast', value]),
  translate: key => `tr:${key}`
});

assert.match(service.getIconSvg('🎸'), /<svg/);
assert.equal(service.getIconSvg('custom'), '<svg>custom</svg>');
assert.equal(service.getIconSvg('unknown'), 'unknown');

const selectedTrack = { icon: '🎸' };
service.openIconPicker(selectedTrack);
assert.equal(grid.children.length, 17);
assert.equal(grid.children[1].className, 'icon-picker-item active');
assert.equal(overlay.classList.contains('show'), true);

grid.children[0].listeners.click();
assert.equal(selectedTrack.icon, '🎤');
assert.equal(overlay.classList.contains('show'), false);
assert.deepEqual(calls.slice(-2), ['save', 'render']);

overlay.classList.add('show');
overlay.listeners.click({ target: overlay });
assert.equal(overlay.classList.contains('show'), false);

service.addNewTrack('', '🎹');
assert.deepEqual(daw.tracks[0], {
  id: 't-1',
  name: 'Line 1',
  icon: '🎹',
  type: 'audio',
  muted: false,
  solo: false,
  vol: 0.8,
  pan: 0,
  transpose: 0,
  locked: false,
  _pannerNode: daw.tracks[0]._pannerNode,
  _gainNode: daw.tracks[0]._gainNode
});
assert.deepEqual(contextCalls, [
  'panner',
  'gain',
  ['panner-connect', daw.tracks[0]._gainNode],
  ['gain-connect', daw.masterGain]
]);
assert.deepEqual(calls.slice(-3), [
  'save',
  'render',
  ['toast', 'tr:newTrackAdded']
]);

console.log('CoreTrackSetupService tests passed');
