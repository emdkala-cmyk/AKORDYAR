/**
 * TimelineGrid — adaptive grid configuration, lane grid drawing, and ruler
 * rendering.
 *
 * No dependency on Song Runtime or DAW globals.
 * All required state is passed explicitly via arguments.
 * Meter.js owns musical time-signature math.
 */
var TimelineGrid = (function() {
  'use strict';

  var RULER_HEIGHT = 32;
  var MAX_CANVAS_WIDTH = 50000;
  var MAX_GRID_LINES = 6000;
  var GRID_EPSILON = 1e-9;
  var MIN_MAJOR_LABEL_SPACING = 48;
  var MIN_BEAT_GRID_SPACING = 18;
  var MIN_SUBDIVISION_GRID_SPACING = 12;
  var BEAT_LABEL_SPACING = 72;
  var MAJOR_BAR_STEPS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

  function getTimeSignatureGridConfig(timeSignature, bpm) {
    return window.Meter.getMeterConfig(timeSignature, bpm);
  }

  function finitePositive(value, fallback) {
    var numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }

  function chooseMajorBarStep(pxPerBar) {
    var safePxPerBar = finitePositive(pxPerBar, 1);

    for (var index = 0; index < MAJOR_BAR_STEPS.length; index++) {
      var step = MAJOR_BAR_STEPS[index];
      if (safePxPerBar * step >= MIN_MAJOR_LABEL_SPACING) {
        return step;
      }
    }

    return MAJOR_BAR_STEPS[MAJOR_BAR_STEPS.length - 1];
  }

  /**
   * Select the musical levels visible at the current horizontal zoom.
   *
   * The returned spec is shared by the lane renderer and the ruler renderer,
   * so both stay visually synchronized while zooming.
   */
  function getAdaptiveGridSpec(opts) {
    opts = opts || {};
    var config =
      opts.config ||
      getTimeSignatureGridConfig(opts.timeSignature || '4/4', opts.tempo || 120);
    var pxPerSec = finitePositive(opts.pxPerSec, 70);
    var beatsPerBar = Math.max(1, Number(config.beatsPerMeasure) || 4);
    var beatDuration = finitePositive(config.beatDuration, 0.5);
    var barDuration = finitePositive(
      config.measureDuration,
      beatDuration * beatsPerBar
    );
    var subdivisionsPerBeat = Math.max(
      1,
      Math.floor(Number(config.subdivisionsPerBeat) || 1)
    );
    var pxPerBar = barDuration * pxPerSec;
    var pxPerBeat = beatDuration * pxPerSec;
    var pxPerSubdivision = pxPerBeat / subdivisionsPerBeat;
    var majorBarStep = chooseMajorBarStep(pxPerBar);

    return {
      config: config,
      pxPerSec: pxPerSec,
      beatsPerBar: beatsPerBar,
      beatDuration: beatDuration,
      barDuration: barDuration,
      subdivisionsPerBeat: subdivisionsPerBeat,
      pxPerBar: pxPerBar,
      pxPerBeat: pxPerBeat,
      pxPerSubdivision: pxPerSubdivision,
      majorBarStep: majorBarStep,
      // At wide-out zoom, individual bar lines are too dense. Keep the
      // strong lane grid on the same adaptive interval as the ruler labels.
      barGridStep: majorBarStep,
      showBeats: pxPerBeat >= MIN_BEAT_GRID_SPACING,
      showSubdivisions:
        subdivisionsPerBeat > 1 &&
        pxPerSubdivision >= MIN_SUBDIVISION_GRID_SPACING,
      showBeatLabels:
        pxPerBeat >= BEAT_LABEL_SPACING && beatsPerBar <= 32
    };
  }

  /**
   * Build a complete grid structure of measures, beats, and downbeats.
   * Pure function - no DOM or global dependency beyond Meter.
   *
   * @param {{ timeSignature: string, bpm: number, durationInSeconds: number }} opts
   * @returns {{ config: object, measures: number[], beats: object[], downbeats: number[] }}
   */
  function getGridStructure(opts) {
    opts = opts || {};
    var sig = opts.timeSignature || '4/4';
    var bpm = opts.bpm || 120;
    var dur = Math.max(0, Number(opts.durationInSeconds) || 0);
    var M = window.Meter;
    var config = M.getMeterConfig(sig, bpm);
    var beats = [];
    var downbeats = [];
    var measureCount = Math.ceil(dur / config.measureDuration);

    for (var m = 0; m < measureCount; m++) {
      for (var b = 0; b < config.beatsPerMeasure; b++) {
        var beatIndex = m * config.beatsPerMeasure + b;
        var time = M.beatIndexToTime(beatIndex, config);
        beats.push({
          measure: m,
          beat: b,
          time: time
        });
      }
    }

    for (var m2 = 0; m2 < measureCount; m2++) {
      downbeats.push(
        M.beatIndexToTime(m2 * config.beatsPerMeasure, config)
      );
    }

    var measures = [];
    for (var m3 = 0; m3 < measureCount; m3++) {
      measures.push(m3);
    }

    return {
      config: config,
      measures: measures,
      beats: beats,
      downbeats: downbeats
    };
  }

  function getCanvasHeight(canvas) {
    var parentLane =
      canvas && typeof canvas.closest === 'function'
        ? canvas.closest('.track-lane')
        : null;
    var laneHeight = parentLane
      ? parseInt(getComputedStyle(parentLane).getPropertyValue('--lane-h'), 10)
      : NaN;
    var rootHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--lane-h'),
      10
    );
    return laneHeight || rootHeight || 64;
  }

  function drawVerticalLine(ctx, x, yStart, yEnd, strokeStyle, lineWidth) {
    if (!Number.isFinite(x)) return;
    var crispX = Math.round(x) + 0.5;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth || 1;
    ctx.beginPath();
    ctx.moveTo(crispX, yStart);
    ctx.lineTo(crispX, yEnd);
    ctx.stroke();
  }

  function drawLaneGrid(canvas, opts) {
    opts = opts || {};
    if (!canvas || typeof canvas.getContext !== 'function') return;

    var total = Math.max(0, Number(opts.total) || 0);
    var timeToX =
      typeof opts.timeToX === 'function' ? opts.timeToX : function(time) {
        return time * finitePositive(opts.pxPerSec, 70);
      };
    var bpm = opts.tempo || 120;
    var sig = opts.timeSignature || '4/4';
    var pxPerSec = opts.pxPerSec || 70;
    var width = Math.max(
      1,
      Math.min(Math.ceil(Number(timeToX(total)) || 0), MAX_CANVAS_WIDTH)
    );
    var height = getCanvasHeight(canvas);

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    var config = getTimeSignatureGridConfig(sig, bpm);
    var spec = getAdaptiveGridSpec({
      config: config,
      pxPerSec: pxPerSec
    });
    var meter = window.Meter;
    var lineCount = 0;

    function drawAt(time, style, yStart, yEnd) {
      if (lineCount >= MAX_GRID_LINES) return false;
      var x = Number(timeToX(time));
      if (!Number.isFinite(x)) return true;
      if (x > width) return false;
      if (x >= -1) {
        drawVerticalLine(ctx, x, yStart, yEnd, style, 1);
        lineCount++;
      }
      return true;
    }

    // Fine subdivisions are rendered first, so beat and bar accents remain
    // visible on top of them.
    if (spec.showSubdivisions) {
      var subdivisionDuration =
        spec.beatDuration / spec.subdivisionsPerBeat;
      for (
        var subdivision = 1;
        subdivision * subdivisionDuration <= total + GRID_EPSILON &&
        lineCount < MAX_GRID_LINES;
        subdivision++
      ) {
        if (subdivision % spec.subdivisionsPerBeat === 0) continue;
        if (
          !drawAt(
            subdivision * subdivisionDuration,
            'rgba(148, 163, 184, 0.08)',
            0,
            height
          )
        ) {
          break;
        }
      }
    }

    if (spec.showBeats) {
      var beatCount = Math.ceil(total / spec.beatDuration);
      for (
        var beatIndex = 1;
        beatIndex <= beatCount && lineCount < MAX_GRID_LINES;
        beatIndex++
      ) {
        if (beatIndex % spec.beatsPerBar === 0) continue;
        var beatStyle = meter.isStrongBeat(
          (beatIndex - 1) % spec.beatsPerBar,
          sig
        )
          ? 'rgba(203, 213, 225, 0.18)'
          : 'rgba(148, 163, 184, 0.13)';
        if (
          !drawAt(
            beatIndex * spec.beatDuration,
            beatStyle,
            0,
            height
          )
        ) {
          break;
        }
      }
    }

    var barCount = Math.ceil(total / spec.barDuration);
    for (
      var barIndex = 0;
      barIndex <= barCount && lineCount < MAX_GRID_LINES;
      barIndex += spec.barGridStep
    ) {
      if (
        !drawAt(
          barIndex * spec.barDuration,
          'rgba(226, 232, 240, 0.22)',
          0,
          height
        )
      ) {
        break;
      }
    }
  }

  function appendRulerLabel(labelsEl, text, x, className, fontSize, color, state) {
    if (!labelsEl || !Number.isFinite(x)) return false;

    var safeText = String(text);
    var safeFontSize = Number(fontSize) || 10;
    if (state && state.defer) {
      state.pending.push({
        text: safeText,
        x: x,
        className: className,
        fontSize: safeFontSize,
        color: color,
        priority: className === 'major' ? 2 : 1
      });
      return true;
    }

    // A small estimate keeps labels readable without forcing synchronous
    // layout measurements for every bar while the user drags the zoom slider.
    var estimatedWidth = Math.max(
      10,
      safeText.length * safeFontSize * 0.62
    );
    var leftEdge = x - estimatedWidth / 2;
    if (leftEdge < state.lastLabelRight + 6) return false;

    var span = document.createElement('span');
    span.className = 'ruler-tick-label' + (className ? ' ' + className : '');
    span.style.left = x + 'px';
    span.style.fontSize = safeFontSize + 'px';
    span.style.direction = 'ltr';
    if (color) span.style.color = color;
    span.textContent = safeText;
    labelsEl.appendChild(span);
    state.lastLabelRight = x + estimatedWidth / 2;
    return true;
  }

  function flushRulerLabels(labelsEl, state) {
    state.pending
      .sort(function(left, right) {
        return left.x - right.x || right.priority - left.priority;
      })
      .forEach(function(label) {
        appendRulerLabel(
          labelsEl,
          label.text,
          label.x,
          label.className,
          label.fontSize,
          label.color,
          state
        );
      });
  }

  function drawRulerTick(ctx, x, yStart, style) {
    if (!Number.isFinite(x)) return;
    var crispX = Math.round(x) + 0.5;
    ctx.strokeStyle = style;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(crispX, yStart);
    ctx.lineTo(crispX, RULER_HEIGHT);
    ctx.stroke();
  }

  function renderRuler(opts) {
    opts = opts || {};
    var total = Math.max(0, Number(opts.total) || 0);
    var timeToX =
      typeof opts.timeToX === 'function' ? opts.timeToX : function(time) {
        return time * finitePositive(opts.pxPerSec, 70);
      };
    var bpm = opts.tempo || 120;
    var sig = opts.timeSignature || '4/4';
    var pxPerSec = opts.pxPerSec || 70;
    var rulerEl = opts.rulerEl;
    var labelsEl = opts.labelsEl;
    var tlInnerEl = opts.tlInnerEl;
    var lanesEl = opts.lanesEl;

    if (opts.onDurationChange) opts.onDurationChange(total);

    var width = Math.max(1, Math.ceil(Number(timeToX(total)) || 0));
    if (tlInnerEl?.style) tlInnerEl.style.width = width + 'px';
    if (lanesEl?.style) lanesEl.style.width = width + 'px';
    if (rulerEl?.style) rulerEl.style.width = width + 'px';

    if (!rulerEl || !labelsEl) return;
    if (typeof rulerEl.querySelectorAll === 'function') {
      rulerEl.querySelectorAll('canvas').forEach(function(canvas) {
        canvas.remove();
      });
    }
    labelsEl.innerHTML = '';

    var config = getTimeSignatureGridConfig(sig, bpm);
    var spec = getAdaptiveGridSpec({
      config: config,
      pxPerSec: pxPerSec
    });

    if (
      !renderRuler._lastLog ||
      renderRuler._lastLog.sig !== sig ||
      renderRuler._lastLog.bpm !== bpm
    ) {
      console.log('[TIME SIGNATURE TIMING]', {
        sig: sig,
        bpm: bpm,
        numerator: config.numerator,
        denominator: config.denominator,
        beatDuration: config.beatDuration,
        measureDuration: config.measureDuration,
        beatWidthPx: spec.pxPerBeat,
        measureWidthPx: spec.pxPerBar
      });
      renderRuler._lastLog = { sig: sig, bpm: bpm };
    }

    var cappedWidth = Math.max(1, Math.min(width, MAX_CANVAS_WIDTH));
    var rulerCanvas = document.createElement('canvas');
    rulerCanvas.style.cssText =
      'position:absolute;left:0;top:0;width:' +
      cappedWidth +
      'px;height:' +
      RULER_HEIGHT +
      'px;pointer-events:none;';
    rulerEl.appendChild(rulerCanvas);
    rulerCanvas.width = cappedWidth;
    rulerCanvas.height = RULER_HEIGHT;
    var rctx = rulerCanvas.getContext('2d');
    if (!rctx) return;
    rctx.clearRect(0, 0, cappedWidth, RULER_HEIGHT);

    var labelState = {
      lastLabelRight: -Infinity,
      defer: true,
      pending: []
    };
    var barCount = Math.ceil(total / spec.barDuration);

    // Subdivision ticks — shortest marks at the bottom of the ruler.
    if (spec.showSubdivisions) {
      var subdivisionDuration =
        spec.beatDuration / spec.subdivisionsPerBeat;
      for (
        var subdivision = 1;
        subdivision * subdivisionDuration <= total + GRID_EPSILON;
        subdivision++
      ) {
        if (subdivision % spec.subdivisionsPerBeat === 0) continue;
        var subdivisionX = Number(
          timeToX(subdivision * subdivisionDuration)
        );
        if (subdivisionX > cappedWidth) break;
        drawRulerTick(
          rctx,
          subdivisionX,
          28,
          'rgba(148, 163, 184, 0.38)'
        );
      }
    }

    // Beat ticks — medium marks. At high zoom their labels use Cubase-like
    // bar.beat notation (for example 156.3 and 156.4).
    if (spec.showBeats) {
      var beatCount = Math.ceil(total / spec.beatDuration);
      for (var beatIndex = 1; beatIndex <= beatCount; beatIndex++) {
        if (beatIndex % spec.beatsPerBar === 0) continue;
        var beatTime = beatIndex * spec.beatDuration;
        var beatX = Number(timeToX(beatTime));
        if (beatX > cappedWidth) break;
        var beatWithinBar = (beatIndex - 1) % spec.beatsPerBar;
        var beatStyle = window.Meter.isStrongBeat(beatWithinBar, sig)
          ? 'rgba(203, 213, 225, 0.58)'
          : 'rgba(148, 163, 184, 0.42)';
        drawRulerTick(rctx, beatX, 24, beatStyle);

        if (spec.showBeatLabels) {
          var beatBar = Math.floor((beatIndex - 1) / spec.beatsPerBar) + 1;
          var beatLabelX = Math.round(beatX) + 0.5;
          appendRulerLabel(
            labelsEl,
            beatBar + '.' + (beatWithinBar + 2),
            beatLabelX,
            'beat',
            9,
            '#718096',
            labelState
          );
        }
      }
    }

    // Bar ticks and labels — strongest marks. When bars are narrower than the
    // readable threshold, both labels and strong lines use an adaptive
    // 1/2/4/8/... bar interval just like a DAW ruler.
    for (
      var barIndex = 0;
      barIndex <= barCount;
      barIndex += spec.barGridStep
    ) {
      var barStartTime = barIndex * spec.barDuration;
      var barX = Number(timeToX(barStartTime));
      if (barX > cappedWidth) break;
      drawRulerTick(
        rctx,
        barX,
        19,
        'rgba(226, 232, 240, 0.72)'
      );

      if (barIndex % spec.majorBarStep === 0) {
        var barLabelX = Math.round(barX) + 0.5;
        appendRulerLabel(
          labelsEl,
          barIndex + 1,
          barLabelX,
          'major',
          10,
          '#A0AEC0',
          labelState
        );
      }
    }

    labelState.defer = false;
    flushRulerLabels(labelsEl, labelState);
  }

  return {
    getTimeSignatureGridConfig: getTimeSignatureGridConfig,
    getAdaptiveGridSpec: getAdaptiveGridSpec,
    getGridStructure: getGridStructure,
    drawLaneGrid: drawLaneGrid,
    renderRuler: renderRuler
  };
})();

if (typeof window !== 'undefined') {
  window.TimelineGrid = TimelineGrid;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimelineGrid;
}
