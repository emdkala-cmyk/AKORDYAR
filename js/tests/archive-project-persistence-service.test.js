const assert = require('node:assert/strict');
const ArchiveProjectPersistenceService = require(
  '../archive/ArchiveProjectPersistenceService.js'
);

function createDAW() {
  return {
    clips: [{ id: 'legacy-section', type: 'section', name: 'بند', start: 2, duration: 4, color: '#fff' }],
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
    masterGain: {},
    audioCtx: {}
  };
}

const daw = createDAW();
let currentSong = null;
const calls = [];
const loopButton = {
  classList: {
    toggles: [],
    toggle(...args) {
      this.toggles.push(args);
    }
  }
};
const context = {
  getDAW: () => daw,
  getSong: () => currentSong,
  getSongOrNull: () => currentSong,
  setSong: song => {
    currentSong = song;
  },
  pauseTransport: () => calls.push('pause'),
  stopAllVoices: () => calls.push('stop'),
  resetRecordingState: () => calls.push('recording-reset'),
  isValidNote: note => ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(note),
  updateNextIdFromClips: () => calls.push('next-id'),
  getArrangerMarkers: () => ({ enabled: true, start: 1, end: 8 }),
  ensureAudioCtx: () => calls.push('audio-context'),
  updateTrackMix: () => calls.push('track-mix'),
  loadAudioBlobsForProject: async () => calls.push('load-blobs'),
  saveAudioBlobsForProject: async () => calls.push('save-blobs'),
  peaksFromBuffer: () => [],
  refreshClipWaveImage: () => calls.push('wave-refresh'),
  getFileHandle: async () => null,
  decodeFileToBuffer: async () => ({ buffer: {} }),
  getAudioDirHandle: () => null,
  loadDirHandle: async () => null,
  saveDirHandle: async () => {},
  resetHistory: () => calls.push('history-reset'),
  resetPerformanceSerialization: () => calls.push('performance-reset'),
  edSyncToolbar: () => calls.push('toolbar'),
  edRenderEditor: () => calls.push('editor-render'),
  renderAll: () => calls.push('render-all'),
  saveState: () => calls.push('save-state'),
  getElement: () => loopButton,
  initHighlightEffect: () => calls.push('highlight'),
  rebuildSongDocument: () => calls.push('song-document'),
  syncViewStyles: () => calls.push('view-styles'),
  syncMetadata: song => {
    song.artist = 'هنرمند';
  },
  artistKey: () => 'artist-key',
  saveCurrentVersion: () => calls.push('version'),
  getAllSongs: () => [{ id: 'song-1', title: 'قدیمی' }],
  setAllSongs: songs => {
    context.savedSongs = songs;
  },
  getIsElectron: () => false,
  global: {}
};

const service = ArchiveProjectPersistenceService.create(context);
const loaded = service.load({
  id: 'song-1',
  title: 'ترانه',
  key: 'Am',
  chords: [{ name: 'Am' }],
  _dawTracks: [{ id: 't0', type: 'chord' }],
  _dawClips: [
    { id: 'legacy-section', type: 'section', name: 'بند', start: 2, duration: 4, color: '#fff' },
    { id: 'clip-1', type: 'chord', start: 0 }
  ],
  _dawLoop: { loopEnabled: true, loopA: 3, loopB: 9 }
});

assert.equal(loaded instanceof Promise, true);

loaded.then(async song => {
  assert.equal(song.key, 'A');
  assert.equal(song.keyMode, 'min');
  assert.equal(song.timeSignature, '4/4');
  assert.equal(song.tempo, 120);
  assert.deepEqual(daw.sections, [
    {
      id: 'legacy-section',
      trackId: undefined,
      label: 'بند',
      start: 2,
      duration: 4,
      color: '#fff'
    }
  ]);
  assert.equal(daw.clips[0].id, 'clip-1');
  assert.equal(daw.loopA, 3);
  assert.equal(daw.loopB, 9);
  assert.deepEqual(daw.arrangerMarkers, { enabled: true, start: 1, end: 8 });
  assert.deepEqual(loopButton.classList.toggles.at(-1), ['loop-active', true]);
  assert.ok(calls.includes('song-document'));
  assert.ok(calls.includes('view-styles'));

  daw.tracks = [{ id: 't0', name: 'Chord', type: 'chord' }];
  daw.clips = [
    {
      id: 'audio-1',
      type: 'audio',
      name: 'صوت',
      fileName: 'voice.wav',
      bufferKey: 'buffer-1',
      trackId: 't1',
      _peaks: [1],
      waveUrl: 'blob:url',
      _fileHandle: {},
      _originalBlob: {}
    },
    { id: 'chord-1', type: 'chord', name: '' }
  ];
  daw.sections = [{ id: 'section-1', label: 'بند' }];
  daw.loopEnabled = false;
  daw.loopA = 0;
  daw.loopB = 10;
  daw.arrangerMarkers = { enabled: false, start: 0, end: 0 };

  await service.saveToArchive();
  assert.equal(currentSong.artistKey, 'artist-key');
  assert.equal(context.savedSongs[0].id, 'song-1');
  assert.equal(context.savedSongs[0]._dawClips[0]._peaks, undefined);
  assert.equal(context.savedSongs[0]._dawClips[0].waveUrl, undefined);
  assert.deepEqual(context.savedSongs[0]._audioPaths, [{
    bufferKey: 'buffer-1',
    fileName: 'voice.wav',
    trackId: 't1',
    filePath: null
  }]);
  assert.ok(calls.includes('save-blobs'));
  console.log('ArchiveProjectPersistenceService tests passed');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
