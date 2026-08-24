const assert = require('node:assert/strict');
const hydration = require('../editor/EditorHydrationService.js');

const song = {
  id: 7,
  lyrics: '',
  _dawTracks: [{ id: 'audio-1', type: 'audio' }],
  _dawClips: [
    { id: 'section-1', type: 'section', trackId: 'audio-1', name: 'Intro', start: 0, duration: 4 },
    { id: 'clip-1', type: 'audio', start: 4, duration: 2 }
  ],
  _dawLoop: { loopEnabled: true, loopA: 2, loopB: 8 },
  _arrangerMarkers: { enabled: true, start: 3, end: 9 }
};

const repaired = hydration.normalizeSong(song, {
  repairSong: value => ({ ...value, repaired: true }),
  styleDefaults: { tSize: 23, cSize: 23 }
});

assert.equal(repaired.repaired, true);
assert.equal(repaired.styles.tSize, 23);
assert.equal(repaired.styles.cSize, 23);
assert.deepEqual(repaired.lineColors, []);
assert.deepEqual(repaired.chordVersions, []);

const daw = { tracks: [], clips: [], sections: [] };
const result = hydration.restoreDawState(repaired, {
  daw,
  cloneTracks: true,
  cloneClips: true,
  cloneSections: true
});

assert.equal(result.migratedSections.length, 1);
assert.equal(daw.tracks[0].id, 'audio-1');
assert.deepEqual(daw.sections[0], {
  id: 'section-1',
  trackId: 'audio-1',
  label: 'Intro',
  start: 0,
  duration: 4,
  color: undefined
});
assert.equal(daw.clips.length, 1);
assert.equal(daw.loopEnabled, true);
assert.equal(daw.loopA, 2);
assert.equal(daw.loopB, 8);
assert.deepEqual(daw.arrangerMarkers, { enabled: true, start: 3, end: 9 });
assert.deepEqual(result.arrangerMarkers, { enabled: true, start: 3, end: 9 });

console.log('EditorHydrationService tests passed');
