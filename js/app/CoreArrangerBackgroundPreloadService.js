/*
 * CoreArrangerBackgroundPreloadService
 *
 * Preloads arranger audio sequentially without owning performance state.
 */
(function attachCoreArrangerBackgroundPreloadService(globalScope) {
  'use strict';

  function create({
    getArranger = () => null,
    getActive = () => false,
    setActive = () => {},
    getPreloadedIds = () => new Set(),
    setPreloadedIds = () => {},
    getAllSongs = () => [],
    getDAW = () => ({}),
    preloadAudioForSong = async () => {},
    wait = delay => new Promise(resolve => setTimeout(resolve, delay)),
    logger = console
  } = {}) {
    function start() {
      if (getActive?.()) return;
      const arranger = getArranger?.();
      if (!arranger || !arranger.items?.length) return;

      setActive(true);
      const preloadedIds = new Set();
      setPreloadedIds(preloadedIds);
      const allSongs = getAllSongs?.() || [];
      const songsToPreload = arranger.items
        .map(id => allSongs.find(song => song.id === id))
        .filter(Boolean);

      logger.log(
        `[BG Preload] Starting background preload for ${songsToPreload.length} songs`
      );

      (async () => {
        for (let index = 0; index < songsToPreload.length; index++) {
          if (!getActive?.()) {
            logger.log('[BG Preload] Cancelled');
            return;
          }
          const song = songsToPreload[index];
          if (preloadedIds.has(song.id)) continue;

          try {
            const hasAudioClips =
              song._dawClips &&
              song._dawClips.some(
                clip => clip.type !== 'chord' && clip.bufferKey
              );
            if (!hasAudioClips) {
              preloadedIds.add(song.id);
              continue;
            }

            const bufferCache = getDAW?.().bufferCache;
            const allLoaded = song._dawClips.every(
              clip =>
                clip.type === 'chord' ||
                !clip.bufferKey ||
                bufferCache?.has?.(clip.bufferKey)
            );
            if (allLoaded) {
              preloadedIds.add(song.id);
              continue;
            }

            logger.log(
              `[BG Preload] (${index + 1}/${songsToPreload.length}) Preloading: "${song.title || song.id}"`
            );
            await preloadAudioForSong(song);
            preloadedIds.add(song.id);
            await wait(50);
          } catch (error) {
            logger.warn(
              `[BG Preload] Error preloading "${song.title}":`,
              error
            );
            preloadedIds.add(song.id);
          }
        }
        logger.log('[BG Preload] Complete');
        setActive(false);
      })();
    }

    return Object.freeze({ start });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerBackgroundPreloadService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
