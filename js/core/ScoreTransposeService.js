/**
 * ScoreTransposeService
 *
 * Musical transposition for imported MIDI and MusicXML scores.  The service
 * keeps timing intact, moves pitched notes by semitones, and rebuilds key
 * signatures so the notation follows the project's key.
 */
(function attachScoreTransposeService(globalScope) {
  'use strict';

  const ROOT_TO_SEMITONE = Object.freeze({
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
  });
  const MAJOR_ROOT_TO_FIFTHS = Object.freeze({
    0: 0, 1: -5, 2: 2, 3: -3, 4: 4, 5: -1,
    6: 6, 7: 1, 8: -4, 9: 3, 10: -2, 11: 5
  });
  const MINOR_ROOT_TO_FIFTHS = Object.freeze({
    // Minor keys use the signature of their relative major:
    // Am=C, Em=G, Bm=D, F#m=A, C#m=E, G#m=B, D#m=F#.
    0: -3, 1: 4, 2: -1, 3: 6, 4: 1, 5: -4,
    6: 3, 7: -2, 8: 5, 9: 0, 10: 7, 11: 2
  });
  const MAJOR_FIFTHS_TO_ROOT = Object.freeze([
    11, 6, 1, 8, 3, 10, 5, 0, 7, 2, 9, 4, 11, 6, 1
  ]);
  const MINOR_FIFTHS_TO_ROOT = Object.freeze([
    8, 3, 10, 5, 0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10
  ]);
  const SHARP_SPELLINGS = Object.freeze([
    ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
    ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]
  ]);
  const FLAT_SPELLINGS = Object.freeze([
    ['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0],
    ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]
  ]);
  const STEP_TO_SEMITONE = Object.freeze({
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
  });
  const MAJOR_PROFILE = Object.freeze([
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
    2.52, 5.19, 2.39, 3.66, 2.29, 2.88
  ]);
  const MINOR_PROFILE = Object.freeze([
    6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
    2.54, 4.75, 3.98, 2.69, 3.34, 3.17
  ]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeKeyName(value) {
    return String(value || '')
      .trim()
      .replace(/[♯]/g, '#')
      .replace(/[♭]/g, 'b')
      .replace(/\s+/g, '');
  }

  function parseKey(value, mode = 'major') {
    const text = normalizeKeyName(value);
    const match = text.match(/^([A-Ga-g](?:#|b)?)(m|min|minor)?$/);
    const root = match ? `${match[1][0].toUpperCase()}${match[1].slice(1)}` : 'C';
    const minor = Boolean(match?.[2]) || String(mode).toLowerCase().startsWith('min');
    return {
      root,
      mode: minor ? 'minor' : 'major',
      semitone: ROOT_TO_SEMITONE[root] ?? 0
    };
  }

  function signedDelta(from, to) {
    let value = ((Number(to) - Number(from)) % 12 + 12) % 12;
    if (value > 6) value -= 12;
    return value;
  }

  function signatureFor(key) {
    const parsed = typeof key === 'object' ? key : parseKey(key);
    const table = parsed.mode === 'minor' ? MINOR_ROOT_TO_FIFTHS : MAJOR_ROOT_TO_FIFTHS;
    return {
      fifths: table[parsed.semitone] ?? 0,
      sharpsFlats: table[parsed.semitone] ?? 0,
      mode: parsed.mode,
      tick: 0
    };
  }

  function keyFromSignature(signature) {
    const fifths = Math.max(-7, Math.min(7, Math.trunc(
      Number(signature?.fifths ?? signature?.sharpsFlats) || 0
    )));
    const index = fifths + 7;
    const minor = String(signature?.mode || '').toLowerCase().startsWith('min') ||
      Boolean(signature?.minor);
    const root = (minor ? MINOR_FIFTHS_TO_ROOT : MAJOR_FIFTHS_TO_ROOT)[index] ?? 0;
    return {
      mode: minor ? 'minor' : 'major',
      semitone: root,
      fifths
    };
  }

  /**
   * Relative major/minor keys share a key signature and therefore do not
   * require moving the actual pitches (C major ↔ A minor).
   */
  function musicalDelta(source, target) {
    const sourceSignature = signatureFor(source);
    const targetSignature = signatureFor(target);
    if (sourceSignature.fifths === targetSignature.fifths) return 0;
    return signedDelta(source.semitone, target.semitone);
  }

  function inferKeyFromPitches(pitches) {
    const histogram = Array(12).fill(0);
    let count = 0;
    (Array.isArray(pitches) ? pitches : []).forEach(item => {
      const pitch = typeof item === 'object' ? item.pitch : item;
      const midi = Number(pitch);
      if (!Number.isFinite(midi)) return;
      const weight = Math.max(
        1,
        Number(typeof item === 'object' ? item.durationTicks : 1) || 1
      );
      histogram[((Math.round(midi) % 12) + 12) % 12] += weight;
      count += 1;
    });
    if (!count) return { mode: 'major', semitone: 0, inferred: true };
    let best = { score: -Infinity, mode: 'major', semitone: 0 };
    ['major', 'minor'].forEach(mode => {
      const profile = mode === 'minor' ? MINOR_PROFILE : MAJOR_PROFILE;
      for (let root = 0; root < 12; root += 1) {
        let score = 0;
        for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
          score += histogram[pitchClass] * profile[(pitchClass - root + 12) % 12];
        }
        if (score > best.score) best = { score, mode, semitone: root };
      }
    });
    return { mode: best.mode, semitone: best.semitone, inferred: true };
  }

  function localName(node) {
    return String(node?.localName || node?.nodeName || '')
      .toLowerCase()
      .replace(/^.*:/, '');
  }

  function childElement(node, name) {
    return Array.from(node?.children || [])
      .find(child => localName(child) === name) || null;
  }

  function descendantElements(node, name) {
    if (!node) return [];
    if (typeof node.getElementsByTagNameNS === 'function') {
      return Array.from(node.getElementsByTagNameNS('*', name));
    }
    return Array.from(node.getElementsByTagName?.(name) || []);
  }

  function setChildText(node, name, value) {
    const child = childElement(node, name);
    if (child) {
      child.textContent = String(value);
      return child;
    }
    const owner = node?.ownerDocument;
    if (!owner || typeof owner.createElementNS !== 'function') return null;
    const created = owner.createElementNS(node.namespaceURI || null, name);
    created.textContent = String(value);
    node.appendChild(created);
    return created;
  }

  function xmlPitchToMidi(pitchNode) {
    const step = String(childElement(pitchNode, 'step')?.textContent || '').toUpperCase();
    const octave = Number(childElement(pitchNode, 'octave')?.textContent);
    const alter = Number(childElement(pitchNode, 'alter')?.textContent || 0);
    if (STEP_TO_SEMITONE[step] == null || !Number.isFinite(octave)) return null;
    return (octave + 1) * 12 + STEP_TO_SEMITONE[step] +
      (Number.isFinite(alter) ? alter : 0);
  }

  function updateXmlPitch(pitchNode, midi, targetSignature) {
    const next = midiPitchToXmlPitch(midi, targetSignature);
    setChildText(pitchNode, 'step', next.step);
    setChildText(pitchNode, 'alter', next.alter);
    setChildText(pitchNode, 'octave', next.octave);
    const accidental = childElement(pitchNode.parentNode, 'accidental');
    accidental?.remove?.();
  }

  function transposeMusicXmlSource(sourceText, score, targetProject) {
    if (typeof sourceText !== 'string' || !sourceText.trim()) return sourceText;
    const Parser = globalScope.DOMParser ||
      (typeof DOMParser !== 'undefined' ? DOMParser : null);
    const Serializer = globalScope.XMLSerializer ||
      (typeof XMLSerializer !== 'undefined' ? XMLSerializer : null);
    if (typeof Parser !== 'function' || typeof Serializer !== 'function') {
      return sourceText;
    }
    let documentNode;
    try {
      documentNode = new Parser().parseFromString(sourceText, 'application/xml');
      if (descendantElements(documentNode, 'parsererror').length) return sourceText;
    } catch (_) {
      return sourceText;
    }

    const parts = descendantElements(documentNode, 'part').filter(part => {
      const parent = localName(part.parentNode);
      return parent === 'score-partwise' || parent === 'score-timewise';
    });
    const modelParts = Array.isArray(score?.parts) ? score.parts : [];
    parts.forEach((partNode, partIndex) => {
      const partId = String(partNode.getAttribute?.('id') || '');
      const part = modelParts.find(item => String(item?.id) === partId) || modelParts[partIndex];
      if (!part || String(part.role || '').toLowerCase() === 'drums') return;

      const sourceKey = keyFromSignature(partSourceKey(part));
      const targetKey = targetProject;
      const delta = musicalDelta(sourceKey, targetKey);
      const measureNodes = descendantElements(partNode, 'measure');
      measureNodes.forEach((measureNode, measureIndex) => {
        const targetSignature = signatureFor(targetKey);

        const attributes = childElement(measureNode, 'attributes');
        const keyNode = attributes && childElement(attributes, 'key');
        if (keyNode) {
          setChildText(keyNode, 'fifths', targetSignature.fifths);
          setChildText(keyNode, 'mode', targetSignature.mode || 'major');
        } else if (attributes && measureIndex === 0) {
          const owner = attributes.ownerDocument;
          const created = owner?.createElementNS?.(
            attributes.namespaceURI || null,
            'key'
          );
          if (created) {
            const fifths = owner.createElementNS(attributes.namespaceURI || null, 'fifths');
            const mode = owner.createElementNS(attributes.namespaceURI || null, 'mode');
            fifths.textContent = String(targetSignature.fifths);
            mode.textContent = String(targetSignature.mode || 'major');
            created.append(fifths, mode);
            attributes.insertBefore(created, attributes.firstChild || null);
          }
        }

        descendantElements(measureNode, 'pitch').forEach(pitchNode => {
          const midi = xmlPitchToMidi(pitchNode);
          if (midi != null) updateXmlPitch(pitchNode, midi + delta, targetSignature);
        });
      });
    });
    return new Serializer().serializeToString(documentNode);
  }

  function signatureAt(events, tick = 0) {
    const list = Array.isArray(events) ? events : [];
    let result = list[0] || { tick: 0, fifths: 0, minor: false, mode: 'major' };
    list.forEach(event => {
      if (Number(event?.tick) <= Number(tick)) result = event;
    });
    return result;
  }

  function transposeSignature(event, delta, targetProject = null) {
    const source = keyFromSignature(event);
    const root = (source.semitone + Number(delta) + 120) % 12;
    const target = {
      mode: source.mode,
      semitone: root
    };
    const signature = signatureFor(target);
    const atStart = Number(event?.tick) === 0;
    const startSignature = targetProject ? signatureFor(targetProject) : null;
    return {
      ...event,
      ...(atStart && startSignature ? startSignature : signature),
      minor: atStart && targetProject
        ? targetProject.mode === 'minor'
        : target.mode === 'minor'
    };
  }

  function isDrumTrack(track, part = null) {
    return Number(track?.channel) === 9 ||
      String(part?.role || '').toLowerCase() === 'drums' ||
      String(track?.instrumentName || '').toLowerCase() === 'percussion';
  }

  function midiPitchToXmlPitch(midi, targetKey) {
    const value = Math.max(0, Math.min(127, Number(midi)));
    const pitchClass = ((Math.round(value) % 12) + 12) % 12;
    const useFlats = Number(targetKey?.fifths) <= 0;
    const spelling = (useFlats ? FLAT_SPELLINGS : SHARP_SPELLINGS)[pitchClass];
    return {
      step: spelling[0],
      alter: spelling[1],
      octave: Math.floor(Math.round(value) / 12) - 1,
      midi: value
    };
  }

  function transposeMidiScore(rawScore, projectKey, projectMode) {
    const score = clone(rawScore);
    if (!score) return null;
    const target = parseKey(projectKey, projectMode);
    const sourceEvents = Array.isArray(score.keySignatures) ? score.keySignatures : [];
    const source = sourceEvents.length
      ? keyFromSignature(signatureAt(sourceEvents))
      : inferKeyFromPitches(
          (score.tracks || []).flatMap(track =>
            isDrumTrack(track) ? [] : (track.notes || [])
          )
        );
    const delta = musicalDelta(source, target);
    score.tracks = (score.tracks || []).map((track, index) => {
      const part = (score.parts || []).find(candidate =>
        String(candidate?.trackId) === String(track?.id)
      ) || (score.parts || [])[index];
      if (isDrumTrack(track, part)) return track;
      return {
        ...track,
        notes: (track.notes || []).map(note => ({
          ...note,
          pitch: Number.isFinite(Number(note.pitch))
            ? Math.max(0, Math.min(127, Math.round(Number(note.pitch) + delta)))
            : note.pitch
        }))
      };
    });
    const events = Array.isArray(score.keySignatures) ? score.keySignatures : [];
    score.keySignatures = events.length
      ? events.map(event => transposeSignature(event, delta, target))
      : [{ tick: 0, ...signatureFor(target), minor: target.mode === 'minor' }];
    if (!score.keySignatures.some(event => Number(event.tick) === 0)) {
      score.keySignatures.unshift({ tick: 0, ...signatureFor(target), minor: target.mode === 'minor' });
    }
    return score;
  }

  function partSourceKey(part) {
    const measure = part?.measures?.find(item => item?.key);
    if (measure?.key) return measure.key;
    return inferKeyFromPitches(
      (part?.measures || []).flatMap(measure =>
        (measure.notes || []).filter(note => !note.rest)
      )
    );
  }

  function transposeMusicXmlScore(rawScore, projectKey, projectMode) {
    const score = clone(rawScore);
    if (!score) return null;
    const targetProject = parseKey(projectKey, projectMode);
    const sourceData = score.source?.data;
    const transposedSource = sourceData
      ? transposeMusicXmlSource(sourceData, score, targetProject)
      : sourceData;
    const transposePart = (part) => {
      const source = keyFromSignature(partSourceKey(part));
      const delta = musicalDelta(source, targetProject);
      const targetSignature = signatureFor(targetProject);
      const measures = (part.measures || []).map(measure => ({
        ...measure,
        key: measure.key ? { ...measure.key, ...targetSignature } : measure.key,
        notes: (measure.notes || []).map(note => {
          if (note.rest || !note.pitch || !Number.isFinite(Number(note.pitch.midi))) return note;
          const pitch = midiPitchToXmlPitch(Number(note.pitch.midi) + delta, targetSignature);
          return { ...note, pitch, accidental: null };
        })
      }));
      if (measures.length && !measures[0].key) measures[0].key = { ...targetSignature };
      return { ...part, measures, transposition: part.transposition ? { ...part.transposition } : null };
    };
    score.parts = (score.parts || []).map(part => {
      if (String(part?.role || '').toLowerCase() === 'drums') return part;
      return transposePart(part);
    });
    score.measures = score.parts[0]?.measures || (score.measures || []);
    score.keyMap = {
      ...(score.keyMap || {}),
      events: [{ tick: 0, ...signatureFor(targetProject) }]
    };
    if (sourceData) {
      score.source = {
        ...(score.source || {}),
        data: transposedSource
      };
    }
    return score;
  }

  const api = Object.freeze({
    parseKey,
    signatureFor,
    keyFromSignature,
    signedDelta,
    musicalDelta,
    transposeMidiScore,
    transposeMusicXmlScore,
    inferKeyFromPitches,
    transposeMusicXmlSource
  });

  globalScope.ScoreTransposeService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
