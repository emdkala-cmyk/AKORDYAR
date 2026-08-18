/**
 * MidiFileParser
 *
 * Pure Standard MIDI File (SMF) parser.
 *
 * The parser deliberately keeps musical positions in integer ticks and
 * derives seconds from one tempo map.  Consumers should never accumulate
 * frame deltas or derive beat positions from pixels.
 */
(function attachMidiFileParser(globalScope) {
  'use strict';

  const DEFAULT_TEMPO_US_PER_QUARTER = 500000;
  const DEFAULT_NUMERATOR = 4;
  const DEFAULT_DENOMINATOR = 4;
  const EPSILON = 1e-9;

  const GENERAL_MIDI_INSTRUMENTS = Object.freeze([
    'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano',
    'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2',
    'Harpsichord', 'Clavinet', 'Celesta', 'Glockenspiel', 'Music Box',
    'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
    'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ',
    'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
    'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)',
    'Electric Guitar (jazz)', 'Electric Guitar (clean)',
    'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar',
    'Guitar harmonics', 'Acoustic Bass', 'Electric Bass (finger)',
    'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2',
    'Synth Bass 1', 'Synth Bass 2', 'Violin', 'Viola', 'Cello',
    'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp',
    'Timpani', 'String Ensemble 1', 'String Ensemble 2', 'SynthStrings 1',
    'SynthStrings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Voice',
    'Orchestra Hit', 'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet',
    'French Horn', 'Brass Section', 'SynthBrass 1', 'SynthBrass 2',
    'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe',
    'English Horn', 'Bassoon', 'Clarinet', 'Piccolo', 'Flute', 'Recorder',
    'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
    'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)',
    'Lead 4 (chiff)', 'Lead 5 (charang)', 'Lead 6 (voice)',
    'Lead 7 (fifths)', 'Lead 8 (bass + lead)', 'Pad 1 (new age)',
    'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)', 'Pad 5 (bowed)',
    'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)', 'FX 1 (rain)',
    'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
    'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)',
    'FX 8 (sci-fi)', 'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba',
    'Bag pipe', 'Fiddle', 'Shanai', 'Tinkle Bell', 'Agogo', 'Steel Drums',
    'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum',
    'Reverse Cymbal', 'Guitar Fret Noise', 'Breath Noise', 'Seashore',
    'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
  ]);

  function fail(message, offset) {
    const suffix = Number.isFinite(offset) ? ` at byte ${offset}` : '';
    throw new Error(`Invalid MIDI file${suffix}: ${message}`);
  }

  function toUint8Array(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView?.(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    if (Array.isArray(input)) return Uint8Array.from(input);
    throw new TypeError('MidiFileParser.parse expects an ArrayBuffer or Uint8Array');
  }

  function readU16(bytes, offset) {
    if (offset + 2 > bytes.length) fail('unexpected end of file', offset);
    return (bytes[offset] << 8) | bytes[offset + 1];
  }

  function readU32(bytes, offset) {
    if (offset + 4 > bytes.length) fail('unexpected end of file', offset);
    return (
      bytes[offset] * 0x1000000 +
      (bytes[offset + 1] << 16) +
      (bytes[offset + 2] << 8) +
      bytes[offset + 3]
    );
  }

  function readVlq(bytes, state, end) {
    let value = 0;
    let count = 0;
    while (state.offset < end && count < 4) {
      const byte = bytes[state.offset++];
      value = (value << 7) | (byte & 0x7f);
      count += 1;
      if ((byte & 0x80) === 0) return value;
    }
    fail(count >= 4 ? 'invalid variable-length quantity' : 'truncated variable-length quantity', state.offset);
  }

  function decodeText(bytes) {
    if (!bytes || bytes.length === 0) return '';
    try {
      if (typeof TextDecoder === 'function') {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\u0000+$/g, '');
      }
    } catch (_) {}
    let result = '';
    for (const byte of bytes) result += String.fromCharCode(byte);
    return result.replace(/\u0000+$/g, '');
  }

  function cloneBytes(bytes) {
    return Array.from(bytes || [], byte => Number(byte) & 0xff);
  }

  function tempoEvent(tick, microsecondsPerQuarter, order) {
    const safe = Math.max(1, Number(microsecondsPerQuarter) || DEFAULT_TEMPO_US_PER_QUARTER);
    return {
      tick: Math.max(0, Math.trunc(tick)),
      microsecondsPerQuarter: safe,
      bpm: 60000000 / safe,
      order
    };
  }

  function normalizeTempoEvents(events) {
    const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
    const result = [];
    sorted.forEach(event => {
      const previous = result[result.length - 1];
      if (previous && previous.tick === event.tick) result[result.length - 1] = event;
      else result.push(event);
    });
    if (!result.length || result[0].tick > 0) {
      result.unshift(tempoEvent(0, DEFAULT_TEMPO_US_PER_QUARTER, -1));
    }
    return result.map(({ order, ...event }) => event);
  }

  function normalizeTimeSignatures(events) {
    const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
    const result = [];
    sorted.forEach(event => {
      const previous = result[result.length - 1];
      if (previous && previous.tick === event.tick) result[result.length - 1] = event;
      else result.push(event);
    });
    if (!result.length || result[0].tick > 0) {
      result.unshift({
        tick: 0,
        numerator: DEFAULT_NUMERATOR,
        denominator: DEFAULT_DENOMINATOR,
        clocksPerClick: 24,
        notated32ndNotesPerQuarter: 8,
        order: -1
      });
    }
    return result.map(({ order, ...event }) => event);
  }

  function buildTempoMap(division, events, endTick) {
    const ppqn = division.type === 'ppqn' ? division.ticksPerQuarter : null;
    const source = normalizeTempoEvents(events);
    const segments = [];
    let secondsAtStart = 0;

    source.forEach((event, index) => {
      const previous = source[index - 1];
      if (index > 0) {
        const deltaTicks = event.tick - previous.tick;
        if (division.type === 'ppqn') {
          secondsAtStart += deltaTicks * previous.microsecondsPerQuarter / 1000000 / ppqn;
        } else {
          secondsAtStart += deltaTicks * division.secondsPerTick;
        }
      }
      segments.push({
        startTick: event.tick,
        endTick: null,
        startSeconds: secondsAtStart,
        microsecondsPerQuarter: event.microsecondsPerQuarter,
        bpm: event.bpm,
        secondsPerTick: division.type === 'ppqn'
          ? event.microsecondsPerQuarter / 1000000 / ppqn
          : division.secondsPerTick
      });
    });

    segments.forEach((segment, index) => {
      segment.endTick = index + 1 < segments.length
        ? segments[index + 1].startTick
        : Math.max(segment.startTick, Number(endTick) || segment.startTick);
    });

    return {
      events: source,
      segments,
      division: { ...division },
      endTick: Math.max(0, Number(endTick) || 0)
    };
  }

  function findSegmentByTick(segments, tick) {
    let low = 0;
    let high = segments.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (segments[middle].startTick <= tick) low = middle;
      else high = middle - 1;
    }
    return segments[Math.max(0, low)] || null;
  }

  function findSegmentBySeconds(segments, seconds) {
    let low = 0;
    let high = segments.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (segments[middle].startSeconds <= seconds) low = middle;
      else high = middle - 1;
    }
    return segments[Math.max(0, low)] || null;
  }

  function buildMeterMap(timeSignatures, division, endTick) {
    const ppqn = division.type === 'ppqn'
      ? division.ticksPerQuarter
      : Math.max(1, Math.round(1 / division.secondsPerTick));
    const signatures = normalizeTimeSignatures(timeSignatures);
    const segments = [];

    signatures.forEach((event, index) => {
      const numerator = Math.max(1, Math.trunc(event.numerator) || DEFAULT_NUMERATOR);
      const denominator = Math.max(1, Math.trunc(event.denominator) || DEFAULT_DENOMINATOR);
      const beatTicks = ppqn * 4 / denominator;
      const measureTicks = beatTicks * numerator;
      const previous = segments[index - 1];
      let startBar = 1;
      if (previous) {
        const elapsed = event.tick - previous.startTick;
        const bars = Math.floor((elapsed + EPSILON) / previous.measureTicks);
        const remainder = elapsed - bars * previous.measureTicks;
        startBar = previous.startBar + bars + (remainder > EPSILON ? 1 : 0);
      }
      segments.push({
        startTick: event.tick,
        endTick: null,
        startBar,
        numerator,
        denominator,
        beatTicks,
        measureTicks,
        beatUnit: denominator === 8 ? 'eighth' : denominator === 4 ? 'quarter' : `1/${denominator}`
      });
    });

    segments.forEach((segment, index) => {
      segment.endTick = index + 1 < segments.length
        ? segments[index + 1].startTick
        : Math.max(segment.startTick, Number(endTick) || segment.startTick);
    });

    return { events: signatures, segments, endTick: Math.max(0, Number(endTick) || 0), ppqn };
  }

  function createConversions(tempoMap, meterMap) {
    function tickToSeconds(tick) {
      const safeTick = Math.max(0, Number(tick) || 0);
      const segment = findSegmentByTick(tempoMap.segments, safeTick);
      if (!segment) return 0;
      return segment.startSeconds + (safeTick - segment.startTick) * segment.secondsPerTick;
    }

    function secondsToTick(seconds) {
      const safeSeconds = Math.max(0, Number(seconds) || 0);
      const segment = findSegmentBySeconds(tempoMap.segments, safeSeconds);
      if (!segment || segment.secondsPerTick <= 0) return 0;
      return segment.startTick + (safeSeconds - segment.startSeconds) / segment.secondsPerTick;
    }

    function tickToBarBeat(tick) {
      const safeTick = Math.max(0, Number(tick) || 0);
      const segment = findSegmentByTick(meterMap.segments, safeTick);
      if (!segment) {
        return { bar: 1, beat: 1, tickInBeat: safeTick, numerator: 4, denominator: 4 };
      }
      const relative = Math.max(0, safeTick - segment.startTick);
      const barOffset = Math.floor((relative + EPSILON) / segment.measureTicks);
      const inMeasure = relative - barOffset * segment.measureTicks;
      const beat = Math.min(
        segment.numerator,
        Math.floor((inMeasure + EPSILON) / segment.beatTicks) + 1
      );
      return {
        bar: segment.startBar + barOffset,
        beat,
        tickInBeat: Math.max(0, inMeasure - (beat - 1) * segment.beatTicks),
        numerator: segment.numerator,
        denominator: segment.denominator,
        beatTicks: segment.beatTicks,
        measureTicks: segment.measureTicks
      };
    }

    function barBeatToTick(bar, beat, options = {}) {
      const safeBar = Math.max(1, Number(bar) || 1);
      const safeBeat = Math.max(1, Number(beat) || 1);
      const segment = meterMap.segments.find(candidate =>
        safeBar >= candidate.startBar &&
        (candidate.endTick == null || safeBar <= candidate.startBar + Math.ceil(
          Math.max(0, candidate.endTick - candidate.startTick) / candidate.measureTicks
        ))
      ) || meterMap.segments[0];
      const tickInBeat = Math.max(0, Number(options.tickInBeat) || 0);
      return segment.startTick +
        (safeBar - segment.startBar) * segment.measureTicks +
        (safeBeat - 1) * segment.beatTicks +
        tickInBeat;
    }

    function gridStepTicks(tick, preset = '1/4') {
      const meter = findSegmentByTick(meterMap.segments, Math.max(0, Number(tick) || 0)) ||
        meterMap.segments[0];
      if (!meter) return 1;
      switch (preset) {
        case '1/1': return meter.measureTicks;
        case '1/2': return meter.measureTicks / 2;
        case '1/4': return meter.beatTicks;
        case '1/8': return meter.beatTicks / 2;
        case '1/16': return meter.beatTicks / 4;
        case '1/32': return meter.beatTicks / 8;
        case 'triplet': return meter.beatTicks / 3;
        case 'dotted': return meter.beatTicks * 1.5;
        default: return meter.beatTicks;
      }
    }

    function quantizeTick(tick, preset = '1/4') {
      const safeTick = Math.max(0, Number(tick) || 0);
      const step = gridStepTicks(safeTick, preset);
      return step > 0 ? Math.round(safeTick / step) * step : safeTick;
    }

    return Object.freeze({
      tickToSeconds,
      secondsToTick,
      tickToBarBeat,
      barBeatToTick,
      gridStepTicks,
      quantizeTick
    });
  }

  function parseDivision(rawDivision) {
    if ((rawDivision & 0x8000) === 0) {
      const ticksPerQuarter = rawDivision & 0x7fff;
      if (!ticksPerQuarter) fail('PPQN division cannot be zero');
      return { type: 'ppqn', ticksPerQuarter };
    }

    const framesByte = (rawDivision >> 8) & 0xff;
    const signedFrames = framesByte & 0x80 ? framesByte - 0x100 : framesByte;
    const ticksPerFrame = rawDivision & 0xff;
    const framesPerSecond = Math.abs(signedFrames);
    if (!framesPerSecond || !ticksPerFrame) fail('invalid SMPTE division');
    return {
      type: 'smpte',
      framesPerSecond,
      ticksPerFrame,
      secondsPerTick: 1 / (framesPerSecond * ticksPerFrame),
      rawFrames: signedFrames
    };
  }

  function parseTrack(bytes, start, length, trackIndex, shared) {
    const end = start + length;
    if (end > bytes.length) fail('track extends past end of file', start);

    const state = { offset: start };
    let tick = 0;
    let runningStatus = 0;
    let eventOrder = 0;
    let endOfTrack = false;
    const events = [];
    const notes = [];
    const openNotes = new Map();
    const programByChannel = {};
    const channels = new Set();
    let trackName = '';
    let instrumentName = '';
    let primaryChannel = null;
    let maxTick = 0;

    function noteKey(channel, note) {
      return `${channel}:${note}`;
    }

    function closeNote(channel, note, velocity, endAtTick, terminated = true) {
      const key = noteKey(channel, note);
      const stack = openNotes.get(key);
      if (!stack || !stack.length) return;
      const noteStart = stack.pop();
      const endTick = Math.max(noteStart.startTick, endAtTick);
      notes.push({
        id: `midi-t${trackIndex}-n${notes.length}`,
        channel,
        pitch: note,
        velocity: noteStart.velocity,
        releaseVelocity: Math.max(0, Number(velocity) || 0),
        startTick: noteStart.startTick,
        endTick,
        durationTicks: endTick - noteStart.startTick,
        program: noteStart.program,
        instrumentName: noteStart.instrumentName,
        terminated
      });
      if (!stack.length) openNotes.delete(key);
    }

    while (state.offset < end) {
      const delta = readVlq(bytes, state, end);
      tick += delta;
      maxTick = Math.max(maxTick, tick);
      if (state.offset >= end) fail('truncated event status', state.offset);

      let status = bytes[state.offset];
      if (status & 0x80) {
        state.offset += 1;
        if (status < 0xf0) runningStatus = status;
        else runningStatus = 0;
      } else if (runningStatus) {
        status = runningStatus;
      } else {
        fail('running status used before a channel status', state.offset);
      }

      if (status === 0xff) {
        if (state.offset >= end) fail('truncated meta event', state.offset);
        const metaType = bytes[state.offset++];
        const dataLength = readVlq(bytes, state, end);
        if (state.offset + dataLength > end) fail('meta event extends past track', state.offset);
        const data = bytes.subarray(state.offset, state.offset + dataLength);
        state.offset += dataLength;
        const event = {
          type: 'meta',
          metaType,
          tick,
          data: cloneBytes(data),
          order: eventOrder++
        };
        if (metaType === 0x03) trackName = decodeText(data).trim() || trackName;
        if (metaType === 0x04) instrumentName = decodeText(data).trim() || instrumentName;
        if (metaType === 0x2f) endOfTrack = true;
        if (metaType === 0x51 && data.length === 3) {
          const microsecondsPerQuarter =
            (data[0] << 16) | (data[1] << 8) | data[2];
          shared.tempoEvents.push(tempoEvent(tick, microsecondsPerQuarter, shared.order++));
          event.tempo = microsecondsPerQuarter;
        }
        if (metaType === 0x58 && data.length >= 2) {
          const numerator = data[0] || DEFAULT_NUMERATOR;
          const denominator = 2 ** Math.min(7, data[1]);
          const timeSignature = {
            tick,
            numerator,
            denominator,
            clocksPerClick: data[2] ?? 24,
            notated32ndNotesPerQuarter: data[3] ?? 8,
            order: shared.order++
          };
          shared.timeSignatures.push(timeSignature);
          event.timeSignature = { ...timeSignature };
          delete event.timeSignature.order;
        }
        if (metaType === 0x59 && data.length >= 2) {
          const sf = data[0] & 0x80 ? data[0] - 0x100 : data[0];
          const keySignature = { tick, sharpsFlats: sf, minor: data[1] !== 0 };
          shared.keySignatures.push(keySignature);
          event.keySignature = keySignature;
        }
        if (metaType === 0x06 || metaType === 0x07) {
          const marker = { tick, type: metaType === 0x06 ? 'marker' : 'cue', text: decodeText(data) };
          shared.markers.push(marker);
          event.marker = marker;
        }
        if (metaType === 0x01 || metaType === 0x05) {
          event.text = decodeText(data);
        }
        events.push(event);
        if (endOfTrack) break;
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        const dataLength = readVlq(bytes, state, end);
        if (state.offset + dataLength > end) fail('sysex event extends past track', state.offset);
        const data = bytes.subarray(state.offset, state.offset + dataLength);
        state.offset += dataLength;
        events.push({
          type: 'sysex',
          status,
          tick,
          data: cloneBytes(data),
          order: eventOrder++
        });
        continue;
      }

      if (status >= 0xf1) {
        const systemLengths = { 0xf1: 1, 0xf2: 2, 0xf3: 1, 0xf6: 0 };
        const dataLength = systemLengths[status];
        if (dataLength == null) fail(`unsupported system status 0x${status.toString(16)}`, state.offset - 1);
        if (state.offset + dataLength > end) fail('system event extends past track', state.offset);
        const data = bytes.subarray(state.offset, state.offset + dataLength);
        state.offset += dataLength;
        events.push({
          type: 'system',
          status,
          tick,
          data: cloneBytes(data),
          order: eventOrder++
        });
        continue;
      }

      const messageType = status >> 4;
      const channel = status & 0x0f;
      const dataLength = messageType === 0xc || messageType === 0xd ? 1 : 2;
      if (state.offset + dataLength > end) fail('channel event extends past track', state.offset);
      const first = bytes[state.offset++];
      const second = dataLength === 2 ? bytes[state.offset++] : null;
      channels.add(channel);
      if (primaryChannel == null) primaryChannel = channel;
      const event = {
        type: 'channel',
        message: ['noteOff', 'noteOn', 'polyAftertouch', 'controlChange',
          'programChange', 'channelAftertouch', 'pitchBend'][messageType - 8] || 'unknown',
        status,
        channel,
        tick,
        data: dataLength === 2 ? [first, second] : [first],
        order: eventOrder++
      };

      if (messageType === 0xc) {
        programByChannel[channel] = first;
        event.program = first;
        event.instrumentName = GENERAL_MIDI_INSTRUMENTS[first] || `Program ${first + 1}`;
      } else if (messageType === 0x9 && second > 0) {
        const program = programByChannel[channel] ?? null;
        const instrument = program == null
          ? ''
          : (GENERAL_MIDI_INSTRUMENTS[program] || `Program ${program + 1}`);
        const key = noteKey(channel, first);
        const stack = openNotes.get(key) || [];
        stack.push({
          startTick: tick,
          velocity: second,
          program,
          instrumentName: instrument
        });
        openNotes.set(key, stack);
        event.note = first;
        event.velocity = second;
      } else if (messageType === 0x8 || (messageType === 0x9 && second === 0)) {
        closeNote(channel, first, second || 0, tick, true);
        event.note = first;
        event.velocity = second || 0;
      }

      events.push(event);
    }

    openNotes.forEach((stack, key) => {
      const [channelText, noteText] = key.split(':');
      const channel = Number(channelText);
      const note = Number(noteText);
      while (stack.length) closeNote(channel, note, 0, maxTick, false);
    });

    notes.sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch || a.id.localeCompare(b.id));
    notes.forEach((note, index) => { note.id = `midi-t${trackIndex}-n${index}`; });

    const programEntries = Object.entries(programByChannel).map(([channel, program]) => ({
      channel: Number(channel),
      program,
      instrumentName: GENERAL_MIDI_INSTRUMENTS[program] || `Program ${program + 1}`
    }));
    const inferredInstrument = instrumentName ||
      programEntries[0]?.instrumentName ||
      (channels.has(9) ? 'Percussion' : '');

    return {
      id: `midi-track-${trackIndex}`,
      index: trackIndex,
      name: trackName || `Track ${trackIndex + 1}`,
      instrumentName: inferredInstrument,
      channel: primaryChannel,
      channels: [...channels].sort((a, b) => a - b),
      programs: programEntries,
      notes,
      events,
      durationTicks: maxTick
    };
  }

  function enrichNotes(tracks, conversions) {
    return tracks.map(track => ({
      ...track,
      notes: track.notes.map(note => ({
        ...note,
        startSeconds: conversions.tickToSeconds(note.startTick),
        endSeconds: conversions.tickToSeconds(note.endTick),
        durationSeconds: Math.max(
          0,
          conversions.tickToSeconds(note.endTick) - conversions.tickToSeconds(note.startTick)
        ),
        barBeat: conversions.tickToBarBeat(note.startTick)
      }))
    }));
  }

  function parse(input, options = {}) {
    const bytes = toUint8Array(input);
    if (bytes.length < 14) fail('file is too short');
    if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'MThd') fail('missing MThd header');

    const headerLength = readU32(bytes, 4);
    if (headerLength < 6 || 8 + headerLength > bytes.length) fail('invalid header length', 4);
    const format = readU16(bytes, 8);
    const trackCount = readU16(bytes, 10);
    const divisionRaw = readU16(bytes, 12);
    if (![0, 1, 2].includes(format)) fail(`unsupported MIDI format ${format}`, 8);
    if (!trackCount) fail('MIDI file contains no tracks', 10);

    const division = parseDivision(divisionRaw);
    const shared = {
      tempoEvents: [],
      timeSignatures: [],
      keySignatures: [],
      markers: [],
      order: 0
    };
    const tracks = [];
    let offset = 8 + headerLength;
    for (let index = 0; index < trackCount; index += 1) {
      if (offset + 8 > bytes.length) fail('missing track chunk', offset);
      if (String.fromCharCode(...bytes.subarray(offset, offset + 4)) !== 'MTrk') {
        fail('missing MTrk chunk', offset);
      }
      const length = readU32(bytes, offset + 4);
      const start = offset + 8;
      tracks.push(parseTrack(bytes, start, length, index, shared));
      offset = start + length;
    }

    const endTick = tracks.reduce((max, track) => Math.max(max, track.durationTicks), 0);
    const tempoMap = buildTempoMap(division, shared.tempoEvents, endTick);
    const meterMap = buildMeterMap(shared.timeSignatures, division, endTick);
    const conversions = createConversions(tempoMap, meterMap);
    const enrichedTracks = enrichNotes(tracks, conversions);
    const durationSeconds = conversions.tickToSeconds(endTick);

    const sourceBytes = options.includeSource === false ? null : cloneBytes(bytes);
    const source = {
      fileName: options.fileName || '',
      mimeType: options.mimeType || 'audio/midi',
      size: bytes.byteLength,
      lastModified: Number(options.lastModified) || null,
      data: sourceBytes
    };

    return {
      schemaVersion: 1,
      format,
      trackCount,
      division,
      endTick,
      durationSeconds,
      tempoMap,
      meterMap,
      keySignatures: shared.keySignatures,
      markers: shared.markers,
      tracks: enrichedTracks,
      source,
      conversions: {
        // Functions are intentionally not serialized by JSON.  They are
        // recreated by MidiScoreModel.hydrate/attachConversions.
        tickToSeconds: conversions.tickToSeconds,
        secondsToTick: conversions.secondsToTick,
        tickToBarBeat: conversions.tickToBarBeat,
        barBeatToTick: conversions.barBeatToTick,
        gridStepTicks: conversions.gridStepTicks,
        quantizeTick: conversions.quantizeTick
      }
    };
  }

  async function parseFile(file, options = {}) {
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw new TypeError('MidiFileParser.parseFile expects a File or Blob');
    }
    const arrayBuffer = await file.arrayBuffer();
    return parse(arrayBuffer, {
      ...options,
      fileName: options.fileName || file.name || '',
      mimeType: options.mimeType || file.type || 'audio/midi',
      lastModified: options.lastModified ?? file.lastModified ?? null
    });
  }

  const api = Object.freeze({
    DEFAULT_TEMPO_US_PER_QUARTER,
    GENERAL_MIDI_INSTRUMENTS,
    parse,
    parseFile,
    createConversions,
    buildTempoMap,
    buildMeterMap
  });

  globalScope.MidiFileParser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
