/*
 * CoreChordLineSyncService
 *
 * Owns the stateful orchestration for copying Lyrics Chord names into the
 * existing Chord Line clips. Pure ordering and mutation stay in
 * ChordLineSyncService.
 */
(function attachCoreChordLineSyncService(globalScope) {
  'use strict';

  function create({
    getSongState = () => null,
    getDAW = () => null,
    getChordLineSyncService = () => globalScope.ChordLineSyncService,
    isPopupOpen = () => false,
    getChordLinePopup = () => null,
    syncChordLinePopup = () => {},
    saveState = () => {},
    renderAll = () => {},
    toast = () => {}
  } = {}) {
    function requireChordLineSyncService() {
      const service = getChordLineSyncService?.();
      if (!service) {
        throw new Error(
          'ChordLineSyncService در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.'
        );
      }
      return service;
    }

    function syncChordLineFromLyrics() {
      const songState = getSongState();
      const song = songState?.currentSong?.();
      if (!song) {
        toast(t('noDocumentForSync'));
        return;
      }

      const lyricsChords = songState.getChords(song);
      if (lyricsChords.length === 0) {
        toast(t('noChordsInLyricsDot'));
        return;
      }

      const chordLineSyncService = requireChordLineSyncService();
      const lyricsChordsInSyncOrder =
        chordLineSyncService.sortLyricsChordsForSync(lyricsChords);
      const daw = getDAW();
      const chordTrack = daw.tracks.find(track => track.type === 'chord');
      const currentChordLineClips = chordTrack
        ? daw.clips
            .filter(
              clip =>
                clip.type === 'chord' && clip.trackId === chordTrack.id
            )
            .sort((a, b) => a.start - b.start)
        : [];

      if (currentChordLineClips.length === 0) {
        toast(t('syncNeedsChordsDot'));
        return;
      }

      const appliedCount = chordLineSyncService.applyChordNamesToClips(
        lyricsChordsInSyncOrder,
        currentChordLineClips
      );
      songState.markChordLineSynced(song);

      if (isPopupOpen(getChordLinePopup())) {
        syncChordLinePopup();
      }

      saveState();
      renderAll();

      if (lyricsChordsInSyncOrder.length > currentChordLineClips.length) {
        toast(t('syncNeedsChordsDot'));
      } else {
        toast(t('syncComplete'));
      }
    }

    return Object.freeze({ syncChordLineFromLyrics });
  }

  const service = Object.freeze({ create });
  globalScope.CoreChordLineSyncService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
