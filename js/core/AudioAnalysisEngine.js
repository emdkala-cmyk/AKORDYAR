/**
 * AudioAnalysisEngine — offline Music Information Retrieval engine.
 *
 * تحلیل هوشمند فایل صوتی برای تشخیص:
 *   1) تمپو (BPM)       — spectral-flux onset envelope + autocorrelation + comb scoring
 *   2) گام (Key)        — harmonic-sum chromagram + Krumhansl-Kessler key profiles
 *   3) آکورد (Chords)   — beat-synchronous chroma + whitened template matching +
 *                          bass emphasis + key-aware prior + HMM (Viterbi) decoding
 *
 * Pure DSP module: no DOM, no DAW, no song state. Works in browser (window)
 * and Node (module.exports) so it stays unit-testable.
 *
 * Input contract: an AudioBuffer-like object
 *   { sampleRate:number, length:number, numberOfChannels:number, getChannelData(ch):Float32Array }
 */
(function attachAudioAnalysisEngine(globalScope) {
  'use strict';

  /* ============================ FFT (radix-2, iterative) ============================ */

  function createFFT(size) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error('FFT size must be a power of two');
    }
    const levels = Math.round(Math.log2(size));
    const half = size >> 1;
    const cosTable = new Float32Array(half);
    const sinTable = new Float32Array(half);
    for (let i = 0; i < half; i += 1) {
      cosTable[i] = Math.cos((2 * Math.PI * i) / size);
      sinTable[i] = Math.sin((2 * Math.PI * i) / size);
    }
    const reverse = new Uint32Array(size);
    for (let i = 0; i < size; i += 1) {
      let value = i;
      let reversed = 0;
      for (let bit = 0; bit < levels; bit += 1) {
        reversed = (reversed << 1) | (value & 1);
        value >>= 1;
      }
      reverse[i] = reversed;
    }

    function transform(re, im) {
      const n = size;
      for (let i = 0; i < n; i += 1) {
        const j = reverse[i];
        if (j > i) {
          let temp = re[i]; re[i] = re[j]; re[j] = temp;
          temp = im[i]; im[i] = im[j]; im[j] = temp;
        }
      }
      for (let span = 2; span <= n; span <<= 1) {
        const halfSpan = span >> 1;
        const step = n / span;
        for (let start = 0; start < n; start += span) {
          for (let k = 0, twiddle = 0; k < halfSpan; k += 1, twiddle += step) {
            const i = start + k;
            const j = i + halfSpan;
            const cos = cosTable[twiddle];
            const sin = sinTable[twiddle];
            const tre = re[j] * cos + im[j] * sin;
            const tim = im[j] * cos - re[j] * sin;
            re[j] = re[i] - tre;
            im[j] = im[i] - tim;
            re[i] += tre;
            im[i] += tim;
          }
        }
      }
    }

    return Object.freeze({ size, transform });
  }

  /* ============================ Signal helpers ============================ */

  function hannWindow(size) {
    const table = new Float32Array(size);
    for (let i = 0; i < size; i += 1) {
      table[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    }
    return table;
  }

  function bufferToMono(buffer) {
    const channels = Number(buffer.numberOfChannels) || 1;
    const length = Number(buffer.length) || 0;
    if (channels <= 1) {
      const source = buffer.getChannelData(0);
      const out = new Float32Array(length);
      out.set(source.subarray(0, length));
      return out;
    }
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(Math.min(1, channels - 1));
    const out = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      out[i] = (left[i] + right[i]) * 0.5;
    }
    return out;
  }

  function decimateBy2(samples) {
    const outLength = samples.length >> 1;
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i += 1) {
      const center = i * 2;
      const i0 = Math.max(0, center - 1);
      const i3 = Math.min(samples.length - 1, center + 1);
      const i4 = Math.min(samples.length - 1, center + 2);
      out[i] =
        (samples[i0] + 3 * samples[center] + 3 * samples[i3] + samples[i4]) / 8;
    }
    return out;
  }

  function prepareSamples(buffer, targetRate) {
    let samples = bufferToMono(buffer);
    let rate = Number(buffer.sampleRate) || 44100;
    while (rate > targetRate * 1.14 && samples.length > 4096) {
      samples = decimateBy2(samples);
      rate /= 2;
    }
    return { samples, sampleRate: rate };
  }

  function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.round(ratio * (sorted.length - 1)))
    );
    return sorted[index];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /* ============================ Chroma / onset features ============================ */

  const MIDI_LOW = 33; // A1
  const MIDI_HIGH = 96; // C7
  const HARMONIC_WEIGHTS = [1, 0.62, 0.38, 0.22, 0.13];
  // محدوده باس: فاندامنتال‌های بم (E1=41Hz .. E3) برای تشخیص ریشه آکورد و معکوس‌ها
  const BASS_MIDI_LOW = 28; // E1
  const BASS_MIDI_HIGH = 52; // E3
  const BASS_HARMONIC_WEIGHTS = [1, 0.5, 0.3];
  const PITCH_CLASS_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const PITCH_CLASS_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  function buildHarmonicTable(
    binHz,
    nyquist,
    minMidi = MIDI_LOW,
    maxMidi = MIDI_HIGH,
    harmonicWeights = HARMONIC_WEIGHTS,
    minFreq = 50
  ) {
    const maxFreq = Math.min(6000, nyquist * 0.92);
    const table = [];
    for (let midi = minMidi; midi <= maxMidi; midi += 1) {
      const fundamental = 440 * Math.pow(2, (midi - 69) / 12);
      const harmonics = [];
      for (let h = 1; h <= harmonicWeights.length; h += 1) {
        const freq = fundamental * h;
        if (freq < minFreq || freq >= maxFreq) continue;
        const bin = Math.round(freq / binHz);
        if (bin < 1) continue;
        harmonics.push({ bins: [bin - 1, bin, bin + 1], weight: harmonicWeights[h - 1] });
      }
      table.push({ pitchClass: midi % 12, harmonics });
    }
    return table;
  }

  function accumulateHarmonicChroma(table, magnitude, scale, bins, out) {
    for (let entry = 0; entry < table.length; entry += 1) {
      const { pitchClass, harmonics } = table[entry];
      let energy = 0;
      for (let h = 0; h < harmonics.length; h += 1) {
        const { bins: harmonicBins, weight } = harmonics[h];
        let peak = 0;
        for (let k = 0; k < harmonicBins.length; k += 1) {
          const b = harmonicBins[k];
          if (b >= 1 && b < bins) {
            const value = magnitude[b] * scale;
            if (value > peak) peak = value;
          }
        }
        energy += peak * weight;
      }
      out[pitchClass] += energy;
    }
  }

  async function computeFeatures(buffer, options = {}) {
    const fftSize = options.fftSize || 4096;
    const hopSize = options.hopSize || 512;
    const targetRate = options.targetRate || 22050;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const yieldToUI = options.yieldToUI === false ? null : () => new Promise(resolve => setTimeout(resolve, 0));

    const { samples, sampleRate } = prepareSamples(buffer, targetRate);
    const duration = samples.length / sampleRate;
    if (duration < 1.5) {
      return { ok: false, reason: 'audio-too-short', duration, frameCount: 0 };
    }

    const frameCount = Math.max(0, 1 + Math.floor((samples.length - fftSize) / hopSize));
    const frameRate = sampleRate / hopSize;
    const bins = fftSize >> 1;
    const binHz = sampleRate / fftSize;
    const nyquist = sampleRate / 2;

    const fft = createFFT(fftSize);
    const window = hannWindow(fftSize);
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    const magnitude = new Float32Array(bins);
    const previousMagnitude = new Float32Array(bins);
    const harmonicTable = buildHarmonicTable(binHz, nyquist);
    const bassTable = buildHarmonicTable(
      binHz, nyquist, BASS_MIDI_LOW, BASS_MIDI_HIGH, BASS_HARMONIC_WEIGHTS, 35
    );

    const chromaFrames = new Array(frameCount);
    const bassChromaFrames = new Array(frameCount);
    const frameEnergies = new Float32Array(frameCount);
    const onsetEnvelope = new Float32Array(frameCount);

    const CHUNK = 256;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const start = frame * hopSize;
      for (let i = 0; i < fftSize; i += 1) {
        re[i] = samples[start + i] * window[i];
        im[i] = 0;
      }
      fft.transform(re, im);

      let frameMax = 0;
      let flux = 0;
      for (let b = 1; b < bins; b += 1) {
        const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
        magnitude[b] = mag;
        if (mag > frameMax) frameMax = mag;
        const delta = Math.sqrt(mag) - Math.sqrt(previousMagnitude[b]);
        if (delta > 0) flux += delta;
        previousMagnitude[b] = mag;
      }
      onsetEnvelope[frame] = flux / bins;
      frameEnergies[frame] = frameMax;

      // Harmonic-sum chroma (per-frame max-normalised + log compression) +
      // جداگانه: کرومای باس برای تعیین ریشه/معکوس آکورد.
      const chroma = new Float32Array(12);
      const bassChroma = new Float32Array(12);
      if (frameMax > 1e-9) {
        const scale = 1 / frameMax;
        accumulateHarmonicChroma(harmonicTable, magnitude, scale, bins, chroma);
        accumulateHarmonicChroma(bassTable, magnitude, scale, bins, bassChroma);
        for (let pc = 0; pc < 12; pc += 1) {
          chroma[pc] = Math.log(1 + 6 * chroma[pc]);
          bassChroma[pc] = Math.log(1 + 6 * bassChroma[pc]);
        }
      }
      chromaFrames[frame] = chroma;
      bassChromaFrames[frame] = bassChroma;

      if (onProgress && frame % CHUNK === 0) {
        onProgress({
          phase: 'features',
          progress: 0.55 * (frame / frameCount),
          message: 'استخراج ویژگی‌های صوتی'
        });
      }
      if (yieldToUI && frame > 0 && frame % (CHUNK * 4) === 0) {
        await yieldToUI();
      }
    }

    // Post-process onset envelope: local-mean removal + half-wave rectification.
    const localWindow = Math.max(3, Math.round(frameRate * 0.7));
    const smoothed = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i += 1) {
      const lo = Math.max(0, i - localWindow);
      const hi = Math.min(frameCount - 1, i + localWindow);
      let sum = 0;
      for (let j = lo; j <= hi; j += 1) sum += onsetEnvelope[j];
      const localMean = sum / (hi - lo + 1);
      smoothed[i] = Math.max(0, onsetEnvelope[i] - localMean);
    }

    return {
      ok: true,
      duration,
      sampleRate,
      frameRate,
      frameCount,
      chromaFrames,
      bassChromaFrames,
      frameEnergies,
      onsetEnvelope: smoothed
    };
  }

  /* ============================ Tempo detection ============================ */

  function interpolateOnset(onset, frameRate, time) {
    const position = time * frameRate;
    if (position <= 0) return onset[0] || 0;
    const last = onset.length - 1;
    if (position >= last) return onset[last] || 0;
    const i = Math.floor(position);
    const fraction = position - i;
    return (onset[i] || 0) * (1 - fraction) + (onset[i + 1] || 0) * fraction;
  }

  function combScore(onset, frameRate, periodSeconds, phaseSeconds) {
    const duration = onset.length / frameRate;
    const beatCount = Math.floor((duration - phaseSeconds) / periodSeconds);
    if (beatCount < 4) return 0;
    let sum = 0;
    for (let beat = 0; beat < beatCount; beat += 1) {
      sum += interpolateOnset(onset, frameRate, phaseSeconds + beat * periodSeconds);
    }
    return sum / beatCount;
  }

  function detectTempo(features, options = {}) {
    if (!features?.ok) {
      return { ok: false, reason: features?.reason || 'features-missing' };
    }
    const { onsetEnvelope, frameRate, frameCount } = features;
    const minBpm = options.minBpm || 55;
    const maxBpm = options.maxBpm || 200;
    const maxLag = Math.min(frameCount - 2, Math.ceil(frameRate * (60 / minBpm)));
    const minLag = Math.max(2, Math.floor(frameRate * (60 / maxBpm)));
    if (maxLag <= minLag + 1) {
      return { ok: false, reason: 'audio-too-short' };
    }

    // Autocorrelation of the onset envelope.
    const mean = onsetEnvelope.reduce((sum, value) => sum + value, 0) / frameCount;
    const centered = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i += 1) {
      centered[i] = onsetEnvelope[i] - mean;
    }
    const acf = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let sum = 0;
      const limit = frameCount - lag;
      for (let i = 0; i < limit; i += 1) {
        sum += centered[i] * centered[i + lag];
      }
      acf[lag] = sum / limit;
    }

    // Comb scoring rewards periods whose 2x/3x multiples also align, plus a
    // broad tempo prior around 120 BPM to avoid extreme octave errors.
    let bestLag = minLag;
    let bestScore = -Infinity;
    let scoreSum = 0;
    let scoreSumSquared = 0;
    let scoreCount = 0;
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let score = acf[lag];
      if (lag * 2 <= maxLag) score += 0.55 * acf[lag * 2];
      if (lag * 3 <= maxLag) score += 0.28 * acf[lag * 3];
      const halfLag = Math.round(lag / 2);
      if (halfLag >= minLag && halfLag * 2 === lag) score += 0.35 * acf[halfLag];
      const bpm = (60 * frameRate) / lag;
      const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.95, 2));
      score *= 0.35 + 0.65 * prior;
      acf[lag] = score;
      scoreSum += score;
      scoreSumSquared += score * score;
      scoreCount += 1;
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }
    const scoreMean = scoreSum / scoreCount;
    const scoreStd = Math.sqrt(Math.max(0, scoreSumSquared / scoreCount - scoreMean * scoreMean));
    const confidence = scoreStd > 1e-12
      ? clamp((bestScore - scoreMean) / (3 * scoreStd), 0, 1)
      : 0.25;

    // Fine 2D refinement of period + phase against the raw onset envelope.
    const coarsePeriod = bestLag / frameRate;
    const coarseBpm = 60 / coarsePeriod;
    const searchLow = clamp(coarsePeriod * 0.94, 60 / maxBpm, 60 / minBpm);
    const searchHigh = clamp(coarsePeriod * 1.06, 60 / maxBpm, 60 / minBpm);
    let bestPeriod = coarsePeriod;
    let bestPhase = 0;
    let bestComb = -Infinity;
    const steps = 40;
    for (let s = 0; s <= steps; s += 1) {
      const period = searchLow + ((searchHigh - searchLow) * s) / steps;
      const phaseSteps = Math.max(4, Math.ceil(period / (1 / frameRate)));
      for (let p = 0; p < phaseSteps; p += 1) {
        const phase = (period * p) / phaseSteps;
        const score = combScore(onsetEnvelope, frameRate, period, phase);
        if (score > bestComb) {
          bestComb = score;
          bestPeriod = period;
          bestPhase = phase;
        }
      }
    }

    let bpm = 60 / bestPeriod;
    // Gentle octave correction toward the 70–180 comfort range.
    if (bpm < 70 && bpm * 2 <= maxBpm) bpm *= 2;
    if (bpm > 190 && bpm / 2 >= minBpm) bpm /= 2;
    bpm = Math.round(bpm * 10) / 10;

    return {
      ok: true,
      bpm,
      period: bestPeriod,
      beatOffset: Math.round(bestPhase * 1000) / 1000,
      confidence: Math.round(confidence * 100) / 100
    };
  }

  /* ============================ Key detection ============================ */

  const KRUMHANSL_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KRUMHANSL_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  // Tonic spelling that matches Akordyar's ALL_NOTE_NAMES select options.
  const TONIC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function pearson(a, b) {
    const n = a.length;
    let meanA = 0;
    let meanB = 0;
    for (let i = 0; i < n; i += 1) { meanA += a[i]; meanB += b[i]; }
    meanA /= n;
    meanB /= n;
    let covariance = 0;
    let varianceA = 0;
    let varianceB = 0;
    for (let i = 0; i < n; i += 1) {
      const da = a[i] - meanA;
      const db = b[i] - meanB;
      covariance += da * db;
      varianceA += da * da;
      varianceB += db * db;
    }
    const denominator = Math.sqrt(varianceA * varianceB);
    return denominator > 1e-12 ? covariance / denominator : 0;
  }

  function meanChroma(features) {
    const { chromaFrames, frameEnergies } = features;
    const energyThreshold = 0.12 * percentile([...frameEnergies], 0.75);
    const total = new Float64Array(12);
    let usedFrames = 0;
    for (let i = 0; i < chromaFrames.length; i += 1) {
      if (frameEnergies[i] < energyThreshold) continue;
      const chroma = chromaFrames[i];
      for (let pc = 0; pc < 12; pc += 1) total[pc] += chroma[pc];
      usedFrames += 1;
    }
    if (usedFrames === 0) return null;
    return Float32Array.from(total);
  }

  function detectKey(features, options = {}) {
    if (!features?.ok) {
      return { ok: false, reason: features?.reason || 'features-missing' };
    }
    const chroma = meanChroma(features);
    if (!chroma) {
      return { ok: false, reason: 'silence' };
    }

    let bestIndex = 0;
    let bestMode = 'maj';
    let bestScore = -Infinity;
    let secondBest = -Infinity;
    for (let rotation = 0; rotation < 12; rotation += 1) {
      const rotated = new Float32Array(12);
      for (let pc = 0; pc < 12; pc += 1) {
        rotated[pc] = chroma[(pc + rotation) % 12];
      }
      const majorScore = pearson(rotated, KRUMHANSL_MAJOR);
      const minorScore = pearson(rotated, KRUMHANSL_MINOR);
      const candidates = [
        { score: majorScore, mode: 'maj' },
        { score: minorScore, mode: 'min' }
      ];
      for (const candidate of candidates) {
        if (candidate.score > bestScore) {
          secondBest = bestScore;
          bestScore = candidate.score;
          bestIndex = rotation;
          bestMode = candidate.mode;
        } else if (candidate.score > secondBest) {
          secondBest = candidate.score;
        }
      }
    }

    const margin = Math.max(0, bestScore - secondBest);
    const confidence = clamp(0.45 + margin * 2.2, 0, 1);
    return {
      ok: true,
      key: TONIC_NAMES[bestIndex],
      keySemitone: bestIndex,
      mode: bestMode,
      score: Math.round(bestScore * 1000) / 1000,
      confidence: Math.round(confidence * 100) / 100
    };
  }

  /* ============================ Chord detection ============================ */

  const CHORD_QUALITIES = [
    { id: 'maj', suffix: '', intervals: [0, 4, 7], weights: [1.3, 1, 1], prior: 1.0 },
    { id: 'min', suffix: 'm', intervals: [0, 3, 7], weights: [1.3, 1, 1], prior: 1.0 },
    { id: '7', suffix: '7', intervals: [0, 4, 7, 10], weights: [1.3, 1, 1, 0.9], prior: 0.87 },
    { id: 'm7', suffix: 'm7', intervals: [0, 3, 7, 10], weights: [1.3, 1, 1, 0.9], prior: 0.87 },
    { id: 'M7', suffix: 'M7', intervals: [0, 4, 7, 11], weights: [1.3, 1, 1, 0.9], prior: 0.8 },
    { id: '6', suffix: '6', intervals: [0, 4, 7, 9], weights: [1.3, 1, 1, 0.85], prior: 0.72 },
    { id: 'm6', suffix: 'm6', intervals: [0, 3, 7, 9], weights: [1.3, 1, 1, 0.85], prior: 0.68 },
    { id: 'sus2', suffix: 'sus2', intervals: [0, 2, 7], weights: [1.3, 1, 1], prior: 0.6 },
    { id: 'sus4', suffix: 'sus4', intervals: [0, 5, 7], weights: [1.3, 1, 1], prior: 0.6 },
    { id: 'dim', suffix: 'dim', intervals: [0, 3, 6], weights: [1.3, 1, 1], prior: 0.55 },
    { id: 'dim7', suffix: 'dim7', intervals: [0, 3, 6, 9], weights: [1.3, 1, 1, 0.85], prior: 0.45 },
    { id: 'aug', suffix: 'aug', intervals: [0, 4, 8], weights: [1.3, 1, 1], prior: 0.4 },
    { id: '9', suffix: '9', intervals: [0, 2, 4, 7, 10], weights: [1.3, 0.75, 1, 1, 0.85], prior: 0.55 },
    { id: 'm9', suffix: 'm9', intervals: [0, 2, 3, 7, 10], weights: [1.3, 0.75, 1, 1, 0.85], prior: 0.5 }
  ];

  const CHORD_TEMPLATES = (() => {
    const templates = [];
    for (let root = 0; root < 12; root += 1) {
      for (const quality of CHORD_QUALITIES) {
        const vector = new Float32Array(12);
        let norm = 0;
        quality.intervals.forEach((interval, index) => {
          const weight = quality.weights[index] ?? 1;
          vector[(root + interval) % 12] = weight;
          norm += weight * weight;
        });
        templates.push({
          root,
          quality: quality.id,
          suffix: quality.suffix,
          vector,
          norm: Math.sqrt(norm),
          prior: quality.prior
        });
      }
    }
    return templates;
  })();

  function matchChordTemplate(chroma) {
    let best = null;
    let bestScore = -Infinity;
    let bestRoot = -1;
    let bestQualityIndex = -1;
    for (let t = 0; t < CHORD_TEMPLATES.length; t += 1) {
      const template = CHORD_TEMPLATES[t];
      let dot = 0;
      for (let pc = 0; pc < 12; pc += 1) {
        dot += chroma[pc] * template.vector[pc];
      }
      const score = (dot / template.norm) * template.prior;
      if (score > bestScore) {
        bestScore = score;
        best = template;
        bestRoot = template.root;
        bestQualityIndex = CHORD_QUALITIES.findIndex(q => q.id === template.quality);
      }
    }
    return { template: best, score: bestScore, root: bestRoot, qualityIndex: bestQualityIndex };
  }

  // کیفیت‌های فعال به‌صورت پیش‌فرض — واژگان کوچک = برچسب‌های ساختگی کمتر روی موسیقی واقعی
  // (واژگان کامل ۱۴تایی از طریق options.qualities در دسترس است)
  const DEFAULT_ACTIVE_QUALITIES = ['maj', 'min', '7', 'm7', 'M7'];

  function buildDiatonicChordSet(tonicSemitone, mode) {
    const degrees = mode === 'min'
      ? [[0, 'min'], [3, 'maj'], [5, 'min'], [7, 'min'], [7, 'maj'], [8, 'maj'], [10, 'maj']]
      : [[0, 'maj'], [2, 'min'], [4, 'min'], [5, 'maj'], [7, 'maj'], [9, 'min']];
    const set = new Set();
    for (const [degree, quality] of degrees) {
      set.add(`${(tonicSemitone + degree) % 12}:${quality}`);
    }
    return set;
  }

  function detectChords(features, options = {}) {
    if (!features?.ok) {
      return { ok: false, reason: features?.reason || 'features-missing', chords: [] };
    }
    const { chromaFrames, bassChromaFrames, frameEnergies, frameRate, duration } = features;
    const frameCount = chromaFrames.length;
    if (frameCount < 3) {
      return { ok: false, reason: 'audio-too-short', chords: [], count: 0 };
    }

    const activeQualities = Array.isArray(options.qualities) && options.qualities.length
      ? options.qualities
      : DEFAULT_ACTIVE_QUALITIES;
    const bassWeight = options.bassWeight ?? 0.18;
    const keyBias = options.keyBias ?? 0.08;
    const selfTransition = clamp(options.selfTransition ?? 0.82, 0.5, 0.99);
    const noChordSelf = 0.92;
    const minDurationSeconds = options.minDuration ?? 0.45;
    const noChordThreshold = options.minScore ?? 0.4;
    const softmaxTemp = 0.12;

    /* ---- حالت‌های HMM: آکوردهای فعال + N.C. ---- */
    let keyInfo = options.key;
    if (!keyInfo || typeof keyInfo.keySemitone !== 'number') keyInfo = detectKey(features);
    const diatonic = keyInfo && keyInfo.ok
      ? buildDiatonicChordSet(keyInfo.keySemitone, keyInfo.mode)
      : null;

    const states = [];
    for (const template of CHORD_TEMPLATES) {
      if (!activeQualities.includes(template.quality)) continue;
      let templateMean = 0;
      for (let pc = 0; pc < 12; pc += 1) templateMean += template.vector[pc];
      templateMean /= 12;
      const whitened = new Float32Array(12);
      let whitenedSq = 0;
      for (let pc = 0; pc < 12; pc += 1) {
        whitened[pc] = template.vector[pc] - templateMean;
        whitenedSq += whitened[pc] * whitened[pc];
      }
      const quality = CHORD_QUALITIES.find(q => q.id === template.quality);
      states.push({
        root: template.root,
        quality: template.quality,
        suffix: template.suffix,
        prior: template.prior,
        whitened,
        whitenedNorm: Math.sqrt(whitenedSq),
        chordTonePcs: quality.intervals.slice(1).map(iv => (template.root + iv) % 12),
        keyFactor: diatonic && diatonic.has(`${template.root}:${template.quality}`)
          ? 1 + keyBias
          : 1 - 0.6 * keyBias
      });
    }
    const nChords = states.length;
    const nStates = nChords + 1;
    const NO_CHORD = nChords;

    /* ---- پنجره‌های هم‌گام با ضرب (beat-synchronous windows) ---- */
    let beatPeriod = Number(options.beatPeriod);
    if (!Number.isFinite(beatPeriod) || beatPeriod < 0.2 || beatPeriod > 2) beatPeriod = null;
    let beatOffset = Number(options.beatOffset);
    if (!Number.isFinite(beatOffset)) beatOffset = 0;
    const windowSeconds = beatPeriod ? clamp(beatPeriod / 2, 0.18, 0.5) : 0.25;
    const gridStart = beatPeriod
      ? ((beatOffset % windowSeconds) + windowSeconds) % windowSeconds
      : 0;

    const hasBass = Array.isArray(bassChromaFrames) && bassChromaFrames.length === frameCount;
    const energyP75 = percentile([...frameEnergies], 0.75);
    const silenceThreshold = 0.1 * energyP75;

    const windowCount = Math.max(1, Math.floor((duration - gridStart) / windowSeconds));
    const winChroma = [];
    const winBass = hasBass ? [] : null;
    const winSilent = new Uint8Array(windowCount);
    for (let w = 0; w < windowCount; w += 1) {
      const wStart = gridStart + w * windowSeconds;
      const f0 = Math.max(0, Math.floor(wStart * frameRate));
      const f1 = Math.min(frameCount, Math.ceil((wStart + windowSeconds) * frameRate));
      const chromaSum = new Float64Array(12);
      const bassSum = hasBass ? new Float64Array(12) : null;
      let active = 0;
      let frames = 0;
      for (let f = f0; f < f1; f += 1) {
        frames += 1;
        if (frameEnergies[f] < silenceThreshold) continue;
        active += 1;
        const chroma = chromaFrames[f];
        for (let pc = 0; pc < 12; pc += 1) chromaSum[pc] += chroma[pc];
        if (bassSum) {
          const bass = bassChromaFrames[f];
          for (let pc = 0; pc < 12; pc += 1) bassSum[pc] += bass[pc];
        }
      }
      winSilent[w] = active === 0 ? 1 : 0;
      winChroma.push(Float32Array.from(chromaSum, v => (active ? v / active : 0)));
      if (winBass) winBass.push(Float32Array.from(bassSum, v => (active ? v / active : 0)));
    }

    /* ---- نمره‌های انتشار (emission): کرومای سفیدشده + جایزه باس + گام ---- */
    const logEmission = new Float64Array(windowCount * nStates);
    const rawScores = new Float32Array(windowCount * nChords);
    const whitenedChroma = new Float64Array(12);
    const bassProfile = new Float64Array(12);
    for (let w = 0; w < windowCount; w += 1) {
      // کرومای سفیدشده: حذف مؤلفه مشترک (درام/نویز باندپهن و شیب طیفی)
      const chroma = winChroma[w];
      let chromaNorm = 0;
      for (let pc = 0; pc < 12; pc += 1) chromaNorm += chroma[pc] * chroma[pc];
      chromaNorm = Math.sqrt(chromaNorm);
      let whitenedNorm = 0;
      if (chromaNorm > 1e-9) {
        let mean = 0;
        for (let pc = 0; pc < 12; pc += 1) mean += chroma[pc] / chromaNorm;
        mean /= 12;
        for (let pc = 0; pc < 12; pc += 1) {
          whitenedChroma[pc] = chroma[pc] / chromaNorm - mean;
          whitenedNorm += whitenedChroma[pc] * whitenedChroma[pc];
        }
        whitenedNorm = Math.sqrt(whitenedNorm);
      }
      // پروفایل باس: سفیدشده و فقط قله‌های مثبت (کیک در مؤلفه مشترک حذف می‌شود)
      let bassScale = 0;
      if (hasBass && !winSilent[w]) {
        const bass = winBass[w];
        let bassNorm = 0;
        for (let pc = 0; pc < 12; pc += 1) bassNorm += bass[pc] * bass[pc];
        bassNorm = Math.sqrt(bassNorm);
        if (bassNorm > 1e-9) {
          let bassMean = 0;
          for (let pc = 0; pc < 12; pc += 1) bassMean += bass[pc] / bassNorm;
          bassMean /= 12;
          for (let pc = 0; pc < 12; pc += 1) {
            bassProfile[pc] = Math.max(0, bass[pc] / bassNorm - bassMean);
          }
          let profileNorm = 0;
          for (let pc = 0; pc < 12; pc += 1) profileNorm += bassProfile[pc] * bassProfile[pc];
          profileNorm = Math.sqrt(profileNorm);
          bassScale = profileNorm > 1e-9 ? 1 / profileNorm : 0;
        }
      }

      let bestChordScore = -Infinity;
      for (let s = 0; s < nChords; s += 1) {
        const state = states[s];
        let score = 0;
        if (whitenedNorm > 1e-9) {
          let dot = 0;
          for (let pc = 0; pc < 12; pc += 1) dot += whitenedChroma[pc] * state.whitened[pc];
          score = (dot / (whitenedNorm * state.whitenedNorm)) * state.prior * state.keyFactor;
        }
        if (bassScale > 0) {
          let strongestTone = 0;
          for (const pc of state.chordTonePcs) {
            if (bassProfile[pc] > strongestTone) strongestTone = bassProfile[pc];
          }
          score += bassWeight * (bassProfile[state.root] + 0.5 * strongestTone) * bassScale;
        }
        rawScores[w * nChords + s] = score;
        if (score > bestChordScore) bestChordScore = score;
      }
      // N.C.: پنجره‌های ساکت یا بدون تطابق قابل‌قبول
      const ncScore = winSilent[w]
        ? 2.0
        : Math.max(0, noChordThreshold - Math.max(0, bestChordScore)) * 1.6;

      // softmax → log-probability
      let maxZ = ncScore;
      for (let s = 0; s < nChords; s += 1) {
        if (rawScores[w * nChords + s] > maxZ) maxZ = rawScores[w * nChords + s];
      }
      let expSum = 0;
      for (let s = 0; s < nChords; s += 1) {
        expSum += Math.exp((rawScores[w * nChords + s] - maxZ) / softmaxTemp);
      }
      expSum += Math.exp((ncScore - maxZ) / softmaxTemp);
      const logSum = Math.log(expSum);
      for (let s = 0; s < nChords; s += 1) {
        logEmission[w * nStates + s] = (rawScores[w * nChords + s] - maxZ) / softmaxTemp - logSum;
      }
      logEmission[w * nStates + NO_CHORD] = (ncScore - maxZ) / softmaxTemp - logSum;
    }

    /* ---- ماتریس گذار: پایداری + روابط موسیقایی (نت مشترک / چهارم-پنجم / هم‌گامی) ---- */
    const logTrans = new Float64Array(nStates * nStates);
    for (let i = 0; i < nStates; i += 1) {
      const stay = i === NO_CHORD ? noChordSelf : selfTransition;
      const weights = new Float64Array(nStates);
      let weightSum = 0;
      for (let j = 0; j < nStates; j += 1) {
        if (j === i) continue;
        let weight = 1.0;
        if (i === NO_CHORD || j === NO_CHORD) {
          weight = 0.7;
        } else {
          const pcsI = new Set(states[i].chordTonePcs.concat([states[i].root]));
          const pcsJ = states[j].chordTonePcs.concat([states[j].root]);
          let shared = 0;
          for (const pc of pcsJ) if (pcsI.has(pc)) shared += 1;
          if (shared >= 2) weight = 1.3;
          const rootDistance = Math.abs(states[i].root - states[j].root);
          const circular = Math.min(rootDistance, 12 - rootDistance);
          if (circular === 5 || circular === 7) weight *= 1.15;
          if (diatonic && diatonic.has(`${states[i].root}:${states[i].quality}`) &&
              diatonic.has(`${states[j].root}:${states[j].quality}`)) weight *= 1.1;
        }
        weights[j] = weight;
        weightSum += weight;
      }
      logTrans[i * nStates + i] = Math.log(stay);
      for (let j = 0; j < nStates; j += 1) {
        if (j === i) continue;
        logTrans[i * nStates + j] = Math.log((1 - stay) * (weights[j] / weightSum));
      }
    }

    /* ---- رمزگشایی Viterbi ---- */
    const delta = new Float64Array(nStates);
    const deltaNext = new Float64Array(nStates);
    const back = new Int32Array(windowCount * nStates);
    const logInit = -Math.log(nStates);
    for (let s = 0; s < nStates; s += 1) {
      delta[s] = logInit + logEmission[s];
    }
    for (let w = 1; w < windowCount; w += 1) {
      for (let j = 0; j < nStates; j += 1) {
        let bestScore = -Infinity;
        let bestPrev = 0;
        for (let i = 0; i < nStates; i += 1) {
          const candidate = delta[i] + logTrans[i * nStates + j];
          if (candidate > bestScore) {
            bestScore = candidate;
            bestPrev = i;
          }
        }
        deltaNext[j] = bestScore + logEmission[w * nStates + j];
        back[w * nStates + j] = bestPrev;
      }
      for (let s = 0; s < nStates; s += 1) delta[s] = deltaNext[s];
    }
    const path = new Int32Array(windowCount);
    let lastState = 0;
    let lastScore = -Infinity;
    for (let s = 0; s < nStates; s += 1) {
      if (delta[s] > lastScore) {
        lastScore = delta[s];
        lastState = s;
      }
    }
    path[windowCount - 1] = lastState;
    for (let w = windowCount - 2; w >= 0; w -= 1) {
      path[w] = back[(w + 1) * nStates + path[w + 1]];
    }

    /* ---- مسیر → قطعات؛ جذب قطعات کوتاه؛ خروجی ---- */
    const minWindows = Math.max(1, Math.round(minDurationSeconds / windowSeconds));
    const runs = [];
    for (let w = 0; w < windowCount; w += 1) {
      const previous = runs[runs.length - 1];
      if (previous && previous.state === path[w]) {
        previous.end = w + 1;
      } else {
        runs.push({ state: path[w], start: w, end: w + 1 });
      }
    }
    let unstable = true;
    while (unstable && runs.length > 1) {
      unstable = false;
      for (let r = 0; r < runs.length; r += 1) {
        const run = runs[r];
        if (run.end - run.start >= minWindows) continue;
        const previous = runs[r - 1] || null;
        const next = runs[r + 1] || null;
        if (!previous && !next) continue;
        const previousLength = previous ? previous.end - previous.start : -1;
        const nextLength = next ? next.end - next.start : -1;
        const target = nextLength > previousLength ? next : previous;
        if (target === next) {
          next.start = run.start;
        } else if (target === previous) {
          previous.end = run.end;
        }
        runs.splice(r, 1);
        r -= 1;
        unstable = true;
      }
      for (let r = 1; r < runs.length; r += 1) {
        if (runs[r].state === runs[r - 1].state) {
          runs[r - 1].end = runs[r].end;
          runs.splice(r, 1);
          r -= 1;
          unstable = true;
        }
      }
    }

    const chords = [];
    for (const run of runs) {
      if (run.state === NO_CHORD) continue;
      const state = states[run.state];
      let scoreSum = 0;
      for (let w = run.start; w < run.end; w += 1) {
        scoreSum += rawScores[w * nChords + run.state];
      }
      const meanScore = run.end > run.start ? scoreSum / (run.end - run.start) : 0;
      const startTime = run.start === 0 ? 0 : gridStart + run.start * windowSeconds;
      const endTime = run.end === windowCount ? duration : gridStart + run.end * windowSeconds;
      if (endTime - startTime < 0.25) continue;
      chords.push({
        start: Math.round(startTime * 1000) / 1000,
        end: Math.round(endTime * 1000) / 1000,
        root: state.root,
        quality: state.quality,
        name: formatChordName(state.root, state.suffix, false),
        confidence: Math.round(clamp(meanScore, 0, 1) * 100) / 100
      });
    }

    return { ok: true, chords, count: chords.length };
  }

  function formatChordName(rootSemitone, suffix, preferFlats) {
    const names = preferFlats ? PITCH_CLASS_FLAT : PITCH_CLASS_SHARP;
    return `${names[((rootSemitone % 12) + 12) % 12]}${suffix}`;
  }

  /* ============================ Full analysis pipeline ============================ */

  async function analyzeAudio(buffer, options = {}) {
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const report = (phase, progress, message) => {
      if (onProgress) onProgress({ phase, progress, message });
    };

    report('start', 0.02, 'شروع تحلیل صوتی');
    const features = await computeFeatures(buffer, { ...options, onProgress });
    if (!features.ok) {
      return { ok: false, reason: features.reason, features };
    }

    report('tempo', 0.6, 'تشخیص تمپو');
    const tempo = detectTempo(features, options);

    report('key', 0.72, 'تشخیص گام');
    const key = detectKey(features, options);

    report('chords', 0.82, 'تشخیص آکوردها');
    const chords = detectChords(features, {
      ...options,
      beatPeriod: tempo.ok ? tempo.period : null,
      beatOffset: tempo.ok ? tempo.beatOffset : 0,
      key
    });
    report('done', 1, 'تحلیل کامل شد');

    return { ok: true, features, tempo, key, chords };
  }

  const engine = Object.freeze({
    createFFT,
    bufferToMono,
    decimateBy2,
    prepareSamples,
    computeFeatures,
    detectTempo,
    detectKey,
    detectChords,
    analyzeAudio,
    matchChordTemplate,
    formatChordName,
    CHORD_QUALITIES,
    KRUMHANSL_MAJOR,
    KRUMHANSL_MINOR
  });

  globalScope.AudioAnalysisEngine = engine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
