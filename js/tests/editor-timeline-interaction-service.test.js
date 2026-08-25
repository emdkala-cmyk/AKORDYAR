const assert = require('node:assert/strict');
const TimelineInteractionService =
  require('../editor/EditorTimelineInteractionService.js');

function createElement(id) {
  const listeners = new Map();
  const classes = new Set();
  return {
    id,
    classList: {
      toggle(name, force) {
        const next = force === undefined ? !classes.has(name) : Boolean(force);
        if (next) classes.add(name);
        else classes.delete(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) listeners.delete(type);
    },
    dispatch(type, event = {}) {
      const handler = listeners.get(type);
      if (!handler) return;
      handler({ ...event, currentTarget: this });
    },
    listenerCount() {
      return listeners.size;
    },
    getBoundingClientRect() {
      return { top: 100, height: 40 };
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    listeners
  };
}

const elements = new Map(
  [
    'lanes-container',
    'tl-scroll',
    'timeline-ruler',
    'playhead-hit',
    'main-playhead'
  ].map(id => [id, createElement(id)])
);
const daw = {
  laneHeight: 64,
  pxPerSecond: 100,
  playhead: 2,
  isRecording: false,
  selectedPlayhead: false,
  loopEnabled: true,
  loopA: 1,
  loopB: 5
};
const verticalZooms = [];
const horizontalZooms = [];
const seeks = [];
const toasts = [];
let clearTextCount = 0;
let clearChordCount = 0;
let clearSelectionCount = 0;
let renderLoopCount = 0;
let saveCount = 0;
let autoScrollCount = 0;

const service = TimelineInteractionService.create({
  getElement: id => elements.get(id),
  getDAW: () => daw,
  setVerticalZoom: value => verticalZooms.push(value),
  setZoom: (...args) => horizontalZooms.push(args),
  toast: message => toasts.push(message),
  translate: key => key === 'dawReady' ? 'READY' : key,
  clearEditorTextSelection: () => { clearTextCount += 1; },
  clearChordSelection: () => { clearChordCount += 1; },
  clearSelection: () => { clearSelectionCount += 1; },
  seekTransport: (...args) => seeks.push(args),
  xToTime: value => value / 100,
  clientToTime: value => value / 100,
  autoScrollToPlayhead: () => { autoScrollCount += 1; },
  renderLoopRegion: () => { renderLoopCount += 1; },
  saveState: () => { saveCount += 1; }
});

assert.equal(service.init(), true);
assert.equal(service.init(), true);
assert.deepEqual(toasts, ['READY']);

elements.get('tl-scroll').dispatch('wheel', {
  altKey: false,
  ctrlKey: false,
  deltaY: -1,
  preventDefault() {
    throw new Error('plain wheel must not be consumed');
  }
});
elements.get('tl-scroll').dispatch('wheel', {
  altKey: true,
  ctrlKey: false,
  deltaY: 1,
  clientX: 200,
  preventDefault() {}
});
assert.deepEqual(horizontalZooms[0], [100 / 1.12, 200]);

elements.get('tl-scroll').dispatch('wheel', {
  altKey: true,
  ctrlKey: true,
  deltaY: -1,
  preventDefault() {}
});
assert.equal(verticalZooms[0], 64 * 1.15);

elements.get('timeline-ruler').dispatch('pointerdown', {
  clientX: 250,
  clientY: 110,
  ctrlKey: true,
  metaKey: false,
  shiftKey: false,
  pointerId: 1,
  preventDefault() {}
});
assert.equal(daw.loopB, 2.5);
assert.equal(renderLoopCount, 1);
assert.equal(saveCount, 1);

elements.get('timeline-ruler').dispatch('pointerdown', {
  clientX: 300,
  clientY: 130,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  pointerId: 2,
  preventDefault() {}
});
assert.deepEqual(seeks[0], [3, true]);
elements.get('timeline-ruler').dispatch('pointermove', {
  clientX: 350,
  clientY: 120,
  pointerId: 2
});
assert.deepEqual(seeks[1], [3.5, true]);
assert.equal(autoScrollCount, 1);
elements.get('timeline-ruler').dispatch('pointerup', { pointerId: 2 });

elements.get('playhead-hit').dispatch('pointerdown', {
  clientX: 100,
  clientY: 100,
  shiftKey: true,
  pointerId: 3,
  preventDefault() {}
});
assert.equal(daw.selectedPlayhead, true);
assert.equal(elements.get('main-playhead').classList.contains('selected'), true);
elements.get('playhead-hit').dispatch('pointermove', {
  clientX: 200,
  clientY: 90,
  pointerId: 3
});
assert.deepEqual(seeks[2], [3, false]);
elements.get('playhead-hit').dispatch('pointerup', { pointerId: 3 });

daw.isRecording = true;
elements.get('timeline-ruler').dispatch('pointerdown', {
  clientX: 100,
  clientY: 130,
  pointerId: 4,
  preventDefault() {}
});
assert.equal(toasts.at(-1), 'در حال ضبط — برای جابه‌جایی پلی‌هد ابتدا توقف کنید');
assert.equal(clearTextCount, 3);
assert.equal(clearChordCount, 3);
assert.equal(clearSelectionCount, 2);

assert.equal(service.destroy(), true);
assert.equal(service.destroy(), false);
assert.equal(elements.get('tl-scroll').listenerCount(), 0);
assert.equal(elements.get('timeline-ruler').listenerCount(), 0);
assert.equal(elements.get('playhead-hit').listenerCount(), 0);

console.log('EditorTimelineInteractionService tests passed');
