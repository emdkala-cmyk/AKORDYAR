/**
 * CountInScheduler
 *
 * Schedules a finite metronome count-in on the transport AudioContext and
 * notifies the caller when the requested number of measures has elapsed.
 * The service owns no project playback state; the transport decides when
 * layers, chords, and the score are allowed to start.
 */
const DefaultCountInTempoMap =
  typeof module !== 'undefined' && module.exports
    ? require('./TempoMap.js')
    : typeof globalThis !== 'undefined'
      ? globalThis.TempoMap
      : null;

class CountInScheduler {
  constructor({
    audioContextService,
    getMeterConfig,
    isStrongBeat,
    timer = null,
    clearTimer = null,
    leadTime = 0.08,
    tempoMapService = DefaultCountInTempoMap
  } = {}) {
    if (!audioContextService || typeof audioContextService.getContext !== 'function') {
      throw new TypeError('CountInScheduler requires audioContextService');
    }
    if (typeof getMeterConfig !== 'function') {
      throw new TypeError('CountInScheduler requires getMeterConfig');
    }
    if (typeof isStrongBeat !== 'function') {
      throw new TypeError('CountInScheduler requires isStrongBeat');
    }

    this.audioContextService = audioContextService;
    this.getMeterConfig = getMeterConfig;
    this.isStrongBeat = isStrongBeat;
    this._timer = timer || ((fn, ms) => setTimeout(fn, ms));
    this._clearTimer = clearTimer || (id => clearTimeout(id));
    this._leadTime = Math.max(0, Number(leadTime) || 0);
    this.tempoMapService = tempoMapService;

    this.running = false;
    this._timerID = null;
    this._startTime = null;
    this._endTime = null;
    this._bars = 0;
    this._totalBeats = 0;
    this._beatDuration = 0;
    this._beatsPerMeasure = 0;
    this._bpm = 120;
    this._timeSignature = '4/4';
    this._soundType = 'classic';
    this._tempoMap = null;
    this._onComplete = null;

    this.start = this.start.bind(this);
    this.cancel = this.cancel.bind(this);
    this.getState = this.getState.bind(this);
  }

  start({
    bars = 0,
    bpm = 120,
    timeSignature = '4/4',
    tempoMap = null,
    timelinePosition = 0,
    soundType = 'classic',
    onComplete = null
  } = {}) {
    this.cancel();

    const countInBars = Math.max(0, Math.floor(Number(bars) || 0));
    if (!countInBars) return null;

    const context = this.audioContextService.getContext();
    if (!context || !Number.isFinite(Number(context.currentTime))) return null;

    const config = this.getMeterConfig(timeSignature, bpm);
    if (
      !config ||
      config.isValid === false ||
      !Number.isFinite(config.beatDuration) ||
      config.beatDuration <= 0 ||
      !Number.isFinite(config.beatsPerMeasure) ||
      config.beatsPerMeasure <= 0
    ) {
      return null;
    }

    const map =
      tempoMap?.getTimingAt
        ? tempoMap
        : typeof this.tempoMapService?.create === 'function'
          ? this.tempoMapService.create({
              bpm,
              timeSignature,
              tempoMap
            })
          : null;
    const mappedConfig = map?.getTimingAt?.(
      Number(timelinePosition) || 0
    );
    const effectiveConfig = mappedConfig || config;
    const totalBeats = countInBars * effectiveConfig.beatsPerMeasure;
    const now = Number(context.currentTime);
    const startTime = now + this._leadTime;
    const endTime =
      startTime + totalBeats * effectiveConfig.beatDuration;
    let scheduledClicks = 0;

    for (let beat = 0; beat < totalBeats; beat += 1) {
      const beatInMeasure = beat % effectiveConfig.beatsPerMeasure;
      const accent = this.isStrongBeat(beatInMeasure, timeSignature);
      const scheduled = this.audioContextService.playClickAt(
        accent,
        soundType || 'classic',
        startTime + beat * effectiveConfig.beatDuration
      );
      if (scheduled) scheduledClicks += 1;
    }

    // A count-in without an audible click is misleading. Let the transport
    // fall back to normal playback when the audio service cannot schedule it.
    if (scheduledClicks !== totalBeats) {
      this.audioContextService.stopAll?.();
      return null;
    }

    this.running = true;
    this._timerID = null;
    this._startTime = startTime;
    this._endTime = endTime;
    this._bars = countInBars;
    this._totalBeats = totalBeats;
    this._beatDuration = effectiveConfig.beatDuration;
    this._beatsPerMeasure = effectiveConfig.beatsPerMeasure;
    this._bpm = Number(effectiveConfig.tempo) || Number(bpm) || 120;
    this._timeSignature = effectiveConfig.timeSignature || timeSignature;
    this._tempoMap = map;
    this._soundType = soundType || 'classic';
    this._onComplete = typeof onComplete === 'function' ? onComplete : null;

    const delayMs = Math.max(0, (endTime - Number(context.currentTime)) * 1000);
    this._timerID = this._timer(() => {
      if (!this.running) return;

      this.running = false;
      this._timerID = null;
      const callback = this._onComplete;
      this._onComplete = null;
      const result = this.getState();

      // The finite count-in has ended. Any click node that is still tracked
      // belongs to the count-in, not to the project's continuous metronome.
      this.audioContextService.stopAll?.();
      if (callback) callback(result);
    }, delayMs);

    return this.getState();
  }

  cancel() {
    const wasRunning = this.running || this._timerID !== null;
    this.running = false;
    if (this._timerID !== null) {
      this._clearTimer(this._timerID);
      this._timerID = null;
    }
    this._onComplete = null;
    if (wasRunning) this.audioContextService.stopAll?.();
    return wasRunning;
  }

  getState() {
    return {
      running: this.running,
      bars: this._bars,
      totalBeats: this._totalBeats,
      beatDuration: this._beatDuration,
      beatsPerMeasure: this._beatsPerMeasure,
      bpm: this._bpm,
      timeSignature: this._timeSignature,
      soundType: this._soundType,
      startTime: this._startTime,
      endTime: this._endTime,
      hasTimer: this._timerID !== null
    };
  }
}

if (typeof window !== 'undefined') {
  window.CountInScheduler = CountInScheduler;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CountInScheduler;
}
