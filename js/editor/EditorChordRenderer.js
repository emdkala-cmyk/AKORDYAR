/**
 * EditorChordRenderer — DOM projection for editor chord overlays.
 *
 * The legacy editor owns state and interaction callbacks; this service only
 * projects that state into the chord layer.
 */
(function attachEditorChordRenderer(globalScope) {
  function create({ getState, anchorRectIn, attachDrag, onPopupSync } = {}) {
    let renderToken = 0;

    function schedule(callback) {
      const raf = globalScope.requestAnimationFrame || (fn => setTimeout(fn, 0));
      raf(() => raf(callback));
    }

    function render(immediate = false) {
      const token = ++renderToken;

      const run = () => {
        if (token !== renderToken) return;

        const state = typeof getState === 'function' ? getState() : null;
        if (!state?.song || !state.editor || !state.layer || !state.wrap) return;

        const {
          song,
          editor,
          layer,
          wrap,
          chordsVisible,
          selectedChords = [],
          sequenceActive,
          sequenceModeActive,
          sequencePoints = [],
          sequenceCursor = 0,
          editorZoom = 1
        } = state;

        layer.innerHTML = '';
        if (!chordsVisible) {
          layer.style.display = 'none';
          return;
        }
        layer.style.display = '';

        const wrapRect = wrap.getBoundingClientRect();
        const scrollTop = wrap.scrollTop;
        const styles = song.styles || {};
        const zoom = Math.max(0.7, Math.min(1.5, Number(editorZoom) || 1));
        const chordSize = (styles.cSize || 23) * zoom;
        const gap = Math.max(10 * zoom, chordSize * 0.6);
        const chordColor = styles.cColor || '#e6aa28';
        const fontFamily = styles.cFont || 'JetBrains Mono';
        const isRTL = globalScope.getComputedStyle(editor).direction === 'rtl';
        const margin = 5;

        const appendChord = (
          chord,
          index,
          text,
          color = chordColor,
          forceSelected = false
        ) => {
          const anchor = anchorRectIn(editor, chord);
          if (!anchor) return;

          const element = globalScope.document.createElement('span');
          element.className = 'chord';
          if (Number.isInteger(index)) element.dataset.idx = index;
          if (
            forceSelected ||
            (Number.isInteger(index) && selectedChords.includes(index))
          ) {
            element.classList.add('selected');
          }
          element.textContent = text;
          element.style.cssText =
            `font-size:${chordSize}px;color:${color};font-family:${fontFamily};`;

          let x;
          if (chord.anchorType === 'LineStart') {
            x = isRTL ? anchor.rect.right + margin : anchor.rect.left - margin;
          } else if (chord.anchorType === 'LineEnd') {
            x = isRTL ? anchor.rect.left - margin : anchor.rect.right + margin;
          } else if (chord.anchorType === 'BetweenCharacters') {
            x = anchor.rect.right;
          } else {
            x = (anchor.rect.left + anchor.rect.right) / 2;
          }

          layer.appendChild(element);

          const top =
            anchor.rect.top - wrapRect.top +
            scrollTop - chordSize - gap;

          element.style.top = top + 'px';
          element.style.left =
            (x - wrapRect.left - element.offsetWidth / 2) + 'px';

          const line = globalScope.document.createElement('div');
          line.className = 'chord-anchor-line';
          line.style.cssText =
            `background:${chordColor};opacity:.6;left:${x - wrapRect.left}px;` +
            `top:${top + chordSize}px;height:${Math.max(4, gap)}px;`;
          layer.appendChild(line);

          if (typeof attachDrag === 'function' && Number.isInteger(index)) {
            attachDrag(element, index);
          }
        };

        (song.chords || []).forEach((chord, index) => {
          let text = chord.name;
          if (!text && sequenceActive) {
            const sequenceIndex = index - (song.chords.length - sequencePoints.length);
            if (sequenceIndex >= 0 && sequenceIndex < sequencePoints.length) {
              const isCurrent = sequenceIndex === sequenceCursor;
              text = isCurrent ? '...' : String(sequenceIndex + 1);
              appendChord(
                chord,
                index,
                text,
                chord.color || chordColor,
                isCurrent
              );
              return;
            }
          }
          if (!text && !sequenceActive) return;
          appendChord(chord, index, text, chord.color || chordColor);
        });

        if (sequenceModeActive) {
          sequencePoints.forEach((point, index) => {
            appendChord(point, null, String(index + 1), '#999');
          });
        }
      };

      if (immediate) {
        run();
      } else if (globalScope.document.fonts?.ready) {
        globalScope.document.fonts.ready
          .then(() => schedule(run))
          .catch(() => schedule(run));
      } else {
        schedule(run);
      }

      if (typeof onPopupSync === 'function') onPopupSync();
    }

    return Object.freeze({ render });
  }

  globalScope.EditorChordRenderer = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
