const assert = require('node:assert/strict');
const RendererBridge = require('../app/CoreTimelineRendererService.js');

const calls = [];
let factoryCalls = 0;
const daw = {
  tracks: [{ id: 't1' }],
  selectedTrackId: null
};
const globals = {
  TimelineTrackRendererService: {
    create: options => {
      factoryCalls += 1;
      calls.push([
        options.getDAW(),
        options.translate('label'),
        options.clientToTime(12),
        options.uid('x')
      ]);
      return {
        updateTrackSelectionUI: () => calls.push('selection-ui'),
        selectTrack: id => {
          calls.push(['select', id]);
          return daw.tracks[0];
        },
        renderTracks: () => {
          calls.push('render-tracks');
        }
      };
    }
  },
  getEditorDAW: () => daw,
  requireEditorSongStateService: () => ({ currentSong: () => ({}) }),
  t: value => `translated:${value}`,
  clientToTime: value => value / 2,
  uid: prefix => `${prefix}99`
};
const previous = {};
for (const [key, value] of Object.entries(globals)) {
  previous[key] = globalThis[key];
  globalThis[key] = value;
}

try {
  const service = RendererBridge.create({
    documentRef: {},
    windowRef: {},
    getDAW: globals.getEditorDAW,
    getSongState: globals.requireEditorSongStateService
  });

  assert.equal(factoryCalls, 0);
  assert.equal(service.selectTrack('t1'), daw.tracks[0]);
  assert.equal(service.renderTracks(), undefined);
  service.updateTrackSelectionUI();
  assert.equal(factoryCalls, 1);
  assert.deepEqual(calls.slice(0, 2), [
    [daw, 'translated:label', 6, 'x99'],
    ['select', 't1']
  ]);
  assert.deepEqual(calls.slice(2), ['render-tracks', 'selection-ui']);
  assert.equal(
    service.getTimelineTrackRendererService(),
    service.getTimelineTrackRendererService()
  );
} finally {
  for (const key of Object.keys(globals)) {
    if (previous[key] === undefined) delete globalThis[key];
    else globalThis[key] = previous[key];
  }
}

console.log('CoreTimelineRendererService tests passed');
