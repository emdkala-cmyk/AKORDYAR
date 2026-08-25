/**
 * EditorTimelineInteractionService
 *
 * Owns ruler/playhead scrubbing and timeline zoom gestures. Runtime state and
 * transport behavior remain in editor.js through injected callbacks.
 */
(function attachEditorTimelineInteractionService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getDAW = () => null,
    setVerticalZoom = () => {},
    setZoom = () => {},
    toast = () => {},
    translate = value => value,
    clearEditorTextSelection = () => {},
    clearChordSelection = () => {},
    clearSelection = () => {},
    seekTransport = () => {},
    xToTime = value => value,
    clientToTime = () => 0,
    clamp = (value, min, max) => Math.max(min, Math.min(max, value)),
    autoScrollToPlayhead = () => {},
    renderLoopRegion = () => {},
    saveState = () => {}
  } = {}) {
    let initialized = false;
    let wheelTarget = null;
    let rulerTarget = null;
    let playheadTarget = null;

    const startPointerDrag = (target, startEvent, onMove, onEnd = () => {}) => {
      const pointerId = startEvent.pointerId;
      target.setPointerCapture?.(pointerId);
      const move = event => {
        if (event.pointerId === pointerId) onMove(event);
      };
      const end = event => {
        if (event.pointerId !== pointerId) return;
        target.releasePointerCapture?.(pointerId);
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', end);
        target.removeEventListener('pointercancel', end);
        onEnd(event);
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', end);
      target.addEventListener('pointercancel', end);
    };

    function handleWheel(event) {
      if (!event.altKey && !event.ctrlKey) return;
      event.preventDefault();
      const daw = getDAW();
      if (event.ctrlKey && event.altKey) {
        const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
        setVerticalZoom(daw.laneHeight * factor);
        return;
      }
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom(daw.pxPerSecond * factor, event.clientX);
    }

    function beginScrub(event) {
      const daw = getDAW();
      if (daw.isRecording) {
        toast('در حال ضبط — برای جابه‌جایی پلی‌هد ابتدا توقف کنید');
        return;
      }
      clearEditorTextSelection();
      clearChordSelection();

      const playheadHit = getElement('playhead-hit');
      const mainPlayhead = getElement('main-playhead');
      if (event.shiftKey && event.currentTarget === playheadHit) {
        event.preventDefault();
        daw.selectedPlayhead = !daw.selectedPlayhead;
        mainPlayhead?.classList?.toggle('selected', daw.selectedPlayhead);
        if (daw.selectedPlayhead) {
          const startX = event.clientX;
          const originalTime = daw.playhead;
          const startY = event.clientY;
          const originalPxPerSecond = daw.pxPerSecond;
          const onMove = moveEvent => {
            const dx = moveEvent.clientX - startX;
            seekTransport(Math.max(0, originalTime + xToTime(dx)), false);
            const dy = startY - moveEvent.clientY;
            if (Math.abs(dy) > 3) {
              const zoomFactor = 1 + dy * 0.002;
              setZoom(
                clamp(originalPxPerSecond * zoomFactor, 4, 800),
                moveEvent.clientX
              );
            }
            autoScrollToPlayhead();
          };
          startPointerDrag(event.currentTarget, event, onMove);
        }
        return;
      }

      clearSelection();
      daw.selectedPlayhead = false;
      mainPlayhead?.classList?.remove('selected');
      event.preventDefault();

      const ruler = getElement('timeline-ruler');
      if (ruler) {
        const rulerRect = ruler.getBoundingClientRect();
        const localY = event.clientY - rulerRect.top;
        const isUpperHalf = localY < rulerRect.height * 0.5;
        if (isUpperHalf && daw.loopEnabled) {
          const time = clientToTime(event.clientX);
          if (event.ctrlKey || event.metaKey) {
            daw.loopB = Math.max(time, daw.loopA + 0.5);
          } else {
            daw.loopA = Math.min(time, daw.loopB - 0.5);
          }
          renderLoopRegion();
          saveState();
          return;
        }
      }

      seekTransport(clientToTime(event.clientX), true);
      const scrubStartX = event.clientX;
      const scrubStartY = event.clientY;
      const scrubOriginalPxPerSecond = daw.pxPerSecond;
      const move = moveEvent => {
        seekTransport(clientToTime(moveEvent.clientX), true);
        const dy = scrubStartY - moveEvent.clientY;
        if (Math.abs(dy) > 3) {
          const zoomFactor = 1 + dy * 0.002;
          setZoom(
            clamp(scrubOriginalPxPerSecond * zoomFactor, 4, 800),
            moveEvent.clientX
          );
        }
        autoScrollToPlayhead();
      };
      startPointerDrag(event.currentTarget, event, move);
    }

    function init() {
      if (initialized) return true;
      const lanes = getElement('lanes-container');
      const scroll = getElement('tl-scroll');
      const ruler = getElement('timeline-ruler');
      const playheadHit = getElement('playhead-hit');
      if (!lanes || !scroll || !ruler || !playheadHit) return false;

      wheelTarget = scroll;
      rulerTarget = ruler;
      playheadTarget = playheadHit;
      wheelTarget.addEventListener('wheel', handleWheel, { passive: false });
      rulerTarget.addEventListener('pointerdown', beginScrub);
      playheadTarget.addEventListener('pointerdown', beginScrub);
      initialized = true;
      toast(translate('dawReady'));
      return true;
    }

    function destroy() {
      if (!initialized) return false;
      wheelTarget?.removeEventListener('wheel', handleWheel);
      rulerTarget?.removeEventListener('pointerdown', beginScrub);
      playheadTarget?.removeEventListener('pointerdown', beginScrub);
      wheelTarget = null;
      rulerTarget = null;
      playheadTarget = null;
      initialized = false;
      return true;
    }

    return Object.freeze({ init, destroy, beginScrub });
  }

  const service = Object.freeze({ create });
  globalScope.EditorTimelineInteractionService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
