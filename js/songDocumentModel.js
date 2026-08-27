/**
 * songDocumentModel.js — منبع حقیقت واحد برای همه Viewها
 *
 * مدل مشترک آهنگ: متن، آکوردها، گام، sync، و state پخش.
 * هیچ View‌ای نباید مستقیماً runtime song را بخواند — باید از SongDocument استفاده کند.
 *
 * توابع transpose از فرمان‌های عمومی runtime ادیتور استفاده می‌کنند.
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
 * @property {string} anchorType نوع anchor از Song Runtime
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
 * @property {Array<Object>} rawChords   chords خام Song Runtime
 * @property {Object|null} midiScore      serialized Standard MIDI score
 * @property {Object|null} musicXmlScore  serialized read-only MusicXML score
 * @property {Array<Object>} scorePartMappings MusicXML↔MIDI↔device mappings
 * @property {Object} liveScoreSettings  read-only Live Score settings
 * @property {SongLine[]} lines
 * @property {SongSection[]} sections
 * @property {SongCue[]} cues
 */

const SongDocumentModel = (() => {

  const CURRENT_SCHEMA_VERSION = 1;

  /**
   * ساخت SongDocument از song فعلی پروژه
   * @param {any} song
   * @returns {SongDocument}
   */
  function buildSongDocument(song) {
    if (!song) {
      return {
        id: '', title: '', artist: '',
        originalKey: 'C', currentKey: 'C', transpose: 0, mode: 'major',
        rawLyrics: '', rawChords: [],
        midiScore: null,
        musicXmlScore: null,
        scorePartMappings: [],
        liveScoreSettings: {
          enabled: false,
          readOnly: true,
          countInEnabled: true,
          countInMeasures: 0,
          mapping: [],
          ipAssignments: {},
          transpositionSettings: {},
          chordLineVisibility: {},
          playheadMode: 'line'
        },
        styles: {},
        lines: [], sections: [], cues: []
      };
    }

    const rawLyrics = song.lyrics || '';
    const rawChords = Array.isArray(song.chords) ? song.chords : [];

    const lines = rawLyrics.split('\n').map((text, i) => ({
      id: 'ln' + i,
      index: i,
      text: text,
      tokens: [],
      chords: []
    }));

    const cues = Array.isArray(song.syncTimes)
      ? song.syncTimes.map((tm, idx) => ({
          id: 'cue' + idx,
          time: Number.isFinite(tm) ? tm : NaN,
          lineIndex: idx
        }))
      : [];

    return {
      id:           song.id || 'song-0',
      title:        song.title || '',
      artist:       song.artist || '',
      originalKey:  song.originalKey || song.key || 'C',
      currentKey:   song.key || 'C',
      transpose:    song.transpose || 0,
      mode:         song.keyMode || 'major',
       rawLyrics:    rawLyrics,
       rawChords:    rawChords,
       midiScore:    song.midiScore || null,
       musicXmlScore: song.musicXmlScore || null,
       scorePartMappings: Array.isArray(song.scorePartMappings) ? song.scorePartMappings : [],
       liveScoreSettings: {
         enabled: false,
         readOnly: true,
         countInEnabled: true,
         countInMeasures: 0,
         mapping: [],
         ipAssignments: {},
         transpositionSettings: {},
         chordLineVisibility: {},
         playheadMode: 'line',
         ...(song.liveScoreSettings && typeof song.liveScoreSettings === 'object'
           ? song.liveScoreSettings
           : {}),
         playheadMode: song.liveScoreSettings?.playheadMode === 'measure'
           ? 'measure'
           : 'line'
       },
       styles:       song.styles || {},
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

    if (!Object.prototype.hasOwnProperty.call(result, 'musicXmlScore')) {
      result.musicXmlScore = null;
    }
    if (!Array.isArray(result.scorePartMappings)) {
      result.scorePartMappings = [];
    }
    if (!result.liveScoreSettings || typeof result.liveScoreSettings !== 'object') {
      result.liveScoreSettings = {
        enabled: Boolean(result.musicXmlScore),
        readOnly: true,
        countInEnabled: true,
        countInMeasures: 0,
        mapping: [],
        ipAssignments: {},
        transpositionSettings: {},
        chordLineVisibility: {},
        playheadMode: 'line'
      };
    } else {
      result.liveScoreSettings = {
        enabled: result.liveScoreSettings.enabled !== false,
        readOnly: true,
        countInEnabled: result.liveScoreSettings.countInEnabled !== false,
        countInMeasures: Math.max(0, Number(result.liveScoreSettings.countInMeasures) || 0),
        mapping: Array.isArray(result.liveScoreSettings.mapping)
          ? result.liveScoreSettings.mapping
          : (Array.isArray(result.scorePartMappings) ? result.scorePartMappings : []),
        ipAssignments: result.liveScoreSettings.ipAssignments &&
          typeof result.liveScoreSettings.ipAssignments === 'object'
          ? result.liveScoreSettings.ipAssignments : {},
        transpositionSettings: result.liveScoreSettings.transpositionSettings &&
          typeof result.liveScoreSettings.transpositionSettings === 'object'
          ? result.liveScoreSettings.transpositionSettings : {},
        chordLineVisibility: result.liveScoreSettings.chordLineVisibility &&
          typeof result.liveScoreSettings.chordLineVisibility === 'object'
          ? result.liveScoreSettings.chordLineVisibility : {},
        playheadMode: result.liveScoreSettings.playheadMode === 'measure'
          ? 'measure'
          : 'line'
      };
    }

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
   * نوشتن SongDocument در song فعلی پروژه
   */
  function writeToSong(doc, song) {
    if (!doc || !song) return;
    song.title     = doc.title;
    song.artist    = doc.artist;
    song.key       = doc.currentKey;
    song.keyMode   = doc.mode;
    song.transpose = doc.transpose;
    song.lyrics    = doc.rawLyrics;
    song.chords    = doc.rawChords.map(ch => ({ ...ch }));
    song.syncTimes = doc.cues.map(c => c.time);
    if (doc.midiScore) song.midiScore = clone(doc.midiScore);
    if (doc.musicXmlScore) song.musicXmlScore = clone(doc.musicXmlScore);
    if (Array.isArray(doc.scorePartMappings)) song.scorePartMappings = clone(doc.scorePartMappings);
    if (doc.liveScoreSettings) song.liveScoreSettings = clone(doc.liveScoreSettings);
    if (doc.originalKey) song.originalKey = doc.originalKey;
  }

  function clone(doc) {
    return JSON.parse(JSON.stringify(doc));
  }

  return { CURRENT_SCHEMA_VERSION, buildSongDocument, writeToSong, clone, migrate };

})();

if (typeof window !== 'undefined') {
  window.SongDocumentModel = SongDocumentModel;
}
