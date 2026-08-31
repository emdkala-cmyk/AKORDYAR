/**
 * MusicXmlScoreModel
 *
 * Serializable, read-only score model for the Live Score surface.  Written
 * notation comes from MusicXML; timing can be attached from the central MIDI
 * clock/model without changing the notation source.
 */
(function attachMusicXmlScoreModel(globalScope) {
  'use strict';

  const DEFAULT_PPQN = 480;
  const ROLE_ORDER = Object.freeze([
    'bass', 'saxophone', 'drums', 'guitar', 'piano', 'violin', 'flute',
    'accordion', 'vocalGuide', 'keyboard', 'other'
  ]);
  const ROLE_LABELS = Object.freeze({
    bass: 'Bass',
    saxophone: 'Saxophone',
    drums: 'Drums',
    guitar: 'Guitar',
    piano: 'Piano',
    violin: 'Violin',
    flute: 'Flute',
    accordion: 'Accordion',
    vocalGuide: 'Vocal Guide',
    keyboard: 'Keyboard',
    other: 'Other'
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function number(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function integer(value, fallback = 0) {
    return Math.trunc(number(value, fallback));
  }

  function inferRole(part) {
    const haystack = [
      part?.name,
      part?.abbreviation,
      ...(part?.instruments || []).map(item => `${item?.name || ''} ${item?.sound || ''}`)
    ].join(' ').toLowerCase();
    if (/(drum|percussion|kit|timpani|marimba|xylophone)/.test(haystack)) return 'drums';
    if (/(alto|tenor|baritone|soprano)\s*sax|saxophone/.test(haystack)) return 'saxophone';
    if (/(accordion|bandoneon)/.test(haystack)) return 'accordion';
    if (/(flute|piccolo|recorder|whistle|oboe|bassoon|clarinet)/.test(haystack)) return 'flute';
    if (/(violin|viola|cello|fiddle|string)/.test(haystack)) return 'violin';
    if (/(guitar|banjo|mandolin|ukulele)/.test(haystack)) return 'guitar';
    if (/(bass|contrabass)/.test(haystack)) return 'bass';
    if (/(piano|grand|organ|harpsichord|keyboard|keys?)/.test(haystack)) return 'piano';
    if (/(vocal|voice|singer|melody|lead)/.test(haystack)) return 'vocalGuide';
    return 'other';
  }

  function createPart(part, index) {
    const role = ROLE_ORDER.includes(part?.role) ? part.role : inferRole(part);
    return {
      id: String(part?.id || `P${index + 1}`),
      name: String(part?.name || `Part ${index + 1}`),
      abbreviation: String(part?.abbreviation || ''),
      role,
      roleLabel: ROLE_LABELS[role] || ROLE_LABELS.other,
      enabled: part?.enabled !== false,
      visible: part?.visible !== false,
      showChords: part?.showChords === true,
      midiTrackId: part?.midiTrackId || null,
      midiPartId: part?.midiPartId || null,
      deviceIds: Array.isArray(part?.deviceIds) ? [...part.deviceIds] : [],
      transposition: part?.transposition ? clone(part.transposition) : null,
      instruments: clone(part?.instruments || []),
      midiInstruments: clone(part?.midiInstruments || []),
      measures: clone(part?.measures || []),
      endTick: number(part?.endTick, 0)
    };
  }

  function normalizeMeasure(measure, index, ppqn) {
    const time = measure?.time || { beats: 4, beatType: 4, symbol: null };
    const numerator = typeof time.beats === 'string'
      ? number(String(time.beats).split('+')[0], 4)
      : number(time.beats, 4);
    const denominator = Math.max(1, integer(time.beatType, 4));
    const durationTicks = Math.max(
      1,
      integer(measure?.durationTicks, Math.round(numerator * 4 / denominator * ppqn))
    );
    const startTick = Math.max(0, integer(measure?.startTick, 0));
    return {
      ...measure,
      index,
      number: String(measure?.number ?? index + 1),
      startTick,
      endTick: Math.max(startTick + 1, integer(measure?.endTick, startTick + durationTicks)),
      durationTicks,
      beatTicks: Math.max(1, Math.round(ppqn * 4 / denominator)),
      numerator,
      denominator,
      time: {
        beats: time.beats ?? numerator,
        beatType: denominator,
        symbol: time.symbol || null,
        number: time.number || null,
        senzaMisura: Boolean(time.senzaMisura)
      },
      key: measure?.key ? { ...measure.key } : null,
      clefs: Array.isArray(measure?.clefs) ? measure.clefs.map(clef => ({ ...clef })) : [],
      notes: Array.isArray(measure?.notes)
        ? measure.notes.map((note, noteIndex) => ({
            ...note,
            id: note?.id || `m${index}n${noteIndex}`,
            startTick: integer(note?.startTick, startTick + integer(note?.relativeStartTick, 0)),
            endTick: integer(note?.endTick, startTick + integer(note?.relativeEndTick, 0)),
            durationTicks: Math.max(0, integer(note?.durationTicks, 0)),
            measureIndex: index
          }))
        : [],
      directions: Array.isArray(measure?.directions)
        ? measure.directions.map(direction => ({ ...direction }))
        : [],
      barlines: Array.isArray(measure?.barlines)
        ? measure.barlines.map(barline => ({ ...barline }))
        : [],
      layout: measure?.layout ? clone(measure.layout) : null
    };
  }

  function buildMeterMap(measures) {
    return measures.map(measure => ({
      tick: measure.startTick,
      numerator: measure.numerator,
      denominator: measure.denominator,
      beatTicks: measure.beatTicks,
      measureTicks: measure.durationTicks,
      symbol: measure.time?.symbol || null
    })).filter((event, index, list) =>
      index === 0 || event.numerator !== list[index - 1].numerator ||
      event.denominator !== list[index - 1].denominator
    );
  }

  function buildKeyMap(measures) {
    return measures
      .filter(measure => measure.key)
      .map(measure => ({
        tick: measure.startTick,
        fifths: integer(measure.key.fifths, 0),
        mode: measure.key.mode || 'major'
      }))
      .filter((event, index, list) =>
        index === 0 || event.fifths !== list[index - 1].fifths ||
        event.mode !== list[index - 1].mode
      );
  }

  function normalize(rawScore, options = {}) {
    if (!rawScore || typeof rawScore !== 'object') return null;
    const ppqn = Math.max(1, integer(rawScore.ticksPerQuarter, options.ticksPerQuarter || DEFAULT_PPQN));
    const measures = (Array.isArray(rawScore.measures) ? rawScore.measures : [])
      .map((measure, index) => normalizeMeasure(measure, index, ppqn));
    const parts = (Array.isArray(rawScore.parts) ? rawScore.parts : [])
      .map((part, index) => {
        const normalized = createPart(part, index);
        normalized.measures = (Array.isArray(part?.measures) ? part.measures : measures)
          .map((measure, measureIndex) => normalizeMeasure(measure, measureIndex, ppqn));
        normalized.endTick = normalized.measures.length
          ? normalized.measures[normalized.measures.length - 1].endTick
          : number(part?.endTick, 0);
        normalized.transposition = normalized.transposition ||
          normalized.measures.find(measure => measure.transpose)?.transpose || null;
        return normalized;
      });
    const globalMeasures = measures.length
      ? measures
      : (parts[0]?.measures || []);
    const normalized = {
      schemaVersion: integer(rawScore.schemaVersion, 1),
      format: rawScore.format || 'score-partwise',
      title: String(rawScore.title || ''),
      creators: rawScore.creators ? { ...rawScore.creators } : {},
      source: rawScore.source ? { ...rawScore.source } : {
        fileName: '', mimeType: 'application/vnd.recordare.musicxml+xml', size: 0, data: null
      },
      ticksPerQuarter: ppqn,
      parts,
      measures: globalMeasures,
      meterMap: rawScore.meterMap
        ? { ...rawScore.meterMap, events: clone(rawScore.meterMap.events || []) }
        : { source: 'musicxml', events: buildMeterMap(globalMeasures) },
      keyMap: rawScore.keyMap
        ? { ...rawScore.keyMap, events: clone(rawScore.keyMap.events || []) }
        : { source: 'musicxml', events: buildKeyMap(globalMeasures) },
      tempoMap: rawScore.tempoMap
        ? { ...rawScore.tempoMap, events: clone(rawScore.tempoMap.events || []) }
        : { source: 'musicxml', events: [] },
      endTick: Math.max(
        number(rawScore.endTick, 0),
        ...parts.map(part => number(part.endTick, 0)),
        ...globalMeasures.map(measure => number(measure.endTick, 0))
      ),
      activePartId: rawScore.activePartId || parts[0]?.id || null,
      mappings: Array.isArray(rawScore.mappings) ? clone(rawScore.mappings) : []
    };
    return normalized;
  }

  function serialize(score) {
    const normalized = normalize(score);
    return normalized ? clone(normalized) : null;
  }

  function getPart(score, partId = score?.activePartId) {
    return score?.parts?.find(part => String(part.id) === String(partId)) || null;
  }

  function getMeasures(score, partId = score?.activePartId) {
    return getPart(score, partId)?.measures || score?.measures || [];
  }

  function getNotes(score, partId = score?.activePartId) {
    return getMeasures(score, partId).flatMap(measure => measure.notes || []);
  }

  function measureAtTick(score, tick, partId = score?.activePartId) {
    const measures = getMeasures(score, partId);
    const safeTick = Math.max(0, number(tick, 0));
    return measures.find((measure, index) => {
      const last = index === measures.length - 1;
      return safeTick >= measure.startTick &&
        (safeTick < measure.endTick || last);
    }) || measures[measures.length - 1] || null;
  }

  function tickToMeasureBeat(score, tick, partId = score?.activePartId) {
    const measure = measureAtTick(score, tick, partId);
    if (!measure) {
      return {
        measureIndex: 0,
        measureNumber: '1',
        beat: 1,
        tickInBeat: 0,
        beatTicks: Math.round(number(score?.ticksPerQuarter, DEFAULT_PPQN)),
        numerator: 4,
        denominator: 4
      };
    }
    const delta = Math.max(0, number(tick, 0) - measure.startTick);
    return {
      measureIndex: measure.index,
      measureNumber: measure.number,
      beat: Math.floor(delta / measure.beatTicks) + 1,
      tickInBeat: delta % measure.beatTicks,
      beatTicks: measure.beatTicks,
      numerator: measure.numerator,
      denominator: measure.denominator,
      measureTicks: measure.durationTicks
    };
  }

  function measureBeatToTick(score, measureIndex, beat = 1, tickInBeat = 0, partId = score?.activePartId) {
    const measure = getMeasures(score, partId)[Math.max(0, integer(measureIndex, 0))];
    if (!measure) return 0;
    return measure.startTick +
      Math.max(0, integer(beat, 1) - 1) * measure.beatTicks +
      Math.max(0, number(tickInBeat, 0));
  }

  function timeSignatureAtTick(score, tick) {
    const value = tickToMeasureBeat(score, tick);
    return {
      numerator: value.numerator,
      denominator: value.denominator,
      beatTicks: value.beatTicks,
      measureTicks: value.measureTicks
    };
  }

  function keyAtTick(score, tick) {
    const events = score?.keyMap?.events || [];
    let current = events[0] || { tick: 0, fifths: 0, mode: 'major' };
    events.forEach(event => {
      if (number(event.tick) <= number(tick)) current = event;
    });
    return current;
  }

  function getSummary(score) {
    const normalized = normalize(score);
    if (!normalized) return {
      partCount: 0, measureCount: 0, noteCount: 0, durationTicks: 0, fileName: ''
    };
    return {
      partCount: normalized.parts.length,
      measureCount: normalized.measures.length,
      noteCount: normalized.parts.reduce(
        (sum, part) => sum + part.measures.reduce((count, measure) => count + measure.notes.length, 0),
        0
      ),
      durationTicks: normalized.endTick,
      fileName: normalized.source?.fileName || '',
      title: normalized.title || ''
    };
  }

  function assignPart(score, partId, patch = {}) {
    const next = normalize(score);
    const part = getPart(next, partId);
    if (!part) return next;
    if (patch.name != null) part.name = String(patch.name);
    if (ROLE_ORDER.includes(patch.role)) {
      part.role = patch.role;
      part.roleLabel = ROLE_LABELS[patch.role];
    }
    ['enabled', 'visible', 'showChords'].forEach(key => {
      if (patch[key] != null) part[key] = Boolean(patch[key]);
    });
    if (patch.midiTrackId != null) part.midiTrackId = String(patch.midiTrackId);
    if (patch.midiPartId != null) part.midiPartId = String(patch.midiPartId);
    if (patch.transposition != null) part.transposition = clone(patch.transposition);
    if (Array.isArray(patch.deviceIds)) part.deviceIds = [...patch.deviceIds];
    return next;
  }

  function attachMidiTiming(score, midiScore, mappings = []) {
    const next = normalize(score);
    if (!next || !midiScore) return next;
    const midiModel = globalScope.MidiScoreModel;
    const mappingByXml = new Map((mappings || next.mappings || []).map(item =>
      [String(item.musicXmlPartId || item.partId || ''), item]
    ));
    next.parts.forEach(part => {
      const mapping = mappingByXml.get(String(part.id));
      const midiPartId = mapping?.midiPartId || part.midiPartId;
      let midiPart = midiModel?.getPart?.(midiScore, midiPartId);
      if (!midiPart && Array.isArray(midiScore.parts)) {
        const target = `${part.name || ''} ${part.role || ''}`.toLowerCase();
        midiPart = midiScore.parts.find(candidate => {
          const haystack = `${candidate.name || ''} ${candidate.role || ''}`.toLowerCase();
          return target && haystack && (target.includes(haystack) || haystack.includes(target));
        }) || null;
      }
      const midiTrack = midiPart ? midiModel.getPartTrack(midiScore, midiPart.id) : null;
      if (!midiTrack?.notes?.length) return;
      part.midiPartId = midiPart?.id || part.midiPartId || null;
      part.midiTrackId = midiTrack.id || part.midiTrackId || null;
      const sourceNotes = getNotes(next, part.id).filter(note => !note.rest && note.pitch);
      const midiNotes = midiTrack.notes || [];
      sourceNotes.forEach((note, index) => {
        const midiNote = midiNotes[index];
        if (!midiNote) return;
        note.timing = {
          startTick: number(midiNote.startTick, note.startTick),
          endTick: number(midiNote.endTick, note.endTick),
          startSeconds: number(midiNote.startSeconds, null),
          endSeconds: number(midiNote.endSeconds, null)
        };
      });
    });
    return next;
  }

  /**
   * Merge two normalized scores.  New parts are appended to the existing
   * score; if part IDs collide the incoming IDs are suffixed to keep them
   * unique.  Global measures, meter map, key map and tempo map are rebuilt
   * from the union of both scores so that every part shares the same
   * timeline.
   */
  function mergeScores(existing, incoming) {
    if (!existing || !incoming) return existing || incoming || null;
    const left = normalize(existing);
    const right = normalize(incoming);
    if (!left || !right) return left || right || null;

    /* ---- part-id deduplication ---- */
    const usedIds = new Set(left.parts.map(part => String(part.id)));
    const mergedParts = left.parts.map(part => clone(part));
    right.parts.forEach(part => {
      const clone_ = clone(part);
      let id = String(clone_.id);
      if (usedIds.has(id)) {
        let counter = 2;
        while (usedIds.has(`${id}-${counter}`)) counter += 1;
        id = `${id}-${counter}`;
      }
      usedIds.add(id);
      clone_.id = id;
      mergedParts.push(clone_);
    });

    /* ---- global measures: take the larger set ---- */
    const leftMeasures = left.measures || [];
    const rightMeasures = right.measures || [];
    const measureCount = Math.max(leftMeasures.length, rightMeasures.length);
    const globalMeasures = [];
    let absoluteStart = 0;
    for (let i = 0; i < measureCount; i += 1) {
      const src = leftMeasures[i] || rightMeasures[i] || {};
      const leftDuration = number(leftMeasures[i]?.durationTicks, 0);
      const rightDuration = number(rightMeasures[i]?.durationTicks, 0);
      const durationTicks = Math.max(1, leftDuration, rightDuration);
      const time = src.time || { beats: 4, beatType: 4, symbol: null };
      const numerator = typeof time.beats === 'string'
        ? number(String(time.beats).split('+')[0], 4)
        : number(time.beats, 4);
      const denominator = Math.max(1, integer(time.beatType, 4));
      globalMeasures.push({
        index: i,
        number: String(src.number ?? i + 1),
        startTick: absoluteStart,
        endTick: absoluteStart + durationTicks,
        durationTicks,
        beatTicks: Math.max(1, Math.round(number(leftMeasures[i]?.beatTicks, DEFAULT_PPQN) * 4 / denominator)),
        numerator,
        denominator,
        time: {
          beats: time.beats ?? numerator,
          beatType: denominator,
          symbol: time.symbol || null,
          number: time.number || null,
          senzaMisura: Boolean(time.senzaMisura)
        },
        key: src.key ? { ...src.key } : null,
        clefs: Array.isArray(src.clefs) ? src.clefs.map(c => ({ ...c })) : [],
        transpose: src.transpose ? clone(src.transpose) : null,
        staves: src.staves || 1,
        width: src.width ?? null,
        layout: src.layout ? clone(src.layout) : null,
        implicit: Boolean(src.implicit),
        barlines: Array.isArray(src.barlines) ? src.barlines.map(b => ({ ...b })) : []
      });
      absoluteStart += durationTicks;
    }

    /* ---- re-tick all parts against the new global measures ---- */
    mergedParts.forEach(part => {
      part.measures.forEach((measure, mi) => {
        const global = globalMeasures[mi];
        if (!global) return;
        measure.startTick = global.startTick;
        measure.endTick = global.endTick;
        measure.durationTicks = global.durationTicks;
        measure.beatTicks = global.beatTicks;
        measure.numerator = global.numerator;
        measure.denominator = global.denominator;
        measure.time = { ...global.time };
        if (measure.key && global.key) {
          measure.key = { ...global.key };
        }
        (measure.notes || []).forEach(note => {
          note.startTick = global.startTick + number(note.relativeStartTick, 0);
          note.endTick = global.startTick + number(note.relativeEndTick, 0);
          note.measureStartTick = global.startTick;
          note.measureEndTick = global.endTick;
        });
      });
      part.endTick = part.measures.length
        ? part.measures[part.measures.length - 1].endTick
        : 0;
    });

    /* ---- rebuild maps ---- */
    const meterMap = { source: 'musicxml', events: buildMeterMap(globalMeasures) };
    const keyMap = { source: 'musicxml', events: buildKeyMap(globalMeasures) };
    const tempoEvents = [];
    globalMeasures.forEach(measure => {
      (measure.directions || []).forEach(direction => {
        const tick = number(measure.startTick, 0) + number(direction.relativeTick, 0);
        if (direction.tempo > 0) {
          tempoEvents.push({
            tick,
            bpm: direction.tempo,
            beatUnit: direction.beatUnit || 'quarter',
            dots: direction.beatUnitDots || 0,
            source: 'musicxml'
          });
        }
      });
    });
    const tempoMap = {
      source: 'musicxml',
      events: left.tempoMap?.events?.length ? left.tempoMap.events : right.tempoMap?.events || tempoEvents
    };

    /* ---- collect per-part raw XML sources for OSMD rendering ---- */
    const dataSources = [];
    if (left.source?.data) {
      dataSources.push({
        data: left.source.data,
        partIds: left.parts.map(p => String(p.id)),
        xmlPartIds: left.parts.map(p => String(p.id))
      });
    }
    if (right.source?.data) {
      const rightMergedIds = [];
      const rightXmlIds = [];
      right.parts.forEach((p, i) => {
        rightXmlIds.push(String(p.id));
        rightMergedIds.push(String(mergedParts[left.parts.length + i].id));
      });
      dataSources.push({
        data: right.source.data,
        partIds: rightMergedIds,
        xmlPartIds: rightXmlIds
      });
    }

    /* ---- merge source metadata ---- */
    const leftFileNames = left.source?.fileName || '';
    const rightFileNames = right.source?.fileName || '';
    const mergedTitle = left.title && right.title
      ? `${left.title} + ${right.title}`
      : left.title || right.title || '';

    const merged = {
      schemaVersion: Math.max(number(left.schemaVersion, 1), number(right.schemaVersion, 1)),
      format: left.format || right.format || 'score-partwise',
      title: mergedTitle,
      creators: { ...(left.creators || {}), ...(right.creators || {}) },
      source: {
        fileName: leftFileNames && rightFileNames ? `${leftFileNames} + ${rightFileNames}` : leftFileNames || rightFileNames,
        mimeType: left.source?.mimeType || right.source?.mimeType || 'application/vnd.recordare.musicxml+xml',
        size: number(left.source?.size, 0) + number(right.source?.size, 0),
        data: null,
        dataSources
      },
      ticksPerQuarter: left.ticksPerQuarter || right.ticksPerQuarter || DEFAULT_PPQN,
      parts: mergedParts,
      measures: globalMeasures,
      meterMap,
      keyMap,
      tempoMap,
      endTick: absoluteStart,
      activePartId: left.activePartId || mergedParts[0]?.id || null,
      mappings: [
        ...(Array.isArray(left.mappings) ? left.mappings : []),
        ...(Array.isArray(right.mappings) ? right.mappings : [])
      ]
    };

    return merged;
  }

  const api = Object.freeze({
    DEFAULT_PPQN,
    ROLE_ORDER,
    ROLE_LABELS,
    inferRole,
    createPart,
    normalize,
    serialize,
    getPart,
    getMeasures,
    getNotes,
    measureAtTick,
    tickToMeasureBeat,
    measureBeatToTick,
    timeSignatureAtTick,
    keyAtTick,
    getSummary,
    assignPart,
    attachMidiTiming,
    mergeScores
  });

  globalScope.MusicXmlScoreModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
