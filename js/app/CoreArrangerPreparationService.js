/*
 * CoreArrangerPreparationService
 *
 * Prepares the next arranger song without owning arranger state.
 */
(function attachCoreArrangerPreparationService(globalScope) {
  'use strict';

  function create({
    getArranger = () => null,
    getCurrentIndex = () => -1,
    isActive = () => false,
    hasLoggedNoNextSong = () => false,
    setHasLoggedNoNextSong = () => {},
    setNextState = () => {},
    getAllSongs = () => [],
    preloadAudioForSong = async () => ({}),
    getDAW = () => ({}),
    createPlaybackBoundary = () => null,
    getArrangerMarkers = () => null,
    getItemSetting = () => ({}),
    peaksFromBuffer = () => [],
    restoreAudioForProjectSilently = async () => {},
    wait = delay => new Promise(resolve => setTimeout(resolve, delay)),
    logger = console
  } = {}) {
    async function prepare(retryCount = 0) {
      const arr = getArranger?.();
      const currentIndex = getCurrentIndex?.();
      const nextIndex = currentIndex + 1;

      if (!arr || nextIndex >= arr.items.length) {
        setNextState(null);
        if (!hasLoggedNoNextSong?.()) {
          setHasLoggedNoNextSong(true);
          logger.log('[Arranger Prep] No more songs — _arrNextState cleared');
        }
        return;
      }

      const allSongs = getAllSongs?.() || [];
      const song = allSongs.find(item => item.id === arr.items[nextIndex]);
      if (!song) {
        setNextState(null);
        logger.warn(
          `[Arranger Prep] Song at index ${nextIndex} not found in archive (id: ${arr.items[nextIndex]})`
        );
        return;
      }

      try {
        const songData = JSON.parse(JSON.stringify(song));
        if (!songData.styles) songData.styles = {};
        const defaults = {
          tSize: 23,
          tColor: '#0fa966',
          tFont: 'Vazirmatn',
          tBold: true,
          align: 'center',
          cSize: 23,
          cColor: '#e6aa28',
          cFont: 'JetBrains Mono'
        };
        Object.keys(defaults).forEach(key => {
          if (songData.styles[key] === undefined) {
            songData.styles[key] = defaults[key];
          }
        });

        const preloadResult = await preloadAudioForSong(songData);
        if (preloadResult.missing > 0) {
          logger.warn(
            `[Arranger Prep] ${preloadResult.missing} audio clip(s) missing for "${songData.title}":`,
            preloadResult.missingNames
          );
        } else {
          logger.log(
            `[Arranger Prep] ✓ Audio ready for "${songData.title}" (loaded: ${preloadResult.loaded})`
          );
        }

        const tracks = songData._dawTracks
          ? JSON.parse(JSON.stringify(songData._dawTracks))
          : [];
        let clips = songData._dawClips
          ? JSON.parse(JSON.stringify(songData._dawClips))
          : [];
        let sections = songData._dawSections
          ? JSON.parse(JSON.stringify(songData._dawSections))
          : [];
        const oldSections = clips.filter(clip => clip.type === 'section');
        if (oldSections.length) {
          oldSections.forEach(clip => {
            sections.push({
              id: clip.id,
              trackId: clip.trackId,
              label: clip.name,
              start: clip.start,
              duration: clip.duration,
              color: clip.color
            });
          });
          clips = clips.filter(clip => clip.type !== 'section');
        }

        const playbackBoundary = createPlaybackBoundary({
          clips,
          sections,
          arrangerMarkers: songData._arrangerMarkers,
          legacyLoopState: songData._dawLoop,
          fallbackEnd: 30
        }) || {
          start: 0,
          end: 30,
          selectionEnd: 30,
          markers: { enabled: false, start: 0, end: 30 }
        };
        const savedArrangerMarkers = getArrangerMarkers?.(songData) || {
          enabled: songData._arrangerMarkers?.enabled === true,
          start: Math.max(0, Number(songData._arrangerMarkers?.start) || 0),
          end: Math.max(0, Number(songData._arrangerMarkers?.end) || 0)
        };

        const daw = getDAW?.() || {};
        const bufferCache = daw.bufferCache;
        clips.forEach(clip => {
          if (
            clip.type === 'chord' ||
            !clip.bufferKey ||
            !bufferCache?.has?.(clip.bufferKey)
          ) {
            return;
          }
          const buffer = bufferCache.get(clip.bufferKey);
          clip.sourceDuration = buffer.duration;
          clip._peaks = peaksFromBuffer(buffer, 2000);
        });

        const nextSetting = getItemSetting(arr, arr.items[nextIndex]) || {};
        if (nextSetting.transpose) {
          tracks.forEach(track => {
            if (track.type === 'audio') {
              track.transpose =
                (track.transpose || 0) + nextSetting.transpose;
            }
          });
        }

        setNextState({
          song: songData,
          idx: nextIndex,
          clips,
          sections,
          tracks,
          playbackStart: playbackBoundary.start,
          playbackEnd: playbackBoundary.end,
          selectionEnd: playbackBoundary.selectionEnd,
          loopState: songData._dawLoop,
          arrangerMarkers: savedArrangerMarkers
        });
        logger.log(
          `[Arranger Prep] ✓ _arrNextState ready for song ${nextIndex + 1}: "${songData.title}"`
        );

        const audioClipsInNext = clips.filter(
          clip => clip.type !== 'chord' && clip.bufferKey
        );
        const missingBuffers = audioClipsInNext.filter(
          clip => !bufferCache?.has?.(clip.bufferKey)
        );
        if (missingBuffers.length > 0) {
          logger.warn(
            `[Arranger Prep] ⚠ ${missingBuffers.length} buffer(s) still missing after prep:`,
            missingBuffers.map(clip => clip.fileName || clip.bufferKey)
          );
          await restoreAudioForProjectSilently(songData.id, true);
          logger.log('[Arranger Prep] ✓ Retry complete - buffers rechecked');
        }
      } catch (error) {
        logger.error(
          `[Arranger Prep] Error preparing song ${nextIndex + 1} (retry ${retryCount}):`,
          error
        );
        setNextState(null);

        if (retryCount < 2 && isActive?.()) {
          logger.log(
            `[Arranger Prep] Retrying in 1s... (attempt ${retryCount + 1}/2)`
          );
          await wait?.(1000);
          if (isActive?.() && getCurrentIndex?.() === nextIndex - 1) {
            return prepare(retryCount + 1);
          }
        }
      }
    }

    return Object.freeze({ prepare });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerPreparationService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
