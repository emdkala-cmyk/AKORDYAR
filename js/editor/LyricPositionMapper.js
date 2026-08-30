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
   * پیدا کردن یک تغییر پیوسته بین دو نسخه‌ی متن.
   *
   * ویرایش‌های contenteditable (تایپ، Enter، paste و حذف) معمولاً یک ناحیه‌ی
   * پیوسته را عوض می‌کنند. نگه داشتن prefix/suffix مشترک باعث می‌شود موقعیت
   * کاراکترهای قبل و بعد از آن ناحیه بدون تکیه بر متنِ کاراکتر یا تکراری بودن
   * آن، به نسخه‌ی جدید منتقل شود.
   */
  function findTextEdit(oldText, newText) {
    const oldValue = String(oldText ?? '');
    const newValue = String(newText ?? '');
    let start = 0;

    while (
      start < oldValue.length &&
      start < newValue.length &&
      oldValue[start] === newValue[start]
    ) {
      start += 1;
    }

    let oldEnd = oldValue.length;
    let newEnd = newValue.length;
    while (
      oldEnd > start &&
      newEnd > start &&
      oldValue[oldEnd - 1] === newValue[newEnd - 1]
    ) {
      oldEnd -= 1;
      newEnd -= 1;
    }

    return {
      start,
      oldEnd,
      newEnd,
      delta: newValue.length - oldValue.length,
      oldLength: oldValue.length
    };
  }

  /**
   * انتقال یک offset قدیمی به متن جدید.
   *
   * affinity فقط برای insertion در یک boundary استفاده می‌شود:
   * - right: anchor همراه متنِ قدیمیِ بعد از insertion حرکت می‌کند.
   * - left: anchor قبل از insertion می‌ماند.
   */
  function remapAbsoluteOffset(offset, edit, affinity = 'right') {
    const position = Math.max(
      0,
      Math.min(Number(offset) || 0, edit.oldLength)
    );

    if (position < edit.start) return position;
    if (position > edit.oldEnd) return position + edit.delta;

    const oldChangedLength = edit.oldEnd - edit.start;
    if (oldChangedLength === 0) {
      return affinity === 'left' ? edit.start : edit.newEnd;
    }

    // Offset at the end of a replaced/deleted range belongs after that range.
    if (position === edit.oldEnd) return edit.newEnd;
    if (position === edit.start) return edit.start;

    // For an anchor inside a replaced range, retain its relative position as
    // far as the replacement length allows.
    const relative = position - edit.start;
    const newChangedLength = edit.newEnd - edit.start;
    return edit.start + Math.min(relative, newChangedLength);
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
    if (!item) return;

    const oldValue = String(oldText ?? '');
    const newValue = String(newText ?? '');
    const rawLineIndex = Number(item.lineIndex);
    if (Number.isFinite(rawLineIndex) && rawLineIndex < 0) {
      return;
    }
    const edit = findTextEdit(oldValue, newValue);
    const oldLines = oldValue.split('\n');
    const oldLineIndex = Math.max(
      0,
      Math.min(
        rawLineIndex || 0,
        Math.max(0, oldLines.length - 1)
      )
    );
    const oldLine = oldLines[oldLineIndex] || '';
    const oldCharIndex = Math.max(
      0,
      Math.min(Number(item.charIndex) || 0, oldLine.length)
    );
    const oldAbs = lineCharToAbs(
      oldValue,
      oldLineIndex,
      oldCharIndex
    );
    const affinity = item.anchorType === 'LineEnd' ? 'left' : 'right';
    const newAbs = remapAbsoluteOffset(oldAbs, edit, affinity);
    const mapped = absToLineChar(newValue, newAbs);
    const newLines = newValue.split('\n');

    item.lineIndex = Math.max(
      0,
      Math.min(mapped.lineIndex, Math.max(0, newLines.length - 1))
    );

    if (item.anchorType === 'LineStart') {
      item.charIndex = 0;
      return;
    }
    if (item.anchorType === 'LineEnd') {
      item.charIndex = (newLines[item.lineIndex] || '').length;
      return;
    }

    item.charIndex = Math.max(
      0,
      Math.min(mapped.charIndex, (newLines[item.lineIndex] || '').length)
    );
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
    findTextEdit,
    remapAbsoluteOffset,
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
