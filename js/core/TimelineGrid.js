/**
 * TimelineGrid — grid configuration, lane grid drawing, ruler rendering.
 *
 * No dependency on edCur or DAW globals.
 * All required state passed explicitly via arguments.
 */
var TimelineGrid = (function() {

  function getTimeSignatureGridConfig(timeSignature, bpm) {
    const parts = (timeSignature || '4/4').split('/');
    const numerator = parseInt(parts[0]) || 4;
    const denominator = parseInt(parts[1]) || 4;

    let beatUnit;
    let subdivisionsPerBeat;

    switch(denominator) {
      case 2: beatUnit = 'half'; subdivisionsPerBeat = 4; break;
      case 4: beatUnit = 'quarter'; subdivisionsPerBeat = 4; break;
      case 8: beatUnit = 'eighth'; subdivisionsPerBeat = 2; break;
      case 16: beatUnit = 'sixteenth'; subdivisionsPerBeat = 1; break;
      default: beatUnit = 'quarter'; subdivisionsPerBeat = 4;
    }

    const baseBeatDur = 60 / (bpm || 120);
    const beatDuration = baseBeatDur * (4 / denominator);
    const measureDuration = numerator * beatDuration;
    const beatsPerMeasure = numerator;
    const unitsPerMeasure = numerator;

    return {
      numerator,
      denominator,
      beatUnit,
      beatsPerMeasure,
      subdivisionsPerBeat,
      unitsPerMeasure,
      beatDuration,
      measureDuration
    };
  }

  function drawLaneGrid(canvas, opts) {
    const total = opts.total;
    const timeToX = opts.timeToX;
    const bpm = opts.tempo || 120;
    const sig = opts.timeSignature || '4/4';
    const pxPerSec = opts.pxPerSec || 70;

    const w = Math.min(Math.ceil(timeToX(total)), 20000);
    const parentLane = canvas.closest('.track-lane');
    const h = (parentLane ? parseInt(getComputedStyle(parentLane).getPropertyValue('--lane-h')) : null)
          || parseInt(getComputedStyle(document.documentElement).getPropertyValue('--lane-h'))
          || 64;
    canvas.width = w; canvas.height = h;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const config = getTimeSignatureGridConfig(sig, bpm);
    const beatsPerBar = config.beatsPerMeasure;
    const beatDur = config.beatDuration;
    const barDur = config.measureDuration;

    const maxLines = 500;

    // Bar lines (strong)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    let barCount = 0;
    for (let bar = 1; bar * barDur <= total && barCount < maxLines; bar++) {
      const x = Math.round(timeToX(bar * barDur)) + 0.5;
      if (x > w) break;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      barCount++;
    }

    // Beat lines (thin)
    if (pxPerSec > 10) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      let beatCount = 0;
      for (let beat = 0; beat * beatDur <= total && beatCount < maxLines; beat++) {
        if (beat % beatsPerBar === 0) continue;
        const x = Math.round(timeToX(beat * beatDur)) + 0.5;
        if (x > w) break;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        beatCount++;
      }
    }

    // Sub-beat lines
    if (pxPerSec > 40) {
      const subBeatDur = beatDur / config.subdivisionsPerBeat;
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      let subCount = 0;
      for (let sub = 0; sub * subBeatDur <= total && subCount < maxLines; sub++) {
        if (sub % config.subdivisionsPerBeat === 0) continue;
        const x = Math.round(timeToX(sub * subBeatDur)) + 0.5;
        if (x > w) break;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        subCount++;
      }
    }
  }

  function renderRuler(opts) {
    const total = opts.total;
    const timeToX = opts.timeToX;
    const bpm = opts.tempo || 120;
    const sig = opts.timeSignature || '4/4';
    const pxPerSec = opts.pxPerSec || 70;
    const rulerEl = opts.rulerEl;
    const labelsEl = opts.labelsEl;
    const tlInnerEl = opts.tlInnerEl;
    const lanesEl = opts.lanesEl;

    if (opts.onDurationChange) opts.onDurationChange(total);

    const width = Math.ceil(timeToX(total));
    tlInnerEl.style.width = width + 'px';
    lanesEl.style.width = width + 'px';
    rulerEl.style.width = width + 'px';

    rulerEl.querySelectorAll('canvas').forEach(function(c) { c.remove(); });
    labelsEl.innerHTML = '';

    const config = getTimeSignatureGridConfig(sig, bpm);
    const beatsPerBar = config.beatsPerMeasure;
    const beatDur = config.beatDuration;
    const barDur = config.measureDuration;

    if (!renderRuler._lastLog || renderRuler._lastLog.sig !== sig || renderRuler._lastLog.bpm !== bpm) {
      console.log('[TIME SIGNATURE TIMING]', {
        sig: sig, bpm: bpm,
        numerator: config.numerator,
        denominator: config.denominator,
        beatDuration: config.beatDuration,
        measureDuration: config.measureDuration,
        beatWidthPx: config.beatDuration * pxPerSec,
        measureWidthPx: config.measureDuration * pxPerSec
      });
      renderRuler._lastLog = { sig: sig, bpm: bpm };
    }

    const pxPerBar = barDur * pxPerSec;
    var barStep;
    if (pxPerBar > 120) barStep = 1;
    else if (pxPerBar > 60) barStep = 2;
    else if (pxPerBar > 30) barStep = 4;
    else if (pxPerBar > 15) barStep = 8;
    else if (pxPerBar > 8) barStep = 16;
    else barStep = 32;

    var rulerCanvas = document.createElement('canvas');
    rulerCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    rulerEl.appendChild(rulerCanvas);
    var cappedWidth = Math.min(width, 20000);
    rulerCanvas.width = cappedWidth;
    rulerCanvas.height = 32;
    var rctx = rulerCanvas.getContext('2d');
    rctx.clearRect(0, 0, cappedWidth, 32);

    var showBeats = pxPerSec > 15;
    var showSubBeats = pxPerSec > 50;

    for (var bar = 1; bar * barDur <= total; bar++) {
      var x = timeToX((bar - 1) * barDur);

      if ((bar - 1) % barStep === 0) {
        var span = document.createElement('span');
        span.className = 'ruler-tick-label major';
        span.style.left = x + 'px';
        span.textContent = bar;
        labelsEl.appendChild(span);
      }

      rctx.strokeStyle = 'rgba(74, 85, 104, 0.4)';
      rctx.lineWidth = 1;
      rctx.beginPath(); rctx.moveTo(x + 0.5, 22); rctx.lineTo(x + 0.5, 32); rctx.stroke();

      if (showBeats) {
        for (var beat = 1; beat < beatsPerBar; beat++) {
          var bx = x + beat * beatDur * pxPerSec;
          if (bx > cappedWidth) break;
          rctx.strokeStyle = 'rgba(55, 65, 81, 0.3)';
          rctx.lineWidth = 1;
          rctx.beginPath(); rctx.moveTo(bx + 0.5, 26); rctx.lineTo(bx + 0.5, 32); rctx.stroke();

          if (pxPerBar > 40 && beatsPerBar <= 8) {
            var bspan = document.createElement('span');
            bspan.className = 'ruler-tick-label';
            bspan.style.left = bx + 'px';
            bspan.style.fontSize = '8px';
            bspan.style.color = '#4B5563';
            bspan.textContent = beat + 1;
            labelsEl.appendChild(bspan);
          }
        }
      }

      if (showSubBeats) {
        for (var sub = 1; sub < config.subdivisionsPerBeat; sub++) {
          var sx = x + sub * (beatDur / config.subdivisionsPerBeat) * pxPerSec;
          if (sx > cappedWidth) break;
          rctx.strokeStyle = 'rgba(45, 55, 72, 0.25)';
          rctx.lineWidth = 1;
          rctx.beginPath(); rctx.moveTo(sx + 0.5, 28); rctx.lineTo(sx + 0.5, 32); rctx.stroke();
        }
      }
    }
  }

  return {
    getTimeSignatureGridConfig: getTimeSignatureGridConfig,
    drawLaneGrid: drawLaneGrid,
    renderRuler: renderRuler
  };
})();
