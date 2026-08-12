/**
 * EditorSongImportService
 *
 * اعمال نتیجه‌ی parser روی song جاری، بدون DOM، parser یا DAW global.
 * مسئولیت سرویس فقط mutation دامنه‌ی song است؛ render، save و حذف clipهای
 * تایم‌لاین در orchestration رابط کاربری باقی می‌ماند.
 */
(function attachEditorSongImportService(globalScope) {
  function create({
    getSong = () => null,
    setSong = () => {},
    createBlankSong = () => null,
    isValidNote = () => true
  } = {}) {
    function applyParsedResult(parsedResult) {
      if (!parsedResult || typeof parsedResult !== 'object') return null;

      let song = getSong();
      if (!song) {
        song = createBlankSong();
        if (!song) return null;
        setSong(song);
      }

      song.lyrics = parsedResult.lyrics || '';
      song.chords = Array.isArray(parsedResult.chords)
        ? parsedResult.chords
        : [];

      if (parsedResult.title) song.title = parsedResult.title;
      if (parsedResult.artist) song.artist = parsedResult.artist;

      if (parsedResult.key) {
        const cleanKey = parsedResult.key.replace('m', '');
        if (isValidNote(cleanKey)) song.key = cleanKey;
        if (parsedResult.keyMode === 'min') song.keyMode = 'min';
      }
      if (parsedResult.timeSignature) {
        song.timeSignature = parsedResult.timeSignature;
      }

      song.originalKey = song.key || 'C';
      song.originalKeyMode = song.keyMode || 'maj';
      song.transpose = 0;
      song.baseChordNames = song.chords.map(chord => chord?.name || '');
      if (!song.chordLineClips) song.chordLineClips = [];
      if (!song.hasManualChordLineEdits) {
        song.hasManualChordLineEdits = false;
      }

      return {
        song,
        chordCount: song.chords.length,
        title: parsedResult.title || ''
      };
    }

    return Object.freeze({ applyParsedResult });
  }

  const service = Object.freeze({ create });
  globalScope.EditorSongImportService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
