/*
 * CoreArrangerFileExportService
 *
 * Exports one arranger playlist without owning arranger state.
 */
(function attachCoreArrangerFileExportService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    getAllSongs = () => [],
    toast = () => {},
    blobRef = globalScope.Blob,
    urlRef = windowRef?.URL || globalScope.URL
  } = {}) {
    async function exportArranger(arr) {
      if (!arr) {
        toast('⚠ پلی‌لیست نامعتبر');
        return;
      }

      const allSongs = getAllSongs?.() || [];
      const songData = {};
      arr.items.forEach(id => {
        const song = allSongs.find(item => item.id === id);
        if (song) songData[id] = song;
      });

      const exportData = {
        type: 'akordyar-playlist',
        version: '1.0',
        name: arr.name || 'پلی‌لیست',
        items: arr.items,
        crossfade: arr.crossfade || 0,
        pauseBetween: !!arr.pauseBetween,
        _itemSettings: arr._itemSettings || {},
        songs: songData,
        exportDate: new Date().toISOString()
      };

      const fileName =
        (arr.name || 'playlist').replace(/[\/\\:*?"<>|]/g, '_') + '.json';
      const json = JSON.stringify(exportData, null, 2);

      if (windowRef?.showSaveFilePicker) {
        try {
          const handle = await windowRef.showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: 'JSON Playlist',
                accept: { 'application/json': ['.json'] }
              }
            ]
          });
          const writable = await handle.createWritable();
          await writable.write(json);
          await writable.close();
          toast(`✅ اکسپورت شد: ${fileName}`);
        } catch (error) {
          if (error.name !== 'AbortError') {
            toast('خطا در اکسپورت: ' + error.message);
          }
        }
        return;
      }

      const blob = new blobRef([json], { type: 'application/json' });
      const url = urlRef.createObjectURL(blob);
      const anchor = documentRef.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      urlRef.revokeObjectURL(url);
      toast(`✅ اکسپورت شد: ${fileName}`);
    }

    return Object.freeze({ exportArranger });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerFileExportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
