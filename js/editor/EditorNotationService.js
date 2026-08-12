/**
 * EditorNotationService — editor-facing notation boundary.
 *
 * The editor keeps its legacy function names for compatibility, while all
 * note/chord/key transformations are delegated to the shared TransposeService.
 */
(function attachEditorNotationService(globalScope) {
  function getTransposeService() {
    return globalScope.TransposeService || null;
  }

  function transposeNote(note, semitones, preferSharp) {
    const service = getTransposeService();
    return typeof service?.transposeNote === 'function'
      ? service.transposeNote(note, semitones, preferSharp)
      : note;
  }

  function transposeChord(name, semitones, preferSharp) {
    const service = getTransposeService();
    return typeof service?.transposeChordName === 'function'
      ? service.transposeChordName(name, semitones, preferSharp)
      : name;
  }

  function transposeKey(key, semitones, preferSharp) {
    const service = getTransposeService();
    return typeof service?.transposeKeyName === 'function'
      ? service.transposeKeyName(key, semitones, preferSharp)
      : key;
  }

  function keyDelta(fromKey, toKey) {
    const service = getTransposeService();
    return typeof service?.keyDelta === 'function'
      ? service.keyDelta(fromKey, toKey)
      : 0;
  }

  globalScope.EditorNotationService = Object.freeze({
    transposeNote,
    transposeChord,
    transposeKey,
    keyDelta
  });
})(typeof window !== 'undefined' ? window : globalThis);
