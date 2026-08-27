/**
 * CoreAudioImportService
 *
 * Owns the file-input route used when a timeline track requests an audio
 * file. The service mutates the injected DAW state but keeps decoding,
 * waveform rendering, persistence and UI orchestration outside its module.
 */
(function attachCoreAudioImportService(globalScope) {
  'use strict';

  function create({
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || {},
    getFileInput = () =>
      globalScope.document?.getElementById?.('audio-file-input'),
    renderTracks = () => {},
    clearSelection = () => {},
    ensureAudioCtx = () => {},
    decodeFileToBuffer = async () => {
      throw new Error('decodeFileToBuffer is not configured');
    },
    askAudioCopyMode = async () => false,
    uid = prefix => `${prefix || 'c'}${Date.now()}`,
    roundMs = value => value,
    colors = [],
    peaksFromBuffer = () => [],
    refreshClipWaveImage = () => {},
    ensureTimelineFits = () => {},
    saveAudioBlobToDB = async () => {},
    saveAudioBlobsForProject = async () => {},
    saveState = () => {},
    renderAll = () => {},
    scheduleAllFromPlayhead = () => {},
    getSong = () => null,
    saveSong = () => {},
    toast = () => {},
    translate = value => globalScope.t?.(value) ?? value,
    isElectron = false,
    getElectronAPI = () => globalScope.electronAPI || null,
    logger = console
  } = {}) {
    let boundInput = null;
    let boundHandler = null;

    function openFileForTrack(trackId) {
      const daw = getDAW();
      if (!daw) return;
      daw.loadTrackId = trackId;
      renderTracks();

      const input = getFileInput();
      if (!input) return;
      input.value = '';
      input.click?.();
    }

    async function persistLinkedFile(clipId, file, clip) {
      if (isElectron && file.path) {
        clip._filePath = file.path;
        logger?.log?.(
          `[INPUT] Electron file path saved: ${file.name} → ${file.path}`
        );
        return;
      }

      if (isElectron) {
        logger?.warn?.(
          `[INPUT] Electron but file.path is missing for: ${file.name}`
        );
        const electronAPI = getElectronAPI?.();
        if (electronAPI?.getPathForFile) {
          try {
            const filePath = await electronAPI.getPathForFile(file);
            if (filePath) {
              clip._filePath = filePath;
              logger?.log?.(
                `[INPUT] Got path via webUtils: ${file.name} → ${filePath}`
              );
            }
          } catch (_) {}
        }

        if (!clip._filePath) {
          try {
            await saveAudioBlobToDB(clipId, file, file.name);
            logger?.log?.(`[INPUT] Saved as blob fallback: ${file.name}`);
          } catch (error) {
            logger?.warn?.(
              '[BLOB] Could not save file blob to IndexedDB:',
              error
            );
          }
        }
        return;
      }

      try {
        await saveAudioBlobToDB(clipId, file, file.name);
      } catch (error) {
        logger?.warn?.(
          '[BLOB] Could not save file blob to IndexedDB:',
          error
        );
      }
    }

    async function importFileForTrack(file, trackId) {
      const daw = getDAW();
      if (!daw || !file || !trackId) return null;

      clearSelection();
      ensureAudioCtx();
      toast(translate('decoding'));
      const { buffer } = await decodeFileToBuffer(file);
      const clipId = `clip_${uid('c')}`;
      const storageMode = await askAudioCopyMode(file.name);
      const storage = {
        mode: storageMode ? 'copy' : 'reference',
        projectPath: storageMode ? `Audio/${clipId}_${file.name}` : null,
        externalPath: storageMode
          ? null
          : (isElectron && file.path ? file.path : null)
      };

      daw.pool = daw.pool || {};
      daw.pool[clipId] = {
        id: clipId,
        name: file.name.replace(/\.[^.]+$/, ''),
        originalName: file.name,
        storage,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        frames: buffer.length,
        duration: buffer.duration,
        offlineOps: []
      };
      daw.bufferCache?.set?.(clipId, buffer);

      const clip = {
        id: clipId,
        type: 'audio',
        trackId,
        name: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        start: roundMs(daw.playhead),
        duration: buffer.duration,
        offset: 0,
        sourceDuration: buffer.duration,
        color: colors[daw.clips.length % colors.length],
        _peaks: peaksFromBuffer(buffer, 2000),
        waveUrl: null,
        _embedded: storageMode,
        _originalBlob: storageMode ? file : null
      };

      if (!storageMode) {
        await persistLinkedFile(clipId, file, clip);
      }

      refreshClipWaveImage(clip);
      daw.clips.push(clip);
      daw.selectedIds = new Set([clip.id]);
      ensureTimelineFits(clip.start + clip.duration + 5);
      saveState();
      renderAll();
      if (daw.isPlaying) scheduleAllFromPlayhead();

      if (storageMode) {
        toast(
          `${translate('loadedOk')} ${clip.name} (کپی در پروژه)`
        );
        const songId = getSong()?.id;
        if (songId) saveAudioBlobsForProject(songId).catch(() => {});
      } else {
        toast(
          `${translate('loadedOk')} ${clip.name} (لینک — فقط مسیر ذخیره شد)`
        );
      }
      saveSong();
      return clip;
    }

    async function handleFileInputChange(event) {
      const input = event?.currentTarget || event?.target;
      const file = input?.files?.[0];
      const daw = getDAW();
      const trackId = daw?.loadTrackId;
      if (daw) daw.loadTrackId = null;
      renderTracks();
      if (!file || !trackId) return null;

      // EditorLifecycleService owns the generic/no-track fallback. Prevent
      // that listener from importing the same file a second time.
      event?.stopImmediatePropagation?.();
      try {
        return await importFileForTrack(file, trackId);
      } catch (error) {
        logger?.error?.(error);
        toast(translate('loadFailed'));
        return null;
      }
    }

    function bindFileInput(target = getFileInput()) {
      if (!target?.addEventListener || boundInput === target) {
        return boundHandler;
      }
      if (boundInput && boundHandler) {
        boundInput.removeEventListener('change', boundHandler);
      }
      boundInput = target;
      boundHandler = event => handleFileInputChange(event);
      target.addEventListener('change', boundHandler);
      return boundHandler;
    }

    function unbindFileInput() {
      if (boundInput && boundHandler) {
        boundInput.removeEventListener('change', boundHandler);
      }
      boundInput = null;
      boundHandler = null;
    }

    return Object.freeze({
      openFileForTrack,
      importFileForTrack,
      handleFileInputChange,
      bindFileInput,
      unbindFileInput
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreAudioImportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
