/**
 * MidiScoreRenderer
 *
 * Read-only music-notation renderer.  The renderer consumes the normalized
 * MIDI model and keeps all musical positions in ticks; pixels are only a
 * presentation layer.  It deliberately owns no clock and no editing state.
 */
(function attachMidiScoreRenderer(globalScope) {
  'use strict';

  const layoutCache = new Map();
  const MAX_CACHE_ENTRIES = 32;
  const STAFF_SPACING = 12;
  const MEASURE_WIDTH = 250;
  const MEASURES_PER_SYSTEM = 4;
  const SYSTEM_HEADER_WIDTH = 96;
  const SYSTEM_HEIGHT = 176;
  const LEFT_PADDING = 18;
  const RIGHT_PADDING = 28;
  const TOP_PADDING = 62;
  const BOTTOM_PADDING = 34;

  const LETTER_INDEX = Object.freeze({ C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 });
  const SPELLINGS = Object.freeze([
    { letter: 'C', accidental: '' },
    { letter: 'C', accidental: 'sharp' },
    { letter: 'D', accidental: '' },
    { letter: 'D', accidental: 'sharp' },
    { letter: 'E', accidental: '' },
    { letter: 'F', accidental: '' },
    { letter: 'F', accidental: 'sharp' },
    { letter: 'G', accidental: '' },
    { letter: 'G', accidental: 'sharp' },
    { letter: 'A', accidental: '' },
    { letter: 'A', accidental: 'sharp' },
    { letter: 'B', accidental: '' }
  ]);
  // Staff steps for the treble clef (E4 is step 0).  Key signatures are
  // placed in the conventional order, rather than by MIDI pitch class.
  const SHARP_ORDER = Object.freeze([8, 5, 9, 6, 10, 7, 11]);
  const FLAT_ORDER = Object.freeze([4, 7, 3, 6, 2, 5, 1]);
  const SHARP_KEY_LETTERS = Object.freeze(['F', 'C', 'G', 'D', 'A', 'E', 'B']);
  const FLAT_KEY_LETTERS = Object.freeze(['B', 'E', 'A', 'D', 'G', 'C', 'F']);
  const MAJOR_KEYS = Object.freeze([
    'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C',
    'G', 'D', 'A', 'E', 'B', 'F#', 'C#'
  ]);
  const MINOR_KEYS = Object.freeze([
    'Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am',
    'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'
  ]);
  const MAJOR_ROOT_TO_SF = Object.freeze({
    0: 0, 1: -5, 2: 2, 3: -3, 4: 4, 5: -1,
    6: 6, 7: 1, 8: -4, 9: 3, 10: -2, 11: 5
  });
  const MINOR_ROOT_TO_SF = Object.freeze({
    0: 0, 1: -5, 2: 2, 3: -3, 4: 4, 5: -1,
    6: 6, 7: 1, 8: -4, 9: 3, 10: -2, 11: 5
  });
  const MAJOR_PROFILE = Object.freeze([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]);
  const MINOR_PROFILE = Object.freeze([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]);

  function escapeXml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function normalizeScore(score) {
    return globalScope.MidiScoreModel?.normalize?.(score) || score;
  }

  function inferKeySignature(score) {
    const histogram = Array(12).fill(0);
    let noteCount = 0;
    (score?.tracks || []).forEach(track => (track.notes || []).forEach(note => {
      const pitch = Math.max(0, Math.min(127, Math.round(Number(note.pitch) || 60)));
      const weight = Math.max(1, Number(note.durationTicks) || 1);
      histogram[pitch % 12] += weight;
      noteCount += 1;
    }));
    if (!noteCount) return { tick: 0, sharpsFlats: 0, minor: false, inferred: true };

    let best = { score: -Infinity, sharpsFlats: 0, minor: false };
    [[false, MAJOR_PROFILE, MAJOR_ROOT_TO_SF], [true, MINOR_PROFILE, MINOR_ROOT_TO_SF]]
      .forEach(([minor, profile, rootMap]) => {
        for (let root = 0; root < 12; root += 1) {
          let scoreValue = 0;
          for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
            scoreValue += histogram[pitchClass] * profile[(pitchClass - root + 12) % 12];
          }
          if (scoreValue > best.score) {
            best = { score: scoreValue, sharpsFlats: rootMap[root], minor };
          }
        }
      });
    return { tick: 0, sharpsFlats: best.sharpsFlats, minor: best.minor, inferred: true };
  }

  function keySignatureAtTick(score, tick) {
    const events = Array.isArray(score?.keySignatures) ? score.keySignatures : [];
    let result = events[0] || inferKeySignature(score);
    events.forEach(event => {
      if (Number(event.tick) <= tick) result = event;
    });
    return result;
  }

  function getKeySignatureLabel(score, tick = 0) {
    const key = keySignatureAtTick(score, tick);
    const index = Math.max(-7, Math.min(7, Number(key.sharpsFlats) || 0)) + 7;
    return (key.minor ? MINOR_KEYS[index] : MAJOR_KEYS[index]) || 'C';
  }

  function createMeasures(score, width) {
    const endTick = Math.max(0, Number(score?.endTick) || 0);
    const meterSegments = Array.isArray(score?.meterMap?.segments)
      ? score.meterMap.segments
      : [];
    const measures = [];

    if (!meterSegments.length) {
      measures.push({
        number: 1,
        startTick: 0,
        endTick: Math.max(1, endTick),
        numerator: 4,
        denominator: 4,
        beatTicks: 480,
        measureTicks: 1920,
        width
      });
      return measures;
    }

    meterSegments.forEach((meter, meterIndex) => {
      const nextStart = meterIndex + 1 < meterSegments.length
        ? Number(meterSegments[meterIndex + 1].startTick) || 0
        : endTick;
      const segmentEnd = Math.max(Number(meter.startTick) || 0, nextStart);
      const measureTicks = Math.max(1, Number(meter.measureTicks) || 1);
      let cursor = Math.max(0, Number(meter.startTick) || 0);
      let number = Math.max(1, Number(meter.startBar) || 1);

      while (cursor < segmentEnd || (measures.length === 0 && cursor === 0)) {
        const end = Math.max(cursor + 1, Math.min(segmentEnd, cursor + measureTicks));
        measures.push({
          number,
          startTick: cursor,
          endTick: end,
          numerator: Math.max(1, Number(meter.numerator) || 4),
          denominator: Math.max(1, Number(meter.denominator) || 4),
          beatTicks: Math.max(1, Number(meter.beatTicks) || measureTicks / Math.max(1, Number(meter.numerator) || 4)),
          measureTicks,
          width
        });
        cursor += measureTicks;
        number += 1;
        if (cursor >= segmentEnd) break;
      }
    });

    return measures.length ? measures : [{
      number: 1,
      startTick: 0,
      endTick: Math.max(1, endTick),
      numerator: 4,
      denominator: 4,
      beatTicks: 480,
      measureTicks: 1920,
      width
    }];
  }

  function measureForTick(measures, tick) {
    const safeTick = Math.max(0, Number(tick) || 0);
    return measures.find((measure, index) => {
      const isLast = index === measures.length - 1;
      return safeTick >= measure.startTick &&
        (safeTick < measure.endTick || isLast);
    }) || measures[measures.length - 1];
  }

  function pitchSpelling(pitch, key = null) {
    const midi = Math.max(0, Math.min(127, Math.round(Number(pitch) || 60)));
    const pitchClass = midi % 12;
    const flatKey = Number(key?.sharpsFlats) < 0;
    if (flatKey) {
      const flatSpellings = [
        { letter: 'C', accidental: '' },
        { letter: 'D', accidental: 'flat' },
        { letter: 'D', accidental: '' },
        { letter: 'E', accidental: 'flat' },
        { letter: 'E', accidental: '' },
        { letter: 'F', accidental: '' },
        { letter: 'G', accidental: 'flat' },
        { letter: 'G', accidental: '' },
        { letter: 'A', accidental: 'flat' },
        { letter: 'A', accidental: '' },
        { letter: 'B', accidental: 'flat' },
        { letter: 'B', accidental: '' }
      ];
      return flatSpellings[pitchClass];
    }
    return SPELLINGS[pitchClass];
  }

  function pitchStaffStep(pitch, key = null) {
    const midi = Math.max(0, Math.min(127, Math.round(Number(pitch) || 60)));
    const spelling = pitchSpelling(midi, key);
    const octave = Math.floor(midi / 12) - 1;
    // E4 is the bottom line of a treble staff (step 0).
    return (octave - 4) * 7 + LETTER_INDEX[spelling.letter] - LETTER_INDEX.E;
  }

  function pitchToY(pitch, staffTop, spacing) {
    return staffTop + spacing * 4 - pitchStaffStep(pitch) * (spacing / 2);
  }

  function durationType(note, measure, score) {
    // Notated values are independent of the meter's beat unit.  In 6/8 a
    // quarter still lasts one quarter-note (PPQN), while the grid beat is an
    // eighth.  The old renderer compared against beatTicks and consequently
    // drew quarter notes as half notes in every x/8 signature.
    const quarterTicks = score?.division?.type === 'ppqn'
      ? Math.max(1, Number(score.division.ticksPerQuarter) || 480)
      : Math.max(1, Number(measure.beatTicks) || 1) *
        Math.max(1, Number(measure.denominator) || 4) / 4;
    const duration = Math.max(1, Number(note.durationTicks) || quarterTicks);
    const values = [
      ['whole', quarterTicks * 4],
      ['half', quarterTicks * 2],
      ['quarter', quarterTicks],
      ['eighth', quarterTicks / 2]
    ];
    for (const [type, threshold] of values) {
      if (duration >= threshold * 0.82) return type;
    }
    return 'sixteenth';
  }

  function noteX(measure, note) {
    const ratio = Math.max(0, Math.min(1,
      (Number(note.startTick) - measure.startTick) /
      Math.max(1, measure.endTick - measure.startTick)
    ));
    const left = measure.x + 18;
    const right = measure.x + measure.width - 18;
    return left + ratio * Math.max(20, right - left);
  }

  function noteSignature(score, partId) {
    const track = globalScope.MidiScoreModel?.getPartTrack?.(score, partId) || score?.tracks?.[0];
    return (track?.notes || []).map(note => [
      note.id, note.startTick, note.endTick, note.pitch, note.durationTicks
    ]).join('|');
  }

  function scoreKey(score, partId, options) {
    return JSON.stringify([
      score?.schemaVersion,
      score?.endTick,
      partId,
      options?.measureWidth || MEASURE_WIDTH,
      options?.staffSpacing || STAFF_SPACING,
      options?.measuresPerSystem || MEASURES_PER_SYSTEM,
      score?.meterMap?.events || [],
      score?.keySignatures || [],
      noteSignature(score, partId)
    ]);
  }

  function buildLayout(scoreInput, partId, options = {}) {
    const score = normalizeScore(scoreInput);
    if (!score) return null;
    const width = Math.max(180, Number(options.measureWidth) || MEASURE_WIDTH);
    const spacing = Math.max(8, Number(options.staffSpacing) || STAFF_SPACING);
    const measuresPerSystem = Math.max(1, Math.trunc(Number(options.measuresPerSystem) || MEASURES_PER_SYSTEM));
    const measures = createMeasures(score, width);
    const systems = [];
    const track = globalScope.MidiScoreModel?.getPartTrack?.(score, partId) ||
      score.tracks?.[0] || { notes: [] };
    const notes = Array.isArray(track.notes) ? track.notes : [];

    for (let index = 0; index < measures.length; index += measuresPerSystem) {
      const systemMeasures = measures.slice(index, index + measuresPerSystem);
      const systemIndex = systems.length;
      const staffTop = TOP_PADDING + systemIndex * SYSTEM_HEIGHT;
      const system = {
        index: systemIndex,
        staffTop,
        measures: systemMeasures,
        width: LEFT_PADDING + SYSTEM_HEADER_WIDTH +
          systemMeasures.length * width + RIGHT_PADDING
      };
      systemMeasures.forEach((measure, indexInSystem) => {
        measure.systemIndex = systemIndex;
        measure.indexInSystem = indexInSystem;
        measure.firstInSystem = indexInSystem === 0;
        measure.x = LEFT_PADDING + SYSTEM_HEADER_WIDTH + indexInSystem * width;
        measure.staffTop = staffTop;
        measure.staffSpacing = spacing;
        measure.keySignature = keySignatureAtTick(score, measure.startTick);
        measure.notes = [];
      });
      systems.push(system);
    }

    const noteColumns = new Map();
    notes.forEach(note => {
      const measure = measureForTick(measures, note.startTick);
      if (!measure) return;
      const key = `${measure.systemIndex}:${measure.number}:${note.startTick}`;
      const column = noteColumns.get(key) || 0;
      noteColumns.set(key, column + 1);
      const step = pitchStaffStep(note.pitch, measure.keySignature);
      measure.notes.push({
        id: note.id,
        pitch: note.pitch,
        velocity: note.velocity,
        startTick: note.startTick,
        endTick: note.endTick,
        durationTicks: note.durationTicks,
        durationType: durationType(note, measure, score),
        staffStep: step,
        x: noteX(measure, note) + column * 13,
        y: pitchToY(note.pitch, measure.staffTop, spacing),
        barBeat: note.barBeat || null,
        keySignature: measure.keySignature
      });
    });

    const height = TOP_PADDING + systems.length * SYSTEM_HEIGHT + BOTTOM_PADDING;
    const systemWidth = LEFT_PADDING + SYSTEM_HEADER_WIDTH +
      Math.min(measuresPerSystem, Math.max(1, measures.length)) * width + RIGHT_PADDING;
    return {
      partId,
      measureWidth: width,
      staffSpacing: spacing,
      measuresPerSystem,
      width: Math.max(systemWidth, ...systems.map(system => system.width)),
      height,
      measures,
      systems,
      endTick: score.endTick,
      trackId: track.id || null,
      noteCount: notes.length
    };
  }

  function getCachedLayout(score, partId, options = {}) {
    const key = scoreKey(score, partId, options);
    const cached = layoutCache.get(key);
    if (cached) return cached;
    const layout = buildLayout(score, partId, options);
    if (!layout) return null;
    layoutCache.set(key, layout);
    if (layoutCache.size > MAX_CACHE_ENTRIES) {
      layoutCache.delete(layoutCache.keys().next().value);
    }
    return layout;
  }

  function renderStaffLines(xStart, xEnd, staffTop, spacing) {
    return Array.from({ length: 5 }, (_, line) => {
      const y = staffTop + line * spacing;
      return `<line x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}" class="midi-score-staff-line"/>`;
    }).join('');
  }

  function renderLedgerLines(note, spacing) {
    const lines = [];
    if (note.staffStep < 0) {
      for (let step = -2; step >= note.staffStep; step -= 2) {
        lines.push(`<line x1="${note.x - 10}" y1="${note.y + (note.staffStep - step) * spacing / 2}" x2="${note.x + 10}" y2="${note.y + (note.staffStep - step) * spacing / 2}" class="midi-score-ledger-line"/>`);
      }
    } else if (note.staffStep > 8) {
      for (let step = 10; step <= note.staffStep; step += 2) {
        lines.push(`<line x1="${note.x - 10}" y1="${note.y - (step - note.staffStep) * spacing / 2}" x2="${note.x + 10}" y2="${note.y - (step - note.staffStep) * spacing / 2}" class="midi-score-ledger-line"/>`);
      }
    }
    return lines.join('');
  }

  function keyAccidentalMap(key) {
    const count = Math.max(-7, Math.min(7, Number(key?.sharpsFlats) || 0));
    const result = Object.create(null);
    const letters = count > 0 ? SHARP_KEY_LETTERS : FLAT_KEY_LETTERS;
    const accidental = count > 0 ? 'sharp' : 'flat';
    letters.slice(0, Math.abs(count)).forEach(letter => { result[letter] = accidental; });
    return result;
  }

  function renderSharp(x, y, className = 'midi-score-accidental') {
    return `<path d="M ${x + 2} ${y - 10} V ${y + 10} M ${x + 9} ${y - 11} V ${y + 9} ` +
      `M ${x - 1} ${y - 2} H ${x + 13} M ${x - 1} ${y + 4} H ${x + 13}" ` +
      `class="${className}"/>`;
  }

  function renderFlat(x, y, className = 'midi-score-accidental') {
    return `<path d="M ${x + 2} ${y - 11} V ${y + 10} ` +
      `M ${x + 2} ${y + 1} C ${x + 13} ${y - 5}, ${x + 13} ${y + 9}, ${x + 3} ${y + 9} ` +
      `C ${x - 2} ${y + 9}, ${x - 2} ${y + 2}, ${x + 2} ${y + 1}" ` +
      `class="${className}"/>`;
  }

  function renderNatural(x, y, className = 'midi-score-accidental') {
    return `<path d="M ${x + 2} ${y - 10} V ${y + 10} M ${x + 9} ${y - 12} V ${y + 8} ` +
      `M ${x + 2} ${y - 2} L ${x + 9} ${y - 5} M ${x + 2} ${y + 4} L ${x + 9} ${y + 1}" ` +
      `class="${className}"/>`;
  }

  function renderAccidental(note, measure) {
    const keyMap = keyAccidentalMap(measure?.keySignature);
    const spelling = pitchSpelling(note.pitch, measure?.keySignature);
    const expected = keyMap[spelling.letter] || '';
    const accidental = spelling.accidental || '';
    if (accidental === expected) return '';
    if (accidental === 'sharp') return renderSharp(note.x - 20, note.y);
    if (accidental === 'flat') return renderFlat(note.x - 20, note.y);
    return expected ? renderNatural(note.x - 20, note.y) : '';
  }

  function renderNote(note, spacing, activeTick) {
    const active = Number.isFinite(activeTick) &&
      activeTick >= note.startTick && activeTick < note.endTick;
    const noteClass = active
      ? 'midi-score-note midi-score-note-active'
      : 'midi-score-note';
    const open = note.durationType === 'whole' || note.durationType === 'half';
    const stemUp = note.staffStep <= 4;
    const stemX = stemUp ? note.x + 5.8 : note.x - 5.8;
    const stemEnd = stemUp
      ? note.y - spacing * 3.5
      : note.y + spacing * 3.5;
    const rotate = stemUp ? -20 : 20;
    const stem = note.durationType === 'whole'
      ? ''
      : `<line x1="${stemX}" y1="${note.y}" x2="${stemX}" y2="${stemEnd}" class="midi-score-stem"/>`;
    const flag = note.durationType === 'eighth' || note.durationType === 'sixteenth'
      ? `<path d="M ${stemX} ${stemEnd} q ${stemUp ? 16 : -16} 7 ${stemUp ? 10 : -10} 18" class="midi-score-flag"/>`
      : '';
    const extraFlag = note.durationType === 'sixteenth'
      ? `<path d="M ${stemX} ${stemEnd + (stemUp ? 9 : -9)} q ${stemUp ? 13 : -13} 6 ${stemUp ? 8 : -8} 15" class="midi-score-flag"/>`
      : '';
    return `<g class="${noteClass}" data-note-id="${escapeXml(note.id)}">` +
      renderLedgerLines(note, spacing) +
      renderAccidental(note, { keySignature: note.keySignature }) +
      `<ellipse cx="${note.x}" cy="${note.y}" rx="7" ry="5" ` +
      `transform="rotate(${rotate} ${note.x} ${note.y})" ` +
      `class="midi-score-notehead${open ? ' midi-score-notehead-open' : ''}"/>` +
      stem + flag + extraFlag +
      '</g>';
  }

  function renderRest(measure) {
    const x = measure.x + measure.width / 2;
    const y = measure.staffTop + measure.staffSpacing * 2;
    return `<g class="midi-score-rest" aria-label="rest">` +
      `<rect x="${x - 10}" y="${y - 4}" width="20" height="7" rx="1"/>` +
      `<line x1="${x - 10}" y1="${y - 4}" x2="${x + 10}" y2="${y - 4}"/>` +
      '</g>';
  }

  function renderTrebleClef(x, staffTop) {
    // Draw the G-clef as paths so it remains visible when no music font is
    // installed on the host OS (Electron machines commonly lack Bravura).
    return `<g class="midi-score-clef" aria-label="treble clef" transform="translate(${x} ${staffTop - 13}) scale(.64)">` +
      `<path d="M 38 0 C 25 10 21 25 28 35 C 35 45 50 41 54 30 ` +
      `C 58 19 50 10 39 12 C 29 14 27 24 34 29 C 40 33 48 29 48 23 ` +
      `M 39 0 C 34 16 36 30 32 46 C 28 62 17 70 18 80 ` +
      `C 19 90 31 94 41 88 C 51 82 51 72 44 66 C 37 61 30 65 28 71 ` +
      `M 39 0 L 39 90"/>` +
      `<circle cx="39" cy="90" r="2.8"/>` +
      '</g>';
  }

  function renderClefAndSignature(score, measure, systemIndex) {
    if (!measure.firstInSystem) return '';
    const x = measure.x;
    const staffTop = measure.staffTop;
    const spacing = measure.staffSpacing || STAFF_SPACING;
    const headerX = x - SYSTEM_HEADER_WIDTH;
    const key = measure.keySignature || keySignatureAtTick(score, measure.startTick);
    const count = Math.max(-7, Math.min(7, Number(key.sharpsFlats) || 0));
    const parts = [renderTrebleClef(headerX + 8, staffTop)];
    const symbols = count > 0 ? SHARP_ORDER.slice(0, count) : FLAT_ORDER.slice(0, Math.abs(count));
    symbols.forEach((step, index) => {
      const y = staffTop + 4 * spacing - step * (spacing / 2);
      const symbolX = headerX + 43 + index * 11;
      parts.push(count > 0
        ? renderSharp(symbolX, y, 'midi-score-key-symbol')
        : renderFlat(symbolX, y, 'midi-score-key-symbol'));
    });
    const signatureX = headerX + 42 + symbols.length * 11;
    parts.push(`<text x="${signatureX + 8}" y="${staffTop + 14}" class="midi-score-time-signature">${measure.numerator}</text>`);
    parts.push(`<text x="${signatureX + 8}" y="${staffTop + 36}" class="midi-score-time-signature">${measure.denominator}</text>`);
    if (systemIndex === 0) {
      const tempo = score?.tempoMap?.events?.[0]?.bpm;
      const keyLabel = getKeySignatureLabel(score, measure.startTick);
      parts.push(`<text x="${headerX}" y="${staffTop - 34}" class="midi-score-system-label">` +
        `${tempo ? '&#x2669;=' + Math.round(tempo) + ' &#xB7; ' : ''}${escapeXml(keyLabel)}</text>`);
    }
    return parts.join('');
  }

  function tickToX(layout, tick) {
    const measure = measureForTick(layout.measures, tick);
    if (!measure) return LEFT_PADDING;
    const ratio = Math.max(0, Math.min(1,
      (Number(tick) - measure.startTick) /
      Math.max(1, measure.endTick - measure.startTick)
    ));
    return measure.x + ratio * measure.width;
  }

  function activeTickFor(score, seconds, options = {}) {
    const explicitTick = Number(options.activeTick);
    if (Number.isFinite(explicitTick)) return explicitTick;
    const activeTime = Number(seconds);
    return Number.isFinite(activeTime) && score.conversions?.secondsToTick
      ? score.conversions.secondsToTick(activeTime)
      : null;
  }

  function renderSvg(scoreInput, partId, options = {}) {
    const score = normalizeScore(scoreInput);
    if (!score) return '';
    const layout = getCachedLayout(score, partId, options);
    if (!layout) return '';
    const activeTick = activeTickFor(score, options.activeTime, options);
    const parts = [
      `<svg class="midi-score-svg" xmlns="http://www.w3.org/2000/svg" ` +
      `viewBox="0 0 ${layout.width} ${layout.height}" ` +
      `width="${layout.width}" height="${layout.height}" role="img" ` +
      `aria-label="${escapeXml(options.ariaLabel || 'MIDI score')}">`
    ];

    layout.systems.forEach(system => {
      const systemEnd = system.measures[system.measures.length - 1].x + system.measures[system.measures.length - 1].width;
      parts.push(`<g class="midi-score-system" data-system="${system.index}">`);
      parts.push(renderStaffLines(LEFT_PADDING, systemEnd, system.staffTop, layout.staffSpacing));
      system.measures.forEach(measure => {
        const x = measure.x;
        const endX = x + measure.width;
        parts.push(`<g class="midi-score-measure" data-measure="${measure.number}">`);
        parts.push(`<text x="${x + 4}" y="${measure.staffTop - 10}" class="midi-score-measure-number">${measure.number}</text>`);
        parts.push(`<line x1="${x}" y1="${measure.staffTop - 5}" x2="${x}" y2="${measure.staffTop + layout.staffSpacing * 4 + 6}" class="midi-score-barline"/>`);
        parts.push(renderClefAndSignature(score, measure, system.index));
        measure.notes.forEach(note => parts.push(renderNote(
          note,
          layout.staffSpacing,
          activeTick
        )));
        if (measure.notes.length === 0) parts.push(renderRest({ ...measure, staffSpacing: layout.staffSpacing }));
        parts.push('</g>');
        if (measure === system.measures[system.measures.length - 1]) {
          parts.push(`<line x1="${endX}" y1="${measure.staffTop - 5}" x2="${endX}" y2="${measure.staffTop + layout.staffSpacing * 4 + 6}" class="midi-score-barline midi-score-final-barline"/>`);
        }
      });
      parts.push('</g>');
    });

    if (Number.isFinite(activeTick)) {
      const measure = measureForTick(layout.measures, activeTick);
      const x = tickToX(layout, activeTick);
      const staffTop = measure?.staffTop || TOP_PADDING;
      parts.push(`<line x1="${x}" y1="${staffTop - 24}" x2="${x}" y2="${staffTop + layout.staffSpacing * 4 + 24}" class="midi-score-playhead" data-score-playhead="true"/>`);
    }
    parts.push('</svg>');
    return parts.join('');
  }

  function getPlayheadX(scoreInput, partId, seconds, options = {}) {
    const score = normalizeScore(scoreInput);
    if (!score) return 0;
    const layout = getCachedLayout(score, partId, options);
    if (!layout) return 0;
    return tickToX(layout, activeTickFor(score, seconds, options));
  }

  function getPlayheadPosition(scoreInput, partId, seconds, options = {}) {
    const score = normalizeScore(scoreInput);
    const layout = score ? getCachedLayout(score, partId, options) : null;
    const tick = score ? activeTickFor(score, seconds, options) : null;
    if (!layout || !Number.isFinite(tick)) {
      return {
        tick: Number.isFinite(tick) ? tick : 0,
        x: LEFT_PADDING,
        yTop: TOP_PADDING - 24,
        staffTop: TOP_PADDING,
        yBottom: TOP_PADDING + STAFF_SPACING * 4 + 24,
        systemIndex: 0,
        systemChanged: false
      };
    }
    const measure = measureForTick(layout.measures, tick);
    const staffTop = measure?.staffTop || TOP_PADDING;
    return {
      tick,
      x: tickToX(layout, tick),
      yTop: staffTop - 24,
      staffTop,
      yBottom: staffTop + layout.staffSpacing * 4 + 24,
      systemIndex: measure?.systemIndex || 0,
      systemChanged: false
    };
  }

  function clearCache() {
    layoutCache.clear();
  }

  const api = Object.freeze({
    buildLayout,
    getCachedLayout,
    renderSvg,
    getPlayheadX,
    getPlayheadPosition,
    getKeySignatureLabel,
    clearCache
  });
  globalScope.MidiScoreRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
