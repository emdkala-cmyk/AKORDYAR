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
 * During safe extraction this scheduler is exposed on `window.MetronomeScheduler`
 * and consumed through an adapter in app.js.
 */
class MetronomeScheduler {
  constructor({
    audioContextService,
    metronomeEngine,
    getMeterConfig,
    isStrongBeat,
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
  * @param {string} [opts.soundType='classic']
  * @returns {boolean} true when started
  */
 start({
   bpm = 120,
   timeSignature = '4/4',
   startTime = null,
   soundType = 'classic'
 } = {}) {
   const ctx = this.audioContextService.getContext();
   if (!ctx) return false;

   this._bpm = bpm;
   this._timeSignature = timeSignature;
   this._soundType = soundType || 'classic';

   const config = this.getMeterConfig(timeSignature, bpm);
   if (!config || !Number.isFinite(config.beatDuration) || config.beatDuration <= 0) {
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
    const playheadNow = Math.max(0, nowCtx - this._startTime);
    const epsilon = 1e-9;
    this._currentBeat = Math.max(0, Math.ceil(playheadNow / this._beatDuration - epsilon));

    // The first note time is the AudioContext instant for the current beat.
    // Clamp to `nowCtx` so we never schedule into the past.
    this._nextNoteTime = Math.max(
      nowCtx,
      this._startTime + this._currentBeat * this._beatDuration
    );

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
    // the next future beat.  A 2 ms grace window prevents dropping beats
    // due to normal setTimeout jitter.
    const nowCtx = ctx.currentTime;
    const graceWindow = 0.002; // 2 ms — tight enough to catch real lag
    while (this._nextNoteTime + graceWindow < nowCtx) {
      this._advanceBeat();
    }

    // Reserve every beat that is within the look-ahead window.
    while (this._nextNoteTime < nowCtx + this.scheduleAheadTime) {
      this._scheduleBeat(this._currentBeat, this._nextNoteTime);
      this._advanceBeat();
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
      const isAccent = this.isStrongBeat(beatInMeasure, this._timeSignature);
      this.audioContextService.playClickAt(isAccent, this._soundType, time);
  }

  /**
   * Advance the beat clock to the next note time.
   */
  _advanceBeat() {
    this._nextNoteTime += this._beatDuration;
    this._currentBeat++;
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
