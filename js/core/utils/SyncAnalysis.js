(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SyncAnalysis = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  function median(values) {
    if (!values || !values.length) return null;
    const s = values.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function normalizeTempo(bpm) {
    if (!Number.isFinite(bpm) || bpm <= 0) return null;
    let value = Math.round(bpm);
    while (value < 60) value *= 2;
    while (value > 180) value = Math.round(value / 2);
    return value >= 60 && value <= 180 ? value : null;
  }

  function detectTempoFromSyncTimes(syncTimes) {
    if (!Array.isArray(syncTimes)) return { ok: false, reason: 'invalid_input', tempo: null, rawBpm: null, intervals: [] };
    const times = syncTimes.filter(t => Number.isFinite(t) && t > 0).slice().sort((a, b) => a - b);
    if (times.length < 2) return { ok: false, reason: 'insufficient_sync_points', tempo: null, rawBpm: null, intervals: [] };
    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      const d = times[i] - times[i - 1];
      if (Number.isFinite(d) && d > 0) intervals.push(d);
    }
    const med = median(intervals);
    if (!med) return { ok: false, reason: 'insufficient_intervals', tempo: null, rawBpm: null, intervals };
    const rawBpm = 60 / med;
    const tempo = normalizeTempo(rawBpm);
    return tempo ? { ok: true, reason: null, tempo, rawBpm, intervals } : { ok: false, reason: 'tempo_out_of_range', tempo: null, rawBpm, intervals };
  }

  function normalizeChordName(name) {
    const m = typeof name === 'string' && name.trim().match(/^([A-G])([#b]?)/);
    return m ? m[1] + (m[2] || '') : null;
  }

  function rotateProfile(profile, shift) {
    return profile.map((_, i) => profile[(i - shift + 12) % 12]);
  }

  function detectKeyFromChords(chords) {
    if (!Array.isArray(chords)) return { ok: false, reason: 'invalid_input', key: null, mode: null, score: null, counts: [] };
    const counts = Array(12).fill(0);
    let total = 0;
    chords.forEach(ch => {
      const root = normalizeChordName(ch && ch.name);
      if (root == null || NOTE_INDEX[root] == null) return;
      counts[NOTE_INDEX[root]] += 1;
      total += 1;
    });
    if (!total) return { ok: false, reason: 'no_recognized_chords', key: null, mode: null, score: null, counts };
    const noteNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
    let best = { key: null, mode: null, score: -Infinity };
    for (let i = 0; i < 12; i++) {
      const major = rotateProfile(MAJOR_PROFILE, i);
      const minor = rotateProfile(MINOR_PROFILE, i);
      const majorScore = major.reduce((sum, v, n) => sum + (counts[n] || 0) * v, 0);
      if (majorScore > best.score) best = { key: noteNames[i], mode: 'maj', score: majorScore };
      const minorScore = minor.reduce((sum, v, n) => sum + (counts[n] || 0) * v, 0);
      if (minorScore > best.score) best = { key: noteNames[i], mode: 'min', score: minorScore };
    }
    return { ok: true, reason: null, key: best.key, mode: best.mode, score: best.score, counts };
  }

  return { detectTempoFromSyncTimes, detectKeyFromChords };
});
