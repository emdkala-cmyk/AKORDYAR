const assert = require('node:assert/strict');
const SyncAnalysisUiService = require(
  '../editor/EditorSyncAnalysisUiService.js'
);

const elements = {
  edTempo: { value: '' },
  edKey: { value: '' },
  edKeyMode: { value: '' }
};
let now = 0;
let syncTimes = [];
let chords = [];
const changes = [];
const messages = [];
const song = {
  setTempo: value => {
    changes.push(['tempo', value]);
    return true;
  },
  setKey: (key, mode) => {
    changes.push(['key', key, mode]);
    return true;
  },
  getSyncTimes: () => syncTimes,
  getChords: () => chords
};

const service = SyncAnalysisUiService.create({
  analysis: {
    detectTempoFromSyncTimes: () => ({
      ok: true,
      bpm: 96,
      intervals: [0.625, 0.625]
    }),
    detectKeyFromChords: () => ({
      ok: true,
      key: 'D',
      mode: 'min',
      score: 0.82
    })
  },
  getSongState: () => song,
  performanceRef: { now: () => now },
  getElement: id => elements[id] || null,
  saveSong: () => changes.push(['save']),
  handleTimingChange: () => changes.push(['timing']),
  syncToolbar: () => changes.push(['toolbar']),
  renderEditor: () => changes.push(['render']),
  toast: message => messages.push(message)
});

now = 0;
service.tapTempo();
now = 500;
service.tapTempo();
assert.equal(elements.edTempo.value, 120);
assert.deepEqual(changes.slice(0, 3), [
  ['tempo', 120],
  ['save'],
  ['timing']
]);

syncTimes = [0.5];
service.detectTempo();
assert.equal(messages.at(-1), 'ابتدا سینک دستی را انجام دهید (حداقل ۲ لاین)');

syncTimes = [0.5, 1.125, 1.75];
service.detectTempo();
assert.equal(elements.edTempo.value, 96);
assert.deepEqual(changes.slice(-3), [
  ['tempo', 96],
  ['save'],
  ['timing']
]);

chords = [];
service.detectKey();
assert.equal(messages.at(-1), 'آکوردی برای تشخیص گام وجود ندارد');

chords = [{ name: 'D' }, { name: 'F' }];
service.detectKey();
assert.equal(elements.edKey.value, 'D');
assert.equal(elements.edKeyMode.value, 'min');
assert.deepEqual(changes.slice(-4), [
  ['key', 'D', 'min'],
  ['save'],
  ['toolbar'],
  ['render']
]);

console.log('EditorSyncAnalysisUiService tests passed');
