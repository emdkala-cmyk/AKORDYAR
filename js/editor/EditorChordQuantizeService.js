/**
 * EditorChordQuantizeService — pure chord-clip quantization.
 *
 * The service knows only about clip data, selected ids and a meter config.
 * DOM rendering, history and toast feedback stay in the application layer.
 */
(function attachEditorChordQuantizeService(globalScope) {
  'use strict';

  function gridStepForPreset(config, preset = '1/4') {
    const meter = typeof globalThis.Meter === 'object'
      ? globalThis.Meter
      : null;
    if (typeof meter?.getGridStep === 'function') {
      return meter.getGridStep(config, preset);
    }

    const beatDuration = Number(config?.beatDuration) || 0;
    const measureDuration = Number(config?.measureDuration) || 0;
    if (beatDuration <= 0) return 0;

    switch (preset) {
      case '1/1': return measureDuration || beatDuration;
      case '1/2': return (measureDuration || beatDuration) / 2;
      case '1/4': return beatDuration;
      case '1/8': return beatDuration / 2;
      case '1/16': return beatDuration / 4;
      case '1/32': return beatDuration / 8;
      case 'triplet': return beatDuration / 3;
      case 'dotted': return beatDuration * 1.5;
      default: return beatDuration;
    }
  }

  function quantizeSelectedChords(
    clips,
    selectedIds,
    gridStep,
    { tolerance = 1e-9, round = value => value } = {}
  ) {
    if (!Array.isArray(clips) || !selectedIds || !Number.isFinite(gridStep) || gridStep <= 0) {
      return { changed: false, count: 0, selectedCount: 0 };
    }

    const selected = clips.filter(clip =>
      clip?.type === 'chord' &&
      typeof selectedIds.has === 'function' &&
      selectedIds.has(clip.id)
    );
    let count = 0;

    selected.forEach(clip => {
      const originalStart = Number(clip.start) || 0;
      const snappedStart = round(Math.max(0, Math.round(originalStart / gridStep) * gridStep));
      clip.start = snappedStart;
      if (Math.abs(snappedStart - originalStart) > tolerance) count += 1;
    });

    return {
      changed: count > 0,
      count,
      selectedCount: selected.length,
      gridStep
    };
  }

  globalScope.EditorChordQuantizeService = Object.freeze({
    gridStepForPreset,
    quantizeSelectedChords
  });
})(typeof window !== 'undefined' ? window : globalThis);
