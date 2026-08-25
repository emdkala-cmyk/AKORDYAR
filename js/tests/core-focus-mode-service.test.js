const assert = require('node:assert/strict');
const FocusModeService = require('../app/CoreFocusModeService.js');

function classList() {
  const values = new Set();
  return {
    values,
    toggle: (value, force) => {
      const shouldAdd = force === undefined ? !values.has(value) : force;
      if (shouldAdd) values.add(value);
      else values.delete(value);
    },
    contains: value => values.has(value)
  };
}

const body = { classList: classList() };
const grid = { style: { gridTemplateRows: 'auto 1fr auto' } };
const calls = [];
let focusMode = false;
let renderScheduled = 0;
const service = FocusModeService.create({
  documentRef: {
    body,
    querySelector: () => grid
  },
  getElement: id => id === 'app-container' ? grid : null,
  getFocusMode: () => focusMode,
  setFocusMode: value => {
    focusMode = value;
  },
  getSongState: () => ({
    currentSong: () => ({ id: 'song-1' })
  }),
  schedule: callback => {
    renderScheduled += 1;
    callback();
  },
  renderChords: () => calls.push('render'),
  toast: value => calls.push(['toast', value]),
  translate: key => `tr:${key}`
});

service.toggleFocusMode();
assert.equal(focusMode, true);
assert.equal(body.classList.contains('focus-mode'), true);
assert.equal(grid.style.gridTemplateRows, '');
assert.deepEqual(calls, [['toast', 'tr:focusMode'], 'render']);
assert.equal(renderScheduled, 1);

service.toggleFocusMode();
assert.equal(focusMode, false);
assert.equal(body.classList.contains('focus-mode'), false);
assert.equal(grid.style.gridTemplateRows, 'auto 1fr auto');
assert.deepEqual(calls.at(-2), ['toast', 'tr:normalMode']);
assert.equal(calls.at(-1), 'render');

console.log('CoreFocusModeService tests passed');
