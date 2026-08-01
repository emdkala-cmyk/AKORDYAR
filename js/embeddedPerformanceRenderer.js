/**
 * embeddedPerformanceRenderer.js — رندرر Performance (بکینگ ترک)
 *
 * دو سطح API:
 *   renderEmbeddedPerformanceView() — بازسازی کامل DOM (فقط تغییر محتوا/تنظیمات)
 *   updateEmbeddedHighlight() — فقط کلاس‌ها + اسکرول (هر فریم امن)
 *
 * رندر token-based: آکوردها دقیقاً روی توکن مربوطه قرار می‌گیرند.
 */
const EmbeddedPerformanceRenderer = (() => {

  let _lastScrolledLineId = null;

  function renderEmbeddedPerformanceView(doc, highlight, viewState, container) {
    if (!doc || !container) return;
    container.innerHTML = '';
    _lastScrolledLineId = null;

    const vs = viewState || {};
    const chordColor   = vs.chordColor || '#e6aa28';
    const textColor    = vs.textColor || '#E2E8F0';
    const showChords   = vs.showChords !== false;
    const tSize        = vs.fontSize || 36;
    const cSize        = Math.round(tSize * 0.55);

    // Container styles — قوی‌تر برای flex layout
    container.style.boxSizing       = 'border-box';
    container.style.fontFamily      = (vs.fontFamily || 'Vazirmatn') + ', sans-serif';
    container.style.fontSize        = tSize + 'px';
    container.style.lineHeight      = String(vs.lineHeight || 2.4);
    container.style.color           = textColor;
    container.style.textAlign       = 'center';
    container.style.padding         = '24px';
    container.style.overflowY       = 'auto';
    container.style.overflowX       = 'hidden';
    container.style.position        = 'relative';
    container.style.flex            = '1 1 auto';
    container.style.minHeight       = '0';
    container.style.height          = '100%';
    container.style.width           = '100%';
    container.style.maxHeight       = '100%';

    if (vs.theme === 'glass') {
      container.style.backgroundColor = vs.backgroundColor || 'rgba(0,0,0,0.3)';
      container.style.backdropFilter  = 'blur(20px) saturate(1.4)';
      container.style.borderRadius    = '16px';
      container.style.border          = '1px solid rgba(255,255,255,0.08)';
    } else {
      container.style.backgroundColor = vs.backgroundColor || 'transparent';
    }

    // Scale: فعلاً غیرفعال روی container اسکرول‌شونده (میزان mismatch اسکرول)
    // TODO: اگر zoom لازم شد، روی wrapper بیرونی اعمال شود
    container.style.transform = 'none';

    // Build chord lookup: tokenIndex → chord
    const chordByToken = {};
    if (showChords && lineHasChords(doc)) {
      (doc.lines || []).forEach(line => {
        if (!line.chords || !line.chords.length) return;
        line.chords.forEach(ch => {
          if (ch.tokenIndex != null) {
            const key = line.id + '|' + ch.tokenIndex;
            chordByToken[key] = ch;
          }
        });
      });
    }

    (doc.lines || []).forEach(line => {
      const lineEl = document.createElement('div');
      lineEl.className = 'perf-line';
      lineEl.dataset.lineId = line.id;
      lineEl.dataset.lineIndex = line.index;
      lineEl.style.minHeight     = '1.4em';
      lineEl.style.whiteSpace    = 'pre-wrap';
      lineEl.style.padding       = '6px 12px';
      lineEl.style.borderRadius  = '8px';
      lineEl.style.transition    = 'opacity 0.25s ease, color 0.25s ease, background 0.25s ease, text-shadow 0.25s ease';
      lineEl.style.margin        = '2px 0';
      lineEl.style.color         = textColor;
      lineEl.style.position      = 'relative';

      // Token-based rendering: هر توکن یک span جداگانه
      if (line.tokens && line.tokens.length) {
        line.tokens.forEach(token => {
          // فاصله بین توکن‌ها
          if (token.type === 'space') {
            lineEl.appendChild(document.createTextNode(token.text || ' '));
            return;
          }

          const tokenEl = document.createElement('span');
          tokenEl.className = 'perf-token';
          tokenEl.dataset.tokenId = token.id;
          tokenEl.dataset.lineId = line.id;
          tokenEl.style.position = 'relative';
          tokenEl.style.display = 'inline-block';
          tokenEl.style.paddingInline = '1px';

          // متن توکن
          tokenEl.textContent = token.text || '';

          // اگر chord روی این توکن anchor شده
          if (showChords) {
            const key = line.id + '|' + token.index;
            const ch = chordByToken[key];
            if (ch) {
              const chordEl = document.createElement('span');
              chordEl.className = 'perf-chord';
              chordEl.dataset.chordId = ch.id;
              chordEl.dataset.lineId = line.id;
              chordEl.textContent = ch.name;
              chordEl.style.position = 'absolute';
              chordEl.style.bottom = '100%';
              chordEl.style.left = '50%';
              chordEl.style.transform = 'translateX(-50%)';
              chordEl.style.fontSize = cSize + 'px';
              chordEl.style.fontFamily = '"JetBrains Mono", monospace';
              chordEl.style.fontWeight = '700';
              chordEl.style.color = chordColor;
              chordEl.style.whiteSpace = 'nowrap';
              chordEl.style.pointerEvents = 'none';
              chordEl.style.lineHeight = '1.2';
              tokenEl.appendChild(chordEl);
            }
          }

          lineEl.appendChild(tokenEl);
        });
      } else {
        // Fallback: اگر tokens نداریم، متن ساده
        const textDiv = document.createElement('div');
        textDiv.textContent = line.text || '\u00A0';
        lineEl.appendChild(textDiv);
      }

      container.appendChild(lineEl);
    });

    // اعمال هایلایت اولیه
    _applyHighlight(highlight, viewState, container);
  }

  function lineHasChords(doc) {
    return (doc.lines || []).some(l => l.chords && l.chords.length);
  }

  function updateEmbeddedHighlight(highlight, viewState, container) {
    if (!container || !container.children.length) return;
    _applyHighlight(highlight, viewState, container);
  }

  function _applyHighlight(highlight, viewState, container) {
    const activeLineId   = highlight ? highlight.activeLineId : null;
    const activeTokenId  = highlight ? highlight.activeTokenId : null;
    const activeChordId  = highlight ? highlight.activeChordId : null;
    const doneLines      = (highlight && highlight.doneLines) ? highlight.doneLines : new Set();
    const hlColor        = (viewState || {}).highlightColor || '#FF2E93';
    const chordColor     = (viewState || {}).chordColor || '#e6aa28';
    const textColor      = (viewState || {}).textColor || '#E2E8F0';

    [...container.children].forEach(el => {
      if (!el.dataset.lineId) return;

      const isActiveLine = activeLineId && el.dataset.lineId === activeLineId;
      const lineIndex = +el.dataset.lineIndex;
      const isDone = Number.isFinite(lineIndex) && doneLines.has(lineIndex);

      if (isActiveLine) {
        el.style.color         = '#fff';
        el.style.fontWeight    = 'bold';
        el.style.textShadow    = '0 0 12px ' + hlColor + '80, 0 0 24px ' + hlColor + '30';
        el.style.background    = 'linear-gradient(90deg, ' + hlColor + '10, ' + hlColor + '05)';
        el.style.borderRight   = '3px solid ' + hlColor + '80';
        el.style.opacity       = '';
      } else if (isDone) {
        el.style.opacity       = '0.3';
        el.style.color         = '';
        el.style.fontWeight    = '';
        el.style.textShadow    = '';
        el.style.background    = '';
        el.style.borderRight   = '';
      } else {
        el.style.color         = textColor;
        el.style.opacity       = '';
        el.style.fontWeight    = '';
        el.style.textShadow    = '';
        el.style.background    = '';
        el.style.borderRight   = '';
      }

      // هایلایت توکن‌ها
      el.querySelectorAll('.perf-token').forEach(tokenEl => {
        const isActiveToken = activeTokenId && tokenEl.dataset.tokenId === activeTokenId;
        if (isActiveToken && isActiveLine) {
          tokenEl.style.background = hlColor + '25';
          tokenEl.style.borderRadius = '4px';
        } else {
          tokenEl.style.background = '';
          tokenEl.style.borderRadius = '';
        }
      });

      // هایلایت آکوردها
      el.querySelectorAll('.perf-chord').forEach(chordEl => {
        const isActiveChord = activeChordId && chordEl.dataset.chordId === activeChordId;
        if (isActiveChord && isActiveLine) {
          chordEl.style.color = '#fff';
          chordEl.style.textShadow = '0 0 10px ' + chordColor + ', 0 0 20px ' + chordColor + '80';
        } else if (isActiveLine) {
          chordEl.style.color = '';
          chordEl.style.textShadow = '0 0 6px ' + chordColor + '40';
        } else {
          chordEl.style.color = '';
          chordEl.style.textShadow = '';
        }
      });
    });

    // اسکرول فقط وقتی خط فعال عوض شده
    if (activeLineId && activeLineId !== _lastScrolledLineId) {
      _lastScrolledLineId = activeLineId;
      const activeEl = container.querySelector('[data-line-id="' + activeLineId + '"]');
      if (activeEl) {
        const boxH = container.clientHeight;
        const elTop = activeEl.offsetTop;
        const elH = activeEl.offsetHeight;
        container.scrollTo({
          top:      elTop - boxH / 2 + elH / 2,
          behavior: 'smooth'
        });
      }
    }
  }

  return { renderEmbeddedPerformanceView, updateEmbeddedHighlight };

})();

if (typeof window !== 'undefined') {
  window.EmbeddedPerformanceRenderer = EmbeddedPerformanceRenderer;
}
