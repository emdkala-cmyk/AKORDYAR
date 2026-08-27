/**
 * EditorAudioStorageRuntimeService
 *
 * Provides a lazy, dependency-injected runtime for
 * EditorAudioStorageService. The runtime is registered as one service object;
 * individual storage methods are never copied onto the global scope.
 * The module name and registration both describe the runtime role.
 */
(function attachEditorAudioStorageRuntimeService(globalScope) {
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
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    ensureAudioCtx = (...args) =>
      globalScope.AkordyarCoreApi?.ensureAudioCtx?.(...args),
    getWavEncoder = () =>
      globalScope.EditorProjectExportService?.audioBufferToWav,
    getElement = id => globalScope.document?.getElementById?.(id),
    getStorageEstimate = () => globalScope.navigator?.storage?.estimate?.(),
    compressionServiceFactory = () =>
      globalScope.AudioCompressionService?.create?.(),
    toast = (...args) => globalScope.AkordyarCoreApi?.toast?.(...args),
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

    const runtime = {
      getService: getStorageService
    };
    METHODS.forEach(method => {
      runtime[method] = (...args) =>
        getStorageService()?.[method]?.(...args);
    });

    return Object.freeze(runtime);
  }

  const service = Object.freeze({ create });
  globalScope.EditorAudioStorageRuntimeService = service;

  if (typeof window !== 'undefined') {
    globalScope.EditorAudioStorageRuntime = create();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
