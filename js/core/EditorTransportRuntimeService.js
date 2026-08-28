/**
 * EditorTransportRuntimeService
 *
 * Builds the editor's clock and scheduling boundaries in one place. The
 * service does not own DAW state; it only wires existing runtime services.
 */
(function attachEditorTransportRuntimeService(globalScope) {
  function create({
    getDAW,
    getMeterConfig,
    getLoop = () => null,
    contextProvider = null,
    playheadMath = globalScope.PlayheadMath,
    getNow = () => globalScope.performance?.now?.() ?? Date.now(),
    scheduleAheadTime = 1.5,
    logger = globalScope.console,
    clockServiceFactory = globalScope.TransportClockService?.create,
    schedulingServiceFactory = globalScope.TransportSchedulingService?.create
  } = {}) {
    if (typeof clockServiceFactory !== 'function') {
      throw new Error('TransportClockService باید قبل از app/core.js بارگذاری شود.');
    }
    if (typeof schedulingServiceFactory !== 'function') {
      throw new Error('TransportSchedulingService باید قبل از app/core.js بارگذاری شود.');
    }

    const clockService = clockServiceFactory({
      getDAW,
      playheadMath,
      getNow
    });
    const schedulingService = schedulingServiceFactory({
      getDAW,
      getMeterConfig,
      getLoop,
      getClockSnapshot: (...args) => clockService.getSnapshot(...args),
      contextProvider,
      scheduleAheadTime,
      logger
    });

    return Object.freeze({
      clockService,
      schedulingService,
      audioContextService: schedulingService.getAudioContextService?.() || null,
      countInScheduler: schedulingService.getCountInScheduler?.() || null,
      setOrigin: (...args) => clockService.setOrigin(...args),
      getClockSnapshot: (...args) => clockService.getSnapshot(...args),
      getPlayhead: (...args) => clockService.getPlayhead(...args),
      getVisualPlayhead: (...args) => clockService.getVisualPlayhead(...args)
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorTransportRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
