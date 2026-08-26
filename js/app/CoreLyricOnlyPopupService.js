/*
 * CoreLyricOnlyPopupService
 *
 * Builds and synchronizes the singer-only lyrics popup.
 */
(function attachCoreLyricOnlyPopupService(globalScope) {
  'use strict';

  function create({
    getPopup = () => null,
    isPopupOpen = () => false,
    popupDocument = () => null,
    getSnapshot = () => null,
    popupWindowBridge,
    windowRef = globalScope,
    getDAW = () => ({}),
    getTransportPlayhead = () => 0,
    getSyncTimes = () => [],
    installPopupHighlightLoop = () => {}
  } = {}) {
    let messageCleanup = null;

    function sync() {
      const popup = getPopup?.();
      if (!isPopupOpen?.(popup)) return;
      const snapshot = getSnapshot?.();
      if (!snapshot) return;
      const doc = popupDocument?.(popup);
      if (!doc) return;
      const { title, artist, lyrics, styles } = snapshot;
      const { tSize, tColor, tFont, tBold, align } = styles;
      const lines = lyrics.split('\n');

      doc.title = title + ' — ' + artist + ' | خواننده';
      doc.documentElement.dir = 'rtl';
      doc.documentElement.lang = 'fa';
      doc.head.innerHTML = `
        <style>
          @font-face { font-family: 'Vazirmatn'; src: url('../fonts/Vazirmatn-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'Vazirmatn Bold'; src: url('../fonts/Vazirmatn-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Thin'; src: url('../fonts/Vazirmatn-Thin.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Black'; src: url('../fonts/Vazirmatn-Black.woff2') format('woff2'); }
          @font-face { font-family: 'BArshia'; src: url('../fonts/BArshia.woff2') format('woff2'); }
          @font-face { font-family: 'BFarnaz'; src: url('../fonts/BFarnaz.woff2') format('woff2'); }
          @font-face { font-family: 'BJadid'; src: url('../fonts/BJadidBd.woff2') format('woff2'); }
          @font-face { font-family: 'BZar'; src: url('../fonts/BZar.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'BZar Bold'; src: url('../fonts/BZarBd.woff2') format('woff2'); }
          @font-face { font-family: 'Lalezar'; src: url('../fonts/Lalezar-Regular.woff2') format('woff2'); }
          @font-face { font-family: 'Mada'; src: url('../fonts/Mada-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Rubik'; src: url('../fonts/Rubik-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'JetBrains Mono'; src: url('../fonts/JetBrainsMono-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'JetBrains Mono Bold'; src: url('../fonts/JetBrainsMono-Bold.woff2') format('woff2'); }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0F131E; color: #E2E8F0; font-family: 'Vazirmatn', sans-serif; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
          .lop-header { text-align: center; padding: 8px 12px 4px; background: linear-gradient(180deg, #1C2333, #161B26); border-bottom: 1px solid #232B3E; }
          .lop-header .title { font-size: 15px; font-weight: 900; color: #00F2FE; }
          .lop-header .sub { font-size: 10px; color: #718096; }
          .lop-body { flex: 1; overflow: auto; padding: 16px 20px; position: relative; line-height: 2.4; }
          .lop-body { flex: 1; overflow-y: auto; padding: 16px; }
          .eline { min-height: 1.2em; white-space: pre-wrap; }
          .lop-active { color: #FF2E93 !important; text-shadow: 0 0 8px rgba(255,46,147,0.5); }
          .lop-active-bg { background: rgba(255,46,147,0.08); border-radius: 6px; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #1A202C; }
          ::-webkit-scrollbar-thumb { background: #4A5568; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #718096; }
        </style>`;
      let html = `<div class="lop-header"><div class="title">${title}</div><div class="sub">${artist}</div></div><div class="lop-body" id="lopBody">`;
      lines.forEach((line, index) => {
        html += `<div class="eline" data-li="${index}" style="font-size:${tSize}px;color:${tColor};font-family:'${tFont}';font-weight:${tBold};text-align:${align};">${line || '\u200B'}</div>`;
      });
      html += '</div>';
      doc.body.innerHTML = html;
      doc.body.setAttribute('data-popup-role', 'singer');

      messageCleanup?.();
      messageCleanup = popupWindowBridge?.onMessage?.({
        windowRef,
        getSource: () => getPopup?.(),
        type: 'syncUpdate',
        handler: event => {
          const currentPopup = getPopup?.();
          if (!isPopupOpen?.(currentPopup)) {
            messageCleanup?.();
            messageCleanup = null;
            return;
          }
          const body = popupDocument?.(currentPopup)?.getElementById('lopBody');
          if (!body) return;
          const activeIndex = event.data.activeIdx;
          [...body.children].forEach(element => {
            if (!element.dataset.li) return;
            const lineIndex = +element.dataset.li;
            element.classList.toggle('lop-active', lineIndex === activeIndex);
            element.classList.toggle('lop-active-bg', lineIndex === activeIndex);
          });
          if (activeIndex >= 0) {
            const activeElement = body.querySelector(
              '[data-li="' + activeIndex + '"]'
            );
            if (activeElement) {
              const bodyHeight = body.clientHeight;
              const elementTop = activeElement.offsetTop;
              const elementHeight = activeElement.offsetHeight;
              body.scrollTo({
                top: elementTop - bodyHeight / 2 + elementHeight / 2,
                behavior: 'smooth'
              });
            }
          }
        }
      }) || null;

      function syncSingerHighlight() {
        const currentPopup = getPopup?.();
        if (!isPopupOpen?.(currentPopup)) return;
        const body = popupDocument?.(currentPopup)?.getElementById('lopBody');
        if (!body) return;
        const times = getSyncTimes?.() || [];
        const daw = getDAW?.() || {};
        const time = daw.isPlaying
          ? getTransportPlayhead?.()
          : (Number.isFinite(daw.playhead) ? daw.playhead : 0);
        let activeIndex = -1;
        for (let index = 0; index < times.length; index++) {
          if (Number.isFinite(times[index]) && times[index] <= time) {
            activeIndex = index;
          } else if (Number.isFinite(times[index]) && times[index] > time) {
            break;
          }
        }
        [...body.children].forEach(element => {
          if (!element.dataset.li) return;
          const lineIndex = +element.dataset.li;
          element.classList.toggle('lop-active', lineIndex === activeIndex);
          element.classList.toggle('lop-active-bg', lineIndex === activeIndex);
        });
        if (activeIndex >= 0) {
          const activeElement = body.querySelector(
            '[data-li="' + activeIndex + '"]'
          );
          if (activeElement) {
            const bodyHeight = body.clientHeight;
            body.scrollTo({
              top: activeElement.offsetTop -
                bodyHeight / 2 +
                activeElement.offsetHeight / 2,
              behavior: 'smooth'
            });
          }
        }
      }

      popupWindowBridge?.set?.(
        popup,
        '_syncHighlight',
        syncSingerHighlight
      );
      installPopupHighlightLoop?.(popup, doc);
    }

    return Object.freeze({ sync });
  }

  const service = Object.freeze({ create });
  globalScope.CoreLyricOnlyPopupService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
