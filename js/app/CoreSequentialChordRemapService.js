/**
 * CoreSequentialChordRemapService
 *
 * Remaps sequential-chord anchors after lyric edits and synchronizes the
 * runtime sequence points only while sequential mode is active.
 */
(function attachCoreSequentialChordRemapService(globalScope) {
  'use strict';

  function create({
    getSongState = () => globalScope.requireEditorSongStateService?.(),
    getPositionMapper = () => globalScope.LyricPositionMapper,
    getSeqModeActive = () => false,
    setRuntimeSeqPoints = () => {}
  } = {}) {
    function remap(oldText, newText) {
      const songState = getSongState?.();
      const seqPoints = songState?.getSeqPoints?.() || [];
      if (!seqPoints.length) return;

      const mapper = getPositionMapper?.();
      seqPoints.forEach(point =>
        mapper.remapAnchorToNewText(point, oldText, newText)
      );
      const validPoints = seqPoints.filter(point => point.lineIndex >= 0);
      songState.setSeqPoints(validPoints);
      if (getSeqModeActive?.()) setRuntimeSeqPoints(validPoints);
    }

    return Object.freeze({ remap });
  }

  const service = Object.freeze({ create });
  globalScope.CoreSequentialChordRemapService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
