const assert = require('node:assert/strict');
const TimelineRuntimeService = require(
  '../app/CoreTimelineRuntimeService.js'
);

const names = [
  'CoreTimelineGeometryService',
  'EditorWaveformBridgeService',
  'CoreClipService',
  'CoreTimelineChordEditorBridgeService',
  'CoreTrackSetupService',
  'CoreTimelineRendererService',
  'CoreTimelineGridService',
  'CoreTimelineSectionBridgeService',
  'CoreClipRendererService'
];
const calls = [];
const fakeGlobal = {
  setTimeout,
  t: key => key,
  RuntimeStateAdapter: { getDAW: () => ({}) }
};

function service(name, factory) {
  return {
    create: options => {
      calls.push(name);
      return factory(options);
    }
  };
}

const geometry = {
  timeToX: value => value * 2,
  xToTime: value => value / 2,
  timeToBarBeat: () => ({ bar: 1, beat: 1 }),
  barBeatToTime: () => 0,
  getProjectEnd: () => 20,
  ensureTimelineFits: value => value,
  clientToTime: value => value,
  clientToInnerPoint: (x, y) => ({ x, y }),
  autoScrollToPlayhead: () => {}
};
const waveform = {
  service: { id: 'waveform' },
  decodeFileToBuffer: () => 'decoded',
  peaksFromBuffer: () => [],
  drawWaveToCanvas: () => 'drawn',
  refreshClipWaveImage: () => {}
};
const clips = {
  getClip: () => null,
  selectedClips: () => [],
  splitClipAt: () => null,
  splitSelectedAtPlayhead: () => {}
};
const chordEditor = { openTimelineChordEditor: () => {} };
const trackSetup = {
  getIconSvg: () => '',
  openIconPicker: () => {},
  addNewTrack: () => {}
};
const renderer = {
  getTimelineTrackRendererService: () => null,
  updateTrackSelectionUI: () => {},
  selectTrack: () => null,
  renderTracks: () => {}
};
const grid = {
  drawLaneGrid: () => {},
  renderRuler: () => {},
  handleTimingChange: () => {}
};
const sectionBridge = {
  getTimelineSectionRendererService: () => ({
    renderSections: () => {}
  })
};
const clipRenderer = { render: () => {} };

const runtime = TimelineRuntimeService.create({
  documentRef: {},
  windowRef: fakeGlobal,
  getDAW: () => ({}),
  getSongState: () => ({ getTimingContext: () => ({}) }),
  geometryService: service('geometry', () => geometry),
  waveformBridgeService: service('waveform', () => waveform),
  clipService: service('clips', () => clips),
  chordEditorService: service('chord-editor', () => chordEditor),
  trackSetupService: service('track-setup', () => trackSetup),
  timelineRendererService: service('renderer', () => renderer),
  timelineGridService: service('grid', () => grid),
  sectionBridgeService: service('section-bridge', () => sectionBridge),
  clipRendererService: service('clip-renderer', () => clipRenderer)
});

assert.deepEqual(calls, [
  'geometry',
  'waveform',
  'clips',
  'chord-editor',
  'track-setup',
  'renderer',
  'grid',
  'section-bridge',
  'clip-renderer'
]);
assert.equal(runtime.timeToX(3), 6);
assert.equal(runtime.getProjectEnd(), 20);
assert.equal(runtime.waveformService.id, 'waveform');
assert.equal(runtime.decodeFileToBuffer('x'), 'decoded');
assert.equal(runtime.renderClips({ preserveWaveforms: true }), undefined);
assert.equal(runtime.getTimelineSectionRendererService().renderSections(), undefined);

console.log('CoreTimelineRuntimeService tests passed');
