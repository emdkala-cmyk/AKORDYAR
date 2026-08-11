/**
 * EdCurAdapter — wrapper رسمی دور edCur
 *
 * مسئولیت‌ها:
 * 1. خواندن/نوشتن امن فیلدهای edCur از طریق window.edCur (lazy ref)
 * 2. انتشار notification هنگام تغییر song
 * 3. Bridge به PerformanceStore (rebuildSongDocument, syncViewStyles)
 * 4. مسیر migration تدریجی از دسترسی مستقیم edCur
 *
 * نکته مهم: این adapter از window.edCur به صورت lazy استفاده می‌کند
 * — یعنی با ۱۲ نقطه sync موجود در app.js کاملاً هماهنگ است.
 */

const EdCurAdapter = (() => {

  let _onChangeListeners = [];

  /* ---- lazy ref ---- */
  function _ref() { return (typeof window !== 'undefined') ? window.edCur : null; }

  /* ---- Core ---- */
  function setEdCur(song) {
    if (typeof window !== 'undefined') window.edCur = song;
    _notify('set', song);
  }
  function getEdCur()       { return _ref(); }
  function hasSong()        { return !!_ref(); }

  /* ---- Accessors ---- */
  function getId()          { var e=_ref(); return e?.id || null; }
  function getTitle()       { var e=_ref(); return e?.title || ''; }
  function getArtist()      { var e=_ref(); return e?.artist || ''; }
  function getLyrics()      { var e=_ref(); return e?.lyrics || ''; }
  function getKey()         { var e=_ref(); return e?.key || 'C'; }
  function getKeyMode()     { var e=_ref(); return e?.keyMode || 'major'; }
  function getTranspose()   { var e=_ref(); return e?.transpose || 0; }
  function getOriginalKey() { var e=_ref(); return e?.originalKey || e?.key || 'C'; }
  function getTempo()       { var e=_ref(); return e?.tempo || 120; }
  function getTimeSignature(){ var e=_ref(); return e?.timeSignature || '4/4'; }
  function getChords()      { var e=_ref(); return Array.isArray(e?.chords) ? e.chords : []; }
  function getSyncTimes()   { var e=_ref(); return Array.isArray(e?.syncTimes) ? e.syncTimes : []; }
  function getChordLineClips(){ var e=_ref(); return Array.isArray(e?.chordLineClips) ? e.chordLineClips : []; }
  function getSeqPoints()   { var e=_ref(); return Array.isArray(e?.seqPoints) ? e.seqPoints : []; }
  function getStyles()      { var e=_ref(); return e?.styles || {}; }

  /* ---- Mutators ---- */
  function setTitle(v)      { var e=_ref(); if(!e)return; e.title=v; _notify('title',v); }
  function setArtist(v)     { var e=_ref(); if(!e)return; e.artist=v; _notify('artist',v); }
  function setLyrics(v)     { var e=_ref(); if(!e)return; e.lyrics=v; _notify('lyrics',v); }
  function setKey(v)        { var e=_ref(); if(!e)return; e.key=v; _notify('key',v); }
  function setKeyMode(v)    { var e=_ref(); if(!e)return; e.keyMode=v; _notify('keyMode',v); }
  function setTranspose(v)  { var e=_ref(); if(!e)return; e.transpose=v; _notify('transpose',v); }
  function setOriginalKey(v) { var e=_ref(); if(!e)return; e.originalKey=v; _notify('originalKey',v); }
  function setTempo(v)      { var e=_ref(); if(!e)return; e.tempo=v; _notify('tempo',v); }
  function setTimeSignature(v){ var e=_ref(); if(!e)return; e.timeSignature=v; _notify('timeSignature',v); }

  /* ---- Notification ---- */
  function onChange(fn) {
    _onChangeListeners.push(fn);
    return function(){ var i=_onChangeListeners.indexOf(fn); if(i>=0)_onChangeListeners.splice(i,1); };
  }
  function _notify(ev, val) {
    _onChangeListeners.slice().forEach(function(fn){ try{fn(ev,val);}catch(e){console.error(e);} });
  }

  /* ---- Bridge to PerformanceStore ---- */
  function rebuildSongDocument() {
    var e = _ref();
    if (!e || !window.SongDocumentModel || !window.SharedEngine) return null;
    var doc = SongDocumentModel.buildSongDocumentFromEdCur(e);
    doc = SongDocumentModel.migrate(doc);
    doc = SharedEngine.processSong(doc);
    if (window.PerformanceStore) {
      PerformanceStore.setSongDocument(doc);
      PerformanceStore.setHighlightState({activeLineId:null,activeTokenId:null,activeChordId:null,doneLines:new Set()});
    }
    return doc;
  }

  function syncViewStyles() {
    var e = _ref();
    if (!e || !window.PerformanceStore) return;
    var vs = e.viewStyles || {};
    PerformanceStore.setViewState('singerView', vs.singerView || {});
    PerformanceStore.setViewState('playerView', vs.playerView || {});
    PerformanceStore.setViewState('embeddedPerformanceView', vs.embeddedPerformanceView || {});
  }

  return {
    setEdCur, getEdCur, hasSong,
    getId, getTitle, getArtist, getLyrics,
    getKey, getKeyMode, getTranspose, getOriginalKey,
    getTempo, getTimeSignature,
    getChords, getSyncTimes, getChordLineClips, getSeqPoints,
    getStyles,
    setTitle, setArtist, setLyrics,
    setKey, setKeyMode, setTranspose, setOriginalKey,
    setTempo, setTimeSignature,
    onChange,
    rebuildSongDocument, syncViewStyles
  };

})();

if (typeof window !== 'undefined') {
  window.EdCurAdapter = EdCurAdapter;
}