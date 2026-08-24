/**
 * EditorProjectFileService
 *
 * Owns the current native project-file path and the Electron JSON write route.
 * Browser download and File System Access fallbacks stay outside this service.
 */
(function attachEditorProjectFileService(globalScope) {
  function normalizePath(value) {
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : null;
  }

  function create({
    initialPath = null,
    getElectronAPI = () => globalScope.electronAPI
  } = {}) {
    let currentPath = normalizePath(initialPath);

    function getPath() {
      return currentPath;
    }

    function setPath(filePath) {
      currentPath = normalizePath(filePath);
      return currentPath;
    }

    function clearPath() {
      currentPath = null;
      return currentPath;
    }

    function resolveElectronAPI(apiOverride) {
      if (apiOverride) return apiOverride;
      return typeof getElectronAPI === 'function'
        ? getElectronAPI()
        : null;
    }

    function canUseNativeSave(apiOverride) {
      const api = resolveElectronAPI(apiOverride);
      return Boolean(
        api?.isElectron &&
        typeof api.saveFileDialog === 'function' &&
        typeof api.writeProjectJson === 'function'
      );
    }

    async function saveNative({
      data,
      defaultPath,
      targetPath = null,
      api: apiOverride
    } = {}) {
      const api = resolveElectronAPI(apiOverride);
      if (!canUseNativeSave(api)) {
        return Object.freeze({
          handled: false,
          cancelled: false,
          path: currentPath
        });
      }

      if (data == null) {
        throw new TypeError('Project data is required for native save');
      }

      let savePath = normalizePath(targetPath) || currentPath;
      if (!savePath) {
        savePath = normalizePath(await api.saveFileDialog({ defaultPath }));
      }

      if (!savePath) {
        return Object.freeze({
          handled: true,
          cancelled: true,
          path: null
        });
      }

      const result = await api.writeProjectJson(savePath, data);
      setPath(savePath);
      return Object.freeze({
        handled: true,
        cancelled: false,
        path: savePath,
        result
      });
    }

    return Object.freeze({
      getPath,
      setPath,
      clearPath,
      canUseNativeSave,
      saveNative
    });
  }

  const service = Object.freeze({ create, normalizePath });
  globalScope.EditorProjectFileService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
