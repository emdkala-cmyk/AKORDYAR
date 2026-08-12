/**
 * EditorChordDragService — drag geometry and anchor normalization.
 *
 * Pointer lifecycle and song mutations remain in editor.js. This service
 * only calculates the destination character, reference chord, and normalized
 * anchor metadata.
 */
(function attachEditorChordDragService(globalScope) {
  function create({
    documentRef = globalScope.document,
    nodeFilter = globalScope.NodeFilter
  } = {}) {
    const SHOW_TEXT = nodeFilter?.SHOW_TEXT ?? 4;

    function findNearestChar(lineEl, mouseX) {
      const text = (lineEl?.textContent || '').replace(/\u200B/g, '');
      if (!text.length || typeof documentRef?.createTreeWalker !== 'function') {
        return 0;
      }

      let bestChar = 0;
      let bestDistance = Infinity;
      let charCount = 0;
      const walker = documentRef.createTreeWalker(lineEl, SHOW_TEXT);
      let node;

      while ((node = walker.nextNode())) {
        const nodeText = node.textContent || '';
        for (let index = 0; index < nodeText.length; index += 1) {
          try {
            const range = documentRef.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + 1);
            const rect = range.getBoundingClientRect();
            if (rect.width === 0) continue;

            const distance = Math.abs(
              mouseX - (rect.left + rect.width / 2)
            );
            if (distance < bestDistance) {
              bestDistance = distance;
              bestChar = charCount;
            }
          } catch (_) {
            // A stale DOM range during rerender is not a drag failure.
          }
          charCount += 1;
        }
      }

      return Math.max(0, Math.min(bestChar, text.length));
    }

    function anchorTypeForCharIndex(charIndex, textLength) {
      if (charIndex <= 0) return 'LineStart';
      if (charIndex >= textLength) return 'LineEnd';
      return 'OnCharacter';
    }

    function moveChord(chord, charDelta, textLength) {
      const currentIndex = Number(chord?.charIndex) || 0;
      const nextIndex = Math.max(
        0,
        Math.min(currentIndex + (Number(charDelta) || 0), textLength)
      );
      return {
        charIndex: nextIndex,
        anchorType: anchorTypeForCharIndex(nextIndex, textLength)
      };
    }

    function findAnchorSelectionPosition(
      selectedIndices,
      chords,
      getLineElement,
      clientX
    ) {
      let anchorPosition = 0;
      let anchorDistance = Infinity;

      (selectedIndices || []).forEach((chordIndex, position) => {
        const chord = chords?.[chordIndex];
        const lineEl =
          typeof getLineElement === 'function'
            ? getLineElement(chord?.lineIndex)
            : null;
        if (!chord || !lineEl?.getBoundingClientRect) return;

        const lineRect = lineEl.getBoundingClientRect();
        const textLength = Math.max(
          (lineEl.textContent || '').replace(/\u200B/g, '').length,
          1
        );
        const midpoint =
          lineRect.left + (Number(chord.charIndex) || 0) *
            (lineRect.width / textLength);
        const distance = Math.abs(clientX - midpoint);
        if (distance < anchorDistance) {
          anchorDistance = distance;
          anchorPosition = position;
        }
      });

      return anchorPosition;
    }

    return Object.freeze({
      findNearestChar,
      anchorTypeForCharIndex,
      moveChord,
      findAnchorSelectionPosition
    });
  }

  globalScope.EditorChordDragService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
