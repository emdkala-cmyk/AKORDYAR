/**
 * AudioContextService — isolated Web Audio management for the metronome click.
 *
 * Responsibilities:
 *  - Lazily create / resume an AudioContext (no forced creation at load time).
 *  - Provide a `playClick(isAccent, soundType)` method that synthesises the
 *    metronome tick without touching DAW, DOM or transport state.
 *
 * During safe extraction this service is exposed on `window.AudioContextService`
 * and consumed through an adapter in app.js so the legacy path stays intact.
 */
class AudioContextService {
  constructor({
    AudioContextCtor,
    destination = null
  } = {}) {
    this._Ctx = AudioContextCtor || (typeof window !== 'undefined'
      ? (window.AudioContext || window.webkitAudioContext)
      : null);

    this._ctx = null;
    this._masterGain = null;

    // For Node tests we inject a fake destination.
    this._externalDestination = destination;
  }

  /**
   * Resolve the AudioContext, creating and resuming it when needed.
   * Returns null when no AudioContext implementation is available.
   */
  getContext() {
    if (!this._ctx) {
      if (!this._Ctx) return null;
      try {
        this._ctx = new this._Ctx();
      } catch (err) {
        console.warn('[AudioContextService] Failed to create AudioContext:', err);
        return null;
      }
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
   * Synthesise the metronome click.
   *
   * @param {boolean} isAccent
   * @param {string} [soundType='classic'] — 'classic' | 'wood' | 'beep' | 'click'
   * @returns {boolean} true when a sound was scheduled
   */
  playClick(isAccent, soundType = 'classic') {
    const ctx = this.getContext();
    if (!ctx) return false;

    const t = ctx.currentTime;
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
        osc.start(t); osc.stop(t + 0.03);
      } else if (type === 'beep') {
        // Electronic beep — sine wave ping
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = isAccent ? 1200 : 900;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain); gain.connect(dest);
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
        src.start(t);
      } else {
        // Classic (default) — sharp square wave tick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square'; osc.frequency.value = isAccent ? 1000 : 600;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain); gain.connect(dest);
        osc.start(t); osc.stop(t + 0.05);
      }

      return true;
    } catch (err) {
      console.warn('[AudioContextService] playClick failed:', err);
      return false;
    }
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