/**
 * CoreMetronomeService
 *
 * Owns the editor-facing metronome and count-in orchestration while keeping
 * the audio scheduler and DAW state injected. Legacy global function names
 * are published by app/core.js for classic scripts and inline actions.
 */
(function attachCoreMetronomeService(globalScope) {
  'use strict';

  function create({
    getElement = id => globalScope.document?.getElementById?.(id),
    getTransportState = () => ({}),
    getTimingContext = () => null,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || {},
    getProjectEnd = () => Number.POSITIVE_INFINITY,
    seekTransport = () => {},
    stopAllVoices = () => {},
    updatePlayheadUI = () => {},
    playheadMath = globalScope.PlayheadMath,
    getGridConfig = () => ({}),
    getSchedulingService = () => null,
    getCountInScheduler = () => null,
    ensureAudioCtx = () => {},
    getMetroSound = () => globalScope.APP_SETTINGS?.metroSound || 'classic'
  } = {}) {
    function readTimingContext() {
      let timing = {};
      try {
        timing = getTimingContext?.() || {};
      } catch (_) {
        timing = {};
      }

      const stateTempo = Number(timing.tempo);
      const elementTempo = Number(getElement('edTempo')?.value);
      const bpm = Number.isFinite(stateTempo) && stateTempo > 0
        ? stateTempo
        : Number.isFinite(elementTempo) && elementTempo > 0
          ? elementTempo
          : 120;
      const timeSignature =
        timing.timeSignature ||
        getElement('edTimeSig')?.value ||
        '4/4';

      return {
        bpm,
        timeSignature,
        tempoMap: timing.tempoMap || getDAW()?.tempoMap || null
      };
    }

    function alignPlayheadToNearestMeasure(config) {
      const daw = getDAW() || {};
      const current = Number.isFinite(daw.playhead) ? daw.playhead : 0;
      const aligned = playheadMath?.snapToNearestMeasureStart?.(
        current,
        config?.measureDuration,
        getProjectEnd()
      ) ?? current;

      if (Math.abs(aligned - current) < 0.0005) return aligned;

      if (daw.isPlaying) {
        seekTransport(aligned, true, true);
      } else {
        daw.playhead = aligned;
        stopAllVoices();
        updatePlayheadUI();
      }
      return aligned;
    }

    function getMetronomeSchedulerBridge() {
      return getSchedulingService()?.getMetronomeScheduler?.() || null;
    }

    function isCountInRunning() {
      return Boolean(getSchedulingService()?.isCountInRunning?.());
    }

    function cancelCountIn() {
      return getSchedulingService()?.cancelCountIn?.() || false;
    }

    function setCountInBars(value) {
      const state = getTransportState();
      state.countInBars = Math.max(0, Number(value) || 0);
      if (isCountInRunning()) cancelCountIn();
      if (!state.countInBars) return;

      const { bpm, timeSignature } = readTimingContext();
      alignPlayheadToNearestMeasure(
        getGridConfig(timeSignature, bpm)
      );
    }

    function toggleMetronome() {
      const state = getTransportState();
      state.metroActive = !state.metroActive;
      getElement('metroToggleBtn').textContent = state.metroActive ? '🔊' : '🔇';
      if (state.metroActive && getDAW().isPlaying) startMetronome();
      else stopMetronome();
    }

    function startMetronome() {
      const state = getTransportState();
      const timing = readTimingContext();
      ensureAudioCtx();
      const options = {
        bpm: timing.bpm,
        timeSignature: timing.timeSignature,
        sound: getMetroSound() || 'classic'
      };
      if (timing.tempoMap) options.tempoMap = timing.tempoMap;
      const started = getSchedulingService()?.startMetronome?.(options) || false;
      state.metroTimer = started ? true : null;
      return started;
    }

    function stopMetronome() {
      getSchedulingService()?.stopMetronome?.();
      getTransportState().metroTimer = null;
    }

    function checkMetronomeTick(playheadTime) {
      const state = getTransportState();
      if (!state.metroActive || !getDAW().isPlaying) return;
      const timing = readTimingContext();
      const options = {
        bpm: timing.bpm,
        timeSignature: timing.timeSignature
      };
      if (timing.tempoMap) options.tempoMap = timing.tempoMap;
      return getSchedulingService()?.checkMetronomeTick?.(
        playheadTime,
        options
      ) || null;
    }

    return Object.freeze({
      alignPlayheadToNearestMeasure,
      setCountInBars,
      getMetronomeSchedulerBridge,
      getCountInScheduler,
      isCountInRunning,
      cancelCountIn,
      toggleMetronome,
      startMetronome,
      stopMetronome,
      checkMetronomeTick
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreMetronomeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
