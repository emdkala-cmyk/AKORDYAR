const assert = require('node:assert/strict');
const service = require('../core/TimelinePanelLayoutService.js');

const normalized = service.normalizeLayoutState({
  mode: 'floating',
  maximized: true,
  dockHeight: 40,
  headerWidth: 900,
  floating: {
    left: -200,
    top: -100,
    width: 4000,
    height: 3000
  }
}, {
  width: 1440,
  height: 900
});

assert.equal(normalized.mode, 'floating');
assert.equal(normalized.maximized, true);
assert.equal(normalized.dockHeight, 120);
assert.equal(normalized.headerWidth, 520);
assert.deepEqual(normalized.floating, {
  left: 0,
  top: 0,
  width: 1440,
  height: 900
});

const docked = service.normalizeLayoutState({
  mode: 'unknown',
  maximized: true
}, {
  width: 1280,
  height: 720
});

assert.equal(docked.mode, 'docked');
assert.equal(docked.maximized, false);

console.log('TimelinePanelLayoutService tests passed');
