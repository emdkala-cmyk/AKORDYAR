const assert = require('assert');
const SyncAnalysis = require('../core/utils/SyncAnalysis');

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    console.error('not ok - ' + name);
    throw err;
  }
}

test('detectTempoFromSyncTimes returns 120 for 0.5s intervals', () => {
  const result = SyncAnalysis.detectTempoFromSyncTimes([0, 0.5, 1.0, 1.5, 2.0]);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.tempo, 120);
  assert.strictEqual(result.intervals.length, 3);
});

test('detectTempoFromSyncTimes rejects too few sync points', () => {
  const result = SyncAnalysis.detectTempoFromSyncTimes([1.25]);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'insufficient_sync_points');
});

test('detectKeyFromChords recognizes a C major-like set', () => {
  const result = SyncAnalysis.detectKeyFromChords([
    { name: 'C' },
    { name: 'F' },
    { name: 'G' },
    { name: 'Cmaj7' }
  ]);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.key, 'C');
  assert.strictEqual(result.mode, 'maj');
});

test('detectKeyFromChords rejects empty chord lists', () => {
  const result = SyncAnalysis.detectKeyFromChords([]);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'no_recognized_chords');
});
