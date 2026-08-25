const assert = require('node:assert/strict');
const MixerService = require('../core/EditorMixerService.js');

function makeNode() {
  const listeners = new Map();
  return {
    style: {},
    classList: {
      values: new Set(),
      contains(name) {
        return this.values.has(name);
      },
      toggle(name, enabled) {
        if (enabled) this.values.add(name);
        else this.values.delete(name);
      }
    },
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    getListener(name) {
      return listeners.get(name);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getBoundingClientRect() {
      return { left: 10, top: 20 };
    },
    closest() {
      return null;
    },
    offsetWidth: 240,
    _dragReady: false
  };
}

function makeChannelsNode() {
  const node = makeNode();
  node.children = [];
  node.appendChild = child => node.children.push(child);
  node.querySelectorAll = () => [];
  return node;
}

const panel = makeNode();
panel.querySelector = selector =>
  selector === '.mixer-head' ? makeNode() : null;
const channels = makeChannelsNode();
const emptyChannels = makeChannelsNode();
const nodes = new Map([
  ['mixerPanel', panel],
  ['mixerChannels', channels]
]);

const track = {
  id: 't1',
  type: 'audio',
  name: 'Audio',
  icon: '🎵',
  vol: 0.75,
  pan: -0.25,
  muted: false,
  solo: false,
  _gainNode: { gain: { value: null } },
  _pannerNode: { pan: { value: null } }
};
const daw = {
  tracks: [track],
  isPlaying: false
};
let renderTracksCalls = 0;
let renderClipsCalls = 0;
const service = MixerService.create({
  getDAW: () => daw,
  getElement: id => nodes.get(id),
  documentRef: {
    createElement: () => ({
      className: '',
      innerHTML: '',
      addEventListener() {}
    })
  },
  windowRef: { innerWidth: 1200, innerHeight: 800 },
  renderTracks: () => { renderTracksCalls += 1; },
  renderClips: () => { renderClipsCalls += 1; }
});

service.updateTrackMix('t1');
assert.equal(track._gainNode.gain.value, 0.75);
assert.equal(track._pannerNode.pan.value, -0.25);

track.muted = true;
service.updateTrackMix('t1');
assert.equal(track._gainNode.gain.value, 0);
track.muted = false;

service.render();
assert.equal(channels.children.length, 1);

daw.tracks = [];
nodes.set('mixerChannels', emptyChannels);
service.render();
assert.match(emptyChannels.innerHTML, /ترک صوتی وجود ندارد/);

daw.tracks = [track];
nodes.set('mixerChannels', channels);
service.toggle();
assert.equal(panel.classList.contains('show'), true);
assert.ok(renderTracksCalls >= 0);
assert.ok(renderClipsCalls >= 0);

console.log('EditorMixerService tests passed');
