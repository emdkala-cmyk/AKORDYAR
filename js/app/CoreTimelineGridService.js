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
    tempoMap = globalScope.TempoMap,
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
    resyncPlayingTransport = () => false,
    refreshPopupTimeline = () => {},
    getTransportPlayhead = () => 0,
    setTempoMap = () => false,
    saveSong = () => {}
  } = {}) {
    function createTempoMap(timing, daw) {
      if (!tempoMap?.create) return null;
      const raw = timing?.tempoMap || daw?.tempoMap;
      if (raw?.getGridPoints && raw?.changeAt) return raw;
      return tempoMap.create({
        tempo: timing?.tempo,
        timeSignature: timing?.timeSignature,
        tempoMap: raw
      });
    }

    function getSharedTempoMap(timing, daw) {
      if (!tempoMap?.create) return null;
      if (daw?.tempoMap?.getGridPoints && daw?.tempoMap?.changeAt) {
        return daw.tempoMap;
      }
      const map = createTempoMap(timing, daw);
      if (!map) return null;
      if (daw) daw.tempoMap = map.toJSON();
      return map;
    }

    function syncTempoMapForTimingChange(change, timing, daw) {
      const map = createTempoMap(timing, daw);
      if (!map) return null;

      const currentTime = daw?.isPlaying
        ? Number(getTransportPlayhead())
        : Number(daw?.playhead);
      const timelineTime = Number.isFinite(currentTime)
        ? Math.max(0, currentTime)
        : 0;
      const previousTiming = change?.previousTiming;
      const sourceMap =
        timing?.tempoMap ||
        daw?.tempoMap ||
        (previousTiming
          ? tempoMap.create(previousTiming).toJSON()
          : null);
      const source = sourceMap
        ? tempoMap.create({
            tempo: previousTiming?.tempo || timing?.tempo,
            timeSignature:
              previousTiming?.timeSignature || timing?.timeSignature,
            tempoMap: sourceMap
          })
        : map;
      const changed = source.changeAt(timelineTime, {
        tempo: timing?.tempo,
        timeSignature: timing?.timeSignature
      });
      const serializable = changed.toJSON();
      if (daw) daw.tempoMap = serializable;
      setTempoMap(changed);
      saveSong();
      return changed;
    }

    function drawLaneGrid(canvas) {
      const options = arguments[1] || {};
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
        tempoMap: getSharedTempoMap(timing, daw),
        pxPerSec: daw.pxPerSecond,
        detail: options.detail !== false
      });
    }

    function renderRuler() {
      const options = arguments[0] || {};
      if (typeof timelineGrid?.renderRuler !== 'function') return;
      const timing = getTimingContext() || {};
      const daw = getDAW() || {};
      const total = getProjectEnd();
      return timelineGrid.renderRuler({
        total,
        timeToX,
        tempo: timing.tempo,
        timeSignature: timing.timeSignature,
        tempoMap: getSharedTempoMap(timing, daw),
        pxPerSec: daw.pxPerSecond,
        detail: options.detail !== false,
        rulerEl: getElement('timeline-ruler'),
        labelsEl: getElement('ruler-labels'),
        tlInnerEl: getElement('tl-inner'),
        lanesEl: getElement('lanes-container'),
        onDurationChange: value => {
          daw.timelineDuration = value;
        }
      });
    }

    function handleTimingChange(change = {}) {
      const timing = getTimingContext() || {};
      const daw = getDAW() || {};
      syncTempoMapForTimingChange(change, timing, daw);
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
        resyncPlayingTransport({ preserveOrigin: true, timingChange: true });
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
