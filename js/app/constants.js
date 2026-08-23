/**
 * ثابت‌های خالص مشترک بین هسته و ویرایشگر.
 *
 * این فایل هیچ وابستگی به DOM، Electron یا state اجرایی ندارد و باید قبل از
 * app/core.js و app/editor.js بارگذاری شود.
 */
(function publishAkordyarAppConstants(globalScope) {
  if (globalScope.AkordyarAppConstants) return;

  globalScope.AkordyarAppConstants = {
    COLORS: ['#3FB8AF', '#3182CE', '#D69E2E', '#9F7AEA', '#ED64A6', '#48BB78', '#ED8936', '#00B5D8'],
    NOTES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    FLAT_NOTES: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    ALL_NOTE_NAMES: ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'],
    ROOT_NOTES: ['None', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'],
    BASS_NOTES: ['None', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'],
    NOTE_TO_SHARP: { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' },
    NOTE_SEMITONE: { 'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11 },
    CHORD_TYPES: ['None', 'maj', 'min', 'dim', 'aug', 'sus2', 'sus4'],
    TENSIONS: ['', '7', 'M7', '9', 'b9', '#9', '11', '#11', '13', '6'],
    CHORD_INTERVALS: { 'maj': [0, 4, 7], 'min': [0, 3, 7], 'dim': [0, 3, 6], 'aug': [0, 4, 8], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7] },
    TENSION_INTERVALS: { '7': [10], 'M7': [11], '9': [14, 10], 'b9': [13, 10], '#9': [15, 10], '11': [17, 10], '#11': [18, 10], '13': [21, 10], '6': [9] },
    CHORD_TEMPLATES: [
      { type: 'maj', tension: '13', req: [0, 4, 7, 10, 21] }, { type: 'maj', tension: '11', req: [0, 4, 7, 10, 17] },
      { type: 'maj', tension: '9', req: [0, 4, 7, 10, 14] }, { type: 'maj', tension: 'b9', req: [0, 4, 7, 10, 13] },
      { type: 'maj', tension: '#9', req: [0, 4, 7, 10, 15] }, { type: 'maj', tension: '#11', req: [0, 4, 7, 10, 18] },
      { type: 'maj', tension: '7', req: [0, 4, 7, 10] }, { type: 'maj', tension: 'M7', req: [0, 4, 7, 11] },
      { type: 'maj', tension: '6', req: [0, 4, 7, 9] }, { type: 'maj', tension: '', req: [0, 4, 7] },

      { type: 'min', tension: '13', req: [0, 3, 7, 10, 21] }, { type: 'min', tension: '11', req: [0, 3, 7, 10, 17] },
      { type: 'min', tension: '9', req: [0, 3, 7, 10, 14] }, { type: 'min', tension: '7', req: [0, 3, 7, 10] },
      { type: 'min', tension: 'M7', req: [0, 3, 7, 11] }, { type: 'min', tension: '6', req: [0, 3, 7, 9] },
      { type: 'min', tension: '', req: [0, 3, 7] },

      { type: 'dim', tension: '7', req: [0, 3, 6, 9] }, { type: 'dim', tension: '', req: [0, 3, 6] },
      { type: 'aug', tension: '7', req: [0, 4, 8, 10] }, { type: 'aug', tension: '', req: [0, 4, 8] },
      { type: 'sus2', tension: '7', req: [0, 2, 7, 10] }, { type: 'sus2', tension: '', req: [0, 2, 7] },
      { type: 'sus4', tension: '7', req: [0, 5, 7, 10] }, { type: 'sus4', tension: '', req: [0, 5, 7] }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
