const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const context = {
  console,
  setTimeout,
  clearTimeout
};
context.window = context;
context.globalThis = context;

function load(relativePath) {
  vm.runInNewContext(
    fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'),
    context,
    { filename: relativePath }
  );
}

load('js/core/EdCurAdapter.js');
load('js/core/EditorRuntimeAdapter.js');
load('js/core/EditorSongRuntimeService.js');
load('js/editor/AudioRecoveryService.js');
load('js/editor/EditorSongInitializationService.js');

let legacySong = null;
context.EditorLegacySongBridge = {
  get: () => legacySong,
  set: song => { legacySong = song; }
};
const runtimeSong = context.EditorSongRuntimeService.create({
  getLegacySong: () => legacySong,
  setLegacySong: song => { legacySong = song; },
  runtimeAdapter: context.EditorRuntimeAdapter
});

const firstSong = { id: 'song-1', title: 'اول' };
assert.equal(runtimeSong.setSong(firstSong), firstSong);
assert.equal(legacySong, firstSong);
assert.equal(context.window.edCur, firstSong);
assert.equal(runtimeSong.getSong(), firstSong);
assert.equal(runtimeSong.assertSynchronized(), true);

const storage = {
  getItem: key => key === 'ed_current_song'
    ? JSON.stringify({ id: 'song-2', title: 'دوم' })
    : null
};
const daw = { clips: [], bufferCache: new Map() };

(async () => {
  const restored = await context.EditorSongInitializationService.initialize({
    storage,
    getSong: runtimeSong.getSong,
    setSong: runtimeSong.setSong,
    blankSong: () => ({ id: 'blank', title: 'خالی' }),
    repairSong: song => ({ ...song, repaired: true }),
    daw,
    loadAudioBlobsForProject: async () => {},
    logger: { log() {}, warn() {} }
  });

  assert.equal(restored.id, 'song-2');
  assert.equal(restored.repaired, true);
  assert.equal(legacySong, restored);
  assert.equal(context.window.edCur, restored);
  assert.equal(runtimeSong.getSong(), restored);
  assert.equal(runtimeSong.assertSynchronized(), true);

  const thirdSong = { id: 'song-3' };
  runtimeSong.setSong(thirdSong);
  assert.equal(runtimeSong.getSong(), thirdSong);
  assert.equal(legacySong, thirdSong);
  assert.equal(context.window.edCur, thirdSong);

  console.log('Editor runtime seam tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
