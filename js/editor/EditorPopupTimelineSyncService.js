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
    getTransportClockSnapshot = null,
    logger = console
  } = {}) {
    const popupIsOpen = () => isOpen(getPopup());
    const popupDocument = () => getDocument(getPopup());

    function getTimingKey() {
      const song = getSong() || {};
      const bpm = Number(song.tempo) || 120;
      const signature = String(song.timeSignature || '4/4');
      return signature + ':' + bpm;
    }

    function timeToPixels(time, fallbackPxPerSecond) {
      const numericTime = Number(time);
      if (!Number.isFinite(numericTime)) return 0;
      const projected = Number(
        typeof timeToX === 'function' ? timeToX(numericTime) : NaN
      );
      return Number.isFinite(projected)
        ? projected
        : numericTime * fallbackPxPerSecond;
    }

    function formatCssPixel(value) {
      const numeric = Number(value);
      return Number.isFinite(numeric)
        ? String(Number(numeric.toFixed(4)))
        : '0';
    }

    function getTransportTime(daw) {
      if (!daw?.isPlaying) {
        return Number.isFinite(daw?.playhead) ? Math.max(0, daw.playhead) : 0;
      }

      if (typeof getTransportClockSnapshot === 'function') {
        const snapshot = getTransportClockSnapshot({ visual: false });
        const rawTime = Number(snapshot?.timelineTime);
        if (Number.isFinite(rawTime)) return Math.max(0, rawTime);
      }

      if (typeof getTransportPlayhead === 'function') {
        const rawTime = Number(getTransportPlayhead());
        if (Number.isFinite(rawTime)) return Math.max(0, rawTime);
      }

      return Number.isFinite(daw?.playhead) ? Math.max(0, daw.playhead) : 0;
    }

    function getMirrorClipModels(sourceTimeline, daw, pxPerSecond) {
      const sourceElements = Array.from(
        sourceTimeline?.querySelectorAll?.('.chord-clip') || []
      );
      const sourceClips = Array.isArray(daw?.clips)
        ? daw.clips.filter(clip => clip?.type === 'chord')
        : [];
      const clipsById = new Map(
        sourceClips
          .filter(clip => clip?.id != null)
          .map(clip => [String(clip.id), clip])
      );

      const toModel = (sourceElement, clip, index) => {
        const styles = sourceElement
          ? windowRef.getComputedStyle?.(sourceElement) || {}
          : {};
        const domLeft = Number.parseFloat(styles.left);
        const domWidth = Number.parseFloat(styles.width);
        const dataStart = Number(clip?.start);
        const dataDuration = Number(clip?.duration);
        const start = Number.isFinite(dataStart)
          ? Math.max(0, dataStart)
          : Number.isFinite(domLeft)
            ? Math.max(0, domLeft / pxPerSecond)
            : 0;
        const duration = Number.isFinite(dataDuration)
          ? Math.max(0.05, dataDuration)
          : Number.isFinite(domWidth)
            ? Math.max(0.05, domWidth / pxPerSecond)
            : 1;
        const sourceName =
          sourceElement?.querySelector?.('span')?.textContent ||
          sourceElement?.textContent ||
          '';
        const name = String(clip?.name || sourceName).trim();
        if (!name) return null;

        return {
          id: String(clip?.id || sourceElement?.dataset?.clipId || index),
          name,
          start,
          duration,
          color: clip?.color || styles.borderColor || '#9F7AEA'
        };
      };

      if (sourceElements.length > 0) {
        return sourceElements
          .map((element, index) =>
            toModel(
              element,
              clipsById.get(String(element.dataset?.clipId)) ||
                sourceClips[index],
              index
            )
          )
          .filter(Boolean);
      }

      return sourceClips
        .map((clip, index) => toModel(null, clip, index))
        .filter(Boolean);
    }

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

    let mirrorSyncTimer = null;
    let mirrorSyncPopup = null;

    function stopMirrorSyncTimer() {
      if (mirrorSyncTimer !== null) {
        globalScope.clearInterval?.(mirrorSyncTimer);
      }
      mirrorSyncTimer = null;
      mirrorSyncPopup = null;
    }

    function installMirrorSyncLoop(doc) {
      if (!doc?.body) return;
      const script = doc.createElement('script');
      script.textContent =
        '(function(){if(window.__akordMirrorLoopStarted)return;' +
        'window.__akordMirrorLoopStarted=true;' +
        'let state=null;' +
        'let host=null,viewport=null;' +
        'function refreshNodes(){' +
        'host=document.getElementById("playerChordMirror");' +
        'viewport=host?.querySelector(".mirror-viewport")||null;' +
        '}' +
        'window.addEventListener("message",function(event){' +
        'const data=event?.data;' +
        'if(!data||data.type!=="akord-mirror-sync")return;' +
        'const now=performance.now();' +
        'const incomingTime=Math.max(0,Number(data.time)||0);' +
        'const previousTime=state&&state.isPlaying' +
        '?Math.max(0,(Number(state.time)||0)+' +
        'Math.max(0,(now-state.receivedAt)/1000)):incomingTime;' +
        'const discontinuity=!state||!state.isPlaying||!data.isPlaying||' +
        'Math.abs(incomingTime-previousTime)>0.75;' +
        'state={' +
        'time:discontinuity?incomingTime:Math.max(incomingTime,previousTime),' +
        'isPlaying:Boolean(data.isPlaying),' +
        'receivedAt:now,' +
        'duration:Number(data.duration)||0,' +
        'pxPerSecond:Number(data.pxPerSecond)||70,' +
        'width:Number(data.width)||0,' +
        'maxScroll:Math.max(0,Number(data.maxScroll)||0)' +
        '};' +
        '});' +
        'function paint(now){' +
        'if(!state)return;' +
        'if(!host||!host.isConnected||!viewport||!viewport.isConnected)' +
        'refreshNodes();' +
        'if(!viewport)return;' +
        'const elapsed=state.isPlaying?Math.max(0,(now-state.receivedAt)/1000):0;' +
        'const time=Math.max(0,Math.min(Number(state.duration)||Infinity,' +
        '((Number(state.time)||0)+elapsed)));' +
        'const width=Number(state.width)||Number(host.clientWidth)||0;' +
        'const pps=Math.max(1,Number(state.pxPerSecond)||70);' +
        'const maxScroll=Math.max(0,Number(state.maxScroll)||0);' +
        'const scrollLeft=Math.max(0,Math.min(maxScroll,time*pps));' +
        'if(Math.abs(Number(viewport.scrollLeft)-scrollLeft)>0.01)' +
        'viewport.scrollLeft=scrollLeft;' +
        '}' +
        'function frame(now){' +
        'paint(now);' +
        'if(!window.closed)window.requestAnimationFrame(frame)' +
        '}' +
        'refreshNodes();window.requestAnimationFrame(frame)})();';
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
        const bpm = Number(song.tempo) || 120;
        const signature = String(song.timeSignature || '4/4');
        const grid = getTimeSignatureGridConfig(signature, bpm);
        const beatsPerBar = grid.beatsPerMeasure;
        const beatDuration = grid.beatDuration;
        const barDuration = grid.measureDuration;
        const pxPerSecond = Number(getDAW()?.pxPerSecond) || 70;
        targetDiv.dataset.mirrorPps = String(pxPerSecond);
        targetDiv.dataset.mirrorTiming = getTimingKey();
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
              timeToPixels((bar - 1) * barDuration, pxPerSecond),
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
          const x =
            Math.round(
              timeToPixels(bar * barDuration, pxPerSecond)
            ) + 0.5;
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
            const x =
              Math.round(
                timeToPixels(beat * beatDuration, pxPerSecond)
              ) + 0.5;
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
            const x =
              Math.round(
                timeToPixels(subBeat * subBeatDuration, pxPerSecond)
              ) + 0.5;
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

    function renderLightweight() {
      try {
        if (!popupIsOpen()) return;
        const doc = popupDocument();
        const targetDiv = doc?.getElementById?.('playerChordMirror');
        const sourceTimeline = documentRef?.querySelector?.(
          '.track-lane.chord-lane'
        );
        if (!doc || !targetDiv || !sourceTimeline) return;

        const daw = getDAW() || {};
        const mirrorWidth = Number(targetDiv.clientWidth) || 0;
        const mirrorHeight = Math.max(
          40,
          Number(targetDiv.clientHeight) || 90
        );
        const rulerHeight = 18;
        const sceneHeight = Math.max(1, mirrorHeight - rulerHeight);
        const pxPerSecond = Math.max(
          1,
          Number(daw.pxPerSecond) || 70
        );
        const length = Math.max(0, Number(getProjectEnd()) || 0);
        const song = getSong() || {};
        const bpm = Number(song.tempo) || 120;
        const signature = String(song.timeSignature || '4/4');
        const grid = getTimeSignatureGridConfig(signature, bpm) || {};
        const beatsPerBar = Math.max(
          1,
          Number(grid.beatsPerMeasure) || 4
        );
        const beatDuration = Math.max(
          0.001,
          Number(grid.beatDuration) || 0.5
        );
        const barDuration = Math.max(
          beatDuration,
          Number(grid.measureDuration) || beatsPerBar * beatDuration
        );
        const originPx = Math.max(1, mirrorWidth / 2);
        const sceneWidth = Math.max(
          1,
          mirrorWidth * 2,
          Number(sourceTimeline.scrollWidth) || 0,
          Math.ceil(timeToPixels(length, pxPerSecond))
        ) + mirrorWidth;
        const clips = getMirrorClipModels(
          sourceTimeline,
          daw,
          pxPerSecond
        );

        targetDiv.innerHTML = '';
        targetDiv.style.direction = 'ltr';
        targetDiv.style.position = 'relative';
        targetDiv.style.overflow = 'hidden';
        targetDiv.style.backgroundColor = '#0D1017';
        targetDiv.dataset.mirrorPps = String(pxPerSecond);
        targetDiv.dataset.mirrorTiming = getTimingKey();
        targetDiv.dataset.mirrorGeometry =
          String(mirrorWidth) + ':' + String(Number(targetDiv.clientHeight) || 0);
        targetDiv.dataset.mirrorRenderer = 'native-scroll-v1';

        const ruler = doc.createElement('div');
        ruler.className = 'mirror-ruler';
        ruler.style.cssText =
          'position:absolute;top:0;left:0;height:' + rulerHeight +
          'px;width:' + sceneWidth + 'px;overflow:hidden;z-index:5;pointer-events:none;' +
          'background:rgba(13,16,23,0.95);border-bottom:1px solid rgba(255,255,255,0.1);';

        const rulerInner = doc.createElement('div');
        rulerInner.className = 'mirror-ruler-inner';
        rulerInner.style.cssText =
          'position:absolute;top:0;left:0;height:100%;width:' +
          sceneWidth +
          'px;white-space:nowrap;font-size:8px;color:rgba(255,255,255,0.5);' +
          "font-family:'JetBrains Mono',monospace;line-height:" +
          rulerHeight + 'px;';
        ruler.appendChild(rulerInner);

        const viewport = doc.createElement('div');
        viewport.className = 'mirror-viewport';
        viewport.style.cssText =
          'position:absolute;top:0;left:0;width:100%;height:100%;' +
          'overflow:hidden;overscroll-behavior:none;will-change:scroll-position;';

        const content = doc.createElement('div');
        content.className = 'mirror-content';
        content.style.cssText =
          'position:relative;width:' + sceneWidth + 'px;height:100%;';
        viewport.appendChild(content);

        const scene = doc.createElement('div');
        scene.className = 'mirror-scene';
        scene.style.cssText =
          'position:absolute;top:' + rulerHeight +
          'px;left:0;width:' + sceneWidth +
          'px;height:' + sceneHeight + 'px;overflow:hidden;';

        const gridLayer = doc.createElement('div');
        gridLayer.className = 'mirror-grid';
        gridLayer.style.cssText =
          'position:absolute;top:0;left:0;width:' + sceneWidth +
          'px;height:100%;pointer-events:none;';

        const clipsLayer = doc.createElement('div');
        clipsLayer.className = 'mirror-clips';
        clipsLayer.style.cssText =
          'position:absolute;top:0;left:0;width:' + sceneWidth +
          'px;height:100%;pointer-events:none;';

        const appendGridLine = (className, time, color) => {
          const line = doc.createElement('div');
          line.className = className;
          line.style.cssText =
            'position:absolute;top:0;bottom:0;width:1px;left:' +
            formatCssPixel(originPx + timeToPixels(time, pxPerSecond)) +
            'px;background:' + color + ';pointer-events:none;';
          gridLayer.appendChild(line);
        };

        const pxPerBar = barDuration * pxPerSecond;
        const barStep =
          pxPerBar > 120 ? 1 :
          pxPerBar > 60 ? 2 :
          pxPerBar > 30 ? 4 :
          pxPerBar > 15 ? 8 :
          pxPerBar > 8 ? 16 : 32;
        const barCount = Math.min(
          500,
          Math.floor(length / barDuration + 1e-9) + 1
        );

        for (let bar = 0; bar < barCount; bar += 1) {
          const barTime = bar * barDuration;
          appendGridLine(
            'mirror-bar-line',
            barTime,
            'rgba(255,255,255,0.13)'
          );
          if (bar % barStep === 0) {
            const label = doc.createElement('span');
            label.className = 'mirror-ruler-label';
            label.style.cssText =
              'position:absolute;left:' +
              formatCssPixel(originPx + timeToPixels(barTime, pxPerSecond)) +
              'px;top:0;padding-left:3px;color:rgba(255,255,255,0.55);' +
              "font:8px/18px 'JetBrains Mono',monospace;";
            label.textContent = String(bar + 1);
            rulerInner.appendChild(label);
          }

          for (let beat = 1; beat < beatsPerBar; beat += 1) {
            const beatTime = barTime + beat * beatDuration;
            if (beatTime > length + 1e-9) break;
            appendGridLine(
              'mirror-beat-line',
              beatTime,
              'rgba(255,255,255,0.045)'
            );
          }
        }

        const clipHeight = Math.max(28, sceneHeight - 12);
        const clipTop = Math.max(6, (sceneHeight - clipHeight) / 2);
        clips.forEach(clip => {
          const clipElement = doc.createElement('div');
          const color = /^#[0-9a-f]{6}$/i.test(clip.color)
            ? clip.color
            : '#9F7AEA';
          clipElement.className = 'mirror-chord';
          clipElement.dataset.clipId = clip.id;
          clipElement.style.cssText =
            'position:absolute;left:' +
            formatCssPixel(originPx + timeToPixels(clip.start, pxPerSecond)) +
            'px;top:' + clipTop +
            'px;width:' +
            formatCssPixel(
              Math.max(30, timeToPixels(clip.duration, pxPerSecond))
            ) +
            'px;height:' + clipHeight +
            'px;display:flex;align-items:center;justify-content:center;' +
            'box-sizing:border-box;padding:0 9px;overflow:hidden;' +
            'white-space:nowrap;text-overflow:ellipsis;pointer-events:none;' +
            'border:1px solid ' + color + ';border-radius:7px;color:#fff;' +
            'background:linear-gradient(180deg,' + color + 'cc,' +
            color + '66);font:800 18px/1 "JetBrains Mono",monospace;' +
            'text-rendering:geometricPrecision;';
          clipElement.textContent = clip.name;
          clipsLayer.appendChild(clipElement);
        });

        scene.appendChild(gridLayer);
        scene.appendChild(clipsLayer);

        const playhead = doc.createElement('div');
        playhead.className = 'mirror-playhead';
        playhead.style.cssText =
          'position:absolute;top:' + rulerHeight +
          'px;bottom:0;left:50%;width:2px;transform:translateX(-1px);' +
          'background:#00F2FE;z-index:100;box-shadow:0 0 10px rgba(0,242,254,0.8);' +
          'pointer-events:none;';

        content.appendChild(ruler);
        content.appendChild(scene);
        targetDiv.appendChild(viewport);
        targetDiv.appendChild(playhead);
        viewport.scrollLeft = 0;
        start();
      } catch (error) {
        logger?.error?.('Lightweight mirror error:', error);
      }
    }

    function syncFrame() {
      try {
        if (!popupIsOpen()) {
          stopMirrorSyncTimer();
          return;
        }
        const doc = popupDocument();
        const targetDiv = doc?.getElementById?.('playerChordMirror');
        if (!targetDiv) return;

        const daw = getDAW() || {};
        const time = getTransportTime(daw);
        const pxPerSecond = Math.max(1, Number(daw.pxPerSecond) || 70);
        if (
          targetDiv.dataset.mirrorPps !== String(pxPerSecond) ||
          targetDiv.dataset.mirrorTiming !== getTimingKey() ||
          targetDiv.dataset.mirrorRenderer !== 'native-scroll-v1' ||
          targetDiv.dataset.mirrorGeometry !==
            String(Number(targetDiv.clientWidth) || 0) +
              ':' +
              String(Number(targetDiv.clientHeight) || 0)
        ) {
          renderLightweight();
          return;
        }

        const popup = getPopup();
        const viewport = targetDiv.querySelector('.mirror-viewport');
        const mirrorWidth = Number(targetDiv.clientWidth) || 0;
        const mirrorState = {
          time: Math.max(0, Number(time) || 0),
          isPlaying: Boolean(daw.isPlaying),
          duration: Math.max(0, Number(getProjectEnd()) || 0),
          pxPerSecond,
          width: mirrorWidth,
          maxScroll: Math.max(
            0,
            Number(viewport?.scrollWidth) - mirrorWidth
          )
        };

        const sent = Boolean(
          bridge?.postMessage?.(
            popup,
            Object.assign({ type: 'akord-mirror-sync' }, mirrorState),
            '*'
          )
        );
        if (!sent) {
          const viewport = targetDiv.querySelector('.mirror-viewport');
          if (viewport) {
            const scrollLeft = Math.max(
              0,
              Math.min(
                Math.max(
                  0,
                  Number(viewport.scrollWidth) -
                    Number(targetDiv.clientWidth)
                ),
                timeToPixels(Math.max(0, time), pxPerSecond)
              )
            );
            if (Math.abs(Number(viewport.scrollLeft) - scrollLeft) > 0.01) {
              viewport.scrollLeft = scrollLeft;
            }
            return;
          }

          const scene = targetDiv.querySelector('.mirror-scene');
          if (!scene) return;
          const rawOffset =
            targetDiv.clientWidth / 2 -
            timeToPixels(Math.max(0, time), pxPerSecond);
          const sceneTransform =
            'translate3d(' + formatCssPixel(rawOffset) + 'px,0,0)';
          if (scene.style.transform !== sceneTransform) {
            scene.style.transform = sceneTransform;
          }
          const rulerInner = targetDiv.querySelector('.mirror-ruler-inner');
          if (rulerInner) {
            const rulerTransform =
              'translate3d(' + formatCssPixel(rawOffset) + 'px,0,0)';
            if (rulerInner.style.transform !== rulerTransform) {
              rulerInner.style.transform = rulerTransform;
            }
          }
        }
      } catch (_) {}
    }

    function startMirrorSyncTimer(popup) {
      if (
        typeof globalScope.setInterval !== 'function' ||
        !popup
      ) {
        return;
      }
      if (mirrorSyncTimer !== null && mirrorSyncPopup === popup) return;
      stopMirrorSyncTimer();
      mirrorSyncPopup = popup;
      mirrorSyncTimer = globalScope.setInterval(() => {
        if (!popupIsOpen() || getPopup() !== popup) {
          stopMirrorSyncTimer();
          return;
        }
        syncFrame();
      }, 50);
      mirrorSyncTimer?.unref?.();
    }

    function start() {
      if (!popupIsOpen()) return false;
      const doc = popupDocument();
      if (!doc) return false;
      installMirrorSyncLoop(doc);
      const popup = getPopup();
      bridge?.set?.(popup, '_syncMirrorTimeline', syncFrame);
      syncFrame();
      startMirrorSyncTimer(popup);
      return true;
    }

    return Object.freeze({
      render: renderLightweight,
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
