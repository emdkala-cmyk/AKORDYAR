const assert = require('node:assert/strict');
const TimelineTrackRendererService = require(
  '../core/TimelineTrackRendererService.js'
);

function createElement() {
  const listeners = new Map();
  const classes = new Set();
  const element = {
    style: {},
    dataset: {},
    children: [],
    className: '',
    listeners,
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      toggle: (name, enabled) => {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains: name => classes.has(name)
    },
    setAttribute() {},
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    appendChild(child) {
      element.children.push(child);
      return child;
    },
    insertBefore(child) {
      element.children.push(child);
      return child;
    },
    querySelector() {
      return createElement();
    },
    querySelectorAll() {
      return [];
    },
    contains() {
      return false;
    }
  };
  let html = '';
  Object.defineProperty(element, 'innerHTML', {
    get: () => html,
    set: value => { html = value; }
  });
  return element;
}

const names = createElement();
const lanes = createElement();
const lane = createElement();
const chordTrack = { id: 'chords', type: 'chord', name: 'Chord Line' };
const daw = {
  tracks: [chordTrack],
  clips: [],
  sections: [],
  selectedTrackId: chordTrack.id,
  selectedSectionIds: new Set()
};
const imports = [];
const documentRef = {
  getElementById: id => ({
    'track-names-container': names,
    'lanes-container': lanes
  }[id] || null),
  querySelectorAll: () => [],
  createElement,
  elementFromPoint: () => lane
};

const service = TimelineTrackRendererService.create({
  documentRef,
  getDAW: () => daw,
  getSongState: () => ({
    currentSong: () => ({ chordVersions: [], activeChordVersion: 0 })
  }),
  getIconSvg: () => '',
  clientToTime: clientX => clientX / 10,
  timeToX: time => time * 10,
  snapTime: time => Math.round(time * 2) / 2,
  openChordLineImporter: (...args) => imports.push(args),
  drawLaneGrid: () => {}
});

service.renderTracks();
const renderedLane = lanes.children.find(
  child => child.dataset.trackId === chordTrack.id
);
const guide = renderedLane.children.find(
  child => child.className === 'chord-drop-guide'
);
const dragOver = renderedLane.listeners.get('dragover');
const drop = renderedLane.listeners.get('drop');
const dragLeave = renderedLane.listeners.get('dragleave');

dragOver({
  clientX: 123,
  dataTransfer: { types: ['text/plain'], files: [] },
  preventDefault() {}
});
assert.equal(guide.style.display, 'block');
assert.equal(guide.style.left, '125px');
assert.equal(guide.dataset.time, '12.5');
assert.equal(renderedLane.classList.contains('chord-drop-target'), true);

drop({
  clientX: 123,
  dataTransfer: {
    files: [],
    getData: type => type === 'text/plain' ? '<chord />' : ''
  },
  preventDefault() {},
  stopPropagation() {}
});
assert.deepEqual(imports, [['drop', '<chord />', 12.5]]);
assert.equal(guide.style.display, 'none');
assert.equal(renderedLane.classList.contains('chord-drop-target'), false);

dragOver({
  clientX: 100,
  dataTransfer: { types: ['text/plain'], files: [] },
  preventDefault() {}
});
dragLeave({ relatedTarget: createElement() });
assert.equal(guide.style.display, 'none');

console.log('Timeline chord drop guide tests passed');
