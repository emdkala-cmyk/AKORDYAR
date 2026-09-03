/**
 * MetronomeScheduler — look-ahead metronome scheduler (Chris Wilson pattern).
 *
 * Instead of triggering clicks from the requestAnimationFrame transport loop
 * (which stutters during zoom/scroll), this scheduler runs on a short
 * setTimeout/setInterval and reserves clicks ahead of time in
 * `audioCtx.currentTime`. This decouples metronome timing from the UI thread.
 *
 * Responsibilities:
 *  - Own the beat clock: `nextNoteTime`, `currentBeat`, `beatDuration`.
 *  - Use `AudioContextService.playClickAt(isAccent, soundType, when)` to
 *    schedule each click at an exact AudioContext time.
 *  - Use `MetronomeEngine.nextBeat(playheadTime, ...)` to track beat
 *    transitions and compute accents, so the engine stays the source of truth
 *    for beat counting.
 *
 * The active transport runtime consumes this scheduler through
 * `TransportSchedulingService`.
 */
const DefaultTempoMapService =
  typeof module !== 'undefined' && module.exports
    ? require('./TempoMap.js')
    : typeof globalThis !== 'undefined'
      ? globalThis.TempoMap
      : null;

class MetronomeScheduler {
  constructor({
    audioContextService,
    metronomeEngine,
    getMeterConfig,
    isStrongBeat,
    getLoop = () => null,
    lookahead = 25,          // ms between scheduler ticks
    scheduleAheadTime = 0.1, // seconds of beats to reserve ahead
    timer = null,            // injectable setTimeout for tests
    tempoMapService = DefaultTempoMapService
  } = {}) {
    if (!audioContextService) {
      throw new TypeError('MetronomeScheduler requires audioContextService');
    }
    if (typeof getMeterConfig !== 'function') {
      throw new TypeError('MetronomeScheduler requires getMeterConfig');
    }
    if (typeof isStrongBeat !== 'function') {
      throw new TypeError('MetronomeScheduler requires isStrongBeat');
    }

    this.audioContextService = audioContextService;
    this.metronomeEngine = metronomeEngine || null;
    this.getMeterConfig = getMeterConfig;
    this.isStrongBeat = isStrongBeat;
    this.getLoop = typeof getLoop === 'function' ? getLoop : () => null;
    this.lookahead = lookahead;
    this.scheduleAheadTime = scheduleAheadTime;
    this.tempoMapService = tempoMapService;

    // Wrap setTimeout in an arrow function so it's always called with a
    // safe context (avoids "Illegal invocation" when `this._timer(...)` is
    // invoked as a method of `this`).
    this._timer = timer || ((fn, ms) => setTimeout(fn, ms));
    this._clearTimer = (id) => clearTimeout(id);

    this.running = false;
    this._timerID = null;
    this._nextNoteTime = 0;
    this._currentBeat = 0;
    this._startTime = 0;
    this._bpm = 120;
    this._timeSignature = '4/4';
    this._beatDuration = 0.5;
    this._beatsPerMeasure = 4;
    this._soundType = 'classic';
    this._loopConfig = null;
    this._nextLoopBoundaryTime = null;
    this._loopCycleAudioOffset = null;
    this._tempoMap = null;
    this._nextBeatEvent = null;
    // Affine mapping from integer beat index to AudioContext time.  The
    // anchor is reset when a loop/future transport remaps the timeline; beat
    // advancement then derives from that mapping instead of accumulating
    // `beatDuration` deltas or falling back to the original startTime.
    this._noteTimeAnchor = null;

    // Bind all internal methods to `this` so context is never lost.
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this._scheduleNext = this._scheduleNext.bind(this);
    this._scheduleBeat = this._scheduleBeat.bind(this);
    this._advanceBeat = this._advanceBeat.bind(this);
    this.updateTiming = this.updateTiming.bind(this);
    this.getState = this.getState.bind(this);
  }

 /**
  * Start the look-ahead scheduler.
  *
  * The `startTime` parameter is the AudioContext time at which beat 0
  * (playhead=0) should sound.  To keep the metronome perfectly locked to
  * the transport, compute it as:
  *
  *     startTime = ctx.currentTime - playheadPosition
  *
  * where both values are captured at the same instant.
  *
  * @param {object} opts
  * @param {number} [opts.bpm=120]
   * @param {string} [opts.timeSignature='4/4']
 * @param {number} [opts.startTime] — AudioContext time for beat 0
   * @param {number} [opts.playheadPosition] — timeline position used only when
   *   the caller cannot provide a transport origin
   * @param {number} [opts.transportStartTime] — AudioContext time transport starts
   * @param {object} [opts.tempoMap] — serialized or live TempoMap
  * @param {string} [opts.soundType='classic']
  * @returns {boolean} true when started
  */
 start({
   bpm = 120,
   timeSignature = '4/4',
   startTime = null,
   playheadPosition = null,
   transportStartTime = null,
   tempoMap = null,
   soundType = 'classic'
 } = {}) {
   const ctx = this.audioContextService.getContext();
   if (!ctx) return false;

   const requestedConfig = this.getMeterConfig(timeSignature, bpm);
   if (
     !requestedConfig ||
     requestedConfig.isValid === false ||
     !Number.isFinite(requestedConfig.beatDuration) ||
     requestedConfig.beatDuration <= 0 ||
     !Number.isFinite(requestedConfig.beatsPerMeasure) ||
     requestedConfig.beatsPerMeasure <= 0
   ) {
     return false;
   }

   const map = this._createTempoMap({
     bpm,
     timeSignature,
     tempoMap
   });
   if (!map) return false;

   const initialConfig = map.getTimingAt?.(0) || requestedConfig;
   this._tempoMap = map;
   this._bpm = Number(initialConfig.tempo) || Number(bpm) || 120;
   this._timeSignature =
     initialConfig.timeSignature || timeSignature || '4/4';
   this._soundType = soundType || 'classic';
   this._beatDuration =
     Number(initialConfig.beatDuration) || requestedConfig.beatDuration;
   this._beatsPerMeasure =
     Number(initialConfig.beatsPerMeasure) || requestedConfig.beatsPerMeasure;

   const nowCtx = Number(ctx.currentTime);
   const safeNow = Number.isFinite(nowCtx) ? nowCtx : 0;
   const safePlayhead = Number(playheadPosition);
   const hasPlayhead = Number.isFinite(safePlayhead);
   const requestedStart = Number(startTime);
   const requestedTransportStart = Number(transportStartTime);
   const hasTransportStart = Number.isFinite(requestedTransportStart);
   const hasExplicitStart = Number.isFinite(requestedStart);

   // `startTime` is the AudioContext timestamp for timeline time zero. If a
   // caller only has the current playhead, derive the same origin from the
   // AudioContext clock instead of silently making beat zero equal "now".
   this._startTime = hasExplicitStart
     ? requestedStart
     : hasTransportStart && hasPlayhead
       ? requestedTransportStart - safePlayhead
       : hasPlayhead
         ? safeNow - safePlayhead
         : safeNow;

   const hasFutureTransportStart =
     hasTransportStart &&
     requestedTransportStart > safeNow + 1e-9;
   const timelineAtStart = hasFutureTransportStart
     ? Math.max(0, requestedTransportStart - this._startTime)
     : Math.max(0, safeNow - this._startTime);

   this._loopConfig = this._readLoopConfig();
   this._nextLoopBoundaryTime = null;
   this._loopCycleAudioOffset = null;
   this._nextBeatEvent = null;

   let timelineForNextBeat = timelineAtStart;
   if (this._loopConfig && timelineForNextBeat >= this._loopConfig.end) {
     timelineForNextBeat =
       this._loopConfig.start +
       ((timelineForNextBeat - this._loopConfig.start) %
         this._loopConfig.length);
     const cycleAudioTime = hasFutureTransportStart
       ? requestedTransportStart
       : safeNow;
     this._loopCycleAudioOffset =
       cycleAudioTime - this._loopConfig.start;
     this._nextLoopBoundaryTime =
       cycleAudioTime +
       Math.max(0, this._loopConfig.end - timelineForNextBeat);
   } else if (this._loopConfig) {
     this._loopCycleAudioOffset = this._startTime;
     this._nextLoopBoundaryTime =
       this._startTime + this._loopConfig.end;
   }

   this._nextBeatEvent = this._getNextBeatEvent(timelineForNextBeat);
   if (!this._nextBeatEvent) return false;
   this._currentBeat = this._nextBeatEvent.beatIndex;
   this._nextNoteTime = this._audioTimeForEvent(this._nextBeatEvent);
    this._noteTimeAnchor = {
      beat: this._currentBeat,
      audioTime: this._nextNoteTime
    };

    this.running = true;

    if (this.metronomeEngine) this.metronomeEngine.start();

    this._scheduleNext();
    return true;
  }

  _createTempoMap({ bpm, timeSignature, tempoMap }) {
    if (tempoMap?.getBeatAtOrAfter && tempoMap?.nextBeatAfter) {
      return tempoMap;
    }
    if (typeof this.tempoMapService?.create !== 'function') return null;
    return this.tempoMapService.create({
      tempo: bpm,
      timeSignature,
      tempoMap
    });
  }

  _getNextBeatEvent(timelineTime, options = {}) {
    if (this._tempoMap?.getBeatAtOrAfter) {
      return this._tempoMap.getBeatAtOrAfter(
        Math.max(0, Number(timelineTime) || 0),
        options
      );
    }

    const ratio =
      Math.max(0, Number(timelineTime) || 0) / this._beatDuration;
    const beatIndex =
      options.includeCurrent === false
        ? Math.floor(ratio) + 1
        : Math.ceil(ratio - 1e-9);
    const safeBeat = Math.max(0, beatIndex);
    return {
      time: safeBeat * this._beatDuration,
      quarter: safeBeat,
      beatIndex: safeBeat,
      beatInMeasure: safeBeat % this._beatsPerMeasure,
      bar: Math.floor(safeBeat / this._beatsPerMeasure) + 1,
      isBarStart: safeBeat % this._beatsPerMeasure === 0,
      isAccent: this.isStrongBeat(
        safeBeat % this._beatsPerMeasure,
        this._timeSignature
      ),
      bpm: this._bpm,
      tempo: this._bpm,
      timeSignature: this._timeSignature
    };
  }

  _audioTimeForEvent(event) {
    if (
      this._loopConfig &&
      Number.isFinite(this._loopCycleAudioOffset) &&
      event &&
      event.time >= this._loopConfig.start - 1e-9 &&
      event.time < this._loopConfig.end + 1e-9
    ) {
      return this._loopCycleAudioOffset + event.time;
    }
    return this._startTime + Number(event?.time || 0);
  }

  /**
   * Stop the scheduler and cancel any pending timer.
   * Also stops any audio nodes already scheduled in the AudioContext so
   * no pending metronome clicks ring out after stopping.
   */
  stop() {
    this.running = false;
    if (this._timerID !== null) {
      this._clearTimer(this._timerID);
      this._timerID = null;
    }
    if (this.metronomeEngine) this.metronomeEngine.stop();
    // Kill all pending/active metronome audio nodes immediately.
    if (this.audioContextService && typeof this.audioContextService.stopAll === 'function') {
      this.audioContextService.stopAll();
    }
    this._nextBeatEvent = null;
    this._tempoMap = null;
  }

  /**
   * Replace the shared timing map while preserving the existing transport
   * origin. Already-reserved click nodes are cancelled; the next click is
   * found from the current AudioContext position on the new map.
   */
  updateTiming({
    bpm = this._bpm,
    timeSignature = this._timeSignature,
    tempoMap = null,
    soundType = this._soundType
  } = {}) {
    if (!this.running) return false;
    const context = this.audioContextService.getContext();
    if (!context) return false;

    const now = Number(context.currentTime);
    if (!Number.isFinite(now)) return false;
    const currentTimeline = this._timelineTimeAtAudio(now);
    const nextMap = this._createTempoMap({
      bpm,
      timeSignature,
      tempoMap
    });
    if (!nextMap) return false;

    if (this._timerID !== null) {
      this._clearTimer(this._timerID);
      this._timerID = null;
    }
    this.audioContextService.stopAll?.();
    if (this.metronomeEngine) this.metronomeEngine.stop();

    this._tempoMap = nextMap;
    this._bpm = Number(bpm) || this._bpm;
    this._timeSignature = timeSignature || this._timeSignature;
    this._soundType = soundType || this._soundType;
    const config = nextMap.getTimingAt?.(currentTimeline) ||
      this.getMeterConfig(this._timeSignature, this._bpm);
    this._beatDuration = Number(config?.beatDuration) || this._beatDuration;
    this._beatsPerMeasure =
      Number(config?.beatsPerMeasure) || this._beatsPerMeasure;
    this._nextBeatEvent = this._getNextBeatEvent(currentTimeline, {
      includeCurrent: false
    });
    if (!this._nextBeatEvent) return false;
    this._currentBeat = this._nextBeatEvent.beatIndex;
    this._nextNoteTime = this._audioTimeForEvent(this._nextBeatEvent);
    this._noteTimeAnchor = {
      beat: this._currentBeat,
      audioTime: this._nextNoteTime
    };
    if (this.metronomeEngine) this.metronomeEngine.start();
    this.running = true;
    this._scheduleNext();
    return true;
  }

  _timelineTimeAtAudio(audioTime) {
    const safeAudio = Number(audioTime);
    if (!Number.isFinite(safeAudio)) return 0;
    if (!this._loopConfig) {
      return Math.max(0, safeAudio - this._startTime);
    }

    const cycleOffset = Number(this._loopCycleAudioOffset);
    if (
      Number.isFinite(cycleOffset) &&
      safeAudio >= cycleOffset + this._loopConfig.start - 1e-9
    ) {
      return this._loopConfig.start +
        ((safeAudio - (cycleOffset + this._loopConfig.start)) %
          this._loopConfig.length);
    }
    return Math.max(0, safeAudio - this._startTime);
  }

 /**
  * The look-ahead loop. Runs every `lookahead` ms and reserves all beats
  * that fall within `scheduleAheadTime` of the current AudioContext time.
  */
  _scheduleNext() {
   if (!this.running) return;
   const ctx = this.audioContextService.getContext();
   if (!ctx) return;

    // ── Drop missed beats (UI thread was busy, e.g. during zoom) ──
    // Never emit a burst of late clicks.  Silently advance past any grid
    // points whose scheduled time has already passed, then continue from
    // the next future beat. A tiny floating-point tolerance keeps exact
    // boundaries stable without intentionally playing late clicks.
    const nowCtx = ctx.currentTime;
    this._refreshLoopConfig(nowCtx);
    this._advanceLoopBoundaryIfNeeded();
    const pastTolerance = 1e-6;
    while (this._nextNoteTime < nowCtx - pastTolerance) {
      this._advanceBeat();
      this._advanceLoopBoundaryIfNeeded();
    }

    // Reserve every beat that is within the look-ahead window.
    while (this._nextNoteTime < nowCtx + this.scheduleAheadTime) {
      if (this._advanceLoopBoundaryIfNeeded()) continue;
      this._scheduleBeat(
        this._nextBeatEvent || this._currentBeat,
        this._nextNoteTime
      );
      this._advanceBeat();
      this._advanceLoopBoundaryIfNeeded();
    }

    this._timerID = this._timer(() => this._scheduleNext(), this.lookahead);
  }

 /**
  * Schedule a single click at an exact AudioContext time.
  * Uses isStrongBeat directly to compute accents — the scheduler already
  * knows the exact beat number, so there is no need to route through
  * MetronomeEngine (which maintains its own internal state and can drift).
  *
  * @param {number} beatNumber
  * @param {number} time — AudioContext time (seconds)
  */
 _scheduleBeat(beatValue, time) {
      const event = beatValue && typeof beatValue === 'object'
        ? beatValue
        : null;
      const beatNumber = event?.beatIndex ??
        (Number(beatValue) || 0);
      const beatInMeasure = event?.beatInMeasure ??
        beatNumber % this._beatsPerMeasure;
      const eventSignature = event?.timeSignature || this._timeSignature;
      let isAccent = event?.isAccent ??
        this.isStrongBeat(beatInMeasure, eventSignature);
      if (this.metronomeEngine) {
        // Keep the legacy engine's observable state warm for integrations,
        // but do not use its independent clock to decide accent or timing.
        this.metronomeEngine.nextBeat(
          event?.time ?? beatNumber * this._beatDuration,
          {
            bpm: event?.bpm || this._bpm,
            timeSignature: eventSignature
          }
        );
      }
      this.audioContextService.playClickAt(isAccent, this._soundType, time);
  }

  /**
   * Advance the beat clock to the next note time.
   */
  _advanceBeat() {
    const expectedBeat = Number(this._nextBeatEvent?.beatIndex);
    if (
      this._tempoMap &&
      this._nextBeatEvent &&
      Number.isFinite(expectedBeat) &&
      this._currentBeat === expectedBeat
    ) {
      const next = this._tempoMap.nextBeatAfter(this._nextBeatEvent);
      if (next) {
        this._nextBeatEvent = next;
        this._currentBeat = next.beatIndex;
        this._nextNoteTime = this._audioTimeForEvent(next);
        return;
      }
    } else if (this._tempoMap && this._nextBeatEvent) {
      // A few existing integrations inspect and adjust `_currentBeat`
      // directly. Preserve their deterministic affine fallback rather than
      // silently ignoring that explicit state change.
      this._nextBeatEvent = null;
    }

    this._currentBeat++;
    if (
      this._noteTimeAnchor &&
      Number.isFinite(this._noteTimeAnchor.beat) &&
      Number.isFinite(this._noteTimeAnchor.audioTime)
    ) {
      this._nextNoteTime =
        this._noteTimeAnchor.audioTime +
        (this._currentBeat - this._noteTimeAnchor.beat) * this._beatDuration;
      return;
    }
    this._nextNoteTime =
      this._startTime +
      this._currentBeat * this._beatDuration;
  }

  _readLoopConfig() {
    let loop = null;
    try {
      loop = this.getLoop();
    } catch (_) {
      loop = null;
    }
    const start = Number(loop?.start);
    const end = Number(loop?.end);
    if (
      !loop?.enabled ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end - start <= 1e-6
    ) {
      return null;
    }
    return { start, end, length: end - start };
  }

  _refreshLoopConfig(nowCtx) {
    const next = this._readLoopConfig();
    const previous = this._loopConfig;
    if (
      previous &&
      next &&
      previous.start === next.start &&
      previous.end === next.end
    ) {
      return;
    }
    this._loopConfig = next;
    if (!next) {
      this._nextLoopBoundaryTime = null;
      return;
    }

    const timelineNow = this._timelineTimeAtAudio(nowCtx);
    if (timelineNow < next.end) {
      this._loopCycleAudioOffset = this._startTime;
      this._nextLoopBoundaryTime = this._startTime + next.end;
      return;
    }
    const loopedTime = next.start +
      ((timelineNow - next.start) % next.length);
    this._loopCycleAudioOffset = nowCtx - loopedTime;
    this._nextLoopBoundaryTime =
      nowCtx + Math.max(0, next.end - loopedTime);
  }

  _advanceLoopBoundaryIfNeeded() {
    const loop = this._loopConfig;
    if (
      !loop ||
      !Number.isFinite(this._nextLoopBoundaryTime) ||
      this._nextNoteTime < this._nextLoopBoundaryTime - 1e-9
    ) {
      return false;
    }

    let guard = 0;
    while (guard++ < 1000) {
      const boundary = this._nextLoopBoundaryTime;
      const firstBeat = this._getNextBeatEvent(loop.start);
      if (!firstBeat || firstBeat.time >= loop.end - 1e-9) {
        return true;
      }
      this._loopCycleAudioOffset = boundary - loop.start;
      this._nextBeatEvent = firstBeat;
      this._currentBeat = firstBeat.beatIndex;
      this._nextNoteTime = this._audioTimeForEvent(firstBeat);
      this._noteTimeAnchor = {
        beat: this._currentBeat,
        audioTime: this._nextNoteTime
      };
      this._nextLoopBoundaryTime = boundary + loop.length;
      if (this._nextNoteTime < this._nextLoopBoundaryTime - 1e-9) {
        return true;
      }
    }
    return true;
  }

  /**
   * Return a snapshot of the internal state (useful for tests / diagnostics).
   */
  getState() {
    return {
      running: this.running,
      bpm: this._bpm,
      timeSignature: this._timeSignature,
      beatDuration: this._beatDuration,
      beatsPerMeasure: this._beatsPerMeasure,
      nextNoteTime: this._nextNoteTime,
      currentBeat: this._currentBeat,
      startTime: this._startTime,
      soundType: this._soundType,
      loopConfig: this._loopConfig,
      hasTimer: !!this._timerID
    };
  }
}

if (typeof window !== 'undefined') {
  window.MetronomeScheduler = MetronomeScheduler;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetronomeScheduler;
}
