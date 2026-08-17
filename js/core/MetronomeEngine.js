/**
 * MetronomeEngine — pure beat-transition tracking for the transport metronome.
 *
 * Audio synthesis, transport state and DOM updates intentionally remain in
 * app.js during the safe-extraction phase.
 */
class MetronomeEngine {
  constructor({
    getMeterConfig,
    isStrongBeat
  } = {}) {
    if (typeof getMeterConfig !== 'function') {
      throw new TypeError('MetronomeEngine requires getMeterConfig');
    }

    if (typeof isStrongBeat !== 'function') {
      throw new TypeError('MetronomeEngine requires isStrongBeat');
    }

    this.getMeterConfig = getMeterConfig;
    this.isStrongBeat = isStrongBeat;
    this.running = false;
    this.lastBeat = 0;
  }

  start() {
    this.running = true;
    this.lastBeat = -1;
  }

  stop() {
    this.running = false;
    this.lastBeat = 0;
  }

  /**
   * Returns a beat event only when playhead enters a different beat.
   *
   * @param {number} playheadTime seconds
   * @param {{bpm?: number, timeSignature?: string}} options
   * @returns {null|{beatIndex:number, beatInMeasure:number, isAccent:boolean}}
   */
  nextBeat(playheadTime, {
    bpm = 120,
    timeSignature = '4/4'
  } = {}) {
    if (!this.running || !Number.isFinite(playheadTime)) return null;

    const config = this.getMeterConfig(timeSignature, bpm);
    const beatDuration = config && config.beatDuration;
    const beatsPerMeasure = config && config.beatsPerMeasure;

    if (
      !Number.isFinite(beatDuration) ||
      beatDuration <= 0 ||
      !Number.isFinite(beatsPerMeasure) ||
      beatsPerMeasure <= 0
    ) {
      return null;
    }

    const ratio = playheadTime / beatDuration;
    const nearest = Math.round(ratio);
    const normalizedRatio = Math.abs(ratio - nearest) <= 1e-9
      ? nearest
      : ratio;
    const beatIndex = Math.max(0, Math.floor(normalizedRatio));
    if (beatIndex === this.lastBeat) return null;

    const beatInMeasure = beatIndex % beatsPerMeasure;
    this.lastBeat = beatIndex;

    return {
      beatIndex,
      beatInMeasure,
      isAccent: this.isStrongBeat(beatInMeasure, timeSignature)
    };
  }

  getState() {
    return {
      running: this.running,
      lastBeat: this.lastBeat
    };
  }
}

if (typeof window !== 'undefined') {
  window.MetronomeEngine = MetronomeEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetronomeEngine;
}
