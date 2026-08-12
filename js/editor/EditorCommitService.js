/**
 * EditorCommitService
 *
 * مرز commit تغییرات ادیتور به History و مدل performance.
 * این سرویس فقط orchestration callbackها را اجرا می‌کند و state/DOM را مالک نیست.
 */
(function attachEditorCommitService(globalScope) {
  function create({
    getSong = () => null,
    isHistoryApplying = () => false,
    syncMetadata = () => {},
    getSeqPoints = () => [],
    setSeqPoints = () => {},
    saveState = () => {},
    rebuildSongDocument = () => {}
  } = {}) {
    function commit() {
      const song = getSong();
      if (!song || isHistoryApplying()) return false;

      syncMetadata(song, {
        includeTimeSig: false,
        includeTempo: false,
        includeGenre: false
      });
      setSeqPoints(getSeqPoints());
      saveState();
      rebuildSongDocument(song);
      return true;
    }

    return Object.freeze({ commit });
  }

  globalScope.EditorCommitService = Object.freeze({ create });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.EditorCommitService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
