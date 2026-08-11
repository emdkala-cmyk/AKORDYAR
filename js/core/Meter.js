/**
 * Meter — pure time-signature math and bar/beat conversions.
 * NO DOM dependencies. NO global state.
 * Extracted from getTimeSignatureGridConfig, timeToBarBeat, barBeatToTime.
 */
var Meter = (function() {
  'use strict';

  /**
   * Get meter configuration for a time signature and tempo.
   * @param {string} timeSignature - e.g. "4/4", "3/4", "6/8"
   * @param {number} bpm - beats per minute
   * @returns {object} config with numerator, denominator, beatUnit, etc.
   */
  function getMeterConfig(timeSignature, bpm) {
    bpm = bpm || 120;
    var parts = (timeSignature || '4/4').split('/');
    var numerator = parseInt(parts[0]) || 4;
    var denominator = parseInt(parts[1]) || 4;

    var beatUnit, subdivisionsPerBeat;
    switch (denominator) {
      case 2:  beatUnit = 'half';       subdivisionsPerBeat = 4; break;
      case 4:  beatUnit = 'quarter';    subdivisionsPerBeat = 4; break;
      case 8:  beatUnit = 'eighth';     subdivisionsPerBeat = 2; break;
      case 16: beatUnit = 'sixteenth';  subdivisionsPerBeat = 1; break;
      default: beatUnit = 'quarter';    subdivisionsPerBeat = 4;
    }

    var baseBeatDur = 60 / bpm;
    var beatDuration = baseBeatDur * (4 / denominator);
    var measureDuration = numerator * beatDuration;

    return {
      numerator: numerator,
      denominator: denominator,
      beatUnit: beatUnit,
      beatsPerMeasure: numerator,
      subdivisionsPerBeat: subdivisionsPerBeat,
      unitsPerMeasure: numerator,
      beatDuration: beatDuration,
      measureDuration: measureDuration
    };
  }

  /**
   * Convert time in seconds to bar/beat (1-based index).
   * @param {number} seconds
   * @param {string} timeSignature
   * @param {number} bpm
   * @returns {{ bar: number, beat: number, beatDur: number, barDur: number, beatsPerBar: number }}
   */
  function timeToBarBeat(seconds, timeSignature, bpm) {
    bpm = bpm || 120;
    timeSignature = timeSignature || '4/4';
    var config = getMeterConfig(timeSignature, bpm);
    var beatsPerBar = config.beatsPerMeasure;
    var beatDur = config.beatDuration;
    var barDur = config.measureDuration;
    var totalBeats = Math.floor(seconds / beatDur);
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
    bpm = bpm || 120;
    timeSignature = timeSignature || '4/4';
    var config = getMeterConfig(timeSignature, bpm);
    return ((bar - 1) * config.measureDuration) + ((beat - 1) * config.beatDuration);
  }

  /**
   * Check if a beat index is a strong (emphasized) beat.
   *   - beatIndex 0 (first beat of measure) is always strong (downbeat).
   *   - Compound meters (6/8, 9/8, 12/8) have secondary strong beats
   *     at multiples of 3.
   * @param {number} beatIndex - zero-based index within measure
   * @param {string} timeSignature
   * @returns {boolean}
   */
  function isStrongBeat(beatIndex, timeSignature) {
    if (beatIndex === 0) return true;
    var parts = (timeSignature || '4/4').split('/');
    var num = parseInt(parts[0]) || 4;
    var den = parseInt(parts[1]) || 4;
    if (den === 8 && num % 3 === 0) {
      return beatIndex % 3 === 0;
    }
    return false;
  }

  return {
    getMeterConfig: getMeterConfig,
    timeToBarBeat: timeToBarBeat,
    barBeatToTime: barBeatToTime,
    isStrongBeat: isStrongBeat
  };
})();

if (typeof window !== 'undefined') {
  window.Meter = Meter;
}
