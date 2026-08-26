const assert = require('node:assert/strict');
require('../archive/ArchiveProjectAudioRecoveryService.js');
const ArchiveProjectFileImportService = require(
  '../archive/ArchiveProjectFileImportService.js'
);

function createElement(value = '') {
  return {
    value,
    classList: {
      toggles: [],
      toggle(...args) {
        this.toggles.push(args);
      }
    }
  };
}

const elements = new Map([
  ['importText', createElement()],
  ['importUrl', createElement()],
  ['loopToggleBtn', createElement()]
]);
const daw = {
  clips: [],
  sections: [],
  selectedIds: new Set(['old']),
  selectedSectionIds: new Set(['old-section']),
  bufferCache: new Map([['old', {}]]),
  waveCache: new Map([['old', {}]]),
  loopEnabled: true,
  loopA: 2,
  loopB: 4,
  arrangerMarkers: { enabled: true, start: 2, end: 4 },
  tracks: [],
  masterGain: {}
};
let currentSong = null;
const calls = [];
const toasts = [];
const recoveryCalls = [];
const audioRecovery = {
  restoreEmbeddedAudio: async () => recoveryCalls.push('embedded'),
  restoreLinkedAudio: async () => recoveryCalls.push('linked')
};

const service = ArchiveProjectFileImportService.create({
  getDAW: () => daw,
  getSong: () => currentSong,
  getElement: id => elements.get(id),
  setEditorSong: song => {
    currentSong = song;
  },
  setProjectFilePath: value => calls.push(['path', value]),
  clearProjectFilePath: () => calls.push(['clear-path']),
  pauseTransport: () => calls.push(['pause']),
  stopAllVoices: () => calls.push(['stop']),
  updateNextIdFromClips: () => calls.push(['next-id']),
  getArrangerMarkers: () => ({ enabled: true, start: 1, end: 8 }),
  ensureAudioCtx: () => calls.push(['audio-context']),
  updateTrackMix: () => calls.push(['track-mix']),
  applyImportChords: parsed => {
    calls.push(['apply-import', parsed]);
    currentSong.lyrics = 'متن پردازش‌شده';
  },
  loadAudioBlobsForProject: async () => calls.push(['load-blobs']),
  saveAudioBlobsForProject: async () => calls.push(['save-blobs']),
  resetHistory: () => calls.push(['history']),
  resetPerformanceSerialization: () => calls.push(['performance']),
  syncToolbar: () => calls.push(['toolbar']),
  renderEditor: value => calls.push(['editor', value]),
  initHighlightEffect: () => calls.push(['highlight']),
  saveState: () => calls.push(['state']),
  saveSong: () => calls.push(['save-song']),
  renderAll: () => calls.push(['render-all']),
  audioRecovery,
  toast: message => toasts.push(message),
  logError: error => calls.push(['error', error.message])
});

(async () => {
  const result = await service.importSingle({
    name: 'RawSong.akordyar',
    _projectFilePath: 'C:\\Projects\\RawSong.akordyar',
    text: async () => JSON.stringify({
      id: 'song-1',
      title: 'ترانه',
      rawText: 'C  متن',
      url: 'https://example.test/song'
    })
  });

  assert.equal(result.ok, true);
  assert.equal(currentSong.title, 'ترانه');
  assert.equal(currentSong.lyrics, 'متن پردازش‌شده');
  assert.equal(currentSong.styles.tSize, 38);
  assert.equal(currentSong.timeSignature, '4/4');
  assert.equal(currentSong.tempo, 120);
  assert.equal(currentSong.genre, '');
  assert.deepEqual(daw.selectedIds, new Set());
  assert.deepEqual(daw.selectedSectionIds, new Set());
  assert.deepEqual(daw.arrangerMarkers, { enabled: true, start: 1, end: 8 });
  assert.deepEqual(elements.get('loopToggleBtn').classList.toggles.at(-1), [
    'loop-active',
    false
  ]);
  assert.deepEqual(calls.slice(0, 3), [
    ['path', 'C:\\Projects\\RawSong.akordyar'],
    ['pause'],
    ['stop']
  ]);
  const importCall = calls.find(call => call[0] === 'apply-import');
  assert.ok(importCall);
  assert.equal(importCall[1].rawText, 'C  متن');
  assert.ok(calls.some(call => call[0] === 'state'));
  assert.ok(calls.some(call => call[0] === 'save-song'));
  assert.ok(calls.some(call => call[0] === 'render-all'));
  assert.equal(toasts.at(-1), 'پروژه لود شد: RawSong.akordyar');

  const failed = await service.importSingle({
    name: 'broken.akordyar',
    text: async () => '{broken'
  });
  assert.equal(failed.ok, false);
  assert.match(toasts.at(-1), /خطا در لود فایل/);
  assert.ok(calls.some(call => call[0] === 'error'));

  const audioResult = await service.importSingle({
    name: 'AudioSong.akordyar',
    text: async () => JSON.stringify({
      id: 'song-audio',
      title: 'ترانه صوتی',
      _dawClips: [{
        id: 'audio-1',
        type: 'audio',
        bufferKey: 'buffer-1'
      }]
    })
  });
  assert.equal(audioResult.ok, true);
  assert.deepEqual(recoveryCalls, ['embedded', 'linked']);

  console.log('ArchiveProjectFileImportService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
