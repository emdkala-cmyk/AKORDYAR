/**
 * EditorProjectImportRouteService
 *
 * Opens a project through the Electron dialog when available and adapts the
 * native payload to the browser File-like contract used by ArchiveModule.
 */
(function attachEditorProjectImportRouteService(globalScope) {
  function create({
    getElectronAPI = () => globalScope.electronAPI
  } = {}) {
    async function openNative({ onFile } = {}) {
      const api = typeof getElectronAPI === 'function'
        ? getElectronAPI()
        : null;
      const supported = Boolean(
        api?.isElectron &&
        typeof api.openFileDialog === 'function' &&
        typeof api.loadProjectFile === 'function'
      );

      if (!supported) {
        return Object.freeze({
          handled: false,
          status: 'unsupported'
        });
      }

      if (typeof onFile !== 'function') {
        throw new TypeError('Native project import requires an onFile callback');
      }

      try {
        const filePath = await api.openFileDialog();
        if (!filePath) {
          return Object.freeze({
            handled: true,
            status: 'cancelled'
          });
        }

        const data = await api.loadProjectFile(filePath);
        const fileName = String(filePath).split(/[\\/]/).pop() || 'project.json';
        await onFile({
          name: fileName,
          _projectFilePath: filePath,
          text: async () => JSON.stringify(data)
        });

        return Object.freeze({
          handled: true,
          status: 'opened',
          path: filePath
        });
      } catch (error) {
        return Object.freeze({
          handled: true,
          status: 'error',
          error
        });
      }
    }

    return Object.freeze({ openNative });
  }

  const service = Object.freeze({ create });
  globalScope.EditorProjectImportRouteService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
