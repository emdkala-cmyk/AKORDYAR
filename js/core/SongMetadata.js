/**
 * SongMetadata — مدیریت متمرکز metadata آهنگ
 *
 * فیلدهای تحت پوشش: title, artist, key, keyMode, tempo, timeSignature
 * این ماژول خواندن/نوشتن metadata بین Song Runtime و DOM را یکپارچه می‌کند.
 *
 * وابستگی: document
 */

const SongMetadata = (() => {

  /** DOM element IDs for each field */
  const DOM_IDS = {
    title: 'edTitle',
    artist: 'edArtist',
    key: 'edKey',
    keyMode: 'edKeyMode',
    tempo: 'edTempo',
    timeSignature: 'edTimeSig',
    genre: 'edGenre'
  };

  /** Default values when field is missing */
  const DEFAULTS = {
    title: '',
    artist: '',
    key: 'C',
    keyMode: 'maj',
    tempo: 120,
    timeSignature: '4/4',
    genre: ''
  };

  /**
   * خواندن metadata از DOM و نوشتن در song
   */
  function syncFromDom(song, opts) {
    if (!song) return;
    opts = opts || {};
    if (opts.includeTitle !== false)  song.title = getDomVal('title') || '';
    if (opts.includeArtist !== false) song.artist = getDomVal('artist') || '';
    if (opts.includeTimeSig !== false) song.timeSignature = getDomVal('timeSignature') || DEFAULTS.timeSignature;
    if (opts.includeTempo !== false)  song.tempo = parseInt(getDomVal('tempo')) || DEFAULTS.tempo;
    if (opts.includeGenre !== false)  song.genre = getDomVal('genre') || '';
    if (opts.includeKey !== false) {
      song.key = getDomVal('key') || song.key || DEFAULTS.key;
      song.keyMode = getDomVal('keyMode') || song.keyMode || DEFAULTS.keyMode;
    }
  }

  /**
   * نوشتن مقادیر song در DOM
   */
  function syncToDom(song, opts) {
    if (!song) return;
    opts = opts || {};
    var incKey = opts.includeKey !== false;

    setDomVal('title', song.title || '');
    setDomVal('artist', song.artist || '');
    setDomVal('timeSignature', song.timeSignature || DEFAULTS.timeSignature);
    setDomVal('tempo', song.tempo || DEFAULTS.tempo);
    setDomVal('genre', song.genre || '');
    if (incKey) {
      setDomVal('key', song.key || DEFAULTS.key);
      setDomVal('keyMode', song.keyMode || DEFAULTS.keyMode);
    }
  }

  /**
   * تنظیم مقادیر پیش‌فرض برای فیلدهای missing
   */
  function applyDefaults(song) {
    if (!song) return;
    if (!song.timeSignature) song.timeSignature = DEFAULTS.timeSignature;
    if (!song.tempo) song.tempo = DEFAULTS.tempo;
    if (song.transpose == null) song.transpose = 0;
  }

  /**
   * اصلاح فرمت key: اگر 'Am' باشد → key='A', keyMode='min'
   */
  function fixKeyFormat(song, isValidNote) {
    if (!song || !song.key) return;
    if (song.key.endsWith('m') && song.keyMode !== 'min') {
      var cleanKey = song.key.replace(/m$/, '');
      if (typeof isValidNote === 'function' && isValidNote(cleanKey)) {
        song.key = cleanKey;
        song.keyMode = 'min';
      }
    }
  }

  /**
   * نرمال‌سازی کامل metadata
   */
  function normalize(song, isValidNote) {
    applyDefaults(song);
    fixKeyFormat(song, isValidNote);
    if (!song.originalKey) {
      song.originalKey = song.key;
      song.originalKeyMode = song.keyMode || 'maj';
    }
  }

  /**
   * گرفتن رشته نمایشی گام (مثل "Am", "C", "F#m")
   */
  function getDisplayKey(song) {
    if (!song) return 'C';
    var k = song.key || 'C';
    var m = song.keyMode || 'maj';
    // If key already ends with 'm' (e.g. 'Am'), don't append another 'm'
    if (m === 'min' && !k.endsWith('m')) return k + 'm';
    return k;
  }

  // -- helpers --

  function getDomVal(field) {
    var id = DOM_IDS[field];
    if (!id) return null;
    var el = document.getElementById(id);
    return el ? el.value : null;
  }

  function setDomVal(field, val) {
    var id = DOM_IDS[field];
    if (!id) return;
    var el = document.getElementById(id);
    if (el) el.value = val;
  }

  return {
    DOM_IDS: DOM_IDS,
    DEFAULTS: DEFAULTS,
    syncFromDom: syncFromDom,
    syncToDom: syncToDom,
    applyDefaults: applyDefaults,
    fixKeyFormat: fixKeyFormat,
    normalize: normalize,
    getDisplayKey: getDisplayKey
  };

})();

if (typeof window !== 'undefined') {
  window.SongMetadata = SongMetadata;
}
