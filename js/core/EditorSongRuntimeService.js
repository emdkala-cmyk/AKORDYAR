/**
 * EditorSongRuntimeService — the single song ownership seam.
 *
 * EditorRuntimeAdapter/EdCurAdapter owns the published runtime reference.
 * This service exposes that reference through one explicit contract.
 */
(function attachEditorSongRuntimeService(globalScope) {
  'use strict';

  function create({
    runtimeAdapter = globalScope.EditorRuntimeAdapter,
    logger = console
  } = {}) {
    function getSong() {
      if (typeof runtimeAdapter?.getSong === 'function') {
        return runtimeAdapter.getSong();
      }
      return globalScope.EdCurAdapter?.getEdCur?.() || null;
    }

    function setSong(song) {
      if (typeof runtimeAdapter?.setSong === 'function') {
        return runtimeAdapter.setSong(song);
      }
      globalScope.EdCurAdapter?.setEdCur?.(song);
      return song;
    }

    function assertSynchronized() {
      const runtimeAdapterSong = getSong();
      const hasEdCurAdapter =
        typeof globalScope.EdCurAdapter?.getEdCur === 'function';
      const edCurAdapterSong = hasEdCurAdapter
        ? globalScope.EdCurAdapter.getEdCur()
        : runtimeAdapterSong;
      if (runtimeAdapterSong !== edCurAdapterSong) {
        logger?.warn?.(
          'EditorSongRuntimeService: runtime song references diverged'
        );
        return false;
      }
      return true;
    }

    return Object.freeze({ getSong, setSong, assertSynchronized });
  }

  globalScope.EditorSongRuntimeService = Object.freeze({ create });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.EditorSongRuntimeService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
