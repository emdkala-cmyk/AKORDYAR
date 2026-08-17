const assert = require('assert');
const AudioContextService = require('../core/AudioContextService.js');

// ─── Fake AudioContext for Node tests ───
class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.sampleRate = 44100;
    this.destination = { setSinkId: () => Promise.resolve() };
    this._oscillators = [];
    this._gains = [];
    this._buffers = [];
    this._sources = [];
  }

  createOscillator() {
    const osc = {
      type: 'sine',
      frequency: { value: 0 },
      connect: () => {},
      start: () => {},
      stop: () => {}
    };
    this._oscillators.push(osc);
    return osc;
  }

  createGain() {
    const gain = {
      gain: {
        value: 0,
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        cancelScheduledValues: () => {}
      },
      connect: () => {}
    };
    this._gains.push(gain);
    return gain;
  }

  createBuffer(channels, length, sampleRate) {
    const buf = {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length)
    };
    this._buffers.push(buf);
    return buf;
  }

  createBufferSource() {
    const src = {
      buffer: null,
      connect: () => {},
      start: () => {}
    };
    this._sources.push(src);
    return src;
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

// ─── Test 1: No AudioContext → playClick returns false ───
const serviceNoCtx = new AudioContextService({ AudioContextCtor: null });
assert.strictEqual(serviceNoCtx.playClick(true), false, 'no ctx must return false');
assert.strictEqual(serviceNoCtx.getContext(), null, 'getContext must return null');

// ─── Test 2: With fake ctx → playClick returns true and creates nodes ───
const fakeCtx = new FakeAudioContext();
const service = new AudioContextService({
  AudioContextCtor: FakeAudioContext,
  destination: fakeCtx.destination
});

// Override the created ctx with our fakeCtx so we can inspect it
service._ctx = fakeCtx;
service._masterGain = { gain: { value: 1 }, connect: () => {} };

const ctx = service.getContext();
assert.ok(ctx, 'ctx must be created');
assert.strictEqual(ctx.state, 'running', 'ctx must be running');

// Classic sound
assert.strictEqual(service.playClick(true, 'classic'), true, 'classic must return true');
assert.strictEqual(fakeCtx._oscillators.length, 1, 'one oscillator created');
assert.strictEqual(fakeCtx._oscillators[0].type, 'square', 'classic uses square wave');
assert.strictEqual(fakeCtx._oscillators[0].frequency.value, 1000, 'accent freq = 1000');

// Wood sound
assert.strictEqual(service.playClick(false, 'wood'), true, 'wood must return true');
assert.strictEqual(fakeCtx._oscillators.length, 2, 'second oscillator created');
assert.strictEqual(fakeCtx._oscillators[1].type, 'sine', 'wood uses sine wave');
assert.strictEqual(fakeCtx._oscillators[1].frequency.value, 600, 'non-accent freq = 600');

// Beep sound
assert.strictEqual(service.playClick(true, 'beep'), true, 'beep must return true');
assert.strictEqual(fakeCtx._oscillators.length, 3, 'third oscillator created');
assert.strictEqual(fakeCtx._oscillators[2].frequency.value, 1200, 'beep accent freq = 1200');

// Click sound (noise burst)
assert.strictEqual(service.playClick(false, 'click'), true, 'click must return true');
assert.strictEqual(fakeCtx._buffers.length, 1, 'one buffer created for click');
assert.strictEqual(fakeCtx._sources.length, 1, 'one source created for click');

// ─── Test 3: getState ───
const state = service.getState();
assert.strictEqual(state.hasContext, true, 'hasContext must be true');
assert.strictEqual(state.ctxState, 'running', 'ctxState must be running');
assert.strictEqual(state.hasMasterGain, true, 'hasMasterGain must be true');

// ─── Test 4: Suspended ctx resumes ───
const suspendedCtx = new FakeAudioContext();
suspendedCtx.state = 'suspended';
const serviceSuspended = new AudioContextService({
  AudioContextCtor: FakeAudioContext,
  destination: suspendedCtx.destination
});
// Override the created ctx
serviceSuspended._ctx = suspendedCtx;
serviceSuspended._masterGain = { gain: { value: 1 }, connect: () => {} };
const resumedCtx = serviceSuspended.getContext();
assert.strictEqual(resumedCtx.state, 'running', 'suspended ctx must resume');

// ─── Test 5: A provided context is reused as the shared transport clock ───
const sharedCtx = new FakeAudioContext();
let providerCalls = 0;
const serviceShared = new AudioContextService({
  AudioContextCtor: FakeAudioContext,
  contextProvider: () => {
    providerCalls++;
    return sharedCtx;
  }
});
assert.strictEqual(serviceShared.getContext(), sharedCtx, 'provider context must be reused');
assert.strictEqual(providerCalls, 1, 'provider must be consulted once before binding');
assert.strictEqual(serviceShared.setContext(sharedCtx), sharedCtx, 'same context remains attached');

const replacementCtx = new FakeAudioContext();
assert.strictEqual(serviceShared.setContext(replacementCtx), replacementCtx, 'service can rebind to a new context');
assert.strictEqual(serviceShared.getContext(), replacementCtx, 'replacement context must remain active');

console.log('AudioContextService tests passed');
