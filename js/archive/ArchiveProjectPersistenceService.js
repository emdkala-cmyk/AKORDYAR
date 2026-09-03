/**
 * ArchiveProjectPersistenceService
 *
 * Loads an archive project into the editor runtime and saves the current
 * runtime project back to the archive. All editor/audio boundaries are
 * injected so the archive facade keeps the old public behavior without
 * owning the implementation details.
 */
(function attachArchiveProjectPersistenceService(globalScope) {
  const DEFAULT_TRACKS = [
    { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
    { id: 't0s', name: 'Section', icon: '🏷', type: 'section' },
    { id: 't1', name: 'Vocals', icon: '🎤', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
    { id: 't2', name: 'Guitar', icon: '🎸', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
    { id: 't3', name: 'Bass', icon: '🎵', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
    { id: 't4', name: 'Keys', icon: '🎹', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
    { id: 't5', name: 'Drums', icon: '🥁', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function create(context = {}) {
    const {
      getDAW,
      getSong,
      getSongOrNull,
      setSong,
      pauseTransport,
      stopAllVoices,
      resetRecordingState,
      isValidNote,
      updateNextIdFromClips,
      getArrangerMarkers,
      ensureAudioCtx,
      updateTrackMix,
      loadAudioBlobsForProject,
      saveAudioBlobsForProject,
      peaksFromBuffer,
      refreshClipWaveImage,
      getFileHandle,
      decodeFileToBuffer,
      getAudioDirHandle,
      loadDirHandle,
      saveDirHandle,
      resetHistory,
      resetPerformanceSerialization,
      edSyncToolbar,
      edRenderEditor,
      renderAll,
      saveState,
      getElement,
      initHighlightEffect,
      rebuildSongDocument,
      syncViewStyles,
      syncMetadata,
      artistKey,
      saveCurrentVersion,
      getAllSongs,
      setAllSongs,
      performanceSettingsService = globalScope.ProjectPerformanceSettingsService,
      getIsElectron = () => false,
      generateId = () =>
        `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
      global = globalScope
    } = context;

    function normalizePerformanceSettings(song, daw = getDAW?.()) {
      if (!song || typeof song !== 'object') return null;
      const normalized =
        performanceSettingsService?.normalize?.(
          song.performanceSettings ||
          song.projectPerformanceSettings ||
          song.performance
        ) || song.performanceSettings || null;
      if (normalized) {
        song.performanceSettings = normalized;
        if (daw) daw.performanceSettings = clone(normalized);
      }
      return normalized;
    }

    async function load(data, options = {}) {
      const daw = getDAW();
      if (!data || typeof data !== 'object') throw new Error('داده پروژه نامعتبر است');
      pauseTransport();
      stopAllVoices();
      daw.clips = [];
      daw.sections = [];
      daw.selectedIds.clear();
      daw.selectedSectionIds = new Set();
      daw.bufferCache.clear();
      daw.waveCache.clear();
      daw.loopEnabled = false;
      daw.loopA = 0;
      daw.loopB = 10;
      daw.arrangerMarkers = { enabled: false, start: 0, end: 0 };
      resetRecordingState();
      setSong(clone(data));
      const song = getSong();
      if (song && !song.id) song.id = String(generateId());
      normalizePerformanceSettings(song, daw);
      if (!song.styles) song.styles = {};
      const defaults = {
        tSize: 38,
        tColor: '#0fa966',
        tFont: 'Vazirmatn',
        tBold: true,
        align: 'center',
        cSize: 38,
        cColor: '#e6aa28',
        cFont: 'JetBrains Mono'
      };
      Object.keys(defaults).forEach(key => {
        if (song.styles[key] === undefined) song.styles[key] = defaults[key];
      });
      if (!song.timeSignature) song.timeSignature = '4/4';
      if (!song.tempo) song.tempo = 120;
      if (song.transpose == null) song.transpose = 0;
      if (song.key && song.key.endsWith('m') && song.keyMode !== 'min') {
        const cleanKey = song.key.replace(/m$/, '');
        if (typeof isValidNote === 'function' && isValidNote(cleanKey)) {
          song.key = cleanKey;
          song.keyMode = 'min';
        }
      }
      if (!song.originalKey) {
        song.originalKey = song.key;
        song.originalKeyMode = song.keyMode || 'maj';
      }
      if (!song.baseChordNames || !song.baseChordNames.length) {
        song.baseChordNames = (song.chords || []).map(chord => chord.name || '');
      }
      daw.tracks = song._dawTracks
        ? clone(song._dawTracks)
        : DEFAULT_TRACKS.map(track => ({ ...track }));
      if (song._dawClips) daw.clips = clone(song._dawClips);
      daw.sections = song._dawSections ? clone(song._dawSections) : [];
      updateNextIdFromClips();
      const oldSections = daw.clips.filter(clip => clip.type === 'section');
      if (oldSections.length > 0) {
        oldSections.forEach(clip => {
          daw.sections.push({
            id: clip.id,
            trackId: clip.trackId,
            label: clip.name,
            start: clip.start,
            duration: clip.duration,
            color: clip.color
          });
        });
        daw.clips = daw.clips.filter(clip => clip.type !== 'section');
      }
      if (song._dawLoop) {
        daw.loopEnabled = !!song._dawLoop.loopEnabled;
        daw.loopA = song._dawLoop.loopA || 0;
        daw.loopB = song._dawLoop.loopB || 10;
      }
      daw.arrangerMarkers = getArrangerMarkers(song);
      ensureAudioCtx();
      daw.tracks.forEach(track => {
        if (track.type !== 'audio') return;
        if (track.transpose === undefined) track.transpose = 0;
        track._pannerNode = daw.audioCtx.createStereoPanner();
        track._gainNode = daw.audioCtx.createGain();
        track._pannerNode.connect(track._gainNode);
        track._gainNode.connect(daw.masterGain);
        updateTrackMix(track.id);
      });
      try {
        await loadAudioBlobsForProject(song.id);
        daw.clips.forEach(clip => {
          if (clip.type === 'chord' || !clip.bufferKey || !daw.bufferCache.has(clip.bufferKey)) return;
          const buffer = daw.bufferCache.get(clip.bufferKey);
          clip.sourceDuration = buffer.duration;
          clip._peaks = peaksFromBuffer(buffer, 2000);
          refreshClipWaveImage(clip);
        });
      } catch (error) {
        console.warn('IndexedDB load error:', error);
      }
      const missingAudio = daw.clips.filter(
        clip => clip.type !== 'chord' && clip.bufferKey && !daw.bufferCache.has(clip.bufferKey)
      );
      if (missingAudio.length > 0 && song._audioPaths?.length > 0) {
        if (getIsElectron() && global.electronAPI) {
          for (const audioPath of song._audioPaths) {
            if (!audioPath.filePath) continue;
            const clip = daw.clips.find(
              item => item.type !== 'chord' && item.bufferKey === audioPath.bufferKey
            );
            if (!clip || daw.bufferCache.has(clip.bufferKey)) continue;
            try {
              console.log('[LINK] Loading from path:', audioPath.filePath);
              const audioBuffer = await context.loadAudioFromHardDrive(audioPath.filePath);
              daw.bufferCache.set(clip.bufferKey, audioBuffer);
              clip.sourceDuration = audioBuffer.duration;
              clip._peaks = peaksFromBuffer(audioBuffer, 2000);
              clip._filePath = audioPath.filePath;
              refreshClipWaveImage(clip);
            } catch (error) {
              console.warn('[LINK] File not found:', audioPath.filePath, error.message);
            }
          }
        }
        const stillAfterPath = daw.clips.filter(
          clip => clip.type !== 'chord' && clip.bufferKey && !daw.bufferCache.has(clip.bufferKey)
        );
        if (stillAfterPath.length > 0) {
          for (const clip of stillAfterPath) {
            try {
              const handle = await getFileHandle(clip.bufferKey);
              if (!handle) continue;
              const permission = await handle.requestPermission({ mode: 'read' });
              if (permission !== 'granted') continue;
              const file = await handle.getFile();
              const { buffer } = await decodeFileToBuffer(file);
              daw.bufferCache.set(clip.bufferKey, buffer);
              clip.sourceDuration = buffer.duration;
              clip._peaks = peaksFromBuffer(buffer, 2000);
              refreshClipWaveImage(clip);
              console.log('[HANDLE] Auto-reloaded (loadProjectData):', clip.fileName);
            } catch (_) {
              console.warn('[HANDLE] Auto-reload failed:', clip.bufferKey);
            }
          }
        }
        const stillMissing = daw.clips.filter(
          clip => clip.type !== 'chord' && clip.bufferKey && !daw.bufferCache.has(clip.bufferKey)
        );
        if (stillMissing.length > 0) {
          let directoryHandle = getAudioDirHandle();
          if (!directoryHandle) {
            try {
              await loadDirHandle();
              directoryHandle = getAudioDirHandle();
            } catch (_) {}
          }
          if (!directoryHandle) {
            try {
              directoryHandle = await global.showDirectoryPicker({ mode: 'read' });
              await saveDirHandle(directoryHandle);
            } catch (_) {}
          }
          if (directoryHandle) {
            try {
              const permission = await directoryHandle.requestPermission({ mode: 'read' });
              if (permission === 'granted') {
                for (const audioPath of song._audioPaths) {
                  const clip = daw.clips.find(
                    item => item.type !== 'chord' && item.bufferKey === audioPath.bufferKey
                  );
                  if (!clip || daw.bufferCache.has(clip.bufferKey)) continue;
                  for (const name of [
                    audioPath.fileName,
                    audioPath.fileName ? audioPath.fileName.replace(/\.[^.]+$/, '') : ''
                  ]) {
                    if (!name) continue;
                    try {
                      const fileHandle = await directoryHandle.getFileHandle(name);
                      const file = await fileHandle.getFile();
                      const { buffer } = await decodeFileToBuffer(file);
                      daw.bufferCache.set(clip.bufferKey, buffer);
                      clip.sourceDuration = buffer.duration;
                      clip._peaks = peaksFromBuffer(buffer, 2000);
                      refreshClipWaveImage(clip);
                      break;
                    } catch (_) {}
                  }
                }
              }
            } catch (_) {}
          }
        }
      }
      resetHistory();
      resetPerformanceSerialization();
      edSyncToolbar();
      edRenderEditor(true);
      renderAll();
      saveState();
      const loopButton = getElement('loopToggleBtn');
      if (loopButton) loopButton.classList.toggle('loop-active', daw.loopEnabled);
      initHighlightEffect();
      if (typeof rebuildSongDocument === 'function') rebuildSongDocument();
      if (typeof syncViewStyles === 'function') syncViewStyles();
      return song;
    }

    async function saveToArchive() {
      const daw = getDAW();
      const song = getSongOrNull();
      if (!song) return;
      if (!song.id) song.id = String(generateId());
      normalizePerformanceSettings(song, daw);
      syncMetadata(song);
      song.artistKey = artistKey(song.artist);
      song._dawTracks = daw.tracks.map(track => ({
        id: track.id,
        name: track.name,
        icon: track.icon,
        muted: track.muted,
        solo: track.solo,
        vol: track.vol,
        pan: track.pan,
        type: track.type,
        transpose: track.transpose || 0
      }));
      song._dawClips = daw.clips.map(clip => {
        const copy = { ...clip };
        delete copy._peaks;
        delete copy.waveUrl;
        delete copy._fileHandle;
        delete copy._originalBlob;
        return copy;
      });
      song._dawSections = (daw.sections || []).map(section => ({ ...section }));
      song._dawLoop = {
        loopEnabled: daw.loopEnabled,
        loopA: daw.loopA,
        loopB: daw.loopB
      };
      song._arrangerMarkers = getArrangerMarkers(song);
      if (daw.arrangerMarkers) {
        song._arrangerMarkers = {
          enabled: daw.arrangerMarkers.enabled === true,
          start: Math.max(0, Number(daw.arrangerMarkers.start) || 0),
          end: Math.max(0, Number(daw.arrangerMarkers.end) || 0)
        };
      }
      if (typeof saveCurrentVersion === 'function') saveCurrentVersion();
      song._audioPaths = [];
      for (const clip of daw.clips) {
        if (clip.type === 'chord' || !clip.name) continue;
        song._audioPaths.push({
          bufferKey: clip.bufferKey,
          fileName: clip.fileName || clip.name,
          trackId: clip.trackId,
          filePath: clip._filePath || null
        });
      }
      song.updatedAt = new Date().toISOString();
      const songs = getAllSongs();
      const index = songs.findIndex(item => String(item.id) === String(song.id));
      const data = clone(song);
      if (index > -1) songs[index] = data;
      else songs.unshift(data);
      setAllSongs(songs);
      try {
        await saveAudioBlobsForProject(song.id);
      } catch (error) {
        console.warn('Audio archive save error:', error);
      }
      if (typeof rebuildSongDocument === 'function') rebuildSongDocument();
    }

    return Object.freeze({ load, saveToArchive });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveProjectPersistenceService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
