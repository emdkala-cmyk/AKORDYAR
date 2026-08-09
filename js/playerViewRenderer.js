/**
 * playerViewRenderer.js — رندرر نوازنده: متن + آکورد + هایلایت
 *
 * دو سطح API:
 *   renderPlayerView()  — بازسازی کامل DOM (فقط وقتی doc/viewState عوض شه)
 *   updatePlayerHighlight() — فقط آپدیت کلاس‌ها + اسکرول (هر فریم امن)
 */
const PlayerViewRenderer = (() => {

  let _lastScrolledLineId = null;

  /**
   * پیدا کردن موقعیت پیکسلی یک کاراکتر در یک خط متن
   */
  function getCharRect(lineEl, charIndex, anchorType) {
    if (!lineEl) return null;
    const segs = [];
    let total = 0;
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      segs.push({ node: node, start: total, len: node.textContent.length });
      total += node.textContent.length;
    }
    if (!segs.length) return null;

    const r = document.createRange();
    if (anchorType === 'LineStart') {
      const s = segs[0];
      r.setStart(s.node, 0);
      r.setEnd(s.node, Math.min(1, s.len));
    } else if (anchorType === 'LineEnd') {
      const s = segs[segs.length - 1];
      const p = Math.max(0, s.len - 1);
      r.setStart(s.node, p);
      r.setEnd(s.node, Math.min(p + 1, s.len));
    } else {
      const ci = Math.min(charIndex, Math.max(0, total - 1));
      let seg = null;
      for (let k = 0; k < segs.length; k++) {
        if (ci >= segs[k].start && ci < segs[k].start + segs[k].len) {
          seg = segs[k];
          break;
        }
      }
      if (!seg) seg = segs[segs.length - 1];
      const local = Math.max(0, ci - seg.start);
      r.setStart(seg.node, Math.min(local, seg.len));
      r.setEnd(seg.node, Math.min(local + 1, seg.len));
    }

    return r.getBoundingClientRect();
  }

  /* ═══════════════════════════════════════════════
     رندر اولیه / بازسازی کامل
     فقط وقتی صدا بزن:
       - متن/ساختار ترانه عوض شده
       - viewState (فونت، رنگ، zoom و...) عوض شده
       - اولین بار
     ═══════════════════════════════════════════════ */
  function renderPlayerView(doc, highlight, viewState, container) {
    if (!doc || !container) return;
    container.innerHTML = '';
    _lastScrolledLineId = null;

    const vs = viewState || {};
    const hlColor      = vs.highlightColor || '#FF2E93';
    const chordColor   = vs.chordColor || '#00F2FE';
    const textColor    = vs.textColor || '#E2E8F0';
    const showChords   = vs.showChords !== false;
    const fontFamily   = (vs.fontFamily || 'Vazirmatn') + ', sans-serif';
    const fontSize     = vs.fontSize || 24;
    const cSize        = Math.round(fontSize * 0.7);
    const cFont        = '"JetBrains Mono", monospace';

    // Container styles
    container.style.fontFamily      = fontFamily;
    container.style.fontSize        = fontSize + 'px';
    container.style.lineHeight      = String(vs.lineHeight || 2.0);
    container.style.color           = textColor;
    container.style.backgroundColor = vs.backgroundColor || '#0F131E';
    container.style.textAlign       = 'center';
    container.style.padding         = '20px 40px';
    container.style.overflowY       = 'auto';
    container.style.height          = '100%';
    container.style.position        = 'relative';
    if (vs.scale && vs.scale !== 1) {
      container.style.transform       = 'scale(' + vs.scale + ')';
      container.style.transformOrigin = 'center top';
    }

    // ═══ خطوط کوانتایز (Grid Lines) ═══
    // خطوط عمودی که موقعیت ضرب‌ها و میزان‌ها را نشان می‌دهند
    _renderQuantizeGrid(container, vs);

    // Render lines (بدون هایلایت اولیه — فقط ساختار)
    (doc.lines || []).forEach(line => {
      const lineEl = document.createElement('div');
      lineEl.dataset.lineId = line.id;
      lineEl.dataset.lineIndex = line.index;
      lineEl.style.minHeight    = '1.4em';
      lineEl.style.whiteSpace   = 'pre-wrap';
      lineEl.style.lineHeight   = '2.6';
      lineEl.style.padding      = '4px 12px';
      lineEl.style.borderRadius = '8px';
      lineEl.style.transition   = 'opacity 0.25s ease, color 0.25s ease, background 0.25s ease, text-shadow 0.25s ease';
      lineEl.style.position     = 'relative';
      lineEl.style.marginTop    = '1.8em';
      lineEl.style.color        = textColor;

      // Lyric text
      lineEl.textContent = line.text || '\u200B';

      container.appendChild(lineEl);
    });

    // Position chords using Range + container-relative coords
    if (showChords) {
      const GAP = Math.max(10, cSize * 0.6);
      const containerRect = container.getBoundingClientRect();

      (doc.lines || []).forEach(line => {
        if (!line.chords || !line.chords.length) return;

        const lineEl = container.querySelector('[data-line-id="' + line.id + '"]');
        if (!lineEl) return;

        line.chords.forEach(ch => {
          if (!ch.name) return;

          const rect = getCharRect(lineEl, ch.charIndex || 0, ch.anchorType || 'CharIndex');
          if (!rect) return;

          const el = document.createElement('span');
          el.className = 'pv-chord';
          el.dataset.chordId = ch.id;
          el.textContent = ch.name;
          el.style.position      = 'absolute';
          el.style.pointerEvents = 'none';
          el.style.fontWeight    = 'bold';
          el.style.color         = chordColor;
          el.style.fontFamily    = cFont;
          el.style.fontSize      = cSize + 'px';
          el.style.lineHeight    = '1.15';
          el.style.whiteSpace    = 'nowrap';
          el.style.zIndex        = '5';
          el.style.direction     = 'ltr';
          el.style.opacity       = '0';

          container.appendChild(el);
          const elW = el.offsetWidth;

          // ═══ مختصات نسبت به container (نه viewport) ═══
          const xViewport = (rect.left + rect.right) / 2;
          const xContainer = xViewport - containerRect.left;
          const yViewport = rect.top;
          const yContainer = yViewport - containerRect.top;

          el.style.top    = (yContainer + lineEl.offsetTop - cSize - GAP) + 'px';
          el.style.left   = (xContainer - elW / 2) + 'px';
          el.style.opacity = '1';
        });
      });
    }

    // اعمال هایلایت اولیه
    _applyHighlight(highlight, viewState, container);
  }

  /* ═══════════════════════════════════════════════
     خطوط کوانتایز (Grid Lines)
     — خطوط عمودی برای نمایش ضرب‌ها و میزان‌ها
     ═══════════════════════════════════════════════ */
  function _renderQuantizeGrid(container, vs) {
    // حذف grid قبلی
    const oldGrid = container.querySelector('.pv-quantize-grid');
    if (oldGrid) oldGrid.remove();

    const showGrid = vs.showQuantizeGrid !== false;
    if (!showGrid) return;

    const bpm = vs.tempo || 120;
    const timeSig = vs.timeSignature || '4/4';
    const _parts = timeSig.split('/');
    const beatsPerBar = parseInt(_parts[0]) || 4;
    const denominator = parseInt(_parts[1]) || 4;
    const beatDur = (60 / bpm) * (4 / denominator);
    const barDur = beatDur * beatsPerBar;

    // Grid container
    const grid = document.createElement('div');
    grid.className = 'pv-quantize-grid';
    grid.style.cssText = 'position:absolute;top:0;bottom:0;left:0;right:0;pointer-events:none;z-index:1;';

    // خطوط میزان (Bar lines) — پررنگ‌تر
    for (let t = 0; t <= 300; t += barDur) {
      const line = document.createElement('div');
      line.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;background:rgba(63,184,175,0.15);';
      line.style.left = (t / 300 * 100) + '%';
      grid.appendChild(line);
    }

    // خطوط ضرب (Beat lines) — کمرنگ‌تر
    for (let t = 0; t <= 300; t += beatDur) {
      const isBar = Math.abs(t % barDur) < 0.001;
      if (isBar) continue;
      const line = document.createElement('div');
      line.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.05);';
      line.style.left = (t / 300 * 100) + '%';
      grid.appendChild(line);
    }

    container.appendChild(grid);
  }

  /* ═══════════════════════════════════════════════
     آپدیت هایلایت (اینکرمنتال)
     — فقط کلاس‌ها و inline style خطوط را عوض کن
     — هیچ DOM جدیدی نساز
     — امن برای هر فریم
     ═══════════════════════════════════════════════ */
  function updatePlayerHighlight(highlight, viewState, container) {
    if (!container || !container.children.length) return;
    _applyHighlight(highlight, viewState, container);
  }

  /* ═══════════════════════════════════════════════
     هسته مشترک: اعمال هایلایت روی DOM موجود
     ═══════════════════════════════════════════════ */
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
        el.style.color      = '#fff';
        el.style.textShadow = '0 0 10px ' + hlColor + '60';
        el.style.background = hlColor + '12';
        el.style.zIndex     = '10';
        el.style.opacity    = '';
      } else if (isDone) {
        el.style.opacity    = '0.35';
        el.style.color      = '';
        el.style.textShadow = '';
        el.style.background = '';
        el.style.zIndex     = '';
      } else {
        el.style.color      = textColor;
        el.style.opacity    = '';
        el.style.textShadow = '';
        el.style.background = '';
        el.style.zIndex     = '';
      }
    });

    // ═══ اسکرول فقط وقتی خط فعال عوض شده ═══
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

  return { renderPlayerView, updatePlayerHighlight };

})();

if (typeof window !== 'undefined') {
  window.PlayerViewRenderer = PlayerViewRenderer;
}
