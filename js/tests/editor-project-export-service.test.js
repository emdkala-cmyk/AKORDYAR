const assert = require('node:assert/strict');

const exportModule = require('../editor/EditorProjectExportService.js');

const song = {
  id: 'song-1',
  title: 'Export test',
  artist: 'Artist',
  styles: {},
  chords: []
};
const buffer = {
  numberOfChannels: 1,
  sampleRate: 8000,
  length: 4,
  getChannelData: () => new Float32Array([0, 0.25, -0.25, 1])
};
const daw = {
  tracks: [{
    id: 'track-1',
    name: 'Audio',
    type: 'audio',
    _gainNode: {},
    laneHeight: 120
  }],
  clips: [{
    id: 'embedded-clip',
    type: 'audio',
    bufferKey: 'embedded-1',
    _embedded: true,
    _peaks: [1, 2],
    _fileHandle: {},
    _originalBlob: {}
  }, {
    id: 'linked-clip',
    type: 'audio',
    bufferKey: 'linked-1',
    _embedded: false
  }],
  sections: [{ id: 'section-1', start: 0, duration: 2 }],
  loopEnabled: true,
  loopA: 1,
  loopB: 3,
  arrangerMarkers: { enabled: true, start: 5, end: 17 },
  bufferCache: new Map([['embedded-1', buffer]])
};

const progress = [];
const service = exportModule.create({
  syncMetadata: (current, options) => {
    current.artist = 'Synced artist';
    current.includeKey = options.includeKey;
  },
  encodeAudio: async () => new Uint8Array([82, 73, 70, 70]),
  btoaRef: value => Buffer.from(value, 'binary').toString('base64')
});

(async () => {
  const bundle = await service.buildBundle({
    song,
    daw,
    onAudioProgress: value => progress.push(value)
  });

  assert.notEqual(bundle.song, song);
  assert.equal(song.artist, 'Artist');
  assert.equal(bundle.song.artist, 'Synced artist');
  assert.equal(bundle.song.includeKey, false);
  assert.equal(bundle.song._dawTracks[0]._gainNode, undefined);
  assert.equal(bundle.song._dawClips[0]._peaks, undefined);
  assert.equal(bundle.song._dawClips[0]._fileHandle, undefined);
  assert.equal(bundle.song._dawClips[0]._originalBlob, undefined);
  assert.equal(bundle.song._embeddedAudio['embedded-1'].format, 'wav');
  assert.deepEqual(bundle.song._arrangerMarkers, { enabled: true, start: 5, end: 17 });
  assert.equal(bundle.audioCount, 1);
  assert.equal(bundle.linkedCount, 1);
  assert.equal(bundle.defaultName, 'Export test (کامل).json');
  assert.equal(JSON.parse(bundle.data).title, 'Export test');
  assert.deepEqual(progress.map(item => item.index), [1]);

  const fallbackService = exportModule.create({
    encodeAudio: async () => {
      throw new Error('encoder unavailable');
    },
    btoaRef: value => Buffer.from(value, 'binary').toString('base64'),
    logger: { warn() {} }
  });
  const fallback = await fallbackService.buildBundle({ song, daw });
  assert.equal(fallback.song._embeddedAudio['embedded-1'].format, 'float32-b64');
  assert.equal(fallback.song._embeddedAudio['embedded-1'].length, 4);

  console.log('EditorProjectExportService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
