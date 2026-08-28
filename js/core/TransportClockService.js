/**
 * TransportClockService
 *
 * مالک محاسبهٔ origin و snapshot زمان پخش. state واقعی همچنان از طریق
 * getDAW تزریق می‌شود و این سرویس clock دوم یا DOM مستقل ایجاد نمی‌کند.
 */
(function attachTransportClockService(globalScope) {
  'use strict';

  function create({
    getDAW,
    playheadMath = globalScope.PlayheadMath,
    getNow = () => globalScope.performance?.now?.() ?? Date.now()
  } = {}) {
    if (typeof getDAW !== 'function') {
      throw new TypeError('TransportClockService requires getDAW');
    }
    if (!playheadMath) {
      throw new TypeError('TransportClockService requires PlayheadMath');
    }

    function now() {
      const value = getNow();
      return Number.isFinite(value) ? value : 0;
    }

    function setOrigin(
      currentTime = getDAW().playhead,
      audioOriginOverride = null
    ) {
      const daw = getDAW();
      const safeTime = Number.isFinite(currentTime) ? currentTime : 0;
      const perfOrigin = playheadMath.createOrigin(now(), safeTime);
      daw.playOriginPerf = perfOrigin.playOriginPerf;
      daw.playOriginTime = perfOrigin.playOriginTime;
      const audioNow = daw.audioCtx?.currentTime;
      daw.playOriginAudio = Number.isFinite(audioOriginOverride)
        ? audioOriginOverride
        : (Number.isFinite(audioNow) ? audioNow : null);
      return daw.playOriginAudio;
    }

    function getSnapshot({
      visual = false,
      performanceTime = now()
    } = {}) {
      const daw = getDAW();
      const audioNow = daw.audioCtx?.currentTime;
      if (
        daw.isPlaying &&
        Number.isFinite(daw.playOriginAudio) &&
        Number.isFinite(audioNow)
      ) {
        const visualAudioTime = visual
          ? playheadMath.getOutputAlignedAudioTime(
              daw.audioCtx,
              performanceTime,
              audioNow
            )
          : audioNow;
        return {
          audioTime: audioNow,
          timelineTime: playheadMath.getAudioElapsed(
            audioNow,
            daw.playOriginAudio,
            daw.playOriginTime
          ),
          visualAudioTime: Number.isFinite(visualAudioTime)
            ? visualAudioTime
            : audioNow,
          visualTimelineTime: playheadMath.getAudioElapsed(
            Number.isFinite(visualAudioTime) ? visualAudioTime : audioNow,
            daw.playOriginAudio,
            daw.playOriginTime
          ),
          transportStartAudioTime: daw.playOriginAudio,
          timelineZeroAudioTime: playheadMath.getTimelineZeroAudioTime(
            daw.playOriginAudio,
            daw.playOriginTime
          )
        };
      }

      if (!daw.isPlaying) {
        return {
          audioTime: Number.isFinite(audioNow) ? audioNow : null,
          timelineTime: Number.isFinite(daw.playhead) ? daw.playhead : 0,
          visualAudioTime: Number.isFinite(audioNow) ? audioNow : null,
          visualTimelineTime: Number.isFinite(daw.playhead) ? daw.playhead : 0,
          transportStartAudioTime: null,
          timelineZeroAudioTime: null
        };
      }

      const fallbackTimelineTime = playheadMath.getElapsed(
        performanceTime,
        daw.playOriginPerf,
        daw.playOriginTime
      );
      return {
        audioTime: null,
        timelineTime: fallbackTimelineTime,
        visualAudioTime: null,
        visualTimelineTime: fallbackTimelineTime,
        transportStartAudioTime: null,
        timelineZeroAudioTime: null
      };
    }

    function getVisualPlayhead(performanceTime = now()) {
      const snapshot = getSnapshot({
        visual: true,
        performanceTime
      });
      const rawTime = Number(snapshot.timelineTime);
      const visualTime = Number(snapshot.visualTimelineTime);
      if (Number.isFinite(rawTime) && Number.isFinite(visualTime)) {
        // Electron can report an output timestamp slightly ahead of the
        // scheduling clock. Never let that stale projection skip lyric lines.
        return Math.max(0, Math.min(rawTime, visualTime));
      }
      if (Number.isFinite(visualTime)) return Math.max(0, visualTime);
      return Number.isFinite(rawTime) ? Math.max(0, rawTime) : 0;
    }

    return Object.freeze({
      setOrigin,
      getSnapshot,
      getPlayhead: () => getSnapshot().timelineTime,
      getVisualPlayhead
    });
  }

  const service = Object.freeze({ create });
  globalScope.TransportClockService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
