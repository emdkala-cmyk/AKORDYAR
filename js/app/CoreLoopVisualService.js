/*
 * CoreLoopVisualService
 *
 * Owns visual rendering and locator dragging for the editor loop. Loop
 * transport policy and arranger boundaries remain in app/core.js.
 */
(function attachCoreLoopVisualService(globalScope) {
  'use strict';

  function create({
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getElement = id => globalScope.document?.getElementById?.(id),
    documentRef = globalScope.document,
    timeToX = value => value,
    xToTime = value => value,
    clamp = (value, min, max) => Math.max(min, Math.min(max, value)),
    getProjectEnd = () => Number.POSITIVE_INFINITY,
    isSnapEnabled = () => true,
    snapTime = value => value,
    startPointerDrag = (...args) =>
      globalScope.EditorRuntimeAdapter?.startPointerDrag?.(...args),
    saveState = () => {}
  } = {}) {
    function loopTimeFrom(value) {
      const numeric = Number(value);
      const bounded = clamp(
        Number.isFinite(numeric) ? numeric : 0,
        0,
        getProjectEnd()
      );
      const snapped = isSnapEnabled() ? Number(snapTime(bounded)) : bounded;
      return clamp(
        Number.isFinite(snapped) ? snapped : bounded,
        0,
        getProjectEnd()
      );
    }

    function renderLoopRegion() {
      const daw = getDAW();
      const strip = getElement('loop-strip');
      const locators = getElement('loop-locators');
      const locLeft = getElement('loop-loc-left');
      const locRight = getElement('loop-loc-right');
      const hasRange = daw.loopA < daw.loopB;

      if (!hasRange) {
        if (strip) strip.style.display = 'none';
        if (locators) locators.style.display = 'none';
        return;
      }

      const xA = timeToX(daw.loopA);
      const xB = timeToX(daw.loopB);
      const width = xB - xA;

      if (strip) {
        strip.style.display = 'block';
        strip.style.left = `${xA}px`;
        strip.style.width = `${width}px`;
        strip.classList.toggle('loop-active', daw.loopEnabled);
        strip.classList.toggle('loop-inactive', !daw.loopEnabled);
      }
      if (locators) locators.style.display = 'block';
      if (locLeft) locLeft.style.left = `${xA - 5}px`;
      if (locRight) locRight.style.left = `${xB - 5}px`;
    }

    function bindLoopDrag() {
      let dragTarget = null;
      const leftLocator = getElement('loop-loc-left');
      const rightLocator = getElement('loop-loc-right');

      const addDragListeners = (target, event) => {
        startPointerDrag(target, event, onDragMove, onDragUp);
      };
      const onDragMove = event => {
        if (!dragTarget) return;
        const inner = getElement('tl-inner');
        if (!inner) return;
        const rect = inner.getBoundingClientRect();
        const time = loopTimeFrom(xToTime(event.clientX - rect.left));
        const daw = getDAW();
        if (dragTarget === 'A') {
          daw.loopA = Math.min(time, daw.loopB - 0.5);
        } else {
          daw.loopB = Math.max(time, daw.loopA + 0.5);
        }
        renderLoopRegion();
      };
      const onDragUp = () => {
        if (dragTarget) {
          dragTarget = null;
          saveState();
        }
        documentRef?.removeEventListener?.('mousemove', onDragMove);
        documentRef?.removeEventListener?.('mouseup', onDragUp);
      };

      leftLocator?.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.stopPropagation();
        event.preventDefault();
        dragTarget = 'A';
        addDragListeners(event.currentTarget, event);
      });
      rightLocator?.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.stopPropagation();
        event.preventDefault();
        dragTarget = 'B';
        addDragListeners(event.currentTarget, event);
      });

      return Object.freeze({ onDragMove, onDragUp });
    }

    return Object.freeze({ renderLoopRegion, bindLoopDrag });
  }

  const service = Object.freeze({ create });
  globalScope.CoreLoopVisualService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
