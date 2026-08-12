const assert = require('node:assert/strict');
const service = require('../core/TimelineViewportService.js');

assert.equal(
  service.getScrollLeftForPlayhead({
    playheadX: 0,
    scrollLeft: 700,
    viewportWidth: 500,
    mode: 'page',
    margin: 60,
    maxScrollLeft: 2000
  }),
  0,
  'returning to start must move the timeline viewport to the beginning'
);

assert.equal(
  service.getScrollLeftForPlayhead({
    playheadX: 1200,
    scrollLeft: 100,
    viewportWidth: 500,
    mode: 'page',
    margin: 60,
    maxScrollLeft: 2000
  }),
  1140,
  'page mode keeps the playhead inside the right-side margin'
);

assert.equal(
  service.getScrollLeftForPlayhead({
    playheadX: 900,
    scrollLeft: 0,
    viewportWidth: 500,
    mode: 'center',
    margin: 60,
    maxScrollLeft: 2000
  }),
  650,
  'center mode keeps the playhead centered'
);

console.log('TimelineViewportService tests passed');
