/**
 * ScoreRenderer
 *
 * MusicXML engraving boundary for Live Score.  Written notation is rendered
 * exclusively by OpenSheetMusicDisplay (OSMD); this module intentionally does
 * not contain a hand-written SVG/Canvas note renderer or a fallback renderer.
 *
 * The DOM contract is:
 *
 *   .score-viewer-root
 *     .score-osmd-layer       OSMD's SVG output only
 *     .score-chords-overlay   optional chord labels
 *     .score-playhead-overlay timing/playhead layer only
 */
(function attachScoreRenderer(globalScope) {
  'use strict';

  const instances = new WeakMap();

  function number(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getOsmdConstructor() {
    return globalScope.opensheetmusicdisplay?.OpenSheetMusicDisplay ||
      globalScope.OpenSheetMusicDisplay ||
      null;
  }

  function getOsmdPackage() {
    return globalScope.opensheetmusicdisplay || null;
  }

  function sourceText(score) {
    const source = score?.source?.data;
    if (typeof source === 'string' && source.trim()) return source;
    if (typeof Document !== 'undefined' && source instanceof Document) {
      return new XMLSerializer().serializeToString(source);
    }
    return '';
  }

  /**
   * OSMD can render a complete score, but a performer view must contain only
   * that part.  Filtering is performed on the original MusicXML document, not
   * by rebuilding notes from the normalized model.
   */
  function selectPartXml(xmlText, partId) {
    if (!partId || typeof DOMParser === 'undefined' ||
        typeof XMLSerializer === 'undefined') return xmlText;
    const documentNode = new DOMParser().parseFromString(xmlText, 'application/xml');
    const parseError = documentNode.querySelector('parsererror');
    if (parseError) throw new Error('MusicXML سند قابل خواندن نیست.');

    const wanted = String(partId);
    const parts = Array.from(documentNode.querySelectorAll('part'));
    const partList = documentNode.querySelector('part-list');
    const scoreParts = partList ? Array.from(partList.children) : [];
    parts.forEach(part => {
      if (String(part.getAttribute('id') || '') !== wanted) part.remove();
    });
    scoreParts.forEach(scorePart => {
      if (scorePart.getAttribute && String(scorePart.getAttribute('id') || '') !== wanted) {
        scorePart.remove();
      }
    });
    // The actual part list was already filtered, so this check deliberately
    // avoids a dynamic CSS selector (some embedded WebViews lack CSS.escape).
    const stillThere = Array.from(documentNode.getElementsByTagNameNS
      ? documentNode.getElementsByTagNameNS('*', 'part')
      : documentNode.querySelectorAll('part'))
      .some(part => String(part.getAttribute('id') || '') === wanted);
    if (!stillThere) throw new Error(`پارت MusicXML پیدا نشد: ${wanted}`);
    return new XMLSerializer().serializeToString(documentNode);
  }

  function ensureLayers(root) {
    if (!root || !root.ownerDocument) throw new TypeError('ScoreRenderer به یک container نیاز دارد.');
    root.classList.add('score-viewer-root');
    const directChild = className => Array.from(root.children || [])
      .find(child => child.classList?.contains(className)) || null;
    let osmdLayer = directChild('score-osmd-layer');
    let chordLayer = directChild('score-chords-overlay');
    let playheadLayer = directChild('score-playhead-overlay');
    if (!osmdLayer || !chordLayer || !playheadLayer) {
      root.replaceChildren();
      osmdLayer = root.ownerDocument.createElement('div');
      chordLayer = root.ownerDocument.createElement('div');
      playheadLayer = root.ownerDocument.createElement('div');
      osmdLayer.className = 'score-osmd-layer';
      chordLayer.className = 'score-chords-overlay';
      playheadLayer.className = 'score-playhead-overlay';
      root.append(osmdLayer, chordLayer, playheadLayer);
    }
    return { osmdLayer, chordLayer, playheadLayer };
  }

  function pageSize(osmd) {
    const pages = osmd?.GraphicSheet?.MusicPages || [];
    const size = pages[0]?.PositionAndShape?.Size;
    return {
      width: Math.max(1, number(size?.width, 1000)),
      height: Math.max(1, number(size?.height, 700))
    };
  }

  function ensurePlayheadOverlay(root, osmd) {
    const layers = ensureLayers(root);
    const size = pageSize(osmd);
    let svg = layers.playheadLayer.querySelector('svg[data-score-playhead-layer]');
    if (!svg) {
      svg = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('data-score-playhead-layer', 'true');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('preserveAspectRatio', 'none');
      const line = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('data-score-playhead', 'true');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      line.setAttribute('x1', '0');
      line.setAttribute('x2', '0');
      line.setAttribute('y1', '0');
      line.setAttribute('y2', String(size.height));
      svg.appendChild(line);
      layers.playheadLayer.replaceChildren(svg);
    }
    svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
    svg.setAttribute('width', String(size.width));
    svg.setAttribute('height', String(size.height));
    const line = svg.querySelector('[data-score-playhead]');
    if (line) line.setAttribute('y2', String(size.height));
    return { ...layers, size, line };
  }

  function currentSystemBounds(osmd, system) {
    const staffLines = system?.StaffLines || [];
    const boxes = staffLines.map(staff => staff?.PositionAndShape).filter(Boolean);
    const top = boxes.reduce((value, box) => Math.min(value, number(box?.AbsolutePosition?.y, value)), Infinity);
    const bottom = boxes.reduce((value, box) =>
      Math.max(value, number(box?.AbsolutePosition?.y, value) + number(box?.Size?.height, 0)), 0);
    const fallback = pageSize(osmd);
    return {
      yTop: Number.isFinite(top) ? top : 0,
      yBottom: bottom > 0 ? bottom : fallback.height,
      systemIndex: number(system?.Id, 0)
    };
  }

  function fractionFor(osmd, tick, score) {
    const Fraction = getOsmdPackage()?.Fraction;
    const ppqn = Math.max(1, number(score?.ticksPerQuarter, 480));
    if (typeof Fraction !== 'function') return null;
    return new Fraction(Math.max(0, Math.round(number(tick))), ppqn);
  }

  function positionFor(instance, tick) {
    const { osmd, score } = instance;
    const graphic = osmd?.GraphicSheet;
    const fraction = fractionFor(osmd, tick, score);
    if (!graphic || !fraction) {
      return { tick, x: 0, yTop: 0, yBottom: pageSize(osmd).height, systemIndex: 0, progress: 0 };
    }
    try {
      const result = graphic.calculateXPositionFromTimestamp(fraction);
      const x = number(result?.[0], 0);
      const system = result?.[1] || graphic.MusicPages?.[0]?.MusicSystems?.[0];
      const bounds = currentSystemBounds(osmd, system);
      return { tick, x, ...bounds };
    } catch (_) {
      return { tick, x: 0, yTop: 0, yBottom: pageSize(osmd).height, systemIndex: 0, progress: 0 };
    }
  }

  function contentKey(xml, partId, zoom) {
    return `${String(partId || '')}|${number(zoom, 1)}|${xml}`;
  }

  function osmdContent(xml) {
    if (typeof DOMParser === 'undefined') return xml;
    const documentNode = new DOMParser().parseFromString(xml, 'application/xml');
    if (documentNode.querySelector('parsererror')) {
      throw new Error('MusicXML سند قابل خواندن نیست.');
    }
    return documentNode;
  }

  async function renderInto(root, score, partId, options = {}) {
    const xml = selectPartXml(sourceText(score), partId || score?.activePartId);
    if (!xml) throw new Error('MusicXML منبع اصلی برای OSMD در پروژه موجود نیست.');
    const OSMD = getOsmdConstructor();
    if (typeof OSMD !== 'function') {
      throw new Error('OpenSheetMusicDisplay بارگذاری نشده است.');
    }

    const layers = ensureLayers(root);
    const zoom = clamp(number(options.zoom, 1), 0.25, 4);
    const key = contentKey(xml, partId || score?.activePartId, zoom);
    let instance = instances.get(root);
    if (!instance || instance.osmdLayer !== layers.osmdLayer) {
      instance = { root, osmdLayer: layers.osmdLayer, renderToken: 0, osmd: null, key: '' };
      instances.set(root, instance);
    }
    if (instance.key === key && instance.osmd) {
      ensurePlayheadOverlay(root, instance.osmd);
      return instance;
    }

    const token = ++instance.renderToken;
    instance.osmdLayer.replaceChildren();
    const osmd = new OSMD(instance.osmdLayer, {
      autoResize: false,
      drawTitle: false,
      drawingParameters: 'compacttight',
      drawPartNames: true,
      drawMeasureNumbers: true,
      drawMetronomeMarks: true,
      followCursor: false,
      backend: 'svg'
    });
    // Passing a parsed XML Document prevents OSMD from treating the XML text
    // as a URL (which is especially important in Electron and offline mode).
    await osmd.load(osmdContent(xml));
    if (token !== instance.renderToken) return instance;
    osmd.zoom = zoom;
    osmd.render();
    if (typeof osmd.enableOrDisableCursors === 'function') osmd.enableOrDisableCursors(false);
    osmd.cursor?.reset?.();
    osmd.cursor?.hide?.();

    instance.osmd = osmd;
    instance.score = score;
    instance.partId = partId || score?.activePartId || null;
    instance.key = key;
    instance.layers = ensurePlayheadOverlay(root, osmd);
    root.dataset.scoreEngine = 'opensheetmusicdisplay';
    root.dataset.scorePartId = String(instance.partId || '');
    root.dataset.scoreReady = 'true';
    return instance;
  }

  function getPlayheadPosition(score, partId, seconds, options = {}) {
    const root = options.root || options.viewer || null;
    const instance = root ? instances.get(root) : null;
    const clock = options.clock || globalScope.ScorePlayheadService?.create?.({
      midiScore: options.midiScore || null,
      musicXmlScore: score
    });
    const tick = Number.isFinite(Number(options.activeTick))
      ? Number(options.activeTick)
      : (clock?.secondsToTick?.(seconds) || 0);
    if (instance?.osmd) return positionFor(instance, tick);
    return { tick, x: 0, yTop: 0, yBottom: 0, systemIndex: 0 };
  }

  function updatePlayhead(root, position) {
    const instance = root ? instances.get(root) : null;
    const line = instance?.layers?.line || root?.querySelector?.('[data-score-playhead]');
    if (!line) return false;
    line.setAttribute('x1', String(number(position?.x, 0)));
    line.setAttribute('x2', String(number(position?.x, 0)));
    line.setAttribute('y1', String(number(position?.yTop, 0)));
    line.setAttribute('y2', String(number(position?.yBottom, instance?.layers?.size?.height || 0)));
    line.dataset.system = String(number(position?.systemIndex, 0));
    return true;
  }

  function setZoom(root, zoom) {
    const instance = root ? instances.get(root) : null;
    if (!instance?.osmd) return Promise.resolve(null);
    instance.osmd.zoom = clamp(number(zoom, 1), 0.25, 4);
    instance.osmd.render();
    instance.layers = ensurePlayheadOverlay(root, instance.osmd);
    instance.key = '';
    return Promise.resolve(instance);
  }

  function clearCache(root) {
    if (root) {
      const instance = instances.get(root);
      instance?.osmd?.clear?.();
      instances.delete(root);
      return;
    }
    // WeakMap is intentionally not enumerable; callers can clear by replacing
    // the score container, which also prevents stale OSMD instances.
  }

  const api = Object.freeze({
    engine: 'opensheetmusicdisplay',
    renderInto,
    getPlayheadPosition,
    updatePlayhead,
    setZoom,
    clearCache
  });

  globalScope.ScoreRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
