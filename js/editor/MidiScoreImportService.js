/**
 * MidiScoreImportService
 *
 * DOM-free orchestration for importing an SMF into the current song model.
 * Rendering, persistence and transport remain outside this service.
 */
(function attachMidiScoreImportService(globalScope) {
  'use strict';

  function create({
    parser = globalScope.MidiFileParser,
    model = globalScope.MidiScoreModel
  } = {}) {
    if (!parser?.parseFile) throw new TypeError('MidiScoreImportService requires MidiFileParser');
    if (!model?.fromParsed || !model?.serialize) {
      throw new TypeError('MidiScoreImportService requires MidiScoreModel');
    }

    async function parseFile(file, options = {}) {
      const parsed = await parser.parseFile(file, options);
      return model.fromParsed(parsed);
    }

    function applyToSong(song, score) {
      if (!song || typeof song !== 'object') return null;
      const serializable = model.serialize(score);
      if (!serializable) return song;
      song.midiScore = serializable;
      song.midiScoreVersion = serializable.schemaVersion || 1;

      const firstTempo = serializable.tempoMap?.events?.[0];
      const firstMeter = serializable.meterMap?.events?.[0];
      if (firstTempo?.bpm > 0) {
        song.tempo = firstTempo.bpm;
        song.bpm = firstTempo.bpm;
      }
      if (firstMeter?.numerator && firstMeter?.denominator) {
        song.timeSignature = `${firstMeter.numerator}/${firstMeter.denominator}`;
      }
      return song;
    }

    function removeFromSong(song) {
      if (!song || typeof song !== 'object') return song;
      delete song.midiScore;
      delete song.midiScoreVersion;
      return song;
    }

    function hydrate(score) {
      return model.normalize(score);
    }

    return Object.freeze({
      parseFile,
      applyToSong,
      removeFromSong,
      hydrate
    });
  }

  const api = Object.freeze({ create });
  globalScope.MidiScoreImportService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
