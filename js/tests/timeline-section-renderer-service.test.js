const assert = require('node:assert/strict');

const sectionModule = require('../core/TimelineSectionRendererService.js');

const oldTag = { removed: false, remove() { this.removed = true; } };
const sectionChildren = [];
const lane = {
  querySelector: () => null,
  appendChild: child => sectionChildren.push(child)
};
const created = [];
const documentRef = {
  querySelectorAll: selector => selector === '.section-tag' ? [oldTag] : [],
  querySelector: () => lane,
  getElementById: () => ({ id: 'timeline-inner' }),
  createElement: tag => {
    const listeners = {};
    const element = {
      tag,
      className: '',
      dataset: {},
      style: {},
      textContent: '',
      contentEditable: 'false',
      addEventListener: (name, handler) => { listeners[name] = handler; },
      removeEventListener: name => { delete listeners[name]; },
      appendChild: child => { element.children.push(child); },
      children: [],
      focus() {},
      blur() {
        listeners.blur?.();
      },
      _listeners: listeners
    };
    created.push(element);
    return element;
  },
  createRange: () => ({
    selectNodeContents() {}
  })
};

const selection = {
  removeAllRanges() {},
  addRange() {}
};
const daw = {
  selectedIds: new Set(),
  selectedSectionIds: new Set(),
  sections: [{
    id: 'section-1',
    trackId: 'track-1',
    label: 'Verse',
    start: 2,
    duration: 4,
    color: '#3FB8AF'
  }]
};
let scheduled = null;
let cleared = null;
let renderCount = 0;
let dragArgs = null;
const service = sectionModule.create({
  documentRef,
  windowRef: { getSelection: () => selection },
  getDAW: () => daw,
  timeToX: value => value * 10,
  xToTime: value => value / 10,
  snapTime: value => Math.round(value * 2) / 2,
  roundMs: value => Math.round(value * 100) / 100,
  renderClips: () => { renderCount += 1; },
  selectedClips: () => [{
    id: 'clip-1',
    start: 1,
    duration: 2,
    offset: 0
  }],
  startPointerDrag: (...args) => { dragArgs = args; },
  schedule: callback => {
    scheduled = callback;
    return 7;
  },
  clearTimer: timer => { cleared = timer; }
});

service.renderSections();

assert.equal(oldTag.removed, true);
assert.equal(sectionChildren.length, 1);
assert.equal(created.length, 3);
const element = sectionChildren[0];
assert.equal(element.className, 'section-tag');
assert.equal(element.dataset.sectionId, 'section-1');
assert.equal(element.style.left, '20px');
assert.equal(element.style.width, '50px');
assert.equal(element.textContent, 'Verse');
assert.equal(element.children.length, 2);

element._listeners.mousedown({
  button: 0,
  clientX: 100,
  clientY: 20,
  ctrlKey: false,
  metaKey: false,
  currentTarget: element,
  stopPropagation() {},
  preventDefault() {}
});

assert.equal(scheduled !== null, true);
assert.equal(daw.selectedSectionIds.has('section-1'), true);
assert.equal(renderCount, 1);
assert.equal(daw.drag.primaryId, 'section-1');
assert.equal(daw.drag.items.length, 2);
assert.equal(dragArgs[0].id, 'timeline-inner');

element._listeners.mousedown({
  button: 0,
  clientX: 100,
  clientY: 20,
  ctrlKey: false,
  metaKey: false,
  currentTarget: element,
  stopPropagation() {},
  preventDefault() {}
});
assert.equal(cleared, 7);
assert.equal(element.contentEditable, 'true');

console.log('TimelineSectionRendererService tests passed');
