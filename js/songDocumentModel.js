/**
 * songDocumentModel.js — منبع حقیقت واحد برای همه Viewها
 *
 * مدل مشترک آهنگ: متن، آکوردها، گام، sync، و state پخش.
 * هیچ View‌ای نباید مستقیماً edCur را بخواند — باید از SongDocument استفاده کند.
 *
 * توابع transpose از `edTransposeChord` / `edShiftNote` موجود در app.js استفاده می‌کنند.
 */

/**
 * @typedef {Object} SongLineToken
 * @property {string} id         یکتا، مثلا "ln0_tok3"
 * @property {number} index      ایندکس در خط
 * @property {string} type       "word" | "space" | "chord" | "symbol"
 * @property {string} text       متن واقعی این token
 * @property {number} charStart  موقعیت شروع در string خط
 * @property {number} charEnd    موقعیت پایان (exclusive)
 */

/**
 * @typedef {Object} SongChordRef
 * @property {string} id         یکتا، مثلا "ln0_ch2"
 * @property {string} name       نام آکورد فعلی (بعد از transpose)
 * @property {string} baseName   نام آکورد پایه (قبل از transpose)
 * @property {number} lineIndex  ایندکس خط
 * @property {number} tokenIndex ایندکس token در آن خط که رویش می‌نشیند
 * @property {number} offset     آفست جزئی
 * @property {string} anchorType نوع anchor از edCur
 */

/**
 * @typedef {Object} SongLine
 * @property {string} id
 * @property {number} index
 * @property {string} text
 * @property {SongLineToken[]} tokens
 * @property {SongChordRef[]} chords
 */

/**
 * @typedef {Object} SongSection
 * @property {string} id
 * @property {string} name      مثلا "Verse 1", "Chorus"
 * @property {number} startLine   ایندکس خط شروع
 * @property {number} endLine     ایندکس خط پایان (exclusive)
 */

/**
 * @typedef {Object} SongCue
 * @property {string} id
 * @property {number} time      ثانیه
 * @property {number} lineIndex
 */

/**
 * @typedef {Object} HighlightState
 * @property {string|null} activeLineId
 * @property {string|null} activeTokenId
 * @property {string|null} activeChordId
 * @property {Set<number>} doneLines   ایندکس خطوطی که رد شده‌اند
 */

/**
 * @typedef {Object} PlaybackState
 * @property {number} time         ثانیه
 * @property {boolean} isPlaying
 */

/**
 * @typedef {Object} KeyState
 * @property {string} originalKey
 * @property {string} currentKey
 * @property {number} transpose    فاصله نسبت به originalKey
 * @property {string} mode         مثلا "major" | "minor"
 */

/**
 * @typedef {Object} SongDocument
 * @property {string} id
 * @property {string} title
 * @property {string} artist
 * @property {string} originalKey
 * @property {string} currentKey
 * @property {number} transpose
 * @property {string} mode
 * @property {string} rawLyrics
 * @property {Array<Object>} rawChords   edCur.chords خام
 * @property {SongLine[]} lines
 * @property {SongSection[]} sections
 * @property {SongCue[]} cues
 */

const SongDocumentModel = (() => {

  const CURRENT_SCHEMA_VERSION = 1;

  /**
   * ساخت SongDocument از edCur (مدل فعلی پروژه)
   * @param {any} edCur
   * @returns {SongDocument}
   */
  function buildSongDocumentFromEdCur(ed) {
    if (!ed) {
      return {
        id: '', title: '', artist: '',
        originalKey: 'C', currentKey: 'C', transpose: 0, mode: 'major',
        rawLyrics: '', rawChords: [],
        styles: {},
        lines: [], sections: [], cues: []
      };
    }

    const rawLyrics = ed.lyrics || '';
    const rawChords = Array.isArray(ed.chords) ? ed.chords : [];

    const lines = rawLyrics.split('\n').map((text, i) => ({
      id: 'ln' + i,
      index: i,
      text: text,
      tokens: [],
      chords: []
    }));

    const cues = Array.isArray(ed.syncTimes)
      ? ed.syncTimes.map((tm, idx) => ({
          id: 'cue' + idx,
          time: Number.isFinite(tm) ? tm : NaN,
          lineIndex: idx
        }))
      : [];

    return {
      id:           ed.id || 'song-0',
      title:        ed.title || '',
      artist:       ed.artist || '',
      originalKey:  ed.originalKey || ed.key || 'C',
      currentKey:   ed.key || 'C',
      transpose:    ed.transpose || 0,
      mode:         ed.keyMode || 'major',
      rawLyrics:    rawLyrics,
      rawChords:    rawChords,
      styles:       ed.styles || {},
      lines:        lines,
      sections:     [],
      cues:         cues,
      schemaVersion: CURRENT_SCHEMA_VERSION
    };
  }

  /**
   * مهاجرت (migrate) یک SongDocument از schema قدیمی به جدید.
   * @param {SongDocument} doc
   * @returns {SongDocument}
   */
  function migrate(doc) {
    if (!doc) return doc;
    const version = doc.schemaVersion || 0;
    let result = doc;

    // Version 0 → 1: add schemaVersion, ensure lines have id/index
    if (version < 1) {
      result.schemaVersion = 1;
      (result.lines || []).forEach((line, i) => {
        if (!line.id) line.id = 'ln' + i;
        if (line.index == null) line.index = i;
      });
    }

    return result;
  }

  /**
   * نوشتن SongDocument به edCur
   */
  function writeToEdCur(doc, ed) {
    if (!doc || !ed) return;
    ed.title     = doc.title;
    ed.artist    = doc.artist;
    ed.key       = doc.currentKey;
    ed.keyMode   = doc.mode;
    ed.transpose = doc.transpose;
    ed.lyrics    = doc.rawLyrics;
    ed.chords    = doc.rawChords.map(ch => ({ ...ch }));
    ed.syncTimes = doc.cues.map(c => c.time);
    if (doc.originalKey) ed.originalKey = doc.originalKey;
  }

  function clone(doc) {
    return JSON.parse(JSON.stringify(doc));
  }

  return { CURRENT_SCHEMA_VERSION, buildSongDocumentFromEdCur, writeToEdCur, clone, migrate };

})();

if (typeof window !== 'undefined') {
  window.SongDocumentModel = SongDocumentModel;
}
