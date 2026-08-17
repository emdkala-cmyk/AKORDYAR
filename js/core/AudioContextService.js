/**
 * AudioContextService — isolated Web Audio management for the metronome click.
 *
 * Responsibilities:
 *  - Lazily create / resume an AudioContext (no forced creation at load time).
 *  - Provide `playClick(isAccent, soundType)` that synthesises the metronome
 *    tick at the current time, and `playClickAt(isAccent, soundType, when)`
 *    that schedules a tick at an exact AudioContext time (used by the
 *    look-ahead scheduler).
 *
 * During safe extraction this service is exposed on `window.AudioContextService`
 * and consumed through an adapter in app.js so the legacy path stays intact.
 */
class AudioContextService {
  constructor({
    AudioContextCtor,
    destination = null,
    contextProvider = null
  } = {}) {
    this._Ctx = AudioContextCtor || (typeof window !== 'undefined'
      ? (window.AudioContext || window.webkitAudioContext)
      : null);

    this._ctx = null;
    this._masterGain = null;

    // Track all active audio source nodes so we can stop them on demand
    // (e.g. when the metronome is stopped mid-playback).
    this._activeNodes = new Set();

    // For Node tests we inject a fake destination.
    this._externalDestination = destination;
    this._contextProvider = typeof contextProvider === 'function'
      ? contextProvider
      : null;
  }

  /**
   * Attach the service to an already-created AudioContext.
   *
   * The transport owns the main context for track playback. Reusing that
   * context here keeps metronome clicks and the visual playhead on the same
   * audio clock instead of allowing two independent clocks to drift.
   *
   * @param {AudioContext|null} context
   * @returns {AudioContext|null}
   */
  setContext(context) {
    if (!context) return this._ctx;
    if (this._ctx === context) {
      this._ensureMasterGain();
      return this._ctx;
    }

    if (this._ctx) this.stopAll();
    try {
      if (this._masterGain && typeof this._masterGain.disconnect === 'function') {
        this._masterGain.disconnect();
      }
    } catch (_) { /* noop */ }

    this._ctx = context;
    this._masterGain = null;
    this._ensureMasterGain();
    return this._ctx;
  }

  /**
   * Create the optional master gain after a context is available.
   */
  _ensureMasterGain() {
    if (!this._ctx || this._masterGain) return;
    try {
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = 1;
      const dest = this._externalDestination || this._ctx.destination;
      this._masterGain.connect(dest);
    } catch (err) {
      console.warn('[AudioContextService] Failed to initialise masterGain:', err);
      // Keep the raw context so basic oscillator nodes still work.
      this._masterGain = null;
    }
  }

  /**
   * Resolve the AudioContext, creating and resuming it when needed.
   * Returns null when no AudioContext implementation is available.
   */
  getContext() {
    if (!this._ctx && this._contextProvider) {
      try {
        const providedContext = this._contextProvider();
        if (providedContext) this.setContext(providedContext);
      } catch (err) {
        console.warn('[AudioContextService] Context provider failed:', err);
      }
    }

    if (!this._ctx) {
      if (!this._Ctx) return null;
      try {
        this._ctx = new this._Ctx();
      } catch (err) {
        console.warn('[AudioContextService] Failed to create AudioContext:', err);
        return null;
      }
    }

    this._ensureMasterGain();

    if (this._ctx && this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
      try { this._ctx.resume().catch(() => {}); } catch (_) { /* noop */ }
    }

    return this._ctx;
  }

  /**
   * Resolve just the destination node for connecting oscillators/gains.
   * Falls back to AudioContext.destination.
   */
  _destination() {
    return this._externalDestination || (this._ctx && this._ctx.destination);
  }

  /**
   * Synthesise the metronome click at the current AudioContext time.
   *
   * @param {boolean} isAccent
   * @param {string} [soundType='classic'] — 'classic' | 'wood' | 'beep' | 'click'
   * @returns {boolean} true when a sound was scheduled
   */
  playClick(isAccent, soundType = 'classic') {
    const ctx = this.getContext();
    if (!ctx) return false;
    return this.playClickAt(isAccent, soundType, ctx.currentTime);
  }

  /**
   * Synthesise the metronome click at an exact AudioContext time.
   * This is the scheduling entry point used by the look-ahead scheduler so
   * clicks are reserved ahead of time in `audioCtx.currentTime` rather than
   * being triggered from the RAF loop (which causes stutter on zoom/scroll).
   *
   * @param {boolean} isAccent
   * @param {string} [soundType='classic'] — 'classic' | 'wood' | 'beep' | 'click'
   * @param {number} when — AudioContext time (seconds) at which to play
   * @returns {boolean} true when a sound was scheduled
   */
  playClickAt(isAccent, soundType = 'classic', when) {
    const ctx = this.getContext();
    if (!ctx) return false;

    const t = Number.isFinite(when) ? when : ctx.currentTime;
    const type = soundType || 'classic';
    const vol = isAccent ? 0.35 : 0.2;
    const dest = this._destination();
    if (!dest) return false;

    try {
      if (type === 'wood') {
        // Woodblock — short percussive knock (noise burst + resonance)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = isAccent ? 800 : 600;
        gain.gain.setValueAtTime(vol * 0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        osc.connect(gain); gain.connect(dest);
        this._trackNode(osc);
        osc.start(t); osc.stop(t + 0.03);
      } else if (type === 'beep') {
        // Electronic beep — sine wave ping
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = isAccent ? 1200 : 900;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain); gain.connect(dest);
        this._trackNode(osc);
        osc.start(t); osc.stop(t + 0.08);
      } else if (type === 'click') {
        // Soft click — very short noise burst
        const buf = ctx.createBuffer(1, Math.max(1, Math.round(ctx.sampleRate * 0.015)), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.003));
        }
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = buf;
        gain.gain.setValueAtTime(isAccent ? vol : vol * 0.6, t);
        src.connect(gain); gain.connect(dest);
        this._trackNode(src);
        src.start(t);
      } else {
        // Classic (default) — sharp square wave tick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square'; osc.frequency.value = isAccent ? 1000 : 600;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain); gain.connect(dest);
        this._trackNode(osc);
        osc.start(t); osc.stop(t + 0.05);
      }

      return true;
    } catch (err) {
      console.warn('[AudioContextService] playClickAt failed:', err);
      return false;
    }
  }

  /**
   * Register a source node so it can be stopped on demand.
   * The node is removed from tracking once it has finished playing.
   *
   * @param {AudioNode} node
   */
  _trackNode(node) {
    if (!node) return;
    this._activeNodes.add(node);
    // Auto-remove from tracking once the node naturally stops.
    if (node && typeof node.onended === 'function') {
      node.onended = () => this._activeNodes.delete(node);
    }
  }

  /**
   * Stop all currently scheduled/playing metronome nodes immediately.
   * Used when the metronome is stopped so no pending clicks ring out.
   */
  stopAll() {
    const now = this._ctx ? this._ctx.currentTime : 0;
    this._activeNodes.forEach(node => {
      try {
        if (node && typeof node.stop === 'function') {
          node.stop(now);
        }
      } catch (_) { /* node already stopped */ }
      try {
        if (node && typeof node.disconnect === 'function') node.disconnect();
      } catch (_) { /* noop */ }
    });
    this._activeNodes.clear();
  }

  /**
   * Return a snapshot of the internal state (useful for tests / diagnostics).
   */
  getState() {
    return {
      hasContext: !!this._ctx,
      ctxState: this._ctx ? this._ctx.state : null,
      hasMasterGain: !!this._masterGain
    };
  }
}

if (typeof window !== 'undefined') {
  window.AudioContextService = AudioContextService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioContextService;
}
