/**
 * CoreTimelineRendererService
 *
 * Owns the lazy wiring between core runtime state and the existing
 * TimelineTrackRendererService. The renderer remains the owner of track DOM
 * projection; this module only exposes the core-facing bridge.
 */
(function attachCoreTimelineRendererService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    rendererFactory = () =>
      globalScope.TimelineTrackRendererService?.create,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getSongState = () => globalScope.requireEditorSongStateService?.(),
    getIsRecordingChords = () => false,
    setIsRecordingChords = () => {},
    getIconSvg = () => '',
    customPrompt = (...args) =>
      Promise.resolve(null),
    uid = prefix => `${prefix || 'c'}${Date.now()}`,
    roundMs = value => value,
    switchChordVersion = () => {},
    addChordVersion = () => {},
    renameChordVersion = () => {},
    saveState = () => {},
    renderAll = () => {},
    renderClips = () => {},
    renderMixer = () => {},
    toast = () => {},
    translate = value => value,
    openFileForTrack = () => {},
    openChordLineImporter = () => {},
    openIconPicker = () => {},
    updateTrackMix = () => {},
    scheduleAllFromPlayhead = () => {},
    ensureAudioCtx = () => {},
    startPointerDrag = () => {},
    setLaneHeight = () => {},
    clearEditorTextSelection = () => {},
    clearChordSelection = () => {},
    clearSelection = () => {},
    clientToTime = () => 0,
    openChordEditor = () => {},
    ensureTimelineFits = () => {},
    cutAtTime = () => {},
    seekTransport = () => {},
    clientToInnerPoint = () => ({ x: 0, y: 0 }),
    onDocumentMouseMove = () => {},
    onDocumentMouseUp = () => {},
    drawLaneGrid = () => {}
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
        switchChordVersion,
        addChordVersion,
        renameChordVersion,
        saveState,
        renderAll,
        renderClips,
        renderMixer,
        toast,
        translate,
        openFileForTrack,
        openChordLineImporter,
        openIconPicker,
        updateTrackMix,
        scheduleAllFromPlayhead,
        ensureAudioCtx,
        startPointerDrag,
        setLaneHeight,
        clearEditorTextSelection,
        clearChordSelection,
        clearSelection,
        clientToTime,
        customPrompt,
        openChordEditor,
        uid,
        roundMs,
        ensureTimelineFits,
        cutAtTime,
        seekTransport,
        clientToInnerPoint,
        onDocumentMouseMove,
        onDocumentMouseUp,
        drawLaneGrid
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
