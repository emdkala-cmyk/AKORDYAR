const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const TempoMap = require('../core/TempoMap.js');
const TimelineGridService = require('../app/CoreTimelineGridService.js');

function createWorld() {
  const dom = new JSDOM(`<!doctype html><body>
    <div id="timeline-ruler"></div>
    <div id="ruler-labels"></div>
    <div id="tl-inner"></div>
    <div id="lanes-container"></div>
    <div id="tempo-markers-overlay"></div>
    <div id="tempo-markers-timeline-overlay"></div>
    <input id="edTempo" value="120">
    <select id="edTimeSig">
      <option value="4/4">4/4</option>
      <option value="6/8">6/8</option>
    </select>
  </body>`);
  const timing = { tempo: 120, timeSignature: '4/4' };
  let map = TempoMap.create(timing)
    .changeAt(2, { tempo: 150, timeSignature: '6/8' });
  timing.tempoMap = map.toJSON();
  const daw = {
    tempoMap: map.toJSON(),
    playhead: 1,
    isPlaying: false,
    pxPerSecond: 80
  };

  const service = TimelineGridService.create({
    documentRef: dom.window.document,
    getElement: id => dom.window.document.getElementById(id),
    getDAW: () => daw,
    getTimingContext: () => timing,
    tempoMap: TempoMap,
    timelineGrid: {
      renderRuler(options) {
        options.onDurationChange(20);
        return 'rendered';
      }
    },
    getProjectEnd: () => 10,
    timeToX: value => value * 80,
    setTempoMap: next => {
      map = next;
      timing.tempoMap = next.toJSON();
      daw.tempoMap = next.toJSON();
      return true;
    },
    setSongBaseTiming: base => {
      timing.tempo = base.tempo;
      timing.timeSignature = base.timeSignature;
    },
    getTransportState: () => ({ metroActive: false }),
    formatTimeSignature: value => String(value),
    getTransportPlayhead: () => daw.playhead
  });

  return {
    dom,
    daw,
    timing,
    getMap: () => map,
    service
  };
}

const world = createWorld();
world.service.renderTempoMarkers();

const rulerOverlay = world.dom.window.document.getElementById(
  'tempo-markers-overlay'
);
const timelineOverlay = world.dom.window.document.getElementById(
  'tempo-markers-timeline-overlay'
);
const marker = rulerOverlay.querySelector('.timing-marker');

assert.ok(marker, 'a timing marker is rendered');
assert.equal(marker.querySelectorAll('.timing-marker-entry').length, 2);
assert.equal(marker.querySelectorAll('.tempo-marker-badge').length, 1);
assert.equal(marker.querySelectorAll('.signature-marker-badge').length, 1);
assert.equal(timelineOverlay.querySelectorAll('.tempo-marker-line').length, 1);
assert.equal(
  timelineOverlay.querySelectorAll('.signature-marker-line').length,
  1
);

world.service.syncTimingControlsAt(1, world.getMap());
assert.equal(
  world.dom.window.document.getElementById('edTempo').value,
  '120'
);
assert.equal(
  world.dom.window.document.getElementById('edTimeSig').value,
  '4/4'
);
world.service.syncTimingControlsAt(2, world.getMap());
assert.equal(
  world.dom.window.document.getElementById('edTempo').value,
  '150'
);
assert.equal(
  world.dom.window.document.getElementById('edTimeSig').value,
  '6/8'
);
assert.equal(
  rulerOverlay.querySelector('.timing-marker').classList.contains('is-active'),
  true
);

const tempoRemove = rulerOverlay.querySelector(
  '.tempo-marker-badge + .timing-marker-remove'
);
tempoRemove.click();
assert.equal(world.getMap().getTimingAt(2).tempo, 120);
assert.equal(world.getMap().getTimingAt(2).timeSignature, '6/8');
assert.equal(
  rulerOverlay.querySelectorAll('.tempo-marker-badge').length,
  0
);
assert.equal(
  rulerOverlay.querySelectorAll('.signature-marker-badge').length,
  1
);

const signatureRemove = rulerOverlay.querySelector(
  '.signature-marker-badge + .timing-marker-remove'
);
signatureRemove.click();
assert.equal(world.getMap().getSegments().length, 1);
assert.equal(rulerOverlay.querySelectorAll('.timing-marker').length, 0);
assert.equal(rulerOverlay.style.display, 'none');

console.log('Timing marker service tests passed');
