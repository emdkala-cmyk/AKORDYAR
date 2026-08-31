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
      mappings = song?.scorePartMappings || null,
      merge = true
    } = {}) {
      if (!song || typeof song !== 'object') return null;
      const serializable = model.serialize(score);
      if (!serializable) return song;

      /* Merge with existing score when available and merge flag is on */
      let finalScore = serializable;
      if (merge && song.musicXmlScore) {
        const existing = model.normalize(song.musicXmlScore);
        if (existing && existing.parts && existing.parts.length > 0) {
          finalScore = model.mergeScores(existing, serializable);
        }
      }

      const generatedMappings = mappingService.autoMap(finalScore, midiScore);
      const finalMappings = mappingService.merge(mappings, generatedMappings);
      finalScore.mappings = finalMappings;
      song.musicXmlScore = model.serialize(finalScore);
      song.musicXmlScoreVersion = finalScore.schemaVersion || 1;
      mappingService.persistToSong?.(song, finalMappings);
      song.scorePartMappings = finalMappings;
      song.liveScoreSettings = {
        ...(song.liveScoreSettings || {}),
        enabled: true,
        readOnly: true,
        countInEnabled: song.liveScoreSettings?.countInEnabled !== false,
        countInMeasures: Math.max(0, Number(song.liveScoreSettings?.countInMeasures) || 0),
        mapping: finalMappings,
        ipAssignments: song.liveScoreSettings?.ipAssignments || {},
        transpositionSettings: song.liveScoreSettings?.transpositionSettings || {},
        chordLineVisibility: song.liveScoreSettings?.chordLineVisibility || {}
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
