/**
 * EditorAudioStorageService
 *
 * Owns IndexedDB audio persistence and legacy audio conversion helpers.
 * Editor state, DOM and project-export behavior are supplied through callbacks.
 */
(function attachEditorAudioStorageService(globalScope) {
  'use strict';

  function create({
    indexedDBRef = globalScope.indexedDB,
    BlobCtor = globalScope.Blob,
    fetchRef = globalScope.fetch,
    urlRef = globalScope.URL,
    getDAW = () => null,
    ensureAudioCtx = () => {},
    getWavEncoder = () => null,
    getElement = id => globalScope.document?.getElementById?.(id),
    getStorageEstimate = () =>
      globalScope.navigator?.storage?.estimate?.(),
    compressionServiceFactory = globalScope.AudioCompressionService?.create,
    toast = () => {},
    logger = globalScope.console
  } = {}) {
    let audioDB = null;
    let audioCompressionService = null;

    function hasStorageKey(value) {
      if (value === undefined || value === null) return false;
      return typeof value !== 'string' || value.trim().length > 0;
    }

    function getAudioCompressionService() {
      if (!audioCompressionService && typeof compressionServiceFactory === 'function') {
        audioCompressionService = compressionServiceFactory();
      }
      return audioCompressionService;
    }

    function openAudioDB() {
      if (audioDB) return Promise.resolve(audioDB);
      if (!indexedDBRef?.open) {
        return Promise.reject(new Error('IndexedDB is unavailable'));
      }
      return new Promise((resolve, reject) => {
        const request = indexedDBRef.open('AchordAudioDB', 2);
        request.onupgradeneeded = event => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('audioBlobs')) {
            db.createObjectStore('audioBlobs');
          }
          if (!db.objectStoreNames.contains('fileHandles')) {
            db.createObjectStore('fileHandles');
          }
        };
        request.onsuccess = event => {
          audioDB = event.target.result;
          resolve(audioDB);
        };
        request.onerror = () => reject(request.error);
      });
    }

    async function saveFileHandle(bufferKey, handle) {
      if (!hasStorageKey(bufferKey)) return undefined;
      try {
        const db = await openAudioDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction('fileHandles', 'readwrite');
          transaction.objectStore('fileHandles').put(handle, bufferKey);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      } catch (error) {
        logger?.warn?.('[HANDLE] Save error:', error);
        return undefined;
      }
    }

    async function getFileHandle(bufferKey) {
      if (!hasStorageKey(bufferKey)) return null;
      try {
        const db = await openAudioDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction('fileHandles', 'readonly');
          const request = transaction.objectStore('fileHandles').get(bufferKey);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      } catch (_) {
        return null;
      }
    }

    async function saveAudioBlobToDB(bufferKey, file, fileName) {
      if (!hasStorageKey(bufferKey)) return undefined;
      try {
        const db = await openAudioDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction('fileHandles', 'readwrite');
          const record = {
            type: 'blob',
            blob: file,
            fileName,
            size: file.size,
            lastModified: file.lastModified || Date.now()
          };
          transaction.objectStore('fileHandles').put(record, bufferKey);
          transaction.oncomplete = () => {
            logger?.log?.(
              `[BLOB] Saved to IndexedDB: ${fileName} ` +
              `(${(file.size / 1024 / 1024).toFixed(2)} MB)`
            );
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        });
      } catch (error) {
        logger?.warn?.('[BLOB] Save error:', error);
        return undefined;
      }
    }

    async function getAudioBlobFromDB(bufferKey) {
      if (!hasStorageKey(bufferKey)) return null;
      try {
        const db = await openAudioDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction('fileHandles', 'readonly');
          const request = transaction.objectStore('fileHandles').get(bufferKey);
          request.onsuccess = () => {
            const result = request.result;
            resolve(
              result?.type === 'blob' && result.blob
                ? { blob: result.blob, fileName: result.fileName }
                : null
            );
          };
          request.onerror = () => reject(request.error);
        });
      } catch (_) {
        return null;
      }
    }

    async function saveAudioBlobsForProject(projectId) {
      if (!hasStorageKey(projectId)) return undefined;
      const daw = getDAW();
      const embeddedClips = (daw?.clips || []).filter(clip =>
        clip.type !== 'chord' && clip.bufferKey && clip._embedded
      );
      const allBlobs = [];

      // Encode/compress before opening the transaction. IndexedDB transactions
      // may auto-commit while an async compression operation is in flight.
      for (const clip of embeddedClips) {
        const key = clip.bufferKey;
        const buffer = daw?.bufferCache?.get?.(key);
        if (!buffer) continue;

        if (clip._originalBlob) {
          const blob = clip._originalBlob;
          allBlobs.push({
            key,
            format: 'blob',
            mimeType: blob.type || 'audio/mpeg',
            fileName: clip.fileName || clip.name || `${key}.mp3`,
            size: blob.size,
            duration: buffer.duration,
            sampleRate: buffer.sampleRate,
            channels: buffer.numberOfChannels,
            blob
          });
          logger?.log?.(
            `[Audio Save] Saved original blob: ${clip.fileName} ` +
            `(${(blob.size / 1024 / 1024).toFixed(2)} MB)`
          );
          continue;
        }

        try {
          const wavEncoder = getWavEncoder();
          if (typeof wavEncoder !== 'function') {
            throw new Error('Audio WAV encoder is unavailable');
          }
          const wavBytes = wavEncoder(buffer);
          const compressed =
            await getAudioCompressionService()?.compressBytes(wavBytes);
          if (!compressed?.blob || !compressed.format) {
            throw new Error('Audio compression service is unavailable');
          }
          const compressedFormat = compressed.format;
          allBlobs.push({
            key,
            format: compressedFormat,
            mimeType: compressedFormat === 'wav-deflate'
              ? 'application/octet-stream'
              : 'audio/wav',
            fileName:
              (clip.fileName || clip.name || key).replace(/\.[^.]+$/, '') +
              (compressedFormat === 'wav-deflate' ? '.wav.deflate' : '.wav'),
            size: compressed.blob.size,
            duration: buffer.duration,
            sampleRate: buffer.sampleRate,
            channels: buffer.numberOfChannels,
            blob: compressed.blob
          });
          logger?.log?.(
            `[Audio Save] Saved ${compressedFormat}: ${clip.fileName} ` +
            `(raw=${(wavBytes.length / 1024 / 1024).toFixed(2)}MB ` +
            `→ stored=${(compressed.blob.size / 1024 / 1024).toFixed(2)}MB)`
          );
        } catch (error) {
          logger?.warn?.(
            `[Audio Save] Failed to encode ${clip.fileName}:`,
            error
          );
        }
      }

      let db;
      try {
        db = await openAudioDB();
      } catch (error) {
        // A project without embedded audio has nothing to persist. IndexedDB
        // can be unavailable in Electron before its quota database is ready.
        if (embeddedClips.length === 0) return undefined;
        throw error;
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction('audioBlobs', 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);

        const store = transaction.objectStore('audioBlobs');
        store.delete(projectId);
        if (allBlobs.length > 0) store.put(allBlobs, projectId);
      });
    }

    async function loadAudioBlobsForProject(projectId) {
      if (!hasStorageKey(projectId)) return undefined;
      const daw = getDAW();
      const db = await openAudioDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('audioBlobs', 'readonly');
        const request = transaction.objectStore('audioBlobs').get(projectId);
        request.onsuccess = async () => {
          const entries = request.result;
          if (!entries) {
            resolve();
            return;
          }
          ensureAudioCtx();
          for (const entry of entries) {
            try {
              let buffer = null;
              if (
                (entry.format === 'blob' || entry.format === 'wav') &&
                entry.blob
              ) {
                const arrayBuffer = await entry.blob.arrayBuffer();
                buffer = await daw.audioCtx.decodeAudioData(arrayBuffer);
                logger?.log?.(
                  `[Audio Load] Loaded ${entry.format}: ${entry.fileName}`
                );
              } else if (entry.format === 'wav-deflate' && entry.blob) {
                const compressedBytes = new Uint8Array(
                  await entry.blob.arrayBuffer()
                );
                const wavBytes =
                  await getAudioCompressionService()?.decompressBytes(
                    compressedBytes
                  );
                const wavBlob = new BlobCtor([wavBytes], { type: 'audio/wav' });
                buffer = await daw.audioCtx.decodeAudioData(
                  await wavBlob.arrayBuffer()
                );
                logger?.log?.(
                  `[Audio Load] Loaded WAV+deflate: ${entry.fileName}`
                );
              } else if (entry.data) {
                const channelData = Array.isArray(entry.data)
                  ? entry.data
                  : [entry.data];
                buffer = daw.audioCtx.createBuffer(
                  channelData.length,
                  entry.length,
                  entry.sampleRate
                );
                channelData.forEach((channel, index) => {
                  if (index < buffer.numberOfChannels) {
                    buffer.getChannelData(index).set(channel);
                  }
                });
                logger?.log?.(
                  `[Audio Load] Loaded legacy Float32: ${entry.key}`
                );
              }
              if (buffer) daw.bufferCache.set(entry.key, buffer);
            } catch (error) {
              logger?.warn?.(
                `[Audio Load] Failed to load ${entry.key}:`,
                error
              );
            }
          }
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }

    async function deleteAudioBlobsForProject(projectId) {
      if (!hasStorageKey(projectId)) return undefined;
      try {
        const db = await openAudioDB();
        return new Promise(resolve => {
          const transaction = db.transaction('audioBlobs', 'readwrite');
          transaction.objectStore('audioBlobs').delete(projectId);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
        });
      } catch (_) {
        return undefined;
      }
    }

    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const index = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(1))} ${sizes[index]}`;
    }

    function base64ToUint8(base64) {
      const binary = globalScope.atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 65536) {
        const end = Math.min(index + 65536, binary.length);
        for (let cursor = index; cursor < end; cursor += 1) {
          bytes[cursor] = binary.charCodeAt(cursor);
        }
      }
      return bytes;
    }

    async function decodeWebMToBuffer(webmUint8) {
      const blob = new BlobCtor([webmUint8], { type: 'audio/webm' });
      const url = urlRef.createObjectURL(blob);
      try {
        ensureAudioCtx();
        const response = await fetchRef(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await getDAW().audioCtx.decodeAudioData(arrayBuffer);
        urlRef.revokeObjectURL(url);
        return audioBuffer;
      } catch (error) {
        urlRef.revokeObjectURL(url);
        throw error;
      }
    }

    function resampleFloat32(source, sourceRate, destinationRate) {
      if (sourceRate === destinationRate) return source;
      const ratio = sourceRate / destinationRate;
      const length = Math.round(source.length / ratio);
      const output = new Float32Array(length);
      for (let index = 0; index < length; index += 1) {
        const position = index * ratio;
        const first = Math.floor(position);
        const second = Math.min(first + 1, source.length - 1);
        const fraction = position - first;
        output[index] =
          source[first] * (1 - fraction) + source[second] * fraction;
      }
      return output;
    }

    async function refreshStorageInfo() {
      try {
        const infoBar = getElement('storageInfoBar');
        if (!infoBar) return;
        infoBar.style.display = 'block';

        let usageBytes = 0;
        let quotaBytes = 0;
        if (typeof getStorageEstimate === 'function') {
          try {
            const estimate = await getStorageEstimate();
            usageBytes = estimate?.usage || 0;
            quotaBytes = estimate?.quota || 0;
          } catch (_) {
            // Storage estimation is optional and may reject in Electron when
            // Chromium's quota database is unavailable.
          }
        }

        let audioCount = 0;
        let audioBytes = 0;
        try {
          const db = await openAudioDB();
          const transaction = db.transaction('audioBlobs', 'readonly');
          const store = transaction.objectStore('audioBlobs');
          const allData = await new Promise(resolve => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve([]);
          });
          audioCount = allData.length;
          for (const data of allData) {
            if (!data) continue;
            for (const entry of Array.isArray(data) ? data : []) {
              for (const channel of entry.data || []) {
                if (channel) audioBytes += channel.byteLength || 0;
              }
            }
          }
        } catch (_) {}

        const percent =
          quotaBytes > 0
            ? Math.min(100, (usageBytes / quotaBytes) * 100)
            : 0;
        const bar = getElement('storageBarInner');
        const text = getElement('storageText');
        if (bar) {
          bar.style.width = `${percent.toFixed(1)}%`;
          bar.style.background =
            percent > 80
              ? 'linear-gradient(90deg,#e6aa28,#ff4444)'
              : percent > 50
                ? 'linear-gradient(90deg,#22d364,#e6aa28)'
                : 'linear-gradient(90deg,#22d364,#00F2FE)';
        }
        if (text) {
          text.innerHTML =
            `مجموع: ${formatBytes(usageBytes)} / ${formatBytes(quotaBytes)} ` +
            `(${percent.toFixed(1)}%)` +
            (audioCount > 0
              ? `<br>صدا: ${audioCount} فایل · ${formatBytes(audioBytes)}`
              : '<br>فایل صوتی ذخیره نشده');
        }
        if (percent > 85) {
          toast('⚠️ حافظه مرورگر پر است! خروجی کامل بگیرید');
        }
      } catch (error) {
        logger?.warn?.('Storage info error:', error);
      }
    }

    return Object.freeze({
      getAudioCompressionService,
      openAudioDB,
      saveFileHandle,
      getFileHandle,
      saveAudioBlobToDB,
      getAudioBlobFromDB,
      saveAudioBlobsForProject,
      loadAudioBlobsForProject,
      deleteAudioBlobsForProject,
      formatBytes,
      base64ToUint8,
      decodeWebMToBuffer,
      resampleFloat32,
      refreshStorageInfo
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorAudioStorageService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
