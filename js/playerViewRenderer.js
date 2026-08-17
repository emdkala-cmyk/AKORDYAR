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

  function normalizeAnchorType(anchorType, charIndex, textLength) {
    const raw = String(anchorType || '').trim().toLowerCase();
    const numericIndex = Number(charIndex);

    if (raw === 'linestart' || raw === 'line-start' || raw === 'start' || raw === 'begin') {
      return 'LineStart';
    }
    if (raw === 'lineend' || raw === 'line-end' || raw === 'end' || raw === 'finish') {
      return 'LineEnd';
    }
    if (raw === 'betweencharacters' || raw === 'between-characters' || raw === 'between') {
      return 'BetweenCharacters';
    }
    if (!raw || raw === 'mid' || raw === 'middle' || raw === 'charindex') {
      if (textLength === 0 || numericIndex === 0) return 'LineStart';
      if (Number.isFinite(numericIndex) && numericIndex >= textLength) return 'LineEnd';
    }
    return 'OnCharacter';
  }

  function resolveChordCharIndex(line, chord, anchorType) {
    const textLength = (line && line.text ? line.text : '').length;
    if (anchorType === 'LineStart') return 0;
    if (anchorType === 'LineEnd') return textLength;
    if (!textLength) return 0;

    const rawIndex = Number(chord && chord.charIndex);
    if (Number.isFinite(rawIndex)) {
      const maxIndex = anchorType === 'BetweenCharacters'
        ? textLength
        : Math.max(0, textLength - 1);
      return Math.max(0, Math.min(Math.trunc(rawIndex), maxIndex));
    }

    const tokenIndex = Number(chord && chord.tokenIndex);
    const token = Array.isArray(line.tokens)
      ? line.tokens.find(item => Number(item.index) === tokenIndex)
      : null;
    if (token && Number.isFinite(Number(token.charStart))) {
      return Math.max(0, Math.min(
        Math.trunc(Number(token.charStart)),
        Math.max(0, textLength - 1)
      ));
    }
    return 0;
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
    const backgroundColor = vs.backgroundColor || '#0F131E';
    const cSize        = Math.round(fontSize * (vs.mobileLayout ? 0.82 : 0.7));
    const cFont        = '"JetBrains Mono", monospace';
    const isMobileLayout = vs.mobileLayout === true;
    // Chords are absolutely positioned above the text line.  On narrow
    // screens a lyric line can wrap to two visual rows, so the chord zone
    // must be reserved from the line layout instead of relying on the
    // character's wrapped Range y-position.
    const chordGap = Math.max(10, cSize * 0.6);
    const chordZone = chordGap + cSize;
    const mobileChordZone = isMobileLayout && showChords ? chordZone : 0;
    const mobileLineMargin = isMobileLayout && mobileChordZone > 0
      ? Math.max(2.8, 1.4 + (chordZone / Math.max(1, fontSize)))
      : 1.8;
    // A wrapped mobile lyric row needs enough baseline distance for the
    // chord band above the following visual row.  This keeps Range-based
    // chord ordering/anchors intact without letting a second-row chord
    // collide with the first row's text.
    const baseLineHeight = Number(vs.lineHeight) || 2.0;
    const lineHeight = isMobileLayout && mobileChordZone > 0
      ? Math.max(baseLineHeight, 1.35 + (chordZone / Math.max(1, fontSize)))
      : baseLineHeight;
    const highlightEffect =
      vs.highlightEffect || doc.styles?.highlightEffect || 'depth';
    container.dataset.highlightEffect = highlightEffect;
    container.dataset.mobileLayout = isMobileLayout ? 'true' : 'false';

    // Container styles
    container.style.fontFamily      = fontFamily;
    container.style.fontSize        = fontSize + 'px';
    container.style.lineHeight      = String(lineHeight);
    container.style.color           = textColor;
    container.style.backgroundColor = backgroundColor;
    container.style.direction       = 'rtl';
    container.style.textAlign       = 'center';
    container.style.padding         = isMobileLayout
      ? '76px 24px 104px'
      : '20px 40px';
    container.style.overflowY       = 'auto';
    container.style.height          = '100%';
    container.style.position        = 'relative';
    if (isMobileLayout) {
      container.style.paddingBottom = '108px';
    }
    if (vs.scale && vs.scale !== 1) {
      container.style.transform       = 'scale(' + vs.scale + ')';
      container.style.transformOrigin = 'center top';
    } else {
      container.style.transform       = 'none';
      container.style.transformOrigin = '';
    }

    // Keep the whole scroll surface on one color. Otherwise the body can
    // show through after the first viewport on mobile.
    const ownerDocument = container.ownerDocument;
    if (ownerDocument) {
      if (ownerDocument.documentElement) {
        ownerDocument.documentElement.style.setProperty(
          'background-color',
          backgroundColor,
          'important'
        );
      }
      if (ownerDocument.body) {
        ownerDocument.body.style.setProperty(
          'background-color',
          backgroundColor,
          'important'
        );
      }
      container.style.setProperty(
        'background-color',
        backgroundColor,
        'important'
      );
    }

    // ═══ خطوط کوانتایز (Grid Lines) ═══
    // خطوط عمودی که موقعیت ضرب‌ها و میزان‌ها را نشان می‌دهند
    _renderQuantizeGrid(container, vs);

    const header = document.createElement('header');
    header.className = 'pv-song-header';
    header.style.position = 'relative';
    header.style.zIndex = '12';
    header.style.textAlign = 'center';
    header.style.padding = isMobileLayout ? '8px 8px 14px' : '8px 8px 12px';
    header.style.marginBottom = isMobileLayout ? '6px' : '4px';
    header.style.borderBottom = '1px solid rgba(35,43,62,0.9)';
    header.style.background = 'linear-gradient(180deg, #1C2333, #161B26)';
    header.style.borderRadius = '10px';
    header.style.boxShadow = '0 4px 18px rgba(0,0,0,0.22)';

    const titleEl = document.createElement('div');
    titleEl.className = 'pv-song-title';
    titleEl.textContent = doc.title || 'بدون عنوان';
    titleEl.style.fontSize = isMobileLayout ? '17px' : '20px';
    titleEl.style.fontWeight = '900';
    titleEl.style.color = '#00F2FE';
    titleEl.style.textShadow = '0 0 16px rgba(0,242,254,0.25)';
    header.appendChild(titleEl);

    if (doc.artist) {
      const artistEl = document.createElement('div');
      artistEl.className = 'pv-song-artist';
      artistEl.textContent = doc.artist;
      artistEl.style.fontSize = '12px';
      artistEl.style.color = '#718096';
      artistEl.style.marginTop = '3px';
      header.appendChild(artistEl);
    }
    container.appendChild(header);

    // Render lines (بدون هایلایت اولیه — فقط ساختار)
    (doc.lines || []).forEach(line => {
      const lineEl = document.createElement('div');
      lineEl.className = 'pv-line';
      lineEl.dataset.lineId = line.id;
      lineEl.dataset.lineIndex = line.index;
      lineEl.style.minHeight    = '1.4em';
      lineEl.style.whiteSpace   = 'pre-wrap';
      lineEl.style.lineHeight   = String(lineHeight);
      lineEl.style.padding      = '4px 12px';
      lineEl.style.borderRadius = '8px';
      lineEl.style.transition   = 'opacity 0.25s ease, color 0.25s ease, background 0.25s ease, text-shadow 0.25s ease';
      lineEl.style.position     = 'relative';
      lineEl.style.marginTop    = mobileLineMargin + 'em';
      lineEl.style.color        = textColor;

      lineEl.textContent = line.text || '\u200B';

      container.appendChild(lineEl);
    });

    // The mobile highlight frame is independent from chord visibility.
    // Hiding chords must never remove the active-line highlight.
    if (isMobileLayout) {
      container.dataset.highlightChordZone = String(mobileChordZone);
      (doc.lines || []).forEach(line => {
        const lineEl = container.querySelector(
          '.pv-line[data-line-id="' + line.id + '"]'
        );
        if (!lineEl) return;
        const frame = document.createElement('div');
        frame.className = 'pv-line-highlight-frame';
        frame.dataset.highlightLineId = line.id;
        frame.style.position = 'absolute';
        frame.style.display = 'none';
        frame.style.pointerEvents = 'none';
        frame.style.zIndex = '8';
        frame.style.boxSizing = 'border-box';
        frame.style.borderRadius = '8px';
        container.appendChild(frame);
      });
    }

    // Position chords using the exact text Range that the desktop Player View
    // uses. Build the elements first, then position them again after the
    // mobile font has finished loading.
    if (showChords) {
      const GAP = chordGap;
      const MARGIN = 5;
      const chordElements = [];

      (doc.lines || []).forEach(line => {
        if (!line.chords || !line.chords.length) return;

        const lineEl = container.querySelector('[data-line-id="' + line.id + '"]');
        if (!lineEl) return;

        line.chords.forEach(ch => {
          if (!ch.name) return;

          const anchorType = normalizeAnchorType(
            ch.anchorType,
            ch.charIndex,
            (line.text || '').length
          );
          const el = document.createElement('span');
          el.className = 'pv-chord';
          el.dataset.chordId = ch.id;
          el.dataset.lineId = line.id;
          el.dataset.lineIndex = line.index;
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

          const connector = document.createElement('div');
          connector.className = 'pv-chord-line';
          connector.dataset.chordLineId = ch.id;
          connector.dataset.lineId = line.id;
          connector.dataset.lineIndex = line.index;
          connector.style.position = 'absolute';
          connector.style.width = '2px';
          connector.style.pointerEvents = 'none';
          connector.style.opacity = '0.5';
          connector.style.background = chordColor;
          connector.style.zIndex = '4';
          connector.style.visibility = 'hidden';

          container.appendChild(el);
          container.appendChild(connector);
          chordElements.push({
            el,
            connector,
            line,
            lineEl,
            chord: ch,
            anchorType
          });
        });
      });

      const positionChords = () => {
        const containerRect = container.getBoundingClientRect();
        const isRTLContainer =
          (getComputedStyle(container).direction || 'rtl') === 'rtl';

        chordElements.forEach(({ el, connector, line, lineEl, chord, anchorType }) => {
          const charIndex = resolveChordCharIndex(line, chord, anchorType);
          const rect = getCharRect(lineEl, charIndex, anchorType);
          if (!rect) return;

          const isRTL =
            (getComputedStyle(lineEl).direction || (isRTLContainer ? 'rtl' : 'ltr')) === 'rtl';
          let xViewport;
          if (anchorType === 'LineStart') {
            xViewport = isRTL ? rect.right + MARGIN : rect.left - MARGIN;
          } else if (anchorType === 'LineEnd') {
            xViewport = isRTL ? rect.left - MARGIN : rect.right + MARGIN;
          } else if (anchorType === 'BetweenCharacters') {
            xViewport = rect.right;
          } else {
            xViewport = (rect.left + rect.right) / 2;
          }

          const xContainer = xViewport - containerRect.left + container.scrollLeft;
          const yContainer = rect.top - containerRect.top + container.scrollTop;
          // Keep the Range's visual-row y-coordinate.  Mobile line-height
          // above reserves a chord band between wrapped rows, so chords keep
          // their true anchor/order instead of collapsing into one row.
          const chordLineTop = yContainer;
          const chordTop = chordLineTop - cSize - GAP;
          const connectorTop = chordLineTop - GAP;

          el.style.top = chordTop + 'px';
          el.style.left = (xContainer - el.offsetWidth / 2) + 'px';
          el.style.opacity = '1';
          connector.style.left = xContainer + 'px';
          connector.style.top = connectorTop + 'px';
          connector.style.height = Math.max(4, GAP) + 'px';
          connector.style.visibility = 'visible';
        });
      };

      positionChords();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready
          .then(positionChords)
          .catch(() => {});
      }
      const raf = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback => setTimeout(callback, 0));
      raf(() => raf(positionChords));
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
    const meter = globalThis.Meter.getMeterConfig(timeSig, bpm);
    const beatsPerBar = meter.beatsPerMeasure;
    const beatDur = meter.beatDuration;
    const barDur = meter.measureDuration;

    // Grid container
    const grid = document.createElement('div');
    grid.className = 'pv-quantize-grid';
    grid.style.cssText = 'position:absolute;top:0;bottom:0;left:0;right:0;pointer-events:none;z-index:1;';

    // خطوط میزان (Bar lines) — پررنگ‌تر
    const barCount = Math.floor(300 / barDur);
    for (let bar = 0; bar <= barCount; bar += 1) {
      const t = globalThis.Meter.beatIndexToTime(
        bar * beatsPerBar,
        meter
      );
      const line = document.createElement('div');
      line.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;background:rgba(63,184,175,0.15);';
      line.style.left = (t / 300 * 100) + '%';
      grid.appendChild(line);
    }

    // خطوط ضرب (Beat lines) — کمرنگ‌تر
    const beatCount = Math.floor(300 / beatDur);
    for (let beat = 0; beat <= beatCount; beat += 1) {
      if (beat % beatsPerBar === 0) continue;
      const t = globalThis.Meter.beatIndexToTime(beat, meter);
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
    const chordColor   = (viewState || {}).chordColor || '#00F2FE';
    const isMobileLayout = container.dataset.mobileLayout === 'true';
    const highlightEffect =
      (viewState || {}).highlightEffect ||
      container.dataset.highlightEffect ||
      'depth';

    const mobileHighlightFrames = container.querySelectorAll(
      '.pv-line-highlight-frame'
    );
    mobileHighlightFrames.forEach(frame => {
      const lineId = frame.dataset.highlightLineId;
      const lineEl = container.querySelector(
        '.pv-line[data-line-id="' + lineId + '"]'
      );
      const isActive = !!activeLineId && activeLineId === lineId;
      if (!lineEl || !isActive) {
        frame.style.display = 'none';
        return;
      }

      const zone = Math.max(
        0,
        Number(container.dataset.highlightChordZone) || 0
      );
      const effect = highlightEffect;
      const isNeon = effect === 'neon';
      const isFrost = effect === 'frost';
      const isShift = effect === 'shift';
      const isPulse = effect === 'pulse';
      const isDepth = !isNeon && !isFrost && !isShift && !isPulse;

      frame.style.display = 'block';
      frame.style.left = lineEl.offsetLeft + 'px';
      frame.style.top = Math.max(0, lineEl.offsetTop - zone) + 'px';
      frame.style.width = lineEl.offsetWidth + 'px';
      frame.style.height = (lineEl.offsetHeight + zone) + 'px';
      frame.style.background = isNeon
        ? 'linear-gradient(180deg, rgba(0,242,254,0.2), rgba(0,242,254,0.04) 55%, transparent)'
        : isFrost
          ? 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(200,220,255,0.08))'
          : isShift
            ? 'linear-gradient(135deg, rgba(255,46,147,0.15), rgba(123,47,255,0.15), rgba(0,242,254,0.15))'
            : isPulse
              ? 'linear-gradient(180deg, rgba(34,211,100,0.12), rgba(34,211,100,0.02) 55%, transparent)'
              : 'linear-gradient(180deg, rgba(255,46,147,0.15), rgba(255,46,147,0.02) 60%, transparent)';
      frame.style.border = isDepth
        ? '1px solid rgba(255,46,147,0.2)'
        : isNeon
          ? '1px solid rgba(0,242,254,0.3)'
          : isFrost
            ? '1px solid rgba(255,255,255,0.15)'
            : isPulse
              ? '1px solid rgba(34,211,100,0.25)'
              : '1px solid transparent';
      frame.style.borderRadius = isFrost ? '12px' : '8px';
      frame.style.boxShadow = isNeon
        ? '0 0 15px rgba(0,242,254,0.3), 0 0 30px rgba(0,242,254,0.1)'
        : isFrost
          ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 16px rgba(0,0,0,0.3)'
          : isPulse
            ? '0 0 20px rgba(34,211,100,0.6), inset 0 0 20px rgba(34,211,100,0.1)'
            : isDepth
              ? '0 6px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(255,46,147,0.2)'
              : '';
    });

    [...container.children].forEach(el => {
      if (!el.dataset.lineId) return;

      const lineIndex = +el.dataset.lineIndex;
      const isDone = Number.isFinite(lineIndex) && doneLines.has(lineIndex);
      const isChord = el.classList.contains('pv-chord');
      const isConnector = el.classList.contains('pv-chord-line');
      const lineActive = activeLineId && el.dataset.lineId === activeLineId;

      el.classList.toggle('pv-active', !!lineActive);
      el.classList.toggle('pv-done', !!isDone);
      el.classList.toggle('pv-hl-' + highlightEffect, !!lineActive);

      if (isConnector) {
        // Player View keeps the chord palette while the active row is
        // highlighted.  Do the same on mobile; turning the connector white
        // made the whole active chord look like a second text highlight.
        el.style.background = lineActive && !isMobileLayout
          ? '#fff'
          : chordColor;
        el.style.opacity = lineActive ? '0.95' : (isDone ? '0.25' : '0.5');
        el.style.zIndex = lineActive ? '11' : '4';
        return;
      }

      if (lineActive) {
        const effect = highlightEffect;
        const isNeon = effect === 'neon';
        const isFrost = effect === 'frost';
        const isShift = effect === 'shift';
        const isPulse = effect === 'pulse';
        const isDepth = !isNeon && !isFrost && !isShift && !isPulse;

        if (isMobileLayout) {
          // Mobile uses the same visual contract as the Player View:
          // highlight the row/frame, but preserve the configured lyric and
          // chord colors.  In particular, do not force either element to
          // white when the active line changes.
          el.style.color = isChord ? chordColor : textColor;
          el.style.textShadow = isChord
            ? '0 1px 0 rgba(0,0,0,0.75), 0 0 10px rgba(230,170,40,0.22)'
            : '0 1px 0 rgba(0,0,0,0.8), 0 2px 0 rgba(0,0,0,0.7), 0 4px 8px rgba(0,0,0,0.5)';
        } else {
          el.style.color = isChord
            ? (isShift ? '#00F2FE' : '#fff')
            : (isNeon ? '#00F2FE' : isPulse ? '#22D364' : '#E2E8F0');
          el.style.textShadow = isNeon
            ? '0 0 8px rgba(0,242,254,0.8), 0 0 20px rgba(0,242,254,0.4)'
            : isFrost
              ? '0 0 12px rgba(255,255,255,0.45)'
              : isShift
                ? '0 0 12px rgba(255,46,147,0.55), 0 0 24px rgba(0,242,254,0.35)'
                : isPulse
                  ? '0 0 12px rgba(34,211,100,0.8), 0 0 28px rgba(34,211,100,0.35)'
                  : '0 1px 0 rgba(0,0,0,0.8), 0 2px 0 rgba(0,0,0,0.7), 0 4px 8px rgba(0,0,0,0.5), 0 0 15px rgba(255,46,147,0.3)';
        }
        if (!isChord) {
          el.style.background = isNeon
            ? 'linear-gradient(180deg, rgba(0,242,254,0.2), rgba(0,242,254,0.04) 55%, transparent)'
            : isFrost
              ? 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(200,220,255,0.08))'
              : isShift
                ? 'linear-gradient(135deg, rgba(255,46,147,0.15), rgba(123,47,255,0.15), rgba(0,242,254,0.15))'
                : isPulse
                  ? 'linear-gradient(180deg, rgba(34,211,100,0.12), rgba(34,211,100,0.02) 55%, transparent)'
              : 'linear-gradient(180deg, rgba(255,46,147,0.15), rgba(255,46,147,0.02) 60%, transparent)';
          if (
            container.dataset.mobileLayout === 'true' &&
            el.classList.contains('pv-line')
          ) {
            el.style.background = 'transparent';
          }
          el.style.border = isDepth
            ? '1px solid rgba(255,46,147,0.2)'
            : isNeon
              ? '1px solid rgba(0,242,254,0.3)'
              : isFrost
                ? '1px solid rgba(255,255,255,0.15)'
                : isPulse
                  ? '1px solid rgba(34,211,100,0.25)'
              : '1px solid transparent';
          if (
            container.dataset.mobileLayout === 'true' &&
            el.classList.contains('pv-line')
          ) {
            el.style.border = '1px solid transparent';
            el.style.boxShadow = 'none';
          }
          el.style.borderRadius = isFrost ? '12px' : '8px';
          el.style.boxShadow = isNeon
            ? '0 0 15px rgba(0,242,254,0.3), 0 0 30px rgba(0,242,254,0.1)'
            : isFrost
              ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 16px rgba(0,0,0,0.3)'
              : isPulse
                ? '0 0 20px rgba(34,211,100,0.6), inset 0 0 20px rgba(34,211,100,0.1)'
                : isDepth
                  ? '0 6px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(255,46,147,0.2)'
                  : '';
          if (
            container.dataset.mobileLayout === 'true' &&
            el.classList.contains('pv-line')
          ) {
            el.style.background = 'transparent';
            el.style.border = '1px solid transparent';
            el.style.boxShadow = 'none';
          }
        }
        el.style.zIndex     = isChord ? '11' : '10';
        el.style.opacity    = '';
      } else if (isDone) {
        el.style.opacity    = '0.35';
        if (isChord) el.style.color = chordColor;
        else el.style.color = '';
        el.style.textShadow = '';
        if (!isChord) el.style.background = '';
        if (!isChord) {
          el.style.border = '';
          el.style.borderRadius = '';
          el.style.boxShadow = '';
        }
        el.style.zIndex     = '';
      } else {
        if (isChord) el.style.color = chordColor;
        else el.style.color = textColor;
        el.style.opacity    = '';
        el.style.textShadow = '';
        if (!isChord) el.style.background = '';
        if (!isChord) {
          el.style.border = '';
          el.style.borderRadius = '';
          el.style.boxShadow = '';
        }
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
