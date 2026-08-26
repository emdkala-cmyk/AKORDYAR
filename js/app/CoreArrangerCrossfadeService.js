/*
 * CoreArrangerCrossfadeService
 *
 * Performs a gapless arranger crossfade without owning arranger state.
 */
(function attachCoreArrangerCrossfadeService(globalScope) {
  'use strict';

  function create({
    getCrossfadeDuration = () => 0,
    hasNextState = () => false,
    setIsCrossfading = () => {},
    ensureAudioCtx = () => {},
    getDAW = () => ({}),
    stopAllVoices = () => {},
    hotSwapToNextSong = () => {},
    schedule = (callback, delay) => setTimeout(callback, delay),
    logger = console
  } = {}) {
    function swap() {
      const crossfadeDur = getCrossfadeDuration?.() || 0;
      if (crossfadeDur <= 0 || !hasNextState?.()) {
        return hotSwapToNextSong?.();
      }

      setIsCrossfading(true);
      ensureAudioCtx?.();
      const daw = getDAW?.() || {};
      const ctx = daw.audioCtx;
      const curGain = daw.masterGain;
      const now = ctx.currentTime;
      const fadeTime = Math.min(Math.max(crossfadeDur, 0.5), 5);

      logger.log(
        `[Arranger Crossfade] Starting ${fadeTime}s crossfade`
      );

      const currentVolume = curGain.gain.value;
      curGain.gain.cancelScheduledValues(now);
      curGain.gain.setValueAtTime(currentVolume, now);
      curGain.gain.linearRampToValueAtTime(0, now + fadeTime * 0.5);

      schedule(() => {
        try {
          stopAllVoices?.();
          hotSwapToNextSong?.();

          const fadeInNow = ctx.currentTime;
          curGain.gain.cancelScheduledValues(fadeInNow);
          curGain.gain.setValueAtTime(0, fadeInNow);
          curGain.gain.linearRampToValueAtTime(
            currentVolume,
            fadeInNow + fadeTime * 0.5
          );

          logger.log('[Arranger Crossfade] Fade-in started');
        } catch (error) {
          logger.error('[Arranger Crossfade] Error during swap:', error);
        } finally {
          setIsCrossfading(false);
        }
      }, fadeTime * 500);
    }

    return Object.freeze({ swap });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerCrossfadeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
