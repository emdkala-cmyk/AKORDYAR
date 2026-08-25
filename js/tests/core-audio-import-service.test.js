const assert = require('node:assert/strict');
const AudioImportService = require('../app/CoreAudioImportService.js');

const daw = {
  loadTrackId: null,
  playhead: 3,
  isPlaying: true,
  clips: [],
  tracks: [{ id: 'track-1', type: 'audio' }],
  pool: {},
  bufferCache: new Map(),
  selectedIds: new Set()
};
const calls = [];
const input = {
  value: 'old',
  files: [],
  click() {
    calls.push('click');
  },
  addEventListener(name, handler) {
    this.handler = handler;
    calls.push(['bind', name]);
  },
  removeEventListener(name, handler) {
    if (this.handler === handler) this.handler = null;
    calls.push(['unbind', name]);
  }
};
const buffer = {
  duration: 4.5,
  sampleRate: 48000,
  numberOfChannels: 2,
  length: 216000
};
const file = {
  name: 'voice.wav',
  path: 'C:\\Audio\\voice.wav',
  size: 128
};
let id = 20;

const service = AudioImportService.create({
  getDAW: () => daw,
  getFileInput: () => input,
  renderTracks: () => calls.push('tracks'),
  clearSelection: () => calls.push('clear'),
  ensureAudioCtx: () => calls.push('ctx'),
  decodeFileToBuffer: async value => {
    calls.push(['decode', value.name]);
    return { buffer };
  },
  askAudioCopyMode: async value => {
    calls.push(['copy-mode', value]);
    return true;
  },
  uid: prefix => `${prefix}${id++}`,
  roundMs: value => Math.round(value * 100) / 100,
  colors: ['#abc'],
  peaksFromBuffer: () => ['peak'],
  refreshClipWaveImage: clip => calls.push(['wave', clip.id]),
  ensureTimelineFits: value => calls.push(['fit', value]),
  saveAudioBlobsForProject: async value => calls.push(['save-blobs', value]),
  saveState: () => calls.push('state'),
  renderAll: () => calls.push('render'),
  scheduleAllFromPlayhead: () => calls.push('schedule'),
  getSong: () => ({ id: 'song-1' }),
  saveSong: () => calls.push('song'),
  toast: value => calls.push(['toast', value]),
  translate: value => `tr:${value}`,
  isElectron: true,
  getElectronAPI: () => ({
    getPathForFile: async () => 'C:\\Audio\\resolved.wav'
  }),
  logger: {
    log: value => calls.push(['log', value]),
    warn: value => calls.push(['warn', value]),
    error: value => calls.push(['error', value])
  }
});

(async () => {
  service.bindFileInput();
  assert.deepEqual(calls.splice(0), [['bind', 'change']]);
  service.openFileForTrack('track-1');
  assert.equal(daw.loadTrackId, 'track-1');
  assert.equal(input.value, '');
  assert.deepEqual(calls.splice(0), ['tracks', 'click']);

  input.files = [file];
  let stopped = false;
  await input.handler({
    target: input,
    stopImmediatePropagation: () => {
      stopped = true;
    }
  });

  const clip = daw.clips[0];
  assert.equal(stopped, true);
  assert.equal(clip.id, 'clip_c20');
  assert.equal(clip.trackId, 'track-1');
  assert.equal(clip.start, 3);
  assert.equal(clip.duration, 4.5);
  assert.equal(clip._embedded, true);
  assert.equal(daw.pool[clip.id].storage.mode, 'copy');
  assert.equal(daw.bufferCache.get(clip.id), buffer);
  assert.deepEqual(daw.selectedIds, new Set([clip.id]));
  assert.deepEqual(calls, [
    'tracks',
    'clear',
    'ctx',
    ['toast', 'tr:decoding'],
    ['decode', 'voice.wav'],
    ['copy-mode', 'voice.wav'],
    ['wave', 'clip_c20'],
    ['fit', 12.5],
    'state',
    'render',
    'schedule',
    ['toast', 'tr:loadedOk voice (کپی در پروژه)'],
    ['save-blobs', 'song-1'],
    'song'
  ]);

  daw.loadTrackId = null;
  let genericStopped = false;
  await service.handleFileInputChange({
    target: input,
    stopImmediatePropagation: () => {
      genericStopped = true;
    }
  });
  assert.equal(genericStopped, false);
  assert.equal(daw.clips.length, 1);

  service.unbindFileInput();
  assert.equal(input.handler, null);
  assert.deepEqual(calls.at(-1), ['unbind', 'change']);

  const linkedDaw = {
    playhead: 0,
    isPlaying: false,
    clips: [],
    pool: {},
    bufferCache: new Map(),
    selectedIds: new Set()
  };
  const linkedService = AudioImportService.create({
    getDAW: () => linkedDaw,
    decodeFileToBuffer: async () => ({ buffer }),
    askAudioCopyMode: async () => false,
    uid: () => 'c30',
    colors: ['#def'],
    isElectron: true,
    getElectronAPI: () => null,
    saveAudioBlobToDB: async (...args) => calls.push(['blob', ...args]),
    toast: () => {},
    saveSong: () => {}
  });
  const linkedClip = await linkedService.importFileForTrack(
    { name: 'linked.mp3', path: 'D:\\Audio\\linked.mp3' },
    'track-1'
  );
  assert.equal(linkedClip._filePath, 'D:\\Audio\\linked.mp3');

  console.log('CoreAudioImportService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
