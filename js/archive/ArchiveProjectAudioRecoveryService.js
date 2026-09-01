/**
 * ArchiveProjectAudioRecoveryService
 *
 * Restores project audio from embedded backups, Electron paths, saved
 * FileHandles and the selected audio directory.
 */
(function attachArchiveProjectAudioRecoveryService(globalScope) {
  function create(context = {}) {
    const {
      ensureAudioCtx = () => {},
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
      getGlobal = () => globalScope,
      toast = () => {},
      t = globalScope.t || (k => k)
    } = context;

    async function restoreEmbeddedAudio(song, daw, audioClips) {
      const embeddedAudio = song._embeddedAudio;
      if (!embeddedAudio || Object.keys(embeddedAudio).length === 0) return;

      ensureAudioCtx();
      let restored = 0;
      for (const clip of audioClips.filter(
        item => item.bufferKey && !daw.bufferCache.has(item.bufferKey)
      )) {
        const embedded = embeddedAudio[clip.bufferKey];
        if (!embedded) continue;
        try {
          let buffer;
          if (embedded.format === 'wav' || embedded.format === 'webm-opus') {
            buffer = await decodeWebMToBuffer(base64ToUint8(embedded.data));
          } else if (embedded.format === 'float32-b64') {
            const channels = embedded.channels || 1;
            buffer = daw.audioCtx.createBuffer(
              channels,
              embedded.length,
              embedded.sampleRate
            );
            for (let index = 0; index < channels; index++) {
              const bytes = base64ToUint8(embedded.data[index]);
              buffer.getChannelData(index).set(new Float32Array(bytes.buffer));
            }
          } else if (embedded.format === 'opus-b64') {
            const compressed = base64ToUint8(embedded.data);
            const decompressed = await decompressBytes(compressed);
            const int16 = new Int16Array(decompressed.buffer);
            const float32 = new Float32Array(int16.length);
            for (let index = 0; index < int16.length; index++) {
              float32[index] = int16[index] < 0
                ? int16[index] / 0x8000
                : int16[index] / 0x7FFF;
            }
            const upsampled = resampleFloat32(
              float32,
              embedded.sampleRate,
              embedded.originalSampleRate || embedded.sampleRate
            );
            const channels = embedded.originalChannels || 1;
            buffer = daw.audioCtx.createBuffer(
              channels,
              upsampled.length,
              embedded.originalSampleRate || embedded.sampleRate
            );
            for (let channel = 0; channel < channels; channel++) {
              buffer.getChannelData(channel).set(upsampled);
            }
          } else if (embedded.format === 'int16b64') {
            const channels = Array.isArray(embedded.data)
              ? embedded.data
              : [embedded.data];
            buffer = daw.audioCtx.createBuffer(
              channels.length,
              embedded.length,
              embedded.sampleRate
            );
            channels.forEach((channelData, index) => {
              if (index >= buffer.numberOfChannels) return;
              const bytes = base64ToUint8(channelData);
              const int16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(int16.length);
              for (let sample = 0; sample < int16.length; sample++) {
                float32[sample] = int16[sample] < 0
                  ? int16[sample] / 0x8000
                  : int16[sample] / 0x7FFF;
              }
              buffer.getChannelData(index).set(float32);
            });
          } else {
            const channels = Array.isArray(embedded.data)
              ? embedded.data
              : [embedded.data];
            buffer = daw.audioCtx.createBuffer(
              channels.length,
              embedded.length,
              embedded.sampleRate
            );
            channels.forEach((channelData, index) => {
              if (index < buffer.numberOfChannels && channelData) {
                buffer.getChannelData(index).set(new Float32Array(channelData));
              }
            });
          }

          daw.bufferCache.set(clip.bufferKey, buffer);
          clip.sourceDuration = buffer.duration;
          clip._peaks = peaksFromBuffer(buffer, 2000);
          refreshClipWaveImage(clip);
          restored++;
        } catch (_) {}
      }

      if (restored > 0) toast(`بازیابی صدا: ${restored} فایل از بکآپ`);
      saveAudioBlobsForProject(song.id).catch(() => {});
    }

    async function restoreLinkedAudio(song, daw, audioClips) {
      if (!song._audioPaths?.length) return;
      const missing = () => audioClips.filter(
        clip => clip.bufferKey && !daw.bufferCache.has(clip.bufferKey)
      );
      const runtime = getGlobal();

      if (getIsElectron() && runtime.electronAPI) {
        for (const audioPath of song._audioPaths) {
          if (!audioPath.filePath) continue;
          const clip = daw.clips.find(
            item => item.type !== 'chord' && item.bufferKey === audioPath.bufferKey
          );
          if (!clip || daw.bufferCache.has(clip.bufferKey)) continue;
          try {
            console.log('[LINK] Import: Loading from path:', audioPath.filePath);
            const buffer = await loadAudioFromHardDrive(audioPath.filePath);
            daw.bufferCache.set(clip.bufferKey, buffer);
            clip.sourceDuration = buffer.duration;
            clip._peaks = peaksFromBuffer(buffer, 2000);
            clip._filePath = audioPath.filePath;
            refreshClipWaveImage(clip);
          } catch (error) {
            console.warn('[LINK] Import: File not found:', audioPath.filePath, error.message);
          }
        }
      }

      for (const clip of missing()) {
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
          console.log('[HANDLE] Auto-reloaded (import):', clip.fileName);
        } catch (_) {
          console.warn('[HANDLE] Auto-reload failed:', clip.bufferKey);
        }
      }

      if (missing().length === 0) return;
      let directoryHandle = getAudioDirHandle();
      if (!directoryHandle) {
        try {
          await loadDirHandle();
          directoryHandle = getAudioDirHandle();
        } catch (_) {}
      }
      if (!directoryHandle) {
        try {
          directoryHandle = await runtime.showDirectoryPicker({ mode: 'read' });
          await saveDirHandle(directoryHandle);
        } catch (_) {}
      }
      if (!directoryHandle) return;

      const permission = await directoryHandle.requestPermission({ mode: 'read' });
      if (permission !== 'granted') return;
      const notFound = [];
      for (const audioPath of song._audioPaths) {
        const clip = daw.clips.find(
          item => item.type !== 'chord' && item.bufferKey === audioPath.bufferKey
        );
        if (!clip || daw.bufferCache.has(clip.bufferKey)) continue;
        const candidates = [
          audioPath.fileName,
          audioPath.fileName
            ? audioPath.fileName.replace(/\.[^.]+$/, '')
            : ''
        ];
        let loaded = false;
        for (const name of candidates) {
          if (!name) continue;
          try {
            const fileHandle = await directoryHandle.getFileHandle(name);
            const file = await fileHandle.getFile();
            const { buffer } = await decodeFileToBuffer(file);
            daw.bufferCache.set(clip.bufferKey, buffer);
            clip.sourceDuration = buffer.duration;
            clip._peaks = peaksFromBuffer(buffer, 2000);
            refreshClipWaveImage(clip);
            loaded = true;
            break;
          } catch (_) {}
        }
        if (!loaded) {
          notFound.push(audioPath.fileName || audioPath.name || 'نام‌ناشناخته');
        }
      }
      if (notFound.length > 0) {
        toast('فایل‌های صوتی پیدا نشد: ' + notFound.join(', '));
      }
    }

    return Object.freeze({ restoreEmbeddedAudio, restoreLinkedAudio });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveProjectAudioRecoveryService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
