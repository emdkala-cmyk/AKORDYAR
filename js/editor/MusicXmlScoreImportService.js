/**
 * MusicXmlScoreImportService
 *
 * Read-only import orchestration.  It stores the MusicXML source/model and
 * creates explicit part mappings, while leaving project playback tempo and
 * the existing ChordLine data untouched.
 */
(function attachMusicXmlScoreImportService(globalScope) {
  'use strict';

  function create({
    parser = globalScope.MusicXmlScoreParser,
    model = globalScope.MusicXmlScoreModel,
    mappingService = globalScope.ScorePartMappingService
  } = {}) {
    if (!parser?.parseFile || !parser?.parse) {
      throw new TypeError('MusicXmlScoreImportService requires MusicXmlScoreParser');
    }
    if (!model?.normalize || !model?.serialize) {
      throw new TypeError('MusicXmlScoreImportService requires MusicXmlScoreModel');
    }
    if (!mappingService?.autoMap) {
      throw new TypeError('MusicXmlScoreImportService requires ScorePartMappingService');
    }

    async function parseFile(file, options = {}) {
      const parsed = await parser.parseFile(file, options);
      return model.normalize(parsed);
    }

    function parseText(text, options = {}) {
      return model.normalize(parser.parse(text, options));
    }

    function applyToSong(song, score, {
      midiScore = song?.midiScore || null,
      mappings = song?.scorePartMappings || null
    } = {}) {
      if (!song || typeof song !== 'object') return null;
      const serializable = model.serialize(score);
      if (!serializable) return song;
      const generatedMappings = mappingService.autoMap(serializable, midiScore);
      const finalMappings = mappingService.merge(mappings, generatedMappings);
      serializable.mappings = finalMappings;
      song.musicXmlScore = model.serialize(serializable);
      song.musicXmlScoreVersion = serializable.schemaVersion || 1;
      song.scorePartMappings = finalMappings;
      song.liveScoreSettings = {
        ...(song.liveScoreSettings || {}),
        enabled: true,
        readOnly: true,
        countInEnabled: song.liveScoreSettings?.countInEnabled !== false,
        countInMeasures: Math.max(0, Number(song.liveScoreSettings?.countInMeasures) || 0)
      };
      return song;
    }

    function removeFromSong(song) {
      if (!song || typeof song !== 'object') return song;
      delete song.musicXmlScore;
      delete song.musicXmlScoreVersion;
      delete song.scorePartMappings;
      delete song.liveScoreSettings;
      return song;
    }

    function hydrate(score) {
      return model.normalize(score);
    }

    return Object.freeze({
      parseFile,
      parseText,
      applyToSong,
      removeFromSong,
      hydrate
    });
  }

  const api = Object.freeze({ create });
  globalScope.MusicXmlScoreImportService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
