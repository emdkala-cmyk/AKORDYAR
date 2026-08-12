const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const historyService = require('../editor/HistoryService.js');
const coreSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'core.js'),
  'utf8'
);
assert.doesNotMatch(coreSource, /_autoSaveTimer/);
const daw = {
  project: { id: 'p1', name: 'Test' },
  tracks: [],
  clips: [],
  sections: [],
  pool: {},
  selectedIds: new Set(),
  selectedSectionIds: new Set(),
  bufferCache: new Map(),
  isPlaying: false
};
const perf = {
  lastSerializedState: '',
  tracksVersion: 0,
  clipsVersion: 0
};
const song = { id: 'song-1', title: 'Test', lyrics: '', chords: [] };

historyService.init(null);
assert.equal(historyService.isHistoryContextReady(), false);
assert.equal(historyService.activate(), false);
assert.equal(historyService.saveState(), false);

historyService.init({
  getDAW: () => daw,
  getPERF: () => perf,
  getEdCur: () => song,
  getEdSeqPoints: () => [],
  clearEdTimers: () => {},
  edSaveSong: () => {},
  updateNextIdFromClips: () => {},
  ensureAudioCtx: () => {},
  updateTrackMix: () => {},
  peaksFromBuffer: () => [],
  refreshClipWaveImage: () => {},
  renderAll: () => {},
  scheduleAllFromPlayhead: () => {},
  edSyncToolbar: () => {},
  edRenderEditor: () => {},
  setEdCur: () => {},
  setEdSeqPoints: () => {},
  edFlushPendingCommit: () => {},
  edCommitTimerRef: () => null,
  toast: () => {},
  t: key => key
});

assert.equal(historyService.isHistoryContextReady(), true);
assert.equal(historyService.isEnabled(), false);
assert.equal(historyService.saveState(), false);
assert.equal(historyService.activate(), true);
assert.equal(historyService.isEnabled(), true);

const serialized = historyService.serializeState();
assert.match(serialized, /"song-1"/);
assert.match(serialized, /"akordyar-project"/);
assert.equal(historyService.saveState(), true);

historyService.init({
  getDAW: () => daw,
  getPERF: () => perf,
  getEdCur: () => null,
  getEdSeqPoints: () => [],
  setEdCur: () => {},
  setEdSeqPoints: () => {}
});
assert.equal(historyService.activate(), false);
assert.equal(historyService.serializeState(), null);
assert.equal(historyService.saveState(), false);
historyService.deactivate();

console.log('HistoryService runtime contract tests passed');
