const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorSongInitializationService.js'),
  'utf8'
);

const context = { console };
vm.runInNewContext(source, context);

const song = {
  id: 7,
  title: 'Saved',
  _audioPaths: []
};
const storage = {
  getItem: key => key === 'ed_current_song'
    ? JSON.stringify(song)
    : null
};
const daw = {
  clips: [],
  tracks: [],
  sections: [],
  bufferCache: new Map()
};

let currentSong = null;
let hydrated = 0;
let rendered = 0;
let reset = 0;
let saved = 0;
let highlight = 0;
const lifecycle = [];

(async () => {
  const restored = await context.EditorSongInitializationService.initialize({
    storage,
    getSong: () => currentSong,
    setSong: value => { currentSong = value; },
    blankSong: () => ({ id: 1, title: 'Blank' }),
    repairSong: value => ({ ...value, repaired: true }),
    hydrationService: {
      hydrateSong: value => {
        lifecycle.push('hydrate');
        hydrated += 1;
        value.hydrated = true;
      }
    },
    daw,
    loadAudioBlobsForProject: async () => {
      lifecycle.push('audio-restore');
    },
    syncToolbar: () => { rendered += 1; },
    renderEditor: () => { rendered += 1; },
    resetHistory: () => {
      lifecycle.push('reset-history');
      reset += 1;
    },
    deactivateHistory: () => {
      lifecycle.push('deactivate-history');
    },
    activateHistory: () => {
      lifecycle.push('activate-history');
    },
    renderAll: () => { rendered += 1; },
    saveState: () => {
      lifecycle.push('save-state');
      saved += 1;
    },
    initHighlightEffect: () => { highlight += 1; }
  });

  assert.equal(restored.title, 'Saved');
  assert.equal(restored.repaired, true);
  assert.equal(restored.hydrated, true);
  assert.equal(currentSong, restored);
  assert.equal(hydrated, 1);
  assert.equal(reset, 1);
  assert.equal(saved, 1);
  assert.equal(highlight, 1);
  assert.equal(rendered, 5);
  assert.ok(
    lifecycle.indexOf('deactivate-history') <
      lifecycle.indexOf('hydrate')
  );
  assert.ok(
    lifecycle.indexOf('hydrate') <
      lifecycle.indexOf('reset-history')
  );
  assert.ok(
    lifecycle.indexOf('reset-history') <
      lifecycle.indexOf('activate-history')
  );
  assert.ok(
    lifecycle.indexOf('activate-history') <
      lifecycle.indexOf('save-state')
  );

  console.log('EditorSongInitializationService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
