/**
 * AudioDropImportService
 *
 * کنترل import فایل صوتی روی تایم‌لاین. سرویس هیچ stateی را مالک نمی‌شود و
 * همهٔ وابستگی‌های runtime، persistence و render را از طریق context می‌گیرد.
 */
(function attachAudioDropImportService(globalScope) {
  'use strict';

  function create({
    getDAW = () => null,
    getSong = () => null,
    clearSelection = () => {},
    ensureAudioCtx = () => {},
    addNewTrack = () => {},
    askAudioCopyMode = async () => false,
    decodeFileToBuffer = async () => {
      throw new Error('decodeFileToBuffer is not configured');
    },
    uid = prefix => `${prefix}${Date.now()}`,
    roundMs = value => value,
    colors = [],
    peaksFromBuffer = () => [],
    refreshClipWaveImage = () => {},
    ensureTimelineFits = () => {},
    saveAudioBlobToDB = async () => {},
    saveAudioBlobsForProject = async () => {},
    saveState = () => {},
    renderAll = () => {},
    saveSong = () => {},
    toast = () => {},
    isElectron = false,
    electronAPI = globalScope.electronAPI,
    logger = console
  } = {}) {
    function audioFilesFrom(dataTransfer) {
      return [...(dataTransfer?.files || [])].filter(file =>
        file.type?.startsWith('audio/') ||
        /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name || '')
      );
    }

    function getTargetAudioTrack(event) {
      const daw = getDAW();
      const lane = event?.target?.closest?.('.track-lane');
      const trackId = lane?.dataset?.trackId;
      const track = daw?.tracks?.find(item => item.id === trackId);
      return track?.type === 'audio' ? track.id : null;
    }

    async function importFiles(files, event = {}) {
      const daw = getDAW();
      const song = getSong();
      if (!daw || !song || !files.length) return false;

      clearSelection();
      ensureAudioCtx();

      const targetTrackId = getTargetAudioTrack(event);
      let audioTracks = daw.tracks.filter(track => track.type === 'audio');
      if (targetTrackId) {
        audioTracks = [daw.tracks.find(track => track.id === targetTrackId)];
      }

      while (audioTracks.length < files.length) {
        addNewTrack();
        audioTracks = daw.tracks.filter(track => track.type === 'audio');
      }

      const copyToProject = await askAudioCopyMode(`${files.length} فایل صوتی`);

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const track = audioTracks[index % audioTracks.length];
        if (!track) continue;

        try {
          toast(`لود ${index + 1}/${files.length}: ${file.name}`);
          const { buffer } = await decodeFileToBuffer(file);
          const bufferKey = `buf_${uid('b')}_${file.name}`;
          daw.bufferCache.set(bufferKey, buffer);

          const lastClipEnd = daw.clips
            .filter(clip => clip.trackId === track.id)
            .reduce(
              (max, clip) => Math.max(max, clip.start + clip.duration),
              0
            );

          const clip = {
            id: uid('c'),
            type: 'audio',
            trackId: track.id,
            name: file.name.replace(/\.[^.]+$/, ''),
            fileName: file.name,
            start: roundMs(Math.max(lastClipEnd, daw.playhead)),
            duration: buffer.duration,
            offset: 0,
            sourceDuration: buffer.duration,
            color: colors[daw.clips.length % Math.max(colors.length, 1)] || '#3FB8AF',
            bufferKey,
            _peaks: peaksFromBuffer(buffer, 2000),
            waveUrl: null,
            _embedded: copyToProject,
            _originalBlob: copyToProject ? file : null
          };

          if (!copyToProject) {
            if (isElectron && file.path) {
              clip._filePath = file.path;
              logger?.log?.(
                `[DROP] Electron file path saved: ${file.name} → ${file.path}`
              );
            } else if (isElectron) {
              logger?.warn?.(
                `[DROP] Electron but file.path is missing for: ${file.name}`
              );
              if (electronAPI?.getPathForFile) {
                try {
                  const filePath = await electronAPI.getPathForFile(file);
                  if (filePath) clip._filePath = filePath;
                } catch (_) {}
              }
              if (!clip._filePath) {
                try {
                  await saveAudioBlobToDB(bufferKey, file, file.name);
                  logger?.log?.(`[DROP] Saved as blob fallback: ${file.name}`);
                } catch (_) {}
              }
            } else {
              try {
                await saveAudioBlobToDB(bufferKey, file, file.name);
              } catch (_) {}
            }
          }

          refreshClipWaveImage(clip);
          daw.clips.push(clip);
          ensureTimelineFits(clip.start + clip.duration + 5);
        } catch (error) {
          logger?.error?.(error);
          toast(`خطا در لود ${file.name}`);
        }
      }

      if (copyToProject) {
        saveAudioBlobsForProject(song.id).catch(() => {});
      } else {
        if (!Array.isArray(song._audioPaths)) song._audioPaths = [];
        daw.clips.slice(-files.length).forEach(clip => {
          if (clip._embedded || !clip.bufferKey) return;
          const existing = song._audioPaths.find(
            item => item.bufferKey === clip.bufferKey
          );
          if (!existing) {
            song._audioPaths.push({
              bufferKey: clip.bufferKey,
              fileName: clip.fileName || clip.name,
              trackId: clip.trackId,
              filePath: clip._filePath || null
            });
          }
        });
      }

      daw.selectedIds = new Set(
        daw.clips.slice(-files.length).map(clip => clip.id)
      );
      saveState();
      renderAll();
      toast(`${files.length} فایل صوتی لود شد`);
      saveSong();
      return true;
    }

    function bind(target) {
      if (!target?.addEventListener) return () => {};

      const onDragOver = event => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        target.style.outline = '2px dashed var(--accent-teal)';
      };
      const onDragLeave = () => {
        target.style.outline = '';
      };
      const onDrop = async event => {
        event.preventDefault();
        target.style.outline = '';
        const files = audioFilesFrom(event.dataTransfer);
        if (files.length) await importFiles(files, event);
      };

      target.addEventListener('dragover', onDragOver);
      target.addEventListener('dragleave', onDragLeave);
      target.addEventListener('drop', onDrop);

      return () => {
        target.removeEventListener('dragover', onDragOver);
        target.removeEventListener('dragleave', onDragLeave);
        target.removeEventListener('drop', onDrop);
      };
    }

    return Object.freeze({ audioFilesFrom, importFiles, bind });
  }

  const service = Object.freeze({ create });
  globalScope.AudioDropImportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
