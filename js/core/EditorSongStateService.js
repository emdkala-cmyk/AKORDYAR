/**
 * EditorSongStateService — controlled access to the current editor song.
 *
 * This boundary owns small, deterministic song-state commands used by core
 * UI flows. It does not know about DOM, audio runtime, persistence or global song references.
 */
(function attachEditorSongStateService(globalScope) {
  function create({ getSong = () => null } = {}) {
    function currentSong() {
      return typeof getSong === 'function' ? getSong() : null;
    }

    function getTimingContext(song = currentSong()) {
      return {
        tempo: song?.tempo || 120,
        timeSignature: song?.timeSignature || '4/4'
      };
    }

    function getTempo(song = currentSong()) {
      return song?.tempo || 120;
    }

    function getTranspose(song = currentSong()) {
      return song?.transpose || 0;
    }

    function getTimeSignature(song = currentSong()) {
      return song?.timeSignature || '4/4';
    }

    function getSyncTimes(song = currentSong()) {
      return Array.isArray(song?.syncTimes) ? song.syncTimes : [];
    }

    function getSeqPoints(song = currentSong()) {
      return Array.isArray(song?.seqPoints) ? song.seqPoints : [];
    }

    function getChords(song = currentSong()) {
      return Array.isArray(song?.chords) ? song.chords : [];
    }

    function getLyrics(song = currentSong()) {
      return song?.lyrics || '';
    }

    function getLineColors(song = currentSong()) {
      return Array.isArray(song?.lineColors) ? song.lineColors : [];
    }

    function getStyles(song = currentSong()) {
      return song?.styles || {};
    }

    function getChordLineClips(song = currentSong()) {
      return Array.isArray(song?.chordLineClips) ? song.chordLineClips : [];
    }

    function getPresentationSnapshot(song = currentSong()) {
      if (!song) return null;
      const styles = getStyles(song);
      return {
        title: song.title || t('untitled'),
        artist: song.artist || '',
        key: song.key || 'C',
        keyMode: song.keyMode || 'maj',
        transpose: song.transpose || 0,
        lyrics: getLyrics(song),
        chords: getChords(song),
        chordLineClips: getChordLineClips(song),
        syncTimes: getSyncTimes(song),
        styles: {
          tSize: styles.tSize || 38,
          tColor: styles.tColor || '#0fa966',
          tFont: styles.tFont || 'Vazirmatn',
          tBold: styles.tBold ? 'bold' : 'normal',
          align: styles.align || 'center',
          cSize: styles.cSize || 38,
          cColor: styles.cColor || '#e6aa28',
          cFont: styles.cFont || 'JetBrains Mono',
          highlightEffect: styles.highlightEffect || 'depth'
        }
      };
    }

    function setTempo(value, song = currentSong()) {
      if (!song) return false;
      song.tempo = value;
      return true;
    }

    function setLyrics(value, song = currentSong()) {
      if (!song) return false;
      song.lyrics = value == null ? '' : String(value);
      return true;
    }

    function ensureStyles(song = currentSong()) {
      if (!song) return null;
      if (!song.styles || typeof song.styles !== 'object') song.styles = {};
      return song.styles;
    }

    function setTextColor(color, song = currentSong()) {
      const styles = ensureStyles(song);
      if (!styles) return false;
      styles.tColor = color;
      return true;
    }

    function setChordColorStyle(color, song = currentSong()) {
      const styles = ensureStyles(song);
      if (!styles) return false;
      styles.cColor = color;
      return true;
    }

    function setLineColor(index, color, song = currentSong()) {
      if (!song || !Number.isInteger(index) || index < 0) return false;
      if (!Array.isArray(song.lineColors)) song.lineColors = [];
      song.lineColors[index] = color;
      return true;
    }

    function replaceLineColors(colors, song = currentSong()) {
      if (!song || !Array.isArray(colors)) return false;
      song.lineColors = colors;
      return true;
    }

    function clearLineColors(song = currentSong()) {
      return replaceLineColors([], song);
    }

    function getLineColor(index, fallback = null, song = currentSong()) {
      return getLineColors(song)[index] || getStyles(song).tColor || fallback;
    }

    function getChordColor(index, fallback = null, song = currentSong()) {
      const chord = getChords(song)[index];
      return chord?.color || getStyles(song).cColor || fallback;
    }

    function setChordColor(index, color, song = currentSong()) {
      const chord = getChords(song)[index];
      if (!chord || !Number.isInteger(index) || index < 0) return false;
      chord.color = color;
      return true;
    }

    function colorChordsByLine(colorForLine, song = currentSong()) {
      if (!song || typeof colorForLine !== 'function') return false;
      getChords(song).forEach(chord => {
        chord.color = colorForLine(chord.lineIndex, chord);
      });
      return true;
    }

    function resetChordColors(color, song = currentSong()) {
      if (!song) return false;
      getChords(song).forEach(chord => { chord.color = color; });
      return true;
    }

    function clearChordColors(song = currentSong()) {
      if (!song) return false;
      getChords(song).forEach(chord => { delete chord.color; });
      return true;
    }

    function setTranspose(value, song = currentSong()) {
      if (!song) return false;
      song.transpose = value;
      return true;
    }

    function setKey(key, mode, song = currentSong()) {
      if (!song) return false;
      song.key = key;
      song.keyMode = mode;
      return true;
    }

    function setHighlightEffect(effect, allowedEffects, song = currentSong()) {
      if (!song || !Array.isArray(allowedEffects) || !allowedEffects.includes(effect)) {
        return false;
      }
      if (!song.styles || typeof song.styles !== 'object') song.styles = {};
      song.styles.highlightEffect = effect;
      return true;
    }

    function markChordLineSynced(song = currentSong()) {
      if (!song) return false;
      song.hasManualChordLineEdits = false;
      return true;
    }

    function setChordLineClips(clips, song = currentSong()) {
      if (!song || !Array.isArray(clips)) return false;
      song.chordLineClips = clips;
      return true;
    }

    function ensureSyncTimes(song = currentSong()) {
      if (!song) return [];
      if (!Array.isArray(song.syncTimes)) song.syncTimes = [];
      return song.syncTimes;
    }

    function setSyncTime(index, value, song = currentSong()) {
      if (!song || !Number.isInteger(index) || index < 0) return false;
      ensureSyncTimes(song)[index] = value;
      return true;
    }

    function replaceSyncTimes(times, song = currentSong()) {
      if (!song || !Array.isArray(times)) return false;
      song.syncTimes = times;
      return true;
    }

    function setSeqPoints(points, song = currentSong()) {
      if (!song || !Array.isArray(points)) return false;
      song.seqPoints = points;
      return true;
    }

    function appendChords(chords, song = currentSong()) {
      if (!song || !Array.isArray(chords)) return false;
      if (!Array.isArray(song.chords)) song.chords = [];
      song.chords.push(...chords);
      return true;
    }

    function setChordName(index, name, song = currentSong()) {
      const chords = getChords(song);
      if (!Number.isInteger(index) || index < 0 || !chords[index]) return false;
      chords[index].name = name;
      return true;
    }

    return Object.freeze({
      currentSong,
      getTimingContext,
      getTempo,
      getTranspose,
      getTimeSignature,
      getSyncTimes,
      getSeqPoints,
      getChords,
      getLyrics,
      getLineColors,
      getStyles,
      getChordLineClips,
      getPresentationSnapshot,
      setTempo,
      setLyrics,
      ensureStyles,
      setTextColor,
      setChordColorStyle,
      setLineColor,
      replaceLineColors,
      clearLineColors,
      getLineColor,
      getChordColor,
      setChordColor,
      colorChordsByLine,
      resetChordColors,
      clearChordColors,
      setTranspose,
      setKey,
      setHighlightEffect,
      markChordLineSynced,
      setChordLineClips,
      ensureSyncTimes,
      setSyncTime,
      replaceSyncTimes,
      setSeqPoints,
      appendChords,
      setChordName
    });
  }

  globalScope.EditorSongStateService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
