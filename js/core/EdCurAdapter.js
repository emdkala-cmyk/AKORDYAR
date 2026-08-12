/**
 * EdCurAdapter — تنها مالک compatibility state آهنگ فعلی.
 *
 * کد legacy هنوز می‌تواند `window.edCur` را بخواند یا بنویسد، اما منبع واقعی
 * state اینجا نگهداری می‌شود. property سراسری فقط یک facade سازگار است تا
 * مسیرهای قدیمی بدون داشتن مالک دوم کار کنند.
 */
(function attachEdCurAdapter(globalScope) {
  'use strict';

  const root = typeof window !== 'undefined' ? window : globalScope;
  let currentSong = root?.edCur || null;
  const changeListeners = [];

  function notify(eventName, value) {
    changeListeners.slice().forEach(listener => {
      try {
        listener(eventName, value);
      } catch (error) {
        console.error(error);
      }
    });
  }

  function readCurrent() {
    return currentSong;
  }

  function installCompatibilityProperty() {
    if (!root || (typeof root !== 'object' && typeof root !== 'function')) return;

    const descriptor = Object.getOwnPropertyDescriptor(root, 'edCur');
    if (descriptor?.get === readCurrent) return;

    try {
      Object.defineProperty(root, 'edCur', {
        configurable: true,
        enumerable: true,
        get: readCurrent,
        set(song) {
          currentSong = song;
          notify('set', song);
        }
      });
    } catch (_) {
      // محیط‌های محدود ممکن است اجازهٔ تعریف property را ندهند؛
      // در این حالت compatibility assignment را حفظ می‌کنیم.
      try {
        root.edCur = currentSong;
      } catch (_) {}
    }
  }

  installCompatibilityProperty();

  function setEdCur(song) {
    currentSong = song;
    installCompatibilityProperty();
    notify('set', song);
    return song;
  }

  function getEdCur() {
    return currentSong;
  }

  function hasSong() {
    return !!currentSong;
  }

  function getId() { return currentSong?.id || null; }
  function getTitle() { return currentSong?.title || ''; }
  function getArtist() { return currentSong?.artist || ''; }
  function getLyrics() { return currentSong?.lyrics || ''; }
  function getKey() { return currentSong?.key || 'C'; }
  function getKeyMode() { return currentSong?.keyMode || 'major'; }
  function getTranspose() { return currentSong?.transpose || 0; }
  function getOriginalKey() {
    return currentSong?.originalKey || currentSong?.key || 'C';
  }
  function getTempo() { return currentSong?.tempo || 120; }
  function getTimeSignature() {
    return currentSong?.timeSignature || '4/4';
  }
  function getChords() {
    return Array.isArray(currentSong?.chords) ? currentSong.chords : [];
  }
  function getSyncTimes() {
    return Array.isArray(currentSong?.syncTimes) ? currentSong.syncTimes : [];
  }
  function getChordLineClips() {
    return Array.isArray(currentSong?.chordLineClips)
      ? currentSong.chordLineClips
      : [];
  }
  function getSeqPoints() {
    return Array.isArray(currentSong?.seqPoints) ? currentSong.seqPoints : [];
  }
  function getStyles() {
    return currentSong?.styles || {};
  }

  function mutate(field, value, eventName = field) {
    if (!currentSong) return false;
    currentSong[field] = value;
    notify(eventName, value);
    return true;
  }

  function setTitle(value) { return mutate('title', value); }
  function setArtist(value) { return mutate('artist', value); }
  function setLyrics(value) { return mutate('lyrics', value); }
  function setKey(value) { return mutate('key', value); }
  function setKeyMode(value) { return mutate('keyMode', value); }
  function setTranspose(value) { return mutate('transpose', value); }
  function setOriginalKey(value) { return mutate('originalKey', value); }
  function setTempo(value) { return mutate('tempo', value); }
  function setTimeSignature(value) {
    return mutate('timeSignature', value);
  }

  function onChange(listener) {
    if (typeof listener !== 'function') return () => {};
    changeListeners.push(listener);
    return () => {
      const index = changeListeners.indexOf(listener);
      if (index >= 0) changeListeners.splice(index, 1);
    };
  }

  function rebuildSongDocument() {
    const song = currentSong;
    if (!song || !root.SongDocumentModel || !root.SharedEngine) return null;

    let documentModel = root.SongDocumentModel.buildSongDocumentFromEdCur(song);
    documentModel = root.SongDocumentModel.migrate(documentModel);
    documentModel = root.SharedEngine.processSong(documentModel);

    const store = root.RuntimeStateAdapter?.getPerformanceStore?.() || null;
    if (store) {
      store.setSongDocument(documentModel);
      store.setHighlightState({
        activeLineId: null,
        activeTokenId: null,
        activeChordId: null,
        doneLines: new Set()
      });
    }
    return documentModel;
  }

  function syncViewStyles() {
    const song = currentSong;
    const store = root.RuntimeStateAdapter?.getPerformanceStore?.() || null;
    if (!song || !store) return;

    const viewStyles = song.viewStyles || {};
    store.setViewState('singerView', viewStyles.singerView || {});
    store.setViewState('playerView', viewStyles.playerView || {});
    store.setViewState(
      'embeddedPerformanceView',
      viewStyles.embeddedPerformanceView || {}
    );
  }

  const adapter = {
    setEdCur,
    getEdCur,
    hasSong,
    getId,
    getTitle,
    getArtist,
    getLyrics,
    getKey,
    getKeyMode,
    getTranspose,
    getOriginalKey,
    getTempo,
    getTimeSignature,
    getChords,
    getSyncTimes,
    getChordLineClips,
    getSeqPoints,
    getStyles,
    setTitle,
    setArtist,
    setLyrics,
    setKey,
    setKeyMode,
    setTranspose,
    setOriginalKey,
    setTempo,
    setTimeSignature,
    onChange,
    rebuildSongDocument,
    syncViewStyles
  };

  const EdCurAdapter = Object.freeze(adapter);
  root.EdCurAdapter = EdCurAdapter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EdCurAdapter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
