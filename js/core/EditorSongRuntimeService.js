/**
 * EditorSongRuntimeService — the single song ownership seam.
 *
 * EditorRuntimeAdapter owns the published runtime reference. This service
 * exposes that reference through one explicit contract for editor workflows.
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
      return null;
    }

    function setSong(song) {
      if (typeof runtimeAdapter?.setSong === 'function') {
        return runtimeAdapter.setSong(song);
      }
      return song;
    }

    function onSongChange(listener) {
      if (typeof runtimeAdapter?.onSongChange === 'function') {
        return runtimeAdapter.onSongChange(listener);
      }
      return () => {};
    }

    function assertSynchronized() {
      const available =
        typeof runtimeAdapter?.getSong === 'function' &&
        typeof runtimeAdapter?.setSong === 'function';
      if (!available) {
        logger?.warn?.('EditorSongRuntimeService: runtime adapter is unavailable');
      }
      return available;
    }

    return Object.freeze({
      getSong,
      setSong,
      onSongChange,
      assertSynchronized
    });
  }

  globalScope.EditorSongRuntimeService = Object.freeze({ create });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.EditorSongRuntimeService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
