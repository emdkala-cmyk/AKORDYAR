/**
 * EditorSongPersistenceService
 *
 * ساخت snapshot قابل‌ذخیره از song و DAW و نگهداری آن در storage.
 * این سرویس به DOM، window.edCur، DAW global یا PERF دسترسی مستقیم ندارد.
 */
(function attachEditorSongPersistenceService(globalScope) {
  function cloneSerializableClip(clip) {
    const copy = { ...clip };
    delete copy._peaks;
    delete copy.waveUrl;
    delete copy._fileHandle;
    delete copy._originalBlob;
    return copy;
  }

  function snapshotTimeline(daw) {
    const tracks = (daw?.tracks || []).map(track => ({
      id: track.id,
      name: track.name,
      icon: track.icon,
      muted: track.muted,
      solo: track.solo,
      vol: track.vol,
      pan: track.pan,
      type: track.type,
      transpose: track.transpose || 0,
      laneHeight: track.laneHeight || null
    }));
    const clips = (daw?.clips || []).map(cloneSerializableClip);
    const sections = (daw?.sections || []).map(section => ({ ...section }));
    const loop = {
      loopEnabled: daw?.loopEnabled,
      loopA: daw?.loopA,
      loopB: daw?.loopB
    };
    const arrangerMarkers =
      globalScope.ArrangerMarkerService?.fromDAW?.(daw) || {
        start: Math.max(0, Number(daw?.arrangerMarkers?.start) || 0),
        end: Math.max(0, Number(daw?.arrangerMarkers?.end) || 0)
      };
    const audioPaths = (daw?.clips || [])
      .filter(clip => clip.type !== 'chord' && clip.bufferKey)
      .map(clip => ({
        bufferKey: clip.bufferKey,
        fileName: clip.fileName || clip.name,
        trackId: clip.trackId,
        filePath: clip._filePath || null
      }));

    return { tracks, clips, sections, loop, arrangerMarkers, audioPaths };
  }

  function create({
    getSong = () => null,
    getDAW = () => null,
    syncMetadata = () => {},
    artistKey = value => value || '',
    storage = globalScope.localStorage,
    storageKey = 'ed_current_song',
    scheduleAudioBlobSave = () => {},
    rebuildSongDocument = () => {},
    syncViewStyles = () => {},
    logger = console
  } = {}) {
    function save() {
      const song = getSong();
      if (!song) return false;

      const daw = getDAW() || {};
      syncMetadata(song);
      song.artistKey = artistKey(song.artist);

      const timeline = snapshotTimeline(daw);
      song._dawTracks = timeline.tracks;
      song._dawClips = timeline.clips;
      song._dawSections = timeline.sections;
      song._dawLoop = timeline.loop;
      song._arrangerMarkers = timeline.arrangerMarkers;
      song._audioPaths = timeline.audioPaths;
      if (song.midiScore && globalScope.MidiScoreModel?.normalize) {
        try {
          song.midiScore = globalScope.MidiScoreModel.serialize(
            globalScope.MidiScoreModel.normalize(song.midiScore)
          );
        } catch (error) {
          logger?.warn?.('[MIDI Score] Persistence normalization skipped:', error);
        }
      }
      if (song.musicXmlScore && globalScope.MusicXmlScoreModel?.normalize) {
        try {
          song.musicXmlScore = globalScope.MusicXmlScoreModel.serialize(
            globalScope.MusicXmlScoreModel.normalize(song.musicXmlScore)
          );
        } catch (error) {
          logger?.warn?.('[MusicXML Score] Persistence normalization skipped:', error);
        }
      }
      if (!Array.isArray(song.scorePartMappings)) song.scorePartMappings = [];
      if (song.liveScoreSettings && typeof song.liveScoreSettings === 'object') {
        song.liveScoreSettings = {
          ...song.liveScoreSettings,
          readOnly: true,
          countInMeasures: Math.max(0, Number(song.liveScoreSettings.countInMeasures) || 0),
          mapping: Array.isArray(song.liveScoreSettings.mapping)
            ? song.liveScoreSettings.mapping
            : song.scorePartMappings,
          ipAssignments: song.liveScoreSettings.ipAssignments &&
            typeof song.liveScoreSettings.ipAssignments === 'object'
            ? song.liveScoreSettings.ipAssignments : {},
          transpositionSettings: song.liveScoreSettings.transpositionSettings &&
            typeof song.liveScoreSettings.transpositionSettings === 'object'
            ? song.liveScoreSettings.transpositionSettings : {},
          chordLineVisibility: song.liveScoreSettings.chordLineVisibility &&
            typeof song.liveScoreSettings.chordLineVisibility === 'object'
            ? song.liveScoreSettings.chordLineVisibility : {},
          playheadMode: song.liveScoreSettings.playheadMode === 'measure'
            ? 'measure'
            : 'line'
        };
      }

      try {
        storage?.setItem?.(storageKey, JSON.stringify(song));
      } catch (error) {
        logger?.warn?.('Project save error:', error);
      }

      scheduleAudioBlobSave();
      rebuildSongDocument(song);
      syncViewStyles(song);
      return true;
    }

    return Object.freeze({
      save,
      snapshotTimeline
    });
  }

  const service = Object.freeze({ create, snapshotTimeline });
  globalScope.EditorSongPersistenceService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
