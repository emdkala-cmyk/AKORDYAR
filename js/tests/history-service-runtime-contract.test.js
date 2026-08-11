const assert = require('node:assert/strict');

const historyService = require('../editor/HistoryService.js');
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

historyService.init({
  getDAW: () => daw,
  getPERF: () => perf,
  getEdCur: () => song,
  getEdSeqPoints: () => [],
  getAutoSaveTimer: () => null,
  setAutoSaveTimer: () => {},
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

const serialized = historyService.serializeState();
assert.match(serialized, /"song-1"/);
assert.match(serialized, /"akordyar-project"/);

console.log('HistoryService runtime contract tests passed');
