const assert = require('node:assert/strict');
require('../core/FreeWarpEngine.js');
const Renderer = require('../core/WarpAudioRendererService.js');

const SR = 44100;

function makeSine(seconds, freq, amp) {
  const n = Math.round(seconds * SR);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    data[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  }
  return data;
}

function addBurst(data, atSeconds, amp, widthSamples) {
  const start = Math.round(atSeconds * SR);
  for (let i = 0; i < widthSamples; i += 1) {
    const idx = start + i;
    if (idx >= 0 && idx < data.length) {
      // short decaying click
      data[idx] = amp * (1 - i / widthSamples);
    }
  }
}

function rms(data, from = 0, to = data.length) {
  let sum = 0;
  let count = 0;
  for (let i = from; i < to; i += 1) {
    sum += data[i] * data[i];
    count += 1;
  }
  return Math.sqrt(sum / Math.max(1, count));
}

function argmaxAbs(data) {
  let best = 0;
  let bestVal = -1;
  for (let i = 0; i < data.length; i += 1) {
    const v = Math.abs(data[i]);
    if (v > bestVal) {
      bestVal = v;
      best = i;
    }
  }
  return best;
}

/* ==================== pure DSP ==================== */

/* 1) identity markers + no search → near-exact copy */
{
  const input = makeSine(1.0, 220, 0.5);
  const segments = [
    { srcStart: 0, srcEnd: 1, tlStart: 0, tlEnd: 1 }
  ];
  const { channels, length } = Renderer.renderWarpedSamples(
    [input], SR, segments, 0, { search: 0 }
  );
  assert.equal(length, SR, 'identity output length');
  const out = channels[0];
  const W = Renderer.DEFAULT_WINDOW;
  for (let i = W; i < length - W; i += 1) {
    assert.ok(
      Math.abs(out[i] - input[i]) < 1e-3,
      `identity sample ${i}: ${out[i]} vs ${input[i]}`
    );
  }
}

/* 2) 2x stretch: length doubles and transient lands on the warped position */
{
  const input = makeSine(1.0, 220, 0.3);
  addBurst(input, 0.5, 0.95, 200);
  const segments = [
    { srcStart: 0, srcEnd: 1, tlStart: 0, tlEnd: 2 }
  ];
  const { channels, length } = Renderer.renderWarpedSamples(
    [input], SR, segments, 0
  );
  assert.equal(length, 2 * SR, 'stretched output length');
  const out = channels[0];
  for (const v of out) {
    assert.ok(Number.isFinite(v), 'no NaN in stretched output');
  }
  // burst at source 0.5 must land near timeline 1.0
  const peakAt = argmaxAbs(out) / SR;
  assert.ok(
    Math.abs(peakAt - 1.0) < 0.05,
    `transient lands near t=1.0 (got ${peakAt.toFixed(3)}s)`
  );
  // loudness roughly preserved
  const inRms = rms(input, 2000, input.length - 2000);
  const outRms = rms(out, 4000, length - 4000);
  assert.ok(
    Math.abs(outRms - inRms) / inRms < 0.25,
    `RMS preserved (in ${inRms.toFixed(3)} out ${outRms.toFixed(3)})`
  );
}

/* 3) three-marker anchor rule: A and B fixed, middle marker moved */
{
  const input = makeSine(4.0, 220, 0.3);
  addBurst(input, 2.0, 0.95, 200);  // exactly at the dragged marker source
  addBurst(input, 0.0 + 0.05, 0.9, 200); // near anchor A
  // A: src 0 → tl 0 ; M: src 2 → tl 3 (stretched) ; B: src 4 → tl 5
  const segments = [
    { srcStart: 0, srcEnd: 2, tlStart: 0, tlEnd: 3 },
    { srcStart: 2, srcEnd: 4, tlStart: 3, tlEnd: 5 }
  ];
  const { channels, length } = Renderer.renderWarpedSamples(
    [input], SR, segments, 0
  );
  assert.equal(length, 5 * SR, 'anchored output length (3s + 2s)');
  const out = channels[0];
  const peakAt = argmaxAbs(out) / SR;
  assert.ok(
    Math.abs(peakAt - 3.0) < 0.05,
    `marker transient lands at moved position t=3 (got ${peakAt.toFixed(3)}s)`
  );
  // anchor A transient stays at the very start of the clip
  const headPeak = argmaxAbs(out.subarray(0, SR)) / SR;
  assert.ok(headPeak < 0.15, `anchor A stays at t≈0 (got ${headPeak.toFixed(3)}s)`);
}

/* 4) stereo: both channels rendered, same length */
{
  const left = makeSine(1.0, 220, 0.4);
  const right = makeSine(1.0, 330, 0.4);
  const segments = [
    { srcStart: 0, srcEnd: 1, tlStart: 0, tlEnd: 1.5 }
  ];
  const { channels, length } = Renderer.renderWarpedSamples(
    [left, right], SR, segments, 0
  );
  assert.equal(channels.length, 2, 'stereo channels');
  assert.equal(channels[0].length, length, 'channel lengths equal');
  assert.ok(length > SR * 1.4 && length < SR * 1.6, 'stretched stereo length');
}

/* 5) very short segments fall back to linear resampling */
{
  const input = makeSine(0.2, 440, 0.5);
  const segments = [
    { srcStart: 0, srcEnd: 0.05, tlStart: 0, tlEnd: 0.1 }
  ];
  const { channels, length } = Renderer.renderWarpedSamples(
    [input], SR, segments, 0
  );
  assert.equal(length, Math.ceil(0.1 * SR), 'short-segment output length');
  for (const v of channels[0]) {
    assert.ok(Number.isFinite(v), 'no NaN in short segment');
  }
}

/* ==================== service wrapper ==================== */

function fakeAudioContext() {
  return {
    createBuffer(numChannels, length, sampleRate) {
      const chans = [];
      for (let i = 0; i < numChannels; i += 1) {
        chans.push(new Float32Array(length));
      }
      return {
        numberOfChannels: numChannels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: ch => chans[ch]
      };
    }
  };
}

function fakeSourceBuffer(data) {
  return {
    numberOfChannels: 1,
    sampleRate: SR,
    duration: data.length / SR,
    getChannelData: () => data
  };
}

/* 6) service: render, cache, invalidate on marker change */
{
  const ctx = fakeAudioContext();
  const source = fakeSourceBuffer(makeSine(1.0, 220, 0.5));
  let renders = 0;
  const service = Renderer.create({
    ensureAudioCtx: () => ctx,
    getBuffer: () => source,
    schedule: cb => cb() // synchronous for tests
  });

  const clip = {
    id: 'c1',
    type: 'audio',
    bufferKey: 'b1',
    start: 0,
    offset: 0,
    duration: 2,
    sourceDuration: 1,
    warpMarkers: [
      { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
      { id: '_end', sourceTime: 1, timelineTime: 2, pinned: true }
    ]
  };

  assert.equal(service.getWarpedBuffer(clip), null, 'nothing rendered yet');
  let doneBuffer = null;
  service.ensureWarpedBuffer(clip, { onDone: b => { doneBuffer = b; renders += 1; } });
  assert.ok(doneBuffer, 'render completed synchronously');
  assert.equal(doneBuffer.length, 2 * SR, 'warped buffer length');
  assert.equal(service.getWarpedBuffer(clip), doneBuffer, 'cached after render');

  // same markers → served from cache
  service.ensureWarpedBuffer(clip, { onDone: b => { doneBuffer = b; renders += 1; } });
  assert.equal(renders, 2, 'callback fired again');
  assert.equal(service.getWarpedBuffer(clip), doneBuffer, 'same buffer instance');

  // moved marker → key changes → cache miss
  clip.warpMarkers = [
    { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
    { id: '_end', sourceTime: 1, timelineTime: 1.5, pinned: true }
  ];
  assert.equal(service.getWarpedBuffer(clip), null, 'stale after marker edit');
  service.ensureWarpedBuffer(clip, { onDone: () => {} });
  const reRendered = service.getWarpedBuffer(clip);
  assert.ok(reRendered && reRendered !== doneBuffer, 're-rendered with new key');
  assert.equal(reRendered.length, Math.ceil(1.5 * SR), 're-rendered length');
}

/* 7) service: unwarped marker sets render nothing */
{
  const ctx = fakeAudioContext();
  const source = fakeSourceBuffer(makeSine(1.0, 220, 0.5));
  const service = Renderer.create({
    ensureAudioCtx: () => ctx,
    getBuffer: () => source,
    schedule: cb => cb()
  });
  const clip = {
    id: 'c2',
    type: 'audio',
    bufferKey: 'b1',
    start: 0,
    offset: 0,
    duration: 1,
    sourceDuration: 1,
    warpMarkers: [
      { id: '_start', sourceTime: 0, timelineTime: 0, pinned: true },
      { id: '_end', sourceTime: 1, timelineTime: 1, pinned: true }
    ]
  };
  let doneValue = 'unset';
  service.ensureWarpedBuffer(clip, { onDone: b => { doneValue = b; } });
  assert.equal(doneValue, null, 'identity markers → null buffer');
  assert.equal(service.getWarpedBuffer(clip), null, 'identity markers → no cache');
  assert.equal(service.isRendering('c2'), false, 'not rendering');
}

console.log('warp-audio-renderer-service.test.js — all assertions passed.');
