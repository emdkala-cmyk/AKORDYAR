/**
 * MusicXmlScoreParser
 *
 * Read-only MusicXML normalizer.  MusicXML owns written notation and layout;
 * MIDI remains the timing authority in the rest of the application.  This
 * parser intentionally has no DOM or UI dependency so the same implementation
 * can run in Electron, a browser window and Node-based tests.
 */
(function attachMusicXmlScoreParser(globalScope) {
  'use strict';

  const DEFAULT_PPQN = 480;
  const DEFAULT_DIVISIONS = 1;
  const DEFAULT_TIME = Object.freeze({ beats: 4, beatType: 4, symbol: null });
  const STEP_TO_SEMITONE = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });

  function fail(message) {
    throw new Error(`Invalid MusicXML: ${message}`);
  }

  function decodeEntities(value) {
    return String(value ?? '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        try { return String.fromCodePoint(parseInt(hex, 16)); } catch (_) { return ''; }
      })
      .replace(/&#([0-9]+);/g, (_, decimal) => {
        try { return String.fromCodePoint(parseInt(decimal, 10)); } catch (_) { return ''; }
      });
  }

  function localName(name) {
    const value = String(name || '');
    const index = value.indexOf(':');
    return (index >= 0 ? value.slice(index + 1) : value).toLowerCase();
  }

  function parseAttributes(source) {
    const attrs = {};
    const pattern = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let match;
    while ((match = pattern.exec(source))) {
      attrs[localName(match[1])] = decodeEntities(match[3] ?? match[4] ?? '');
    }
    return attrs;
  }

  /**
   * Small well-formed XML tree reader.  MusicXML is deliberately XML 1.0 and
   * this reader covers elements, attributes, comments, processing
   * instructions and CDATA without relying on browser-only DOMParser.
   */
  function parseXmlTree(xml) {
    const source = String(xml ?? '').replace(/^\uFEFF/, '');
    if (!source.trim()) fail('empty document');
    const documentNode = { name: '#document', attrs: {}, children: [], text: '' };
    const stack = [documentNode];
    const tokenPattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/[^>]+>|<[^>]+>|[^<]+/g;
    let match;
    while ((match = tokenPattern.exec(source))) {
      const token = match[0];
      const parent = stack[stack.length - 1];
      if (token.startsWith('<!--') || token.startsWith('<?')) continue;
      if (token.startsWith('<![CDATA[')) {
        parent.text += token.slice(9, -3);
        continue;
      }
      if (token[0] !== '<') {
        parent.text += decodeEntities(token);
        continue;
      }
      if (token.startsWith('</')) {
        const closeName = localName(token.slice(2, -1).trim());
        if (stack.length <= 1 || localName(stack[stack.length - 1].name) !== closeName) {
          fail(`mismatched closing tag </${closeName}>`);
        }
        stack.pop();
        continue;
      }
      if (token.startsWith('<!')) continue;

      const body = token.slice(1, -1);
      const selfClosing = /\/\s*$/.test(body);
      const openBody = selfClosing ? body.replace(/\/\s*$/, '') : body;
      const nameMatch = openBody.match(/^\s*([A-Za-z_][\w:.-]*)/);
      if (!nameMatch) fail('malformed element');
      const node = {
        name: nameMatch[1],
        attrs: parseAttributes(openBody.slice(nameMatch[0].length)),
        children: [],
        text: ''
      };
      parent.children.push(node);
      if (!selfClosing) stack.push(node);
    }
    if (stack.length !== 1) fail(`unclosed element <${stack[stack.length - 1].name}>`);
    const root = documentNode.children.find(node => node && node.name !== '#text');
    if (!root) fail('missing root element');
    return root;
  }

  function elementChildren(node, name) {
    const expected = name ? localName(name) : null;
    return (node?.children || []).filter(child =>
      child && (!expected || localName(child.name) === expected)
    );
  }

  function firstChild(node, name) {
    return elementChildren(node, name)[0] || null;
  }

  function textOf(node, fallback = '') {
    if (!node) return fallback;
    let value = node.text || '';
    (node.children || []).forEach(child => {
      value += textOf(child, '');
    });
    const result = value.trim();
    return result || fallback;
  }

  function numberOf(node, fallback = 0) {
    const value = Number(textOf(node, ''));
    return Number.isFinite(value) ? value : fallback;
  }

  function integerOf(node, fallback = 0) {
    const value = Math.trunc(numberOf(node, fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  function boolAttr(node, name) {
    const value = String(node?.attrs?.[name] || '').toLowerCase();
    return value === 'yes' || value === 'true' || value === '1';
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function safeDivision(value, fallback = DEFAULT_DIVISIONS) {
    return Math.max(1, finite(value, fallback));
  }

  function pitchToMidi(pitch) {
    if (!pitch || STEP_TO_SEMITONE[pitch.step] == null) return null;
    const octave = finite(pitch.octave, 4);
    const alter = finite(pitch.alter, 0);
    const midi = (octave + 1) * 12 + STEP_TO_SEMITONE[pitch.step] + alter;
    return Number.isFinite(midi) ? midi : null;
  }

  function parsePitch(note) {
    const pitchNode = firstChild(note, 'pitch');
    if (!pitchNode) return null;
    const step = textOf(firstChild(pitchNode, 'step'), '').toUpperCase();
    if (STEP_TO_SEMITONE[step] == null) return null;
    const pitch = {
      step,
      alter: finite(numberOf(firstChild(pitchNode, 'alter'), 0), 0),
      octave: integerOf(firstChild(pitchNode, 'octave'), 4)
    };
    pitch.midi = pitchToMidi(pitch);
    return pitch;
  }

  function parseKey(attributes) {
    const keyNode = firstChild(attributes, 'key');
    if (!keyNode) return null;
    return {
      fifths: integerOf(firstChild(keyNode, 'fifths'), 0),
      mode: textOf(firstChild(keyNode, 'mode'), 'major'),
      cancel: firstChild(keyNode, 'cancel')
        ? integerOf(firstChild(keyNode, 'cancel'), 0)
        : null
    };
  }

  function parseTime(attributes, previous = DEFAULT_TIME) {
    const timeNode = firstChild(attributes, 'time');
    if (!timeNode) return null;
    const beats = textOf(firstChild(timeNode, 'beats'), String(previous.beats || 4));
    const beatType = integerOf(firstChild(timeNode, 'beat-type'), previous.beatType || 4);
    return {
      beats,
      beatType: Math.max(1, beatType),
      symbol: timeNode.attrs?.symbol || null,
      number: timeNode.attrs?.number || null,
      senzaMisura: boolAttr(timeNode, 'symbol') && timeNode.attrs.symbol === 'senza-misura'
    };
  }

  function parseClefs(attributes, previous = []) {
    const result = [];
    elementChildren(attributes, 'clef').forEach(clefNode => {
      result.push({
        number: clefNode.attrs?.number || null,
        sign: textOf(firstChild(clefNode, 'sign'), 'G'),
        line: integerOf(firstChild(clefNode, 'line'), 2),
        octaveChange: integerOf(firstChild(clefNode, 'clef-octave-change'), 0),
        afterBarline: boolAttr(clefNode, 'after-barline')
      });
    });
    return result.length ? result : clone(previous);
  }

  function parseTranspose(attributes, previous = null) {
    const node = firstChild(attributes, 'transpose');
    if (!node) return previous ? clone(previous) : null;
    return {
      diatonic: integerOf(firstChild(node, 'diatonic'), 0),
      chromatic: integerOf(firstChild(node, 'chromatic'), 0),
      octaveChange: integerOf(firstChild(node, 'octave-change'), 0),
      double: integerOf(firstChild(node, 'double'), 0)
    };
  }

  function applyAttributes(state, attributes) {
    const next = {
      divisions: state.divisions,
      key: state.key ? clone(state.key) : null,
      time: state.time ? clone(state.time) : clone(DEFAULT_TIME),
      clefs: clone(state.clefs || []),
      transpose: state.transpose ? clone(state.transpose) : null,
      staves: state.staves
    };
    const divisionsNode = firstChild(attributes, 'divisions');
    if (divisionsNode) next.divisions = safeDivision(numberOf(divisionsNode, next.divisions));
    const key = parseKey(attributes);
    if (key) next.key = key;
    const time = parseTime(attributes, next.time);
    if (time) next.time = time;
    next.clefs = parseClefs(attributes, next.clefs);
    next.transpose = parseTranspose(attributes, next.transpose);
    const stavesNode = firstChild(attributes, 'staves');
    if (stavesNode) next.staves = Math.max(1, integerOf(stavesNode, next.staves || 1));
    return next;
  }

  function parseBeam(note) {
    const beams = {};
    elementChildren(note, 'beam').forEach(node => {
      const number = node.attrs?.number || '1';
      beams[number] = textOf(node, '');
    });
    return beams;
  }

  function parseTies(note, notations) {
    const ties = [];
    elementChildren(note, 'tie').forEach(node => {
      ties.push({ type: node.attrs?.type || 'start', number: node.attrs?.number || null });
    });
    elementChildren(notations, 'tied').forEach(node => {
      ties.push({
        type: node.attrs?.type || 'start',
        number: node.attrs?.number || null,
        orientation: node.attrs?.orientation || null,
        placement: node.attrs?.placement || null
      });
    });
    return ties;
  }

  function parseNotations(note) {
    const node = firstChild(note, 'notations');
    if (!node) return {
      ties: [],
      slurs: [],
      tuplets: [],
      articulations: [],
      ornaments: [],
      technical: [],
      fermata: null,
      arpeggiate: false,
      glissandi: [],
      slides: []
    };
    const slurs = elementChildren(node, 'slur').map(slur => ({
      type: slur.attrs?.type || 'start',
      number: slur.attrs?.number || null,
      placement: slur.attrs?.placement || null,
      orientation: slur.attrs?.orientation || null,
      bezierX: finite(slur.attrs?.['bezier-x'], null),
      bezierY: finite(slur.attrs?.['bezier-y'], null)
    }));
    const tuplets = elementChildren(node, 'tuplet').map(tuplet => ({
      type: tuplet.attrs?.type || 'start',
      number: tuplet.attrs?.number || null,
      bracket: tuplet.attrs?.bracket || null,
      placement: tuplet.attrs?.placement || null,
      showNumber: tuplet.attrs?.['show-number'] || null
    }));
    const articulationsNode = firstChild(node, 'articulations');
    const articulations = articulationsNode
      ? (articulationsNode.children || []).map(child => ({
          type: localName(child.name),
          placement: child.attrs?.placement || null,
          text: textOf(child, '')
        }))
      : [];
    const ornamentsNode = firstChild(node, 'ornaments');
    const ornaments = ornamentsNode
      ? (ornamentsNode.children || []).map(child => ({
          type: localName(child.name),
          placement: child.attrs?.placement || null,
          text: textOf(child, '')
        }))
      : [];
    const technicalNode = firstChild(node, 'technical');
    const technical = technicalNode
      ? (technicalNode.children || []).map(child => ({
          type: localName(child.name),
          placement: child.attrs?.placement || null,
          text: textOf(child, '')
        }))
      : [];
    const fermataNode = firstChild(node, 'fermata');
    return {
      ties: parseTies(note, node),
      slurs,
      tuplets,
      articulations,
      ornaments,
      technical,
      fermata: fermataNode ? {
        type: fermataNode.attrs?.type || null,
        shape: textOf(fermataNode, 'normal')
      } : null,
      arpeggiate: Boolean(firstChild(node, 'arpeggiate')),
      glissandi: elementChildren(node, 'glissando').map(child => ({
        type: child.attrs?.type || 'start',
        number: child.attrs?.number || null,
        text: textOf(child, '')
      })),
      slides: elementChildren(node, 'slide').map(child => ({
        type: child.attrs?.type || 'start',
        number: child.attrs?.number || null,
        text: textOf(child, '')
      }))
    };
  }

  function parseNote(noteNode) {
    const notations = parseNotations(noteNode);
    const restNode = firstChild(noteNode, 'rest');
    const unpitchedNode = firstChild(noteNode, 'unpitched');
    const pitch = parsePitch(noteNode);
    const durationNode = firstChild(noteNode, 'duration');
    const durationDivisions = Math.max(0, integerOf(durationNode, 0));
    const typeNode = firstChild(noteNode, 'type');
    const dots = elementChildren(noteNode, 'dot').length;
    const accidentalNode = firstChild(noteNode, 'accidental');
    const stemNode = firstChild(noteNode, 'stem');
    const instrumentNode = firstChild(noteNode, 'instrument');
    const lyricNodes = elementChildren(noteNode, 'lyric');
    return {
      id: noteNode.attrs?.id || null,
      chord: Boolean(firstChild(noteNode, 'chord')),
      grace: Boolean(firstChild(noteNode, 'grace')),
      cue: Boolean(firstChild(noteNode, 'cue')),
      rest: Boolean(restNode),
      restType: restNode?.attrs?.['measure'] === 'yes' ? 'measure' : 'normal',
      unpitched: unpitchedNode ? {
        displayStep: textOf(firstChild(unpitchedNode, 'display-step'), ''),
        displayOctave: integerOf(firstChild(unpitchedNode, 'display-octave'), 4)
      } : null,
      pitch,
      durationDivisions,
      voice: textOf(firstChild(noteNode, 'voice'), '1'),
      staff: Math.max(1, integerOf(firstChild(noteNode, 'staff'), 1)),
      type: textOf(typeNode, null),
      dots,
      accidental: accidentalNode ? {
        value: textOf(accidentalNode, ''),
        cautionary: boolAttr(accidentalNode, 'cautionary'),
        editorial: boolAttr(accidentalNode, 'editorial'),
        parentheses: boolAttr(accidentalNode, 'parentheses'),
        bracket: boolAttr(accidentalNode, 'bracket')
      } : null,
      stem: stemNode ? {
        value: textOf(stemNode, ''),
        defaultX: finite(stemNode.attrs?.['default-x'], null),
        defaultY: finite(stemNode.attrs?.['default-y'], null)
      } : null,
      beams: parseBeam(noteNode),
      ties: notations.ties,
      notations,
      instrumentId: instrumentNode?.attrs?.id || null,
      lyrics: lyricNodes.map(lyric => ({
        number: lyric.attrs?.number || null,
        name: lyric.attrs?.name || null,
        syllabic: textOf(firstChild(lyric, 'syllabic'), null),
        text: textOf(firstChild(lyric, 'text'), '')
      }))
    };
  }

  function parseBarline(node) {
    const repeat = firstChild(node, 'repeat');
    const ending = firstChild(node, 'ending');
    return {
      location: node.attrs?.location || 'right',
      style: textOf(firstChild(node, 'bar-style'), 'regular'),
      repeat: repeat ? {
        direction: repeat.attrs?.direction || null,
        times: finite(repeat.attrs?.times, null),
        winged: repeat.attrs?.winged || null
      } : null,
      ending: ending ? {
        type: ending.attrs?.type || null,
        number: ending.attrs?.number || null,
        text: textOf(ending, '')
      } : null,
      fermata: Boolean(firstChild(node, 'fermata')),
      wavyLine: Boolean(firstChild(node, 'wavy-line'))
    };
  }

  function parseLayout(node) {
    if (!node) return null;
    const pageLayout = firstChild(node, 'page-layout');
    const systemLayout = firstChild(node, 'system-layout');
    const measureLayout = firstChild(node, 'measure-layout');
    const staffLayouts = elementChildren(node, 'staff-layout').map(staff => ({
      number: staff.attrs?.number || null,
      staffDistance: finite(textOf(firstChild(staff, 'staff-distance'), ''), null)
    }));
    return {
      newPage: boolAttr(node, 'new-page'),
      newSystem: boolAttr(node, 'new-system'),
      page: pageLayout ? {
        height: finite(textOf(firstChild(pageLayout, 'page-height'), ''), null),
        width: finite(textOf(firstChild(pageLayout, 'page-width'), ''), null),
        margins: elementChildren(pageLayout, 'page-margins').map(margin => ({
          type: margin.attrs?.type || null,
          left: finite(textOf(firstChild(margin, 'left-margin'), ''), null),
          right: finite(textOf(firstChild(margin, 'right-margin'), ''), null),
          top: finite(textOf(firstChild(margin, 'top-margin'), ''), null),
          bottom: finite(textOf(firstChild(margin, 'bottom-margin'), ''), null)
        }))
      } : null,
      system: systemLayout ? {
        systemDistance: finite(textOf(firstChild(systemLayout, 'system-distance'), ''), null),
        topSystemDistance: finite(textOf(firstChild(systemLayout, 'top-system-distance'), ''), null),
        leftMargin: finite(textOf(firstChild(systemLayout, 'system-margins') && firstChild(firstChild(systemLayout, 'system-margins'), 'left-margin'), ''), null),
        rightMargin: finite(textOf(firstChild(systemLayout, 'system-margins') && firstChild(firstChild(systemLayout, 'system-margins'), 'right-margin'), ''), null)
      } : null,
      measure: measureLayout ? {
        width: finite(textOf(firstChild(measureLayout, 'measure-distance'), ''), null)
      } : null,
      staffLayouts
    };
  }

  function parseDirection(node) {
    const directionType = firstChild(node, 'direction-type');
    const metronome = firstChild(directionType, 'metronome');
    const sound = firstChild(node, 'sound');
    const tempoNode = metronome ? firstChild(metronome, 'per-minute') : null;
    const beatUnitNode = metronome ? firstChild(metronome, 'beat-unit') : null;
    const words = directionType
      ? elementChildren(directionType, 'words').map(word => textOf(word, '')).filter(Boolean)
      : [];
    return {
      placement: node.attrs?.placement || null,
      staff: finite(node.attrs?.staff, null),
      voice: finite(node.attrs?.voice, null),
      offset: finite(textOf(firstChild(node, 'offset'), ''), 0),
      words,
      rehearsal: directionType ? textOf(firstChild(directionType, 'rehearsal'), '') : '',
      dynamics: firstChild(directionType, 'dynamics')
        ? (firstChild(directionType, 'dynamics').children || []).map(child => localName(child.name))
        : [],
      tempo: sound?.attrs?.tempo != null
        ? finite(sound.attrs.tempo, null)
        : tempoNode ? finite(textOf(tempoNode, ''), null) : null,
      beatUnit: beatUnitNode ? textOf(beatUnitNode, '') : null,
      beatUnitDots: metronome ? elementChildren(metronome, 'beat-unit-dot').length : 0,
      sound: sound ? { ...sound.attrs } : null
    };
  }

  function parseScorePart(node) {
    const instruments = elementChildren(node, 'score-instrument').map(instrument => ({
      id: instrument.attrs?.id || null,
      name: textOf(firstChild(instrument, 'instrument-name'), ''),
      abbreviation: textOf(firstChild(instrument, 'instrument-abbreviation'), ''),
      sound: textOf(firstChild(instrument, 'instrument-sound'), ''),
      solo: Boolean(firstChild(instrument, 'solo')),
      ensemble: textOf(firstChild(instrument, 'ensemble'), '')
    }));
    const midiInstruments = elementChildren(node, 'midi-instrument').map(instrument => ({
      id: instrument.attrs?.id || null,
      channel: finite(textOf(firstChild(instrument, 'midi-channel'), ''), null),
      program: finite(textOf(firstChild(instrument, 'midi-program'), ''), null),
      bank: finite(textOf(firstChild(instrument, 'midi-bank'), ''), null),
      name: textOf(firstChild(instrument, 'midi-instrument-name'), ''),
      unpitched: finite(textOf(firstChild(instrument, 'midi-unpitched'), ''), null),
      volume: finite(textOf(firstChild(instrument, 'volume'), ''), null),
      pan: finite(textOf(firstChild(instrument, 'pan'), ''), null)
    }));
    return {
      id: node.attrs?.id || null,
      name: textOf(firstChild(node, 'part-name'), ''),
      abbreviation: textOf(firstChild(node, 'part-abbreviation'), ''),
      group: node.attrs?.['group-name'] || null,
      instruments,
      midiInstruments
    };
  }

  function measureDurationTicks(state, ppqn) {
    const beats = typeof state.time.beats === 'string'
      ? state.time.beats.split('+').reduce((sum, value) => sum + finite(value, 0), 0)
      : finite(state.time.beats, 4);
    const beatType = Math.max(1, finite(state.time.beatType, 4));
    return Math.max(1, Math.round(beats * 4 / beatType * ppqn));
  }

  function parsePart(partNode, partDefinition, options) {
    const ppqn = Math.max(1, finite(options.ticksPerQuarter, DEFAULT_PPQN));
    const state = {
      divisions: DEFAULT_DIVISIONS,
      key: null,
      time: clone(DEFAULT_TIME),
      clefs: [{ sign: 'G', line: 2, octaveChange: 0, number: null }],
      transpose: null,
      staves: 1
    };
    const measures = [];
    let previousMeasureDuration = measureDurationTicks(state, ppqn);

    elementChildren(partNode, 'measure').forEach((measureNode, measureIndex) => {
      const measureState = clone(state);
      const measure = {
        index: measureIndex,
        number: measureNode.attrs?.number || String(measureIndex + 1),
        implicit: boolAttr(measureNode, 'implicit'),
        nonControlling: boolAttr(measureNode, 'non-controlling'),
        width: finite(measureNode.attrs?.width, null),
        divisions: measureState.divisions,
        key: measureState.key ? clone(measureState.key) : null,
        time: clone(measureState.time),
        clefs: clone(measureState.clefs || []),
        transpose: measureState.transpose ? clone(measureState.transpose) : null,
        staves: measureState.staves,
        notes: [],
        directions: [],
        barlines: [],
        layout: null,
        relativeDurationTicks: previousMeasureDuration,
        actualDurationTicks: 0
      };
      let cursorUnits = 0;
      let maxEndTicks = 0;
      const lastStartByVoice = new Map();
      const children = measureNode.children || [];

      children.forEach(child => {
        const name = localName(child.name);
        if (name === 'attributes') {
          Object.assign(state, applyAttributes(state, child));
          measure.divisions = state.divisions;
          measure.key = state.key ? clone(state.key) : null;
          measure.time = clone(state.time);
          measure.clefs = clone(state.clefs || []);
          measure.transpose = state.transpose ? clone(state.transpose) : null;
          measure.staves = state.staves;
          return;
        }
        if (name === 'direction') {
          const direction = parseDirection(child);
          direction.relativeTick = Math.max(
            0,
            Math.round((cursorUnits + direction.offset) * ppqn / safeDivision(state.divisions))
          );
          measure.directions.push(direction);
          return;
        }
        if (name === 'print') {
          measure.layout = parseLayout(child);
          return;
        }
        if (name === 'barline') {
          measure.barlines.push(parseBarline(child));
          return;
        }
        if (name === 'backup' || name === 'forward') {
          const amount = Math.max(0, integerOf(firstChild(child, 'duration'), 0));
          cursorUnits += name === 'backup' ? -amount : amount;
          cursorUnits = Math.max(0, cursorUnits);
          return;
        }
        if (name !== 'note') return;

        const note = parseNote(child);
        const divisions = safeDivision(state.divisions);
        const durationTicks = note.grace
          ? 0
          : Math.max(0, Math.round(note.durationDivisions * ppqn / divisions));
        const voiceKey = `${note.voice}|${note.staff}`;
        const startTicks = note.chord && lastStartByVoice.has(voiceKey)
          ? lastStartByVoice.get(voiceKey)
          : Math.max(0, Math.round(cursorUnits * ppqn / divisions));
        note.measureIndex = measureIndex;
        note.relativeStartTick = startTicks;
        note.relativeEndTick = startTicks + durationTicks;
        note.durationTicks = durationTicks;
        note.durationQuarter = durationTicks / ppqn;
        note.endTick = note.relativeEndTick;
        note.startTick = note.relativeStartTick;
        note.key = measure.key ? clone(measure.key) : null;
        note.clef = clone(measure.clefs[note.staff - 1] || measure.clefs[0] || null);
        measure.notes.push(note);
        maxEndTicks = Math.max(maxEndTicks, note.relativeEndTick);
        if (!note.chord) {
          lastStartByVoice.set(voiceKey, startTicks);
          cursorUnits += note.durationDivisions;
        }
      });

      const nominalDuration = measureDurationTicks(state, ppqn);
      const actualDuration = Math.max(maxEndTicks, Math.round(cursorUnits * ppqn / safeDivision(state.divisions)));
      const duration = measure.implicit
        ? Math.max(1, actualDuration || nominalDuration)
        : Math.max(1, nominalDuration, actualDuration);
      measure.relativeDurationTicks = duration;
      measure.actualDurationTicks = actualDuration;
      previousMeasureDuration = duration;
      measures.push(measure);
    });

    return {
      id: partDefinition?.id || partNode.attrs?.id || `P${measures.length + 1}`,
      name: partDefinition?.name || `Part ${partNode.attrs?.id || ''}`.trim(),
      abbreviation: partDefinition?.abbreviation || '',
      instruments: clone(partDefinition?.instruments || []),
      midiInstruments: clone(partDefinition?.midiInstruments || []),
      measures,
      transposition: measures.find(measure => measure.transpose)?.transpose ||
        partDefinition?.transpose || null,
      endTick: 0
    };
  }

  function buildTimewiseParts(root, definitions) {
    const grouped = new Map();
    elementChildren(root, 'measure').forEach(measure => {
      elementChildren(measure, 'part').forEach(part => {
        const id = part.attrs?.id || 'P1';
        if (!grouped.has(id)) grouped.set(id, {
          name: id,
          attrs: { id },
          children: []
        });
        const target = grouped.get(id);
        target.children.push({
          name: 'measure',
          attrs: { number: measure.attrs?.number || '' },
          children: part.children || [],
          text: ''
        });
      });
    });
    return Array.from(grouped.values()).map(part => ({
      node: part,
      definition: definitions.get(part.attrs.id) || {
        id: part.attrs.id,
        name: part.attrs.id,
        abbreviation: '',
        instruments: [],
        midiInstruments: []
      }
    }));
  }

  function dedupeEvents(events, keys) {
    const result = [];
    const seen = new Set();
    (events || []).forEach(event => {
      const key = keys.map(name => String(event?.[name] ?? '')).join('|');
      if (seen.has(key)) return;
      seen.add(key);
      result.push(event);
    });
    return result;
  }

  function normalizeRoot(root, options = {}) {
    const rootName = localName(root.name);
    if (rootName !== 'score-partwise' && rootName !== 'score-timewise') {
      fail(`unsupported root <${root.name}>`);
    }
    const ppqn = Math.max(1, finite(options.ticksPerQuarter, DEFAULT_PPQN));
    const partDefinitions = new Map(
      elementChildren(firstChild(root, 'part-list'), 'score-part')
        .map(node => [node.attrs?.id, parseScorePart(node)])
        .filter(([id]) => id)
    );
    let partNodes;
    if (rootName === 'score-partwise') {
      partNodes = elementChildren(root, 'part').map(node => ({
        node,
        definition: partDefinitions.get(node.attrs?.id) || {
          id: node.attrs?.id || `P${partDefinitions.size + 1}`,
          name: node.attrs?.id || 'Part',
          abbreviation: '',
          instruments: [],
          midiInstruments: []
        }
      }));
    } else {
      partNodes = buildTimewiseParts(root, partDefinitions);
    }
    if (!partNodes.length) fail('document contains no parts');

    const parts = partNodes.map(({ node, definition }) => parsePart(node, definition, {
      ticksPerQuarter: ppqn
    }));
    const measureCount = Math.max(...parts.map(part => part.measures.length), 0);
    const globalMeasures = [];
    let absoluteStart = 0;
    for (let index = 0; index < measureCount; index += 1) {
      const candidates = parts
        .map(part => part.measures[index])
        .filter(Boolean);
      const source = candidates[0] || {};
      const durationTicks = Math.max(
        1,
        ...candidates.map(measure => finite(measure.relativeDurationTicks, 1))
      );
      const globalMeasure = {
        index,
        number: source.number || String(index + 1),
        startTick: absoluteStart,
        endTick: absoluteStart + durationTicks,
        durationTicks,
        time: clone(source.time || DEFAULT_TIME),
        key: source.key ? clone(source.key) : null,
        clefs: clone(source.clefs || []),
        transpose: source.transpose ? clone(source.transpose) : null,
        staves: source.staves || 1,
        width: source.width ?? null,
        layout: source.layout ? clone(source.layout) : null,
        implicit: Boolean(source.implicit),
        barlines: clone(source.barlines || [])
      };
      globalMeasures.push(globalMeasure);
      absoluteStart += durationTicks;
    }

    const meterEvents = [];
    const keyEvents = [];
    const tempoEvents = [];
    parts.forEach(part => {
      part.measures.forEach((measure, index) => {
        const global = globalMeasures[index];
        if (!global) return;
        measure.startTick = global.startTick;
        measure.endTick = global.endTick;
        measure.durationTicks = global.durationTicks;
        measure.notes.forEach(note => {
          note.startTick = global.startTick + note.relativeStartTick;
          note.endTick = global.startTick + note.relativeEndTick;
          note.measureStartTick = global.startTick;
          note.measureEndTick = global.endTick;
        });
        measure.directions.forEach(direction => {
          const tick = global.startTick + finite(direction.relativeTick, 0);
          if (direction.tempo > 0) tempoEvents.push({
            tick,
            bpm: direction.tempo,
            beatUnit: direction.beatUnit || 'quarter',
            dots: direction.beatUnitDots || 0,
            source: 'musicxml'
          });
        });
      });
      part.endTick = part.measures.length
        ? part.measures[part.measures.length - 1].endTick
        : 0;
    });

    globalMeasures.forEach(measure => {
      if (measure.time) meterEvents.push({
        tick: measure.startTick,
        beats: measure.time.beats,
        numerator: typeof measure.time.beats === 'string'
          ? finite(measure.time.beats.split('+')[0], 4)
          : finite(measure.time.beats, 4),
        denominator: measure.time.beatType,
        symbol: measure.time.symbol || null
      });
      if (measure.key) keyEvents.push({
        tick: measure.startTick,
        fifths: measure.key.fifths,
        mode: measure.key.mode
      });
    });

    const identification = firstChild(root, 'identification');
    const creators = {};
    elementChildren(identification, 'creator').forEach(creator => {
      const type = creator.attrs?.type || 'unknown';
      creators[type] = textOf(creator, '');
    });
    const movementTitle = textOf(firstChild(root, 'movement-title'), '');
    const work = firstChild(root, 'work');
    const title = movementTitle || textOf(firstChild(work, 'work-title'), '');

    return {
      schemaVersion: 1,
      format: rootName,
      title,
      creators,
      source: {
        fileName: options.fileName || '',
        mimeType: options.mimeType || 'application/vnd.recordare.musicxml+xml',
        size: String(options.sourceText || '').length,
        data: options.sourceText || null
      },
      ticksPerQuarter: ppqn,
      parts,
      measures: globalMeasures,
      meterMap: {
        events: dedupeEvents(meterEvents, ['tick']),
        source: 'musicxml'
      },
      keyMap: {
        events: dedupeEvents(keyEvents, ['tick']),
        source: 'musicxml'
      },
      tempoMap: {
        events: dedupeEvents(tempoEvents, ['tick']),
        source: 'musicxml'
      },
      endTick: absoluteStart,
      activePartId: parts[0]?.id || null
    };
  }

  function parse(input, options = {}) {
    let sourceText;
    if (typeof input === 'string') {
      sourceText = input;
    } else if (input instanceof Uint8Array) {
      sourceText = decodeEntities(new TextDecoder('utf-8', { fatal: false }).decode(input));
    } else if (input instanceof ArrayBuffer) {
      sourceText = decodeEntities(new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(input)));
    } else if (Array.isArray(input)) {
      sourceText = decodeEntities(new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(input)));
    } else {
      throw new TypeError('MusicXmlScoreParser.parse expects XML text or bytes');
    }
    const root = parseXmlTree(sourceText);
    return normalizeRoot(root, { ...options, sourceText });
  }

  async function parseFile(file, options = {}) {
    if (!file) throw new TypeError('MusicXmlScoreParser.parseFile requires a File or Blob');
    let sourceText;
    if (typeof file.text === 'function') {
      sourceText = await file.text();
    } else if (typeof FileReader === 'function') {
      sourceText = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Unable to read MusicXML file'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsText(file);
      });
    } else {
      throw new TypeError('MusicXmlScoreParser.parseFile requires File.text() or FileReader');
    }
    return parse(sourceText, {
      ...options,
      fileName: options.fileName || file.name || '',
      mimeType: options.mimeType || file.type || 'application/vnd.recordare.musicxml+xml'
    });
  }

  const api = Object.freeze({
    DEFAULT_PPQN,
    parse,
    parseFile,
    parseXmlTree,
    normalizeRoot,
    pitchToMidi
  });

  globalScope.MusicXmlScoreParser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
