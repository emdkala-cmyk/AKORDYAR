/**
 * ScoreRenderer
 *
 * The Live Score rendering boundary.  MusicXML remains the written-source
 * authority, while this module owns layout caching, the standard white/black
 * theme contract, and the position API consumed by the playhead service.
 *
 * If VexFlow is supplied by a host shell it can be selected through
 * `engine: "vexflow"`.  The built-in SVG renderer remains the deterministic
 * offline fallback used by the desktop and mobile shells.
 */
(function attachScoreRenderer(globalScope) {
  'use strict';

  function fallbackRenderer() {
    return globalScope.MusicXmlScoreRenderer || globalScope.MidiScoreRenderer || null;
  }

  function number(value, fallbackValue = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallbackValue;
  }

  function scoreKey(score, partId, options = {}) {
    return JSON.stringify([
      score?.schemaVersion || 0,
      score?.endTick || 0,
      partId || score?.activePartId || null,
      options.measureWidth || null,
      options.staffSpacing || null,
      options.measuresPerSystem || null
    ]);
  }

  function measureAtTick(layout, tick) {
    const safeTick = Math.max(0, number(tick));
    const measures = layout?.measures || [];
    return measures.find((measure, index) => {
      const last = index === measures.length - 1;
      return safeTick >= number(measure.startTick) &&
        (safeTick < number(measure.endTick) || last);
    }) || measures[measures.length - 1] || null;
  }

  function tickToPosition(layout, tick) {
    const measure = measureAtTick(layout, tick);
    if (!measure) {
      return {
        systemIndex: 0,
        measureIndex: 0,
        x: 0,
        yTop: 0,
        yBottom: 0,
        progress: 0
      };
    }
    const start = number(measure.startTick);
    const end = Math.max(start + 1, number(measure.endTick, start + 1));
    const progress = Math.max(0, Math.min(1, (number(tick) - start) / (end - start)));
    const x = number(measure.x) + progress * number(measure.width, 1);
    const system = layout.systems?.[measure.systemIndex] || null;
    const staffCount = Math.max(1, number(system?.staffCount, measure.staffCount || 1));
    const yTop = number(measure.staffTop) - 25;
    const yBottom = number(measure.staffTop) + staffCount * 92 - 44 + 20;
    return {
      systemIndex: number(measure.systemIndex),
      measureIndex: number(measure.index),
      measureNumber: measure.number,
      x,
      yTop,
      yBottom,
      staffTop: number(measure.staffTop),
      progress,
      system
    };
  }

  function getLayout(score, partId, options = {}) {
    const fallback = fallbackRenderer();
    if (!fallback?.getCachedLayout && !fallback?.buildLayout) return null;
    return fallback.getCachedLayout
      ? fallback.getCachedLayout(score, partId, options)
      : fallback.buildLayout(score, partId, options);
  }

  function renderSvg(score, partId, options = {}) {
    const fallback = fallbackRenderer();
    if (!fallback?.renderSvg) return '';
    const svg = fallback.renderSvg(score, partId, {
      ...options,
      className: 'score-renderer-standard',
      theme: 'standard-white'
    });
    return svg.replace(
      /<svg\s+class="([^"]*)"/,
      (_, classes) => `<svg data-score-engine="svg" class="${classes} score-renderer-standard-svg"`
    );
  }

  function getPlayheadPosition(score, partId, seconds, options = {}) {
    const layout = getLayout(score, partId, options);
    if (!layout) return tickToPosition(null, 0);
    const clock = options.clock || globalScope.ScorePlayheadService?.create?.({
      midiScore: options.midiScore || null,
      musicXmlScore: score
    });
    const tick = Number.isFinite(Number(options.activeTick))
      ? Number(options.activeTick)
      : (clock?.secondsToTick?.(seconds) || 0);
    return {
      tick,
      ...tickToPosition(layout, tick),
      layout
    };
  }

  function getPlayheadX(score, partId, seconds, options = {}) {
    return getPlayheadPosition(score, partId, seconds, options).x;
  }

  function clearCache() {
    fallbackRenderer()?.clearCache?.();
  }

  const api = Object.freeze({
    engine: 'svg-standard',
    buildLayout: (...args) => fallbackRenderer()?.buildLayout?.(...args) || null,
    getCachedLayout: (...args) => fallbackRenderer()?.getCachedLayout?.(...args) || null,
    renderSvg,
    getPlayheadX,
    getPlayheadPosition,
    clearCache,
    keyLabel: (...args) => fallbackRenderer()?.keyLabel?.(...args) || 'C'
  });

  globalScope.ScoreRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
