/**
 * EditorSongRuntimeService — the single song ownership seam.
 *
 * The legacy editor keeps a lexical song reference for compatibility while
 * EditorRuntimeAdapter/EdCurAdapter owns the published runtime reference.
 * This service updates both through one explicit contract.
 */
(function attachEditorSongRuntimeService(globalScope) {
  'use strict';

  function create({
    getLegacySong = () => null,
    setLegacySong = () => {},
    runtimeAdapter = globalScope.EditorRuntimeAdapter,
    logger = console
  } = {}) {
    function legacyBridge() {
      return globalScope.EditorLegacySongBridge || null;
    }

    function getSong() {
      if (typeof runtimeAdapter?.getSong === 'function') {
        return runtimeAdapter.getSong();
      }
      return legacyBridge()?.get?.() ?? getLegacySong();
    }

    function setSong(song) {
      if (typeof legacyBridge()?.set === 'function') {
        legacyBridge().set(song);
      } else {
        setLegacySong(song);
      }
      if (typeof runtimeAdapter?.setSong === 'function') {
        runtimeAdapter.setSong(song);
      } else {
        globalScope.EdCurAdapter?.setEdCur?.(song);
      }
      return song;
    }

    function assertSynchronized() {
      const legacySong = legacyBridge()?.get?.() ?? getLegacySong();
      const runtimeSong = getSong();
      if (legacySong && runtimeSong && legacySong !== runtimeSong) {
        logger?.warn?.(
          'EditorSongRuntimeService: legacy and runtime song references diverged'
        );
        return false;
      }
      return legacySong === runtimeSong || (!legacySong && !runtimeSong);
    }

    return Object.freeze({ getSong, setSong, assertSynchronized });
  }

  globalScope.EditorSongRuntimeService = Object.freeze({ create });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.EditorSongRuntimeService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
