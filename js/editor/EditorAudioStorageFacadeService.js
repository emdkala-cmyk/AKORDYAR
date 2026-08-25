/**
 * EditorAudioStorageFacadeService
 *
 * Publishes the legacy audio-storage function names while keeping the actual
 * IndexedDB implementation lazy and isolated from editor.js.
 */
(function attachEditorAudioStorageFacadeService(globalScope) {
  'use strict';

  const METHODS = [
    'getAudioCompressionService',
    'openAudioDB',
    'saveFileHandle',
    'getFileHandle',
    'saveAudioBlobToDB',
    'getAudioBlobFromDB',
    'saveAudioBlobsForProject',
    'loadAudioBlobsForProject',
    'deleteAudioBlobsForProject',
    'formatBytes',
    'base64ToUint8',
    'decodeWebMToBuffer',
    'resampleFloat32',
    'refreshStorageInfo'
  ];

  function create({
    storageService = null,
    indexedDBRef = globalScope.indexedDB,
    BlobCtor = globalScope.Blob,
    fetchRef = (...args) => globalScope.fetch?.(...args),
    urlRef = globalScope.URL,
    getDAW = () => globalScope.getEditorDAW?.(),
    ensureAudioCtx = (...args) => globalScope.ensureAudioCtx?.(...args),
    getWavEncoder = () =>
      globalScope.getEditorProjectExportService?.()?.audioBufferToWav,
    getElement = id => globalScope.document?.getElementById?.(id),
    getStorageEstimate = () => globalScope.navigator?.storage?.estimate?.(),
    compressionServiceFactory = () =>
      globalScope.AudioCompressionService?.create?.(),
    toast = (...args) => globalScope.toast?.(...args),
    logger = console
  } = {}) {
    let instance = null;

    function getStorageService() {
      if (
        !instance &&
        typeof (storageService || globalScope.EditorAudioStorageService)
          ?.create === 'function'
      ) {
        instance = (
          storageService || globalScope.EditorAudioStorageService
        ).create({
          indexedDBRef,
          BlobCtor,
          fetchRef,
          urlRef,
          getDAW,
          ensureAudioCtx,
          getWavEncoder,
          getElement,
          getStorageEstimate,
          compressionServiceFactory,
          toast,
          logger
        });
      }
      return instance;
    }

    const facade = {
      getEditorAudioStorageService: getStorageService
    };
    METHODS.forEach(method => {
      facade[method] = (...args) =>
        getStorageService()?.[method]?.(...args);
    });

    return Object.freeze(facade);
  }

  const service = Object.freeze({ create });
  globalScope.EditorAudioStorageFacadeService = service;

  if (typeof window !== 'undefined') {
    Object.assign(globalScope, create());
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
