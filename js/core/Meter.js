/**
 * Meter — pure time-signature math and bar/beat conversions.
 * NO DOM dependencies. NO global state.
 * Extracted from getTimeSignatureGridConfig, timeToBarBeat, barBeatToTime.
 */
var Meter = (function() {
  'use strict';

  var DEFAULT_TIME_SIGNATURE = '4/4';
  var DEFAULT_BPM = 120;
  var GRID_EPSILON = 1e-9;

  function parseTimeSignature(timeSignature) {
    var isDefault = timeSignature == null || String(timeSignature).trim() === '';
    var source = isDefault ? DEFAULT_TIME_SIGNATURE : String(timeSignature).trim();
    var match = /^(\d+)\s*\/\s*(\d+)$/.exec(source);
    var numerator = match ? Number(match[1]) : 4;
    var denominator = match ? Number(match[2]) : 4;
    var validDenominator =
      denominator > 0 &&
      denominator <= 64 &&
      (denominator & (denominator - 1)) === 0;
    var isValid =
      Boolean(match) &&
      Number.isInteger(numerator) &&
      numerator > 0 &&
      validDenominator;

    if (!isValid) {
      numerator = 4;
      denominator = 4;
    }

    return {
      numerator: numerator,
      denominator: denominator,
      timeSignature: numerator + '/' + denominator,
      isValid: isDefault || isValid
    };
  }

  function normalizeBpm(bpm) {
    var numeric = Number(bpm);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULT_BPM;
  }

  function getSubdivisionCount(denominator) {
    switch (denominator) {
      case 2:
      case 4:
        return 4;
      case 8:
        return 2;
      default:
        return 1;
    }
  }

  function getBeatUnit(denominator) {
    switch (denominator) {
      case 1: return 'whole';
      case 2: return 'half';
      case 4: return 'quarter';
      case 8: return 'eighth';
      case 16: return 'sixteenth';
      case 32: return 'thirty-second';
      case 64: return 'sixty-fourth';
      default: return 'quarter';
    }
  }

  /**
   * Get meter configuration for a time signature and tempo.
   * @param {string} timeSignature - e.g. "4/4", "3/4", "6/8"
   * @param {number} bpm - beats per minute
   * @returns {object} config with numerator, denominator, beatUnit, etc.
   */
  function getMeterConfig(timeSignature, bpm) {
    var parsed = parseTimeSignature(timeSignature);
    var normalizedBpm = normalizeBpm(bpm);
    var numerator = parsed.numerator;
    var denominator = parsed.denominator;
    var subdivisionsPerBeat = getSubdivisionCount(denominator);
    var secondsPerQuarter = 60 / normalizedBpm;
    var beatDuration = secondsPerQuarter * (4 / denominator);
    var measureDuration = numerator * beatDuration;

    return {
      timeSignature: parsed.timeSignature,
      isValid: parsed.isValid,
      bpm: normalizedBpm,
      numerator: numerator,
      denominator: denominator,
      beatUnit: getBeatUnit(denominator),
      beatsPerMeasure: numerator,
      subdivisionsPerBeat: subdivisionsPerBeat,
      unitsPerMeasure: numerator * subdivisionsPerBeat,
      secondsPerQuarter: secondsPerQuarter,
      beatDuration: beatDuration,
      measureDuration: measureDuration
    };
  }

  function resolveConfig(configOrTimeSignature, bpm) {
    if (
      configOrTimeSignature &&
      typeof configOrTimeSignature === 'object' &&
      Number.isFinite(configOrTimeSignature.beatDuration)
    ) {
      return configOrTimeSignature;
    }
    return getMeterConfig(configOrTimeSignature, bpm);
  }

  function snapRatioNearInteger(ratio) {
    var nearest = Math.round(ratio);
    return Math.abs(ratio - nearest) <= GRID_EPSILON ? nearest : ratio;
  }

  function beatIndexAtTime(seconds, configOrTimeSignature, bpm) {
    var config = resolveConfig(configOrTimeSignature, bpm);
    var safeSeconds = Math.max(0, Number(seconds) || 0);
    var ratio = snapRatioNearInteger(safeSeconds / config.beatDuration);
    return Math.max(0, Math.floor(ratio));
  }

  function nextBeatIndexAtOrAfter(seconds, configOrTimeSignature, bpm) {
    var config = resolveConfig(configOrTimeSignature, bpm);
    var safeSeconds = Math.max(0, Number(seconds) || 0);
    var ratio = snapRatioNearInteger(safeSeconds / config.beatDuration);
    return Math.max(0, Math.ceil(ratio));
  }

  function beatIndexToTime(beatIndex, configOrTimeSignature, bpm) {
    var config = resolveConfig(configOrTimeSignature, bpm);
    return Math.max(0, Number(beatIndex) || 0) * config.beatDuration;
  }

  function getGridStep(configOrTimeSignature, preset, bpm) {
    var config = resolveConfig(configOrTimeSignature, bpm);
    var beatDuration = config.beatDuration;
    var measureDuration = config.measureDuration;
    switch (preset || '1/4') {
      case '1/1': return measureDuration;
      case '1/2': return measureDuration / 2;
      case '1/4': return beatDuration;
      case '1/8': return beatDuration / 2;
      case '1/16': return beatDuration / 4;
      case '1/32': return beatDuration / 8;
      case 'triplet': return beatDuration / 3;
      case 'dotted': return beatDuration * 1.5;
      default: return beatDuration;
    }
  }

  function snapTimeToGrid(seconds, gridStep) {
    var safeSeconds = Math.max(0, Number(seconds) || 0);
    var safeStep = Number(gridStep);
    if (!Number.isFinite(safeStep) || safeStep <= 0) return safeSeconds;
    return Math.round(safeSeconds / safeStep) * safeStep;
  }

  /**
   * Convert time in seconds to bar/beat (1-based index).
   * @param {number} seconds
   * @param {string} timeSignature
   * @param {number} bpm
   * @returns {{ bar: number, beat: number, beatDur: number, barDur: number, beatsPerBar: number }}
   */
  function timeToBarBeat(seconds, timeSignature, bpm) {
    var config = getMeterConfig(timeSignature, bpm);
    var beatsPerBar = config.beatsPerMeasure;
    var beatDur = config.beatDuration;
    var barDur = config.measureDuration;
    var totalBeats = beatIndexAtTime(seconds, config);
    var bar = Math.floor(totalBeats / beatsPerBar) + 1;
    var beat = (totalBeats % beatsPerBar) + 1;
    return { bar: bar, beat: beat, beatDur: beatDur, barDur: barDur, beatsPerBar: beatsPerBar };
  }

  /**
   * Convert bar/beat (1-based) to time in seconds.
   * @param {number} bar
   * @param {number} beat
   * @param {string} timeSignature
   * @param {number} bpm
   * @returns {number} seconds
   */
  function barBeatToTime(bar, beat, timeSignature, bpm) {
    var config = getMeterConfig(timeSignature, bpm);
    var zeroBasedBeat =
      (Math.max(1, Number(bar) || 1) - 1) * config.beatsPerMeasure +
      (Math.max(1, Number(beat) || 1) - 1);
    return beatIndexToTime(zeroBasedBeat, config);
  }

  /**
   * Check if a beat index is a strong (emphasized) beat.
   *   - beatIndex 0 (first beat of measure) is always strong (downbeat).
   *   - 6/8 intentionally keeps one downbeat here. This makes playback
   *     «تیک تاک تاک تاک تاک تاک» with no secondary accent.
   * @param {number} beatIndex - zero-based index within measure
   * @param {string} timeSignature
   * @returns {boolean}
   */
  function isStrongBeat(beatIndex, timeSignature) {
    if (beatIndex === 0) return true;
    var parts = (timeSignature || '4/4').split('/');
    var num = parseInt(parts[0]) || 4;
    var den = parseInt(parts[1]) || 4;
    if (den === 8 && num === 6) return false;
    if (den === 8 && num % 3 === 0) {
      return beatIndex % 3 === 0;
    }
    return false;
  }

  return {
    GRID_EPSILON: GRID_EPSILON,
    parseTimeSignature: parseTimeSignature,
    getMeterConfig: getMeterConfig,
    beatIndexAtTime: beatIndexAtTime,
    nextBeatIndexAtOrAfter: nextBeatIndexAtOrAfter,
    beatIndexToTime: beatIndexToTime,
    getGridStep: getGridStep,
    snapTimeToGrid: snapTimeToGrid,
    timeToBarBeat: timeToBarBeat,
    barBeatToTime: barBeatToTime,
    isStrongBeat: isStrongBeat
  };
})();

if (typeof window !== 'undefined') {
  window.Meter = Meter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Meter;
}
