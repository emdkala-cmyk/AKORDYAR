/**
 * Akordyar Laminor Extractor V6.2 Final
 *
 * ماژول تمیز استخراج آکورد از سایت Laminor
 * بدون وابستگی به Tampermonkey — فقط منطق اصلی استخراج
 *
 * نیازمند:
 *   .chord-text   — عنصر متن ترانه
 *   .chord-line   — عنصر خط آکوردها
 *   .c            — عنصر مربوط به هر آکورد
 *
 * نکته مهم:
 *   این الگوریتم برای دقت نیاز دارد که صفحه Laminor واقعاً در مرورگر/Electron
 *   رندر شده باشد. استفاده از HTML خام بدون رندر واقعی کافی نیست.
 */

(function (global) {
  'use strict';

  // ===============================
  // Constants
  // ===============================

  const ANY_CHORD_REGEX = /\[[^\]]+\]/g;
  const CHORD_AT_END_REGEX = /(\[[^\]]+\])\s*$/;
  const PERSIAN_LETTER_REGEX = /[آ-یءئؤإأۀةككيی]/;

  // ===============================
  // V5 Core
  // ===============================

  /**
   * حذف کاراکتر کشیده فارسی و trim
   * @param {string} rawText
   * @returns {string}
   */
  function cleanOutputText(rawText) {
    return String(rawText || '')
      .replace(/\u0640/g, '')
      .trim();
  }

  /**
   * جمع‌آوری همه TextNodeهای داخل یک عنصر
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
   * محاسبه آفست سراسری یک TextNode نسبت به container
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
   * محاسبه آفست کارت از مختصات X با استفاده از caretPositionFromPoint
   * روش اصلی — fallback فقط برای حالت‌های خاص
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
   * Fallback: نزدیک‌ترین آفست متنی به مختصات X
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
   * ساخت mapper بین اندیس متن خام و متن نهایی (بعد از حذف کشیده)
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

  /**
   * جمع‌آوری عناصر آکورد از یک chord-line
   * @param {Element} chordLineEl
   * @returns {Element[]}
   */
  function getChordElements(chordLineEl) {
    return Array.from(chordLineEl.querySelectorAll(':scope > .c'))
      .filter(c => c.textContent.trim());
  }

  /**
   * پیدا کردن عنصر متن بعدی بعد از یک chord-line
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

  /**
   * هسته استخراج V5
   * با استفاده از موقعیت بصری آکوردها روی صفحه، charIndex صحیح را در متن پیدا می‌کند
   * @param {Element} root — المنت #main-chord در صفحه Laminor
   * @returns {Array<{text: string, chords: Array<{symbol: string, charIndex: number}>}>}
   */
  function extractV5(root) {
    const children = Array.from(root.children);
    const processedTexts = new WeakSet();
    const result = [];

    children.forEach((el, index) => {
      if (!el.classList.contains('chord-line')) return;

      const chordEls = getChordElements(el);

      if (chordEls.length === 0) return;

      const textEl = findNextTextElement(children, index);

      if (!textEl) {
        result.push({
          text: '',
          chords: chordEls.map(chordEl => ({
            symbol: chordEl.textContent.trim(),
            charIndex: 0
          }))
        });

        return;
      }

      const rawText = textEl.textContent;
      const outputText = cleanOutputText(rawText);
      const rawToOutputIndex = buildRawToOutputIndexMapper(rawText);

      const chords = chordEls
        .map(chordEl => {
          const rect = chordEl.getBoundingClientRect();
          const chordCenterX = rect.left + rect.width / 2;

          const rawOffset = getCaretOffsetFromPoint(textEl, chordCenterX);
          const charIndex = rawToOutputIndex(rawOffset);

          return {
            symbol: chordEl.textContent.trim(),
            charIndex
          };
        })
        .filter(chord => chord.symbol)
        .sort((a, b) => a.charIndex - b.charIndex);

      result.push({
        text: outputText,
        chords
      });

      processedTexts.add(textEl);
    });

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

  // ===============================
  // Preview Line Builder
  // ===============================

  /**
   * ساخت رشته preview با آکوردهای داخل متن
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

  // ===============================
  // V6.2 Post Processor
  // ===============================

  /**
   * Post processor نهایی V7.1
   * @param {string} line
   * @returns {string}
   *
   * اصلاحات V7:
   *   - fixEndingChordToStart حذف شد — آکورد انتهای خط نباید به ابتدای خط منتقل شود
   *   - آکوردهای انتهای خط باید در همان جایگاه خود حفظ شوند
   *
   * اصلاحات V7.1:
   *   - fixSingleChordPosition اضافه شد — در خطوطی که فقط یک آکورد دارند،
   *     اگر آکورد در سمت راست (انتهای خط) بود به سمت چپ (ابتدای خط) منتقل می‌شود
   *     و اگر در سمت چپ (ابتدای خط) بود به سمت راست (انتهای خط) منتقل می‌شود
   *     (رفع تشخیص برعکس جایگاه آکورد تک‌بیتی)
   */
  function processV62Line(line) {
    let fixed = line;

    // V7: fixEndingChordToStart حذف شد — آکورد انتهای خط باید در جای خود بماند
    // V7.1: فقط برای خطوط تک‌آکوردی، جایگاه آکورد برعکس می‌شود
    fixed = fixSingleChordPosition(fixed);
    fixed = fixChordInsidePersianWord(fixed);
    fixed = normalizeSpaces(fixed);

    return fixed;
  }

  /**
   * V7.1: رفع تشخیص برعکس جایگاه آکورد در خطوط تک‌آکوردی
   * وقتی یک خط فقط یک آکورد دارد:
   *   - اگر آکورد در سمت راست (انتهای خط) است → به سمت چپ (ابتدای خط) منتقل می‌شود
   *   - اگر آکورد در سمت چپ (ابتدای خط) است → به سمت راست (انتهای خط) منتقل می‌شود
   * مثال: "غم میون دو تا چشمون قشنگت[Am]" → "[Am]غم میون دو تا چشمون قشنگت"
   * مثال: "[Am]غم میون دو تا چشمون قشنگت" → "غم میون دو تا چشمون قشنگت[Am]"
   * @param {string} line
   * @returns {string}
   */
  function fixSingleChordPosition(line) {
    if (typeof line !== 'string') return line;

    if (isOnlyChordLine(line)) return line;

    const matches = [...line.matchAll(ANY_CHORD_REGEX)];
    if (matches.length !== 1) return line;

    const match = matches[0];
    const chord = match[0];
    const chordIndex = match.index;

    if (chordIndex == null) return line;

    const before = line.slice(0, chordIndex);
    const after = line.slice(chordIndex + chord.length);

    const beforeText = before.trim();
    const afterText = after.trim();

    // آکورد در انتهای خط (سمت راست) → به ابتدای خط (سمت چپ) منتقل کن
    if (!afterText && beforeText) {
      return chord + beforeText;
    }

    // آکورد در ابتدای خط (سمت چپ) → به انتهای خط (سمت راست) منتقل کن
    if (!beforeText && afterText) {
      return afterText + chord;
    }

    // آکورد وسط خط — تغییری نده
    return line;
  }

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
   * V7: این تابع دیگر استفاده نمی‌شود.
   * آکورد انتهای خط باید در همان جایگاه خود حفظ شود، نه اینکه به ابتدای خط منتقل شود.
   * این تابع برای سازگاری با کدهای قدیمی نگه داشته شده اما در processV62Line استفاده نمی‌شود.
   * @param {string} line
   * @returns {string}
   */
  function fixEndingChordToStart(line) {
    // V7: آکورد انتهای خط را به ابتدای خط منتقل نکن — در جای خود بماند
    return line;
  }

  /**
   * پیدا کردن ابتدای کلمه فارسی در یک رشته
   * @param {string} str
   * @param {number} index
   * @returns {number}
   */
  function findPersianWordStart(str, index) {
    let start = index;

    while (start > 0) {
      const ch = str[start - 1];

      if (PERSIAN_LETTER_REGEX.test(ch)) {
        start--;
      } else {
        break;
      }
    }

    return start;
  }

  /**
   * اگر آکورد وسط حروف یک کلمه فارسی قرار گرفت، به ابتدای همان کلمه منتقل می‌شود
   * مثال: "لونه ک[Am]رده" → "لونه [Am]کرده"
   * مثال: "چش[G]مون" → "[G]چشمون"
   * فقط وقتی قبل و بعد آکورد حرف فارسی هستند این فیکس انجام می‌شود
   * @param {string} line
   * @returns {string}
   */
  function fixChordInsidePersianWord(line) {
    if (typeof line !== 'string') return line;

    if (isOnlyChordLine(line)) return line;

    let result = line;
    let safety = 0;

    while (safety++ < 100) {
      const matches = [...result.matchAll(ANY_CHORD_REGEX)];
      let changed = false;

      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const chord = match[0];
        const chordIndex = match.index;

        if (chordIndex == null) continue;

        const beforeChar = result[chordIndex - 1];
        const afterChar = result[chordIndex + chord.length];

        const beforeIsPersian =
          beforeChar && PERSIAN_LETTER_REGEX.test(beforeChar);

        const afterIsPersian =
          afterChar && PERSIAN_LETTER_REGEX.test(afterChar);

        if (beforeIsPersian && afterIsPersian) {
          const wordStart = findPersianWordStart(result, chordIndex);

          const withoutChord =
            result.slice(0, chordIndex) +
            result.slice(chordIndex + chord.length);

          result =
            withoutChord.slice(0, wordStart) +
            chord +
            withoutChord.slice(wordStart);

          changed = true;
          break;
        }
      }

      if (!changed) break;
    }

    return result;
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

  // ===============================
  // Main Entry Point
  // ===============================

  /**
   * استخراج نهایی آکورد از صفحه Laminor
   * @param {Element} root — المنت #main-chord در صفحه Laminor
   * @returns {{
   *   final: Array<{text: string, chords: Array<{symbol: string, charIndex: number}>}>,
   *   rawLines: string[],
   *   lines: string[]
   * }}
   */
  function extractLaminorAkordyarLines(root) {
    if (!root) {
      throw new Error(
        'root پیدا نشد. المنت #main-chord در صفحه Laminor را به extractLaminorAkordyarLines بدهید.'
      );
    }

    const final = extractV5(root);
    const rawLines = final.map(buildPreviewLine);
    const lines = rawLines.map(processV62Line);

    return {
      final,
      rawLines,
      lines
    };
  }

  // ===============================
  // Exports
  // ===============================

  const api = {
    extractLaminorAkordyarLines,
    // توابع کمکی برای تست و debug
    extractV5,
    buildPreviewLine,
    processV62Line,
    fixEndingChordToStart,
    fixSingleChordPosition,
    fixChordInsidePersianWord,
    normalizeSpaces,
    isOnlyChordLine,
    findPersianWordStart,
    cleanOutputText,
    getTextNodes,
    getGlobalTextOffset,
    isInside,
    getCaretOffsetFromPoint,
    fallbackNearestTextOffset,
    buildRawToOutputIndexMapper,
    getChordElements,
    findNextTextElement,
    // Regexها برای تست
    ANY_CHORD_REGEX,
    CHORD_AT_END_REGEX,
    PERSIAN_LETTER_REGEX
  };

  // در محیط مرورگر به window اضافه می‌شود
  if (typeof window !== 'undefined') {
    window.AkordyarLaminorExtractor = api;
  }

  // در محیط CommonJS/Node قابل استفاده است
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  // در محیط ES Module قابل استفاده است
  if (typeof globalThis !== 'undefined') {
    globalThis.AkordyarLaminorExtractor = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);