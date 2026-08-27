/**
 * LyricPositionMapper — نگاشت موقعیت کاراکتر در متن ترانه
 *
 * Pure functions only — بدون وابستگی به DOM، Song Runtime یا DAW.
 * استخراج‌شده از runtime ادیتور در Commit 1 برنامهٔ Editor Domain Extraction.
 *
 * مسئولیت‌ها:
 * - تبدیل (lineIndex, charIndex) ↔ offset مطلق
 * - remap لنگرهای آکورد/seqPoint بعد از ویرایش متن
 *   (منطق قبلاً دونسخه و یکسان داخل edRemapSeqPoints و edRemapAnchors بود)
 * - نگاشت ستون آکوردها به ایندکس حروف متن با پشتیبانی RTL/LTR
 *
 * نکته: hasPersian و expandTabsForVisualColumns کپی خصوصی این ماژول‌اند تا
 * ماژول self-contained بماند؛ call-siteهای runtime از همین سرویس استفاده می‌کنند.
 */
const LyricPositionMapper = (() => {

  function expandTabsForVisualColumns(line, tabSize) {
    tabSize = tabSize || 4;
    let result = '';
    let col = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '\t') {
        const spaces = tabSize - (col % tabSize);
        for (let s = 0; s < spaces; s++) result += ' ';
        col += spaces;
      } else {
        result += line[i];
        col++;
      }
    }
    return result;
  }

  function hasPersian(s) {
    return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(s);
  }

  /**
   * تبدیل (lineIndex, charIndex) به offset مطلق در متن.
   */
  function lineCharToAbs(text, li, ci) {
    const lines = text.split('\n');
    let abs = 0;
    for (let i = 0; i < li && i < lines.length; i++) abs += lines[i].length + 1;
    return abs + Math.min(ci, (lines[li] || '').length);
  }

  /**
   * تبدیل offset مطلق به (lineIndex, charIndex).
   */
  function absToLineChar(text, abs) {
    const lines = text.split('\n');
    let pos = abs;
    for (let i = 0; i < lines.length; i++) {
      if (pos <= lines[i].length) return { lineIndex: i, charIndex: pos };
      pos -= lines[i].length + 1;
    }
    return {
      lineIndex: lines.length - 1,
      charIndex: (lines[lines.length - 1] || '').length
    };
  }

  /**
   * remap یک لنگر (آکورد یا seqPoint) از متن قدیمی به متن جدید.
   * item به‌صورت in-place به‌روز می‌شود (همان قرارداد قبلی runtime).
   *
   * @param {object} item - دارای lineIndex، charIndex و anchorType
   * @param {string} oldText
   * @param {string} newText
   */
  function remapAnchorToNewText(item, oldText, newText) {
    if (item.anchorType === 'LineStart') {
      const nl = newText.split('\n');
      item.lineIndex = Math.min(item.lineIndex, nl.length - 1);
      item.charIndex = 0;
      return;
    }
    if (item.anchorType === 'LineEnd') {
      const nl = newText.split('\n');
      item.lineIndex = Math.min(item.lineIndex, nl.length - 1);
      item.charIndex = (nl[item.lineIndex] || '').length;
      return;
    }
    const abs = lineCharToAbs(oldText, item.lineIndex, item.charIndex);
    const anchorChar = oldText[abs];
    if (!anchorChar || anchorChar === '\n') {
      const cl = absToLineChar(newText, Math.min(abs, newText.length));
      item.lineIndex = cl.lineIndex;
      item.charIndex = cl.charIndex;
      item.anchorType = 'OnCharacter';
      return;
    }
    let best = -1, bestD = Infinity, sf = 0;
    while (sf < newText.length) {
      const f = newText.indexOf(anchorChar, sf);
      if (f === -1) break;
      const d = Math.abs(f - abs);
      if (d < bestD) { bestD = d; best = f; }
      if (f >= abs) break;
      sf = f + 1;
    }
    if (best === -1) {
      const cl = absToLineChar(newText, Math.min(abs, newText.length));
      item.lineIndex = cl.lineIndex;
      item.charIndex = cl.charIndex;
      item.anchorType = 'OnCharacter';
      return;
    }
    const pos = absToLineChar(newText, best);
    item.lineIndex = pos.lineIndex;
    item.charIndex = pos.charIndex;
    item.anchorType = 'OnCharacter';
  }

  /**
   * نگاشت ستون‌های آکورد به ایندکس حروف متن ترانه.
   *
   * برای RTL: انتهای توکن آکورد به مرز متن از سمت راست نگاشت می‌شود.
   * برای LTR: ابتدای توکن آکورد مستقیم نگاشت می‌شود.
   * بدون proportional scaling و بدون word-boundary snapping.
   *
   * @param {string} chordLine
   * @param {string} lyricLine
   * @param {Array<{name: string, startColumn: number, endColumn: number}>} chordPositions
   * @returns {Array<{name: string, charIndex: number}>}
   */
  function mapChordColumnsToLyricIndices(chordLine, lyricLine, chordPositions) {
    const lyricLen = lyricLine.length;
    if (lyricLen === 0) return [];
    const isRTL = hasPersian(lyricLine);
    // Use expanded lyric width for accurate column mapping
    const lyricExpanded = expandTabsForVisualColumns(lyricLine);
    const lyricVisualWidth = lyricExpanded.length;
    return chordPositions.map(function (ch) {
      let charIdx;
      if (isRTL) {
        // RTL: end of chord token maps to text boundary from the right
        charIdx = lyricVisualWidth - ch.endColumn;
      } else {
        // LTR: start of chord token maps directly
        charIdx = ch.startColumn;
      }
      charIdx = Math.max(0, Math.min(charIdx, lyricLen));
      return { name: ch.name, charIndex: charIdx };
    });
  }

  return {
    expandTabsForVisualColumns,
    hasPersian,
    lineCharToAbs,
    absToLineChar,
    remapAnchorToNewText,
    mapChordColumnsToLyricIndices
  };
})();

if (typeof window !== 'undefined') {
  window.LyricPositionMapper = LyricPositionMapper;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LyricPositionMapper;
}
