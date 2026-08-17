/**
 * EditorChordInteractionService — chord pointer lifecycle.
 *
 * DOM events are handled here through injected callbacks. The service does
 * not resolve globals, own song state, or decide persistence policy.
 */
(function attachEditorChordInteractionService(globalScope) {
  function create({
    getSong = () => null,
    getSelected = () => [],
    selectChord = () => {},
    clearSelection = () => {},
    getEditor = () => null,
    getWrap = () => null,
    getChordElement = () => null,
    isLocked = () => false,
    openChordModal = () => {},
    geometry = null,
    mutations = null,
    render = () => {},
    commit = () => {},
    setDragging = () => {},
    getSelection = () => globalScope.getSelection?.(),
    requestFrame = callback => (globalScope.requestAnimationFrame || (fn => setTimeout(fn, 0)))(callback),
    cancelFrame = id => (globalScope.cancelAnimationFrame || clearTimeout)(id),
    setSelected = () => {},
    isColorToolActive = () => false,
    onPaintChord = () => false,
    toast = () => {}
  } = {}) {
    let selectionBound = false;

    function chordElements() {
      return Array.from(getWrap()?.querySelectorAll?.('.chord') || []);
    }

    function bindSelectionSurface() {
      const wrap = getWrap();
      if (!wrap?.addEventListener || selectionBound) return;
      selectionBound = true;
      const eventDocument = globalScope.document;

      wrap.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest?.('.chord')) return;

        const pointerId = event.pointerId;
        const startX = event.clientX;
        const startY = event.clientY;
        let selecting = false;
        let frameId = null;
        let latestEvent = event;

        const updateSelection = () => {
          frameId = null;
          if (!selecting) return;
          const x1 = Math.min(startX, latestEvent.clientX);
          const x2 = Math.max(startX, latestEvent.clientX);
          const y1 = Math.min(startY, latestEvent.clientY);
          const y2 = Math.max(startY, latestEvent.clientY);
          const selected = chordElements()
            .filter(element => {
              const rect = element.getBoundingClientRect();
              return rect.right >= x1 && rect.left <= x2 &&
                rect.bottom >= y1 && rect.top <= y2;
            })
            .map(element => Number.parseInt(element.dataset.idx, 10))
            .filter(Number.isInteger);
          setSelected(selected);
        };

        const move = moveEvent => {
          if (moveEvent.pointerId !== pointerId) return;
          latestEvent = moveEvent;
          if (!selecting &&
            (Math.abs(moveEvent.clientX - startX) > 4 ||
             Math.abs(moveEvent.clientY - startY) > 4)) {
            selecting = true;
            getSelection()?.removeAllRanges?.();
          }
          if (!selecting || frameId) return;
          frameId = requestFrame(updateSelection);
          moveEvent.preventDefault?.();
        };

        const finish = endEvent => {
          if (endEvent.pointerId !== pointerId) return;
          if (frameId) cancelFrame(frameId);
          eventDocument?.removeEventListener?.('pointermove', move);
          eventDocument?.removeEventListener?.('pointerup', finish);
          eventDocument?.removeEventListener?.('pointercancel', finish);
          if (selecting) {
            endEvent.preventDefault?.();
            endEvent.stopPropagation?.();
          }
        };

        (eventDocument || wrap).addEventListener('pointermove', move);
        (eventDocument || wrap).addEventListener('pointerup', finish);
        (eventDocument || wrap).addEventListener('pointercancel', finish);
      }, true);
    }

    function attach(element, index) {
      if (!element?.addEventListener) return;
      element.style.touchAction = 'none';
      let pointerDoubleClickHandled = false;

      element.addEventListener('dblclick', event => {
        if (event.button !== 0 || isLocked()) return;
        if (pointerDoubleClickHandled) {
          pointerDoubleClickHandled = false;
          return;
        }
        event.preventDefault?.();
        event.stopPropagation?.();
        openChordModal(index);
      });

      element.addEventListener('pointerdown', event => {
        if (event.button !== 0 || isLocked()) return;

        if (isColorToolActive() && onPaintChord(index, event)) {
          event.preventDefault?.();
          event.stopPropagation?.();
          return;
        }

        getSelection()?.removeAllRanges?.();
        getEditor()?.blur?.();
        event.stopPropagation?.();
        event.preventDefault?.();

        const pointerId = event.pointerId;
        element.setPointerCapture?.(pointerId);

        if (event.detail === 2) {
          if (isLocked()) {
            toast('ویرایشگر قفل است');
            return;
          }
          pointerDoubleClickHandled = true;
          globalScope.setTimeout?.(() => {
            pointerDoubleClickHandled = false;
          }, 500);
          openChordModal(index);
          return;
        }

        const selected = getSelected();
        if (!selected.includes(index)) selectChord(index, event.shiftKey);

        const song = getSong();
        const chords = song?.chords || [];
        const selectedNow = getSelected();
        const isCopy = Boolean(event.altKey);
        const startX = event.clientX;
        const snapshots = selectedNow
          .map(chordIndex => ({
            idx: chordIndex,
            element: getChordElement(chordIndex)
          }))
          .filter(snapshot => snapshot.element)
          .map(snapshot => ({
            ...snapshot,
            originalLeft: snapshot.element.offsetLeft
          }));

        let dragging = false;
        let frameId = null;
        let pendingDx = 0;

        const move = moveEvent => {
          if (
            !dragging &&
            Math.abs(moveEvent.clientX - startX) > 3
          ) {
            dragging = true;
            setDragging(true);
            snapshots.forEach(({ element: chordElement }) => {
              chordElement.style.zIndex = '10';
              chordElement.style.opacity = '.85';
              chordElement.style.pointerEvents = 'none';
            });
          }

          if (!dragging) return;
          pendingDx = moveEvent.clientX - startX;
          if (frameId) return;

          frameId = requestFrame(() => {
            const dx = pendingDx;
            frameId = null;
            snapshots.forEach(snapshot => {
              snapshot.element.style.left =
                `${snapshot.originalLeft + dx}px`;
            });
          });
        };

        const finish = upEvent => {
          if (upEvent.pointerId !== pointerId) return;
          element.releasePointerCapture?.(pointerId);
          element.removeEventListener('pointermove', move);
          element.removeEventListener('pointerup', finish);
          element.removeEventListener('pointercancel', finish);
          if (frameId) {
            cancelFrame(frameId);
            frameId = null;
          }

          const wasDrag = dragging;
          dragging = false;
          setDragging(false);
          snapshots.forEach(({ element: chordElement }) => {
            chordElement.style.zIndex = '';
            chordElement.style.opacity = '';
            chordElement.style.pointerEvents = '';
          });
          if (!wasDrag) return;

          const wrap = getWrap();
          const wrapRect = wrap?.getBoundingClientRect?.();
          const outside =
            !wrapRect ||
            upEvent.clientX < wrapRect.left ||
            upEvent.clientX > wrapRect.right ||
            upEvent.clientY < wrapRect.top ||
            upEvent.clientY > wrapRect.bottom;

          if (outside) {
            mutations?.deleteChords(song, getSelected());
            clearSelection();
          } else {
            const currentSelected = getSelected();
            const anchorPosition =
              geometry?.findAnchorSelectionPosition?.(
                currentSelected,
                chords,
                lineIndex => getEditor()?.children?.[lineIndex],
                upEvent.clientX
              ) || 0;
            const anchorIndex = currentSelected[anchorPosition];
            const anchor = chords[anchorIndex];
            const anchorLine = getEditor()?.children?.[anchor?.lineIndex];
            const anchorNewChar =
              geometry?.findNearestChar?.(anchorLine, upEvent.clientX) || 0;
            const charDelta = anchorNewChar - (Number(anchor?.charIndex) || 0);

            mutations?.moveChordsByDelta(
              song,
              currentSelected,
              charDelta,
              lineIndex => getEditor()?.children?.[lineIndex]?.textContent
                ?.replace(/\u200B/g, '').length || 0,
              { copy: isCopy }
            );
          }

          render();
          commit();
        };

        element.addEventListener('pointermove', move);
        element.addEventListener('pointerup', finish);
        element.addEventListener('pointercancel', finish);
      });
    }

    bindSelectionSurface();
    return Object.freeze({ attach, bindSelectionSurface });
  }

  globalScope.EditorChordInteractionService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
