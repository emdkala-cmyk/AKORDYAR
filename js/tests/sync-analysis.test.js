// js/tests/sync-analysis.test.js
(function () {
  const SyncAnalysis = require('../editor/SyncAnalysis.js');

  function assert(cond, msg) {
    if (!cond) throw new Error(msg);
  }

  function run() {
    // Tempo
    const t1 = SyncAnalysis.detectTempoFromSyncTimes([0.5, 1.0, 1.5, 2.0]);
    assert(t1.ok, 'tempo case 1 should be ok');
    assert(t1.bpm === 120, 'tempo case 1 expected 120, got ' + t1.bpm);

    const t2 = SyncAnalysis.detectTempoFromSyncTimes([1.0, 2.0, 3.0, 4.0]);
    assert(t2.ok, 'tempo case 2 should be ok');
    assert(t2.bpm === 60, 'tempo case 2 expected 60, got ' + t2.bpm);

    const t3 = SyncAnalysis.detectTempoFromSyncTimes([1.0]);
    assert(!t3.ok, 'tempo case 3 should fail');

    // Key
    const k1 = SyncAnalysis.detectKeyFromChords([
      { name: 'C' },
      { name: 'G' },
      { name: 'Am' },
      { name: 'F' }
    ]);
    assert(k1.ok, 'key case 1 should be ok');
    assert(k1.key === 'C', 'key case 1 expected C, got ' + k1.key);
    assert(k1.mode === 'maj', 'key case 1 expected maj, got ' + k1.mode);

    const k2 = SyncAnalysis.detectKeyFromChords([
      { name: 'Am' },
      { name: 'Dm' },
      { name: 'E7' }
    ]);
    assert(k2.ok, 'key case 2 should be ok');

    const k3 = SyncAnalysis.detectKeyFromChords([]);
    assert(!k3.ok, 'key case 3 should fail');

    console.log('sync-analysis tests passed');
  }

  run();
})();
