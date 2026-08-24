/**
 * EditorSongTransitionService
 *
 * مالک orchestration خامِ تعویض song در arranger است:
 * - جایگزینی state تایم‌لاین
 * - پاک‌سازی امن audio nodes
 * - hydration سند
 * - ساخت دوباره‌ی trackهای صوتی
 * - بازیابی audio وابسته به پروژه
 *
 * سرویس به DOM، edCur، DAW یا PERF global دسترسی ندارد و همه‌ی runtime
 * dependencyها را از طریق callback دریافت می‌کند.
 */
(function attachEditorSongTransitionService(globalScope) {
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function disconnectAudioTracks(daw) {
    daw?.tracks?.forEach(track => {
      if (track?._gainNode) {
        try { track._gainNode.disconnect(); } catch (_) {}
        track._gainNode = null;
      }
      if (track?._pannerNode) {
        try { track._pannerNode.disconnect(); } catch (_) {}
        track._pannerNode = null;
      }
    });
  }

  function inspectAudioClips(daw) {
    const clips = (daw?.clips || [])
      .filter(clip => clip.type !== 'chord' && clip.bufferKey);
    const loaded = clips.filter(clip => daw.bufferCache?.has?.(clip.bufferKey));
    const missing = clips.filter(clip => !daw.bufferCache?.has?.(clip.bufferKey));
    return {
      total: clips.length,
      loaded: loaded.length,
      missing: missing.length,
      missingNames: missing.map(clip => clip.fileName || clip.bufferKey)
    };
  }

  function create({
    getDAW = () => null,
    setSong = () => {},
    repairSong = song => song,
    ensureSongParsed,
    hydrationService = globalScope.EditorHydrationService,
    updateNextIdFromClips,
    ensureAudioCtx,
    updateTrackMix,
    restoreAudio = null,
    logger = console
  } = {}) {
    function initializeAudioTracks(daw) {
      daw?.tracks?.forEach(track => {
        if (track?.type === 'audio' && track.transpose === undefined) {
          track.transpose = 0;
        }
      });
      hydrationService?.initializeAudioTracks?.(daw, {
        ensureAudioCtx,
        updateTrackMix
      });
    }

    function applyPreparedState({
      song,
      clips = [],
      sections = [],
      tracks = [],
      loopState = null,
      arrangerMarkers = null
    } = {}) {
      const daw = getDAW();
      if (!daw || !song) return null;

      disconnectAudioTracks(daw);
      disconnectAudioTracks({ tracks });
      daw.clips = clips;
      daw.sections = sections;
      daw.tracks = tracks;
      updateNextIdFromClips?.();
      daw.selectedIds?.clear?.();
      daw.selectedSectionIds = new Set();

      if (loopState) {
        daw.loopEnabled = !!loopState.loopEnabled;
        daw.loopA = loopState.loopA || 0;
        daw.loopB = loopState.loopB || 10;
      } else {
        daw.loopEnabled = false;
        daw.loopA = 0;
        daw.loopB = 10;
      }
      daw.arrangerMarkers =
        globalScope.ArrangerMarkerService?.normalize?.(
          arrangerMarkers,
          song?._arrangerMarkers || song?._dawLoop
        ) || {
          start: Math.max(0, Number(arrangerMarkers?.start ?? song?._arrangerMarkers?.start ?? song?._dawLoop?.loopA) || 0),
          end: Math.max(0, Number(arrangerMarkers?.end ?? song?._arrangerMarkers?.end ?? song?._dawLoop?.loopB) || 0)
        };

      const nextSong = repairSong(song) || song;
      setSong(nextSong);
      initializeAudioTracks(daw);

      return {
        song: nextSong,
        audio: inspectAudioClips(daw)
      };
    }

    async function loadSong(song, {
      transpose = 0,
      styleDefaults,
      restoreAudio: restoreAudioOverride
    } = {}) {
      const daw = getDAW();
      if (!daw || !song) return null;

      disconnectAudioTracks(daw);
      daw.clips = [];
      daw.sections = [];
      daw.selectedIds?.clear?.();
      daw.selectedSectionIds = new Set();
      daw.waveCache?.clear?.();
      daw.loopEnabled = false;
      daw.loopA = 0;
      daw.loopB = 10;

      const clonedSong = clone(song);
      const nextSong = repairSong(clonedSong) || clonedSong;
      setSong(nextSong);

      hydrationService?.hydrateSong?.(nextSong, {
        daw,
        ensureSongParsed,
        styleDefaults,
        cloneTracks: true,
        cloneClips: true,
        cloneSections: true,
        sectionsFallbackEmpty: true,
        updateNextIdFromClips
      });

      if (transpose) {
        daw.tracks?.forEach(track => {
          if (track.type === 'audio') {
            track.transpose = (track.transpose || 0) + transpose;
          }
        });
      }

      initializeAudioTracks(daw);

      let restoreResult = null;
      let restoreError = null;
      const restore = restoreAudioOverride || restoreAudio;
      if (typeof restore === 'function') {
        try {
          restoreResult = await restore(nextSong.id, true);
        } catch (error) {
          restoreError = error;
          logger?.warn?.('Song audio restore error:', error);
        }
      }

      return {
        song: nextSong,
        audio: inspectAudioClips(daw),
        restoreResult,
        restoreError
      };
    }

    return Object.freeze({
      applyPreparedState,
      loadSong,
      disconnectAudioTracks,
      inspectAudioClips
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorSongTransitionService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
