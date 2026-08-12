const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'editor', 'EditorChordVersionService.js'),
  'utf8'
);
const context = { console };
vm.runInNewContext(source, context);

const song = {
  chords: [{ name: 'C' }],
  transpose: 0,
  key: 'C',
  keyMode: 'maj',
  chordVersions: []
};
const daw = {
  tracks: [{ id: 'chords', type: 'chord' }],
  clips: [{
    id: 'old',
    type: 'chord',
    trackId: 'chords',
    name: 'C',
    start: 0,
    duration: 2,
    color: '#fff'
  }]
};
let rendered = 0;
const service = context.EditorChordVersionService.create({
  getSong: () => song,
  getDAW: () => daw,
  uid: prefix => `${prefix}-new`,
  roundMs: value => value,
  renderEditor: () => { rendered += 1; },
  saveState: () => { rendered += 1; },
  renderTracks: () => { rendered += 1; },
  renderClips: () => { rendered += 1; },
  refreshKeyUI: () => { rendered += 1; },
  customPrompt: async () => 'Renamed',
  toast: () => {}
});

(async () => {
  assert.equal(service.ensureInitialized(), true);
  assert.equal(song.chordVersions.length, 1);
  song.chords = [{ name: 'G' }];
  assert.equal(service.saveCurrent(), true);
  assert.equal(song.chordVersions[0].chords[0].name, 'G');

  assert.equal(service.addVersion(), true);
  assert.equal(song.activeChordVersion, 1);
  assert.equal(song.chords.length, 0);
  assert.equal(daw.clips.length, 0);

  song.chords = [{ name: 'Am' }];
  song.chordVersions[1].clips = [{
    name: 'Am',
    start: 4,
    duration: 2,
    color: '#abc'
  }];
  assert.equal(service.switchVersion(-1), true);
  assert.equal(song.activeChordVersion, 0);
  assert.equal(song.chords[0].name, 'G');
  assert.equal(daw.clips.length, 1);

  assert.equal(await service.renameVersion(), true);
  assert.equal(song.chordVersions[0].name, 'Renamed');
  assert.ok(rendered > 0);

  console.log('EditorChordVersionService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
