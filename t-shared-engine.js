[1mdiff --git a/.gitignore b/.gitignore[m
[1mindex 9f90706..3fbb0d3 100644[m
[1m--- a/.gitignore[m
[1m+++ b/.gitignore[m
[36m@@ -1 +1,2 @@[m
[31m-(js/app.js is a source file, so no need to ignore it - output nothing)[m
\ No newline at end of file[m
[32m+[m[32mnode_modules/[m
[32m+[m[32m**/node_modules/[m
[1mdiff --git a/js/app.js b/js/app.js[m
[1mindex ecd3d19..514ca35 100644[m
[1m--- a/js/app.js[m
[1m+++ b/js/app.js[m
[36m@@ -12782,17 +12782,43 @@[m [msaveState();[m
     }[m
     function anchorRect(ch) { return anchorRectIn($('editor'), ch); }[m
 [m
[32m+[m[32m    function resolveAccidentalPreference() {[m
[32m+[m[32m      if (typeof ED_ACCIDENTAL_PREF !== 'undefined') {[m
[32m+[m[32m        if (ED_ACCIDENTAL_PREF === 'sharp') return true;[m
[32m+[m[32m        if (ED_ACCIDENTAL_PREF === 'flat') return false;[m
[32m+[m[32m      }[m
[32m+[m[32m      return null; // auto[m
[32m+[m[32m    }[m
[32m+[m
     function edShiftNote(n, semi) {[m
[32m+[m[32m      if (!n) return n;[m
[32m+[m[32m      if (typeof window.SharedEngine === 'object' && window.SharedEngine) {[m
[32m+[m[32m        return window.SharedEngine.transposeNote(n, semi, resolveAccidentalPreference());[m
[32m+[m[32m      }[m
[32m+[m[32m      // fallback (legacy) — never reachable if sharedEngine loaded first[m
       const map = NOTE_SEMITONE || {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11};[m
       if (!(n in map)) return n;[m
       const sharp = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];[m
[31m-      const flat = ED_FLAT_MAP || {1:'Db',3:'Eb',6:'Gb',8:'Ab',10:'Bb'};[m
       const idx = (map[n] + semi%12 + 12) % 12;[m
[31m-      // اگر ورودی بمل باشد، خروجی بمل بماند؛ اگر دیز باشد، خروجی دیز بماند[m
[31m-      if (n.includes('b')) return flat[idx] || sharp[idx];[m
[32m+[m[32m      const pref = resolveAccidentalPreference();[m
[32m+[m[32m      if (pref === false) {[m
[32m+[m[32m        const flat = ED_FLAT_MAP || {1:'Db',3:'Eb',6:'Gb',8:'Ab',10:'Bb'};[m
[32m+[m[32m        return flat[idx] || sharp[idx];[m
[32m+[m[32m      }[m
[32m+[m[32m      if (n.includes('b') && pref !== true) {[m
[32m+[m[32m        const flat = ED_FLAT_MAP || {1:'Db',3:'Eb',6:'Gb',8:'Ab',10:'Bb'};[m
[32m+[m[32m        return flat[idx] || sharp[idx];[m
[32m+[m[32m      }[m
       return sharp[idx];[m
     }[m
[31m-    function edTransposeChord(name, semi) { if (!semi || !name) return name; return name.split('/').map(part => part.replace(/^([A-G][b#]?)/, (_,root) => edShiftNote(root,semi))).join('/'); }[m
[32m+[m[32m    function edTransposeChord(name, semi) {[m
[32m+[m[32m      if (!semi || !name) return name;[m
[32m+[m[32m      if (typeof window.SharedEngine === 'object' && window.SharedEngine) {[m
[32m+[m[32m        return window.SharedEngine.transposeChordName(name, semi, resolveAccidentalPreference());[m
[32m+[m[32m      }[m
[32m+[m[32m      // fallback (legacy)[m
[32m+[m[32m      return name.split('/').map(part => part.replace(/^([A-G][b#]?)/, (_,root) => edShiftNote(root,semi))).join('/');[m
[32m+[m[32m    }[m
 [m
     let edRenderChordsToken = 0;[m
 [m
[36m@@ -13558,11 +13584,18 @@[m [mif ($('edDoBoth')) {[m
     let _edSyncingKey = false; // flag to prevent onchange during programmatic key update[m
     function edTransposeKeyName(key, semitones) {[m
       if (!key || !semitones) return key;[m
[32m+[m[32m      if (typeof window.SharedEngine === 'object' && window.SharedEngine) {[m
[32m+[m[32m        return window.SharedEngine.transposeKeyName(key, semitones, resolveAccidentalPreference());[m
[32m+[m[32m      }[m
[32m+[m[32m      // fallback (legacy)[m
       const idx = ED_SEMITONE[key];[m
       if (idx == null) return key;[m
       const newIdx = ((idx + semitones) % 12 + 12) % 12;[m
[31m-      // اگر گام بمل باشد، خروجی بمل بماند؛ اگر دیز باشد، خروجی دیز بماند[m
[31m-      if (key.includes('b')) {[m
[32m+[m[32m      const pref = resolveAccidentalPreference();[m
[32m+[m[32m      if (pref === false) {[m
[32m+[m[32m        return ED_FLAT_NOTES[newIdx] || ED_NOTES[newIdx];[m
[32m+[m[32m      }[m
[32m+[m[32m      if (key.includes('b') && pref !== true) {[m
         return ED_FLAT_NOTES[newIdx] || ED_NOTES[newIdx];[m
       }[m
       return ED_NOTES[newIdx];[m
[36m@@ -13570,7 +13603,12 @@[m [mif ($('edDoBoth')) {[m
 [m
     // ===== CENTRAL KEY/TRANSPOSE FUNCTIONS =====[m
     function keyToSemi(key) { return ED_SEMITONE[key] != null ? ED_SEMITONE[key] : -1; }[m
[31m-    function keyDelta(fromKey, toKey) { return ((keyToSemi(toKey) - keyToSemi(fromKey)) % 12 + 12) % 12; }[m
[32m+[m[32m    function keyDelta(fromKey, toKey) {[m
[32m+[m[32m      if (typeof window.SharedEngine === 'object' && window.SharedEngine) {[m
[32m+[m[32m        return window.SharedEngine.keyDelta(fromKey, toKey);[m
[32m+[m[32m      }[m
[32m+[m[32m      return ((keyToSemi(toKey) - keyToSemi(fromKey)) % 12 + 12) % 12;[m
[32m+[m[32m    }[m
 [m
     // Only modify ch.name in place — preserves position, spacing, alignment, everything[m
     function transposeChordNamesInPlace(chords, semitones) {[m
[1mdiff --git a/js/sharedEngine.js b/js/sharedEngine.js[m
[1mindex c12ae45..46a44eb 100644[m
[1m--- a/js/sharedEngine.js[m
[1m+++ b/js/sharedEngine.js[m
[36m@@ -1,14 +1,364 @@[m
 /**[m
  * sharedEngine.js — موتور مشترک: parse / align / key-transform / highlight[m
  *[m
[31m- * از `edTransposeChord` موجود در app.js برای transpose استفاده می‌کند.[m
[31m- * هیچ View‌ای نباید این منطق را تکرار کند.[m
[32m+[m[32m * موتور مرکزی تشخیص، نرمال‌سازی و انتقال آکورد.[m
[32m+[m[32m * همهٔ Viewها و importers از این ماژول استفاده می‌کنند.[m
  */[m
 [m
 const SharedEngine = (() => {[m
 [m
   /* ═══════════════════════════════════════════════[m
[31m-     1) Tokenizer: line text → tokens with charStart/charEnd[m
[32m+[m[32m     0) Constants — Note definitions[m
[32m+[m[32m     ═══════════════════════════════════════════════ */[m
[32m+[m
[32m+[m[32m  // Maps note name → semitone index (0-11)[m
[32m+[m[32m  const NOTE_SEMITONE = {[m
[32m+[m[32m    'C':0, 'C#':1, 'Db':1, 'D':2, 'D#':3, 'Eb':3,[m
[32m+[m[32m    'E':4, 'F':5, 'F#':6, 'Gb':6, 'G':7, 'G#':8,[m
[32m+[m[32m    'Ab':8, 'A':9, 'A#':10, 'Bb':10, 'B':11[m
[32m+[m[32m  };[m
[32m+[m
[32m+[m[32m  // Sharp note names in order[m
[32m+[m[32m  const SHARP_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];[m
[32m+[m
[32m+[m[32m  // Flat note names in order[m
[32m+[m[32m  const FLAT_NOTES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];[m
[32m+[m
[32m+[m[32m  // Enharmonic equivalents: sharp → flat[m
[32m+[m[32m  const SHARP_TO_FLAT = { 'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab', 'A#':'Bb' };[m
[32m+[m
[32m+[m[32m  // Enharmonic equivalents: flat → sharp[m
[32m+[m[32m  const FLAT_TO_SHARP = { 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#' };[m
[32m+[m
[32m+[m[32m  // Unicode accidental symbols → standard[m
[32m+[m[32m  const UNICODE_ACCIDENTAL_MAP = {[m
[32m+[m[32m    '♯': '#', '♭': 'b', '𝄪': '##', '𝄫': 'bb',[m
[32m+[m[32m    '♮': '', '♯': '#', '♭': 'b'[m
[32m+[m[32m  };[m
[32m+[m
[32m+[m[32m  // Key signatures that prefer flats (based on circle of fifths)[m
[32m+[m[32m  // Keys with flats in their key signature[m
[32m+[m[32m  const FLAT_KEYS = new Set(['F','Bb','Eb','Ab','Db','Gb','Fm','Bbm','Ebm','Abm','Dbm','Gbm']);[m
[32m+[m
[32m+[m[32m  /* ═══════════════════════════════════════════════[m
[32m+[m[32m     1) Full Chord Parser[m
[32m+[m[32m     ═══════════════════════════════════════════════ */[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Parse a chord name into its components.[m
[32m+[m[32m   *[m
[32m+[m[32m   * Input: "Bbmaj7", "C#m7", "Eb/G", "F#sus4", "Dm7b5", "Am7/G", "G7#9"[m
[32m+[m[32m   * Output: { root, accidental, quality, suffix, bass, fullName }[m
[32m+[m[32m   *[m
[32m+[m[32m   * @param {string} name[m
[32m+[m[32m   * @returns {Object|null} parsed components or null if invalid[m
[32m+[m[32m   */[m
[32m+[m[32m  function parseChord(name) {[m
[32m+[m[32m    if (!name || typeof name !== 'string') return null;[m
[32m+[m
[32m+[m[32m    const normalized = name[m
[32m+[m[32m      .replace(/[\u266F\u266D\uFF03\u266E]/g, ch => UNICODE_ACCIDENTAL_MAP[ch] || ch)[m
[32m+[m[32m      .trim();[m
[32m+[m
[32m+[m[32m    if (!normalized) return null;[m
[32m+[m
[32m+[m[32m    // Split on slash to handle bass notes[m
[32m+[m[32m    const slashIdx = normalized.lastIndexOf('/');[m
[32m+[m[32m    let mainPart = normalized;[m
[32m+[m[32m    let bassPart = '';[m
[32m+[m[32m    if (slashIdx > 0 && slashIdx < normalized.length - 1) {[m
[32m+[m[32m      mainPart = normalized.substring(0, slashIdx);[m
[32m+[m[32m      bassPart = normalized.substring(slashIdx + 1);[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    // Parse main part: root note (1-2 chars) + rest (quality, suffix, etc.)[m
[32m+[m[32m    // Root note pattern: A-G optionally followed by # or b[m
[32m+[m[32m    const rootMatch = mainPart.match(/^([A-Ga-g])([#b]?)(.*)$/);[m
[32m+[m[32m    if (!rootMatch) return null;[m
[32m+[m
[32m+[m[32m    let root = rootMatch[1].toUpperCase();[m
[32m+[m[32m    let accidental = rootMatch[2] || '';[m
[32m+[m[32m    const rest = rootMatch[3] || '';[m
[32m+[m
[32m+[m[32m    // Handle H → B (German notation)[m
[32m+[m[32m    if (root === 'H') root = 'B';[m
[32m+[m
[32m+[m[32m    // Build the full root string[m
[32m+[m[32m    const rootStr = root + accidental;[m
[32m+[m
[32m+[m[32m    // Validate root is a known note[m
[32m+[m[32m    if (!(rootStr in NOTE_SEMITONE)) return null;[m
[32m+[m
[32m+[m[32m    // Parse quality from the rest[m
[32m+[m[32m    let quality = '';[m
[32m+[m[32m    let suffix = rest;[m
[32m+[m
[32m+[m[32m    // Common quality patterns at the start of suffix[m
[32m+[m[32m    const qualityPatterns = [[m
[32m+[m[32m      { pattern: /^m(?!a)/, value: 'm' },     // m (minor) - but not "ma"[m
[32m+[m[32m      { pattern: /^min\b/, value: 'm' },       // min[m
[32m+[m[32m      { pattern: /^minor\b/, value: 'm' },     // minor[m
[32m+[m[32m      { pattern: /^maj\b/, value: 'maj' },     // maj[m
[32m+[m[32m      { pattern: /^major\b/, value: 'maj' },   // major[m
[32m+[m[32m      { pattern: /^M(?!a)/, value: 'maj' },    // M (major shorthand)[m
[32m+[m[32m      { pattern: /^dim\b/, value: 'dim' },     // dim[m
[32m+[m[32m      { pattern: /^aug\b/, value: 'aug' },     // aug[m
[32m+[m[32m      { pattern: /^o\b/, value: 'dim' },       // ° shorthand[m
[32m+[m[32m      { pattern: /^\+/, value: 'aug' },        // + shorthand[m
[32m+[m[32m      { pattern: /^sus(2|4)?\b/, value: null }, // sus - keep as-is[m
[32m+[m[32m    ];[m
[32m+[m
[32m+[m[32m    for (const qp of qualityPatterns) {[m
[32m+[m[32m      const m = suffix.match(qp.pattern);[m
[32m+[m[32m      if (m) {[m
[32m+[m[32m        quality = qp.value || m[0];[m
[32m+[m[32m        suffix = suffix.substring(m[0].length);[m
[32m+[m[32m        break;[m
[32m+[m[32m      }[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    // Parse bass note[m
[32m+[m[32m    let bassRoot = '';[m
[32m+[m[32m    let bassAccidental = '';[m
[32m+[m[32m    if (bassPart) {[m
[32m+[m[32m      const bassMatch = bassPart.match(/^([A-Ga-g])([#b]?)/);[m
[32m+[m[32m      if (bassMatch) {[m
[32m+[m[32m        bassRoot = bassMatch[1].toUpperCase();[m
[32m+[m[32m        bassAccidental = bassMatch[2] || '';[m
[32m+[m[32m        if (bassRoot === 'H') bassRoot = 'B';[m
[32m+[m[32m      }[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    return {[m
[32m+[m[32m      root,[m
[32m+[m[32m      accidental,[m
[32m+[m[32m      rootStr,[m
[32m+[m[32m      quality,[m
[32m+[m[32m      suffix,[m
[32m+[m[32m      bassRoot,[m
[32m+[m[32m      bassAccidental,[m
[32m+[m[32m      bassStr: bassRoot ? bassRoot + bassAccidental : '',[m
[32m+[m[32m      fullName: normalized[m
[32m+[m[32m    };[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Build a chord name from its parsed components.[m
[32m+[m[32m   * @param {Object} parsed - result of parseChord()[m
[32m+[m[32m   * @param {string} rootStr - new root string (e.g., "Db", "F#")[m
[32m+[m[32m   * @param {string} bassStr - new bass string (e.g., "Gb", "A")[m
[32m+[m[32m   * @returns {string} complete chord name[m
[32m+[m[32m   */[m
[32m+[m[32m  function buildChordName(parsed, rootStr, bassStr) {[m
[32m+[m[32m    let result = rootStr;[m
[32m+[m[32m    if (parsed.quality) result += parsed.quality;[m
[32m+[m[32m    if (parsed.suffix) result += parsed.suffix;[m
[32m+[m[32m    if (bassStr) result += '/' + bassStr;[m
[32m+[m[32m    return result;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /* ═══════════════════════════════════════════════[m
[32m+[m[32m     2) Note Formatting[m
[32m+[m[32m     ═══════════════════════════════════════════════ */[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Format a semitone index (0-11) to a note name based on preference.[m
[32m+[m[32m   *[m
[32m+[m[32m   * @param {number} semitone - 0-11[m
[32m+[m[32m   * @param {boolean|null} preferSharp - true=sharp, false=flat, null=auto[m
[32m+[m[32m   * @param {string|null} originalNote - original note for context (helps auto-detect)[m
[32m+[m[32m   * @returns {string} note name[m
[32m+[m[32m   */[m
[32m+[m[32m  function formatNoteName(semitone, preferSharp, originalNote) {[m
[32m+[m[32m    // Normalize to 0-11[m
[32m+[m[32m    const idx = ((semitone % 12) + 12) % 12;[m
[32m+[m
[32m+[m[32m    if (preferSharp === true) {[m
[32m+[m[32m      return SHARP_NOTES[idx];[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    if (preferSharp === false) {[m
[32m+[m[32m      return FLAT_NOTES[idx];[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    // Auto-detect: prefer sharp by default[m
[32m+[m[32m    // If the original note had a flat, preserve flat preference[m
[32m+[m[32m    if (originalNote) {[m
[32m+[m[32m      const parsed = parseChord(originalNote);[m
[32m+[m[32m      if (parsed && parsed.accidental === 'b') {[m
[32m+[m[32m        return FLAT_NOTES[idx];[m
[32m+[m[32m      }[m
[32m+[m[32m      if (parsed && parsed.accidental === '#') {[m
[32m+[m[32m        return SHARP_NOTES[idx];[m
[32m+[m[32m      }[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    // Default: prefer sharp (matches common music notation software)[m
[32m+[m[32m    return SHARP_NOTES[idx];[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Detect if a key signature prefers flats.[m
[32m+[m[32m   * @param {string} keyName - e.g., "Dm", "F", "Bb"[m
[32m+[m[32m   * @returns {boolean|null} true=flat, false=sharp, null=neutral[m
[32m+[m[32m   */[m
[32m+[m[32m  function detectKeyAccidentalPreference(keyName) {[m
[32m+[m[32m    if (!keyName) return null;[m
[32m+[m[32m    const normalized = keyName.replace(/[\s\u200E\u200F]/g, '').trim();[m
[32m+[m[32m    // Check if the key is in the flat keys set[m
[32m+[m[32m    if (FLAT_KEYS.has(normalized)) return false;[m
[32m+[m[32m    // Check if the root has a flat[m
[32m+[m[32m    if (normalized.includes('b')) return false;[m
[32m+[m[32m    // Check if the root has a sharp[m
[32m+[m[32m    if (normalized.includes('#') || normalized.includes('♯')) return true;[m
[32m+[m[32m    // Neutral keys (C, D, G, A, E, etc.) - default to sharp[m
[32m+[m[32m    return null;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /* ═══════════════════════════════════════════════[m
[32m+[m[32m     3) Core Transpose Logic[m
[32m+[m[32m     ═══════════════════════════════════════════════ */[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Transpose a single note name by semitones.[m
[32m+[m[32m   *[m
[32m+[m[32m   * @param {string} note - e.g., "C", "Db", "F#", "G"[m
[32m+[m[32m   * @param {number} semitones - number of semitones to transpose[m
[32m+[m[32m   * @param {boolean|null} preferSharp - output preference[m
[32m+[m[32m   * @returns {string} transposed note name[m
[32m+[m[32m   */[m
[32m+[m[32m  function transposeNote(note, semitones, preferSharp) {[m
[32m+[m[32m    if (!note || !semitones) return note;[m
[32m+[m[32m    const idx = NOTE_SEMITONE[note];[m
[32m+[m[32m    if (idx == null) return note;[m
[32m+[m[32m    const newIdx = ((idx + semitones) % 12 + 12) % 12;[m
[32m+[m[32m    return formatNoteName(newIdx, preferSharp, note);[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Transpose a full chord name by semitones.[m
[32m+[m[32m   * Only the root note and bass note (if slash chord) are transposed.[m
[32m+[m[32m   * Quality, suffix, and all other components remain unchanged.[m
[32m+[m[32m   *[m
[32m+[m[32m   * @param {string} name - chord name (e.g., "Dm", "G7/B", "F#sus4", "Bbmaj7")[m
[32m+[m[32m   * @param {number} semitones - number of semitones to transpose[m
[32m+[m[32m   * @param {boolean|null} preferSharp - output preference (true=sharp, false=flat, null=auto)[m
[32m+[m[32m   * @returns {string} transposed chord name[m
[32m+[m[32m   */[m
[32m+[m[32m  function transposeChordName(name, semitones, preferSharp) {[m
[32m+[m[32m    if (!semitones || !name) return name;[m
[32m+[m
[32m+[m[32m    // Parse the chord[m
[32m+[m[32m    const parsed = parseChord(name);[m
[32m+[m[32m    if (!parsed) return name;[m
[32m+[m
[32m+[m[32m    // Calculate new root[m
[32m+[m[32m    const rootIdx = NOTE_SEMITONE[parsed.rootStr];[m
[32m+[m[32m    if (rootIdx == null) return name;[m
[32m+[m[32m    const newRootIdx = ((rootIdx + semitones) % 12 + 12) % 12;[m
[32m+[m
[32m+[m[32m    // Determine preference for this specific transposition[m
[32m+[m[32m    // Use the explicit preference if given, otherwise try to detect from original[m
[32m+[m[32m    let effectivePreference = preferSharp;[m
[32m+[m[32m    if (effectivePreference === null || effectivePreference === undefined) {[m
[32m+[m[32m      // Auto-detect: if original had flat, keep flat; if had sharp, keep sharp[m
[32m+[m[32m      if (parsed.accidental === 'b') {[m
[32m+[m[32m        effectivePreference = false;[m
[32m+[m[32m      } else if (parsed.accidental === '#') {[m
[32m+[m[32m        effectivePreference = true;[m
[32m+[m[32m      }[m
[32m+[m[32m      // For natural notes, default to sharp (this is the key fix for Dm→Dbm!)[m
[32m+[m[32m      // But actually, we should use the global preference setting[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const newRoot = formatNoteName(newRootIdx, effectivePreference, parsed.rootStr);[m
[32m+[m
[32m+[m[32m    // Transpose bass note if present[m
[32m+[m[32m    let newBass = '';[m
[32m+[m[32m    if (parsed.bassStr) {[m
[32m+[m[32m      const bassIdx = NOTE_SEMITONE[parsed.bassStr];[m
[32m+[m[32m      if (bassIdx != null) {[m
[32m+[m[32m        const newBassIdx = ((bassIdx + semitones) % 12 + 12) % 12;[m
[32m+[m[32m        newBass = formatNoteName(newBassIdx, effectivePreference, parsed.bassStr);[m
[32m+[m[32m      }[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    return buildChordName(parsed, newRoot, newBass);[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Transpose a key name by semitones, preserving sharp/flat convention.[m
[32m+[m[32m   *[m
[32m+[m[32m   * @param {string} key - e.g., "Dm", "F", "Bb", "C#"[m
[32m+[m[32m   * @param {number} semitones[m
[32m+[m[32m   * @param {boolean|null} preferSharp[m
[32m+[m[32m   * @returns {string}[m
[32m+[m[32m   */[m
[32m+[m[32m  function transposeKeyName(key, semitones, preferSharp) {[m
[32m+[m[32m    if (!key || !semitones) return key;[m
[32m+[m
[32m+[m[32m    // Parse key to extract root and mode[m
[32m+[m[32m    const parsed = parseChord(key);[m
[32m+[m[32m    if (!parsed) return key;[m
[32m+[m
[32m+[m[32m    // Mode suffix: 'm' for minor, '' for major[m
[32m+[m[32m    const mode = (parsed.quality === 'm') ? 'm' : '';[m
[32m+[m
[32m+[m[32m    const rootIdx = NOTE_SEMITONE[parsed.rootStr];[m
[32m+[m[32m    if (rootIdx == null) return key;[m
[32m+[m[32m    const newRootIdx = ((rootIdx + semitones) % 12 + 12) % 12;[m
[32m+[m
[32m+[m[32m    // For key names, auto-detect preference from key signature if not specified[m
[32m+[m[32m    let effectivePreference = preferSharp;[m
[32m+[m[32m    if (effectivePreference === null || effectivePreference === undefined) {[m
[32m+[m[32m      effectivePreference = detectKeyAccidentalPreference(key);[m
[32m+[m[32m      // If still neutral, check original accidental[m
[32m+[m[32m      if (effectivePreference === null) {[m
[32m+[m[32m        if (parsed.accidental === 'b') effectivePreference = false;[m
[32m+[m[32m        else if (parsed.accidental === '#') effectivePreference = true;[m
[32m+[m[32m      }[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const newRoot = formatNoteName(newRootIdx, effectivePreference, parsed.rootStr);[m
[32m+[m[32m    return newRoot + mode;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Calculate semitone delta between two key names.[m
[32m+[m[32m   * @param {string} fromKey - source key[m
[32m+[m[32m   * @param {string} toKey - target key[m
[32m+[m[32m   * @returns {number} semitone difference (0-11)[m
[32m+[m[32m   */[m
[32m+[m[32m  function keyDelta(fromKey, toKey) {[m
[32m+[m[32m    const fromParsed = parseChord(fromKey);[m
[32m+[m[32m    const toParsed = parseChord(toKey);[m
[32m+[m[32m    if (!fromParsed || !toParsed) return 0;[m
[32m+[m[32m    const fromIdx = NOTE_SEMITONE[fromParsed.rootStr];[m
[32m+[m[32m    const toIdx = NOTE_SEMITONE[toParsed.rootStr];[m
[32m+[m[32m    if (fromIdx == null || toIdx == null) return 0;[m
[32m+[m[32m    return ((toIdx - fromIdx) % 12 + 12) % 12;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Normalize a chord name: clean unicode, fix enharmonic spelling.[m
[32m+[m[32m   * @param {string} name[m
[32m+[m[32m   * @returns {string}[m
[32m+[m[32m   */[m
[32m+[m[32m  function normalizeChord(name) {[m
[32m+[m[32m    if (!name) return name;[m
[32m+[m[32m    // Replace unicode accidentals[m
[32m+[m[32m    let result = name;[m
[32m+[m[32m    for (const [uc, ascii] of Object.entries(UNICODE_ACCIDENTAL_MAP)) {[m
[32m+[m[32m      // Use replaceAll pattern[m
[32m+[m[32m      while (result.includes(uc)) {[m
[32m+[m[32m        result = result.replace(uc, ascii);[m
[32m+[m[32m      }[m
[32m+[m[32m    }[m
[32m+[m[32m    return result;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /* ═══════════════════════════════════════════════[m
[32m+[m[32m     4) Tokenizer: line text → tokens with charStart/charEnd[m
      ═══════════════════════════════════════════════ */[m
 [m
   function tokenizeLine(lineText, lineId, lineIndex) {[m
[36m@@ -65,7 +415,7 @@[m [mconst SharedEngine = (() => {[m
   }[m
 [m
   /* ═══════════════════════════════════════════════[m
[31m-     2) Parse: rawLyrics → lines with tokens[m
[32m+[m[32m     5) Parse: rawLyrics → lines with tokens[m
      ═══════════════════════════════════════════════ */[m
 [m
   function parseSongDocument(doc) {[m
[36m@@ -95,7 +445,7 @@[m [mconst SharedEngine = (() => {[m
   }[m
 [m
   /* ═══════════════════════════════════════════════[m
[31m-     3) Chord Alignment[m
[32m+[m[32m     6) Chord Alignment[m
      ═══════════════════════════════════════════════ */[m
 [m
   function findTokenIndexForChar(line, charIndex, anchorType) {[m
[36m@@ -162,38 +512,33 @@[m [mconst SharedEngine = (() => {[m
   }[m
 [m
   /* ═══════════════════════════════════════════════[m
[31m-     4) Key Transform[m
[32m+[m[32m     7) Key Transform (using new engine)[m
      ═══════════════════════════════════════════════ */[m
 [m
[31m-  function transposeChordName(name, semi) {[m
[31m-    if (!semi || !name) return name;[m
[31m-    if (typeof window !== 'undefined' && typeof window.edTransposeChord === 'function') {[m
[31m-      return window.edTransposeChord(name, semi);[m
[31m-    }[m
[31m-    // fallback[m
[31m-    const NOTE_MAP = { C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11 };[m
[31m-    const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];[m
[31m-    const FLAT = {1:'Db',3:'Eb',6:'Gb',8:'Ab',10:'Bb'};[m
[31m-    return name.split('/').map(part => {[m
[31m-      return part.replace(/^([A-G][b#]?)/, (match, root) => {[m
[31m-        if (!(root in NOTE_MAP)) return root;[m
[31m-        const idx = (NOTE_MAP[root] + ((semi % 12) + 12) % 12) % 12;[m
[31m-        return (root.includes('#') || root.includes('b')) && FLAT[idx] ? FLAT[idx] : SHARP[idx];[m
[31m-      });[m
[31m-    }).join('/');[m
[31m-  }[m
[31m-[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Apply key/transpose transform to a song document.[m
[32m+[m[32m   *[m
[32m+[m[32m   * @param {Object} doc - SongDocument[m
[32m+[m[32m   * @param {Object} keyState - { transpose, originalKey, currentKey, preferSharp }[m
[32m+[m[32m   * @returns {Object} doc with transposed chord names[m
[32m+[m[32m   */[m
   function applyKeyTransform(doc, keyState) {[m
     if (!doc || !Array.isArray(doc.lines)) return doc;[m
[32m+[m
     const transpose = (keyState && typeof keyState.transpose === 'number')[m
       ? keyState.transpose[m
       : (doc.transpose || 0);[m
 [m
[32m+[m[32m    const preferSharp = (keyState && keyState.preferSharp !== undefined)[m
[32m+[m[32m      ? keyState.preferSharp[m
[32m+[m[32m      : null;[m
[32m+[m
     if (!transpose) return doc;[m
 [m
     doc.lines.forEach(line => {[m
       (line.chords || []).forEach(ch => {[m
[31m-        ch.name = transposeChordName(ch.baseName || ch.name, transpose);[m
[32m+[m[32m        const baseName = ch.baseName || ch.name;[m
[32m+[m[32m        ch.name = transposeChordName(baseName, transpose, preferSharp);[m
       });[m
     });[m
 [m
[36m@@ -201,7 +546,7 @@[m [mconst SharedEngine = (() => {[m
   }[m
 [m
   /* ═══════════════════════════════════════════════[m
[31m-     5) Highlight Engine[m
[32m+[m[32m     8) Highlight Engine[m
      ═══════════════════════════════════════════════ */[m
 [m
   function computeHighlight(playbackState, doc) {[m
[36m@@ -243,7 +588,7 @@[m [mconst SharedEngine = (() => {[m
   }[m
 [m
   /* ═══════════════════════════════════════════════[m
[31m-     Pipeline[m
[32m+[m[32m     9) Pipeline[m
      ═══════════════════════════════════════════════ */[m
 [m
   function processSong(doc) {[m
[36m@@ -251,18 +596,40 @@[m [mconst SharedEngine = (() => {[m
     doc = parseSongDocument(doc);[m
     doc = alignChords(doc);[m
     if (doc.transpose) {[m
[31m-      doc = applyKeyTransform(doc, { transpose: doc.transpose });[m
[32m+[m[32m      doc = applyKeyTransform(doc, { transpose: doc.transpose, preferSharp: doc.preferSharp });[m
     }[m
     return doc;[m
   }[m
 [m
[32m+[m[32m  /* ═══════════════════════════════════════════════[m
[32m+[m[32m     10) Public API[m
[32m+[m[32m     ═══════════════════════════════════════════════ */[m
[32m+[m
   return {[m
[32m+[m[32m    // Note/chord utilities[m
[32m+[m[32m    NOTE_SEMITONE,[m
[32m+[m[32m    SHARP_NOTES,[m
[32m+[m[32m    FLAT_NOTES,[m
[32m+[m[32m    SHARP_TO_FLAT,[m
[32m+[m[32m    FLAT_TO_SHARP,[m
[32m+[m
[32m+[m[32m    // Core chord functions[m
[32m+[m[32m    parseChord,[m
[32m+[m[32m    buildChordName,[m
[32m+[m[32m    normalizeChord,[m
[32m+[m[32m    formatNoteName,[m
[32m+[m[32m    transposeNote,[m
[32m+[m[32m    transposeChordName,[m
[32m+[m[32m    transposeKeyName,[m
[32m+[m[32m    keyDelta,[m
[32m+[m[32m    detectKeyAccidentalPreference,[m
[32m+[m
[32m+[m[32m    // Document processing[m
     parseSongDocument,[m
     alignChords,[m
     applyKeyTransform,[m
     computeHighlight,[m
     processSong,[m
[31m-    transposeChordName,[m
     findTokenIndexForChar[m
   };[m
 [m
[36m@@ -270,4 +637,4 @@[m [mconst SharedEngine = (() => {[m
 [m
 if (typeof window !== 'undefined') {[m
   window.SharedEngine = SharedEngine;[m
[31m-}[m
[32m+[m[32m}[m
\ No newline at end of file[m
