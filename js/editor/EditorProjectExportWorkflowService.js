/**
 * EditorProjectExportWorkflowService
 *
 * Orchestrates complete project export without owning bundle construction or
 * the native/browser write implementations.
 */
(function attachEditorProjectExportWorkflowService(globalScope) {
  'use strict';

  function create({
    getSong = () => null,
    getDAW = () => null,
    buildBundle = async () => null,
    saveNative = async () => ({ handled: false }),
    saveBrowser = async () => ({ handled: false }),
    refreshStorageInfo = () => {},
    toast = () => {},
    BlobRef = globalScope.Blob,
    logger = console
  } = {}) {
    function notifySaved(bundle, sizeMB) {
      toast(
        `خروجی ذخیره شد (${sizeMB} MB, ${bundle.audioCount || 0} کپی + ` +
        `${bundle.linkedCount || 0} لینک)`
      );
      refreshStorageInfo();
    }

    function notifyCancelled() {
      toast('لغو شد');
    }

    async function exportProject({ targetPath = null } = {}) {
      const song = getSong?.();
      if (!song || typeof buildBundle !== 'function') {
        toast('ترانه‌ای باز نیست');
        return;
      }

      try {
        const bundle = await buildBundle({
          song,
          daw: getDAW?.(),
          onAudioProgress: ({ index, total }) => {
            toast(`رمزگذاری صدا ${index}/${total}...`);
          }
        });
        if (!bundle) {
          toast('ترانه‌ای باز نیست');
          return;
        }
        if (typeof BlobRef !== 'function') {
          throw new Error('Blob API در دسترس نیست');
        }

        const {
          defaultName,
          data,
          audioCount = 0,
          linkedCount = 0
        } = bundle;
        const blob = new BlobRef([data], { type: 'application/json' });
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);

        const nativeSave = await saveNative?.({
          data,
          defaultPath: defaultName,
          targetPath
        });
        if (nativeSave?.handled) {
          if (nativeSave.cancelled) {
            notifyCancelled();
            return;
          }
          notifySaved({ audioCount, linkedCount }, sizeMB);
          return;
        }

        const linkedInfo = linkedCount > 0
          ? `\nلینک‌شده: ${linkedCount} فایل (بدون صدا)`
          : '';
        const browserSave = await saveBrowser?.({
          blob,
          defaultName,
          pickerOptions: {
            suggestedName: defaultName,
            types: [{
              description: 'فایل پروژه کامل',
              accept: { 'application/json': ['.json'] }
            }]
          },
          confirmMessage:
            `دانلود فایل: ${defaultName}\n` +
            `حجم: ${sizeMB} MB\n` +
            `صدا: ${audioCount} کپی‌شده${linkedInfo}\n\n` +
            'ذخیره در پوشه دانلود؟'
        });
        if (!browserSave?.handled) {
          throw new Error(
            'EditorProjectExportRouteService در دسترس نیست'
          );
        }
        if (browserSave.status === 'cancelled') {
          notifyCancelled();
          return;
        }
        notifySaved({ audioCount, linkedCount }, sizeMB);
      } catch (error) {
        logger?.error?.('Export error:', error);
        toast('خطا در خروجی: ' + (error?.message || error));
      }
    }

    return Object.freeze({
      exportProject,
      edExportProjectFull: exportProject
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorProjectExportWorkflowService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
