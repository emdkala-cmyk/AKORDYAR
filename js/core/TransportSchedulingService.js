/**
 * TransportSchedulingService
 *
 * Coordinates the audio-side metronome and count-in schedulers without
 * depending on the DOM or owning the transport state itself.
 */
(function attachTransportSchedulingService(globalScope) {
  'use strict';

  function create({
    getDAW,
    getMeterConfig,
    getLoop = () => null,
    getClockSnapshot = () => null,
    contextProvider = null,
    AudioContextServiceCtor = globalScope.AudioContextService,
    MetronomeEngineCtor = globalScope.MetronomeEngine,
    MetronomeSchedulerCtor = globalScope.MetronomeScheduler,
    CountInSchedulerCtor = globalScope.CountInScheduler,
    isStrongBeat = globalScope.Meter?.isStrongBeat,
    scheduleAheadTime = 1.5,
    logger = globalScope.console
  } = {}) {
    if (typeof getDAW !== 'function') {
      throw new TypeError('TransportSchedulingService requires getDAW');
    }
    if (typeof getMeterConfig !== 'function') {
      throw new TypeError('TransportSchedulingService requires getMeterConfig');
    }

    const strongBeat = typeof isStrongBeat === 'function'
      ? isStrongBeat
      : () => false;

    const audioContextService = typeof AudioContextServiceCtor === 'function'
      ? new AudioContextServiceCtor({
          contextProvider: typeof contextProvider === 'function'
            ? contextProvider
            : null
        })
      : null;

    const metronomeEngine =
      typeof MetronomeEngineCtor === 'function'
        ? new MetronomeEngineCtor({
            getMeterConfig,
            isStrongBeat: strongBeat
          })
        : null;

    let metronomeScheduler = null;
    let countInScheduler = null;
    let legacyRunning = false;
    let legacyBeat = 0;
    let soundType = 'classic';
    let lastTimingLog = null;

    function getMetronomeScheduler() {
      if (metronomeScheduler) return metronomeScheduler;
      if (
        typeof MetronomeSchedulerCtor !== 'function' ||
        !audioContextService
      ) {
        return null;
      }

      metronomeScheduler = new MetronomeSchedulerCtor({
        audioContextService,
        metronomeEngine,
        getMeterConfig,
        getLoop,
        scheduleAheadTime,
        isStrongBeat: strongBeat
      });
      return metronomeScheduler;
    }

    function getCountInScheduler() {
      if (countInScheduler) return countInScheduler;
      if (
        typeof CountInSchedulerCtor !== 'function' ||
        !audioContextService
      ) {
        return null;
      }

      countInScheduler = new CountInSchedulerCtor({
        audioContextService,
        getMeterConfig,
        isStrongBeat: strongBeat
      });
      return countInScheduler;
    }

    function setContext(context) {
      return audioContextService?.setContext?.(context) || null;
    }

    function startMetronome({
      bpm = 120,
      timeSignature = '4/4',
      sound = 'classic'
    } = {}) {
      stopMetronome();
      soundType = sound || 'classic';

      const scheduler = getMetronomeScheduler();
      if (scheduler) {
        const clock = getClockSnapshot?.() || null;
        const timelineZeroAudioTime = Number(clock?.timelineZeroAudioTime);
        if (!Number.isFinite(timelineZeroAudioTime)) return false;

        const daw = getDAW();
        const started = scheduler.start({
          bpm,
          timeSignature,
          startTime: timelineZeroAudioTime,
          playheadPosition: daw?.playhead,
          transportStartTime: clock?.transportStartAudioTime,
          soundType
        });
        if (!started) return false;

        legacyRunning = false;
        return true;
      }

      if (!metronomeEngine) return false;
      metronomeEngine.start();
      legacyRunning = true;
      legacyBeat = -1;
      return true;
    }

    function stopMetronome() {
      metronomeScheduler?.stop?.();
      if (metronomeEngine) metronomeEngine.stop();
      legacyRunning = false;
      legacyBeat = 0;
    }

    function playClick(isAccent, requestedSoundType = soundType) {
      return audioContextService?.playClick?.(
        Boolean(isAccent),
        requestedSoundType || 'classic'
      ) || false;
    }

    function checkLegacyTick(
      playheadTime,
      { bpm = 120, timeSignature = '4/4' } = {}
    ) {
      const daw = getDAW();
      if (!legacyRunning || !daw?.isPlaying) return null;

      const config = getMeterConfig(timeSignature, bpm);
      const beatDuration = Number(config?.beatDuration);
      const beatsPerMeasure = Number(config?.beatsPerMeasure);
      if (
        !Number.isFinite(beatDuration) ||
        beatDuration <= 0 ||
        !Number.isFinite(beatsPerMeasure) ||
        beatsPerMeasure <= 0 ||
        !Number.isFinite(playheadTime)
      ) {
        return null;
      }

      const timingKey = `${timeSignature}:${bpm}`;
      if (timingKey !== lastTimingLog) {
        logger?.log?.('[METRONOME TIMING]', {
          sig: timeSignature,
          bpm,
          numerator: config.numerator,
          denominator: config.denominator,
          beatDuration: config.beatDuration,
          measureDuration: config.measureDuration
        });
        lastTimingLog = timingKey;
      }

      if (metronomeEngine) {
        const beatEvent = metronomeEngine.nextBeat(playheadTime, {
          bpm,
          timeSignature
        });
        if (!beatEvent) return null;

        playClick(beatEvent.isAccent);
        legacyBeat = beatEvent.beatIndex;
        return beatEvent;
      }

      const currentBeat = Math.floor(playheadTime / beatDuration);
      if (currentBeat === legacyBeat) return null;

      const beatEvent = {
        beatIndex: currentBeat,
        beatInMeasure: currentBeat % beatsPerMeasure,
        isAccent: strongBeat(currentBeat % beatsPerMeasure, timeSignature)
      };
      playClick(beatEvent.isAccent);
      legacyBeat = currentBeat;
      return beatEvent;
    }

    function isCountInRunning() {
      return Boolean(getCountInScheduler()?.running);
    }

    function cancelCountIn() {
      return getCountInScheduler()?.cancel?.() || false;
    }

    return Object.freeze({
      getAudioContextService: () => audioContextService,
      getMetronomeEngine: () => metronomeEngine,
      getMetronomeScheduler,
      getCountInScheduler,
      setContext,
      startMetronome,
      stopMetronome,
      playClick,
      checkLegacyTick,
      isCountInRunning,
      cancelCountIn
    });
  }

  const service = Object.freeze({ create });
  globalScope.TransportSchedulingService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
