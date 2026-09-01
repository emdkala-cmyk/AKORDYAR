const assert = require('node:assert/strict');
const Engine = require('../core/AudioAnalysisEngine.js');

/* ---------------- helpers ---------------- */

function makeBuffer(channels, sampleRate, durationSec, fillFn) {
  const length = Math.round(sampleRate * durationSec);
  const data = [];
  for (let ch = 0; ch < channels; ch += 1) {
    const channel = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      channel[i] = fillFn(ch, i / sampleRate) || 0;
    }
    data.push(channel);
  }
  return {
    sampleRate,
    length,
    numberOfChannels: channels,
    getChannelData: ch => data[ch]
  };
}

function sine(amount, freq, time, harmonics = 1) {
  let value = 0;
  for (let h = 1; h <= harmonics; h += 1) {
    value += Math.sin(2 * Math.PI * freq * h * time) / h;
  }
  return amount * value;
}

const NOTE_FREQ = {
  C: 261.63, 'C#': 277.18, D: 293.66, 'D#': 311.13, E: 329.63, F: 349.23,
  'F#': 369.99, G: 392.0, 'G#': 415.3, A: 440.0, 'A#': 466.16, B: 493.88
};

function triadVoice(root, quality) {
  // root note name + quality -> [freqs]
  const intervals = quality === 'min' ? [0, 3, 7] : [0, 4, 7];
  const base = NOTE_FREQ[root];
  return intervals.map(semitone => base * Math.pow(2, semitone / 12));
}

/* ---------------- 1) FFT sanity ---------------- */

{
  const fft = Engine.createFFT(4096);
  const re = new Float32Array(4096);
  const im = new Float32Array(4096);
  const sampleRate = 22050;
  const freq = 1000;
  for (let i = 0; i < 4096; i += 1) {
    re[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  fft.transform(re, im);
  let peakBin = 1;
  let peakValue = 0;
  for (let b = 1; b < 2048; b += 1) {
    const magnitude = Math.hypot(re[b], im[b]);
    if (magnitude > peakValue) {
      peakValue = magnitude;
      peakBin = b;
    }
  }
  const expectedBin = Math.round(freq / (sampleRate / 4096));
  assert.equal(peakBin, expectedBin, `FFT peak should be at bin ${expectedBin}`);
  assert.ok(peakValue > 100, 'FFT magnitude should be significant');
}

/* ---------------- 2) template matching ---------------- */

{
  const chromaC = new Float32Array(12);
  [0, 4, 7].forEach(pc => { chromaC[pc] = 1; });
  {
    const normalized = chromaC.slice();
    const norm = Math.hypot(...normalized);
    for (let i = 0; i < 12; i += 1) normalized[i] /= norm;
    const match = Engine.matchChordTemplate(normalized);
    assert.equal(match.template.root, 0, 'C major root');
    assert.equal(match.template.quality, 'maj', 'C major quality');
  }
  const chromaAm = new Float32Array(12);
  [9, 0, 4].forEach(pc => { chromaAm[pc] = 1; });
  {
    const normalized = chromaAm.slice();
    const norm = Math.hypot(...normalized);
    for (let i = 0; i < 12; i += 1) normalized[i] /= norm;
    const match = Engine.matchChordTemplate(normalized);
    assert.equal(match.template.root, 9, 'A minor root');
    assert.equal(match.template.quality, 'min', 'A minor quality');
  }
}

/* ---------------- 3) key detection (synthetic pads) ---------------- */

async function runKeyTest(rootNote, quality, expectedKey, expectedMode) {
  const voices = triadVoice(rootNote, quality);
  const buffer = makeBuffer(1, 22050, 6, (ch, t) =>
    voices.reduce((sum, freq) => sum + sine(0.22, freq, t, 3), 0)
  );
  const features = await Engine.computeFeatures(buffer, { yieldToUI: false });
  assert.ok(features.ok, 'features computed');
  const key = Engine.detectKey(features);
  assert.ok(key.ok, `key ok for ${rootNote}${quality}`);
  assert.equal(key.key, expectedKey, `key tonic for ${rootNote}${quality}`);
  assert.equal(key.mode, expectedMode, `key mode for ${rootNote}${quality}`);
}

(async () => {
  await runKeyTest('C', 'maj', 'C', 'maj');
  await runKeyTest('A', 'min', 'A', 'min');
  await runKeyTest('F', 'maj', 'F', 'maj');

  /* ---------------- 4) tempo detection (click track) ---------------- */

  {
    const bpm = 120;
    const beat = 60 / bpm;
    const duration = 12;
    const buffer = makeBuffer(1, 22050, duration, (ch, t) => {
      const beatPhase = t % beat;
      if (beatPhase < 0.03) {
        const decay = Math.exp(-beatPhase * 90);
        return 0.85 * Math.sin(2 * Math.PI * 1200 * t) * decay;
      }
      return 0;
    });
    const features = await Engine.computeFeatures(buffer, { yieldToUI: false });
    const tempo = Engine.detectTempo(features);
    assert.ok(tempo.ok, 'tempo ok');
    assert.ok(
      Math.abs(tempo.bpm - bpm) <= 6,
      `tempo near 120 (got ${tempo.bpm})`
    );
    assert.ok(tempo.confidence > 0.2, `tempo confidence sane (${tempo.confidence})`);
  }

  /* ---------------- 5) chord progression detection ---------------- */

  {
    const progression = [
      { root: 'C', quality: 'maj' },
      { root: 'F', quality: 'maj' },
      { root: 'G', quality: 'maj' },
      { root: 'A', quality: 'min' }
    ];
    const chordDuration = 2;
    const duration = progression.length * chordDuration;
    const buffer = makeBuffer(1, 22050, duration, (ch, t) => {
      const index = Math.min(progression.length - 1, Math.floor(t / chordDuration));
      const voices = triadVoice(progression[index].root, progression[index].quality);
      // Slight fade at chord boundaries to create onsets.
      const inChord = t - index * chordDuration;
      const envelope = Math.min(1, inChord * 20) * Math.min(1, (chordDuration - inChord) * 20);
      return envelope * voices.reduce((sum, freq) => sum + sine(0.22, freq, t, 3), 0);
    });
    const features = await Engine.computeFeatures(buffer, { yieldToUI: false });
    const chords = Engine.detectChords(features, {
      beatPeriod: 1,
      beatOffset: 0
    });
    assert.ok(chords.ok, 'chords ok');
    assert.ok(chords.chords.length >= 3, `enough chords (got ${chords.chords.length})`);

    const chordAt = time => {
      const found = chords.chords.find(
        chord => chord.start <= time && time < chord.end
      );
      return found ? found.name : null;
    };
    assert.equal(chordAt(0.9), 'C', `chord at 0.9s (got ${chordAt(0.9)})`);
    assert.equal(chordAt(2.9), 'F', `chord at 2.9s (got ${chordAt(2.9)})`);
    assert.equal(chordAt(4.9), 'G', `chord at 4.9s (got ${chordAt(4.9)})`);
    assert.equal(chordAt(6.9), 'Am', `chord at 6.9s (got ${chordAt(6.9)})`);
  }

  /* ---------------- 6) full pipeline + progress ---------------- */

  {
    const voices = triadVoice('D', 'min');
    const buffer = makeBuffer(1, 44100, 5, (ch, t) =>
      voices.reduce((sum, freq) => sum + sine(0.25, freq, t, 3), 0)
    );
    const events = [];
    const analysis = await Engine.analyzeAudio(buffer, {
      yieldToUI: false,
      onProgress: event => events.push(event)
    });
    assert.ok(analysis.ok, 'full analysis ok');
    assert.ok(analysis.key.ok, 'key ok in pipeline');
    assert.equal(analysis.key.key, 'D', 'pipeline key tonic');
    assert.equal(analysis.key.mode, 'min', 'pipeline key mode');
    assert.ok(events.some(event => event.phase === 'start'), 'progress start emitted');
    assert.ok(events.at(-1).progress === 1, 'progress reaches 1');
  }

  /* ---------------- 7) chord name formatting ---------------- */

  {
    assert.equal(Engine.formatChordName(0, '', false), 'C');
    assert.equal(Engine.formatChordName(9, 'm7', false), 'Am7');
    assert.equal(Engine.formatChordName(10, 'sus4', true), 'Bbsus4');
  }

  /* ---------------- 8) chord robustness: drums + bass + vocal-like melody ---------------- */

  {
    // C–G–Am–C(E) با درام و باس ریشه/معکوس + خط آوازی — دقت باید حفظ شود.
    const NOTE = {
      C2: 65.41, E2: 82.41, G2: 98.0, A2: 110.0,
      E3: 164.81, G3: 196.0, A3: 220.0, B3: 246.94, C4: 261.63,
      D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25
    };
    const progression = [
      { triad: [NOTE.C4, NOTE.E4, NOTE.G4], bass: NOTE.C2, melody: [NOTE.E4, NOTE.G4, NOTE.A4, NOTE.G4] },
      { triad: [NOTE.G3, NOTE.B3, NOTE.D4], bass: NOTE.G2, melody: [NOTE.D4, NOTE.G4, NOTE.A4, NOTE.B3] },
      { triad: [NOTE.A3, NOTE.C4, NOTE.E4], bass: NOTE.A2, melody: [NOTE.C5, NOTE.A4, NOTE.E4, NOTE.G4] },
      // آکورد معکوس C/E: انتظار C (نه Em)
      { triad: [NOTE.C4, NOTE.E4, NOTE.G4], bass: NOTE.E2, melody: [NOTE.E4, NOTE.G4, NOTE.A4, NOTE.G4] }
    ];
    const chordDuration = 2;
    const duration = progression.length * chordDuration;
    const buffer = makeBuffer(1, 22050, duration, (ch, t) => {
      const index = Math.min(progression.length - 1, Math.floor(t / chordDuration));
      const chord = progression[index];
      const inChord = t - index * chordDuration;
      const envelope = Math.min(1, inChord * 20) * Math.min(1, (chordDuration - inChord) * 20);
      let value = envelope * chord.triad.reduce((sum, freq) => sum + sine(0.2, freq, t, 5), 0);
      value += envelope * sine(0.3, chord.bass, t, 3); // خط باس
      // آواز: هر 0.5s یک نت
      const melodyIndex = Math.floor(t / 0.5) % 4;
      value += 0.26 * sine(1, chord.melody[melodyIndex], t, 4);
      // کیک هر 0.5s + اسنر روی 2 و 4 + نویز ملایم
      const beatPhase = t % 0.5;
      if (beatPhase < 0.05) {
        value += 0.7 * Math.sin(2 * Math.PI * (120 - 700 * beatPhase) * t) * Math.exp(-beatPhase * 40);
      }
      if ((t % 1) >= 0.5 && (t % 1) < 0.55) {
        value += 0.3 * (Math.sin(2 * Math.PI * 1800 * t) * 0.5) * Math.exp(-(t % 1 - 0.5) * 30);
      }
      value += (Math.random() * 2 - 1) * 0.006;
      return value;
    });
    const features = await Engine.computeFeatures(buffer, { yieldToUI: false });
    const tempo = Engine.detectTempo(features);
    const chords = Engine.detectChords(features, {
      beatPeriod: tempo.ok ? tempo.period : null,
      beatOffset: tempo.ok ? tempo.beatOffset : 0
    });
    assert.ok(chords.ok, 'robust chords ok');
    const chordAt = time => {
      const found = chords.chords.find(c => c.start <= time && time < c.end);
      return found ? found.name : null;
    };
    assert.equal(chordAt(0.9), 'C', `robust C (got ${chordAt(0.9)})`);
    assert.equal(chordAt(2.9), 'G', `robust G (got ${chordAt(2.9)})`);
    assert.equal(chordAt(4.9), 'Am', `robust Am (got ${chordAt(4.9)})`);
    assert.equal(chordAt(6.9), 'C', `inversion C/E stays C (got ${chordAt(6.9)})`);
  }

  /* ---------------- 9) quality vocabulary is configurable ---------------- */

  {
    const features = { ok: false };
    const result = Engine.detectChords(features, { qualities: ['maj'] });
    assert.equal(result.ok, false, 'guards run before quality parsing');
    // واژگان کامل باید از طریق options.qualities قابل فعال‌سازی بماند
    const buffer = makeBuffer(1, 22050, 4, (ch, t) =>
      sine(0.22, NOTE_FREQ.C, t, 3) + sine(0.22, NOTE_FREQ.E, t, 3) + sine(0.22, NOTE_FREQ.G, t, 3)
    );
    const computed = await Engine.computeFeatures(buffer, { yieldToUI: false });
    const full = Engine.detectChords(computed, { qualities: ['maj', 'min', '7', 'm7', 'M7'] });
    assert.ok(full.ok, 'full vocabulary analysis ok');
    assert.ok(full.chords.length >= 1, 'full vocabulary yields chords');
    assert.ok(
      full.chords.every(c => ['maj', 'min', '7', 'm7', 'M7'].includes(c.quality)),
      'only active qualities appear'
    );
  }

  console.log('audio-analysis-engine.test.js — all assertions passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
