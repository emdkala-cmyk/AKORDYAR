/**
 * EditorChordStateService — pure chord/base-name state helpers.
 *
 * The editor remains the owner of the song object; this service only applies
 * deterministic mutations through the object passed by the caller.
 */
(function attachEditorChordStateService(globalScope) {
  function create({ baseNameFromDisplayed = value => value || '' } = {}) {
    function syncBaseChordName(song, index) {
      if (!song?.chords?.[index]) return;
      if (!Array.isArray(song.baseChordNames)) song.baseChordNames = [];
      song.baseChordNames[index] = baseNameFromDisplayed(
        song.chords[index].name,
        song
      );
    }

    function removeChordAt(song, index) {
      if (!song || !Array.isArray(song.chords)) return;
      if (index < 0 || index >= song.chords.length) return;
      song.chords.splice(index, 1);
      if (Array.isArray(song.baseChordNames)) {
        song.baseChordNames.splice(index, 1);
      }
    }

    function filterChordsWithBase(song, predicate) {
      if (!song || !Array.isArray(song.chords)) return;
      const baseNames = Array.isArray(song.baseChordNames)
        ? song.baseChordNames
        : [];
      const nextChords = [];
      const nextBaseNames = [];

      song.chords.forEach((chord, index) => {
        if (!predicate(chord, index)) return;
        nextChords.push(chord);
        const baseName = baseNames[index];
        nextBaseNames.push(
          typeof baseName === 'string' &&
            (baseName.trim() || !chord?.name)
            ? baseName
            : baseNameFromDisplayed(chord?.name || '', song)
        );
      });

      song.chords = nextChords;
      song.baseChordNames = nextBaseNames;
    }

    function ensureBaseChordNamesAligned(song) {
      if (!song) return [];
      const chords = Array.isArray(song.chords) ? song.chords : [];
      if (!Array.isArray(song.baseChordNames)) song.baseChordNames = [];
      if (song.baseChordNames.length > chords.length) {
        song.baseChordNames.splice(chords.length);
      }

      chords.forEach((chord, index) => {
        const baseName = song.baseChordNames[index];
        if (
          typeof baseName !== 'string' ||
          ((chord?.name || '') && !baseName.trim())
        ) {
          song.baseChordNames[index] = baseNameFromDisplayed(
            chord?.name || '',
            song
          );
        }
      });

      return song.baseChordNames;
    }

    return Object.freeze({
      syncBaseChordName,
      removeChordAt,
      filterChordsWithBase,
      ensureBaseChordNamesAligned
    });
  }

  globalScope.EditorChordStateService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);

