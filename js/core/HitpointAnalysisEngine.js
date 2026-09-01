/**
 * HitpointAnalysisEngine
 *
 * Pure transient/onset detection for audio clips.  It combines spectral
 * flux with short-term energy rise, then applies Cubase-style peak,
 * intensity, and minimum-distance filters.
 *
 * The engine returns source-sample coordinates so the same detections can
 * drive waveform markers, slices, MIDI extraction, or Free Warp markers.
 */
(function attachHitpointAnalysisEngine(globalScope) {
  'use strict';

  const DEFAULT_TARGET_RATE = 22050;
  const DEFAULT_WINDOW_SIZE = 1024;
  const DEFAULT_HOP_SIZE = 256;
  const DEFAULT_THRESHOLD = 0.18;
  const DEFAULT_INTENSITY = 0.05;
  const DEFAULT_MINIMUM_LENGTH = 0.08;

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function finiteNumber(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function nextPowerOfTwo(value) {
    let size = 1;
    const target = Math.max(2, Math.floor(Number(value) || 2));
    while (size < target) size <<= 1;
    return size;
  }

  function createFFT(size) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error('HitpointAnalysisEngine FFT size must be a power of two');
    }

    const levels = Math.round(Math.log2(size));
    const halfSize = size >> 1;
    const cosineTable = new Float32Array(halfSize);
    const sineTable = new Float32Array(halfSize);
    const reverseTable = new Uint32Array(size);

    for (let index = 0; index < halfSize; index += 1) {
      const phase = (2 * Math.PI * index) / size;
      cosineTable[index] = Math.cos(phase);
      sineTable[index] = Math.sin(phase);
    }

    for (let index = 0; index < size; index += 1) {
      let value = index;
      let reversed = 0;
      for (let bit = 0; bit < levels; bit += 1) {
        reversed = (reversed << 1) | (value & 1);
        value >>= 1;
      }
      reverseTable[index] = reversed;
    }

    function transform(real, imaginary) {
      for (let index = 0; index < size; index += 1) {
        const reversedIndex = reverseTable[index];
        if (reversedIndex <= index) continue;
        let temporary = real[index];
        real[index] = real[reversedIndex];
        real[reversedIndex] = temporary;
        temporary = imaginary[index];
        imaginary[index] = imaginary[reversedIndex];
        imaginary[reversedIndex] = temporary;
      }

      for (let span = 2; span <= size; span <<= 1) {
        const halfSpan = span >> 1;
        const tableStep = size / span;
        for (let start = 0; start < size; start += span) {
          for (
            let offset = 0, tableIndex = 0;
            offset < halfSpan;
            offset += 1, tableIndex += tableStep
          ) {
            const firstIndex = start + offset;
            const secondIndex = firstIndex + halfSpan;
            const cosine = cosineTable[tableIndex];
            const sine = sineTable[tableIndex];
            const temporaryReal =
              real[secondIndex] * cosine +
              imaginary[secondIndex] * sine;
            const temporaryImaginary =
              imaginary[secondIndex] * cosine -
              real[secondIndex] * sine;
            real[secondIndex] = real[firstIndex] - temporaryReal;
            imaginary[secondIndex] =
              imaginary[firstIndex] - temporaryImaginary;
            real[firstIndex] += temporaryReal;
            imaginary[firstIndex] += temporaryImaginary;
          }
        }
      }
    }

    return Object.freeze({ transform });
  }

  function createHannWindow(size) {
    const window = new Float32Array(size);
    for (let index = 0; index < size; index += 1) {
      window[index] =
        0.5 - 0.5 * Math.cos((2 * Math.PI * index) / Math.max(1, size - 1));
    }
    return window;
  }

  function bufferToMono(buffer) {
    if (!buffer || typeof buffer.getChannelData !== 'function') {
      throw new TypeError(
        'HitpointAnalysisEngine requires an AudioBuffer-like object'
      );
    }

    const channelCount = Math.max(1, Math.floor(
      finiteNumber(buffer.numberOfChannels, 1)
    ));
    const sampleCount = Math.max(0, Math.floor(
      finiteNumber(buffer.length, 0)
    ));
    if (!sampleCount) return new Float32Array(0);

    const firstChannel = buffer.getChannelData(0);
    if (channelCount === 1) {
      const mono = new Float32Array(sampleCount);
      mono.set(firstChannel.subarray(0, sampleCount));
      return mono;
    }

    const secondChannel = buffer.getChannelData(
      Math.min(1, channelCount - 1)
    );
    const mono = new Float32Array(sampleCount);
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      mono[sampleIndex] =
        (Number(firstChannel[sampleIndex]) || 0) +
        (Number(secondChannel[sampleIndex]) || 0);
      mono[sampleIndex] *= 0.5;
    }
    return mono;
  }

  function resampleLinear(samples, sourceRate, targetRate) {
    if (
      !samples.length ||
      !Number.isFinite(sourceRate) ||
      !Number.isFinite(targetRate) ||
      sourceRate <= targetRate * 1.14
    ) {
      return { samples, sampleRate: sourceRate };
    }

    const targetLength = Math.max(
      1,
      Math.round(samples.length * targetRate / sourceRate)
    );
    const resampled = new Float32Array(targetLength);
    const scale = sourceRate / targetRate;
    for (let targetIndex = 0; targetIndex < targetLength; targetIndex += 1) {
      const sourcePosition = targetIndex * scale;
      const leftIndex = Math.min(
        samples.length - 1,
        Math.floor(sourcePosition)
      );
      const rightIndex = Math.min(samples.length - 1, leftIndex + 1);
      const fraction = sourcePosition - leftIndex;
      resampled[targetIndex] =
        samples[leftIndex] * (1 - fraction) +
        samples[rightIndex] * fraction;
    }
    return { samples: resampled, sampleRate: targetRate };
  }

  function prepareSamples(buffer, targetRate) {
    const sourceRate = Math.max(
      1,
      finiteNumber(buffer.sampleRate, DEFAULT_TARGET_RATE)
    );
    const mono = bufferToMono(buffer);
    const prepared = resampleLinear(mono, sourceRate, targetRate);
    return {
      samples: prepared.samples,
      sampleRate: prepared.sampleRate,
      sourceRate
    };
  }

  function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = Array.from(values).sort(
      (left, right) => left - right
    );
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.round(clamp(ratio, 0, 1) * (sorted.length - 1)))
    );
    return sorted[index];
  }

  function normalizeScores(values, lowRatio = 0.1, highRatio = 0.98) {
    if (!values.length) return new Float32Array(0);
    const low = percentile(values, lowRatio);
    let high = percentile(values, highRatio);
    let maximum = 0;
    for (const value of values) {
      if (value > maximum) maximum = value;
    }
    if (high <= low + 1e-9) high = maximum;
    const span = high - low;
    const normalized = new Float32Array(values.length);
    if (span <= 1e-9) return normalized;
    for (let index = 0; index < values.length; index += 1) {
      normalized[index] = clamp((values[index] - low) / span, 0, 1);
    }
    return normalized;
  }

  function movingMean(values, radius) {
    const output = new Float32Array(values.length);
    if (!values.length) return output;
    const prefix = new Float64Array(values.length + 1);
    for (let index = 0; index < values.length; index += 1) {
      prefix[index + 1] = prefix[index] + values[index];
    }
    for (let index = 0; index < values.length; index += 1) {
      const start = Math.max(0, index - radius);
      const end = Math.min(values.length - 1, index + radius);
      output[index] =
        (prefix[end + 1] - prefix[start]) / (end - start + 1);
    }
    return output;
  }

  function makeHitpointId(index) {
    return `hp_${index + 1}`;
  }

  function filterHitpoints(hitpoints, options = {}) {
    const threshold = clamp(
      finiteNumber(options.threshold, DEFAULT_THRESHOLD),
      0,
      1
    );
    const intensity = clamp(
      finiteNumber(options.intensity, DEFAULT_INTENSITY),
      0,
      1
    );
    const minimumLength = Math.max(
      0,
      finiteNumber(options.minimumLength, DEFAULT_MINIMUM_LENGTH)
    );
    const minimumSamples = Math.max(
      0,
      finiteNumber(options.minimumSamples, minimumLength * (
        finiteNumber(options.sampleRate, DEFAULT_TARGET_RATE)
      ))
    );

    const candidates = (Array.isArray(hitpoints) ? hitpoints : [])
      .filter(hitpoint =>
        hitpoint &&
        Number.isFinite(Number(hitpoint.sourceSample)) &&
        Number(hitpoint.strength ?? 0) >= threshold &&
        Number(hitpoint.energy ?? 0) >= intensity
      )
      .map(hitpoint => ({
        ...hitpoint,
        sourceSample: Math.max(0, Math.round(Number(hitpoint.sourceSample))),
        sourceTime: finiteNumber(
          hitpoint.sourceTime,
          Number(hitpoint.sourceSample) /
            Math.max(1, finiteNumber(options.sampleRate, DEFAULT_TARGET_RATE))
        ),
        strength: clamp(finiteNumber(hitpoint.strength, 0), 0, 1),
        energy: clamp(finiteNumber(hitpoint.energy, 0), 0, 1),
        enabled: hitpoint.enabled !== false
      }))
      .sort((left, right) => left.sourceSample - right.sourceSample);

    if (!minimumSamples) {
      return candidates.map((hitpoint, index) => ({
        ...hitpoint,
        id: hitpoint.id || makeHitpointId(index)
      }));
    }

    const filtered = [];
    for (const candidate of candidates) {
      const previous = filtered[filtered.length - 1];
      if (
        !previous ||
        candidate.sourceSample - previous.sourceSample >= minimumSamples
      ) {
        filtered.push(candidate);
        continue;
      }
      if (candidate.strength > previous.strength) {
        filtered[filtered.length - 1] = candidate;
      }
    }

    return filtered.map((hitpoint, index) => ({
      ...hitpoint,
      id: hitpoint.id || makeHitpointId(index)
    }));
  }

  function calculateHitpoints(buffer, options = {}) {
    if (!buffer || typeof buffer.getChannelData !== 'function') {
      return {
        ok: false,
        reason: 'invalid-buffer',
        hitpoints: [],
        rawHitpoints: []
      };
    }

    const targetRate = Math.max(
      1000,
      finiteNumber(options.targetRate, DEFAULT_TARGET_RATE)
    );
    const prepared = prepareSamples(buffer, targetRate);
    const analysisSamples = prepared.samples;
    const analysisRate = Math.max(1, prepared.sampleRate);
    const sourceRate = Math.max(1, prepared.sourceRate);
    const sourceDuration = analysisSamples.length / analysisRate;
    const requestedStart = Math.max(
      0,
      finiteNumber(
        options.startTime,
        finiteNumber(options.sourceOffset, 0)
      )
    );
    const requestedEnd = finiteNumber(
      options.endTime,
      finiteNumber(options.sourceEnd, sourceDuration)
    );
    const startTime = clamp(requestedStart, 0, sourceDuration);
    const endTime = clamp(
      Math.max(startTime, requestedEnd),
      startTime,
      sourceDuration
    );
    const startSample = Math.min(
      analysisSamples.length,
      Math.floor(startTime * analysisRate)
    );
    const endSample = Math.min(
      analysisSamples.length,
      Math.max(startSample + 1, Math.ceil(endTime * analysisRate))
    );

    const windowSize = nextPowerOfTwo(
      finiteNumber(options.windowSize, DEFAULT_WINDOW_SIZE)
    );
    const hopSize = Math.max(
      1,
      Math.floor(finiteNumber(options.hopSize, DEFAULT_HOP_SIZE))
    );
    const frameCount = Math.max(
      1,
      Math.ceil(Math.max(1, endSample - startSample) / hopSize)
    );
    const fft = createFFT(windowSize);
    const window = createHannWindow(windowSize);
    const real = new Float32Array(windowSize);
    const imaginary = new Float32Array(windowSize);
    const previousMagnitude = new Float32Array(windowSize >> 1);
    const fluxScores = new Float32Array(frameCount);
    const energyScores = new Float32Array(frameCount);
    const magnitudes = new Float32Array(windowSize >> 1);
    const progressCallback =
      typeof options.onProgress === 'function' ? options.onProgress : null;

    let previousEnergy = 0;
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const frameStart = startSample + frameIndex * hopSize;
      let energySum = 0;
      real.fill(0);
      imaginary.fill(0);

      for (let sampleOffset = 0; sampleOffset < windowSize; sampleOffset += 1) {
        const sampleIndex = frameStart + sampleOffset;
        const sample = sampleIndex < endSample
          ? Number(analysisSamples[sampleIndex]) || 0
          : 0;
        const windowedSample = sample * window[sampleOffset];
        real[sampleOffset] = windowedSample;
        energySum += windowedSample * windowedSample;
      }

      fft.transform(real, imaginary);
      const rootMeanSquare = Math.sqrt(energySum / windowSize);
      let flux = 0;
      for (let binIndex = 1; binIndex < magnitudes.length; binIndex += 1) {
        const magnitude = Math.log1p(Math.hypot(
          real[binIndex],
          imaginary[binIndex]
        ));
        magnitudes[binIndex] = magnitude;
        if (magnitude > previousMagnitude[binIndex]) {
          flux += magnitude - previousMagnitude[binIndex];
        }
        previousMagnitude[binIndex] = magnitude;
      }

      const energyRise = previousEnergy > 1e-6
        ? Math.max(0, rootMeanSquare - previousEnergy) /
          (previousEnergy + 0.02)
        : rootMeanSquare;
      fluxScores[frameIndex] = flux;
      energyScores[frameIndex] = clamp(energyRise, 0, 1);
      previousEnergy = rootMeanSquare;

      if (progressCallback && (
        frameIndex === frameCount - 1 ||
        frameIndex % 32 === 0
      )) {
        progressCallback((frameIndex + 1) / frameCount);
      }
    }

    const normalizedFlux = normalizeScores(fluxScores);
    const normalizedEnergy = normalizeScores(energyScores);
    const combinedScores = new Float32Array(frameCount);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      combinedScores[frameIndex] =
        normalizedFlux[frameIndex] * 0.75 +
        normalizedEnergy[frameIndex] * 0.25;
    }

    const localRadius = Math.max(
      1,
      Math.round((analysisRate * 0.04) / hopSize)
    );
    const localBaseline = movingMean(combinedScores, localRadius);
    const onsetStrength = new Float32Array(frameCount);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      onsetStrength[frameIndex] = clamp(
        combinedScores[frameIndex] -
          localBaseline[frameIndex] * 0.55,
        0,
        1
      );
    }

    const rawHitpoints = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const strength = onsetStrength[frameIndex];
      const energy = normalizedEnergy[frameIndex] * 0.7 +
        normalizedFlux[frameIndex] * 0.3;
      if (strength <= 0) continue;

      let isLocalMaximum = true;
      const neighborhoodStart = Math.max(0, frameIndex - localRadius);
      const neighborhoodEnd = Math.min(
        frameCount - 1,
        frameIndex + localRadius
      );
      for (
        let neighborIndex = neighborhoodStart;
        neighborIndex <= neighborhoodEnd;
        neighborIndex += 1
      ) {
        if (
          neighborIndex !== frameIndex &&
          onsetStrength[neighborIndex] > strength
        ) {
          isLocalMaximum = false;
          break;
        }
      }
      if (!isLocalMaximum) continue;

      const frameStart = startSample + frameIndex * hopSize;
      const detectionSample = clamp(
        frameStart + Math.floor(hopSize * 0.5),
        startSample,
        Math.max(startSample, endSample - 1)
      );
      const sourceTime = detectionSample / analysisRate;
      rawHitpoints.push({
        id: makeHitpointId(rawHitpoints.length),
        sourceSample: Math.round(sourceTime * sourceRate),
        sourceTime,
        energy: clamp(energy, 0, 1),
        strength: clamp(strength, 0, 1),
        enabled: true
      });
    }

    const settings = {
      threshold: clamp(
        finiteNumber(options.threshold, DEFAULT_THRESHOLD),
        0,
        1
      ),
      intensity: clamp(
        finiteNumber(options.intensity, DEFAULT_INTENSITY),
        0,
        1
      ),
      minimumLength: Math.max(
        0,
        finiteNumber(options.minimumLength, DEFAULT_MINIMUM_LENGTH)
      ),
      sampleRate: sourceRate
    };
    const hitpoints = filterHitpoints(rawHitpoints, settings);

    return {
      ok: true,
      sourceRate,
      analysisRate,
      sourceDuration,
      analyzedStart: startTime,
      analyzedEnd: endTime,
      frameSize: windowSize,
      hopSize,
      frameCount,
      ...settings,
      rawHitpoints,
      allHitpoints: rawHitpoints,
      hitpoints,
      count: hitpoints.length
    };
  }

  const engine = Object.freeze({
    calculateHitpoints,
    filterHitpoints,
    bufferToMono,
    normalizeScores,
    clamp
  });

  globalScope.HitpointAnalysisEngine = engine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
