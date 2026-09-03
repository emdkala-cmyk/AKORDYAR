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
    tempoMapService = globalScope.TempoMap,
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
    let fallbackRunning = false;
    let fallbackBeat = 0;
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
        tempoMapService,
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
      sound = 'classic',
      tempoMap = null
    } = {}) {
      soundType = sound || 'classic';

      const scheduler = getMetronomeScheduler();
      if (scheduler) {
        const clock = getClockSnapshot?.() || null;
        const daw = getDAW() || {};
        const timelineZeroAudioTime = Number(clock?.timelineZeroAudioTime);
        const sharedTempoMap =
          tempoMap || daw.tempoMap || clock?.tempoMap || null;
        const schedulerState = scheduler.getState?.() || {};
        const sameOrigin =
          Number.isFinite(timelineZeroAudioTime) &&
          Number.isFinite(Number(schedulerState.startTime)) &&
          Math.abs(
            Number(schedulerState.startTime) - timelineZeroAudioTime
          ) <= 1e-7;

        if (
          schedulerState.running &&
          sameOrigin &&
          typeof scheduler.updateTiming === 'function'
        ) {
          const updated = scheduler.updateTiming({
            bpm,
            timeSignature,
            tempoMap: sharedTempoMap,
            soundType
          });
          if (updated) {
            fallbackRunning = false;
            return true;
          }
        }

        if (schedulerState.running) scheduler.stop?.();
        const startOptions = {
          bpm,
          timeSignature,
          startTime: Number.isFinite(timelineZeroAudioTime)
            ? timelineZeroAudioTime
            : null,
          playheadPosition: daw?.playhead,
          transportStartTime: clock?.transportStartAudioTime,
          soundType
        };
        if (sharedTempoMap) startOptions.tempoMap = sharedTempoMap;
        const started = scheduler.start(startOptions);
        if (!started) return false;

        fallbackRunning = false;
        return true;
      }

      if (!metronomeEngine) return false;
      metronomeEngine.start();
      fallbackRunning = true;
      fallbackBeat = -1;
      return true;
    }

    function stopMetronome() {
      metronomeScheduler?.stop?.();
      if (metronomeEngine) metronomeEngine.stop();
      fallbackRunning = false;
      fallbackBeat = 0;
    }

    function playClick(isAccent, requestedSoundType = soundType) {
      return audioContextService?.playClick?.(
        Boolean(isAccent),
        requestedSoundType || 'classic'
      ) || false;
    }

    function checkMetronomeTick(
      playheadTime,
      { bpm = 120, timeSignature = '4/4' } = {}
    ) {
      const daw = getDAW();
      if (!fallbackRunning || !daw?.isPlaying) return null;

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
        fallbackBeat = beatEvent.beatIndex;
        return beatEvent;
      }

      const currentBeat = Math.floor(playheadTime / beatDuration);
      if (currentBeat === fallbackBeat) return null;

      const beatEvent = {
        beatIndex: currentBeat,
        beatInMeasure: currentBeat % beatsPerMeasure,
        isAccent: strongBeat(currentBeat % beatsPerMeasure, timeSignature)
      };
      playClick(beatEvent.isAccent);
      fallbackBeat = currentBeat;
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
      checkMetronomeTick,
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
