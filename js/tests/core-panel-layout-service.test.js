const assert = require('node:assert/strict');
const PanelLayoutService = require('../app/CorePanelLayoutService.js');

const classList = (...initial) => {
  const values = new Set(initial);
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    contains: value => values.has(value)
  };
};

const app = {
  style: {},
  dataset: {}
};
const timeline = { style: { display: '' } };
const separator = { style: {} };
const projectPanel = {
  style: { display: '' },
  classList: classList()
};
const songPropertiesPanel = {
  style: { display: '' },
  classList: classList()
};
const elements = {
  projectPanel,
  songPropertiesPanel,
  timelineSep: separator
};
const storageValues = new Map();
const storage = {
  getItem: key => storageValues.get(key) || null,
  setItem: (key, value) => storageValues.set(key, value)
};
const documentRef = {
  querySelector: selector => {
    if (selector === '.app-container') return app;
    if (selector === '.timeline') return timeline;
    return null;
  },
  getElementById: id => elements[id] || null
};
const created = [];
const panelFactory = {
  create: options => {
    const layout = {
      options,
      init: () => created.push(options.panelId),
      toggleClosed: () => created.push(`toggle:${options.panelId}`)
    };
    return layout;
  }
};
const timelineScrollbarsService = {
  create: () => ({
    init: () => created.push('timeline-scrollbars'),
    syncGeometry: () => {}
  })
};
const timelinePanelLayoutService = {
  create: () => ({
    init: () => created.push('timeline-panel'),
    toggleClosed: () => created.push('toggle:timeline')
  })
};
const service = PanelLayoutService.create({
  documentRef,
  windowRef: { innerHeight: 900, localStorage: storage },
  panelLayoutService: panelFactory,
  timelineScrollbarsService,
  timelinePanelLayoutService
});

assert.equal(service.setTimelinePanelHeight(500), 500);
assert.equal(app.dataset.timelinePanelHeight, '500');
assert.equal(app.style.gridTemplateRows, 'auto minmax(0, 1fr) 4px 500px');
assert.equal(storageValues.get('akordyar.timelinePanelHeight'), '500');
assert.equal(service.getTimelinePanelHeight(), 500);

service.togglePanel('timeline');
assert.equal(timeline.style.display, 'none');
assert.equal(separator.style.display, 'none');
assert.equal(app.style.gridTemplateRows, 'auto 1fr 0px 0px');
service.togglePanel('timeline');
assert.equal(timeline.style.display, '');
assert.equal(separator.style.display, '');

service.initDockableSidePanels();
assert.deepEqual(created, [
  'timeline-scrollbars',
  'timeline-panel',
  'projectPanel',
  'songPropertiesPanel'
]);
assert.equal(service.syncDockableSidePanelGrid(), undefined);
assert.equal(
  app.style.gridTemplateColumns,
  '240px minmax(0, 1fr) 300px'
);

service.togglePanel('sidebar');
assert.deepEqual(created.at(-1), 'toggle:projectPanel');
service.togglePanel('timeline');
assert.deepEqual(created.at(-1), 'toggle:timeline');

console.log('CorePanelLayoutService tests passed');
