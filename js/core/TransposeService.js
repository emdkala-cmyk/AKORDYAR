/**
 * TransposeService — isolated transpose/key conversion helpers.
 */
var TransposeService = (function() {

  // Maps note name → semitone index (0-11)
  const NOTE_SEMITONE = {
    'C':0, 'C#':1, 'Db':1, 'D':2, 'D#':3, 'Eb':3, 'E':4,
    'F':5, 'F#':6, 'Gb':6, 'G':7, 'G#':8, 'Ab':8, 'A':9,
    'A#':10, 'Bb':10, 'B':11
  };

  // Sharp note names in order
  const SHARP_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  // Flat note names in order
  const FLAT_NOTES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  // Enharmonic equivalents
  const SHARP_TO_FLAT = { 'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab', 'A#':'Bb' };
  const FLAT_TO_SHARP = { 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#' };
  // Unicode accidental symbols → ASCII
  const UNICODE_ACCIDENTAL_MAP = {
    '♯': '#', '♭': 'b', '𝄪': '##', '𝄫': 'bb',
    '♮': '', '♯': '#', '♭': 'b'
  };
  // Keys with flats in signature
  const FLAT_KEYS = new Set(['F','Bb','Eb','Ab','Db','Gb','Fm','Bbm','Ebm','Abm','Dbm','Gbm']);

  /**
   * Parse a chord name into components for selective transposition.
   * Supports slash chords, flats/sharps, and common quality prefixes.
   *
   * @param {string} name
   * @returns {Object|null}
   */
  function parseChord(name) {
    if (!name || typeof name !== 'string') return null;

    const normalized = name
      .replace(/[\u266F\u266D\uFF03\u266E]/g, ch => UNICODE_ACCIDENTAL_MAP[ch] || ch)
      .trim();

    if (!normalized) return null;

    // Split slash for bass notes
    const slashIdx = normalized.lastIndexOf('/');
    let mainPart = normalized;
    let bassPart = '';
    if (slashIdx > 0 && slashIdx < normalized.length - 1) {
      mainPart = normalized.substring(0, slashIdx);
      bassPart = normalized.substring(slashIdx + 1);
    }

    const rootMatch = mainPart.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!rootMatch) return null;

    let root = rootMatch[1].toUpperCase();
    let accidental = rootMatch[2] || '';
    const rest = rootMatch[3] || '';

    // German notation compatibility
    if (root === 'H') root = 'B';

    const rootStr = root + accidental;
    if (!(rootStr in NOTE_SEMITONE)) return null;

    let quality = '';
    let suffix = rest;
    const qualityPatterns = [
      { pattern: /^m(?!a)/, value: 'm' },
      { pattern: /^min/, value: 'm' },
      { pattern: /^minor/, value: 'm' },
      { pattern: /^maj/, value: 'maj' },
      { pattern: /^major/, value: 'maj' },
      { pattern: /^M(?!a)/, value: 'maj' },
      { pattern: /^dim/, value: 'dim' },
      { pattern: /^aug/, value: 'aug' },
      { pattern: /^o(?!\w)/, value: 'dim' },
      { pattern: /^\+/, value: 'aug' },
      { pattern: /^sus/, value: null },
    ];

    for (const qp of qualityPatterns) {
      const m = suffix.match(qp.pattern);
      if (m) {
        quality = qp.value || m[0];
        suffix = suffix.substring(m[0].length);
        break;
      }
    }

    let bassRoot = '';
    let bassAccidental = '';
    if (bassPart) {
      const bassMatch = bassPart.match(/^([A-Ga-g])([#b]?)/);
      if (bassMatch) {
        bassRoot = bassMatch[1].toUpperCase();
        bassAccidental = bassMatch[2] || '';
        if (bassRoot === 'H') bassRoot = 'B';
      }
    }

    return {
      root,
      accidental,
      rootStr,
      quality,
      suffix,
      bassStr: bassRoot ? (bassRoot + bassAccidental) : ''
    };
  }

  function buildChordName(parsed, rootStr, bassStr) {
    let result = rootStr;
    if (parsed.quality) result += parsed.quality;
    if (parsed.suffix) result += parsed.suffix;
    if (bassStr) result += '/' + bassStr;
    return result;
  }

  function formatNoteName(semitone, preferSharp, originalNote) {
    const idx = ((semitone % 12) + 12) % 12;

    if (preferSharp === true) return SHARP_NOTES[idx];
    if (preferSharp === false) return FLAT_NOTES[idx];

    if (originalNote) {
      const parsed = parseChord(originalNote);
      if (parsed && parsed.accidental === 'b') return FLAT_NOTES[idx];
      if (parsed && parsed.accidental === '#') return SHARP_NOTES[idx];
    }

    return SHARP_NOTES[idx];
  }

  function detectKeyAccidentalPreference(keyName) {
    if (!keyName) return null;
    const normalized = keyName.replace(/[\s\u200E\u200F]/g, '').trim();
    if (FLAT_KEYS.has(normalized)) return false;
    if (normalized.includes('b')) return false;
    if (normalized.includes('#') || normalized.includes('♯')) return true;
    return null;
  }

  function keySignaturePreference(keyName) {
    return detectKeyAccidentalPreference(keyName);
  }

  /**
   * Transpose a single note name by semitones.
   *
   * @param {string} note
   * @param {number} semitones
   * @param {boolean|null} preferSharp
   * @returns {string}
   */
  function transposeNote(note, semitones, preferSharp) {
    if (!note || !semitones) return note;
    const idx = NOTE_SEMITONE[note];
    if (idx == null) return note;
    const newIdx = ((idx + semitones) % 12 + 12) % 12;
    return formatNoteName(newIdx, preferSharp, note);
  }

  /**
   * Transpose a full chord name by semitones.
   *
   * @param {string} name
   * @param {number} semitones
   * @param {boolean|null} preferSharp
   * @returns {string}
   */
  function transposeChordName(name, semitones, preferSharp) {
    if (!semitones || !name) return name;

    const parsed = parseChord(name);
    if (!parsed) return name;

    const rootIdx = NOTE_SEMITONE[parsed.rootStr];
    if (rootIdx == null) return name;
    const newRootIdx = ((rootIdx + semitones) % 12 + 12) % 12;

    let effectivePreference = preferSharp;
    if (effectivePreference === null || effectivePreference === undefined) {
      if (parsed.accidental === 'b') {
        effectivePreference = false;
      } else if (parsed.accidental === '#') {
        effectivePreference = true;
      }
    }

    const newRoot = formatNoteName(newRootIdx, effectivePreference, parsed.rootStr);

    let newBass = '';
    if (parsed.bassStr) {
      const bassIdx = NOTE_SEMITONE[parsed.bassStr];
      if (bassIdx != null) {
        const newBassIdx = ((bassIdx + semitones) % 12 + 12) % 12;
        newBass = formatNoteName(newBassIdx, effectivePreference, parsed.bassStr);
      }
    }

    return buildChordName(parsed, newRoot, newBass);
  }

  /**
   * Transpose a key name by semitones.
   *
   * @param {string} key
   * @param {number} semitones
   * @param {boolean|null} preferSharp
   * @returns {string}
   */
  function transposeKeyName(key, semitones, preferSharp) {
    if (!key || !semitones) return key;

    const parsed = parseChord(key);
    if (!parsed) return key;

    const mode = (parsed.quality === 'm') ? 'm' : '';
    const rootIdx = NOTE_SEMITONE[parsed.rootStr];
    if (rootIdx == null) return key;
    const newRootIdx = ((rootIdx + semitones) % 12 + 12) % 12;

    let effectivePreference = preferSharp;
    if (effectivePreference === null || effectivePreference === undefined) {
      effectivePreference = detectKeyAccidentalPreference(key);
      if (effectivePreference === null) {
        if (parsed.accidental === 'b') effectivePreference = false;
        else if (parsed.accidental === '#') effectivePreference = true;
      }
    }

    const newRoot = formatNoteName(newRootIdx, effectivePreference, parsed.rootStr);
    return newRoot + mode;
  }

  /**
   * Calculate semitone distance from one key to another.
   *
   * @param {string} fromKey
   * @param {string} toKey
   * @returns {number}
   */
  function keyDelta(fromKey, toKey) {
    const fromParsed = parseChord(fromKey);
    const toParsed = parseChord(toKey);
    if (!fromParsed || !toParsed) return 0;

    const fromIdx = NOTE_SEMITONE[fromParsed.rootStr];
    const toIdx = NOTE_SEMITONE[toParsed.rootStr];
    if (fromIdx == null || toIdx == null) return 0;

    return ((toIdx - fromIdx) % 12 + 12) % 12;
  }

  /**
   * Convert accidentals in root/bass notes.
   *
   * @param {string} name
   * @param {boolean} toFlat
   * @returns {string}
   */
  function convertAccidentals(name, toFlat) {
    if (!name) return name;

    const convert = (noteStr) => {
      if (!noteStr) return noteStr;
      if (toFlat) return SHARP_TO_FLAT[noteStr] || noteStr;
      return FLAT_TO_SHARP[noteStr] || noteStr;
    };

    const parsed = parseChord(name);
    if (!parsed) return name;

    let result = convert(parsed.rootStr);
    if (parsed.quality) result += parsed.quality;
    if (parsed.suffix) result += parsed.suffix;
    if (parsed.bassStr) result += '/' + convert(parsed.bassStr);
    return result;
  }

  return {
    transposeNote,
    transposeChordName,
    transposeKeyName,
    convertAccidentals,
    keyDelta,
    keySignaturePreference
  };

})();

if (typeof window !== 'undefined') {
  window.TransposeService = TransposeService;
}
