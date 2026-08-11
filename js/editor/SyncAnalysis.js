(function (global) {
  'use strict';

  const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const FLAT_TO_SHARP = {
    Db: 'C#',
    Eb: 'D#',
    Gb: 'F#',
    Ab: 'G#',
    Bb: 'A#',
    Cb: 'B',
    Fb: 'E'
  };

  const MAJOR_PATTERN = [0, 2, 4, 5, 7, 9, 11];
  const MINOR_PATTERN = [0, 2, 3, 5, 7, 8, 10];

  function median(values) {
    const arr = values.filter(v => Number.isFinite(v)).slice().sort((a, b) => a - b);
    if (!arr.length) return NaN;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  function normalizeBpm(bpm) {
    let out = bpm;
    while (out < 60) out *= 2;
    while (out > 180) out /= 2;
    return Math.round(out);
  }

  function detectTempoFromSyncTimes(syncTimes, options = {}) {
    const minDiff = options.minDiff ?? 0.1;
    const maxDiff = options.maxDiff ?? 10;
    const minBpm = options.minBpm ?? 60;
    const maxBpm = options.maxBpm ?? 180;

    if (!Array.isArray(syncTimes) || syncTimes.length < 2) {
      return {
        ok: false,
        bpm: null,
        reason: 'not_enough_sync_points',
        intervals: []
      };
    }

    const times = syncTimes
      .map(t => Number(t))
      .filter(t => Number.isFinite(t) && t > 0)
      .sort((a, b) => a - b);

    if (times.length < 2) {
      return {
        ok: false,
        bpm: null,
        reason: 'not_enough_valid_sync_points',
        intervals: []
      };
    }

    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      const diff = times[i] - times[i - 1];
      if (diff > minDiff && diff < maxDiff) intervals.push(diff);
    }

    if (!intervals.length) {
      return {
        ok: false,
        bpm: null,
        reason: 'no_valid_intervals',
        intervals: []
      };
    }

    const med = median(intervals);
    if (!Number.isFinite(med) || med <= 0) {
      return {
        ok: false,
        bpm: null,
        reason: 'invalid_median',
        intervals
      };
    }

    const rawBpm = 60 / med;
    let bpm = normalizeBpm(rawBpm);

    if (bpm < minBpm) bpm = minBpm;
    if (bpm > maxBpm) bpm = maxBpm;

    return {
      ok: true,
      bpm,
      rawBpm,
      medianInterval: med,
      intervals
    };
  }

  function normalizeChordRoot(name) {
    if (!name) return null;

    let s = String(name).trim();
    if (!s) return null;

    s = s.replace('\u266d', 'b').replace('\u266f', '#');

    const match = s.match(/^([A-G])([#b]?)/);
    if (!match) return null;

    const rawRoot = match[1] + (match[2] || '');
    return FLAT_TO_SHARP[rawRoot] || rawRoot;
  }

  function chordRoot(chord) {
    if (!chord) return null;
    if (typeof chord === 'string') return normalizeChordRoot(chord);
    return normalizeChordRoot(chord.name || chord.symbol || '');
  }

  function scorePattern(chordRoots, tonic, pattern) {
    const tonicIndex = NOTE_ORDER.indexOf(tonic);
    if (tonicIndex < 0) return -1;

    const scaleNotes = new Set(
      pattern.map(step => NOTE_ORDER[(tonicIndex + step) % 12])
    );

    let score = 0;
    for (const root of chordRoots) {
      if (scaleNotes.has(root)) score += 1;
    }
    return score;
  }

  function detectKeyFromChords(chords) {
    if (!Array.isArray(chords) || chords.length === 0) {
      return {
        ok: false,
        key: null,
        mode: null,
        reason: 'no_chords'
      };
    }

    const roots = chords
      .map(chordRoot)
      .filter(Boolean);

    if (!roots.length) {
      return {
        ok: false,
        key: null,
        mode: null,
        reason: 'no_valid_chord_roots'
      };
    }

    let best = {
      key: null,
      mode: null,
      score: -1
    };

    for (const tonic of NOTE_ORDER) {
      const majorScore = scorePattern(roots, tonic, MAJOR_PATTERN);
      if (majorScore > best.score) {
        best = { key: tonic, mode: 'maj', score: majorScore };
      }
      const minorScore = scorePattern(roots, tonic, MINOR_PATTERN);
      if (minorScore > best.score) {
        best = { key: tonic, mode: 'min', score: minorScore };
      }
    }

    return {
      ok: true,
      key: best.key,
      mode: best.mode,
      score: best.score,
      chordCount: roots.length,
      analysis: { roots }
    };
  }

  global.SyncAnalysis = {
    detectTempoFromSyncTimes,
    detectKeyFromChords
  };

})(typeof window !== 'undefined' ? window : globalThis);
