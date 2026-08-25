const assert = require('node:assert/strict');
const ClipInteraction = require('../app/CoreClipInteractionService.js');

function createElement({
  dataset = {},
  rect = { left: 0, top: 0, width: 20, height: 20 },
  selectors = {},
  trackId = null
} = {}) {
  const classes = new Set();
  return {
    dataset: { ...dataset },
    style: {},
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains: name => classes.has(name)
    },
    getBoundingClientRect: () => rect,
    querySelectorAll: selector => selectors[selector] || [],
    closest: selector => selector === '.track-lane' && trackId
      ? { dataset: { trackId } }
      : null,
    blur() {}
  };
}

const events = [];
const editor = createElement();
const marquee = createElement();
const inner = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 })
};
const laneTarget = createElement({ trackId: 't2' });
const clipElement = createElement({
  dataset: { clipId: 'c1' },
  rect: { left: 5, top: 5, width: 40, height: 20 }
});
const sectionElement = createElement({
  dataset: { sectionId: 's1' },
  rect: { left: 55, top: 5, width: 40, height: 20 }
});
const lane = createElement({
  dataset: { trackId: 't1' },
  selectors: {
    '.clip': [clipElement],
    '.section-tag': [sectionElement]
  }
});

const documentRef = {
  querySelectorAll(selector) {
    if (selector === '.track-lane') return [lane];
    if (selector === '.clip') return [clipElement];
    if (selector === '.section-tag') return [sectionElement];
    return [];
  },
  getElementById(id) {
    return {
      editor,
      marquee,
      'tl-inner': inner
    }[id] || null;
  },
  elementFromPoint: () => laneTarget,
  removeEventListener(type, handler) {
    events.push(['remove', type, handler]);
  }
};

const daw = {
  tracks: [
    { id: 't1', type: 'audio', locked: false },
    { id: 't2', type: 'audio', locked: false }
  ],
  clips: [{
    id: 'c1',
    type: 'audio',
    trackId: 't1',
    start: 0,
    duration: 2,
    offset: 0,
    sourceDuration: 10,
    bufferKey: 'buffer-1'
  }],
  sections: [{ id: 's1', trackId: 't1', start: 0, duration: 1 }],
  selectedIds: new Set(),
  selectedSectionIds: new Set(),
  bufferCache: new Map(),
  isPlaying: true,
  drag: null,
  marquee: null
};

const calls = [];
let pointerCallbacks = null;
const service = ClipInteraction.create({
  documentRef,
  getElement: id => documentRef.getElementById(id),
  getDAW: () => daw,
  getClip: id => daw.clips.find(clip => clip.id === id),
  selectedClips: () => daw.clips.filter(clip => daw.selectedIds.has(clip.id)),
  clearEditorTextSelection: () => calls.push('clear-text'),
  clearChordSelection: () => calls.push('clear-chords'),
  renderClips: () => calls.push('render-clips'),
  renderAll: () => calls.push('render-all'),
  renderRuler: () => calls.push('render-ruler'),
  updateHud: () => calls.push('hud'),
  clientToTime: value => value / 10,
  clientToInnerPoint: (x, y) => ({ x, y }),
  xToTime: value => value / 10,
  snapTime: value => value,
  roundMs: value => Math.round(value * 100) / 100,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  ensureTimelineFits: value => calls.push(['fit', value]),
  refreshClipWaveImage: () => calls.push('wave'),
  peaksFromBuffer: () => [1, 2],
  cutAtTime: (...args) => calls.push(['cut', ...args]),
  openTimelineChordEditor: id => calls.push(['open-chord', id]),
  startPointerDrag: (...args) => {
    pointerCallbacks = args.slice(2);
    calls.push('start-drag');
  },
  saveState: () => calls.push('save'),
  scheduleAllFromPlayhead: () => calls.push('schedule'),
  toast: message => calls.push(['toast', message]),
  uid: prefix => `${prefix}2`,
  clearTimer: timer => calls.push(['clear-timer', timer])
});

daw.marquee = { trackId: 't1' };
assert.deepEqual(service.getMarqueeLaneElements('.clip'), [clipElement]);
assert.deepEqual(service.getMarqueeLaneElements('.section-tag'), [sectionElement]);
daw.marquee = null;

service.onClipMouseDown({
  button: 0,
  clientX: 10,
  clientY: 8,
  currentTarget: clipElement,
  target: clipElement,
  stopPropagation() {},
  preventDefault() {}
});
assert.deepEqual(daw.selectedIds, new Set(['c1']));
assert.equal(daw.drag.type, 'move');
assert.equal(pointerCallbacks.length, 2);

service.onDocMouseMove({
  clientX: 20,
  clientY: 8,
  target: laneTarget
});
assert.equal(daw.clips[0].start, 1);
assert.ok(calls.includes('render-ruler'));
assert.ok(calls.includes('hud'));

service.onDocMouseUp();
assert.equal(daw.drag, null);
assert.equal(daw.clips[0].trackId, 't2');
assert.ok(calls.includes('save'));
assert.ok(calls.includes('schedule'));
assert.ok(calls.includes('render-all'));
assert.equal(events.filter(item => item[0] === 'remove').length, 2);

service.onClipMouseDown({
  button: 0,
  shiftKey: true,
  clientX: 35,
  clientY: 8,
  currentTarget: clipElement,
  target: clipElement,
  stopPropagation() {},
  preventDefault() {}
});
assert.deepEqual(calls.at(-1), ['cut', 3.5, 't2']);

daw.marquee = { trackId: 't1', x0: 0, y0: 0 };
service.onDocMouseMove({ clientX: 100, clientY: 30, target: inner });
assert.equal(daw.selectedIds.has('c1'), true);
assert.equal(daw.selectedSectionIds.has('s1'), true);
assert.equal(marquee.style.display, 'block');
service.onDocMouseUp();
assert.equal(daw.marquee, null);
assert.equal(marquee.style.display, 'none');

console.log('CoreClipInteractionService tests passed');
