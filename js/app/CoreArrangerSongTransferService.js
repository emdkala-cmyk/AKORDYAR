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
        toast('ترانه‌ای باز نیست');
        return;
      }

      try {
        await saveCurrentSong?.();

        const arrangers = getArrangers?.() || [];
        let editingArr;
        if (!arrangers.length) {
          editingArr = {
            id: now(),
            name: 'پلی‌لیست جدید',
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
        toast('ترانه به پلی‌لیست اضافه شد');
      } catch (error) {
        logger.error('[Arranger] Failed to send current song:', error);
        toast('خطا در ارسال ترانه به ارنجر');
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
