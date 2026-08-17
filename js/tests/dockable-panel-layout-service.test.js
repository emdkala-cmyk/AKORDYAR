const assert = require('node:assert/strict');
const service = require('../core/DockablePanelLayoutService.js');

const normalized = service.normalizeLayoutState({
  mode: 'floating',
  maximized: true,
  floating: {
    left: -80,
    top: -30,
    width: 2400,
    height: 1800
  }
}, {
  width: 1280,
  height: 720
}, {
  minWidth: 280,
  minHeight: 300,
  defaultFloating: {
    left: 20,
    top: 20,
    width: 380,
    height: 620
  }
});

assert.equal(normalized.mode, 'floating');
assert.equal(normalized.maximized, true);
assert.deepEqual(normalized.floating, {
  left: 0,
  top: 0,
  width: 1280,
  height: 720
});

const docked = service.normalizeLayoutState({
  mode: 'unknown',
  maximized: true,
  closed: true
}, {
  width: 1280,
  height: 720
}, {
  minWidth: 280,
  minHeight: 300,
  defaultFloating: {
    left: 20,
    top: 20,
    width: 380,
    height: 620
  }
});

assert.equal(docked.mode, 'docked');
assert.equal(docked.maximized, false);
assert.equal(docked.closed, true);

console.log('DockablePanelLayoutService tests passed');
