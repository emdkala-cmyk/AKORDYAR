const assert = require('node:assert/strict');
const MidiChordService = require('../editor/EditorMidiChordService.js');

const service = MidiChordService.create({
  notes: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  chordTemplates: [
    { type: 'maj', tension: '', req: [0, 4, 7] },
    { type: 'min', tension: '', req: [0, 3, 7] },
    { type: 'dim', tension: '', req: [0, 3, 6] }
  ],
  formatType: type => (type === 'min' ? 'm' : type === 'maj' ? '' : type)
});

const major = service.identifyChord([60, 64, 67]);
assert.equal(major.root, 'C');
assert.equal(major.type, 'maj');
assert.equal(major.tension, '');
assert.equal(major.bass, 'None');

const minor = service.identifyChord([57, 60, 64]);
assert.equal(minor.root, 'A');
assert.equal(minor.type, 'min');
assert.equal(minor.bass, 'None');

const diminished = service.identifyChord([60, 63, 66]);
assert.equal(diminished.root, 'C');
assert.equal(diminished.type, 'dim');

assert.equal(service.identifyChord([60, 64]), null);
assert.equal(service.identifyChord([]), null);
assert.equal(
  service.formatChordName({
    root: 'C',
    type: 'maj',
    tension: '',
    bass: 'None'
  }),
  'C'
);
assert.equal(
  service.formatChordName({
    root: 'A',
    type: 'min',
    tension: '7',
    bass: 'G'
  }),
  'Am7/G'
);
assert.equal(
  service.formatChordName({
    root: 'None',
    type: 'None',
    tension: '',
    bass: 'None'
  }),
  'None'
);

console.log('EditorMidiChordService tests passed');
