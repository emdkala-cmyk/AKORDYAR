const assert = require('node:assert/strict');
const CoreClipRendererService = require(
  '../app/CoreClipRendererService.js'
);

function createElement(tagName = 'div') {
  const listeners = new Map();
  const element = {
    tagName,
    style: {},
    dataset: {},
    className: '',
    children: [],
    listeners,
    removed: false,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    remove() {
      this.removed = true;
    },
    querySelector(selector) {
      if (selector === '.empty-lane-hint') {
        return this.emptyHint || null;
      }
      return null;
    }
  };
  let html = '';
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return html;
    },
    set(value) {
      html = value;
    }
  });
  return element;
}

const existingClip = createElement();
const hint = createElement();
const laneAudio = createElement('section');
laneAudio.emptyHint = hint;
const laneChord = createElement('section');
const storageBar = createElement();
const storageText = createElement();
const documentRef = {
  querySelectorAll(selector) {
    return selector === '.clip' ? [existingClip] : [];
  },
  querySelector(selector) {
    const match = selector.match(/data-track-id="([^"]+)"/);
    if (match?.[1] === 'track-audio') return laneAudio;
    if (match?.[1] === 'track-chord') return laneChord;
    return null;
  },
  createElement
};
documentRef.getElementById = id => ({
  storageInfoBar: storageBar,
  storageText
}[id] || null);

const audioClip = {
  id: 'audio-1',
  trackId: 'track-audio',
  type: 'audio',
  start: 1,
  duration: 2,
  color: '#00aa88',
  name: 'Voice',
  waveUrl: ''
};
const chordClip = {
  id: 'chord-1',
  trackId: 'track-chord',
  type: 'chord',
  start: 3,
  duration: 1,
  color: '#aa55ff',
  name: 'Cmaj7'
};
const daw = {
  clips: [audioClip, chordClip],
  selectedIds: new Set(['chord-1'])
};
const calls = [];

const runtime = CoreClipRendererService.create({
  documentRef,
  getDAW: () => daw,
  timeToX: value => value * 100,
  refreshClipWaveImage: clip => {
    calls.push(['wave', clip.id]);
    clip.waveUrl = 'data:image/png;base64,test';
  },
  getClipFilePath: () => 'C:\\audio\\voice.wav',
  onClipMouseDown: event => calls.push(['pointer', event.type]),
  openTimelineChordEditor: clipId => calls.push(['chord-editor', clipId]),
  renderSections: () => calls.push('sections')
});

runtime.render();

assert.equal(existingClip.removed, true);
assert.equal(hint.removed, true);
assert.equal(laneAudio.children.length, 1);
assert.equal(laneChord.children.length, 1);
assert.equal(laneAudio.children[0].style.left, '100px');
assert.equal(laneAudio.children[0].style.width, '200px');
assert.match(laneChord.children[0].className, /selected/);
assert.deepEqual(calls.slice(0, 2), [['wave', 'audio-1'], 'sections']);

const audioElement = laneAudio.children[0];
audioElement.listeners.get('mouseenter')();
assert.equal(storageBar.style.display, 'block');
assert.equal(storageText.textContent, 'C:\\audio\\voice.wav');
audioElement.listeners.get('mouseleave')();
assert.equal(storageBar.style.display, 'none');
assert.equal(storageText.textContent, '');
audioElement.listeners.get('pointerdown')({ type: 'pointerdown' });
assert.ok(calls.some(call => call[0] === 'pointer'));

const chordElement = laneChord.children[0];
chordElement.listeners.get('dblclick')({
  preventDefault() {},
  stopPropagation() {}
});
assert.ok(calls.some(call => call[0] === 'chord-editor'));

calls.length = 0;
audioClip.waveUrl = 'cached-wave';
runtime.render({ preserveWaveforms: true });
assert.deepEqual(calls, ['sections']);

console.log('CoreClipRendererService tests passed');
