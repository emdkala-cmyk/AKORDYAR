/**
 * EditorMidiChordService
 *
 * Pure MIDI-note recognition and chord-name formatting used by the editor.
 * Web MIDI, monitor UI and transport synchronization remain outside.
 */
(function attachEditorMidiChordService(globalScope) {
  function create({
    notes = globalScope.AkordyarAppConstants?.NOTES || [],
    chordTemplates = globalScope.AkordyarAppConstants?.CHORD_TEMPLATES || [],
    formatType = type => (type === 'min' ? 'm' : type === 'maj' ? '' : type)
  } = {}) {
    function pitchClass(value) {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) return null;
      return ((Math.round(numericValue) % 12) + 12) % 12;
    }

    function identifyChord(midiNotes) {
      if (!Array.isArray(midiNotes) || midiNotes.length < 3) return null;
      const sorted = midiNotes
        .map(Number)
        .filter(note => Number.isFinite(note))
        .sort((a, b) => a - b);
      if (sorted.length < 3) return null;
      const uniquePitchClasses = [
        ...new Set(sorted.map(note => pitchClass(note)))
      ];

      for (const rootPitchClass of uniquePitchClasses) {
        const intervals = uniquePitchClasses.map(notePitchClass =>
          (notePitchClass - rootPitchClass + 12) % 12
        );
        const uniqueIntervals = new Set(intervals);

        for (const template of chordTemplates) {
          const requiredIntervals = (template.req || []).map(interval =>
            ((Number(interval) % 12) + 12) % 12
          );
          const hasAll = requiredIntervals.every(interval =>
            uniqueIntervals.has(interval)
          );
          if (!hasAll) continue;
          const rootName = notes[rootPitchClass];
          if (!rootName) continue;
          return {
            root: rootName,
            type: template.type,
            tension: template.tension,
            bass: 'None'
          };
        }
      }
      return null;
    }

    function formatChordName(chord) {
      if (!chord || chord.root === 'None' || chord.type === 'None') {
        return 'None';
      }
      const bass =
        chord.bass !== 'None' && chord.bass !== chord.root
          ? '/' + chord.bass
          : '';
      return `${chord.root}${formatType(chord.type)}${chord.tension || ''}${bass}`;
    }

    return Object.freeze({ identifyChord, formatChordName });
  }

  const service = Object.freeze({ create });
  globalScope.EditorMidiChordService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
