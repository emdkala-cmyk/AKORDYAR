/**
 * SongMetadata — مدیریت متمرکز metadata آهنگ
 *
 * فیلدهای تحت پوشش: title, artist, key, keyMode, tempo, timeSignature
 * این ماژول خواندن/نوشتن بین edCur و DOM را یکپارچه می‌کند.
 *
 * وابستگی: document, edCur (global)
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
   * خواندن metadata از DOM و نوشتن در edCur
   */
  function syncFromDom(edCur, opts) {
    if (!edCur) return;
    opts = opts || {};
    if (opts.includeTitle !== false)  edCur.title = getDomVal('title') || '';
    if (opts.includeArtist !== false) edCur.artist = getDomVal('artist') || '';
    if (opts.includeTimeSig !== false) edCur.timeSignature = getDomVal('timeSignature') || DEFAULTS.timeSignature;
    if (opts.includeTempo !== false)  edCur.tempo = parseInt(getDomVal('tempo')) || DEFAULTS.tempo;
    if (opts.includeGenre !== false)  edCur.genre = getDomVal('genre') || '';
    if (opts.includeKey !== false) {
      edCur.key = getDomVal('key') || edCur.key || DEFAULTS.key;
      edCur.keyMode = getDomVal('keyMode') || edCur.keyMode || DEFAULTS.keyMode;
    }
  }

  /**
   * نوشتن مقادیر edCur در DOM
   */
  function syncToDom(edCur, opts) {
    if (!edCur) return;
    opts = opts || {};
    var incKey = opts.includeKey !== false;

    setDomVal('title', edCur.title || '');
    setDomVal('artist', edCur.artist || '');
    setDomVal('timeSignature', edCur.timeSignature || DEFAULTS.timeSignature);
    setDomVal('tempo', edCur.tempo || DEFAULTS.tempo);
    setDomVal('genre', edCur.genre || '');
    if (incKey) {
      setDomVal('key', edCur.key || DEFAULTS.key);
      setDomVal('keyMode', edCur.keyMode || DEFAULTS.keyMode);
    }
  }

  /**
   * تنظیم مقادیر پیش‌فرض برای فیلدهای missing
   */
  function applyDefaults(edCur) {
    if (!edCur) return;
    if (!edCur.timeSignature) edCur.timeSignature = DEFAULTS.timeSignature;
    if (!edCur.tempo) edCur.tempo = DEFAULTS.tempo;
    if (edCur.transpose == null) edCur.transpose = 0;
  }

  /**
   * اصلاح فرمت key: اگر 'Am' باشد → key='A', keyMode='min'
   */
  function fixKeyFormat(edCur, isValidNote) {
    if (!edCur || !edCur.key) return;
    if (edCur.key.endsWith('m') && edCur.keyMode !== 'min') {
      var cleanKey = edCur.key.replace(/m$/, '');
      if (typeof isValidNote === 'function' && isValidNote(cleanKey)) {
        edCur.key = cleanKey;
        edCur.keyMode = 'min';
      }
    }
  }

  /**
   * نرمال‌سازی کامل metadata
   */
  function normalize(edCur, isValidNote) {
    applyDefaults(edCur);
    fixKeyFormat(edCur, isValidNote);
    if (!edCur.originalKey) {
      edCur.originalKey = edCur.key;
      edCur.originalKeyMode = edCur.keyMode || 'maj';
    }
  }

  /**
   * گرفتن رشته نمایشی گام (مثل "Am", "C", "F#m")
   */
  function getDisplayKey(edCur) {
    if (!edCur) return 'C';
    var k = edCur.key || 'C';
    var m = edCur.keyMode || 'maj';
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
