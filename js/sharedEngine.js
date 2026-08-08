/**
 * sharedEngine.js — موتور مشترک: parse / align / key-transform / highlight
 *
 * موتور مرکزی تشخیص، نرمال‌سازی و انتقال آکورد.
 * همهٔ Viewها و importers از این ماژول استفاده می‌کنند.
 */

const SharedEngine = (() => {

  /* ═══════════════════════════════════════════════
     0) Constants — Note definitions
     ═══════════════════════════════════════════════ */

  // Maps note name → semitone index (0-11)
  const NOTE_SEMITONE = {
    'C':0, 'C#':1, 'Db':1, 'D':2, 'D#':3, 'Eb':3,
    'E':4, 'F':5, 'F#':6, 'Gb':6, 'G':7, 'G#':8,
    'Ab':8, 'A':9, 'A#':10, 'Bb':10, 'B':11
  };

  // Sharp note names in order
  const SHARP_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  // Flat note names in order
  const FLAT_NOTES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

  // Enharmonic equivalents: sharp → flat
  const SHARP_TO_FLAT = { 'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab', 'A#':'Bb' };

  // Enharmonic equivalents: flat → sharp
  const FLAT_TO_SHARP = { 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#' };

  // Unicode accidental symbols → standard
  const UNICODE_ACCIDENTAL_MAP = {
    '♯': '#', '♭': 'b', '𝄪': '##', '𝄫': 'bb',
    '♮': '', '♯': '#', '♭': 'b'
  };

  // Key signatures that prefer flats (based on circle of fifths)
  // Keys with flats in their key signature
  const FLAT_KEYS = new Set(['F','Bb','Eb','Ab','Db','Gb','Fm','Bbm','Ebm','Abm','Dbm','Gbm']);

  /* ═══════════════════════════════════════════════
     1) Full Chord Parser
     ═══════════════════════════════════════════════ */

  /**
   * Parse a chord name into its components.
   *
   * Input: "Bbmaj7", "C#m7", "Eb/G", "F#sus4", "Dm7b5", "Am7/G", "G7#9"
   * Output: { root, accidental, quality, suffix, bass, fullName }
   *
   * @param {string} name
   * @returns {Object|null} parsed components or null if invalid
   */
  function parseChord(name) {
    if (!name || typeof name !== 'string') return null;

    const normalized = name
      .replace(/[\u266F\u266D\uFF03\u266E]/g, ch => UNICODE_ACCIDENTAL_MAP[ch] || ch)
      .trim();

    if (!normalized) return null;

    // Split on slash to handle bass notes
    const slashIdx = normalized.lastIndexOf('/');
    let mainPart = normalized;
    let bassPart = '';
    if (slashIdx > 0 && slashIdx < normalized.length - 1) {
      mainPart = normalized.substring(0, slashIdx);
      bassPart = normalized.substring(slashIdx + 1);
    }

    // Parse main part: root note (1-2 chars) + rest (quality, suffix, etc.)
    // Root note pattern: A-G optionally followed by # or b
    const rootMatch = mainPart.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!rootMatch) return null;

    let root = rootMatch[1].toUpperCase();
    let accidental = rootMatch[2] || '';
    const rest = rootMatch[3] || '';

    // Handle H → B (German notation)
    if (root === 'H') root = 'B';

    // Build the full root string
    const rootStr = root + accidental;

    // Validate root is a known note
    if (!(rootStr in NOTE_SEMITONE)) return null;

    // Parse quality from the rest
    let quality = '';
    let suffix = rest;

    // Common quality patterns at the start of suffix
    // Multi-letter quality names are unambiguous, so no lookahead needed
    const qualityPatterns = [
      { pattern: /^m(?!a)/, value: 'm' },        // m (minor) - but not "ma"
      { pattern: /^min/, value: 'm' },            // min
      { pattern: /^minor/, value: 'm' },          // minor
      { pattern: /^maj/, value: 'maj' },          // maj
      { pattern: /^major/, value: 'maj' },        // major
      { pattern: /^M(?!a)/, value: 'maj' },       // M (major shorthand)
      { pattern: /^dim/, value: 'dim' },          // dim
      { pattern: /^aug/, value: 'aug' },          // aug
      { pattern: /^o(?!\w)/, value: 'dim' },      // ° shorthand
      { pattern: /^\+/, value: 'aug' },           // + shorthand
      { pattern: /^sus/, value: null },            // sus - keep as-is
    ];

    for (const qp of qualityPatterns) {
      const m = suffix.match(qp.pattern);
      if (m) {
        quality = qp.value || m[0];
        suffix = suffix.substring(m[0].length);
        break;
      }
    }

    // Parse bass note
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
      bassRoot,
      bassAccidental,
      bassStr: bassRoot ? bassRoot + bassAccidental : '',
      fullName: normalized
    };
  }

  /**
   * Build a chord name from its parsed components.
   * @param {Object} parsed - result of parseChord()
   * @param {string} rootStr - new root string (e.g., "Db", "F#")
   * @param {string} bassStr - new bass string (e.g., "Gb", "A")
   * @returns {string} complete chord name
   */
  function buildChordName(parsed, rootStr, bassStr) {
    let result = rootStr;
    if (parsed.quality) result += parsed.quality;
    if (parsed.suffix) result += parsed.suffix;
    if (bassStr) result += '/' + bassStr;
    return result;
  }

  /* ═══════════════════════════════════════════════
     2) Note Formatting
     ═══════════════════════════════════════════════ */

  /**
   * Format a semitone index (0-11) to a note name based on preference.
   *
   * @param {number} semitone - 0-11
   * @param {boolean|null} preferSharp - true=sharp, false=flat, null=auto
   * @param {string|null} originalNote - original note for context (helps auto-detect)
   * @returns {string} note name
   */
  function formatNoteName(semitone, preferSharp, originalNote) {
    // Normalize to 0-11
    const idx = ((semitone % 12) + 12) % 12;

    if (preferSharp === true) {
      return SHARP_NOTES[idx];
    }

    if (preferSharp === false) {
      return FLAT_NOTES[idx];
    }

    // Auto-detect: prefer sharp by default
    // If the original note had a flat, preserve flat preference
    if (originalNote) {
      const parsed = parseChord(originalNote);
      if (parsed && parsed.accidental === 'b') {
        return FLAT_NOTES[idx];
      }
      if (parsed && parsed.accidental === '#') {
        return SHARP_NOTES[idx];
      }
    }

    // Default: prefer sharp (matches common music notation software)
    return SHARP_NOTES[idx];
  }

  /**
   * Detect if a key signature prefers flats.
   * @param {string} keyName - e.g., "Dm", "F", "Bb"
   * @returns {boolean|null} true=flat, false=sharp, null=neutral
   */
  function detectKeyAccidentalPreference(keyName) {
    if (!keyName) return null;
    const normalized = keyName.replace(/[\s\u200E\u200F]/g, '').trim();
    // Check if the key is in the flat keys set
    if (FLAT_KEYS.has(normalized)) return false;
    // Check if the root has a flat
    if (normalized.includes('b')) return false;
    // Check if the root has a sharp
    if (normalized.includes('#') || normalized.includes('♯')) return true;
    // Neutral keys (C, D, G, A, E, etc.) - default to sharp
    return null;
  }

  /* ═══════════════════════════════════════════════
     3) Core Transpose Logic
     ═══════════════════════════════════════════════ */

  /**
   * Transpose a single note name by semitones.
   *
   * @param {string} note - e.g., "C", "Db", "F#", "G"
   * @param {number} semitones - number of semitones to transpose
   * @param {boolean|null} preferSharp - output preference
   * @returns {string} transposed note name
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
   * Only the root note and bass note (if slash chord) are transposed.
   * Quality, suffix, and all other components remain unchanged.
   *
   * @param {string} name - chord name (e.g., "Dm", "G7/B", "F#sus4", "Bbmaj7")
   * @param {number} semitones - number of semitones to transpose
   * @param {boolean|null} preferSharp - output preference (true=sharp, false=flat, null=auto)
   * @returns {string} transposed chord name
   */
  function transposeChordName(name, semitones, preferSharp) {
    if (!semitones || !name) return name;

    // Parse the chord
    const parsed = parseChord(name);
    if (!parsed) return name;

    // Calculate new root
    const rootIdx = NOTE_SEMITONE[parsed.rootStr];
    if (rootIdx == null) return name;
    const newRootIdx = ((rootIdx + semitones) % 12 + 12) % 12;

    // Determine preference for this specific transposition
    // Use the explicit preference if given, otherwise try to detect from original
    let effectivePreference = preferSharp;
    if (effectivePreference === null || effectivePreference === undefined) {
      // Auto-detect: if original had flat, keep flat; if had sharp, keep sharp
      if (parsed.accidental === 'b') {
        effectivePreference = false;
      } else if (parsed.accidental === '#') {
        effectivePreference = true;
      }
      // For natural notes, default to sharp (this is the key fix for Dm→Dbm!)
      // But actually, we should use the global preference setting
    }

    const newRoot = formatNoteName(newRootIdx, effectivePreference, parsed.rootStr);

    // Transpose bass note if present
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
   * Transpose a key name by semitones, preserving sharp/flat convention.
   *
   * @param {string} key - e.g., "Dm", "F", "Bb", "C#"
   * @param {number} semitones
   * @param {boolean|null} preferSharp
   * @returns {string}
   */
  function transposeKeyName(key, semitones, preferSharp) {
    if (!key || !semitones) return key;

    // Parse key to extract root and mode
    const parsed = parseChord(key);
    if (!parsed) return key;

    // Mode suffix: 'm' for minor, '' for major
    const mode = (parsed.quality === 'm') ? 'm' : '';

    const rootIdx = NOTE_SEMITONE[parsed.rootStr];
    if (rootIdx == null) return key;
    const newRootIdx = ((rootIdx + semitones) % 12 + 12) % 12;

    // For key names, auto-detect preference from key signature if not specified
    let effectivePreference = preferSharp;
    if (effectivePreference === null || effectivePreference === undefined) {
      effectivePreference = detectKeyAccidentalPreference(key);
      // If still neutral, check original accidental
      if (effectivePreference === null) {
        if (parsed.accidental === 'b') effectivePreference = false;
        else if (parsed.accidental === '#') effectivePreference = true;
      }
    }

    const newRoot = formatNoteName(newRootIdx, effectivePreference, parsed.rootStr);
    return newRoot + mode;
  }

  /**
   * Calculate semitone delta between two key names.
   * @param {string} fromKey - source key
   * @param {string} toKey - target key
   * @returns {number} semitone difference (0-11)
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
   * Normalize a chord name: clean unicode, fix enharmonic spelling.
   * @param {string} name
   * @returns {string}
   */
  function normalizeChord(name) {
    if (!name) return name;
    // Replace unicode accidentals
    let result = name;
    for (const [uc, ascii] of Object.entries(UNICODE_ACCIDENTAL_MAP)) {
      // Use replaceAll pattern
      while (result.includes(uc)) {
        result = result.replace(uc, ascii);
      }
    }
    return result;
  }

  /**
   * Convert all accidentals in a chord name to the opposite spelling.
   *
   * - If the root/bass uses sharps → convert to flats (C#m → Dbm, F# → Gb, A# → Bb)
   * - If the root/bass uses flats → convert to sharps (Dbm → C#m, Gb → F#, Bb → A#)
   * - Natural notes (C, D, E, F, G, A, B) are left unchanged.
   * - Only the root note and slash bass note are converted; quality/suffix untouched.
   *
   * @param {string} name - chord name (e.g., "C#m", "F#", "G#/B", "Bbmaj7")
   * @param {boolean} toFlat - true → convert sharps to flats; false → convert flats to sharps
   * @returns {string} converted chord name
   */
  function convertAccidentals(name, toFlat) {
    if (!name) return name;

    const convert = (noteStr) => {
      if (!noteStr) return noteStr;
      if (toFlat) {
        return SHARP_TO_FLAT[noteStr] || noteStr; // C#→Db, D#→Eb ... natural stays
      }
      return FLAT_TO_SHARP[noteStr] || noteStr;   // Db→C#, Eb→D# ... natural stays
    };

    // Parse the chord to isolate root and bass
    const parsed = parseChord(name);
    if (!parsed) return name;

    let result = convert(parsed.rootStr);
    if (parsed.quality) result += parsed.quality;
    if (parsed.suffix) result += parsed.suffix;
    if (parsed.bassStr) result += '/' + convert(parsed.bassStr);
    return result;
  }

  /* ═══════════════════════════════════════════════
     4) Tokenizer: line text → tokens with charStart/charEnd
     ═══════════════════════════════════════════════ */

  function tokenizeLine(lineText, lineId, lineIndex) {
    const tokens = [];
    let current = '';
    let currentType = null;
    let charStart = 0;

    function pushToken(endIndex) {
      if (!current) return;
      tokens.push({
        id:        lineId + '_tok' + tokens.length,
        index:     tokens.length,
        type:      currentType || 'word',
        text:      current,
        charStart: charStart,
        charEnd:   endIndex
      });
      current = '';
      currentType = null;
    }

    for (let i = 0; i < lineText.length; i++) {
      const ch = lineText[i];
      const isSpace = /\s/.test(ch);

      if (isSpace) {
        pushToken(i);
        tokens.push({
          id:        lineId + '_tok' + tokens.length,
          index:     tokens.length,
          type:      'space',
          text:      ch,
          charStart: i,
          charEnd:   i + 1
        });
        current = '';
        currentType = null;
        charStart = i + 1;
        continue;
      }

      if (!current) {
        current = ch;
        currentType = 'word';
        charStart = i;
      } else {
        current += ch;
      }
    }

    pushToken(lineText.length);
    return tokens;
  }

  /* ═══════════════════════════════════════════════
     5) Parse: rawLyrics → lines with tokens
     ═══════════════════════════════════════════════ */

  function parseSongDocument(doc) {
    if (!doc || !Array.isArray(doc.lines)) return doc;

    doc.lines.forEach(line => {
      line.tokens = tokenizeLine(line.text || '', line.id, line.index);
    });

    // Detect section labels: [Verse 1], {Chorus}, (Bridge)
    doc.sections = [];
    doc.lines.forEach((line, i) => {
      const m = line.text.match(
        /^\s*[\[{(]\s*(مقدمه|Intro|ورس|Verse|کورس|Chorus|بریج|Bridge|آوترو|Outro|Pre-Chorus|پرکورس|Coda|Interlude)\s*\d*\s*[\]})]\s*$/i
      );
      if (m) {
        doc.sections.push({
          id:        'sec-' + i,
          name:      m[1],
          startLine: i,
          endLine:   i + 1
        });
      }
    });

    return doc;
  }

  /* ═══════════════════════════════════════════════
     6) Chord Alignment
     ═══════════════════════════════════════════════ */

  function findTokenIndexForChar(line, charIndex, anchorType) {
    if (!line.tokens || !line.tokens.length) return 0;

    const textLength = (line.text || '').length;
    const tokens = line.tokens.filter(tok => tok.type !== 'space');

    if (!tokens.length) return 0;

    // آکورد ابتدای خط — به اولین توکن غیرفضا متصل شود
    if (anchorType === 'start' || charIndex <= 0) {
      return tokens[0].index;
    }

    // آکورد انتهای خط — به آخرین توکن غیرفضا متصل شود
    if (anchorType === 'end' || (charIndex != null && charIndex >= textLength)) {
      return tokens[tokens.length - 1].index;
    }

    // آکورد وسط خط — نزدیک‌ترین توکن به charIndex
    let bestIdx = 0;
    let bestDist = Infinity;
    line.tokens.forEach((tok, idx) => {
      const mid = (tok.charStart + tok.charEnd) / 2;
      const dist = Math.abs(mid - charIndex);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  function alignChords(doc) {
    if (!doc || !Array.isArray(doc.lines)) return doc;

    doc.lines.forEach(line => { line.chords = []; });

    const chords = Array.isArray(doc.rawChords) ? doc.rawChords : [];

    chords.forEach((ch, idx) => {
      const li = ch.lineIndex;
      const ci = ch.charIndex || 0;
      if (!Number.isInteger(li) || li < 0 || li >= doc.lines.length) return;

      const line = doc.lines[li];
      const anchorType = ch.anchorType || 'mid';
      const tokenIndex = findTokenIndexForChar(line, ci, anchorType);

      line.chords.push({
        id:         'ln' + li + '_ch' + idx,
        name:       ch.name || '',
        baseName:   ch.name || '',
        lineIndex:  li,
        tokenIndex: tokenIndex,
        offset:     0,
        anchorType: anchorType,
        logicalSlot: ch.logicalSlot != null ? ch.logicalSlot : 0
      });
    });

    return doc;
  }

  /* ═══════════════════════════════════════════════
     7) Key Transform (using new engine)
     ═══════════════════════════════════════════════ */

  /**
   * Apply key/transpose transform to a song document.
   *
   * @param {Object} doc - SongDocument
   * @param {Object} keyState - { transpose, originalKey, currentKey, preferSharp }
   * @returns {Object} doc with transposed chord names
   */
  function applyKeyTransform(doc, keyState) {
    if (!doc || !Array.isArray(doc.lines)) return doc;

    const transpose = (keyState && typeof keyState.transpose === 'number')
      ? keyState.transpose
      : (doc.transpose || 0);

    const preferSharp = (keyState && keyState.preferSharp !== undefined)
      ? keyState.preferSharp
      : null;

    if (!transpose) return doc;

    doc.lines.forEach(line => {
      (line.chords || []).forEach(ch => {
        const baseName = ch.baseName || ch.name;
        ch.name = transposeChordName(baseName, transpose, preferSharp);
      });
    });

    return doc;
  }

  /* ═══════════════════════════════════════════════
     8) Highlight Engine
     ═══════════════════════════════════════════════ */

  function computeHighlight(playbackState, doc) {
    const time = (playbackState && playbackState.time) || 0;
    const cues = Array.isArray(doc && doc.cues) ? doc.cues : [];

    let activeLineIndex = -1;
    const doneLines = new Set();

    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      if (!c || !Number.isFinite(c.time)) continue;
      if (c.time <= time && Number.isInteger(c.lineIndex)) {
        activeLineIndex = c.lineIndex;
      } else if (c.time > time) {
        break;
      }
    }

    for (const c of cues) {
      if (
        c &&
        Number.isFinite(c.time) &&
        c.time < time &&
        Number.isInteger(c.lineIndex) &&
        c.lineIndex < activeLineIndex
      ) {
        doneLines.add(c.lineIndex);
      }
    }

    const lineCount = (doc && doc.lines) ? doc.lines.length : 0;
    if (activeLineIndex < 0 || activeLineIndex >= lineCount) {
      return { activeLineId: null, activeTokenId: null, activeChordId: null, doneLines: doneLines };
    }

    const line = doc.lines[activeLineIndex];
    return { activeLineId: line.id || null, activeTokenId: null, activeChordId: null, doneLines: doneLines };
  }

  /* ═══════════════════════════════════════════════
     9) Pipeline
     ═══════════════════════════════════════════════ */

  function processSong(doc) {
    if (!doc) return doc;
    doc = parseSongDocument(doc);
    doc = alignChords(doc);
    if (doc.transpose) {
      doc = applyKeyTransform(doc, { transpose: doc.transpose, preferSharp: doc.preferSharp });
    }
    return doc;
  }

  /* ═══════════════════════════════════════════════
     10) Public API
     ═══════════════════════════════════════════════ */

  return {
    // Note/chord utilities
    NOTE_SEMITONE,
    SHARP_NOTES,
    FLAT_NOTES,
    SHARP_TO_FLAT,
    FLAT_TO_SHARP,

    // Core chord functions
    parseChord,
    buildChordName,
    normalizeChord,
    convertAccidentals,
    formatNoteName,
    transposeNote,
    transposeChordName,
    transposeKeyName,
    keyDelta,
    detectKeyAccidentalPreference,

    // Document processing
    parseSongDocument,
    alignChords,
    applyKeyTransform,
    computeHighlight,
    processSong,
    findTokenIndexForChar
  };

})();

if (typeof window !== 'undefined') {
  window.SharedEngine = SharedEngine;
}