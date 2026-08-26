/**
 * ArchiveProjectFileImportService
 *
 * Owns the single-project file import path. The archive facade keeps the
 * existing public action while this service coordinates file parsing, project
 * hydration and audio recovery callbacks.
 */
(function attachArchiveProjectFileImportService(globalScope) {
  const DEFAULT_STYLES = Object.freeze({
    tSize: 38,
    tColor: '#0fa966',
    tFont: 'Vazirmatn',
    tBold: true,
    align: 'center',
    cSize: 38,
    cColor: '#e6aa28',
    cFont: 'JetBrains Mono'
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function create(context = {}) {
    const {
      getDAW,
      getSong,
      getElement = id => globalScope.document?.getElementById(id),
      setEditorSong,
      setProjectFilePath = () => {},
      clearProjectFilePath = () => {},
      pauseTransport = () => {},
      stopAllVoices = () => {},
      updateNextIdFromClips = () => {},
      getArrangerMarkers = () => ({ enabled: false, start: 0, end: 0 }),
      ensureAudioCtx = () => {},
      updateTrackMix = () => {},
      applyImportChords = () => {},
      loadAudioBlobsForProject = async () => {},
      saveAudioBlobsForProject = async () => {},
      peaksFromBuffer = () => [],
      refreshClipWaveImage = () => {},
      base64ToUint8 = value =>
        Uint8Array.from(atob(value), char => char.charCodeAt(0)),
      decodeWebMToBuffer = async () => null,
      decompressBytes = async value => value,
      resampleFloat32 = value => value,
      getFileHandle = async () => null,
      decodeFileToBuffer = async () => ({}),
      getAudioDirHandle = () => null,
      loadDirHandle = async () => null,
      saveDirHandle = async () => {},
      loadAudioFromHardDrive = async () => null,
      getIsElectron = () => false,
      resetHistory = () => {},
      resetPerformanceSerialization = () => {},
      syncToolbar = () => {},
      renderEditor = () => {},
      initHighlightEffect = () => {},
      saveState = () => {},
      saveSong = () => {},
      renderAll = () => {},
      toast = () => {},
      logError = (...args) => console.error(...args),
      getGlobal = () => globalScope
    } = context;

    const audioRecovery = context.audioRecovery ||
      globalScope.ArchiveProjectAudioRecoveryService?.create({
        ensureAudioCtx,
        saveAudioBlobsForProject,
        peaksFromBuffer,
        refreshClipWaveImage,
        base64ToUint8,
        decodeWebMToBuffer,
        decompressBytes,
        resampleFloat32,
        getFileHandle,
        decodeFileToBuffer,
        getAudioDirHandle,
        loadDirHandle,
        saveDirHandle,
        loadAudioFromHardDrive,
        getIsElectron,
        getGlobal: () => globalScope,
        toast
      });
    if (!audioRecovery) {
      throw new Error('ArchiveProjectAudioRecoveryService is not loaded. Check script order.');
    }

    async function importSingle(file) {
      try {
        if (file?._projectFilePath) setProjectFilePath(file._projectFilePath);
        else clearProjectFilePath();
        toast('در حال لود پروژه...');
        const data = JSON.parse(await file.text());
        if (!data || typeof data !== 'object') throw new Error('Invalid');

        const daw = getDAW();
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
        setEditorSong(data);
        const song = getSong();
        if (!song.styles) song.styles = {};
        Object.keys(DEFAULT_STYLES).forEach(key => {
          if (song.styles[key] === undefined) song.styles[key] = DEFAULT_STYLES[key];
        });
        if (!song.timeSignature) song.timeSignature = '4/4';
        if (!song.tempo) song.tempo = 120;
        if (!song.genre) song.genre = '';

        if (song.rawText && !song.lyrics) {
          getElement('importText').value = song.rawText;
          getElement('importUrl').value = song.url || '';
          applyImportChords(song);
        }

        if (song._dawTracks) daw.tracks = clone(song._dawTracks);
        if (song._dawClips) daw.clips = clone(song._dawClips);
        daw.sections = song._dawSections ? clone(song._dawSections) : [];
        updateNextIdFromClips();
        const oldSections = daw.clips.filter(clip => clip.type === 'section');
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
        if (oldSections.length > 0) {
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
        resetHistory();
        resetPerformanceSerialization();
        syncToolbar();
        renderEditor(true);
        initHighlightEffect();
        const loopButton = getElement('loopToggleBtn');
        if (loopButton) loopButton.classList.toggle('loop-active', daw.loopEnabled);

        const audioClips = daw.clips.filter(clip => clip.type !== 'chord');
        if (audioClips.length > 0) {
          try {
            await loadAudioBlobsForProject(song.id);
          } catch (_) {}
          daw.clips.forEach(clip => {
            if (
              clip.type !== 'chord' &&
              clip.bufferKey &&
              daw.bufferCache.has(clip.bufferKey)
            ) {
              const buffer = daw.bufferCache.get(clip.bufferKey);
              clip.sourceDuration = buffer.duration;
              clip._peaks = peaksFromBuffer(buffer, 2000);
              refreshClipWaveImage(clip);
            }
          });
          await audioRecovery.restoreEmbeddedAudio(song, daw, audioClips);
          if (audioClips.some(
            clip => clip.bufferKey && !daw.bufferCache.has(clip.bufferKey)
          )) {
            await audioRecovery.restoreLinkedAudio(song, daw, audioClips);
          }
        }

        daw.clips.forEach(clip => {
          if (
            clip.type !== 'chord' &&
            clip.bufferKey &&
            daw.bufferCache.has(clip.bufferKey) &&
            !clip._peaks
          ) {
            const buffer = daw.bufferCache.get(clip.bufferKey);
            clip.sourceDuration = buffer.duration;
            clip._peaks = peaksFromBuffer(buffer, 2000);
            refreshClipWaveImage(clip);
          }
        });
        await saveAudioBlobsForProject(song.id).catch(error => {
          console.warn('Audio save error:', error);
        });
        saveState();
        saveSong();
        renderAll();
        toast('پروژه لود شد: ' + file.name);
        return { ok: true, song };
      } catch (error) {
        logError(error);
        toast('خطا در لود فایل!');
        return { ok: false, error };
      }
    }

    return Object.freeze({ importSingle });
  }

  const service = Object.freeze({ create, defaultStyles: DEFAULT_STYLES });
  globalScope.ArchiveProjectFileImportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
