/**
 * AudioRecoveryService
 *
 * Owns the ordered recovery paths for project audio:
 * IndexedDB, Electron file paths, persisted file handles, a saved directory,
 * and (when explicitly allowed) a directory picker.
 *
 * The service does not read edCur, DAW, PERF, DOM, or Electron globals
 * directly. Runtime access is injected through callbacks.
 */
(function attachAudioRecoveryService(globalScope) {
  function audioClips(daw) {
    return (daw?.clips || []).filter(
      clip => clip?.type !== 'chord' && clip?.bufferKey
    );
  }

  function missingAudioClips(daw) {
    return audioClips(daw).filter(
      clip => !daw?.bufferCache?.has?.(clip.bufferKey)
    );
  }

  function ensureBufferCache(daw) {
    if (!daw) return null;
    if (!daw.bufferCache || typeof daw.bufferCache.set !== 'function') {
      daw.bufferCache = new Map();
    }
    return daw.bufferCache;
  }

  function cacheBuffer(
    clip,
    buffer,
    daw,
    peaksFromBuffer,
    refreshClipWaveImage
  ) {
    const cache = ensureBufferCache(daw);
    if (!clip || !buffer || !cache) return false;

    cache.set(clip.bufferKey, buffer);
    clip.sourceDuration = buffer.duration;
    clip._peaks = peaksFromBuffer(buffer, 2000);
    refreshClipWaveImage(clip);
    return true;
  }

  function cacheDecodedFile(
    clip,
    file,
    daw,
    decodeFileToBuffer,
    peaksFromBuffer,
    refreshClipWaveImage
  ) {
    if (typeof decodeFileToBuffer !== 'function') return null;
    return decodeFileToBuffer(file).then(decoded => {
      const buffer = decoded?.buffer || decoded;
      return cacheBuffer(
        clip,
        buffer,
        daw,
        peaksFromBuffer,
        refreshClipWaveImage
      )
        ? buffer
        : null;
    });
  }

  function fileCandidates(audioPath) {
    const fileName = audioPath?.fileName;
    return [
      fileName,
      fileName?.replace(/\.[^.]+$/, '')
    ].filter(Boolean);
  }

  function findClip(daw, bufferKey) {
    return audioClips(daw).find(clip => clip.bufferKey === bufferKey);
  }

  function hasBuffer(daw, bufferKey) {
    return Boolean(daw?.bufferCache?.has?.(bufferKey));
  }

  function create({
    getDAW = () => null,
    getSong = () => null,
    loadAudioBlobsForProject = async () => {},
    getAudioBlobFromDB = async () => null,
    decodeFileToBuffer,
    loadAudioFromHardDrive,
    getFileHandle = async () => null,
    getDirHandle = async () => null,
    setDirHandle = async () => {},
    saveDirHandle = async () => {},
    showDirectoryPicker = globalScope.showDirectoryPicker,
    isElectron = false,
    electronAvailable = false,
    peaksFromBuffer = () => [],
    refreshClipWaveImage = () => {},
    toast = () => {},
    logger = console
  } = {}) {
    function resolveContext(overrides = {}) {
      return {
        daw: overrides.daw || getDAW?.() || null,
        loadAudioBlobsForProject:
          overrides.loadAudioBlobsForProject || loadAudioBlobsForProject,
        getAudioBlobFromDB:
          overrides.getAudioBlobFromDB || getAudioBlobFromDB,
        decodeFileToBuffer:
          overrides.decodeFileToBuffer || decodeFileToBuffer,
        loadAudioFromHardDrive:
          overrides.loadAudioFromHardDrive || loadAudioFromHardDrive,
        getFileHandle: overrides.getFileHandle || getFileHandle,
        getDirHandle: overrides.getDirHandle || getDirHandle,
        setDirHandle: overrides.setDirHandle || setDirHandle,
        saveDirHandle: overrides.saveDirHandle || saveDirHandle,
        showDirectoryPicker:
          overrides.showDirectoryPicker || showDirectoryPicker,
        isElectron:
          overrides.isElectron === undefined
            ? isElectron
            : overrides.isElectron,
        electronAvailable:
          overrides.electronAvailable === undefined
            ? electronAvailable
            : overrides.electronAvailable,
        peaksFromBuffer: overrides.peaksFromBuffer || peaksFromBuffer,
        refreshClipWaveImage:
          overrides.refreshClipWaveImage || refreshClipWaveImage,
        toast: overrides.toast || toast,
        logger: overrides.logger || logger
      };
    }

    function log(context, method, ...args) {
      context.logger?.[method]?.(...args);
    }

    function markCachedClips(daw, context) {
      let loaded = 0;
      for (const clip of audioClips(daw)) {
        const buffer = daw.bufferCache?.get?.(clip.bufferKey);
        if (!buffer) continue;
        cacheBuffer(
          clip,
          buffer,
          daw,
          context.peaksFromBuffer,
          context.refreshClipWaveImage
        );
        loaded += 1;
      }
      return loaded;
    }

    async function loadFromElectron(
      audioPaths,
      daw,
      context,
      result,
      label
    ) {
      if (
        !context.isElectron ||
        !context.electronAvailable ||
        typeof context.loadAudioFromHardDrive !== 'function'
      ) {
        return;
      }

      for (const audioPath of audioPaths) {
        if (!audioPath?.filePath) {
          log(context, 'warn', `[${label}] No filePath for:`, audioPath?.fileName);
          continue;
        }

        const clip = findClip(daw, audioPath.bufferKey);
        if (!clip || hasBuffer(daw, clip.bufferKey)) continue;

        try {
          const buffer = await context.loadAudioFromHardDrive(audioPath.filePath);
          if (
            cacheBuffer(
              clip,
              buffer,
              daw,
              context.peaksFromBuffer,
              context.refreshClipWaveImage
            )
          ) {
            clip._filePath = audioPath.filePath;
            result.loaded += 1;
            log(context, 'log', `[${label}] Loaded:`, audioPath.fileName);
          }
        } catch (error) {
          log(
            context,
            'warn',
            `[${label}] File not found at path:`,
            audioPath.filePath,
            error?.message
          );
        }
      }
    }

    async function loadFromStoredBlobs(daw, context, result, label) {
      for (const clip of missingAudioClips(daw)) {
        try {
          const record = await context.getAudioBlobFromDB?.(clip.bufferKey);
          if (!record?.blob) continue;
          const buffer = await cacheDecodedFile(
            clip,
            record.blob,
            daw,
            context.decodeFileToBuffer,
            context.peaksFromBuffer,
            context.refreshClipWaveImage
          );
          if (buffer) {
            result.loaded += 1;
            log(context, 'log', `[${label}] Auto-reloaded:`, record.fileName);
          }
        } catch (error) {
          log(
            context,
            'warn',
            `[${label}] Blob reload failed for`,
            clip.bufferKey,
            error?.message
          );
        }
      }
    }

    async function loadFromStoredHandles(daw, context, result, label) {
      for (const clip of missingAudioClips(daw)) {
        try {
          const handle = await context.getFileHandle?.(clip.bufferKey);
          if (!handle?.requestPermission) continue;
          const permission = await handle.requestPermission({ mode: 'read' });
          if (permission !== 'granted') continue;
          const buffer = await cacheDecodedFile(
            clip,
            await handle.getFile(),
            daw,
            context.decodeFileToBuffer,
            context.peaksFromBuffer,
            context.refreshClipWaveImage
          );
          if (buffer) {
            result.loaded += 1;
            log(context, 'log', `[${label}] Auto-reloaded:`, clip.fileName);
          }
        } catch (error) {
          log(
            context,
            'warn',
            `[${label}] FileHandle reload failed for`,
            clip.bufferKey,
            error?.message
          );
        }
      }
    }

    async function loadFromDirectory(
      audioPaths,
      directory,
      daw,
      context,
      result,
      label
    ) {
      if (!directory?.getFileHandle) return;

      for (const audioPath of audioPaths) {
        const clip = findClip(daw, audioPath?.bufferKey);
        if (!clip || hasBuffer(daw, clip.bufferKey)) continue;

        for (const name of fileCandidates(audioPath)) {
          try {
            const fileHandle = await directory.getFileHandle(name);
            const buffer = await cacheDecodedFile(
              clip,
              await fileHandle.getFile(),
              daw,
              context.decodeFileToBuffer,
              context.peaksFromBuffer,
              context.refreshClipWaveImage
            );
            if (buffer) {
              result.loaded += 1;
              break;
            }
          } catch (_) {
            // Try the next candidate name.
          }
        }
      }
    }

    async function restoreSongAudio(song, overrides = {}) {
      const context = resolveContext(overrides);
      const { daw } = context;
      const result = { loaded: 0, missing: 0, missingNames: [] };
      if (!song || !daw) return result;

      try {
        await context.loadAudioBlobsForProject?.(song.id);
        result.loaded += markCachedClips(daw, context);
      } catch (error) {
        log(context, 'warn', 'Audio init load error:', error);
      }

      const paths = Array.isArray(song._audioPaths) ? song._audioPaths : [];
      let missing = missingAudioClips(daw);
      log(
        context,
        'log',
        `[Audio Init] ${missing.length} clip(s) need audio loading. ` +
          `isElectron=${context.isElectron}, _audioPaths=${paths.length}`
      );
      if (!missing.length || !paths.length) return result;

      await loadFromElectron(paths, daw, context, result, 'LINK');
      await loadFromStoredBlobs(daw, context, result, 'BLOB');
      await loadFromStoredHandles(daw, context, result, 'HANDLE');

      missing = missingAudioClips(daw);
      if (!missing.length) return result;

      let directory = await context.getDirHandle?.();
      if (!directory) {
        try {
          directory = await context.getDirHandle?.({ load: true });
        } catch (_) {}
      }

      if (directory) {
        try {
          const permission = await directory.requestPermission({ mode: 'read' });
          if (permission === 'granted') {
            const before = result.loaded;
            await loadFromDirectory(
              paths,
              directory,
              daw,
              context,
              result,
              'DIR'
            );
            if (result.loaded === before && missing.length) {
              const notFound = missing.map(
                clip => clip.fileName || 'نام‌ناشناخته'
              );
              context.toast(
                'فایل‌های صوتی پیدا نشد: ' + notFound.join(', ')
              );
            }
          }
        } catch (_) {}
      }

      missing = missingAudioClips(daw);
      if (
        !missing.length ||
        context.isElectron ||
        typeof context.showDirectoryPicker !== 'function'
      ) {
        return result;
      }

      try {
        const selectedDirectory = await context.showDirectoryPicker({
          mode: 'read'
        });
        await context.setDirHandle?.(selectedDirectory);
        const permission = await selectedDirectory.requestPermission({
          mode: 'read'
        });
        if (permission === 'granted') {
          await loadFromDirectory(
            paths,
            selectedDirectory,
            daw,
            context,
            result,
            'PICKER'
          );
        }
      } catch (_) {
        // Cancelling the picker is a normal user action.
      }

      result.missing = missingAudioClips(daw).length;
      result.missingNames = missingAudioClips(daw).map(
        clip => clip.fileName || clip.bufferKey
      );
      return result;
    }

    async function restoreProjectAudio(projectId, silent = true, overrides = {}) {
      const context = resolveContext(overrides);
      const { daw } = context;
      const song = overrides.song || getSong?.();
      const result = { loaded: 0, missing: 0, missingNames: [] };
      if (!song || !daw) return result;

      try {
        await context.loadAudioBlobsForProject?.(projectId);
        result.loaded += markCachedClips(daw, context);
      } catch (error) {
        log(context, 'warn', '[Audio Restore] IndexedDB load failed:', error);
      }

      let missing = missingAudioClips(daw);
      if (!missing.length) return result;

      const paths = Array.isArray(song._audioPaths) ? song._audioPaths : [];
      await loadFromElectron(paths, daw, context, result, 'Audio Restore');
      await loadFromStoredBlobs(daw, context, result, 'Audio Restore');
      await loadFromStoredHandles(daw, context, result, 'Audio Restore');

      missing = missingAudioClips(daw);
      if (missing.length && paths.length) {
        let directory = await context.getDirHandle?.();
        if (!directory) {
          try {
            directory = await context.getDirHandle?.({ load: true });
          } catch (_) {}
        }
        if (directory) {
          try {
            const permission = await directory.requestPermission({ mode: 'read' });
            if (permission === 'granted') {
              await loadFromDirectory(
                paths,
                directory,
                daw,
                context,
                result,
                'Audio Restore'
              );
            }
          } catch (_) {}
        }
      }

      missing = missingAudioClips(daw);
      if (
        !silent &&
        missing.length &&
        !context.isElectron &&
        typeof context.showDirectoryPicker === 'function' &&
        paths.length
      ) {
        try {
          const directory = await context.showDirectoryPicker({ mode: 'read' });
          await context.saveDirHandle?.(directory);
          const permission = await directory.requestPermission({ mode: 'read' });
          if (permission === 'granted') {
            await loadFromDirectory(
              paths,
              directory,
              daw,
              context,
              result,
              'Audio Restore'
            );
          }
        } catch (_) {
          // The user cancelled the picker.
        }
      }

      const finalMissing = missingAudioClips(daw);
      result.missing = finalMissing.length;
      result.missingNames = finalMissing.map(
        clip => clip.fileName || clip.bufferKey
      );
      if (result.missing) {
        log(
          context,
          'warn',
          `[Audio Restore] ${result.missing} clip(s) still missing:`,
          result.missingNames
        );
      } else {
        log(
          context,
          'log',
          `[Audio Restore] All audio restored. Loaded: ${result.loaded}`
        );
      }
      return result;
    }

    async function preloadAudioForSong(songData, overrides = {}) {
      const context = resolveContext(overrides);
      const { daw } = context;
      const result = { loaded: 0, missing: 0, missingNames: [] };
      if (!songData || !daw) return result;

      const clips = songData._dawClips || [];
      const paths = songData._audioPaths || [];
      const clipsByBufferKey = new Map(
        clips
          .filter(clip => clip?.type !== 'chord' && clip.bufferKey)
          .map(clip => [clip.bufferKey, clip])
      );
      if (!clipsByBufferKey.size) return result;

      const cache = ensureBufferCache(daw);
      const missingEntries = () =>
        [...clipsByBufferKey.entries()].filter(([key]) => !cache.has(key));

      result.loaded = [...clipsByBufferKey.keys()].filter(key =>
        cache.has(key)
      ).length;
      if (!missingEntries().length) return result;

      try {
        await context.loadAudioBlobsForProject?.(songData.id);
      } catch (error) {
        log(context, 'warn', '[Preload] IndexedDB load failed:', error);
      }

      await loadFromElectron(
        paths,
        {
          ...daw,
          clips: [...clipsByBufferKey.values()]
        },
        context,
        result,
        'Preload'
      );

      for (const [bufferKey, clip] of missingEntries()) {
        try {
          const record = await context.getAudioBlobFromDB?.(bufferKey);
          if (!record?.blob) continue;
          const decoded = await context.decodeFileToBuffer(record.blob);
          const buffer = decoded?.buffer || decoded;
          if (!buffer) continue;
          cache.set(bufferKey, buffer);
          result.loaded += 1;
          log(context, 'log', '[Preload] Auto-reloaded from Blob:', record.fileName);
        } catch (error) {
          log(
            context,
            'warn',
            '[Preload] Blob reload failed for',
            bufferKey,
            error?.message
          );
        }
      }

      for (const [bufferKey, clip] of missingEntries()) {
        try {
          const handle = await context.getFileHandle?.(bufferKey);
          if (!handle?.requestPermission) continue;
          const permission = await handle.requestPermission({ mode: 'read' });
          if (permission !== 'granted') continue;
          const decoded = await context.decodeFileToBuffer(await handle.getFile());
          const buffer = decoded?.buffer || decoded;
          if (!buffer) continue;
          cache.set(bufferKey, buffer);
          result.loaded += 1;
          log(context, 'log', '[Preload] Auto-reloaded from FileHandle:', clip.fileName);
        } catch (error) {
          log(
            context,
            'warn',
            '[Preload] FileHandle reload failed for',
            bufferKey,
            error?.message
          );
        }
      }

      let directory = null;
      if (missingEntries().length && paths.length) {
        directory = await context.getDirHandle?.();
        if (!directory) {
          try {
            directory = await context.getDirHandle?.({ load: true });
          } catch (_) {}
        }
      }
      if (directory) {
        await loadFromDirectory(
          paths,
          directory,
          {
            ...daw,
            clips: [...clipsByBufferKey.values()]
          },
          context,
          result,
          'Preload'
        );
      }

      const finalMissing = missingEntries();
      result.missing = finalMissing.length;
      result.missingNames = finalMissing.map(
        ([key, clip]) => clip.fileName || key
      );
      return result;
    }

    return Object.freeze({
      audioClips,
      missingAudioClips,
      cacheBuffer,
      restoreSongAudio,
      restoreAudio: restoreSongAudio,
      restoreProjectAudio,
      preloadAudioForSong
    });
  }

  const service = Object.freeze({ create, audioClips, missingAudioClips });
  globalScope.AudioRecoveryService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
