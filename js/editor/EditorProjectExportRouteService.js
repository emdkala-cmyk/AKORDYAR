/**
 * EditorProjectExportRouteService
 *
 * Writes an already-built project blob through browser file-picker or
 * download fallback. Bundle construction stays in EditorProjectExportService.
 */
(function attachEditorProjectExportRouteService(globalScope) {
  function create({
    getShowSaveFilePicker = () => globalScope.showSaveFilePicker,
    getConfirm = () => globalScope.confirm,
    documentRef = globalScope.document,
    urlRef = globalScope.URL,
    schedule = globalScope.setTimeout,
    logger = console
  } = {}) {
    async function saveBrowser({
      blob,
      defaultName,
      pickerOptions,
      confirmMessage
    } = {}) {
      if (!blob) {
        throw new TypeError('Project export blob is required');
      }

      const showSaveFilePicker = getShowSaveFilePicker?.();
      if (typeof showSaveFilePicker === 'function') {
        try {
          const handle = await showSaveFilePicker(
            pickerOptions || { suggestedName: defaultName }
          );
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return Object.freeze({
            handled: true,
            status: 'saved',
            mode: 'picker'
          });
        } catch (error) {
          if (error?.name === 'AbortError') {
            return Object.freeze({
              handled: true,
              status: 'cancelled',
              mode: 'picker'
            });
          }
          logger?.warn?.(
            '[ProjectExport] File picker failed; falling back to download:',
            error
          );
        }
      }

      const confirmRef = getConfirm?.();
      if (typeof confirmRef !== 'function' || !confirmRef(confirmMessage)) {
        return Object.freeze({
          handled: true,
          status: 'cancelled',
          mode: 'download'
        });
      }

      if (
        typeof urlRef?.createObjectURL !== 'function' ||
        typeof documentRef?.createElement !== 'function'
      ) {
        throw new Error('Browser download APIs are unavailable');
      }

      const url = urlRef.createObjectURL(blob);
      try {
        const anchor = documentRef.createElement('a');
        anchor.href = url;
        anchor.download = defaultName;
        anchor.click?.();
      } catch (error) {
        urlRef.revokeObjectURL?.(url);
        throw error;
      }

      schedule?.(() => urlRef.revokeObjectURL?.(url), 5000);
      return Object.freeze({
        handled: true,
        status: 'saved',
        mode: 'download'
      });
    }

    return Object.freeze({ saveBrowser });
  }

  const service = Object.freeze({ create });
  globalScope.EditorProjectExportRouteService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
