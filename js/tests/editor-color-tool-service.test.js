const assert = require('node:assert/strict');
const ColorToolService = require(
  '../editor/EditorColorToolService.js'
);

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    values,
    add(...names) {
      names.forEach(name => values.add(name));
    },
    remove(...names) {
      names.forEach(name => values.delete(name));
    },
    toggle(name, force) {
      const next = force === undefined ? !values.has(name) : force;
      if (next) values.add(name);
      else values.delete(name);
      return next;
    },
    contains(name) {
      return values.has(name);
    }
  };
}

function createElement({
  id = '',
  classes = [],
  dataset = {},
  parent = null,
  rect = { left: 0, top: 0, right: 100, bottom: 100 }
} = {}) {
  const classList = createClassList(classes);
  let classNameValue = classes.join(' ');
  let innerHtmlValue = '';
  const listeners = new Map();
  const children = [];

  const element = {
    id,
    dataset: { ...dataset },
    style: {},
    children,
    parentNode: parent,
    classList,
    rect,
    onclick: null,
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    dispatch(type, event = {}) {
      (listeners.get(type) || []).forEach(handler => handler(event));
    },
    getBoundingClientRect() {
      return rect;
    },
    appendChild(child) {
      child.parentNode = element;
      children.push(child);
      return child;
    },
    contains(candidate) {
      return candidate === element ||
        children.some(child => child.contains?.(candidate));
    },
    querySelectorAll(selector) {
      const result = [];
      const visit = node => {
        node.children?.forEach(child => {
          if (matches(child, selector)) result.push(child);
          visit(child);
        });
      };
      visit(element);
      return result;
    },
    closest(selector) {
      const selectors = selector.split(',').map(value => value.trim());
      let current = element;
      while (current) {
        if (selectors.some(value => matches(current, value))) return current;
        current = current.parentNode;
      }
      return null;
    }
  };

  Object.defineProperty(element, 'className', {
    get: () => classNameValue,
    set: value => {
      classNameValue = String(value);
      classList.values.clear();
      classNameValue.split(/\s+/).filter(Boolean).forEach(name => {
        classList.values.add(name);
      });
    }
  });
  Object.defineProperty(element, 'innerHTML', {
    get: () => innerHtmlValue,
    set: value => {
      innerHtmlValue = String(value);
      if (innerHtmlValue === '') children.length = 0;
    }
  });

  return element;
}

function matches(element, selector) {
  if (!element || !selector) return false;
  if (selector.includes(',')) {
    return selector.split(',').some(part => matches(element, part.trim()));
  }
  const idMatch = selector.match(/^#([\w-]+)/);
  if (idMatch && element.id !== idMatch[1]) return false;

  const classMatches = selector.match(/\.[\w-]+/g) || [];
  if (classMatches.some(name => !element.classList.contains(name.slice(1)))) {
    return false;
  }

  const dataMatch = selector.match(
    /\[data-([\w-]+)=["']?([^"'\]]+)["']?\]/
  );
  if (dataMatch) {
    const key = dataMatch[1].replace(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );
    if (element.dataset?.[key] !== dataMatch[2]) return false;
  }

  return Boolean(idMatch || classMatches.length || dataMatch);
}

const allElements = [];
const register = element => {
  allElements.push(element);
  return element;
};
const documentListeners = new Map();
const body = register(createElement({ id: 'body' }));
const quickBar = register(createElement({ id: 'colorQuickBar' }));
const brushButton = register(createElement({ id: 'colorBrushBtn' }));
const eyedropperButton = register(createElement({
  id: 'colorEyedropperBtn'
}));
const colorPicker = register(createElement({ id: 'colorPickerInput' }));
const editor = register(createElement({ id: 'editor' }));
const editorWrap = register(createElement({ id: 'editorWrap' }));
const lanes = register(createElement({ id: 'lanes-container' }));
const lane = register(createElement({
  classes: ['track-lane'],
  dataset: { trackId: 'track-1' },
  parent: lanes
}));
const line = register(createElement({
  classes: ['eline'],
  dataset: { lineIndex: '0' },
  parent: editor
}));
const chordElement = register(createElement({
  classes: ['chord'],
  dataset: { idx: '0' },
  parent: editor
}));
const clipElement = register(createElement({
  classes: ['clip'],
  dataset: { clipId: 'clip-1' },
  parent: lane,
  rect: { left: 0, top: 0, right: 80, bottom: 80 }
}));
const sectionElement = register(createElement({
  classes: ['section-tag'],
  dataset: { sectionId: 'section-1' },
  parent: lanes,
  rect: { left: 80, top: 0, right: 160, bottom: 80 }
}));
lane.appendChild(clipElement);
lanes.appendChild(lane);
lanes.appendChild(sectionElement);
editor.appendChild(line);
editor.appendChild(chordElement);

let pointTarget = clipElement;
const documentRef = {
  body,
  createElement: () => register(createElement()),
  getElementById(id) {
    return allElements.find(element => element.id === id) || null;
  },
  querySelector(selector) {
    return allElements.find(element => matches(element, selector)) || null;
  },
  querySelectorAll(selector) {
    if (selector === '#editor .eline') return [line];
    return allElements.filter(element => matches(element, selector));
  },
  elementFromPoint() {
    return pointTarget;
  },
  addEventListener(type, handler) {
    documentListeners.set(type, handler);
  },
  removeEventListener(type, handler) {
    if (documentListeners.get(type) === handler) {
      documentListeners.delete(type);
    }
  }
};

const song = {
  editorLocked: false,
  styles: { tColor: '#0fa966' },
  chords: [{ name: 'C' }, { name: 'G' }]
};
const chordColors = new Map();
const lineColors = new Map();
const songState = {
  currentSong: () => song,
  getChords: () => song.chords,
  setChordColorStyle: color => { song.chordColorStyle = color; },
  clearChordColors: () => chordColors.clear(),
  setChordColor: (index, color) => chordColors.set(index, color),
  getChordColor: (index, fallback) => chordColors.get(index) || fallback,
  setTextColor: color => { song.styles.tColor = color; },
  clearLineColors: () => lineColors.clear(),
  setLineColor: (index, color) => lineColors.set(index, color),
  getLineColor: (index, fallback) => lineColors.get(index) || fallback,
  getStyles: () => song.styles
};
const daw = {
  clips: [
    { id: 'clip-1', type: 'chord', trackId: 'track-1' },
    { id: 'clip-2', type: 'audio', trackId: 'track-1' }
  ],
  sections: [{ id: 'section-1' }]
};

let saveStateCalls = 0;
let renderChordCalls = 0;
let renderClipCalls = 0;
let saveSongCalls = 0;
let originalClipCalls = 0;
const toasts = [];
const originalClipMouseDown = () => { originalClipCalls += 1; };
let patchedClipMouseDown = null;
const selectedChords = [0, 1];

const service = ColorToolService.create({
  documentRef,
  getElement: id => documentRef.getElementById(id),
  getDAW: () => daw,
  getSongState: () => songState,
  getSelectedChords: () => selectedChords,
  getClip: id => daw.clips.find(clip => clip.id === id),
  getBaseClipMouseDown: () => originalClipMouseDown,
  setClipMouseDown: handler => { patchedClipMouseDown = handler; },
  saveState: () => { saveStateCalls += 1; },
  renderChords: () => { renderChordCalls += 1; },
  renderClips: () => { renderClipCalls += 1; },
  saveSong: () => { saveSongCalls += 1; },
  toast: message => { toasts.push(message); }
});

assert.equal(service.getCurrentColor(), '#3FB8AF');
assert.equal(service.selectColor('#FF2E93'), '#FF2E93');
assert.equal(colorPicker.value, '#FF2E93');
assert.equal(service.toggleColorTool('brush'), 'brush');
assert.equal(service.getColorToolMode(), 'brush');
assert.equal(body.classList.contains('color-tool-brush'), true);
assert.equal(quickBar.classList.contains('show'), true);
assert.equal(quickBar.children.length, 8);

assert.equal(service.applyColorToClip(daw.clips[0], '#FF2E93'), true);
assert.equal(daw.clips[0].color, '#FF2E93');
assert.match(clipElement.style.background, /#FF2E93/);
assert.equal(clipElement.style.borderColor, '#FF2E93');

assert.equal(service.applyColorToSection(daw.sections[0], '#4DB6AC'), true);
assert.equal(daw.sections[0].color, '#4DB6AC');
assert.equal(sectionElement.style.borderColor, '#4DB6AC');

assert.equal(service.paintLyricChord(0), true);
assert.equal(chordColors.get(0), '#FF2E93');
assert.equal(chordColors.get(1), '#FF2E93');
assert.equal(renderChordCalls, 1);

assert.equal(service.paintContextAware({ target: line }), true);
assert.equal(lineColors.get(0), '#FF2E93');
assert.equal(saveSongCalls, 2);

assert.equal(service.bind(), true);
assert.equal(service.bind(), true);
assert.equal(typeof patchedClipMouseDown, 'function');
patchedClipMouseDown({
  button: 0,
  currentTarget: clipElement,
  preventDefault() {},
  stopPropagation() {}
});
assert.equal(originalClipCalls, 0);
assert.equal(renderClipCalls, 1);

assert.equal(service.toggleColorTool('eyedropper'), 'eyedropper');
assert.equal(service.paintLyricChord(0), true);
assert.equal(service.getCurrentColor(), '#FF2E93');
assert.equal(service.getColorToolMode(), null);

assert.equal(service.toggleColorTool('brush'), 'brush');
pointTarget = clipElement;
assert.equal(
  service.beginTimelineBrushDrag({
    button: 0,
    pointerId: 4,
    clientX: 10,
    clientY: 10,
    preventDefault() {},
    stopPropagation() {}
  }),
  true
);
pointTarget = sectionElement;
assert.equal(service.paintTimelineItemAtPoint(90, 10), true);
assert.equal(service.finishTimelineBrushDrag({ pointerId: 4 }), true);
assert.equal(daw.clips[0].color, '#FF2E93');
assert.equal(daw.sections[0].color, '#FF2E93');
assert.equal(body.classList.contains('timeline-color-dragging'), false);
assert.equal(documentListeners.has('pointermove'), false);

pointTarget = null;
assert.equal(
  service.getTimelineItemAtPoint(20, 20),
  clipElement
);

service.toggleColorTool('brush');
assert.equal(service.getColorToolMode(), null);
assert.equal(toasts.length > 0, true);

console.log('EditorColorToolService tests passed');
