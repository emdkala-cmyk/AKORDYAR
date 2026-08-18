/**
 * ScorePartMappingService
 *
 * Serializable mapping boundary between MusicXML parts, MIDI parts/tracks and
 * local/mobile performers.  It contains no network side effects and never
 * exposes another performer's note data.
 */
(function attachScorePartMappingService(globalScope) {
  'use strict';

  const INSTRUMENTS = Object.freeze([
    'bass', 'saxophone', 'drums', 'guitar', 'piano', 'violin', 'flute',
    'accordion', 'keyboard', 'vocalGuide', 'other'
  ]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function string(value, fallback = '') {
    return value == null ? fallback : String(value);
  }

  function normalizeMapping(mapping, index = 0) {
    const role = INSTRUMENTS.includes(mapping?.role) ? mapping.role : 'other';
    return {
      id: string(mapping?.id, `mapping-${index + 1}`),
      musicXmlPartId: string(mapping?.musicXmlPartId || mapping?.partId, ''),
      midiPartId: mapping?.midiPartId == null ? null : string(mapping.midiPartId),
      midiTrackId: mapping?.midiTrackId == null ? null : string(mapping.midiTrackId),
      role,
      instrument: string(mapping?.instrument, role),
      transposeSemitones: Number.isFinite(Number(mapping?.transposeSemitones))
        ? Number(mapping.transposeSemitones)
        : null,
      deviceIds: Array.isArray(mapping?.deviceIds)
        ? mapping.deviceIds.map(value => string(value)).filter(Boolean)
        : [],
      ip: mapping?.ip ? string(mapping.ip) : null,
      showChords: mapping?.showChords !== false,
      visible: mapping?.visible !== false,
      enabled: mapping?.enabled !== false,
      status: ['connected', 'connecting', 'disconnected', 'waiting-sync'].includes(mapping?.status)
        ? mapping.status
        : 'disconnected',
      updatedAt: Number.isFinite(Number(mapping?.updatedAt))
        ? Number(mapping.updatedAt)
        : 0
    };
  }

  function normalizeMappings(mappings) {
    return (Array.isArray(mappings) ? mappings : []).map(normalizeMapping);
  }

  function scorePartNames(part) {
    return [
      part?.id,
      part?.name,
      part?.abbreviation,
      part?.role,
      ...(part?.instruments || []).map(instrument => instrument?.name)
    ].filter(Boolean).map(value => String(value).toLowerCase());
  }

  function midiTrackNames(track, midiPart) {
    return [
      track?.id,
      track?.name,
      track?.instrumentName,
      midiPart?.id,
      midiPart?.name,
      midiPart?.role
    ].filter(Boolean).map(value => String(value).toLowerCase());
  }

  function similarity(a, b) {
    const left = scorePartNames(a);
    const right = midiTrackNames(b.track, b.part);
    let score = 0;
    left.forEach(leftValue => right.forEach(rightValue => {
      if (leftValue === rightValue) score += 100;
      else if (leftValue.includes(rightValue) || rightValue.includes(leftValue)) score += 20;
    }));
    if (a?.role && b?.part?.role && a.role === b.part.role) score += 35;
    return score;
  }

  function autoMap(musicXmlScore, midiScore) {
    const xmlParts = musicXmlScore?.parts || [];
    const midiParts = midiScore?.parts || [];
    const midiModel = globalScope.MidiScoreModel;
    const candidates = midiParts.map(part => ({
      part,
      track: midiModel?.getPartTrack?.(midiScore, part.id) || null,
      used: false
    }));
    return xmlParts.map((part, index) => {
      let best = null;
      candidates.forEach(candidate => {
        if (candidate.used) return;
        const value = similarity(part, candidate);
        if (!best || value > best.score) best = { candidate, score: value };
      });
      if (best) best.candidate.used = true;
      const midiPart = best?.candidate?.part || null;
      const midiTrack = best?.candidate?.track || null;
      return normalizeMapping({
        id: `mapping-${index + 1}`,
        musicXmlPartId: part.id,
        midiPartId: midiPart?.id || null,
        midiTrackId: midiTrack?.id || null,
        role: part.role,
        instrument: part.role,
        confidence: best?.score || 0
      }, index);
    });
  }

  function merge(existing, generated) {
    const byXml = new Map(normalizeMappings(existing).map(item => [item.musicXmlPartId, item]));
    return normalizeMappings(generated).map(item => {
      const previous = byXml.get(item.musicXmlPartId);
      return normalizeMapping(previous ? { ...item, ...previous } : item);
    });
  }

  function assign(mappingList, musicXmlPartId, patch = {}) {
    const next = normalizeMappings(mappingList);
    const index = next.findIndex(item => item.musicXmlPartId === String(musicXmlPartId));
    if (index < 0) {
      next.push(normalizeMapping({ ...patch, musicXmlPartId }, next.length));
    } else {
      next[index] = normalizeMapping({ ...next[index], ...clone(patch) }, index);
    }
    return next;
  }

  function forPart(mappingList, musicXmlPartId) {
    return normalizeMappings(mappingList)
      .find(item => item.musicXmlPartId === String(musicXmlPartId)) || null;
  }

  function persistToSong(song, mappings) {
    if (!song || typeof song !== 'object') return song;
    const normalized = normalizeMappings(mappings);
    song.scorePartMappings = normalized;
    song.liveScoreSettings = {
      ...(song.liveScoreSettings || {}),
      enabled: song.liveScoreSettings?.enabled !== false,
      readOnly: true,
      mapping: normalized,
      ipAssignments: normalized.reduce((acc, item) => {
        if (item.ip) acc[item.musicXmlPartId] = item.ip;
        return acc;
      }, { ...(song.liveScoreSettings?.ipAssignments || {}) }),
      transpositionSettings: normalized.reduce((acc, item) => {
        if (item.transposeSemitones != null) acc[item.musicXmlPartId] = item.transposeSemitones;
        return acc;
      }, { ...(song.liveScoreSettings?.transpositionSettings || {}) }),
      chordLineVisibility: normalized.reduce((acc, item) => {
        acc[item.musicXmlPartId] = item.showChords !== false;
        return acc;
      }, { ...(song.liveScoreSettings?.chordLineVisibility || {}) })
    };
    return song;
  }

  const api = Object.freeze({
    INSTRUMENTS,
    normalizeMapping,
    normalizeMappings,
    autoMap,
    merge,
    assign,
    forPart,
    persistToSong
  });

  globalScope.ScorePartMappingService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
