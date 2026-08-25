/**
 * CoreTimelineRendererService
 *
 * Owns the lazy wiring between core runtime state and the existing
 * TimelineTrackRendererService. The renderer remains the owner of track DOM
 * projection; this module only exposes the core-facing bridge.
 */
(function attachCoreTimelineRendererService(globalScope) {
  'use strict';

  const callGlobal = (name, fallback) => (...args) => {
    const handler = globalScope[name];
    return typeof handler === 'function' ? handler(...args) : fallback;
  };

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    rendererFactory = () =>
      globalScope.TimelineTrackRendererService?.create,
    getDAW = () => globalScope.getEditorDAW?.() || globalScope.DAW,
    getSongState = () => globalScope.requireEditorSongStateService?.(),
    getIsRecordingChords = () => false,
    setIsRecordingChords = () => {},
    getIconSvg = callGlobal('getIconSvg', ''),
    customPrompt = (...args) =>
      globalScope.customPrompt?.(...args) || Promise.resolve(null),
    uid = callGlobal('uid', `c${Date.now()}`),
    roundMs = callGlobal('roundMs')
  } = {}) {
    let renderer = null;

    function getTimelineTrackRendererService() {
      if (renderer) return renderer;
      const createRenderer = rendererFactory();
      if (typeof createRenderer !== 'function') return null;

      renderer = createRenderer({
        documentRef,
        windowRef,
        getDAW,
        getSongState,
        getIconSvg,
        getIsRecordingChords,
        setIsRecordingChords: value => setIsRecordingChords(Boolean(value)),
        switchChordVersion: callGlobal('switchChordVersion'),
        addChordVersion: callGlobal('addChordVersion'),
        renameChordVersion: callGlobal('renameChordVersion'),
        saveState: callGlobal('saveState'),
        renderAll: callGlobal('renderAll'),
        renderClips: callGlobal('renderClips'),
        renderMixer: callGlobal('renderMixer'),
        toast: callGlobal('toast'),
        translate: value => globalScope.t?.(value) ?? value,
        openFileForTrack: callGlobal('openFileForTrack'),
        openIconPicker: callGlobal('openIconPicker'),
        updateTrackMix: callGlobal('updateTrackMix'),
        scheduleAllFromPlayhead: callGlobal('scheduleAllFromPlayhead'),
        ensureAudioCtx: callGlobal('ensureAudioCtx'),
        startPointerDrag: callGlobal('startEditorPointerDrag'),
        setLaneHeight: callGlobal('setLaneHeight'),
        clearEditorTextSelection: callGlobal('clearEditorTextSelection'),
        clearChordSelection: callGlobal('edClearChordSelection'),
        clearSelection: callGlobal('clearSelection'),
        clientToTime: callGlobal('clientToTime', 0),
        customPrompt,
        openChordEditor: callGlobal('openChordEditor'),
        uid,
        roundMs,
        ensureTimelineFits: callGlobal('ensureTimelineFits'),
        cutAtTime: callGlobal('cutAtTime'),
        seekTransport: callGlobal('seekTransport'),
        clientToInnerPoint: callGlobal('clientToInnerPoint', { x: 0, y: 0 }),
        onDocumentMouseMove: callGlobal('onDocMouseMove'),
        onDocumentMouseUp: callGlobal('onDocMouseUp'),
        drawLaneGrid: canvas => globalScope.drawLaneGrid?.(canvas)
      });
      return renderer;
    }

    function updateTrackSelectionUI() {
      return getTimelineTrackRendererService()?.updateTrackSelectionUI?.();
    }

    function selectTrack(trackId) {
      return getTimelineTrackRendererService()?.selectTrack?.(trackId) || null;
    }

    function renderTracks() {
      return getTimelineTrackRendererService()?.renderTracks?.();
    }

    return Object.freeze({
      getTimelineTrackRendererService,
      updateTrackSelectionUI,
      selectTrack,
      renderTracks
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreTimelineRendererService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
