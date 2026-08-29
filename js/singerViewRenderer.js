/**
 * singerViewRenderer.js — رندرر خواننده: فقط متن + هایلایت (بدون آکورد)
 *
 * دو سطح API:
 *   renderSingerView() — بازسازی کامل DOM (فقط تغییر محتوا/تنظیمات)
 *   updateSingerHighlight() — فقط کلاس‌ها + اسکرول (هر فریم امن)
 */
const SingerViewRenderer = (() => {

  const AUTO_SCROLL_FOCUS_RATIO = 0.36;
  let _lastScrolledLineId = null;

  /**
   * @param {SongDocument} doc
   * @param {HighlightState} highlight
   * @param {any} viewState
   * @param {HTMLElement} container
   */
  function renderSingerView(doc, highlight, viewState, container) {
    if (!doc || !container) return;
    container.innerHTML = '';
    container.scrollTop = 0;
    _lastScrolledLineId = null;

    const vs = viewState || {};
    const textColor    = vs.textColor || '#E2E8F0';

    // Container styles
    container.style.fontFamily      = (vs.fontFamily || 'Vazirmatn') + ', sans-serif';
    container.style.fontSize        = (vs.fontSize || 32) + 'px';
    container.style.lineHeight      = String(vs.lineHeight || 2.2);
    container.style.color           = textColor;
    container.style.backgroundColor = vs.backgroundColor || '#0F131E';
    container.style.textAlign       = 'center';
    container.style.padding         = '20px';
    container.style.overflowY       = 'auto';
    container.style.height          = '100%';
    if (vs.scale && vs.scale !== 1) {
      container.style.transform       = 'scale(' + vs.scale + ')';
      container.style.transformOrigin = 'center top';
    }

    (doc.lines || []).forEach(line => {
      const lineEl = document.createElement('div');
      lineEl.dataset.lineId = line.id;
      lineEl.dataset.lineIndex = line.index;

      lineEl.style.minHeight     = '1.2em';
      lineEl.style.whiteSpace    = 'pre-wrap';
      lineEl.style.padding       = '4px 12px';
      lineEl.style.borderRadius  = '6px';
      lineEl.style.transition    = 'opacity 0.25s ease, color 0.25s ease, background 0.25s ease, text-shadow 0.25s ease';
      lineEl.style.color         = textColor;

      lineEl.textContent = line.text || '\u00A0';
      container.appendChild(lineEl);
    });

    // اعمال هایلایت اولیه
    _applyHighlight(highlight, viewState, container);
  }

  /**
   * آپدیت اینکرمنتال: فقط کلاس‌ها + اسکرول
   */
  function updateSingerHighlight(highlight, viewState, container) {
    if (!container || !container.children.length) return;
    _applyHighlight(highlight, viewState, container);
  }

  function _applyHighlight(highlight, viewState, container) {
    const activeLineId = highlight ? highlight.activeLineId : null;
    const doneLines    = (highlight && highlight.doneLines) ? highlight.doneLines : new Set();
    const hlColor      = (viewState || {}).highlightColor || '#FF2E93';
    const textColor    = (viewState || {}).textColor || '#E2E8F0';

    [...container.children].forEach(el => {
      if (!el.dataset.lineId) return;

      const isActive = activeLineId && el.dataset.lineId === activeLineId;
      const lineIndex = +el.dataset.lineIndex;
      const isDone = Number.isFinite(lineIndex) && doneLines.has(lineIndex);

      if (isActive) {
        el.style.color       = '#fff';
        el.style.textShadow  = '0 0 10px ' + hlColor + '80, 0 0 20px ' + hlColor + '40';
        el.style.background  = hlColor + '15';
        el.style.opacity     = '';
      } else if (isDone) {
        el.style.opacity     = '0.35';
        el.style.color       = '';
        el.style.textShadow  = '';
        el.style.background  = '';
      } else {
        el.style.color       = textColor;
        el.style.opacity     = '';
        el.style.textShadow  = '';
        el.style.background  = '';
      }
    });

    // اسکرول فقط وقتی خط فعال عوض شده
    if (activeLineId && activeLineId !== _lastScrolledLineId) {
      _lastScrolledLineId = activeLineId;
      const activeEl = container.querySelector('[data-line-id="' + activeLineId + '"]');
      if (activeEl) {
        const boxH = container.clientHeight;
        const elTop = activeEl.offsetTop;
        const elH = activeEl.offsetHeight;
        if (!boxH) return;
        container.scrollTo({
          top:      elTop - boxH * AUTO_SCROLL_FOCUS_RATIO + elH / 2,
          behavior: 'smooth'
        });
      }
    }
  }

  return { renderSingerView, updateSingerHighlight };

})();

if (typeof window !== 'undefined') {
  window.SingerViewRenderer = SingerViewRenderer;
}
