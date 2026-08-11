/**
 * LyricsParser — تشخیص خطوط آکورد و استخراج توکن‌های آکورد از متن ترانه
 *
 * Pure functions only — بدون وابستگی به DOM، edCur یا DAW.
 * استخراج‌شده از app.js در Commit 1 برنامهٔ Editor Domain Extraction.
 *
 * پشتیبانی از:
 * - chordهای ساده و slash chord
 * - sharp و flat
 * - qualityهای maj، min، dim، aug، sus و add
 * - متن فارسی و RTL (خطوط غیرآکوردی بدون تغییر عبور می‌کنند)
 * - خطوط خالی و whitespace (نادیده گرفته می‌شوند)
 */
const LyricsParser = (() => {

  /**
   * متن خام ترانه را به بخش‌های chord/lyric تقسیم می‌کند.
   *
   * @param {string} rawText
   * @returns {{sections: Array<{type: string, text: string, chords?: string[]}>, allChords: Set<string>}}
   */
  function parseChordLyricText(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const chordRegex = /^[A-G][#b]?(m|maj|min|dim|aug|sus[24]?|add\d+|\/[A-G][#b]?|\d+)*(\s+[A-G][#b]?(m|maj|min|dim|aug|sus[24]?|add\d+|\/[A-G][#b]?|\d+)*)*\s*$/;
    const result = { sections: [], allChords: new Set() };

    for (const line of lines) {
      const isChordLine = chordRegex.test(line.replace(/\s{2,}/g, ' ').trim());
      if (isChordLine) {
        const chords = line.match(/[A-G][#b]?(?:m|maj|min|dim|aug|sus[24]?|add\d+)?(?:\/[A-G][#b]?)?/g) || [];
        chords.forEach(c => result.allChords.add(c));
        result.sections.push({ type: 'chord', text: line, chords });
      } else {
        result.sections.push({ type: 'lyric', text: line });
      }
    }
    return result;
  }

  return {
    parseChordLyricText
  };
})();

if (typeof window !== 'undefined') {
  window.LyricsParser = LyricsParser;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LyricsParser;
}
