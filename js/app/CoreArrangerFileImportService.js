/*
 * CoreArrangerFileImportService
 *
 * Imports one arranger playlist JSON file without owning application state.
 */
(function attachCoreArrangerFileImportService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getArrangers = () => [],
    setEditingArr = () => {},
    getAllSongs = () => [],
    setAllSongs = () => {},
    playlistNameExists = () => false,
    saveArrangers = () => {},
    renderArrangerManager = () => {},
    openArrEditor = () => {},
    toast = () => {},
    logger = console,
    now = () => Date.now(),
    isoNow = () => new Date().toISOString()
  } = {}) {
    function importFromFile() {
      const input = documentRef.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async event => {
        const file = event.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);

          if (!data || (!data.items && !data.songs)) {
            toast(t('invalidPlaylistFormat'));
            return;
          }

          const supportedVersions = [1, '1.0', 2, '2.0'];
          if (data.version && !supportedVersions.includes(data.version)) {
            toast(t('unsupportedFileVersion') || `❌ File version (${data.version}) not supported.`);
            return;
          }

          let baseName = data.name || file.name.replace(/\.json$/i, '');
          if (!baseName || !baseName.trim()) {
            toast(t('playlistNameEmpty'));
            return;
          }
          baseName = baseName.trim();

          if (playlistNameExists(baseName)) {
            toast(t('playlistNameExists'));
            return;
          }

          if (!Array.isArray(data.items)) {
            toast(t('invalidItemsArray'));
            return;
          }

          for (let index = 0; index < data.items.length; index++) {
            const item = data.items[index];
            const songId =
              item && typeof item === 'object' ? item.songId : item;
            if (!songId) {
              toast(t('invalidItemsArray') + ' #' + (index + 1));
              return;
            }
          }

          let importedSongsCount = 0;
          if (data.songs && typeof data.songs === 'object') {
            const allSongs = getAllSongs();
            for (const [id, song] of Object.entries(data.songs)) {
              if (song && song.title && !allSongs.find(item => item.id === id)) {
                allSongs.push(song);
                importedSongsCount++;
              }
            }
            if (importedSongsCount > 0) {
              setAllSongs(allSongs);
              logger.log(
                `[Import] ${importedSongsCount} song(s) imported from playlist`
              );
            }
          }

          const timestamp = isoNow();
          const newArr = {
            id: 'playlist_' + now(),
            name: baseName,
            items: data.items.map(item =>
              item && typeof item === 'object' ? item.songId : item
            ),
            crossfade: data.crossfade || 0,
            pauseBetween: !!data.pauseBetween,
            _itemSettings: data._itemSettings || {},
            createdAt: timestamp,
            updatedAt: timestamp
          };

          getArrangers().unshift(newArr);
          saveArrangers();
          setEditingArr(newArr);
          renderArrangerManager();
          openArrEditor();
          toast(t('playlistCreated'));
        } catch (error) {
          logger.error('[Import] Error:', error);
          toast(t('fileLoadError') + ' ' + error.message);
        }
      };
      input.click();
    }

    return Object.freeze({ importFromFile });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerFileImportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
