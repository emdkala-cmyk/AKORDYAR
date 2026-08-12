/**
 * EditorChordCommandService — pure chord command boundary.
 *
 * DOM modal state, sequence progression and rendering remain in editor.js.
 * This service owns only chord-name normalization/parsing and song mutation.
 */
(function attachEditorChordCommandService(globalScope) {
  const CHORD_PATTERN =
    /^([A-G][#b]?)(maj|m(?:in)?|dim|aug|sus2|sus4)?(M7|7|9|b9|#9|11|#11|13|6)?(?:\/([A-G][#b]?))?$/;

  function create({
    baseNameFromDisplayed = name => name || ''
  } = {}) {
    function normalizeName(value) {
      let name = String(value || '').trim();
      name = name.replace(/^([A-G][#b]?)maj$/, '$1');
      name = name.replace(/^([A-G][#b]?)min/i, '$1m');
      return name;
    }

    function parseName(value) {
      const name = normalizeName(value);
      const match = name.match(CHORD_PATTERN);
      if (!match) return null;

      let type = match[2] || 'None';
      if (type === 'm') type = 'min';
      return {
        root: match[1] || 'None',
        type,
        tension: match[3] || '',
        bass: match[4] || 'None'
      };
    }

    function applyName(song, index, pendingAnchor, value) {
      if (!song || !Array.isArray(song.chords)) {
        return { changed: false, added: false, index: null, name: '' };
      }

      const name = normalizeName(value);
      if (!name) return { changed: false, added: false, index: null, name };

      const hasExisting =
        Number.isInteger(index) && index >= 0 && song.chords[index];
      let targetIndex = null;
      let added = false;

      if (hasExisting) {
        song.chords[index].name = name;
        targetIndex = index;
      } else if (pendingAnchor) {
        song.chords.push({ ...pendingAnchor, name });
        targetIndex = song.chords.length - 1;
        added = true;
      }

      if (targetIndex === null) {
        return { changed: false, added: false, index: null, name };
      }

      if (!Array.isArray(song.baseChordNames)) song.baseChordNames = [];
      song.baseChordNames[targetIndex] = baseNameFromDisplayed(name, song);

      return { changed: true, added, index: targetIndex, name };
    }

    return Object.freeze({ normalizeName, parseName, applyName });
  }

  globalScope.EditorChordCommandService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
