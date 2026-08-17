/**
 * PlayheadMath — pure time calculations for playback position.
 * NO DOM dependencies. NO global state. NO audio.
 * Follows the Meter.js extraction pattern.
 */
var PlayheadMath = (function() {
  'use strict';

  /**
   * Clamp a time value to [0, duration].
   */
  function clamp(time, duration) {
    duration = duration || 0;
    if (time < 0) return 0;
    if (time > duration) return duration;
    return time;
  }

  /**
   * Compute the running playhead from a playback origin.
   * Used in the rAF tick loop.
   *
   * @param {number} now - performance.now() or similar timestamp in ms
   * @param {number} originPerf - timestamp when playback started/resumed
   * @param {number} originTime - playhead value at that origin
   * @returns {number} current playhead in seconds
   */
  function getElapsed(now, originPerf, originTime) {
    return originTime + (now - originPerf) / 1000;
  }

  /**
   * Compute timeline time from the AudioContext clock.
   */
  function getAudioElapsed(audioNow, originAudio, originTime) {
    if (
      !Number.isFinite(audioNow) ||
      !Number.isFinite(originAudio) ||
      !Number.isFinite(originTime)
    ) {
      return Number.isFinite(originTime) ? originTime : 0;
    }
    return originTime + Math.max(0, audioNow - originAudio);
  }

  /**
   * Resolve the audio time currently reaching the output device.
   *
   * AudioContext.currentTime is the scheduling clock. For visual playback,
   * Chromium/Electron can expose a more useful presentation mapping through
   * getOutputTimestamp(): contextTime is the sample at performanceTime.
   * Projecting that pair to the current performance timestamp keeps the
   * playhead aligned with what is audible without introducing a UI timer or a
   * hand-tuned delay.
   */
  function getOutputAlignedAudioTime(audioContext, performanceTime, fallback) {
    var fallbackTime = Number.isFinite(fallback)
      ? fallback
      : Number(audioContext && audioContext.currentTime);
    if (
      !audioContext ||
      typeof audioContext.getOutputTimestamp !== 'function'
    ) {
      return Number.isFinite(fallbackTime) ? fallbackTime : null;
    }

    try {
      var timestamp = audioContext.getOutputTimestamp();
      var contextTime = Number(timestamp && timestamp.contextTime);
      var timestampPerformance = Number(timestamp && timestamp.performanceTime);
      var nowPerformance = Number(performanceTime);
      if (
        Number.isFinite(contextTime) &&
        Number.isFinite(timestampPerformance) &&
        Number.isFinite(nowPerformance)
      ) {
        return contextTime + (nowPerformance - timestampPerformance) / 1000;
      }
    } catch (_) {
      // Some Electron/Chromium versions expose the method but can reject it
      // while the audio device is being reconfigured.
    }

    return Number.isFinite(fallbackTime) ? fallbackTime : null;
  }

  /**
   * AudioContext time corresponding to timeline position zero.
   */
  function getTimelineZeroAudioTime(originAudio, originTime) {
    if (!Number.isFinite(originAudio) || !Number.isFinite(originTime)) {
      return null;
    }
    return originAudio - originTime;
  }

  /**
   * Create a new playback origin snapshot.
   * Called after seek, resume, loop correction, or transport start.
   *
   * @param {number} now - performance.now()
   * @param {number} currentTime - current playhead value
   * @returns {{ playOriginPerf: number, playOriginTime: number }}
   */
  function createOrigin(now, currentTime) {
    return {
      playOriginPerf: now,
      playOriginTime: currentTime
    };
  }

  /**
   * Move a time position to the nearest measure start.
   */
  function snapToNearestMeasureStart(time, measureDuration, duration) {
    if (!Number.isFinite(time) || !Number.isFinite(measureDuration) || measureDuration <= 0) {
      return Number.isFinite(time) ? Math.max(0, time) : 0;
    }

    var snapped = Math.round(Math.max(0, time) / measureDuration) * measureDuration;
    if (Number.isFinite(duration) && duration >= 0) {
      snapped = clamp(snapped, duration);
    }
    return snapped;
  }

  /**
   * Apply A-B loop correction to a playhead value.
   * Returns the corrected playhead and whether a wrap occurred.
   *
   * @param {number} playhead - current raw playhead
   * @param {boolean} loopEnabled
   * @param {number} loopA - loop start in seconds
   * @param {number} loopB - loop end in seconds
   * @returns {{ playhead: number, wrapped: boolean }}
   */
  function applyLoop(playhead, loopEnabled, loopA, loopB) {
    if (!loopEnabled || playhead < loopB) {
      return { playhead: playhead, wrapped: false };
    }
    var overshoot = playhead - loopB;
    return { playhead: loopA + overshoot, wrapped: true };
  }

  return {
    clamp: clamp,
    getElapsed: getElapsed,
    getAudioElapsed: getAudioElapsed,
    getOutputAlignedAudioTime: getOutputAlignedAudioTime,
    getTimelineZeroAudioTime: getTimelineZeroAudioTime,
    createOrigin: createOrigin,
    snapToNearestMeasureStart: snapToNearestMeasureStart,
    applyLoop: applyLoop
  };
})();

if (typeof window !== 'undefined') {
  window.PlayheadMath = PlayheadMath;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayheadMath;
}
