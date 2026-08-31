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
    function cleanLineText(element) {
      return String(element?.textContent || '')
        .replace(/\u200B/g, '')
        .replace(/\r\n?/g, '\n');
    }

    function getLineElements(editor) {
      return Array.from(editor?.children || []);
    }

    function normalizeLineElements(editor) {
      const lineElements = getLineElements(editor);
      lineElements.forEach((element, lineIndex) => {
        element.classList?.add?.('eline');
        if (element.dataset) {
          element.dataset.lineIndex = String(lineIndex);
        }
        element.dir = 'auto';
      });
      return lineElements;
    }

    /**
     * contenteditable در Enter روی ابتدا/انتهای یک بیت ممکن است innerText را
     * با یک newline اضافه گزارش کند؛ درحالی‌که DOM فقط یک نود خط خالی دارد.
     * هر فرزند مستقیم editor را یک خط واقعی در نظر می‌گیریم تا متن منطقی و
     * مختصات lineIndex آکوردها همیشه از یک منبع واحد خوانده شوند.
     */
    function readLyrics(editor) {
      const lineElements = normalizeLineElements(editor);
      if (lineElements.length) {
        return lineElements.map(cleanLineText).join('\n');
      }

      return String(editor?.textContent || editor?.innerText || '')
        .replace(/\u200B/g, '')
        .replace(/\r\n?/g, '\n');
    }

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
          song.title || state.titleFallback || t('untitled');
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
        normalizeLineElements(editor).forEach((element, lineIndex) => {
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

    return Object.freeze({
      render,
      getLineElements,
      normalizeLineElements,
      readLyrics
    });
  }

  globalScope.EditorLyricsRenderer = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
