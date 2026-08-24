/**
 * EditorLifecycleService
 *
 * مرز کوچک و قابل‌آزمون برای lifecycle اولیه و رندر پایهٔ تایم‌لاین.
 * این سرویس هیچ state داخلی editor را مالک نمی‌شود؛ همه‌چیز از طریق callback
 * به کد legacy تزریق می‌شود تا ترتیب فعلی scriptها حفظ شود.
 */
(function attachEditorLifecycleService(globalScope) {
  function renderTimeline({
    documentRef = globalScope.document,
    getDAW = () => globalScope.EditorRuntimeAdapter?.getDAW?.()
  } = {}) {
    const container = documentRef?.getElementById?.('timeline-tracks-container');
    const daw = typeof getDAW === 'function' ? getDAW() : null;
    if (!container || !daw) return;

    container.replaceChildren();
    (daw.tracks || []).forEach(track => {
      const trackEl = documentRef.createElement('div');
      trackEl.className = 'track-row';
      trackEl.innerHTML = `
        <div class="track-header"></div>
        <div class="track-content"></div>
      `;
      trackEl.querySelector('.track-header').textContent = track.name || '';
      container.appendChild(trackEl);
    });
  }

  function bindAudioImport({
    documentRef = globalScope.document,
    confirmRef = globalScope.confirm,
    handleAudioImport,
    toast = () => {},
    logger = console
  } = {}) {
    const bind = () => {
      const audioInput = documentRef?.getElementById?.('audio-file-input');
      if (!audioInput || audioInput.dataset.lifecycleBound === 'true') return;
      audioInput.dataset.lifecycleBound = 'true';

      audioInput.addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file) return;

        const copy = typeof confirmRef === 'function'
          ? confirmRef('آیا می‌خواهید فایل صوتی در پوشه پروژه کپی شود؟')
          : false;

        try {
          await handleAudioImport?.(file, copy);
        } catch (error) {
          logger?.error?.('[AudioImport] Failed to import audio file:', error);
          toast('خطا در وارد کردن فایل صوتی');
        } finally {
          event.target.value = '';
        }
      });
    };

    if (documentRef?.readyState === 'loading') {
      documentRef.addEventListener('DOMContentLoaded', bind, { once: true });
    } else {
      bind();
    }
    return bind;
  }

  function initialize({
    initDAW,
    initSong,
    initAccidentalSelector,
    applyI18n,
    initHighlightEffect,
    refreshStorageInfo,
    schedule = globalScope.setTimeout,
    logger = console
  } = {}) {
    const invokeSafely = (name, callback) => {
      try {
        callback?.();
      } catch (error) {
        logger?.warn?.(`[EditorLifecycle] ${name} failed:`, error);
      }
    };

    try {
      initDAW?.();
    } catch (error) {
      logger?.warn?.('DAW init error:', error);
    }

    let songInitialization;
    try {
      songInitialization = initSong?.();
    } catch (error) {
      logger?.error?.('Editor song init error:', error);
      songInitialization = null;
    }
    const ready = Promise.resolve(songInitialization).catch(error => {
      logger?.error?.('Editor song init error:', error);
      return null;
    });

    invokeSafely('initAccidentalSelector', initAccidentalSelector);
    invokeSafely('applyI18n', applyI18n);
    invokeSafely('initHighlightEffect', initHighlightEffect);

    try {
      schedule?.(() => invokeSafely('refreshStorageInfo', refreshStorageInfo), 3000);
    } catch (error) {
      logger?.warn?.('[EditorLifecycle] storage refresh scheduling failed:', error);
    }

    return ready;
  }

  const service = Object.freeze({
    renderTimeline,
    bindAudioImport,
    initialize
  });

  globalScope.EditorLifecycleService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
