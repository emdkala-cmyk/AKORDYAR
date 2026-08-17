const assert = require('node:assert/strict');
const service = require('../core/TimelineScrollbarsService.js');

assert.equal(
  service.calculateProxyExtent({
    contentExtent: 2000,
    viewportExtent: 500,
    proxyViewportExtent: 500
  }),
  2000,
  'equal viewports preserve the real content extent'
);

assert.equal(
  service.calculateProxyExtent({
    contentExtent: 2000,
    viewportExtent: 500,
    proxyViewportExtent: 516
  }),
  2016,
  'proxy compensation keeps both maximum scroll offsets equal'
);

assert.equal(
  service.calculateProxyExtent({
    contentExtent: 300,
    viewportExtent: 500,
    proxyViewportExtent: 500
  }),
  500,
  'a short project does not create a fake scrollbar range'
);

console.log('TimelineScrollbarsService tests passed');
