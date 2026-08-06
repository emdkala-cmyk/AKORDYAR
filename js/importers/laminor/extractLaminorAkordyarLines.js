/**
 * Akordyar Laminor Extractor — V5 Reference Port
 *
 * پورت عیناً از الگوریتم مرجع V5 که در Console مرورگر روی صفحهٔ واقعی Laminor
 * خروجی صحیح می‌دهد. هدف حفظ رفتار مرجع است؛ هیچ heuristic یا جابه‌جایی حدسی
 * آکورد اضافه نشده است.
 *
 * نیازمند:
 *   .chord-text   — عنصر متن ترانه
 *   .chord-line   — عنصر خط آکوردها
 *   .c            — عنصر مربوط به هر آکورد (فقط فرزند مستقیم)
 *
 * نکته مهم:
 *   این الگوریتم برای دقت نیاز دارد که صفحهٔ Laminor واقعاً در مرورگر/Electron
 *   رندر شده باشد. در Electron کد باید داخل همان صفحهٔ Laminor اجرا شود، نه روی
 *   DOM پنجرهٔ اصلی آکوردیار.
 *
 * قرارداد خروجی:
 *   final:
 *     Array<{
 *       text: string,
 *       chords: Array<{
 *         symbol: string,
 *         charIndex: number,
 *         source: { chordRect, chordCenterX, textRect, rawOffset }  // موقت برای دیباگ
 *       }>
 *     }>
 *   rawLines: string[]  — خط با آکوردهای [symbol] داخل متن
 *   lines: string[]     — خروجی نهایی (فقط normalize فاصله‌ها)
 */

'use strict';

/* ═══════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════ */

const ANY_CHORD_REGEX = /\[[^\]]+\]/g;
const CHORD_AT_END_REGEX = /(\[[^\]]+\])\s*$/;
const PERSIAN_LETTER_REGEX = /[آ-یءئؤإأۀةككيی]/;

/* ═══════════════════════════════════════════════
   Text / Node helpers
   ═══════════════════════════════════════════════ */

/**
 * حذف کاراکتر کشیدهٔ فارسی و trim — عیناً مانند مرجع V5
 * @param {string} rawText
 * @returns {string}
 */
function cleanOutputText(rawText) {
  return String(rawText || '')
    .replace(/\u0640/g, '')
    .trim();
}

/**
 * جمع‌آوری همهٔ TextNodeهای داخل یک عنصر
 * @param {Element} el
 * @returns {Text[]}
 */
function getTextNodes(el) {
  const nodes = [];
  const walker = document.createTreeWalker(
    el,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }

  return nodes;
}

/**
 * محاسبهٔ آفست سراسری یک TextNode نسبت به container — عیناً مانند مرجع V5
 * @param {Element} container
 * @param {Text} targetNode
 * @param {number} targetOffset
 * @returns {number}
 */
function getGlobalTextOffset(container, targetNode, targetOffset) {
  const textNodes = getTextNodes(container);
  let offset = 0;

  for (const node of textNodes) {
    if (node === targetNode) {
      return offset + targetOffset;
    }

    offset += node.nodeValue.length;
  }

  return 0;
}

/**
 * بررسی اینکه آیا node داخل parent است
 * @param {Element} parent
 * @param {Node} node
 * @returns {boolean}
 */
function isInside(parent, node) {
  if (!node) return false;
  return node === parent || parent.contains(node);
}

/**
 * محاسبهٔ آفست کارت از مختصات X — روش اصلی مرجع V5
 * با استفاده از caretPositionFromPoint یا caretRangeFromPoint روی مرکز عمودی متن
 * @param {Element} textEl
 * @param {number} x
 * @returns {number}
 */
function getCaretOffsetFromPoint(textEl, x) {
  const textRect = textEl.getBoundingClientRect();
  const y = textRect.top + textRect.height / 2;

  let node = null;
  let offset = 0;

  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);

    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);

    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }

  if (!node || !isInside(textEl, node)) {
    return fallbackNearestTextOffset(textEl, x);
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return getGlobalTextOffset(textEl, node, offset);
  }

  return fallbackNearestTextOffset(textEl, x);
}

/**
 * Fallback: نزدیک‌ترین آفست متنی به مختصات X — عیناً مانند مرجع V5
 * فقط برای حالت‌هایی که caretPositionFromPoint در دسترس نیست
 * @param {Element} textEl
 * @param {number} x
 * @returns {number}
 */
function fallbackNearestTextOffset(textEl, x) {
  const textNodes = getTextNodes(textEl);
  const points = [];

  let globalOffset = 0;

  for (const node of textNodes) {
    const value = node.nodeValue;

    for (let i = 0; i <= value.length; i++) {
      const range = document.createRange();

      try {
        range.setStart(node, i);
        range.setEnd(node, i);

        const rects = Array.from(range.getClientRects());
        const rect = rects[0];

        if (rect) {
          points.push({
            offset: globalOffset + i,
            x: rect.left
          });
        }
      } catch (e) {
        // ignore
      } finally {
        if (range.detach) range.detach();
      }
    }

    globalOffset += value.length;
  }

  if (!points.length) return 0;

  let best = points[0];
  let bestDistance = Math.abs(points[0].x - x);

  for (const point of points) {
    const distance = Math.abs(point.x - x);

    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }

  return best.offset;
}

/**
 * ساخت mapper بین اندیس متن خام و متن نهایی (بعد از حذف کشیده) — عیناً مرجع V5
 * @param {string} rawText
 * @returns {Function}
 */
function buildRawToOutputIndexMapper(rawText) {
  const leadingSpaces = rawText.match(/^\s*/)?.[0].length || 0;
  const trailingSpaces = rawText.match(/\s*$/)?.[0].length || 0;

  const rawStart = leadingSpaces;
  const rawEnd = rawText.length - trailingSpaces;

  return function rawToOutputIndex(rawOffset) {
    const clamped = Math.max(rawStart, Math.min(rawEnd, rawOffset));

    const before = rawText.slice(rawStart, clamped);
    const removedTatweelBefore = (before.match(/\u0640/g) || []).length;

    return Math.max(0, before.length - removedTatweelBefore);
  };
}

/* ═══════════════════════════════════════════════
   Chord / line helpers
   ═══════════════════════════════════════════════ */

/**
 * جمع‌آوری عناصر آکورد از یک chord-line — فقط span.c مستقیم
 * @param {Element} chordLineEl
 * @returns {Element[]}
 */
function getChordElements(chordLineEl) {
  return Array.from(chordLineEl.querySelectorAll(':scope > .c'))
    .filter(c => c.textContent.trim());
}

/**
 * پیدا کردن عنصر متن بعدی بعد از یک chord-line — عیناً مرجع V5
 *
 * از chord-line فعلی به عناصر بعدی نگاه می‌کند.
 * - اولین chord-text را متن متناظر قرار می‌دهد.
 * - اگر قبل از رسیدن به chord-text به chord-line دارای آکورد برسیم،
 *   این خط را خط فقط‌آکوردی در نظر می‌گیرد و به متن بعدی متصل نمی‌کند.
 *
 * @param {Element[]} children
 * @param {number} startIndex
 * @returns {Element|null}
 */
function findNextTextElement(children, startIndex) {
  for (let i = startIndex + 1; i < children.length; i++) {
    const el = children[i];

    if (el.classList.contains('chord-text')) {
      return el;
    }

    if (el.classList.contains('chord-line')) {
      const chords = getChordElements(el);

      if (chords.length > 0) {
        return null;
      }

      continue;
    }
  }

  return null;
}

/* ═══════════════════════════════════════════════
   هستهٔ استخراج V5 — پورت عیناً از مرجع
   ═══════════════════════════════════════════════ */

/**
 * هستهٔ استخراج V5 — عیناً مانند مرجع.
 *
 * با استفاده از موقعیت بصری آکوردها روی صفحه، charIndex صحیح را در متن پیدا می‌کند.
 * موقعیت فقط با getBoundingClientRect + مرکز افقی آکورد + caretPositionFromPoint
 * محاسبه می‌شود. ترتیب آکوردها فقط بر اساس charIndex است.
 *
 * @param {Element} root — المنت #main-chord در صفحهٔ Laminor
 * @returns {Array<{
 *   text: string,
 *   chords: Array<{
 *     symbol: string,
 *     charIndex: number,
 *     source: { chordRect, chordCenterX, textRect, rawOffset }
 *   }>
 * }>}
 */
function extractV5(root) {
  // فقط فرزندان مستقیم root بررسی می‌شوند
  const children = Array.from(root.children);
  const processedTexts = new WeakSet();
  const result = [];

  children.forEach((el, index) => {
    // فقط chord-line ها
    if (!el.classList.contains('chord-line')) return;

    // فقط span.c مستقیم داخل chord-line
    const chordEls = getChordElements(el);

    // chord-line خالی نادیده گرفته می‌شود
    if (chordEls.length === 0) return;

    // پیدا کردن chord-text متناظر
    const textEl = findNextTextElement(children, index);

    // اگر chord-text پیدا نشد → خط فقط‌آکوردی
    if (!textEl) {
      result.push({
        text: '',
        chords: chordEls.map(chordEl => ({
          symbol: chordEl.textContent.trim(),
          charIndex: 0,
          source: null
        }))
      });

      return;
    }

    const rawText = textEl.textContent;
    const outputText = cleanOutputText(rawText);
    const rawToOutputIndex = buildRawToOutputIndexMapper(rawText);

    const chords = chordEls
      .map(chordEl => {
        // موقعیت آکورد فقط از مختصات DOM محاسبه می‌شود
        const rect = chordEl.getBoundingClientRect();
        const chordCenterX = rect.left + rect.width / 2;

        // raw offset با caretPositionFromPoint/Range روی مرکز عمودی chord-text
        const rawOffset = getCaretOffsetFromPoint(textEl, chordCenterX);
        const charIndex = rawToOutputIndex(rawOffset);

        const textRect = textEl.getBoundingClientRect();

        return {
          symbol: chordEl.textContent.trim(),
          charIndex,
          source: {
            chordRect: {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height
            },
            chordCenterX,
            textRect: {
              left: textRect.left,
              top: textRect.top,
              width: textRect.width,
              height: textRect.height
            },
            rawOffset
          }
        };
      })
      // آکوردهای بدون symbol حذف می‌شوند
      .filter(chord => chord.symbol)
      // ترتیب فقط بر اساس charIndex — عیناً مرجع V5
      .sort((a, b) => a.charIndex - b.charIndex);

    result.push({
      text: outputText,
      chords
    });

    processedTexts.add(textEl);
  });

  // chord-textهایی که توسط chord-line پردازش نشده‌اند، بدون آکورد وارد خروجی می‌شوند
  children.forEach(el => {
    if (!el.classList.contains('chord-text')) return;
    if (processedTexts.has(el)) return;

    const text = cleanOutputText(el.textContent);

    if (!text) return;

    result.push({
      text,
      chords: []
    });
  });

  return result;
}

/* ═══════════════════════════════════════════════
   Preview Line Builder
   ═══════════════════════════════════════════════ */

/**
 * ساخت رشتهٔ preview با آکوردهای داخل متن
 * آکوردها از charIndex بزرگ‌تر به کوچک‌تر درج می‌شوند تا indexها جابه‌جا نشوند
 * @param {{text: string, chords: Array<{symbol: string, charIndex: number}>}} line
 * @returns {string}
 */
function buildPreviewLine(line) {
  let output = line.text || '';

  const chords = Array.isArray(line.chords)
    ? [...line.chords].sort((a, b) => b.charIndex - a.charIndex)
    : [];

  chords.forEach(chord => {
    const symbol = String(chord.symbol || '').trim();
    let idx = Number(chord.charIndex);

    if (!symbol) return;

    if (!Number.isFinite(idx)) idx = 0;
    idx = Math.max(0, Math.min(output.length, idx));

    output =
      output.slice(0, idx) +
      `[${symbol}]` +
      output.slice(idx);
  });

  return output;
}

/* ═══════════════════════════════════════════════
   Post Processor — فقط نرمال‌سازی فاصله. هیچ heuristic یا جابه‌جایی آکورد وجود ندارد.
   ═══════════════════════════════════════════════ */

/**
 * بررسی اینکه خط فقط شامل آکورد است
 * @param {string} line
 * @returns {boolean}
 */
function isOnlyChordLine(line) {
  if (typeof line !== 'string') return false;
  return line.replace(ANY_CHORD_REGEX, '').trim() === '';
}

/**
 * تمیز کردن فاصله‌های اضافه و trim
 * @param {string} line
 * @returns {string}
 */
function normalizeSpaces(line) {
  if (typeof line !== 'string') return line;

  return line
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * V5: فقط نرمال‌سازی فاصله‌ها.
 * هیچ آکوردی حدسی جابه‌جا نمی‌شود:
 *   - نه از ابتدای خط به انتهای خط
 *   - نه از انتهای خط به ابتدای خط
 *   - نه نزدیک به همسایه
 *   - نه مرتب‌سازی بر اساس فرض موسیقایی
 * @param {string} line
 * @returns {string}
 */
function processV5Line(line) {
  let fixed = line;
  fixed = normalizeSpaces(fixed);
  return fixed;
}

/* ═══════════════════════════════════════════════
   Main Entry Point
   ═══════════════════════════════════════════════ */

/**
 * استخراج نهایی آکورد از صفحهٔ Laminor — پورت عیناً از V5 مرجع
 *
 * @param {Element} root — المنت #main-chord در صفحهٔ Laminor
 * @returns {{
 *   final: Array<{
 *     text: string,
 *     chords: Array<{ symbol: string, charIndex: number, source: object }>
 *   }>,
 *   rawLines: string[],
 *   lines: string[]
 * }}
 */
function extractLaminorAkordyarLines(root) {
  if (!root) {
    throw new Error(
      'root پیدا نشد. المنت #main-chord در صفحهٔ Laminor را به extractLaminorAkordyarLines بدهید.'
    );
  }

  const final = extractV5(root);
  const rawLines = final.map(buildPreviewLine);
  const lines = rawLines.map(processV5Line);

  return {
    final,
    rawLines,
    lines
  };
}

/* ═══════════════════════════════════════════════
   API / Exports — مستقل از IIFE و console.log
   ═══════════════════════════════════════════════ */

const api = {
  extractLaminorAkordyarLines,
  extractV5,
  buildPreviewLine,
  processV5Line,
  isOnlyChordLine,
  normalizeSpaces,
  cleanOutputText,
  getTextNodes,
  getGlobalTextOffset,
  isInside,
  getCaretOffsetFromPoint,
  fallbackNearestTextOffset,
  buildRawToOutputIndexMapper,
  getChordElements,
  findNextTextElement,
  ANY_CHORD_REGEX,
  CHORD_AT_END_REGEX,
  PERSIAN_LETTER_REGEX
};

// در محیط مرورگر به globalThis اضافه می‌شود
if (typeof globalThis !== 'undefined') {
  globalThis.AkordyarLaminorExtractor = api;
}

// در محیط CommonJS/Node قابل استفاده است
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}