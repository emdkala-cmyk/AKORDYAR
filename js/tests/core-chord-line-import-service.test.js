const assert = require('node:assert/strict');
const CoreChordLineSync = require('../app/CoreChordLineSyncService.js');

const cubaseXml = `<?xml version="1.0"?>
<vst-xml version="1.4">
  <chord><name>Bb</name><projectTime domain="quarterNotes">12</projectTime><pitches>A#2;D3;F3;</pitches></chord>
  <chord><name>Dmin</name><projectTime domain="quarterNotes">14</projectTime><pitches>A2;D3;F3;</pitches></chord>
  <chord><name>Gmin</name><projectTime domain="quarterNotes">16</projectTime><pitches>A#2;D3;G3;</pitches></chord>
  <chord><name>Bb</name><projectTime domain="quarterNotes">18</projectTime><pitches>A#2;D3;F3;</pitches></chord>
</vst-xml>`;

const chordService = {
  identifyChord: pitches => {
    const signature = [...pitches].sort((a, b) => a - b).join(',');
    if (signature === '58,62,65') {
      return { root: 'Bb', type: 'maj', tension: '', bass: 'None' };
    }
    if (signature === '62,65,69') {
      return { root: 'D', type: 'min', tension: '', bass: 'None' };
    }
    return null;
  },
  formatChordName: chord =>
    chord ? `${chord.root}${chord.type === 'min' ? 'm' : ''}` : 'None'
};

const importedDaw = {
  tracks: [
    { id: 'import-chords', type: 'chord' },
    { id: 'import-audio', type: 'audio' }
  ],
  clips: [
    { id: 'old-chord', type: 'chord', trackId: 'import-chords', name: 'Old' },
    { id: 'keep-audio', type: 'audio', trackId: 'import-audio', name: 'Voice' }
  ],
  isPlaying: true
};
const importedCalls = [];
const importedService = CoreChordLineSync.create({
  getDAW: () => importedDaw,
  getSongState: () => ({
    currentSong: () => ({ tempo: 120 })
  }),
  parser: {
    parseFile: async () => ({
      division: { type: 'ppqn', ticksPerQuarter: 480 },
      tempoMap: { events: [{ bpm: 120 }] },
      tracks: [{
        name: 'Chord Line',
        notes: [
          { pitch: 58, startTick: 0, endTick: 480, startSeconds: 0, endSeconds: 0.5 },
          { pitch: 62, startTick: 0, endTick: 480, startSeconds: 0, endSeconds: 0.5 },
          { pitch: 65, startTick: 0, endTick: 480, startSeconds: 0, endSeconds: 0.5 },
          { pitch: 62, startTick: 960, endTick: 1440, startSeconds: 1, endSeconds: 1.5 },
          { pitch: 65, startTick: 960, endTick: 1440, startSeconds: 1, endSeconds: 1.5 },
          { pitch: 69, startTick: 960, endTick: 1440, startSeconds: 1, endSeconds: 1.5 }
        ]
      }]
    })
  },
  chordService,
  uid: prefix => `${prefix}-import-${importedDaw.clips.length}`,
  colors: ['#123456'],
  saveState: () => importedCalls.push('save'),
  saveSong: () => importedCalls.push('song'),
  saveCurrentVersion: () => importedCalls.push('version'),
  renderAll: () => importedCalls.push('render'),
  ensureTimelineFits: value => importedCalls.push(['fit', value]),
  scheduleAllFromPlayhead: () => importedCalls.push('schedule'),
  toast: message => importedCalls.push(['toast', message])
});

assert.deepEqual(
  importedService.parseCubaseChordXml(cubaseXml, 120),
  [
    { name: 'Bb', start: 6, duration: 1 },
    { name: 'Dm', start: 7, duration: 1 },
    { name: 'Gm', start: 8, duration: 1 },
    { name: 'Bb', start: 9, duration: 1 }
  ]
);

assert.deepEqual(
  importedService.alignEventsToStart(
    [
      { name: 'Bb', start: 6, duration: 1 },
      { name: 'Dm', start: 7, duration: 1 },
      { name: 'Gm', start: 8, duration: 1 }
    ],
    10
  ),
  [
    { name: 'Bb', start: 10, duration: 1 },
    { name: 'Dm', start: 11, duration: 1 },
    { name: 'Gm', start: 12, duration: 1 }
  ]
);

assert.deepEqual(
  importedService.midiChordEvents({
    division: { type: 'ppqn', ticksPerQuarter: 480 },
    tempoMap: { events: [{ bpm: 120 }] },
    tracks: [{
      name: 'Chord Line',
      notes: [
        { pitch: 58, startTick: 0, endTick: 480, startSeconds: 0, endSeconds: 0.5 },
        { pitch: 62, startTick: 0, endTick: 480, startSeconds: 0, endSeconds: 0.5 },
        { pitch: 65, startTick: 0, endTick: 480, startSeconds: 0, endSeconds: 0.5 },
        { pitch: 62, startTick: 960, endTick: 1440, startSeconds: 1, endSeconds: 1.5 },
        { pitch: 65, startTick: 960, endTick: 1440, startSeconds: 1, endSeconds: 1.5 },
        { pitch: 69, startTick: 960, endTick: 1440, startSeconds: 1, endSeconds: 1.5 }
      ]
    }]
  }),
  [
    { name: 'Bb', start: 0, duration: 1 },
    { name: 'Dm', start: 1, duration: 1 }
  ]
);

(async () => {
  const midiCount = await importedService.importChordLineFile({
    name: 'cubase-chords.mid',
    type: 'audio/midi',
    arrayBuffer: async () => new ArrayBuffer(0)
  });
  assert.equal(midiCount, 2);
  assert.deepEqual(
    importedDaw.clips
      .filter(clip => clip.type === 'chord')
      .map(clip => [clip.name, clip.start, clip.duration]),
    [['Bb', 0, 1], ['Dm', 1, 1]]
  );
  assert.equal(
    importedDaw.clips.some(clip => clip.id === 'keep-audio'),
    true
  );
  assert.equal(importedDaw.selectedTrackId, 'import-chords');
  assert.deepEqual(importedCalls.slice(0, 5), [
    'save',
    ['fit', 7],
    'version',
    'song',
    'render'
  ]);
  assert.equal(importedCalls.includes('schedule'), true);

  const xmlCount = await importedService.importChordLineText(cubaseXml);
  assert.equal(xmlCount, 4);
  assert.deepEqual(
    importedDaw.clips
      .filter(clip => clip.type === 'chord')
      .map(clip => clip.name),
    ['Bb', 'Dm', 'Gm', 'Bb']
  );
  console.log('CoreChordLineSyncService import tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
