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
    getTransportVisualPlayhead = getTransportPlayhead,
    getSyncTimes = () => [],
    installPopupHighlightLoop = () => {}
  } = {}) {
    let messageCleanup = null;
    let lastScrolledIndex = -999;
    let lastHighlightKey = null;

    function getActiveIndex(times, time, lyricLines = []) {
      if (
        typeof globalScope.SharedEngine?.resolveActiveLineIndex ===
        'function'
      ) {
        return globalScope.SharedEngine.resolveActiveLineIndex(
          times,
          time,
          lyricLines
        );
      }

      let activeIndex = -1;
      let activeTime = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < times.length; index++) {
        const cueTime = Number(times[index]);
        if (
          Number.isFinite(cueTime) &&
          cueTime <= time &&
          lyricLines[index]?.trim?.() &&
          cueTime >= activeTime
        ) {
          activeIndex = index;
          activeTime = cueTime;
        }
      }
      if (
        activeIndex < 0 &&
        time >= 0 &&
        times.some(value => Number.isFinite(value))
      ) {
        const firstLyricIndex = lyricLines.findIndex(line => line.trim());
        activeIndex =
          firstLyricIndex >= 0
            ? firstLyricIndex
            : times.findIndex(value => Number.isFinite(value));
      }
      return activeIndex;
    }

    function applyActiveIndex(body, activeIndex) {
      if (!body) return;
      [...(body.children || [])].forEach(element => {
        if (!element.dataset.li) return;
        const lineIndex = +element.dataset.li;
        const isActive = lineIndex === activeIndex;
        element.classList.toggle('lop-active', isActive);
        element.classList.toggle('lop-active-bg', isActive);
      });
      if (activeIndex < 0) {
        lastScrolledIndex = -999;
        return;
      }
      if (activeIndex === lastScrolledIndex) return;
      const activeElement = body.querySelector(
        '[data-li="' + activeIndex + '"]'
      );
      if (!activeElement) return;
      lastScrolledIndex = activeIndex;
      const bodyHeight = body.clientHeight;
      body.scrollTo({
        top: activeElement.offsetTop -
          bodyHeight / 2 +
          activeElement.offsetHeight / 2,
        behavior: 'smooth'
      });
    }

    function sync() {
      const popup = getPopup?.();
      if (!isPopupOpen?.(popup)) return;
      const snapshot = getSnapshot?.();
      if (!snapshot) return;
      const doc = popupDocument?.(popup);
      if (!doc) return;
      const { title, artist, lyrics, styles } = snapshot;
      const { tSize, tColor, tFont, tBold, align } = styles;
      const highlightEffect = styles.highlightEffect || 'depth';
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
          .lop-body .eline { position: relative; border-radius: 8px; transition: color 1.2s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 1.2s cubic-bezier(0.22, 0.61, 0.36, 1), background 1.2s cubic-bezier(0.22, 0.61, 0.36, 1), text-shadow 1.2s cubic-bezier(0.22, 0.61, 0.36, 1); }
          .lop-body .eline::before { content: ''; position: absolute; left: 0; right: 0; top: -0.4em; bottom: 0.8em; opacity: 0; border-radius: 8px; pointer-events: none; z-index: -1; transition: opacity 1.2s cubic-bezier(0.22, 0.61, 0.36, 1), background 1.2s cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 1.2s cubic-bezier(0.22, 0.61, 0.36, 1); }
          .lop-active { color: #fff !important; border-radius: 8px; z-index: 10; }
          .lop-active::before { opacity: 1; }
          body.hl-neon .lop-body .lop-active { color: #00F2FE !important; text-shadow: 0 0 8px rgba(0,242,254,0.8), 0 0 20px rgba(0,242,254,0.4); }
          body.hl-neon .lop-body .lop-active::before { background: linear-gradient(180deg, rgba(0,242,254,0.2), rgba(0,242,254,0.04) 55%, transparent); border: 1px solid rgba(0,242,254,0.3); box-shadow: 0 0 15px rgba(0,242,254,0.3), 0 0 30px rgba(0,242,254,0.1); }
          body.hl-frost .lop-body .lop-active { color: #fff !important; }
          body.hl-frost .lop-body .lop-active::before { background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 50%, rgba(200,220,255,0.08) 100%); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 16px rgba(0,0,0,0.3); }
          body.hl-shift .lop-body .lop-active { background: linear-gradient(135deg, #ff2e93, #7b2fff, #00F2FE, #3FB8AF, #ff2e93); background-size: 400% 400%; animation: hl-gradient-sweep 4s ease infinite; -webkit-background-clip: text; -webkit-text-fill-color: transparent !important; background-clip: text; }
          body.hl-shift .lop-body .lop-active::before { background: linear-gradient(135deg, rgba(255,46,147,0.15), rgba(123,47,255,0.15), rgba(0,242,254,0.15)); background-size: 400% 400%; animation: hl-gradient-sweep 4s ease infinite; }
          body.hl-depth .lop-body .lop-active { color: #E2E8F0 !important; text-shadow: 0 1px 0 rgba(0,0,0,0.8), 0 2px 0 rgba(0,0,0,0.7), 0 3px 0 rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.5), 0 0 15px rgba(255,46,147,0.3); }
          body.hl-depth .lop-body .lop-active::before { background: linear-gradient(180deg, rgba(255,46,147,0.15), rgba(255,46,147,0.02) 60%, transparent); border: 1px solid rgba(255,46,147,0.2); box-shadow: 0 6px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(255,46,147,0.2); }
          body.hl-pulse .lop-body .lop-active { color: #22D364 !important; animation: hl-text-pulse 2s ease-in-out infinite; }
          body.hl-pulse .lop-body .lop-active::before { background: linear-gradient(180deg, rgba(34,211,100,0.12), rgba(34,211,100,0.02) 55%, transparent); border: 1px solid rgba(34,211,100,0.25); border-radius: 10px; animation: hl-pulse-glow 2s ease-in-out infinite; }
          @keyframes hl-gradient-sweep { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          @keyframes hl-pulse-glow { 0%,100% { box-shadow: 0 0 8px rgba(34,211,100,0.3), inset 0 0 12px rgba(34,211,100,0.05); } 50% { box-shadow: 0 0 20px rgba(34,211,100,0.6), inset 0 0 20px rgba(34,211,100,0.1); } }
          @keyframes hl-text-pulse { 0%,100% { text-shadow: 0 0 6px rgba(34,211,100,0.5), 0 0 12px rgba(34,211,100,0.3); } 50% { text-shadow: 0 0 12px rgba(34,211,100,0.8), 0 0 30px rgba(34,211,100,0.5), 0 0 50px rgba(34,211,100,0.2); } }
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
      lastScrolledIndex = -999;
      lastHighlightKey = null;
      doc.body.innerHTML = html;
      doc.body.setAttribute('data-popup-role', 'singer');
      doc.body.classList?.remove?.(
        'hl-neon',
        'hl-frost',
        'hl-shift',
        'hl-depth',
        'hl-pulse'
      );
      doc.body.classList?.add?.('hl-' + highlightEffect);
      const lyricBody = doc.getElementById?.('lopBody');
      if (lyricBody) lyricBody.scrollTop = 0;

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
          applyActiveIndex(body, Number(event.data.activeIdx));
        }
      }) || null;

      function syncSingerHighlight() {
        const currentPopup = getPopup?.();
        if (!isPopupOpen?.(currentPopup)) return;
        const body = popupDocument?.(currentPopup)?.getElementById('lopBody');
        if (!body) return;
        const times = getSyncTimes?.() || [];
        const daw = getDAW?.() || {};
        const visualTime = Number(getTransportVisualPlayhead?.());
        const rawTime = Number(getTransportPlayhead?.());
        const time = daw.isPlaying
          ? Number.isFinite(visualTime)
            ? visualTime
            : (Number.isFinite(rawTime) ? rawTime : 0)
          : (Number.isFinite(daw.playhead) ? daw.playhead : 0);
        const activeIndex = getActiveIndex(times, time, lines);
        const highlightKey = `${activeIndex}:${daw.isPlaying ? 1 : 0}`;
        if (highlightKey === lastHighlightKey) return;
        lastHighlightKey = highlightKey;
        applyActiveIndex(body, activeIndex);
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
