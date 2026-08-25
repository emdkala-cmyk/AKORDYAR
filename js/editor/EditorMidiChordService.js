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
    function identifyChord(midiNotes) {
      if (!Array.isArray(midiNotes) || midiNotes.length < 3) return null;
      const sorted = [...midiNotes].sort((a, b) => a - b);
      const bassMidi = sorted[0];
      const bassNote = notes[bassMidi % 12];
      const uniqueMidiNotes = [...new Set(sorted)];

      for (const rootMidi of uniqueMidiNotes) {
        const intervals = uniqueMidiNotes
          .map(note => note - rootMidi)
          .filter(interval => interval >= 0)
          .sort((a, b) => a - b);
        const uniqueIntervals = [...new Set(intervals)];

        for (const template of chordTemplates) {
          const hasAll = template.req.every(interval =>
            uniqueIntervals.includes(interval)
          );
          if (!hasAll) continue;
          const rootName = notes[rootMidi % 12];
          return {
            root: rootName,
            type: template.type,
            tension: template.tension,
            bass: bassMidi % 12 === rootMidi % 12 ? 'None' : bassNote
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
