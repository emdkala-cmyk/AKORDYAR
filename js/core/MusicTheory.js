/**
 * MusicTheory — centralized note name constants, key utilities, and time signature grid config.
 * 
 * Pure functions only — no DOM or Song Runtime dependencies.
 */

const MusicTheory = (() => {

  /** All 12 chromatic note names (sharps and flats) */
  const NOTE_NAMES = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'];

  /** Map note name -> semitone index (0-11) */
  const NOTE_SEMITONE = {
    'C':0, 'C#':1, 'Db':1, 'D':2, 'D#':3, 'Eb':3, 'E':4,
    'F':5, 'F#':6, 'Gb':6, 'G':7, 'G#':8, 'Ab':8,
    'A':9, 'A#':10, 'Bb':10, 'B':11
  };

  /** Map flat note -> sharp equivalent */
  const FLAT_TO_SHARP = { 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#' };

  /** Map sharp note -> flat equivalent */
  const SHARP_TO_FLAT = { 'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab', 'A#':'Bb' };

  /** Semitone index -> preferred flat name */
  const FLAT_SEMITONE_MAP = { 1:'Db', 3:'Eb', 6:'Gb', 8:'Ab', 10:'Bb' };

  function keyToSemi(key) {
    return NOTE_SEMITONE[key] != null ? NOTE_SEMITONE[key] : -1;
  }

  function keyDelta(fromKey, toKey) {
    if (typeof window.TransposeService === 'object' && window.TransposeService && typeof window.TransposeService.keyDelta === 'function') {
      return window.TransposeService.keyDelta(fromKey, toKey);
    }
    return ((keyToSemi(toKey) - keyToSemi(fromKey)) % 12 + 12) % 12;
  }

  function isValidNoteName(n) {
    return NOTE_NAMES.includes(n) || NOTE_SEMITONE[n] != null;
  }

  function getTimeSignatureGridConfig(timeSignature, bpm) {
    if (typeof globalThis.Meter?.getMeterConfig !== 'function') {
      throw new Error('Meter must be loaded before time-signature calculations');
    }
    return globalThis.Meter.getMeterConfig(timeSignature, bpm);
  }

  return {
    NOTE_NAMES: NOTE_NAMES,
    NOTE_SEMITONE: NOTE_SEMITONE,
    FLAT_TO_SHARP: FLAT_TO_SHARP,
    SHARP_TO_FLAT: SHARP_TO_FLAT,
    FLAT_SEMITONE_MAP: FLAT_SEMITONE_MAP,
    keyToSemi: keyToSemi,
    keyDelta: keyDelta,
    isValidNoteName: isValidNoteName,
    getTimeSignatureGridConfig: getTimeSignatureGridConfig
  };

})();

if (typeof window !== 'undefined') {
  window.MusicTheory = MusicTheory;
}
