/**
 * CoreTimelineRuntimeService
 *
 * Composes the timeline-facing runtimes that used to be constructed inline
 * by app/core.js. Each underlying service keeps its own responsibility while
 * this module owns their dependency graph and lazy interaction links.
 */
(function attachCoreTimelineRuntimeService(globalScope) {
  'use strict';

  function requireService(service, name) {
    if (typeof service?.create !== 'function') {
      throw new Error(`${name} باید قبل از CoreTimelineRuntimeService بارگذاری شود.`);
    }
    return service;
  }

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getSongState = () => globalScope.requireEditorSongStateService?.(),
    getTimingContext = () => getSongState?.()?.getTimingContext?.() || {},
    getTimelineInner = () =>
      documentRef?.getElementById?.('tl-inner'),
    clamp = (value, minimum, maximum) =>
      Math.max(minimum, Math.min(maximum, value)),
    meter = globalScope.Meter,
    syncTimelineViewportToPlayhead = () => {},
    ensureAudioCtx = () => {},
    setAudioContext = () => {},
    getWaveCache = () => getDAW()?.waveCache,
    timelineGrid = globalScope.TimelineGrid,
    getElement = id => documentRef?.getElementById?.(id),
    getTimeSignatureGridConfig = () => ({}),
    getActiveQuantizeGridStep = () => 0,
    snapTime = value => value,
    getTransportState = () => ({}),
    updatePlayheadUI = () => {},
    startMetronome = () => {},
    getIsRecordingChords = () => false,
    setIsRecordingChords = () => {},
    getIconRegistry = () => globalScope.IconRegistry,
    uid = prefix => `${prefix || 'c'}${Date.now()}`,
    roundMs = value => value,
    saveState = () => {},
    renderAll = () => {},
    scheduleAllFromPlayhead = () => {},
    ensureTimelineFits = () => {},
    refreshPopupTimeline = () => {},
    toast = () => {},
    translate = value => value,
    customPrompt = (...args) =>
      Promise.resolve(null),
    getClipFilePath = (...args) =>
      '',
    openChordLineImporter = () => {},
    openChordEditor = (...args) =>
      undefined,
    editorAction = () => undefined,
    coreAction = () => undefined,
    startPointerDrag = () => {},
    getClipInteractionRuntime = () => null,
    geometryService = globalScope.CoreTimelineGeometryService,
    waveformBridgeService = globalScope.EditorWaveformBridgeService,
    clipService = globalScope.CoreClipService,
    chordEditorService = globalScope.CoreTimelineChordEditorBridgeService,
    trackSetupService = globalScope.CoreTrackSetupService,
    timelineRendererService = globalScope.CoreTimelineRendererService,
    timelineGridService = globalScope.CoreTimelineGridService,
    sectionBridgeService = globalScope.CoreTimelineSectionBridgeService,
    clipRendererService = globalScope.CoreClipRendererService
  } = {}) {
    const geometry = requireService(
      geometryService,
      'CoreTimelineGeometryService'
    ).create({
      getDAW,
      getTimelineInner,
      clamp,
      getTimingContext,
      meter,
      syncTimelineViewportToPlayhead
    });

    const waveform = requireService(
      waveformBridgeService,
      'EditorWaveformBridgeService'
    ).create({
      ensureAudioCtx,
      setAudioContext,
      getWaveCache,
      documentRef,
      clamp,
      timeToX: value => geometry.timeToX(value)
    });

    const clips = requireService(clipService, 'CoreClipService').create({
      getDAW,
      uid,
      roundMs,
      refreshClipWaveImage: clip => waveform.refreshClipWaveImage(clip),
      saveState,
      renderAll,
      scheduleAllFromPlayhead,
      toast,
      translate
    });

    const chordEditor = requireService(
      chordEditorService,
      'CoreTimelineChordEditorBridgeService'
    ).create({
      getClip: clipId => clips.getClip(clipId),
      openChordEditor,
      now: () => Date.now()
    });

    const trackSetup = requireService(
      trackSetupService,
      'CoreTrackSetupService'
    ).create({
      documentRef,
      getElement,
      getDAW,
      getIconRegistry,
      ensureAudioCtx,
      uid,
      saveState,
      renderAll,
      toast,
      translate
    });

    let clipRenderer = null;
    const renderClips = options =>
      clipRenderer?.render?.(options);

    const renderer = requireService(
      timelineRendererService,
      'CoreTimelineRendererService'
    ).create({
      documentRef,
      windowRef,
      getDAW,
      getSongState,
      getIsRecordingChords,
      setIsRecordingChords,
      getIconSvg: trackSetup.getIconSvg,
      customPrompt,
      uid,
      roundMs,
      switchChordVersion: (...args) =>
        editorAction('switchChordVersion', ...args),
      addChordVersion: (...args) =>
        editorAction('addChordVersion', ...args),
      renameChordVersion: (...args) =>
        editorAction('renameChordVersion', ...args),
      saveState,
      renderAll,
      renderClips,
      renderMixer: (...args) => coreAction('renderMixer', ...args),
      toast,
      translate,
      openFileForTrack: (...args) =>
        coreAction('openFileForTrack', ...args),
      openChordLineImporter,
      openIconPicker: track => trackSetup.openIconPicker(track),
      updateTrackMix: (...args) =>
        coreAction('updateTrackMix', ...args),
      scheduleAllFromPlayhead,
      ensureAudioCtx,
      startPointerDrag,
      setLaneHeight: (...args) =>
        editorAction('setLaneHeight', ...args),
      clearEditorTextSelection: (...args) =>
        coreAction('clearEditorTextSelection', ...args),
      clearChordSelection: (...args) =>
        editorAction('clearChordSelection', ...args),
      clearSelection: (...args) => coreAction('clearSelection', ...args),
      clientToTime: (...args) => geometry.clientToTime(...args),
      timeToX: (...args) => geometry.timeToX(...args),
      snapTime,
      openChordEditor,
      ensureTimelineFits,
      cutAtTime: (...args) => coreAction('cutAtTime', ...args),
      seekTransport: (...args) => coreAction('seekTransport', ...args),
      clientToInnerPoint: (...args) =>
        geometry.clientToInnerPoint(...args),
      onDocumentMouseMove: (...args) =>
        getClipInteractionRuntime()?.onDocMouseMove?.(...args),
      onDocumentMouseUp: (...args) =>
        getClipInteractionRuntime()?.onDocMouseUp?.(...args),
      drawLaneGrid: (...args) => coreAction('drawLaneGrid', ...args)
    });

    const grid = requireService(
      timelineGridService,
      'CoreTimelineGridService'
    ).create({
      documentRef,
      timelineGrid,
      getDAW,
      getTimingContext,
      getProjectEnd: geometry.getProjectEnd,
      timeToX: value => geometry.timeToX(value),
      getElement,
      getTimeSignatureGridConfig,
      getActiveQuantizeGridStep,
      getTransportState,
      renderTracks: () => renderer.renderTracks(),
      renderClips,
      updatePlayheadUI,
      startMetronome,
      refreshPopupTimeline
    });

    const sectionBridge = requireService(
      sectionBridgeService,
      'CoreTimelineSectionBridgeService'
    ).create({
      documentRef,
      windowRef,
      getDAW,
      timeToX: value => geometry.timeToX(value),
      xToTime: value => geometry.xToTime(value),
      snapTime,
      roundMs,
      renderClips,
      selectedClips: clips.selectedClips,
      startPointerDrag,
      getTimelineInner,
      onDocumentMouseMove: (...args) =>
        getClipInteractionRuntime()?.onDocMouseMove?.(...args),
      onDocumentMouseUp: (...args) =>
        getClipInteractionRuntime()?.onDocMouseUp?.(...args),
      saveState
    });

    clipRenderer = requireService(
      clipRendererService,
      'CoreClipRendererService'
    ).create({
      documentRef,
      getDAW,
      timeToX: value => geometry.timeToX(value),
      refreshClipWaveImage: (...args) =>
        waveform.refreshClipWaveImage(...args),
      getClipFilePath,
      onClipMouseDown: (...args) =>
        getClipInteractionRuntime()?.onClipMouseDown?.(...args),
      openTimelineChordEditor: (...args) =>
        chordEditor.openTimelineChordEditor(...args),
      getFreeWarpService: () =>
        globalScope.AkordyarCoreApi?.getFreeWarpService?.() || null,
      renderSections: () =>
        sectionBridge.getTimelineSectionRendererService()
          ?.renderSections?.()
    });

    return Object.freeze({
      waveformBridge: waveform,
      timeToX: geometry.timeToX,
      xToTime: geometry.xToTime,
      timeToBarBeat: geometry.timeToBarBeat,
      barBeatToTime: geometry.barBeatToTime,
      getProjectEnd: geometry.getProjectEnd,
      ensureTimelineFits: geometry.ensureTimelineFits,
      clientToTime: geometry.clientToTime,
      clientToInnerPoint: geometry.clientToInnerPoint,
      autoScrollToPlayhead: geometry.autoScrollToPlayhead,
      getClip: clips.getClip,
      selectedClips: clips.selectedClips,
      splitClipAt: clips.splitClipAt,
      splitSelectedAtPlayhead: clips.splitSelectedAtPlayhead,
      openTimelineChordEditor: chordEditor.openTimelineChordEditor,
      getIconSvg: trackSetup.getIconSvg,
      openIconPicker: trackSetup.openIconPicker,
      addNewTrack: trackSetup.addNewTrack,
      getTimelineTrackRendererService:
        renderer.getTimelineTrackRendererService,
      updateTrackSelectionUI: renderer.updateTrackSelectionUI,
      selectTrack: renderer.selectTrack,
      renderTracks: renderer.renderTracks,
      drawLaneGrid: grid.drawLaneGrid,
      renderRuler: grid.renderRuler,
      handleTimingChange: grid.handleTimingChange,
      getTimelineSectionRendererService:
        sectionBridge.getTimelineSectionRendererService,
      renderClips,
      decodeFileToBuffer: waveform.decodeFileToBuffer,
      peaksFromBuffer: waveform.peaksFromBuffer,
      drawWaveToCanvas: waveform.drawWaveToCanvas,
      refreshClipWaveImage: waveform.refreshClipWaveImage,
      waveformService: waveform.service,
      runtimes: Object.freeze({
        geometry,
        waveform,
        clips,
        chordEditor,
        trackSetup,
        renderer,
        grid,
        sectionBridge,
        clipRenderer
      })
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreTimelineRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
