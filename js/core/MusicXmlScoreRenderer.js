/**
 * MusicXmlScoreRenderer
 *
 * Read-only SVG engraving surface.  MusicXML supplies the written notation
 * and measure layout; an optional MIDI score supplies the authoritative
 * Audio-Clock tick for highlighting and the playhead.
 */
(function attachMusicXmlScoreRenderer(globalScope) {
  'use strict';

  const layoutCache = new Map();
  const MAX_CACHE_ENTRIES = 24;
  const STAFF_SPACING = 12;
  const MEASURE_WIDTH = 260;
  const MEASURES_PER_SYSTEM = 4;
  const SYSTEM_HEADER_WIDTH = 132;
  const STAFF_BLOCK = 92;
  const SYSTEM_TOP = 72;
  const SYSTEM_GAP = 26;
  const LEFT_PADDING = 18;
  const RIGHT_PADDING = 28;
  const BOTTOM_PADDING = 38;
  const LETTER_INDEX = Object.freeze({ C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 });
  const SHARP_ORDER = Object.freeze(['F', 'C', 'G', 'D', 'A', 'E', 'B']);
  const FLAT_ORDER = Object.freeze(['B', 'E', 'A', 'D', 'G', 'C', 'F']);

  function escapeXml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function number(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function normalizeScore(score) {
    return globalScope.MusicXmlScoreModel?.normalize?.(score) || score;
  }

  function getPart(score, partId) {
    return globalScope.MusicXmlScoreModel?.getPart?.(score, partId) ||
      score?.parts?.find(part => String(part.id) === String(partId)) ||
      score?.parts?.[0] || null;
  }

  function getMeasures(score, partId) {
    const part = getPart(score, partId);
    return part?.measures?.length ? part.measures : (score?.measures || []);
  }

  function staffCountForMeasure(measure) {
    const maxNoteStaff = Math.max(
      1,
      ...(measure?.notes || []).map(note => number(note.staff, 1))
    );
    return Math.max(
      maxNoteStaff,
      number(measure?.staves, 1),
      Array.isArray(measure?.clefs) ? measure.clefs.length : 1
    );
  }

  function clefFor(measure, staff = 1) {
    const clefs = Array.isArray(measure?.clefs) ? measure.clefs : [];
    return clefs[staff - 1] || clefs[0] || { sign: 'G', line: 2, octaveChange: 0 };
  }

  function diatonic(step, octave) {
    return number(octave, 4) * 7 + (LETTER_INDEX[String(step || 'C').toUpperCase()] ?? 0);
  }

  function clefBottomDiatonic(clef) {
    const sign = String(clef?.sign || 'G').toUpperCase();
    const line = Math.max(1, number(clef?.line, sign === 'F' ? 4 : 2));
    let reference;
    if (sign === 'F') reference = diatonic('F', 3);
    else if (sign === 'C') reference = diatonic('C', 4);
    else reference = diatonic('G', 4);
    const referenceBottom = reference - (line - 1) * 2;
    return referenceBottom - number(clef?.octaveChange, 0) * 7;
  }

  function pitchStep(note, clef) {
    if (!note?.pitch) return 4;
    return diatonic(note.pitch.step, note.pitch.octave) - clefBottomDiatonic(clef);
  }

  function pitchY(note, staffTop, spacing, clef) {
    return staffTop + spacing * 4 - pitchStep(note, clef) * spacing / 2;
  }

  function keyAtMeasure(measure) {
    return measure?.key || { fifths: 0, mode: 'major' };
  }

  function keyLabel(key) {
    const fifths = Math.max(-7, Math.min(7, Math.trunc(number(key?.fifths, 0))));
    const major = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
    const minor = ['Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'];
    return (key?.mode || 'major').toLowerCase() === 'minor'
      ? minor[fifths + 7]
      : major[fifths + 7];
  }

  function noteType(note, score) {
    const direct = String(note?.type || '').toLowerCase();
    if (direct) return direct;
    const quarterTicks = number(score?.ticksPerQuarter, 480);
    const ratio = number(note?.durationTicks, quarterTicks) / Math.max(1, quarterTicks);
    if (ratio >= 3.5) return 'whole';
    if (ratio >= 1.7) return 'half';
    if (ratio >= .8) return 'quarter';
    if (ratio >= .4) return 'eighth';
    if (ratio >= .2) return '16th';
    return '32nd';
  }

  function isOpenNote(type) {
    return type === 'whole' || type === 'half' || type === 'breve';
  }

  function noteX(measure, note, column = 0) {
    const start = number(note?.startTick, measure.startTick) - measure.startTick;
    const ratio = Math.max(0, Math.min(1, start / Math.max(1, measure.durationTicks)));
    const left = measure.x + 25;
    const right = measure.x + measure.width - 25;
    return left + ratio * Math.max(25, right - left) + column * 13;
  }

  function renderSharp(x, y, className = 'midi-score-accidental') {
    return `<path d="M ${x + 2} ${y - 10} V ${y + 10} M ${x + 9} ${y - 11} V ${y + 9}` +
      ` M ${x - 1} ${y - 2} H ${x + 13} M ${x - 1} ${y + 4} H ${x + 13}" class="${className}"/>`;
  }

  function renderFlat(x, y, className = 'midi-score-accidental') {
    return `<path d="M ${x + 2} ${y - 11} V ${y + 10} M ${x + 2} ${y + 1}` +
      ` C ${x + 13} ${y - 5}, ${x + 13} ${y + 9}, ${x + 3} ${y + 9}` +
      ` C ${x - 2} ${y + 9}, ${x - 2} ${y + 2}, ${x + 2} ${y + 1}" class="${className}"/>`;
  }

  function renderNatural(x, y, className = 'midi-score-accidental') {
    return `<path d="M ${x + 2} ${y - 10} V ${y + 10} M ${x + 9} ${y - 12} V ${y + 8}` +
      ` M ${x + 2} ${y - 2} L ${x + 9} ${y - 5} M ${x + 2} ${y + 4} L ${x + 9} ${y + 1}" class="${className}"/>`;
  }

  function renderDoubleSharp(x, y) {
    return `<text x="${x}" y="${y + 5}" class="midi-score-accidental-text">𝄪</text>`;
  }

  function renderDoubleFlat(x, y) {
    return `<text x="${x}" y="${y + 5}" class="midi-score-accidental-text">𝄫</text>`;
  }

  function renderAccidental(note, x, y) {
    const value = String(note?.accidental?.value || '').toLowerCase();
    if (value === 'sharp' || value === '#') return renderSharp(x, y);
    if (value === 'flat' || value === 'b') return renderFlat(x, y);
    if (value === 'natural' || value === 'n') return renderNatural(x, y);
    if (value.includes('double-sharp') || value === '##') return renderDoubleSharp(x, y);
    if (value.includes('double-flat') || value === 'bb') return renderDoubleFlat(x, y);
    const alter = number(note?.pitch?.alter, 0);
    if (alter >= 2) return renderDoubleSharp(x, y);
    if (alter === 1) return renderSharp(x, y);
    if (alter <= -2) return renderDoubleFlat(x, y);
    if (alter === -1) return renderFlat(x, y);
    return '';
  }

  function renderLedgerLines(note, spacing) {
    const lines = [];
    if (note.staffStep < 0) {
      for (let step = -2; step >= note.staffStep; step -= 2) {
        const y = note.y + (note.staffStep - step) * spacing / 2;
        lines.push(`<line x1="${note.x - 11}" y1="${y}" x2="${note.x + 11}" y2="${y}" class="midi-score-ledger-line"/>`);
      }
    }
    if (note.staffStep > 8) {
      for (let step = 10; step <= note.staffStep; step += 2) {
        const y = note.y - (step - note.staffStep) * spacing / 2;
        lines.push(`<line x1="${note.x - 11}" y1="${y}" x2="${note.x + 11}" y2="${y}" class="midi-score-ledger-line"/>`);
      }
    }
    return lines.join('');
  }

  function renderNote(note, spacing, activeTick) {
    const active = Number.isFinite(activeTick) &&
      activeTick >= note.activeStartTick && activeTick < note.activeEndTick;
    const cls = active
      ? 'midi-score-note midi-score-note-active'
      : 'midi-score-note';
    const type = note.type;
    const open = isOpenNote(type);
    const stemUp = note.staffStep <= 4;
    const stemX = stemUp ? note.x + 5.8 : note.x - 5.8;
    const stemEnd = stemUp ? note.y - spacing * 3.3 : note.y + spacing * 3.3;
    const stem = type === 'whole'
      ? ''
      : `<line x1="${stemX}" y1="${note.y}" x2="${stemX}" y2="${stemEnd}" class="midi-score-stem"/>`;
    const flagCount = type === '16th' || type === '16th-note' ? 2
      : type === '32nd' || type === '32nd-note' ? 3
      : type === 'eighth' || type === '8th' ? 1 : 0;
    const flags = Array.from({ length: flagCount }, (_, index) => {
      const y = stemEnd + (stemUp ? index * 8 : -index * 8);
      return `<path d="M ${stemX} ${y} q ${stemUp ? 16 : -16} 7 ${stemUp ? 10 : -10} 18" class="midi-score-flag"/>`;
    }).join('');
    const dots = Array.from({ length: Math.max(0, number(note.dots, 0)) }, (_, index) =>
      `<circle cx="${note.x + 12 + index * 6}" cy="${note.y - 1}" r="2.2" class="midi-score-dot"/>`
    ).join('');
    return `<g class="${cls}" data-note-id="${escapeXml(note.id)}">` +
      renderLedgerLines(note, spacing) +
      renderAccidental(note.source, note.x - 21, note.y) +
      `<ellipse cx="${note.x}" cy="${note.y}" rx="7" ry="5" ` +
      `transform="rotate(${stemUp ? -20 : 20} ${note.x} ${note.y})" ` +
      `class="midi-score-notehead${open ? ' midi-score-notehead-open' : ''}"/>` +
      stem + flags + dots + '</g>';
  }

  function renderRest(note) {
    const x = note.x;
    const y = note.y;
    const type = note.type;
    if (type === 'whole') {
      return `<rect x="${x - 9}" y="${y - 1}" width="18" height="6" class="midi-score-rest-shape"/>`;
    }
    if (type === 'half') {
      return `<rect x="${x - 9}" y="${y - 11}" width="18" height="6" class="midi-score-rest-shape"/>`;
    }
    if (type === 'eighth' || type === '8th') {
      return `<path d="M ${x + 2} ${y - 15} V ${y + 8} C ${x + 14} ${y + 3}, ${x + 16} ${y + 12}, ${x + 7} ${y + 15}" class="midi-score-rest-path"/>`;
    }
    if (type === '16th' || type === '16th-note') {
      return `<path d="M ${x + 2} ${y - 15} V ${y + 8} M ${x + 8} ${y - 13} V ${y + 10}` +
        ` C ${x + 17} ${y + 4}, ${x + 18} ${y + 12}, ${x + 9} ${y + 15}" class="midi-score-rest-path"/>`;
    }
    return `<path d="M ${x + 3} ${y - 15} C ${x - 9} ${y - 6}, ${x + 11} ${y - 1}, ${x - 5} ${y + 8}` +
      ` C ${x - 10} ${y + 12}, ${x + 9} ${y + 16}, ${x + 1} ${y + 20}" class="midi-score-rest-path"/>`;
  }

  function renderTrebleClef(x, staffTop) {
    return `<g class="midi-score-clef" aria-label="treble clef" transform="translate(${x} ${staffTop - 13}) scale(.64)">` +
      `<path d="M 38 0 C 25 10 21 25 28 35 C 35 45 50 41 54 30 C 58 19 50 10 39 12` +
      ` C 29 14 27 24 34 29 C 40 33 48 29 48 23 M 39 0 C 34 16 36 30 32 46` +
      ` C 28 62 17 70 18 80 C 19 90 31 94 41 88 C 51 82 51 72 44 66` +
      ` C 37 61 30 65 28 71 M 39 0 L 39 90"/><circle cx="39" cy="90" r="2.8"/>` +
      `</g>`;
  }

  function renderBassClef(x, staffTop, spacing) {
    const y = staffTop + spacing * 2;
    return `<g class="midi-score-clef" aria-label="bass clef">` +
      `<path d="M ${x + 23} ${y - 18} C ${x + 5} ${y - 9}, ${x + 5} ${y + 17}, ${x + 22} ${y + 22}` +
      ` C ${x + 34} ${y + 26}, ${x + 39} ${y + 10}, ${x + 30} ${y + 2}" />` +
      `<circle cx="${x + 39}" cy="${y - 8}" r="2.3"/><circle cx="${x + 39}" cy="${y + 9}" r="2.3"/>` +
      `</g>`;
  }

  function renderAltoClef(x, staffTop, spacing) {
    const y = staffTop + spacing * 2;
    return `<g class="midi-score-clef" aria-label="C clef">` +
      `<path d="M ${x + 31} ${y - 21} C ${x + 7} ${y - 21}, ${x + 7} ${y + 21}, ${x + 31} ${y + 21}` +
      ` M ${x + 22} ${y - 5} L ${x + 22} ${y + 5} M ${x + 31} ${y - 5} L ${x + 31} ${y + 5}" />` +
      `</g>`;
  }

  function renderClef(x, staffTop, spacing, clef) {
    const sign = String(clef?.sign || 'G').toUpperCase();
    if (sign === 'F') return renderBassClef(x, staffTop, spacing);
    if (sign === 'C') return renderAltoClef(x, staffTop, spacing);
    if (sign === 'P') {
      return `<g class="midi-score-clef"><rect x="${x + 16}" y="${staffTop + 10}" width="8" height="32"/>` +
        `<rect x="${x + 31}" y="${staffTop + 10}" width="8" height="32"/></g>`;
    }
    return renderTrebleClef(x, staffTop);
  }

  function keyStep(letter, clef) {
    // Select a canonical octave near the staff and use the same diatonic
    // mapping as noteheads; this keeps key signatures correct for F/C clefs.
    const octave = String(clef?.sign || 'G').toUpperCase() === 'F' ? 3 : 4;
    return diatonic(letter, octave) - clefBottomDiatonic(clef);
  }

  function renderKeySignature(x, staffTop, spacing, key, clef) {
    const count = Math.max(-7, Math.min(7, Math.trunc(number(key?.fifths, 0))));
    const letters = count >= 0 ? SHARP_ORDER : FLAT_ORDER;
    const parts = [];
    letters.slice(0, Math.abs(count)).forEach((letter, index) => {
      const step = keyStep(letter, clef);
      const y = staffTop + spacing * 4 - step * spacing / 2;
      parts.push(count >= 0
        ? renderSharp(x + index * 11, y, 'midi-score-key-symbol')
        : renderFlat(x + index * 11, y, 'midi-score-key-symbol'));
    });
    return parts.join('');
  }

  function renderHeader(score, measure, systemIndex, layout) {
    if (!measure.firstInSystem) return '';
    const headerX = measure.x - SYSTEM_HEADER_WIDTH;
    const parts = [];
    const staves = measure.staffCount || 1;
    for (let staff = 1; staff <= staves; staff += 1) {
      const top = measure.staffTop + (staff - 1) * STAFF_BLOCK;
      const clef = clefFor(measure.source, staff);
      parts.push(renderClef(headerX + 5, top, layout.staffSpacing, clef));
      parts.push(renderKeySignature(headerX + 48, top, layout.staffSpacing, keyAtMeasure(measure.source), clef));
    }
    const key = keyAtMeasure(measure.source);
    const signatureX = headerX + 53 + Math.abs(Math.trunc(number(key.fifths, 0))) * 11;
    parts.push(`<text x="${signatureX}" y="${measure.staffTop + 14}" class="midi-score-time-signature">${escapeXml(measure.numerator)}</text>`);
    parts.push(`<text x="${signatureX}" y="${measure.staffTop + 36}" class="midi-score-time-signature">${escapeXml(measure.denominator)}</text>`);
    if (systemIndex === 0) {
      const tempo = score?.tempoMap?.events?.[0]?.bpm;
      parts.push(`<text x="${headerX}" y="${measure.staffTop - 34}" class="midi-score-system-label">` +
        `${tempo ? '&#x2669;=' + Math.round(tempo) + ' · ' : ''}${escapeXml(keyLabel(key))}</text>`);
    }
    return parts.join('');
  }

  function renderBeamGroups(notes, spacing) {
    const groups = new Map();
    notes.forEach(note => {
      const beamNumber = Object.keys(note.source?.beams || {})[0];
      if (!beamNumber) return;
      const key = `${note.staff}|${note.source.voice || '1'}|${beamNumber}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(note);
    });
    const parts = [];
    groups.forEach(group => {
      if (group.length < 2) return;
      group.sort((a, b) => a.startTick - b.startTick);
      const first = group[0];
      const last = group[group.length - 1];
      const up = first.staffStep <= 4;
      const y = up
        ? Math.min(first.y, last.y) - spacing * 3.3
        : Math.max(first.y, last.y) + spacing * 3.3;
      const x1 = first.x + (up ? 5.8 : -5.8);
      const x2 = last.x + (up ? 5.8 : -5.8);
      parts.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="midi-score-beam"/>`);
      if (group.length > 2) {
        for (let index = 1; index < group.length - 1; index += 1) {
          const note = group[index];
          parts.push(`<line x1="${note.x + (up ? 5.8 : -5.8)}" y1="${y}" x2="${note.x + (up ? 5.8 : -5.8)}" y2="${y + (up ? 7 : -7)}" class="midi-score-beam"/>`);
        }
      }
    });
    return parts.join('');
  }

  function renderTies(notes) {
    const starts = new Map();
    const parts = [];
    notes.forEach(note => {
      (note.source?.ties || []).forEach(tie => {
        const key = `${note.staff}|${note.source.voice || '1'}|${tie.number || '1'}`;
        if (tie.type === 'start') {
          starts.set(key, note);
        } else if (tie.type === 'stop' && starts.has(key)) {
          const from = starts.get(key);
          const direction = from.staffStep <= 4 ? 1 : -1;
          const y = from.y + direction * 10;
          parts.push(`<path d="M ${from.x + 6} ${y} C ${from.x + 28} ${y + direction * 16}, ${note.x - 28} ${y + direction * 16}, ${note.x - 6} ${y}" class="midi-score-tie"/>`);
          starts.delete(key);
        }
      });
    });
    return parts.join('');
  }

  function renderSlurs(notes) {
    const starts = new Map();
    const parts = [];
    notes.forEach(note => {
      (note.source?.notations?.slurs || []).forEach(slur => {
        const key = `${note.staff}|${note.source.voice || '1'}|${slur.number || '1'}`;
        if (slur.type === 'start') starts.set(key, note);
        if (slur.type === 'stop' && starts.has(key)) {
          const from = starts.get(key);
          const direction = slur.placement === 'above' ? -1 : 1;
          const y = direction < 0
            ? Math.min(from.y, note.y) - 18
            : Math.max(from.y, note.y) + 18;
          parts.push(`<path d="M ${from.x + 5} ${y} C ${from.x + 32} ${y + direction * 13}, ${note.x - 32} ${y + direction * 13}, ${note.x - 5} ${y}" class="midi-score-slur"/>`);
          starts.delete(key);
        }
      });
    });
    return parts.join('');
  }

  function scoreKey(score, partId, options) {
    const part = getPart(score, partId);
    const noteSignature = (part?.measures || []).flatMap(measure => measure.notes || [])
      .map(note => [
        note.id, note.startTick, note.endTick, note.pitch?.step, note.pitch?.alter,
        note.pitch?.octave, note.durationTicks, note.type, note.rest
      ].join(':')).join('|');
    return JSON.stringify([
      score?.schemaVersion, score?.endTick, partId,
      options?.measureWidth || MEASURE_WIDTH,
      options?.staffSpacing || STAFF_SPACING,
      options?.measuresPerSystem || MEASURES_PER_SYSTEM,
      noteSignature
    ]);
  }

  function buildLayout(scoreInput, partId, options = {}) {
    const score = normalizeScore(scoreInput);
    if (!score) return null;
    const sourceMeasures = getMeasures(score, partId);
    if (!sourceMeasures.length) return null;
    const measureWidth = Math.max(180, number(options.measureWidth, MEASURE_WIDTH));
    const staffSpacing = Math.max(8, number(options.staffSpacing, STAFF_SPACING));
    const measuresPerSystem = Math.max(1, Math.trunc(number(options.measuresPerSystem, MEASURES_PER_SYSTEM)));
    const systems = [];
    const measures = sourceMeasures.map((source, index) => {
      const staffCount = staffCountForMeasure(source);
      return {
        source,
        index,
        number: source.number || String(index + 1),
        startTick: number(source.startTick, 0),
        endTick: Math.max(number(source.startTick, 0) + 1, number(source.endTick, 1)),
        durationTicks: Math.max(1, number(source.durationTicks, number(source.endTick, 1) - number(source.startTick, 0))),
        numerator: source.numerator || source.time?.beats || 4,
        denominator: source.denominator || source.time?.beatType || 4,
        staffCount,
        notes: []
      };
    });
    for (let index = 0; index < measures.length; index += measuresPerSystem) {
      const systemMeasures = measures.slice(index, index + measuresPerSystem);
      const systemIndex = systems.length;
      const staffCount = Math.max(...systemMeasures.map(measure => measure.staffCount), 1);
      const staffTop = SYSTEM_TOP + systems.reduce((sum, system) =>
        sum + system.height + SYSTEM_GAP, 0);
      const system = {
        index: systemIndex,
        staffTop,
        staffCount,
        height: staffCount * STAFF_BLOCK + 48,
        width: LEFT_PADDING + SYSTEM_HEADER_WIDTH + systemMeasures.length * measureWidth + RIGHT_PADDING,
        measures: systemMeasures
      };
      systemMeasures.forEach((measure, indexInSystem) => {
        measure.systemIndex = systemIndex;
        measure.firstInSystem = indexInSystem === 0;
        measure.indexInSystem = indexInSystem;
        measure.x = LEFT_PADDING + SYSTEM_HEADER_WIDTH + indexInSystem * measureWidth;
        measure.width = measureWidth;
        measure.staffTop = staffTop;
        measure.staffSpacing = staffSpacing;
        measure.staffCount = staffCount;
        const columns = new Map();
        (measure.source.notes || []).forEach(sourceNote => {
          const staff = Math.max(1, Math.min(staffCount, number(sourceNote.staff, 1)));
          const clef = clefFor(measure.source, staff);
          const columnKey = `${staff}|${sourceNote.voice || '1'}|${sourceNote.startTick}`;
          const column = columns.get(columnKey) || 0;
          columns.set(columnKey, column + 1);
          const type = sourceNote.rest ? noteType(sourceNote, score) : noteType(sourceNote, score);
          const startTick = number(sourceNote.startTick, measure.startTick);
          const endTick = Math.max(startTick + 1, number(sourceNote.endTick, startTick + number(sourceNote.durationTicks, 1)));
          const staffTop = measure.staffTop + (staff - 1) * STAFF_BLOCK;
          const note = {
            id: sourceNote.id,
            source: sourceNote,
            staff,
            staffStep: pitchStep(sourceNote, clef),
            x: noteX(measure, sourceNote, column),
            y: sourceNote.rest
              ? staffTop + staffSpacing * 2
              : pitchY(sourceNote, staffTop, staffSpacing, clef),
            startTick,
            endTick,
            activeStartTick: number(sourceNote.timing?.startTick, startTick),
            activeEndTick: Math.max(
              number(sourceNote.timing?.startTick, startTick) + 1,
              number(sourceNote.timing?.endTick, endTick)
            ),
            type,
            dots: number(sourceNote.dots, 0),
            rest: Boolean(sourceNote.rest)
          };
          measure.notes.push(note);
        });
      });
      systems.push(system);
    }
    const height = systems.length
      ? systems[systems.length - 1].staffTop + systems[systems.length - 1].height + BOTTOM_PADDING
      : 220;
    return {
      partId,
      measureWidth,
      staffSpacing,
      measuresPerSystem,
      width: Math.max(...systems.map(system => system.width), 720),
      height,
      measures,
      systems,
      endTick: number(score.endTick, measures[measures.length - 1].endTick),
      noteCount: measures.reduce((sum, measure) => sum + measure.notes.length, 0)
    };
  }

  function getCachedLayout(score, partId, options = {}) {
    const key = scoreKey(score, partId, options);
    const cached = layoutCache.get(key);
    if (cached) return cached;
    const layout = buildLayout(score, partId, options);
    if (!layout) return null;
    layoutCache.set(key, layout);
    if (layoutCache.size > MAX_CACHE_ENTRIES) layoutCache.delete(layoutCache.keys().next().value);
    return layout;
  }

  function renderStaffLines(xStart, xEnd, staffTop, spacing) {
    return Array.from({ length: 5 }, (_, line) => {
      const y = staffTop + line * spacing;
      return `<line x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}" class="midi-score-staff-line"/>`;
    }).join('');
  }

  function measureForTick(measures, tick) {
    const safe = Math.max(0, number(tick, 0));
    return measures.find((measure, index) => {
      const last = index === measures.length - 1;
      return safe >= measure.startTick && (safe < measure.endTick || last);
    }) || measures[measures.length - 1] || null;
  }

  function tickToX(layout, tick) {
    const measure = measureForTick(layout.measures, tick);
    if (!measure) return LEFT_PADDING;
    const ratio = Math.max(0, Math.min(1,
      (number(tick, 0) - measure.startTick) / Math.max(1, measure.endTick - measure.startTick)
    ));
    return measure.x + ratio * measure.width;
  }

  function activeTickFor(score, options) {
    if (Number.isFinite(Number(options?.activeTick))) return Number(options.activeTick);
    const seconds = Number(options?.activeTime);
    if (!Number.isFinite(seconds)) return null;
    const midiScore = options?.midiScore;
    if (midiScore?.conversions?.secondsToTick) return midiScore.conversions.secondsToTick(seconds);
    return null;
  }

  function renderChords(chords, layout) {
    if (!Array.isArray(chords)) return '';
    return chords.map(chord => {
      const tick = number(chord.tick ?? chord.startTick, 0);
      const x = tickToX(layout, tick);
      const measure = measureForTick(layout.measures, tick);
      const y = (measure?.staffTop || SYSTEM_TOP) - 26;
      return `<text x="${x}" y="${y}" class="midi-score-chord-label">${escapeXml(chord.text || chord.name || '')}</text>`;
    }).join('');
  }

  function renderSvg(scoreInput, partId, options = {}) {
    const score = normalizeScore(scoreInput);
    if (!score) return '';
    const layout = getCachedLayout(score, partId, options);
    if (!layout) return '';
    const activeTick = activeTickFor(score, options);
    const svg = [
      `<svg class="midi-score-svg musicxml-score-svg" xmlns="http://www.w3.org/2000/svg" ` +
      `viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" ` +
      `role="img" aria-label="${escapeXml(options.ariaLabel || 'MusicXML score')}">`
    ];
    layout.systems.forEach(system => {
      const endX = system.measures[system.measures.length - 1].x + system.measures[system.measures.length - 1].width;
      svg.push(`<g class="midi-score-system musicxml-score-system" data-system="${system.index}">`);
      for (let staff = 0; staff < system.staffCount; staff += 1) {
        svg.push(renderStaffLines(LEFT_PADDING, endX, system.staffTop + staff * STAFF_BLOCK, layout.staffSpacing));
      }
      system.measures.forEach(measure => {
        svg.push(`<g class="midi-score-measure musicxml-score-measure" data-measure="${escapeXml(measure.number)}">`);
        svg.push(`<text x="${measure.x + 4}" y="${measure.staffTop - 10}" class="midi-score-measure-number">${escapeXml(measure.number)}</text>`);
        svg.push(`<line x1="${measure.x}" y1="${measure.staffTop - 5}" x2="${measure.x}" y2="${measure.staffTop + system.staffCount * STAFF_BLOCK - 44}" class="midi-score-barline"/>`);
        svg.push(renderHeader(score, measure, system.index, layout));
        measure.notes.forEach(note => {
          svg.push(note.rest
            ? `<g class="midi-score-rest" data-note-id="${escapeXml(note.id)}">${renderRest(note)}</g>`
            : renderNote(note, layout.staffSpacing, activeTick));
        });
        svg.push(renderBeamGroups(measure.notes.filter(note => !note.rest), layout.staffSpacing));
        svg.push(renderTies(measure.notes));
        svg.push(renderSlurs(measure.notes));
        svg.push('</g>');
        if (measure === system.measures[system.measures.length - 1]) {
          svg.push(`<line x1="${measure.x + measure.width}" y1="${measure.staffTop - 5}" x2="${measure.x + measure.width}" y2="${measure.staffTop + system.staffCount * STAFF_BLOCK - 44}" class="midi-score-barline midi-score-final-barline"/>`);
        }
      });
      svg.push('</g>');
    });
    svg.push(renderChords(options.chords, layout));
    if (Number.isFinite(activeTick)) {
      const measure = measureForTick(layout.measures, activeTick);
      const x = tickToX(layout, activeTick);
      const top = measure?.staffTop || SYSTEM_TOP;
      const system = layout.systems[measure?.systemIndex || 0];
      const bottom = top + (system?.staffCount || 1) * STAFF_BLOCK - 44;
      svg.push(`<line x1="${x}" y1="${top - 25}" x2="${x}" y2="${bottom + 20}" class="midi-score-playhead" data-score-playhead="true"/>`);
    }
    svg.push('</svg>');
    return svg.join('');
  }

  function getPlayheadX(scoreInput, partId, seconds, options = {}) {
    const score = normalizeScore(scoreInput);
    if (!score) return 0;
    const layout = getCachedLayout(score, partId, options);
    if (!layout) return 0;
    const midiScore = options.midiScore;
    const tick = Number.isFinite(Number(options.activeTick))
      ? Number(options.activeTick)
      : midiScore?.conversions?.secondsToTick
        ? midiScore.conversions.secondsToTick(seconds)
        : number(options.activeTick, 0);
    return tickToX(layout, tick);
  }

  function clearCache() {
    layoutCache.clear();
  }

  const api = Object.freeze({
    buildLayout,
    getCachedLayout,
    renderSvg,
    getPlayheadX,
    clearCache,
    keyLabel
  });
  globalScope.MusicXmlScoreRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
