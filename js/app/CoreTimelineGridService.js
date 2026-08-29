/**
 * CoreTimelineGridService
 *
 * Owns the core-facing bridge to TimelineGrid and the timing-change refresh
 * sequence. Grid drawing itself remains in the pure TimelineGrid module.
 */
(function attachCoreTimelineGridService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    timelineGrid = globalScope.TimelineGrid,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || {},
    getTimingContext = () =>
      globalScope.requireEditorSongStateService?.()?.getTimingContext?.() ||
      {},
    getProjectEnd = () => 0,
    timeToX = () => 0,
    getElement = id => documentRef?.getElementById?.(id),
    getTimeSignatureGridConfig = () => ({}),
    getActiveQuantizeGridStep = () => 0,
    getTransportState = () => globalScope.editorTransportState || {},
    renderTracks = () => {},
    renderClips = () => {},
    updatePlayheadUI = () => {},
    startMetronome = () => {},
    refreshPopupTimeline = () => {}
  } = {}) {
    function drawLaneGrid(canvas) {
      if (!canvas || typeof timelineGrid?.drawLaneGrid !== 'function') {
        return;
      }
      const timing = getTimingContext() || {};
      const daw = getDAW() || {};
      return timelineGrid.drawLaneGrid(canvas, {
        total: getProjectEnd(),
        timeToX,
        tempo: timing.tempo,
        timeSignature: timing.timeSignature,
        pxPerSec: daw.pxPerSecond
      });
    }

    function renderRuler() {
      if (typeof timelineGrid?.renderRuler !== 'function') return;
      const timing = getTimingContext() || {};
      const daw = getDAW() || {};
      const total = getProjectEnd();
      return timelineGrid.renderRuler({
        total,
        timeToX,
        tempo: timing.tempo,
        timeSignature: timing.timeSignature,
        pxPerSec: daw.pxPerSecond,
        rulerEl: getElement('timeline-ruler'),
        labelsEl: getElement('ruler-labels'),
        tlInnerEl: getElement('tl-inner'),
        lanesEl: getElement('lanes-container'),
        onDurationChange: value => {
          daw.timelineDuration = value;
        }
      });
    }

    function handleTimingChange() {
      const timing = getTimingContext() || {};
      const config = getTimeSignatureGridConfig(
        timing.timeSignature,
        timing.tempo
      );
      const transportState = getTransportState() || {};
      transportState.snapValue = getActiveQuantizeGridStep(config);
      renderTracks();
      renderRuler();
      renderClips({ preserveWaveforms: true });
      updatePlayheadUI();
      refreshPopupTimeline();
      if (transportState.metroActive && getDAW()?.isPlaying) {
        startMetronome();
      }
    }

    return Object.freeze({
      drawLaneGrid,
      renderRuler,
      handleTimingChange
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreTimelineGridService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
