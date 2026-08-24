/**
 * EditorProjectExportService
 *
 * ساخت snapshot قابل‌ذخیره از song/DAW و embedding فایل‌های صوتی کپی‌شده.
 * این سرویس هیچ دسترسی مستقیمی به DOM، edCur، DAW global یا PERF ندارد.
 */
(function attachEditorProjectExportService(globalScope) {
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

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
    return { tracks, clips, sections, loop, arrangerMarkers };
  }

  function uint8ToBase64(uint8Arr, btoaRef = globalScope.btoa) {
    const bytes = uint8Arr instanceof Uint8Array
      ? uint8Arr
      : new Uint8Array(uint8Arr || []);
    const chunkSize = 65536;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    if (typeof btoaRef === 'function') return btoaRef(binary);
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    throw new Error('Base64 encoder is unavailable');
  }

  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = length * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);
    const writeString = (offset, value) => {
      for (let i = 0; i < value.length; i++) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const channels = Array.from({ length: numChannels }, (_, index) =>
      buffer.getChannelData(index)
    );
    let offset = 44;
    for (let sampleIndex = 0; sampleIndex < length; sampleIndex++) {
      for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
        const sample = Math.max(-1, Math.min(1, channels[channelIndex][sampleIndex]));
        view.setInt16(
          offset,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true
        );
        offset += 2;
      }
    }

    return new Uint8Array(arrayBuffer);
  }

  async function encodeAudioToWav(buffer, {
    offlineAudioContext = globalScope.OfflineAudioContext
  } = {}) {
    if (typeof offlineAudioContext !== 'function') {
      return audioBufferToWav(buffer);
    }

    const offlineContext = new offlineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start(0);
    const rendered = await offlineContext.startRendering();
    return audioBufferToWav(rendered);
  }

  function encodeFloat32Fallback(buffer, toBase64) {
    const channels = [];
    for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex++) {
      const channel = buffer.getChannelData(channelIndex);
      channels.push(toBase64(new Uint8Array(
        channel.buffer,
        channel.byteOffset,
        channel.byteLength
      )));
    }
    return {
      format: 'float32-b64',
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      length: buffer.length,
      data: channels
    };
  }

  function create({
    syncMetadata = () => {},
    encodeAudio = encodeAudioToWav,
    btoaRef = globalScope.btoa,
    logger = console
  } = {}) {
    async function buildBundle({
      song,
      daw,
      onAudioProgress = () => {}
    } = {}) {
      if (!song || !daw) return null;

      const exportSong = clone(song);
      syncMetadata(exportSong, { includeKey: false });

      const timeline = snapshotTimeline(daw);
      exportSong._dawTracks = timeline.tracks;
      exportSong._dawClips = timeline.clips;
      exportSong._dawSections = timeline.sections;
      exportSong._dawLoop = timeline.loop;
      exportSong._arrangerMarkers = timeline.arrangerMarkers;

      const audioData = {};
      const audioClips = timeline.clips.filter(clip =>
        clip.type !== 'chord' && clip.bufferKey && clip._embedded
      );

      let index = 0;
      for (const clip of audioClips) {
        const buffer = daw.bufferCache?.get?.(clip.bufferKey);
        if (!buffer) continue;

        index += 1;
        onAudioProgress({ index, total: audioClips.length, clip });
        try {
          const encoded = await encodeAudio(buffer, {
            bitrate: 128000,
            clip
          });
          audioData[clip.bufferKey] = {
            format: 'wav',
            data: uint8ToBase64(encoded, btoaRef)
          };
        } catch (error) {
          logger?.warn?.(
            'Audio export encoding failed; using Float32 fallback:',
            error
          );
          try {
            audioData[clip.bufferKey] = encodeFloat32Fallback(
              buffer,
              bytes => uint8ToBase64(bytes, btoaRef)
            );
          } catch (fallbackError) {
            logger?.warn?.(
              'Audio export fallback failed:',
              fallbackError
            );
          }
        }
      }

      exportSong._embeddedAudio = audioData;
      const linkedCount = timeline.clips.filter(clip =>
        clip.type !== 'chord' && clip.bufferKey && !clip._embedded
      ).length;
      const defaultName = `${exportSong.title || 'ترانه جدید'} (کامل).json`;
      const data = JSON.stringify(exportSong);

      return {
        song: exportSong,
        data,
        defaultName,
        audioData,
        audioCount: Object.keys(audioData).length,
        linkedCount
      };
    }

    return Object.freeze({
      buildBundle,
      snapshotTimeline,
      audioBufferToWav,
      encodeAudioToWav
    });
  }

  const service = Object.freeze({ create, snapshotTimeline, audioBufferToWav });
  globalScope.EditorProjectExportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
