/**
 * ChordLineSyncService — منطق pure همگام‌سازی Lyrics Chord → Chord Line
 *
 * Pure functions only — بدون وابستگی به DOM، edCur یا DAW.
 * استخراج‌شده از runtime ادیتور در Commit 1 برنامهٔ Editor Domain Extraction.
 *
 * نکته: تابع stateful syncChordLineFromLyrics() در runtime ادیتور باقی می‌ماند
 * و فقط مرتب‌سازی و اعمال نام‌ها را به این سرویس delegate می‌کند؛ وابستگی‌های
 * edCur، DAW.tracks، DAW.clips، toast و _chordLinePopup دست‌نخورده حفظ می‌شوند.
 */
const ChordLineSyncService = (() => {

  /**
   * مرتب‌سازی آکوردهای Lyrics بر اساس موقعیت فضایی از راست به چپ (ترتیب خواندن RTL).
   * برای متن فارسی: charIndex صفر در سمت راست است و ایندکس‌های بزرگ‌تر به چپ می‌روند؛
   * پس مرتب‌سازی صعودی، ترتیب راست‌به‌چپ را می‌دهد.
   *
   * آرایهٔ ورودی mutate نمی‌شود؛ کپی مرتب‌شده برمی‌گردد.
   *
   * @param {Array<{lineIndex: number, charIndex: number, name: string}>} chords
   * @returns {Array} کپی مرتب‌شده
   */
  function sortLyricsChordsForSync(chords) {
    return [...(chords || [])].sort((a, b) => {
      if (a.lineIndex !== b.lineIndex) {
        return a.lineIndex - b.lineIndex;
      }
      // Ascending order: smaller charIndex (right side) comes first
      return a.charIndex - b.charIndex;
    });
  }

  /**
   * اعمال نام آکوردهای Lyrics روی clipهای موجود Chord Line از چپ به راست.
   * فقط پراپرتی .name کلیپ‌های موجود به‌روز می‌شود؛ ترتیب آرایهٔ clips
   * تغییر نمی‌کند و کلیپ جدیدی ساخته نمی‌شود.
   *
   * @param {Array<{name: string}>} sortedChords - خروجی sortLyricsChordsForSync
   * @param {Array<{name: string}>} clips - کلیپ‌های chord مرتب‌شده بر اساس start
   * @returns {number} تعداد کلیپ‌های به‌روزشده
   */
  function applyChordNamesToClips(sortedChords, clips) {
    const appliedCount = Math.min(sortedChords.length, clips.length);

    for (let i = 0; i < appliedCount; i++) {
      clips[i].name = sortedChords[i].name;
    }

    return appliedCount;
  }

  return {
    sortLyricsChordsForSync,
    applyChordNamesToClips
  };
})();

if (typeof window !== 'undefined') {
  window.ChordLineSyncService = ChordLineSyncService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChordLineSyncService;
}
