/**
 * EditorKeyCommandService — state mutations for key and transposition commands.
 *
 * The editor remains responsible for rendering, persistence and timeline
 * synchronization. This service only mutates the supplied song object and
 * returns a small result that the caller can use for orchestration.
 */
(function attachEditorKeyCommandService(globalScope) {
  const SEMITONES = Object.freeze({
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11
  });

  function create({
    transposeChord = value => value,
    transposeKey = value => value,
    keyDelta: delegatedKeyDelta,
    ensureBaseChordNamesAligned
  } = {}) {
    function ensureBaseNames(song) {
      const delegated = typeof ensureBaseChordNamesAligned === 'function'
        ? ensureBaseChordNamesAligned(song)
        : null;
      if (Array.isArray(delegated)) return delegated;

      if (!song) return [];
      const chords = Array.isArray(song.chords) ? song.chords : [];
      if (!Array.isArray(song.baseChordNames)) song.baseChordNames = [];
      if (song.baseChordNames.length > chords.length) {
        song.baseChordNames.splice(chords.length);
      }
      chords.forEach((chord, index) => {
        if (
          typeof song.baseChordNames[index] !== 'string' ||
          ((chord?.name || '') && !song.baseChordNames[index].trim())
        ) {
          song.baseChordNames[index] = chord?.name || '';
        }
      });
      return song.baseChordNames;
    }

    function keyToSemi(key) {
      return SEMITONES[key] != null ? SEMITONES[key] : -1;
    }

    function keyDelta(fromKey, toKey) {
      const delegated = typeof delegatedKeyDelta === 'function'
        ? delegatedKeyDelta(fromKey, toKey)
        : null;
      if (typeof delegated === 'number' && Number.isFinite(delegated)) {
        return delegated;
      }
      return ((keyToSemi(toKey) - keyToSemi(fromKey)) % 12 + 12) % 12;
    }

    function transposeKeyName(key, semitones, preferSharp) {
      if (!key || !semitones) return key;
      return transposeKey(key, semitones, preferSharp) || key;
    }

    function transposeChordNamesInPlace(chords, semitones) {
      if (!Array.isArray(chords) || !chords.length || !semitones) return 0;
      let changed = 0;
      chords.forEach(chord => {
        if (!chord?.name) return;
        const nextName = transposeChord(chord.name, semitones);
        if (nextName !== chord.name) {
          chord.name = nextName;
          changed++;
        }
      });
      return changed;
    }

    function applyTranspose(song, newTranspose, preferSharp) {
      if (!song || song.editorLocked) return { changed: false };
      const names = ensureBaseNames(song);
      (song.chords || []).forEach((chord, index) => {
        const baseName = index < names.length ? names[index] : chord.name;
        if (baseName) chord.name = transposeChord(baseName, newTranspose);
      });
      song.transpose = newTranspose;
      song.key = transposeKeyName(
        song.originalKey || song.key,
        newTranspose,
        preferSharp
      ) || song.key;
      song.keyMode = song.keyMode || 'maj';
      return { changed: true };
    }

    function applyKeyChange(song, newKey, newMode) {
      if (!song || song.editorLocked) return { changed: false };
      const originalKey = song.originalKey || song.key;
      const delta = keyDelta(originalKey, newKey);
      const names = ensureBaseNames(song);
      (song.chords || []).forEach((chord, index) => {
        const baseName = index < names.length ? names[index] : chord.name;
        if (baseName) chord.name = transposeChord(baseName, delta);
      });
      song.key = newKey;
      song.keyMode = newMode;
      song.transpose = 0;
      return { changed: true, delta };
    }

    function applyOriginalKeyChange(song, newKey, newMode) {
      if (!song) return { changed: false };
      const oldOriginalKey = song.originalKey || song.key;
      const delta = keyDelta(oldOriginalKey, newKey);
      const names = ensureBaseNames(song);
      if (delta && names.length) {
        song.baseChordNames = names.map(name =>
          name ? transposeChord(name, delta) : name
        );
      }
      if (delta) transposeChordNamesInPlace(song.chords, delta);
      song.originalKey = newKey;
      song.originalKeyMode = newMode;
      song.key = newKey;
      song.keyMode = newMode;
      song.transpose = 0;
      return { changed: true, delta };
    }

    function resetToOriginalKey(song) {
      if (!song) return { changed: false };
      const names = song.baseChordNames || [];
      (song.chords || []).forEach((chord, index) => {
        if (index < names.length && names[index]) chord.name = names[index];
      });
      song.key = song.originalKey || song.key;
      song.keyMode = song.originalKeyMode || song.keyMode || 'maj';
      song.transpose = 0;
      return { changed: true };
    }

    return Object.freeze({
      keyToSemi,
      keyDelta,
      transposeKeyName,
      transposeChordNamesInPlace,
      applyTranspose,
      applyKeyChange,
      applyOriginalKeyChange,
      resetToOriginalKey
    });
  }

  globalScope.EditorKeyCommandService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
