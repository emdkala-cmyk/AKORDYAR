/*
 * CoreAudioBlobSaveSchedulerService
 *
 * Debounces project audio-blob persistence and queues one follow-up save when
 * a save is requested while another save is still running.
 */
(function attachCoreAudioBlobSaveSchedulerService(globalScope) {
  'use strict';

  function create({
    getSongId = () => null,
    saveAudioBlobsForProject = async () => {},
    schedule = (...args) => globalScope.setTimeout?.(...args),
    cancel = id => globalScope.clearTimeout?.(id),
    delay = 1200,
    logger = console
  } = {}) {
    let timer = null;
    let running = false;
    let queued = false;

    function scheduleAudioBlobSave() {
      const songId = getSongId?.();
      if (!songId) return;

      cancel?.(timer);
      timer = schedule?.(async () => {
        if (running) {
          queued = true;
          return;
        }

        running = true;
        try {
          await saveAudioBlobsForProject(songId);
        } catch (error) {
          logger?.warn?.('Audio save error:', error);
        } finally {
          running = false;
          if (queued) {
            queued = false;
            scheduleAudioBlobSave();
          }
        }
      }, delay);
    }

    return Object.freeze({ scheduleAudioBlobSave });
  }

  const service = Object.freeze({ create });
  globalScope.CoreAudioBlobSaveSchedulerService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
