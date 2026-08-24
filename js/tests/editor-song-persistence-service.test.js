const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorSongPersistenceService.js'),
  'utf8'
);

const context = { console };
vm.runInNewContext(source, context);

const stored = new Map();
const song = {
  artist: 'Artist',
  title: 'Song',
  styles: {},
  chords: []
};
const daw = {
  tracks: [{
    id: 1,
    name: 'Vocal',
    type: 'audio',
    laneHeight: 180,
    _gainNode: {}
  }],
  clips: [{
    id: 2,
    type: 'audio',
    bufferKey: 'audio-1',
    fileName: 'voice.wav',
    _peaks: [1, 2],
    _originalBlob: {}
  }, {
    id: 3,
    type: 'chord',
    bufferKey: 'chord-1'
  }],
  sections: [{ id: 4, start: 0, duration: 4 }],
  loopEnabled: true,
  loopA: 2,
  loopB: 6,
  arrangerMarkers: { enabled: true, start: 4, end: 18 }
};

let metadataSynced = 0;
let blobsScheduled = 0;
let documentRebuilt = 0;
let viewsSynced = 0;

const service = context.EditorSongPersistenceService.create({
  getSong: () => song,
  getDAW: () => daw,
  syncMetadata: current => {
    metadataSynced += 1;
    current.genre = 'Pop';
  },
  artistKey: artist => `key:${artist}`,
  storage: {
    setItem(key, value) {
      stored.set(key, value);
    }
  },
  scheduleAudioBlobSave: () => { blobsScheduled += 1; },
  rebuildSongDocument: () => { documentRebuilt += 1; },
  syncViewStyles: () => { viewsSynced += 1; }
});

assert.equal(service.save(), true);
assert.equal(metadataSynced, 1);
assert.equal(song.artistKey, 'key:Artist');
assert.equal(song._dawTracks[0].laneHeight, 180);
assert.equal(song._dawClips[0]._peaks, undefined);
assert.equal(song._dawClips[0]._originalBlob, undefined);
assert.equal(song._audioPaths.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(song._dawLoop)), {
  loopEnabled: true,
  loopA: 2,
  loopB: 6
});
assert.deepEqual(JSON.parse(JSON.stringify(song._arrangerMarkers)), {
  enabled: true,
  start: 4,
  end: 18
});
assert.equal(stored.has('ed_current_song'), true);
assert.equal(blobsScheduled, 1);
assert.equal(documentRebuilt, 1);
assert.equal(viewsSynced, 1);
assert.equal(service.save(), true);

console.log('EditorSongPersistenceService tests passed');
