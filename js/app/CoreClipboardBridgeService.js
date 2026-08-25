/*
 * CoreClipboardBridgeService
 *
 * Lazily wires the existing ClipboardService after the editor chunk exposes
 * edSaveSong. ClipboardService remains the owner of copy/cut/paste/duplicate
 * behavior; this module only keeps the core-facing runtime bridge stable.
 */
(function attachCoreClipboardBridgeService(globalScope) {
  'use strict';

  function create({
    clipboardFactory = () => globalScope.ClipboardService,
    getEdSaveSong = () => globalScope.edSaveSong,
    getDAW = () => globalScope.getEditorDAW?.() || globalScope.DAW,
    selectedClips = () => globalScope.selectedClips?.() || [],
    uid = (...args) => globalScope.uid?.(...args),
    roundMs = value => value,
    peaksFromBuffer = (...args) =>
      globalScope.peaksFromBuffer?.(...args) || [],
    refreshClipWaveImage = (...args) =>
      globalScope.refreshClipWaveImage?.(...args),
    ensureTimelineFits = (...args) =>
      globalScope.ensureTimelineFits?.(...args),
    saveState = (...args) => globalScope.saveState?.(...args),
    renderAll = (...args) => globalScope.renderAll?.(...args),
    scheduleAllFromPlayhead = (...args) =>
      globalScope.scheduleAllFromPlayhead?.(...args),
    stopAllVoices = (...args) =>
      globalScope.stopAllVoices?.(...args),
    toast = (...args) => globalScope.toast?.(...args),
    translate = (...args) => globalScope.t?.(...args) ?? args[0]
  } = {}) {
    let clipboardService = null;

    function getClipboardService() {
      if (clipboardService) return clipboardService;
      const ClipboardService = clipboardFactory?.();
      const edSaveSong = getEdSaveSong?.();
      if (
        typeof ClipboardService !== 'function' ||
        typeof edSaveSong !== 'function'
      ) {
        return null;
      }

      clipboardService = new ClipboardService({
        getDAW,
        selectedClips,
        uid,
        roundMs,
        peaksFromBuffer,
        refreshClipWaveImage,
        ensureTimelineFits,
        saveState,
        renderAll,
        scheduleAllFromPlayhead,
        stopAllVoices,
        toast,
        t: translate,
        edSaveSong
      });
      return clipboardService;
    }

    const call = method => (...args) =>
      getClipboardService()?.[method]?.(...args);

    return Object.freeze({
      getClipboardService,
      deleteSelected: call('deleteSelected'),
      copySelected: call('copySelected'),
      cutSelected: call('cutSelected'),
      pasteClipboard: call('pasteClipboard'),
      duplicateSelected: call('duplicateSelected')
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreClipboardBridgeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
