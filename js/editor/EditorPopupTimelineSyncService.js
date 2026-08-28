/**
 * EditorPopupTimelineSyncService
 *
 * Renders the editor chord-lane mirror inside the player popup and keeps its
 * playhead synchronized with the parent transport. DOM, popup and timeline
 * state remain injected so the service can be tested without editor globals.
 */
(function attachEditorPopupTimelineSyncService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    bridge = globalScope.WindowBridge,
    getPopup = () => null,
    isOpen = popup => Boolean(popup && !popup.closed),
    getDocument = popup => popup?.document || null,
    getSong = () => null,
    getDAW = () => null,
    getProjectEnd = () => 0,
    getTimeSignatureGridConfig = () => ({
      beatsPerMeasure: 4,
      beatDuration: 0.5,
      measureDuration: 2,
      subdivisionsPerBeat: 4
    }),
    timeToX = time => time * (Number(getDAW()?.pxPerSecond) || 70),
    getTransportPlayhead = () => 0,
    logger = console
  } = {}) {
    const popupIsOpen = () => isOpen(getPopup());
    const popupDocument = () => getDocument(getPopup());

    function getDevicePixelRatio(doc) {
      return Math.max(
        1,
        Number(doc?.defaultView?.devicePixelRatio) ||
          Number(windowRef?.devicePixelRatio) ||
          1
      );
    }

    function snapToDevicePixel(value, devicePixelRatio) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 0;
      return Math.round(numeric * devicePixelRatio) / devicePixelRatio;
    }

    function snapCssLength(value, devicePixelRatio) {
      const numeric = Number.parseFloat(value);
      return Number.isFinite(numeric)
        ? snapToDevicePixel(numeric, devicePixelRatio) + 'px'
        : value;
    }

    function installMirrorSyncLoop(doc) {
      if (!doc?.body) return;
      const script = doc.createElement('script');
      script.textContent =
        '(function(){if(window.__akordMirrorLoopStarted)return;' +
        'window.__akordMirrorLoopStarted=true;' +
        'function frame(){try{window._syncMirrorTimeline?.()}catch(_){}' +
        'if(!window.closed)window.requestAnimationFrame(frame)}frame()})();';
      doc.body.appendChild(script);
    }

    function render() {
      try {
        if (!popupIsOpen()) return;
        const doc = popupDocument();
        if (!doc) return;

        const targetDiv = doc.getElementById('playerChordMirror');
        const sourceTimeline = documentRef?.querySelector?.(
          '.track-lane.chord-lane'
        );
        if (!targetDiv || !sourceTimeline || sourceTimeline.children.length === 0) {
          return;
        }

        const clone = sourceTimeline.cloneNode(true);
        targetDiv.innerHTML = '';
        targetDiv.appendChild(clone);
        targetDiv.style.direction = 'ltr';
        targetDiv.style.overflow = 'hidden';
        targetDiv.style.position = 'relative';
        targetDiv.style.backgroundColor = '#0D1017';

        const mirrorHeight = targetDiv.clientHeight || 90;
        const rulerHeight = 18;
        const devicePixelRatio = getDevicePixelRatio(doc);
        clone.style.direction = 'ltr';
        clone.style.position = 'absolute';
        clone.style.top = rulerHeight + 'px';
        clone.style.left = '0';
        clone.style.width = sourceTimeline.scrollWidth + 'px';
        clone.style.height = mirrorHeight - rulerHeight + 'px';
        clone.style.display = 'block';
        clone.style.backgroundColor = 'transparent';
        clone.style.willChange = 'transform';
        clone.style.backfaceVisibility = 'hidden';
        clone.style.transform = 'translateX(0px)';

        let ruler = targetDiv.querySelector('.mirror-ruler');
        if (!ruler) {
          ruler = doc.createElement('div');
          ruler.className = 'mirror-ruler';
          ruler.style.cssText =
            'position:absolute;top:0;left:0;height:' + rulerHeight +
            'px;width:100%;overflow:hidden;z-index:5;pointer-events:none;' +
            'background:rgba(13,16,23,0.95);border-bottom:1px solid rgba(255,255,255,0.1);';
          targetDiv.appendChild(ruler);
        }

        let rulerInner = ruler.querySelector('.mirror-ruler-inner');
        if (!rulerInner) {
          rulerInner = doc.createElement('div');
          rulerInner.className = 'mirror-ruler-inner';
          rulerInner.style.cssText =
            'position:absolute;top:0;height:100%;white-space:nowrap;font-size:8px;' +
            'color:rgba(255,255,255,0.5);font-family:JetBrains Mono,monospace;' +
            'line-height:' + rulerHeight + 'px;will-change:transform;' +
            'backface-visibility:hidden;';
          ruler.appendChild(rulerInner);
        }
        rulerInner.innerHTML = '';
        rulerInner.style.width = sourceTimeline.scrollWidth + 'px';

        const song = getSong() || {};
        const length = getProjectEnd();
        const bpm = song.tempo || 120;
        const signature = song.timeSignature || '4/4';
        const grid = getTimeSignatureGridConfig(signature, bpm);
        const beatsPerBar = grid.beatsPerMeasure;
        const beatDuration = grid.beatDuration;
        const barDuration = grid.measureDuration;
        const pxPerSecond = Number(getDAW()?.pxPerSecond) || 70;
        targetDiv.dataset.mirrorPps = String(pxPerSecond);
        const pxPerBar = barDuration * pxPerSecond;
        const barStep =
          pxPerBar > 120 ? 1 :
          pxPerBar > 60 ? 2 :
          pxPerBar > 30 ? 4 :
          pxPerBar > 15 ? 8 :
          pxPerBar > 8 ? 16 : 32;

        for (let bar = 1; bar * barDuration <= length; bar += 1) {
          if ((bar - 1) % barStep !== 0) continue;
          const label = doc.createElement('span');
          label.className = 'mirror-ruler-label';
          label.style.cssText =
            'position:absolute;left:' +
            snapToDevicePixel(
              timeToX((bar - 1) * barDuration),
              devicePixelRatio
            ) +
            'px;top:0;padding-left:2px;';
          label.textContent = bar;
          rulerInner.appendChild(label);
        }

        let gridCanvas = clone.querySelector('canvas.lane-grid');
        if (!gridCanvas) {
          gridCanvas = doc.createElement('canvas');
          gridCanvas.className = 'lane-grid';
          clone.insertBefore(gridCanvas, clone.firstChild);
        }
        gridCanvas.style.cssText =
          'position:absolute;top:0;left:0;pointer-events:none;z-index:0;display:block;';
        gridCanvas.width = Math.min(Math.ceil(sourceTimeline.scrollWidth), 20000);
        gridCanvas.height = mirrorHeight - rulerHeight;
        gridCanvas.style.width = gridCanvas.width + 'px';
        gridCanvas.style.height = mirrorHeight - rulerHeight + 'px';

        const context = gridCanvas.getContext('2d');
        context.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        context.strokeStyle = 'rgba(255,255,255,0.12)';
        context.lineWidth = 1;
        let barCount = 0;
        for (
          let bar = 1;
          bar * barDuration <= length && barCount < 500;
          bar += 1
        ) {
          const x = Math.round(bar * barDuration * pxPerSecond) + 0.5;
          if (x > gridCanvas.width) break;
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x, gridCanvas.height);
          context.stroke();
          barCount += 1;
        }

        if (pxPerSecond > 10) {
          context.strokeStyle = 'rgba(255,255,255,0.04)';
          let beatCount = 0;
          for (
            let beat = 0;
            beat * beatDuration <= length && beatCount < 500;
            beat += 1
          ) {
            if (beat % beatsPerBar === 0) continue;
            const x = Math.round(beat * beatDuration * pxPerSecond) + 0.5;
            if (x > gridCanvas.width) break;
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, gridCanvas.height);
            context.stroke();
            beatCount += 1;
          }
        }

        if (pxPerSecond > 40) {
          const subBeatDuration = beatDuration / grid.subdivisionsPerBeat;
          context.strokeStyle = 'rgba(255,255,255,0.02)';
          let subBeatCount = 0;
          for (
            let subBeat = 0;
            subBeat * subBeatDuration <= length && subBeatCount < 500;
            subBeat += 1
          ) {
            if (subBeat % grid.subdivisionsPerBeat === 0) continue;
            const x = Math.round(subBeat * subBeatDuration * pxPerSecond) + 0.5;
            if (x > gridCanvas.width) break;
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, gridCanvas.height);
            context.stroke();
            subBeatCount += 1;
          }
        }

        let playhead = targetDiv.querySelector('.mirror-playhead');
        if (!playhead) {
          playhead = doc.createElement('div');
          playhead.className = 'mirror-playhead';
          playhead.style.cssText =
            'position:absolute;top:0;bottom:0;width:2px;background:#00F2FE;' +
            'z-index:100;box-shadow:0 0 10px rgba(0,242,254,0.8);' +
            'pointer-events:none;left:50%;';
          targetDiv.appendChild(playhead);
        } else {
          playhead.style.left = '50%';
        }

        const sourceClips = sourceTimeline.children;
        const cloneClips = clone.children;
        for (let index = 0; index < cloneClips.length; index += 1) {
          const clip = cloneClips[index];
          const sourceClip = sourceClips[index];

          if (clip.classList.contains('mirror-playhead')) continue;
          if (clip.tagName === 'CANVAS') continue;
          if (clip.classList.contains('lane-resize-handle')) {
            clip.style.display = 'none';
            continue;
          }

          if ((clip.textContent || '').trim() === '') {
            clip.style.display = 'none';
            continue;
          }

          if (sourceClip) {
            const styles = windowRef.getComputedStyle?.(sourceClip) || {};
            clip.style.left = styles.left !== 'auto'
              ? snapCssLength(styles.left, devicePixelRatio)
              : '0px';
            clip.style.right = styles.right !== 'auto' ? styles.right : 'auto';
            clip.style.width = snapCssLength(styles.width, devicePixelRatio);
            // The mirror owns the horizontal motion. Nested transforms from
            // the source lane make text shimmer while the clone is moving.
            clip.style.transform = 'none';
          }

          clip.style.position = 'absolute';
          clip.style.display = 'flex';
          clip.style.alignItems = 'center';
          clip.style.justifyContent = 'center';
          clip.style.boxSizing = 'border-box';
          clip.style.direction = 'ltr';
          clip.style.opacity = '1';
          clip.style.visibility = 'visible';
          clip.style.background = 'linear-gradient(180deg, #4a2b5e, #2d1b3a)';
          clip.style.color = '#fff';
          clip.style.border = '1px solid #9F7AEA';
          clip.style.borderRadius = '7px';
          clip.style.padding = '0 10px';
          clip.style.fontSize = '18px';
          clip.style.fontWeight = '800';
          clip.style.fontFamily = "'JetBrains Mono', monospace";
          clip.style.height = Math.max(28, mirrorHeight - 24) + 'px';
          clip.style.top =
            Math.max(6, (mirrorHeight - parseInt(clip.style.height)) / 2) + 'px';
          clip.style.boxShadow = '0 1px 3px rgba(0,0,0,0.45)';
          clip.style.textRendering = 'geometricPrecision';
          clip.style.webkitFontSmoothing = 'antialiased';
          clip.style.pointerEvents = 'none';
          clip.style.overflow = 'hidden';

          const inner = clip.querySelector('span, div');
          if (inner) {
            inner.style.direction = 'ltr';
            inner.style.color = '#fff';
            inner.style.fontSize = '18px';
            inner.style.fontWeight = '800';
            inner.style.fontFamily = "'JetBrains Mono', monospace";
            inner.style.display = 'inline';
            inner.style.textRendering = 'geometricPrecision';
            inner.style.webkitFontSmoothing = 'antialiased';
          }
        }

        targetDiv.scrollLeft = 0;
        start();
      } catch (error) {
        logger?.error?.('Mirror Error:', error);
      }
    }

    function syncFrame() {
      try {
        if (!popupIsOpen()) return;
        const doc = popupDocument();
        const targetDiv = doc?.getElementById?.('playerChordMirror');
        if (!targetDiv) return;

        const daw = getDAW() || {};
        const time =
          daw.isPlaying && typeof getTransportPlayhead === 'function'
            ? getTransportPlayhead()
            : Number.isFinite(daw.playhead)
              ? daw.playhead
              : 0;
        const pxPerSecond = Math.max(1, Number(daw.pxPerSecond) || 70);
        if (targetDiv.dataset.mirrorPps !== String(pxPerSecond)) {
          render();
          return;
        }

        const playhead = targetDiv.querySelector('.mirror-playhead');
        const clone = targetDiv.querySelector('.track-lane, [class*="chord"]');
        if (!playhead || !clone) return;

        const rawOffset =
          targetDiv.clientWidth / 2 - Math.max(0, time) * pxPerSecond;
        const offset = snapToDevicePixel(
          rawOffset,
          getDevicePixelRatio(doc)
        );
        const cloneTransform = 'translateX(' + offset + 'px)';
        if (clone.style.transform !== cloneTransform) {
          clone.style.transform = cloneTransform;
        }
        const rulerInner = targetDiv.querySelector('.mirror-ruler-inner');
        if (rulerInner) {
          const rulerTransform = 'translateX(' + offset + 'px)';
          if (rulerInner.style.transform !== rulerTransform) {
            rulerInner.style.transform = rulerTransform;
          }
        }
      } catch (_) {}
    }

    function start() {
      if (!popupIsOpen()) return false;
      const doc = popupDocument();
      if (!doc) return false;
      bridge?.set?.(getPopup(), '_syncMirrorTimeline', syncFrame);
      syncFrame();
      installMirrorSyncLoop(doc);
      return true;
    }

    return Object.freeze({
      render,
      start,
      syncFrame,
      installMirrorSyncLoop
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorPopupTimelineSyncService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
