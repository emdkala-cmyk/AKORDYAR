/**
 * InstrumentTranspositionService
 *
 * Central written-pitch/sounding-pitch rules for the read-only score.  A
 * MusicXML <transpose> value wins; otherwise a conservative instrument
 * catalog supplies the common defaults used by the Live Score mapping UI.
 */
(function attachInstrumentTranspositionService(globalScope) {
  'use strict';

  const PRESETS = Object.freeze({
    bass: { name: 'Bass', transpositionSemitones: -12 },
    saxophone: { name: 'Saxophone', transpositionSemitones: 0 },
    altoSax: { name: 'Alto Saxophone in Eb', transpositionSemitones: -9 },
    tenorSax: { name: 'Tenor Saxophone in Bb', transpositionSemitones: -14 },
    sopranoSax: { name: 'Soprano Saxophone in Bb', transpositionSemitones: -2 },
    baritoneSax: { name: 'Baritone Saxophone in Eb', transpositionSemitones: -21 },
    drums: { name: 'Drums', transpositionSemitones: 0 },
    guitar: { name: 'Guitar', transpositionSemitones: -12 },
    piano: { name: 'Piano', transpositionSemitones: 0 },
    violin: { name: 'Violin', transpositionSemitones: 0 },
    flute: { name: 'Flute', transpositionSemitones: 0 },
    accordion: { name: 'Accordion', transpositionSemitones: 0 },
    keyboard: { name: 'Keyboard', transpositionSemitones: 0 },
    vocalGuide: { name: 'Vocal Guide', transpositionSemitones: 0 },
    other: { name: 'Other', transpositionSemitones: 0 }
  });

  function number(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function normalizeName(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[()_[\].,-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function inferPreset(partOrName, role = null) {
    const haystack = normalizeName(typeof partOrName === 'string'
      ? partOrName
      : [
          partOrName?.name,
          partOrName?.abbreviation,
          ...(partOrName?.instruments || []).map(item => `${item?.name || ''} ${item?.sound || ''}`)
        ].join(' '));
    if (/baritone sax/.test(haystack)) return PRESETS.baritoneSax;
    if (/alto sax/.test(haystack)) return PRESETS.altoSax;
    if (/tenor sax/.test(haystack)) return PRESETS.tenorSax;
    if (/soprano sax/.test(haystack)) return PRESETS.sopranoSax;
    if (/sax/.test(haystack)) return PRESETS.saxophone;
    return PRESETS[role] || PRESETS.other;
  }

  function fromMusicXml(transpose) {
    if (!transpose || typeof transpose !== 'object') return null;
    const chromatic = number(transpose.chromatic, 0);
    const octaveChange = number(transpose.octaveChange, 0);
    const semitones = chromatic + octaveChange * 12;
    return {
      source: 'musicxml',
      diatonic: number(transpose.diatonic, 0),
      chromatic,
      octaveChange,
      semitones,
      writtenToSounding: semitones
    };
  }

  function resolve(part, role = part?.role) {
    const musicXml = fromMusicXml(part?.transposition);
    if (musicXml) return musicXml;
    const preset = inferPreset(part, role);
    return {
      source: 'preset',
      diatonic: 0,
      chromatic: preset.transpositionSemitones,
      octaveChange: 0,
      semitones: preset.transpositionSemitones,
      writtenToSounding: preset.transpositionSemitones,
      instrumentName: preset.name
    };
  }

  function writtenToSounding(midi, transposition) {
    if (!Number.isFinite(Number(midi))) return null;
    const value = typeof transposition === 'number'
      ? transposition
      : number(transposition?.writtenToSounding ?? transposition?.semitones, 0);
    return number(midi) + value;
  }

  function soundingToWritten(midi, transposition) {
    if (!Number.isFinite(Number(midi))) return null;
    const value = typeof transposition === 'number'
      ? transposition
      : number(transposition?.writtenToSounding ?? transposition?.semitones, 0);
    return number(midi) - value;
  }

  const api = Object.freeze({
    PRESETS,
    inferPreset,
    fromMusicXml,
    resolve,
    writtenToSounding,
    soundingToWritten
  });

  globalScope.InstrumentTranspositionService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
