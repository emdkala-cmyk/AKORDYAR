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
    const candidates = [
      score?.source?.data,
      score?.sourceText,
      score?.musicXml,
      score?.xml,
      score?.rawMusicXml
    ];
    for (const source of candidates) {
      if (typeof source === 'string' && source.trim()) return source;
      if (source && typeof source === 'object' &&
          typeof source.documentElement !== 'undefined' &&
          typeof XMLSerializer !== 'undefined') {
        try {
          const serialized = new XMLSerializer().serializeToString(source);
          if (serialized.trim()) return serialized;
        } catch (_) {}
      }
    }
    return '';
  }

  function parseXmlDocument(xmlText) {
    if (typeof DOMParser === 'undefined') return null;
    const text = String(xmlText || '').replace(/^\uFEFF/, '').trim();
    if (!text || text[0] !== '<') {
      throw new Error('MusicXML منبع خام معتبر همراه پروژه نیست.');
    }
    const documentNode = new DOMParser().parseFromString(text, 'application/xml');
    const parserErrors = [
      ...Array.from(documentNode?.getElementsByTagName?.('parsererror') || []),
      ...Array.from(documentNode?.getElementsByTagNameNS?.('*', 'parsererror') || [])
    ];
    if (parserErrors.length || !documentNode?.documentElement) {
      throw new Error('MusicXML سند قابل خواندن نیست.');
    }
    return documentNode;
  }

  /**
   * OSMD can render a complete score, but a performer view must contain only
   * that part.  Filtering is performed on the original MusicXML document, not
   * by rebuilding notes from the normalized model.
   */
  function selectPartXml(xmlText, partId) {
    if (!xmlText) return '';
    if (!partId || typeof DOMParser === 'undefined' ||
        typeof XMLSerializer === 'undefined') return xmlText;
    const documentNode = parseXmlDocument(xmlText);

    const wanted = String(partId);
    const allPartNodes = typeof documentNode.getElementsByTagNameNS === 'function'
      ? Array.from(documentNode.getElementsByTagNameNS('*', 'part'))
      : Array.from(documentNode.getElementsByTagName?.('part') || []);
    const parts = allPartNodes.filter(part => {
      const parentName = String(part.parentNode?.localName || part.parentNode?.nodeName || '')
        .toLowerCase().replace(/^.*:/, '');
      return parentName === 'score-partwise' || parentName === 'score-timewise';
    });
    const partList = typeof documentNode.getElementsByTagNameNS === 'function'
      ? Array.from(documentNode.getElementsByTagNameNS('*', 'part-list'))[0]
      : documentNode.getElementsByTagName?.('part-list')?.[0];
    const scoreParts = partList
      ? Array.from(partList.children || []).filter(child =>
          String(child.localName || child.nodeName || '').toLowerCase().replace(/^.*:/, '') === 'score-part')
      : [];
    parts.forEach(part => {
      if (String(part.getAttribute('id') || '') !== wanted) part.remove();
    });
    scoreParts.forEach(scorePart => {
      if (scorePart.getAttribute && String(scorePart.getAttribute('id') || '') !== wanted) {
        scorePart.remove();
      }
    });
    const stillThere = parts.some(part =>
      String(part.getAttribute('id') || '') === wanted &&
      part.parentNode
    );
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
    layers.playheadLayer.style.inset = '0';
    layers.playheadLayer.style.width = 'auto';
    layers.playheadLayer.style.height = 'auto';
    let line = layers.playheadLayer.querySelector('[data-score-playhead]');
    if (!line || line.namespaceURI === 'http://www.w3.org/2000/svg') {
      line = root.ownerDocument.createElement('div');
      line.className = 'score-playhead-indicator';
      line.dataset.scorePlayhead = 'true';
      line.setAttribute('aria-hidden', 'true');
      layers.playheadLayer.replaceChildren(line);
    }
    return { ...layers, size, line };
  }

  function systemOrdinal(osmd, target) {
    let ordinal = 0;
    for (const page of osmd?.GraphicSheet?.MusicPages || []) {
      for (const system of page.MusicSystems || []) {
        if (system === target) return ordinal;
        ordinal += 1;
      }
    }
    return number(target?.Id, 0);
  }

  function currentSystemBounds(osmd, system) {
    const staffLines = system?.StaffLines || [];
    const firstStaff = staffLines[0] || null;
    const lastStaff = staffLines[staffLines.length - 1] || firstStaff;
    const systemY = number(system?.PositionAndShape?.AbsolutePosition?.y, 0);
    // Mirror OSMD Cursor.update() exactly. Relative staff positions and the
    // official StaffHeight describe the visible carrier, without including
    // slurs, dynamics or the whitespace between two systems.
    const top = firstStaff
      ? systemY + number(firstStaff?.PositionAndShape?.RelativePosition?.y, 0)
      : Infinity;
    const bottom = lastStaff
      ? systemY +
        number(lastStaff?.PositionAndShape?.RelativePosition?.y, 0) +
        number(lastStaff?.StaffHeight, 4)
      : 0;
    const fallback = pageSize(osmd);
    return {
      yTop: Number.isFinite(top) ? top : 0,
      yBottom: bottom > 0 ? bottom : fallback.height,
      staffTop: Number.isFinite(top) ? top : 0,
      systemIndex: systemOrdinal(osmd, system),
      pageIndex: (osmd?.GraphicSheet?.MusicPages || [])
        .findIndex(page => (page.MusicSystems || []).includes(system))
    };
  }

  function osmdPointToRoot(instance, x, y) {
    const graphic = instance.osmd?.GraphicSheet;
    const PointF2D = getOsmdPackage()?.PointF2D;
    const rootRect = instance.root?.getBoundingClientRect?.();
    if (graphic?.svgToDom && typeof PointF2D === 'function' && rootRect) {
      try {
        // OSMD's graphical coordinates use 1/10 of an SVG unit.
        const domPoint = graphic.svgToDom(new PointF2D(number(x) * 10, number(y) * 10));
        return {
          x: number(domPoint?.x) - rootRect.left,
          y: number(domPoint?.y) - rootRect.top
        };
      } catch (_) {
        // Fall through to proportional mapping below.
      }
    }
    const page = pageSize(instance.osmd);
    const svg = instance.osmdLayer?.querySelector?.('svg');
    const svgRect = svg?.getBoundingClientRect?.();
    const layerRect = instance.osmdLayer?.getBoundingClientRect?.();
    const width = number(svgRect?.width, layerRect?.width || page.width);
    const height = number(svgRect?.height, layerRect?.height || page.height);
    const left = rootRect && svgRect ? svgRect.left - rootRect.left : 0;
    const top = rootRect && svgRect ? svgRect.top - rootRect.top : 0;
    return {
      x: left + number(x) / page.width * width,
      y: top + number(y) / page.height * height
    };
  }

  function ticksToWholeNotes(tick, score) {
    const ppqn = Math.max(1, number(score?.ticksPerQuarter, 480));
    return Math.max(0, number(tick)) / (ppqn * 4);
  }

  function fractionFor(osmd, tick, score) {
    const Fraction = getOsmdPackage()?.Fraction;
    const ppqn = Math.max(1, number(score?.ticksPerQuarter, 480));
    if (typeof Fraction !== 'function') return null;
    // OSMD timestamps are fractions of a WHOLE note:
    //   quarter note = 1/4, a complete 4/4 measure = 1.
    // MIDI/project ticks are PPQN (ticks per QUARTER note), therefore the
    // denominator must be PPQN * 4. Using PPQN alone made every 4/4 measure
    // pass in one beat.
    return new Fraction(Math.max(0, Math.round(number(tick))), ppqn * 4);
  }

  function sourceTickForPlaybackTick(instance, playbackTick) {
    const model = globalScope.MusicXmlScoreModel;
    const notes = model?.getNotes?.(instance.score, instance.partId) ||
      instance.score?.parts?.find(part => String(part.id) === String(instance.partId))
        ?.measures?.flatMap(measure => measure.notes || []) || [];
    const pairs = notes
      .filter(note => !note?.rest && note?.timing &&
        Number.isFinite(Number(note.timing.startTick)) &&
        Number.isFinite(Number(note.startTick)))
      .map(note => ({
        playback: Number(note.timing.startTick),
        source: Number(note.startTick)
      }))
      .sort((a, b) => a.playback - b.playback);
    if (!pairs.length) return playbackTick;
    if (pairs.length === 1) {
      return pairs[0].source + (playbackTick - pairs[0].playback);
    }
    let left = pairs[0];
    let right = pairs[1];
    if (playbackTick <= left.playback) {
      right = pairs[1];
    } else {
      for (let index = 1; index < pairs.length; index += 1) {
        if (playbackTick <= pairs[index].playback) {
          left = pairs[index - 1];
          right = pairs[index];
          break;
        }
        left = pairs[index - 1];
        right = pairs[index];
      }
      if (playbackTick > right.playback) {
        left = pairs[pairs.length - 2];
        right = pairs[pairs.length - 1];
      }
    }
    const denominator = right.playback - left.playback;
    const ratio = denominator ? (playbackTick - left.playback) / denominator : 0;
    return left.source + ratio * (right.source - left.source);
  }

  function positionFor(instance, tick) {
    const { osmd, score } = instance;
    const graphic = osmd?.GraphicSheet;
    const sourceTick = sourceTickForPlaybackTick(instance, tick);
    const fraction = fractionFor(osmd, sourceTick, score);
    if (!graphic || !fraction) {
      return {
        tick,
        x: 0,
        yTop: 0,
        staffTop: 0,
        yBottom: pageSize(osmd).height,
        systemIndex: 0,
        progress: 0,
        systemChanged: false
      };
    }
    try {
      const result = graphic.calculateXPositionFromTimestamp(fraction);
      const x = number(result?.[0], 0);
      const system = result?.[1] || graphic.MusicPages?.[0]?.MusicSystems?.[0];
      const bounds = currentSystemBounds(osmd, system);
      const domTop = osmdPointToRoot(instance, x, bounds.yTop);
      const domBottom = osmdPointToRoot(instance, x, bounds.yBottom);
      const nextSystem = bounds.systemIndex;
      const systemChanged = instance.lastSystemIndex !== -1 &&
        instance.lastSystemIndex !== nextSystem;
      instance.lastSystemIndex = nextSystem;
      return {
        tick,
        sourceTick,
        sourceX: x,
        sourceYTop: bounds.yTop,
        sourceYBottom: bounds.yBottom,
        x: domTop.x,
        yTop: domTop.y,
        staffTop: domTop.y,
        yBottom: domBottom.y,
        systemIndex: bounds.systemIndex,
        pageIndex: bounds.pageIndex,
        systemChanged
      };
    } catch (_) {
      return {
        tick,
        x: 0,
        yTop: 0,
        staffTop: 0,
        yBottom: pageSize(osmd).height,
        systemIndex: 0,
        progress: 0,
        systemChanged: false
      };
    }
  }

  /**
   * Draw chord names in a separate DOM layer.  The x position comes from the
   * same OSMD timestamp calculation used by the playhead, so a chord at the
   * middle of a measure is rendered at the middle of that measure (and not
   * merely at the beginning of the system).
   */
  function renderChordOverlay(instance, chords, options = {}) {
    const layer = instance?.layers?.chordLayer ||
      ensureLayers(instance?.root).chordLayer;
    if (!layer) return false;
    layer.replaceChildren();
    if (options.visible === false || !Array.isArray(chords) || !instance?.osmd) {
      return true;
    }

    const graphic = instance.osmd.GraphicSheet;
    const score = instance.score;
    const offset = Math.max(8, number(options.offset, 24));
    const occupied = new Map();
    const ordered = chords
      .map((chord, index) => ({
        chord,
        index,
        tick: Number(chord?.tick),
        text: String(chord?.text || chord?.name || chord?.chord || '').trim()
      }))
      .filter(item => item.text && Number.isFinite(item.tick))
      .sort((a, b) => a.tick - b.tick || a.index - b.index);

    ordered.forEach(item => {
      try {
        const fraction = fractionFor(instance.osmd, item.tick, score);
        if (!fraction) return;
        const result = graphic.calculateXPositionFromTimestamp(fraction);
        const x = number(result?.[0], 0);
        const system = result?.[1] ||
          graphic.MusicPages?.[0]?.MusicSystems?.[0];
        if (!system) return;
        const bounds = currentSystemBounds(instance.osmd, system);
        const point = osmdPointToRoot(instance, x, bounds.yTop);
        const systemKey = String(bounds.systemIndex);
        const lastX = occupied.get(systemKey);
        const minGap = Math.max(18, item.text.length * 7 + 8);
        const adjustedX = Number.isFinite(lastX) && point.x - lastX < minGap
          ? lastX + minGap
          : point.x;
        occupied.set(systemKey, adjustedX);

        const label = instance.root.ownerDocument.createElement('span');
        label.className = 'score-chord-label';
        label.textContent = item.text;
        label.dataset.tick = String(item.tick);
        label.dataset.system = String(bounds.systemIndex);
        label.style.left = `${adjustedX}px`;
        label.style.top = `${Math.max(2, point.y - offset)}px`;
        layer.appendChild(label);
      } catch (_) {
        // A chord outside the rendered range should not prevent the score
        // or playhead from being displayed.
      }
    });
    return true;
  }

  function contentKey(xml, partId, zoom) {
    return `${String(partId || '')}|${number(zoom, 1)}|${xml}`;
  }

  function osmdContent(xml) {
    if (typeof DOMParser === 'undefined') return xml;
    return parseXmlDocument(xml);
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
      instance = {
        root,
        osmdLayer: layers.osmdLayer,
        renderToken: 0,
        osmd: null,
        key: '',
        lastSystemIndex: -1
      };
      instances.set(root, instance);
    }
    if (instance.key === key && instance.osmd) {
      instance.score = score;
      instance.partId = partId || score?.activePartId || null;
      instance.layers = ensurePlayheadOverlay(root, instance.osmd);
      renderChordOverlay(instance, options.chords || [], {
        visible: options.showChords !== false,
        offset: options.chordOffset
      });
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
    instance.lastSystemIndex = -1;
    instance.layers = ensurePlayheadOverlay(root, osmd);
    renderChordOverlay(instance, options.chords || [], {
      visible: options.showChords !== false,
      offset: options.chordOffset
    });
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
    return { tick, x: 0, yTop: 0, staffTop: 0, yBottom: 0, systemIndex: 0, systemChanged: false };
  }

  function updatePlayhead(root, position) {
    const instance = root ? instances.get(root) : null;
    const line = instance?.layers?.line || root?.querySelector?.('[data-score-playhead]');
    if (!line) return false;
    const x = number(position?.x, 0);
    const yTop = number(position?.yTop, 0);
    const yBottom = Math.max(yTop + 1, number(position?.yBottom, yTop + 1));
    line.style.transform = `translate3d(${x}px, ${yTop}px, 0)`;
    line.style.height = `${yBottom - yTop}px`;
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
    renderChordOverlay,
    ticksToWholeNotes,
    getPlayheadPosition,
    updatePlayhead,
    setZoom,
    clearCache
  });

  globalScope.ScoreRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
