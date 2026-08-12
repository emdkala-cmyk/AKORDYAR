const assert = require('node:assert/strict');
const service = require('../editor/AudioDropImportService.js');

const daw = {
  tracks: [{ id: 'track-1', type: 'audio' }],
  clips: [],
  bufferCache: new Map(),
  playhead: 2,
  selectedIds: new Set()
};
const song = { id: 'song-1', _audioPaths: [] };
const calls = [];
let nextId = 1;

const dropService = service.create({
  getDAW: () => daw,
  getSong: () => song,
  clearSelection: () => calls.push('clear'),
  ensureAudioCtx: () => calls.push('audio-context'),
  askAudioCopyMode: async () => false,
  decodeFileToBuffer: async () => ({
    buffer: { duration: 3 }
  }),
  uid: prefix => `${prefix}-${nextId++}`,
  roundMs: value => Math.round(value * 1000) / 1000,
  colors: ['#123456'],
  peaksFromBuffer: () => [0.5],
  refreshClipWaveImage: () => calls.push('wave'),
  ensureTimelineFits: value => calls.push(['fit', value]),
  saveAudioBlobToDB: async () => calls.push('blob'),
  saveAudioBlobsForProject: async () => calls.push('project-blobs'),
  saveState: () => calls.push('save-state'),
  renderAll: () => calls.push('render'),
  saveSong: () => calls.push('save-song'),
  toast: message => calls.push(['toast', message]),
  isElectron: true
});

const files = [
  { type: 'audio/mpeg', name: 'voice.mp3', path: 'C:\\voice.mp3' },
  { type: 'text/plain', name: 'notes.txt' }
];
assert.equal(dropService.audioFilesFrom({ files }).length, 1);

(async () => {
  await dropService.importFiles(
    [files[0]],
    { target: { closest: () => ({ dataset: { trackId: 'track-1' } }) } }
  );

  assert.equal(daw.clips.length, 1);
  assert.equal(daw.clips[0].start, 2);
  assert.equal(daw.clips[0].duration, 3);
  assert.equal(daw.clips[0]._filePath, 'C:\\voice.mp3');
  assert.deepEqual(song._audioPaths, [{
    bufferKey: daw.clips[0].bufferKey,
    fileName: 'voice.mp3',
    trackId: 'track-1',
    filePath: 'C:\\voice.mp3'
  }]);
  assert.deepEqual([...daw.selectedIds], [daw.clips[0].id]);
  assert.deepEqual(calls.filter(call => typeof call === 'string'), [
    'clear',
    'audio-context',
    'wave',
    'save-state',
    'render',
    'save-song'
  ]);

  console.log('AudioDropImportService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
