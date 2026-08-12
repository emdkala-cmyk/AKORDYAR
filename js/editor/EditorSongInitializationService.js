/**
 * EditorSongInitializationService
 *
 * هماهنگ‌کنندهٔ restore سند، hydration تایم‌لاین و بازیابی فایل‌های صوتی.
 * مالک state نیست؛ song و runtime فقط از طریق callback وارد می‌شوند.
 */
(function attachEditorSongInitializationService(globalScope) {
  function audioClips(daw) {
    return (daw?.clips || []).filter(
      clip => clip.type !== 'chord' && clip.bufferKey
    );
  }

  function missingAudioClips(daw) {
    return audioClips(daw).filter(
      clip => !daw.bufferCache?.has?.(clip.bufferKey)
    );
  }

  function cacheBuffer(clip, buffer, daw, peaksFromBuffer, refreshClipWaveImage) {
    daw.bufferCache.set(clip.bufferKey, buffer);
    clip.sourceDuration = buffer.duration;
    clip._peaks = peaksFromBuffer(buffer, 2000);
    refreshClipWaveImage(clip);
  }

  async function restoreAudio(song, {
    daw,
    loadAudioBlobsForProject,
    getAudioBlobFromDB,
    decodeFileToBuffer,
    loadAudioFromHardDrive,
    getFileHandle,
    getDirHandle,
    setDirHandle,
    saveDirHandle,
    showDirectoryPicker,
    isElectron = false,
    electronAvailable = false,
    peaksFromBuffer = () => [],
    refreshClipWaveImage = () => {},
    toast = () => {},
    logger = console
  } = {}) {
    if (!song || !daw) return;

    try {
      await loadAudioBlobsForProject?.(song.id);
      audioClips(daw).forEach(clip => {
        const buffer = daw.bufferCache?.get?.(clip.bufferKey);
        if (buffer) {
          cacheBuffer(clip, buffer, daw, peaksFromBuffer, refreshClipWaveImage);
        }
      });
    } catch (error) {
      logger?.warn?.('Audio init load error:', error);
    }

    const paths = Array.isArray(song._audioPaths) ? song._audioPaths : [];
    let missing = missingAudioClips(daw);
    logger?.log?.(
      `[Audio Init] ${missing.length} clip(s) need audio loading. ` +
      `isElectron=${isElectron}, _audioPaths=${paths.length}`
    );
    if (!missing.length || !paths.length) return;

    if (isElectron && electronAvailable && typeof loadAudioFromHardDrive === 'function') {
      for (const audioPath of paths) {
        if (!audioPath.filePath) {
          logger?.warn?.('[LINK] No filePath for:', audioPath.fileName);
          continue;
        }
        const clip = audioClips(daw).find(
          item => item.bufferKey === audioPath.bufferKey
        );
        if (!clip || daw.bufferCache.has(clip.bufferKey)) continue;
        try {
          const buffer = await loadAudioFromHardDrive(audioPath.filePath);
          cacheBuffer(clip, buffer, daw, peaksFromBuffer, refreshClipWaveImage);
          clip._filePath = audioPath.filePath;
          logger?.log?.('[LINK] Loaded:', audioPath.fileName);
        } catch (error) {
          logger?.warn?.(
            '[LINK] File not found at path:',
            audioPath.filePath,
            error?.message
          );
        }
      }
    }

    missing = missingAudioClips(daw);
    for (const clip of missing) {
      try {
        const record = await getAudioBlobFromDB?.(clip.bufferKey);
        if (!record) continue;
        const decoded = await decodeFileToBuffer(record.blob);
        cacheBuffer(clip, decoded.buffer, daw, peaksFromBuffer, refreshClipWaveImage);
        logger?.log?.('[BLOB] Auto-reloaded:', record.fileName);
      } catch (error) {
        logger?.warn?.(
          '[BLOB] Auto-reload failed for',
          clip.bufferKey,
          error?.message
        );
      }
    }

    missing = missingAudioClips(daw);
    for (const clip of missing) {
      try {
        const handle = await getFileHandle?.(clip.bufferKey);
        if (!handle?.requestPermission) continue;
        const permission = await handle.requestPermission({ mode: 'read' });
        if (permission !== 'granted') continue;
        const decoded = await decodeFileToBuffer(await handle.getFile());
        cacheBuffer(clip, decoded.buffer, daw, peaksFromBuffer, refreshClipWaveImage);
        logger?.log?.('[HANDLE] Auto-reloaded:', clip.fileName);
      } catch (error) {
        logger?.warn?.(
          '[HANDLE] Auto-reload failed for',
          clip.bufferKey,
          error?.message
        );
      }
    }

    missing = missingAudioClips(daw);
    if (!missing.length) return;

    let directory = await getDirHandle?.();
    if (!directory) {
      try {
        directory = await getDirHandle?.({ load: true });
      } catch (_) {}
    }
    if (directory) {
      try {
        const permission = await directory.requestPermission({ mode: 'read' });
        if (permission === 'granted') {
          const notFound = [];
          for (const audioPath of paths) {
            const clip = audioClips(daw).find(
              item => item.bufferKey === audioPath.bufferKey
            );
            if (!clip || daw.bufferCache.has(clip.bufferKey)) continue;
            let loaded = false;
            const candidates = [
              audioPath.fileName,
              audioPath.fileName?.replace(/\.[^.]+$/, '')
            ];
            for (const name of candidates.filter(Boolean)) {
              try {
                const file = await (await directory.getFileHandle(name)).getFile();
                const decoded = await decodeFileToBuffer(file);
                cacheBuffer(clip, decoded.buffer, daw, peaksFromBuffer, refreshClipWaveImage);
                loaded = true;
                break;
              } catch (_) {}
            }
            if (!loaded) notFound.push(audioPath.fileName || 'نام‌ناشناخته');
          }
          if (notFound.length) {
            toast('فایل‌های صوتی پیدا نشد: ' + notFound.join(', '));
          }
        }
      } catch (_) {}
    }

    missing = missingAudioClips(daw);
    if (!missing.length || isElectron || typeof showDirectoryPicker !== 'function') {
      return;
    }

    try {
      const selectedDirectory = await showDirectoryPicker({ mode: 'read' });
      await setDirHandle?.(selectedDirectory);
      const permission = await selectedDirectory.requestPermission({ mode: 'read' });
      if (permission !== 'granted') return;

      for (const audioPath of paths) {
        const clip = audioClips(daw).find(
          item => item.bufferKey === audioPath.bufferKey
        );
        if (!clip || daw.bufferCache.has(clip.bufferKey)) continue;
        const candidates = [
          audioPath.fileName,
          audioPath.fileName?.replace(/\.[^.]+$/, '')
        ];
        for (const name of candidates.filter(Boolean)) {
          try {
            const file = await (await selectedDirectory.getFileHandle(name)).getFile();
            const decoded = await decodeFileToBuffer(file);
            cacheBuffer(clip, decoded.buffer, daw, peaksFromBuffer, refreshClipWaveImage);
            break;
          } catch (_) {}
        }
      }
    } catch (_) {
      // لغو انتخاب پوشه توسط کاربر، بخشی از جریان عادی است.
    }
  }

  async function initialize({
    storage = globalScope.localStorage,
    storageKey = 'ed_current_song',
    getSong = () => null,
    setSong = () => {},
    blankSong = () => null,
    repairSong = value => value,
    hydrationService = globalScope.EditorHydrationService,
    documentRef = globalScope.document,
    daw = null,
    updateNextIdFromClips,
    ensureAudioCtx,
    updateTrackMix,
    loadAudioBlobsForProject,
    getAudioBlobFromDB,
    decodeFileToBuffer,
    loadAudioFromHardDrive,
    getFileHandle,
    getDirHandle,
    setDirHandle,
    saveDirHandle,
    showDirectoryPicker = globalScope.showDirectoryPicker,
    isElectron = false,
    electronAvailable = false,
    peaksFromBuffer,
    refreshClipWaveImage,
    syncToolbar,
    renderEditor,
    resetHistory,
    renderAll,
    saveState,
    initHighlightEffect,
    rebuildSongDocument,
    syncViewStyles,
    toast,
    logger = console
  } = {}) {
    const saved = storage?.getItem?.(storageKey);
    if (saved) {
      try {
        setSong(repairSong(JSON.parse(saved)));
      } catch (error) {
        logger?.warn?.('Song restore error:', error);
        setSong(null);
      }
    }

    if (!getSong()) setSong(blankSong());
    const song = getSong();
    hydrationService?.hydrateSong?.(song, {
      documentRef,
      daw,
      styleDefaults: {
        tSize: 38,
        tColor: '#0fa966',
        tFont: 'Vazirmatn',
        tBold: true,
        align: 'center',
        cSize: 38,
        cColor: '#e6aa28',
        cFont: 'JetBrains Mono'
      },
      updateNextIdFromClips,
      ensureAudioCtx,
      updateTrackMix,
      initializeAudioTracks: true
    });

    await restoreAudio(song, {
      daw,
      loadAudioBlobsForProject,
      getAudioBlobFromDB,
      decodeFileToBuffer,
      loadAudioFromHardDrive,
      getFileHandle,
      getDirHandle,
      setDirHandle,
      saveDirHandle,
      showDirectoryPicker,
      isElectron,
      electronAvailable,
      peaksFromBuffer,
      refreshClipWaveImage,
      toast,
      logger
    });

    syncToolbar?.();
    renderEditor?.();
    resetHistory?.();
    syncToolbar?.();
    renderEditor?.(true);
    renderAll?.();
    saveState?.();
    initHighlightEffect?.();
    rebuildSongDocument?.(song);
    syncViewStyles?.(song);
    return song;
  }

  const service = Object.freeze({ initialize, restoreAudio });
  globalScope.EditorSongInitializationService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
