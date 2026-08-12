/**
 * EditorLyricsRenderer — DOM projection for editor lyrics and print metadata.
 *
 * The service receives a complete render state and never resolves the legacy
 * song reference itself. Chord overlays are intentionally rendered by the
 * separate EditorChordRenderer.
 */
(function attachEditorLyricsRenderer(globalScope) {
  function create({
    documentRef = globalScope.document,
    getState = () => null
  } = {}) {
    function applyLineStyle(element, styles, color) {
      element.style.fontSize = `${styles.tSize}px`;
      element.style.color = color || styles.tColor;
      element.style.fontFamily = styles.tFont;
      element.style.fontWeight = styles.tBold ? 'bold' : 'normal';
      element.style.textAlign = styles.align || 'center';
    }

    function render(rebuildContent = true) {
      const state = typeof getState === 'function' ? getState() : null;
      const song = state?.song;
      const editor = state?.editor;
      if (!song || !editor) return false;

      const styles = song.styles || {};
      const lineColors = Array.isArray(song.lineColors)
        ? song.lineColors
        : [];
      applyLineStyle(editor, styles, styles.tColor);

      if (state.printTitle) {
        state.printTitle.textContent =
          song.title || state.titleFallback || 'بدون نام';
      }
      if (state.printSub) {
        state.printSub.textContent =
          typeof state.buildSubtext === 'function'
            ? state.buildSubtext(song)
            : '';
      }

      if (rebuildContent !== false) {
        const fragment = documentRef.createDocumentFragment();
        (song.lyrics || '').split('\n').forEach((line, lineIndex) => {
          const element = documentRef.createElement('div');
          element.className = 'eline';
          element.dir = 'auto';
          element.dataset.lineIndex = lineIndex;
          applyLineStyle(
            element,
            styles,
            lineColors[lineIndex]
          );
          element.textContent = line || '\u200B';
          fragment.appendChild(element);
        });

        editor.innerHTML = '';
        editor.appendChild(fragment);
      } else {
        editor.querySelectorAll('.eline').forEach((element, lineIndex) => {
          applyLineStyle(
            element,
            styles,
            lineColors[lineIndex]
          );
        });
      }

      const chords = Array.isArray(song.chords) ? song.chords : [];
      const lines = (song.lyrics || '').split('\n');
      if (state.statChordCount) {
        state.statChordCount.textContent =
          chords.filter(chord => chord.name).length;
      }
      if (state.statLineCount) {
        state.statLineCount.textContent = lines.length;
      }
      return true;
    }

    return Object.freeze({ render });
  }

  globalScope.EditorLyricsRenderer = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
