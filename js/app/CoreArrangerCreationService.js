/*
 * CoreArrangerCreationService
 *
 * Creates arranger playlists without owning the arranger collection.
 */
(function attachCoreArrangerCreationService(globalScope) {
  'use strict';

  function create({
    getArrangers = () => [],
    prompt = async () => null,
    playlistNameExists = () => false,
    saveArrangers = () => {},
    setEditingArr = () => {},
    renderArrangerManager = () => {},
    openArrEditor = () => {},
    toast = () => {},
    now = () => Date.now(),
    isoNow = () => new Date().toISOString()
  } = {}) {
    async function createNewArranger() {
      const arrangers = getArrangers?.() || [];
      const name = await prompt(
        t('newPlaylistNamePrompt'),
        t('newPlaylist') + ' ' + (arrangers.length + 1)
      );
      if (name === null) return;

      const trimmedName =
        String(name).trim() || t('newPlaylist') + ' ' + (arrangers.length + 1);
      if (playlistNameExists?.(trimmedName)) {
        toast?.(
          t('playlistNameExists')
        );
        return createNewArranger();
      }

      const arr = {
        id: 'playlist_' + now(),
        name: trimmedName,
        items: [],
        crossfade: 0,
        pauseBetween: false,
        createdAt: isoNow(),
        updatedAt: isoNow()
      };
      arrangers.unshift(arr);
      saveArrangers?.();
      setEditingArr?.(arr);
      renderArrangerManager?.();
      openArrEditor?.();
      toast?.(t('playlistCreated'));
    }

    return Object.freeze({ createNewArranger });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerCreationService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
