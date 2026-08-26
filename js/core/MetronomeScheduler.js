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
class MetronomeScheduler {
  constructor({
    audioContextService,
    metronomeEngine,
    getMeterConfig,
    isStrongBeat,
    getLoop = () => null,
    lookahead = 25,          // ms between scheduler ticks
    scheduleAheadTime = 0.1, // seconds of beats to reserve ahead
    timer = null             // injectable setTimeout for tests
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
   * @param {number} [opts.playheadPosition] — timeline position at transport start
   * @param {number} [opts.transportStartTime] — AudioContext time transport starts
  * @param {string} [opts.soundType='classic']
  * @returns {boolean} true when started
  */
 start({
   bpm = 120,
   timeSignature = '4/4',
   startTime = null,
   playheadPosition = null,
   transportStartTime = null,
   soundType = 'classic'
 } = {}) {
   const ctx = this.audioContextService.getContext();
   if (!ctx) return false;

   this._bpm = bpm;
   this._timeSignature = timeSignature;
   this._soundType = soundType || 'classic';

   const config = this.getMeterConfig(timeSignature, bpm);
   if (
     !config ||
     config.isValid === false ||
     !Number.isFinite(config.beatDuration) ||
     config.beatDuration <= 0 ||
     !Number.isFinite(config.beatsPerMeasure) ||
     config.beatsPerMeasure <= 0
   ) {
     return false;
   }
   this._beatDuration = config.beatDuration;
   this._beatsPerMeasure = config.beatsPerMeasure || 4;

    // ── Accurate start-time alignment ──────────────────────────────
    // Use the caller-supplied startTime when available; otherwise fall
    // back to the current AudioContext time (beat 0 = now).
    this._startTime = Number.isFinite(startTime) ? startTime : ctx.currentTime;

    // Calculate which beat the playhead is currently on so the first
    // scheduled beat is the *next* grid point (never the past).
    const nowCtx = ctx.currentTime;
    const hasFutureTransportStart =
      Number.isFinite(playheadPosition) &&
      Number.isFinite(transportStartTime) &&
      transportStartTime > nowCtx + 1e-9;
    const playheadNow = hasFutureTransportStart
      ? Math.max(0, playheadPosition)
      : Math.max(0, nowCtx - this._startTime);
    const beatRatio = playheadNow / this._beatDuration;
    const nearestBeat = Math.round(beatRatio);
    const normalizedRatio = Math.abs(beatRatio - nearestBeat) <= 1e-9
      ? nearestBeat
      : beatRatio;
    this._currentBeat = Math.max(0, Math.ceil(normalizedRatio));

    // The first note time is the AudioContext instant for the current beat.
    // Clamp to `nowCtx` so we never schedule into the past.
    this._nextNoteTime = hasFutureTransportStart
      ? Math.max(
          transportStartTime,
          transportStartTime +
            (this._currentBeat * this._beatDuration - playheadNow)
        )
      : Math.max(
          nowCtx,
          this._startTime + this._currentBeat * this._beatDuration
        );
    this._loopConfig = this._readLoopConfig();
    this._nextLoopBoundaryTime = null;
    if (this._loopConfig) {
      if (playheadNow >= this._loopConfig.end) {
        const loopedTime = this._loopConfig.start +
          ((playheadNow - this._loopConfig.start) % this._loopConfig.length);
        const loopedRatio = loopedTime / this._beatDuration;
        const loopedNearest = Math.round(loopedRatio);
        const loopedNormalized = Math.abs(loopedRatio - loopedNearest) <= 1e-9
          ? loopedNearest
          : loopedRatio;
        this._currentBeat = Math.max(0, Math.ceil(loopedNormalized));
        const loopedAudioOrigin = hasFutureTransportStart
          ? transportStartTime
          : nowCtx;
        this._nextNoteTime = loopedAudioOrigin + Math.max(
          0,
          this._currentBeat * this._beatDuration - loopedTime
        );
        this._nextLoopBoundaryTime = loopedAudioOrigin +
          Math.max(0, this._loopConfig.end - loopedTime);
      } else {
        this._nextLoopBoundaryTime = hasFutureTransportStart
          ? transportStartTime +
            Math.max(0, this._loopConfig.end - playheadNow)
          : this._startTime + this._loopConfig.end;
      }
    }
    this._noteTimeAnchor = {
      beat: this._currentBeat,
      audioTime: this._nextNoteTime
    };

    this.running = true;

    if (this.metronomeEngine) this.metronomeEngine.start();

    this._scheduleNext();
    return true;
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
      this._scheduleBeat(this._currentBeat, this._nextNoteTime);
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
 _scheduleBeat(beatNumber, time) {
      const beatInMeasure = beatNumber % this._beatsPerMeasure;
      let isAccent = this.isStrongBeat(beatInMeasure, this._timeSignature);
      if (this.metronomeEngine) {
        const beatEvent = this.metronomeEngine.nextBeat(
          beatNumber * this._beatDuration,
          {
            bpm: this._bpm,
            timeSignature: this._timeSignature
          }
        );
        if (beatEvent) isAccent = beatEvent.isAccent;
      }
      this.audioContextService.playClickAt(isAccent, this._soundType, time);
  }

  /**
   * Advance the beat clock to the next note time.
   */
  _advanceBeat() {
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

    const timelineNow = Math.max(0, nowCtx - this._startTime);
    if (timelineNow < next.end) {
      this._nextLoopBoundaryTime = this._startTime + next.end;
      return;
    }
    const loopedTime = next.start +
      ((timelineNow - next.start) % next.length);
    this._nextLoopBoundaryTime = nowCtx +
      Math.max(0, next.end - loopedTime);
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
      const firstBeatRatio = loop.start / this._beatDuration;
      const firstNearest = Math.round(firstBeatRatio);
      const firstNormalized = Math.abs(firstBeatRatio - firstNearest) <= 1e-9
        ? firstNearest
        : firstBeatRatio;
      const firstBeat = Math.max(0, Math.ceil(firstNormalized));
      const firstBeatTime = firstBeat * this._beatDuration;
      const boundary = this._nextLoopBoundaryTime;
      this._currentBeat = firstBeat;
      this._nextNoteTime = boundary + Math.max(0, firstBeatTime - loop.start);
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
