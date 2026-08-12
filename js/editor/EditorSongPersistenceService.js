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
    const audioPaths = (daw?.clips || [])
      .filter(clip => clip.type !== 'chord' && clip.bufferKey)
      .map(clip => ({
        bufferKey: clip.bufferKey,
        fileName: clip.fileName || clip.name,
        trackId: clip.trackId,
        filePath: clip._filePath || null
      }));

    return { tracks, clips, sections, loop, audioPaths };
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
      song._audioPaths = timeline.audioPaths;

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
