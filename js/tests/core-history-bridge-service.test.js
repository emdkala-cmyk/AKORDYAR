const assert = require('node:assert/strict');
const CoreHistoryBridgeService = require(
  '../app/CoreHistoryBridgeService.js'
);

let attached = false;
let initContext = null;
const historyService = {
  init(context) {
    initContext = context;
    return true;
  }
};
const song = { id: 'song-1' };
const seqPoints = [{ lineIndex: 0 }];
const calls = [];

const runtime = CoreHistoryBridgeService.create({
  isAttached: () => attached,
  setAttached: value => {
    attached = value;
  },
  getHistoryService: () => historyService,
  getDAW: () => ({ id: 'daw' }),
  getPERF: () => ({ id: 'perf' }),
  getSongState: () => ({ currentSong: () => song }),
  setSong: value => calls.push(['set-song', value]),
  repairSong: value => ({ ...value, repaired: true }),
  getSeqPoints: () => seqPoints,
  setSeqPoints: value => calls.push(['seq', value]),
  clearEditorTimers: () => calls.push('clear-timers'),
  saveSong: () => calls.push('save-song'),
  syncToolbar: () => calls.push('toolbar'),
  renderEditor: value => calls.push(['render-editor', value]),
  updateNextIdFromClips: () => calls.push('next-id'),
  ensureAudioCtx: () => calls.push('audio'),
  updateTrackMix: value => calls.push(['mix', value]),
  peaksFromBuffer: value => [value],
  refreshClipWaveImage: value => calls.push(['wave', value]),
  renderAll: () => calls.push('render-all'),
  scheduleAllFromPlayhead: () => calls.push('schedule'),
  flushPendingCommit: () => calls.push('flush'),
  getCommitTimer: () => 'timer',
  toast: value => calls.push(['toast', value]),
  translate: key => `tr:${key}`,
  logger: { warn() {} }
});

assert.equal(runtime.attach(), historyService);
assert.equal(attached, true);
assert.equal(initContext.getDAW().id, 'daw');
assert.equal(initContext.getPERF().id, 'perf');
assert.equal(initContext.getSong(), song);
assert.deepEqual(initContext.repairSong(song), { id: 'song-1', repaired: true });
assert.deepEqual(initContext.getEdSeqPoints(), seqPoints);
assert.equal(initContext.edCommitTimerRef(), 'timer');
initContext.setSong({ id: 'next' });
initContext.setEdSeqPoints(['next']);
initContext.clearEdTimers();
initContext.edSaveSong();
initContext.edSyncToolbar();
initContext.edRenderEditor(true);
initContext.updateNextIdFromClips();
initContext.ensureAudioCtx();
initContext.updateTrackMix('track-1');
assert.deepEqual(initContext.peaksFromBuffer('buffer'), ['buffer']);
initContext.refreshClipWaveImage('clip-1');
initContext.renderAll();
initContext.scheduleAllFromPlayhead();
initContext.edFlushPendingCommit();
initContext.toast('message');
assert.ok(calls.length > 0);
assert.equal(runtime.attach(), undefined);
assert.equal(initContext.t('key'), 'tr:key');

console.log('CoreHistoryBridgeService tests passed');
