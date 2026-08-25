const assert = require('node:assert/strict');
const SyncModeBridge = require('../app/CoreSyncModeBridgeService.js');

const calls = [];
const controllerOptions = [];
const state = { active: false };
const seqState = { clMarkers: [] };

class FakeSyncModeController {
  constructor(options) {
    controllerOptions.push(options);
  }

  renderSyncLyrics(value) { calls.push(['renderSyncLyrics', value]); return 'rendered'; }
  selectSyncLine(value) { calls.push(['selectSyncLine', value]); return value; }
  syncTap() { calls.push(['syncTap']); return 'tapped'; }
  updateSyncHighlight() { calls.push(['updateSyncHighlight']); return 'highlighted'; }
  syncTick() { calls.push(['syncTick']); return 'ticked'; }
  enterSyncMode() { calls.push(['enterSyncMode']); return 'entered'; }
  exitSyncMode() { calls.push(['exitSyncMode']); return 'exited'; }
  edToggleSeqMode() { calls.push(['edToggleSeqMode']); return 'seq-toggled'; }
  edStartSeqChording() { calls.push(['edStartSeqChording']); return 'seq-started'; }
  edSeqNavigate(value) { calls.push(['edSeqNavigate', value]); return value; }
  edUpdateClCount() { calls.push(['edUpdateClCount']); return 'counted'; }
  edRenderClMarkers() { calls.push(['edRenderClMarkers']); return 'markers'; }
  edSetSeqMode(value) { calls.push(['edSetSeqMode', value]); return value; }
  edToggleClTap() { calls.push(['edToggleClTap']); return 'cl-toggled'; }
  edClTap() { calls.push(['edClTap']); return 'cl-tapped'; }
  edClUndoMarker() { calls.push(['edClUndoMarker']); return 'cl-undone'; }
  edClClearMarkers() { calls.push(['edClClearMarkers']); return 'cl-cleared'; }
  edClApplyMarkers() { calls.push(['edClApplyMarkers']); return 'cl-applied'; }
  initSyncUI() { calls.push(['initSyncUI']); return 'initialized'; }
}

const service = SyncModeBridge.create({
  controllerClass: FakeSyncModeController,
  state,
  seqState,
  getDAW: () => ({ playhead: 0 }),
  songState: { getLyrics: () => '' },
  getElement: () => null,
  translate: key => `tr:${key}`,
  toast: () => {},
  saveSong: () => {},
  startTransport: () => {},
  pauseTransport: () => {},
  seekTransport: () => {},
  getProjectEnd: () => 0,
  renderChords: () => {},
  commit: () => {},
  saveState: () => {},
  renderAll: () => {},
  uid: prefix => `${prefix}-1`,
  roundMs: value => value,
  ensureTimelineFits: () => {},
  timeToX: value => value,
  formatTime: value => String(value),
  openChordLinePopup: () => {},
  getPerformanceStore: () => null,
  windowRef: {},
  windowBridge: {},
  logger: { log() {} }
});

assert.equal(service.createSyncModeControllerBridge(), service.requireSyncModeController());
assert.equal(controllerOptions.length, 1);
assert.equal(controllerOptions[0].state, state);
assert.equal(controllerOptions[0].seqState, seqState);
assert.equal(service.renderSyncLyrics('value'), 'rendered');
assert.equal(service.selectSyncLine(3), 3);
assert.equal(service.syncTap(), 'tapped');
assert.equal(service.edSeqNavigate(-1), -1);
assert.equal(service.edClApplyMarkers(), 'cl-applied');
assert.equal(service.initSyncUI(), 'initialized');
assert.deepEqual(calls, [
  ['renderSyncLyrics', 'value'],
  ['selectSyncLine', 3],
  ['syncTap'],
  ['edSeqNavigate', -1],
  ['edClApplyMarkers'],
  ['initSyncUI']
]);

const missing = SyncModeBridge.create({ controllerClass: null });
assert.equal(missing.createSyncModeControllerBridge(), null);
assert.throws(
  () => missing.requireSyncModeController(),
  /SyncModeController در دسترس نیست/
);

console.log('CoreSyncModeBridgeService tests passed');
