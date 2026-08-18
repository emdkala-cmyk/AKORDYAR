/**
 * MidiScoreModel
 *
 * Serializable domain model around MidiFileParser output.  It owns part
 * assignment and the shared tick/second/bar/beat conversion boundary used by
 * import, score rendering and future mobile sync.
 */
(function attachMidiScoreModel(globalScope) {
  'use strict';

  const ROLE_ORDER = Object.freeze([
    'piano',
    'guitar',
    'bass',
    'violin',
    'drums',
    'vocalGuide',
    'keyboard',
    'other'
  ]);

  const ROLE_LABELS = Object.freeze({
    piano: 'Piano',
    guitar: 'Guitar',
    bass: 'Bass',
    violin: 'Violin',
    drums: 'Drums',
    vocalGuide: 'Vocal Guide',
    keyboard: 'Keyboard',
    other: 'Other'
  });

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function inferRole(track) {
    const channel = Number(track?.channel);
    if (channel === 9 || track?.instrumentName === 'Percussion') return 'drums';
    const haystack = `${track?.name || ''} ${track?.instrumentName || ''}`.toLowerCase();
    if (/(vocal|voice|singer|melody|lead)/.test(haystack)) return 'vocalGuide';
    if (/(piano|grand|organ|harpsichord|keys?)/.test(haystack)) return 'piano';
    if (/(keyboard|synth|pad)/.test(haystack)) return 'keyboard';
    if (/(guitar|banjo|sitar|koto|shamisen)/.test(haystack)) return 'guitar';
    if (/(bass|contrabass|slap)/.test(haystack)) return 'bass';
    if (/(violin|viola|cello|fiddle|string)/.test(haystack)) return 'violin';
    return 'other';
  }

  function createPart(track, index) {
    const role = inferRole(track);
    return {
      id: `part-${track?.id || index}`,
      trackId: track?.id || `midi-track-${index}`,
      index,
      name: track?.name || `Part ${index + 1}`,
      role,
      roleLabel: ROLE_LABELS[role] || ROLE_LABELS.other,
      enabled: true,
      visible: true,
      transpose: 0
    };
  }

  function buildParts(tracks) {
    return (Array.isArray(tracks) ? tracks : []).map(createPart);
  }

  function attachConversions(score) {
    if (!score || typeof score !== 'object') return score;
    if (score.conversions && typeof score.conversions.tickToSeconds === 'function') {
      return score;
    }
    const parser = globalScope.MidiFileParser;
    if (!parser?.createConversions || !score.tempoMap || !score.meterMap) return score;
    score.conversions = parser.createConversions(score.tempoMap, score.meterMap);

    // Older/compact project snapshots may not contain derived note timing.
    (score.tracks || []).forEach(track => {
      (track.notes || []).forEach(note => {
        if (!Number.isFinite(note.startSeconds)) {
          note.startSeconds = score.conversions.tickToSeconds(note.startTick);
        }
        if (!Number.isFinite(note.endSeconds)) {
          note.endSeconds = score.conversions.tickToSeconds(note.endTick);
        }
        if (!Number.isFinite(note.durationSeconds)) {
          note.durationSeconds = Math.max(0, note.endSeconds - note.startSeconds);
        }
        if (!note.barBeat) note.barBeat = score.conversions.tickToBarBeat(note.startTick);
      });
    });
    return score;
  }

  function normalizePart(part, index, tracks) {
    const trackId = part?.trackId || tracks[index]?.id || `midi-track-${index}`;
    const role = ROLE_ORDER.includes(part?.role) ? part.role : inferRole(tracks[index]);
    return {
      id: part?.id || `part-${trackId}`,
      trackId,
      index: Number.isInteger(part?.index) ? part.index : index,
      name: String(part?.name || tracks[index]?.name || `Part ${index + 1}`),
      role,
      roleLabel: String(part?.roleLabel || ROLE_LABELS[role] || ROLE_LABELS.other),
      enabled: part?.enabled !== false,
      visible: part?.visible !== false,
      transpose: Number(part?.transpose) || 0
    };
  }

  function normalize(rawScore) {
    if (!rawScore || typeof rawScore !== 'object') return null;
    // Keep the original MIDI byte array/number array attached by reference.
    // Normalization runs during rendering and playback updates; copying a
    // multi-megabyte source on every frame would create avoidable GC/jitter.
    const score = { ...rawScore };
    score.schemaVersion = Number(score.schemaVersion) || 1;
    score.tracks = (Array.isArray(score.tracks) ? score.tracks : []).map(track => ({
      ...track,
      channels: Array.isArray(track.channels) ? [...track.channels] : [],
      programs: Array.isArray(track.programs)
        ? track.programs.map(program => ({ ...program }))
        : [],
      notes: Array.isArray(track.notes)
        ? track.notes.map(note => ({ ...note, barBeat: note.barBeat ? { ...note.barBeat } : note.barBeat }))
        : [],
      events: Array.isArray(track.events)
        ? track.events.map(event => ({
            ...event,
            data: Array.isArray(event.data) ? [...event.data] : event.data
          }))
        : []
    }));
    score.parts = (Array.isArray(score.parts) ? score.parts : score.tracks.map(createPart))
      .map((part, index) => normalizePart(part, index, score.tracks));
    score.activePartId = score.activePartId || score.parts[0]?.id || null;
    score.source = score.source && typeof score.source === 'object'
      ? { ...score.source }
      : { fileName: '', mimeType: 'audio/midi', size: 0, data: null };
    score.markers = Array.isArray(score.markers) ? score.markers : [];
    score.keySignatures = Array.isArray(score.keySignatures) ? score.keySignatures : [];
    score.tempoMap = score.tempoMap ? {
      ...score.tempoMap,
      events: Array.isArray(score.tempoMap.events)
        ? score.tempoMap.events.map(event => ({ ...event }))
        : [],
      segments: Array.isArray(score.tempoMap.segments)
        ? score.tempoMap.segments.map(segment => ({ ...segment }))
        : []
    } : {
      events: [{ tick: 0, microsecondsPerQuarter: 500000, bpm: 120 }],
      segments: [],
      endTick: Number(score.endTick) || 0
    };
    score.meterMap = score.meterMap ? {
      ...score.meterMap,
      events: Array.isArray(score.meterMap.events)
        ? score.meterMap.events.map(event => ({ ...event }))
        : [],
      segments: Array.isArray(score.meterMap.segments)
        ? score.meterMap.segments.map(segment => ({ ...segment }))
        : []
    } : {
      events: [{ tick: 0, numerator: 4, denominator: 4 }],
      segments: [],
      endTick: Number(score.endTick) || 0
    };
    if (globalScope.MidiFileParser) {
      if (!score.tempoMap.segments?.length && globalScope.MidiFileParser.buildTempoMap) {
        score.tempoMap = globalScope.MidiFileParser.buildTempoMap(
          score.division || { type: 'ppqn', ticksPerQuarter: 480 },
          score.tempoMap.events || [],
          score.endTick
        );
      }
      if (!score.meterMap.segments?.length && globalScope.MidiFileParser.buildMeterMap) {
        score.meterMap = globalScope.MidiFileParser.buildMeterMap(
          score.meterMap.events || [],
          score.division || { type: 'ppqn', ticksPerQuarter: 480 },
          score.endTick
        );
      }
    }
    return attachConversions(score);
  }

  function fromParsed(parsed) {
    const score = normalize(parsed);
    if (!score) return null;
    if (!Array.isArray(parsed.parts) || parsed.parts.length === 0) {
      score.parts = buildParts(score.tracks);
    }
    // Conductor/meta tracks are often first in a Standard MIDI file and have
    // no notes.  Start the score on the first playable part so a newly
    // imported file never opens as a page of empty rests.
    const playable = score.parts.find(part =>
      (getPartTrack(score, part.id)?.notes || []).length > 0
    );
    score.activePartId = playable?.id || score.activePartId || score.parts[0]?.id || null;
    return score;
  }

  function getTrack(score, trackId) {
    return score?.tracks?.find(track => String(track.id) === String(trackId)) || null;
  }

  function getPart(score, partId) {
    return score?.parts?.find(part => String(part.id) === String(partId)) || null;
  }

  function getPartTrack(score, partId) {
    const part = getPart(score, partId);
    return part ? getTrack(score, part.trackId) : null;
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
    if (patch.enabled != null) part.enabled = Boolean(patch.enabled);
    if (patch.visible != null) part.visible = Boolean(patch.visible);
    if (patch.transpose != null && Number.isFinite(Number(patch.transpose))) {
      part.transpose = Number(patch.transpose);
    }
    if (patch.trackId != null && getTrack(next, patch.trackId)) part.trackId = patch.trackId;
    return next;
  }

  function setActivePart(score, partId) {
    const next = normalize(score);
    if (getPart(next, partId)) next.activePartId = partId;
    return next;
  }

  function getNotes(score, partId = score?.activePartId) {
    return getPartTrack(score, partId)?.notes || [];
  }

  function timeSignatureAtTick(score, tick) {
    const events = score?.meterMap?.events || [];
    let result = events[0] || { tick: 0, numerator: 4, denominator: 4 };
    events.forEach(event => {
      if (event.tick <= tick) result = event;
    });
    return result;
  }

  function getSummary(score) {
    const normalized = normalize(score);
    if (!normalized) {
      return { trackCount: 0, partCount: 0, noteCount: 0, durationSeconds: 0 };
    }
    return {
      trackCount: normalized.tracks.length,
      partCount: normalized.parts.length,
      noteCount: normalized.tracks.reduce((count, track) => count + (track.notes?.length || 0), 0),
      durationSeconds: Number(normalized.durationSeconds) || 0,
      fileName: normalized.source?.fileName || ''
    };
  }

  function serialize(score) {
    const normalized = normalize(score);
    if (!normalized) return null;
    delete normalized.conversions;
    return normalized;
  }

  const api = Object.freeze({
    ROLE_ORDER,
    ROLE_LABELS,
    inferRole,
    createPart,
    buildParts,
    attachConversions,
    normalize,
    fromParsed,
    getTrack,
    getPart,
    getPartTrack,
    assignPart,
    setActivePart,
    getNotes,
    timeSignatureAtTick,
    getSummary,
    serialize
  });

  globalScope.MidiScoreModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
