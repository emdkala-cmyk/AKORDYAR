/*
 * CoreArrangerSongTransferService
 *
 * Sends the current song to the first arranger playlist without owning state.
 */
(function attachCoreArrangerSongTransferService(globalScope) {
  'use strict';

  function create({
    getCurrentSong = () => null,
    saveCurrentSong = async () => {},
    getArrangers = () => [],
    setEditingArr = () => {},
    saveArrangers = () => {},
    openArrangerModal = () => {},
    toast = () => {},
    logger = console,
    now = () => Date.now()
  } = {}) {
    async function send() {
      const currentSong = getCurrentSong?.();
      if (!currentSong) {
        toast(t('noSongOpen'));
        return;
      }

      try {
        await saveCurrentSong?.();

        const arrangers = getArrangers?.() || [];
        let editingArr;
        if (!arrangers.length) {
          editingArr = {
            id: now(),
            name: t('newPlaylist'),
            items: [],
            crossfade: 0,
            pauseBetween: false
          };
          arrangers.unshift(editingArr);
        } else {
          editingArr = arrangers[0];
        }

        setEditingArr?.(editingArr);
        if (!Array.isArray(editingArr.items)) editingArr.items = [];
        if (
          !editingArr.items.some(
            item => String(item) === String(currentSong.id)
          )
        ) {
          editingArr.items.push(currentSong.id);
        }

        saveArrangers?.();
        openArrangerModal?.();
        toast(t('songAddedToPlaylist'));
      } catch (error) {
        logger.error('[Arranger] Failed to send current song:', error);
        toast(t('songSendError'));
      }
    }

    return Object.freeze({ send });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerSongTransferService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
