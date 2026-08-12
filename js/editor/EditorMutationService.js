/**
 * EditorMutationService — deterministic song/chord mutations.
 *
 * This service intentionally knows nothing about DOM, transport, history or
 * rendering. The editor supplies line lengths and decides when to persist.
 */
(function attachEditorMutationService(globalScope) {
  function create({
    baseNameFromDisplayed = value => value || ''
  } = {}) {
    function anchorTypeForCharIndex(charIndex, textLength) {
      if (charIndex <= 0) return 'LineStart';
      if (charIndex >= textLength) return 'LineEnd';
      return 'OnCharacter';
    }

    function removeAsterisks(song) {
      if (!song || typeof song.lyrics !== 'string') {
        return { changed: false, removed: 0 };
      }

      const lines = song.lyrics.split('\n');
      const hasAsterisks = lines.some(line => line.includes('*'));
      if (!hasAsterisks) return { changed: false, removed: 0 };

      const chords = Array.isArray(song.chords) ? song.chords : [];
      let removed = 0;

      lines.forEach((line, lineIndex) => {
        if (!line.includes('*')) return;
        chords.forEach(chord => {
          if (chord?.lineIndex !== lineIndex) return;
          let shift = 0;
          for (
            let index = 0;
            index < line.length && index < (Number(chord.charIndex) || 0);
            index += 1
          ) {
            if (line[index] === '*') shift += 1;
          }
          chord.charIndex = Math.max(0, (Number(chord.charIndex) || 0) - shift);
        });
        removed += [...line].filter(char => char === '*').length;
      });

      song.lyrics = lines.map(line => line.replace(/\*/g, '')).join('\n');
      return { changed: true, removed };
    }

    function reverseChords(song) {
      if (!song || !Array.isArray(song.chords) || song.chords.length < 2) {
        return { changed: false };
      }

      const byLine = {};
      song.chords.forEach((chord, index) => {
        (byLine[chord.lineIndex] ||= []).push({ index, chord });
      });

      let changed = false;
      Object.values(byLine).forEach(group => {
        if (group.length < 2) return;
        group.sort((a, b) => (a.chord.charIndex || 0) - (b.chord.charIndex || 0));
        const targets = group.map((_, index) => {
          const source = group[group.length - 1 - index].chord;
          return {
            charIndex: source.charIndex,
            anchorType: source.anchorType
          };
        });
        group.forEach((entry, index) => {
          entry.chord.charIndex = targets[index].charIndex;
          entry.chord.anchorType = targets[index].anchorType;
        });
        changed = true;
      });

      return { changed };
    }

    function removeAndReverse(song) {
      const stars = removeAsterisks(song);
      const reversed = reverseChords(song);
      return {
        changed: stars.changed || reversed.changed,
        removedAsterisks: stars.removed,
        reversed: reversed.changed
      };
    }

    function deleteChords(song, indices) {
      if (!song || !Array.isArray(song.chords) || !Array.isArray(indices)) {
        return { changed: false, deleted: [] };
      }

      const unique = [...new Set(indices)]
        .filter(index => Number.isInteger(index) && index >= 0 && index < song.chords.length)
        .sort((a, b) => b - a);
      if (!unique.length) return { changed: false, deleted: [] };

      unique.forEach(index => {
        song.chords.splice(index, 1);
        if (Array.isArray(song.baseChordNames)) song.baseChordNames.splice(index, 1);
      });
      return { changed: true, deleted: unique };
    }

    function moveChords(song, indices, direction, getLineLength, isRTL = false) {
      if (!song || !Array.isArray(song.chords) || !Array.isArray(indices)) {
        return { changed: false };
      }

      const delta = direction === 'right' ? 1 : -1;
      let changed = false;
      [...new Set(indices)].forEach(index => {
        const chord = song.chords[index];
        if (!chord) return;
        const lineLength = Math.max(
          0,
          Number(typeof getLineLength === 'function' ? getLineLength(chord.lineIndex) : 0) || 0
        );
        const logicalDelta = isRTL ? -delta : delta;
        const next = Math.max(
          0,
          Math.min(lineLength, (Number(chord.charIndex) || 0) + logicalDelta)
        );
        if (next === chord.charIndex) return;
        chord.charIndex = next;
        chord.anchorType = anchorTypeForCharIndex(next, lineLength);
        changed = true;
      });
      return { changed };
    }

    function moveChordsByDelta(
      song,
      indices,
      charDelta,
      getLineLength,
      { copy = false } = {}
    ) {
      if (!song || !Array.isArray(song.chords) || !Array.isArray(indices)) {
        return { changed: false, added: [] };
      }

      const delta = Number(charDelta) || 0;
      const added = [];
      [...new Set(indices)].forEach(index => {
        const chord = song.chords[index];
        if (!chord) return;
        const lineLength = Math.max(
          0,
          Number(typeof getLineLength === 'function' ? getLineLength(chord.lineIndex) : 0) || 0
        );
        const charIndex = Math.max(
          0,
          Math.min(lineLength, (Number(chord.charIndex) || 0) + delta)
        );
        const moved = {
          lineIndex: chord.lineIndex,
          charIndex,
          anchorType: anchorTypeForCharIndex(charIndex, lineLength),
          name: chord.name
        };

        if (copy) {
          song.chords.push(moved);
          if (!Array.isArray(song.baseChordNames)) song.baseChordNames = [];
          song.baseChordNames.push(baseNameFromDisplayed(chord.name, song));
          added.push(song.chords.length - 1);
        } else {
          chord.charIndex = moved.charIndex;
          chord.anchorType = moved.anchorType;
        }
      });

      return {
        changed: Boolean(indices.length),
        added
      };
    }

    return Object.freeze({
      removeAsterisks,
      reverseChords,
      removeAndReverse,
      deleteChords,
      moveChords,
      moveChordsByDelta
    });
  }

  globalScope.EditorMutationService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
