/*
 * CoreLoopControlService
 *
 * Owns loop commands while CoreLoopVisualService remains responsible for
 * rendering and dragging the loop boundary.
 */
(function attachCoreLoopControlService(globalScope) {
  'use strict';

  function create({
    getDAW = () => globalScope.getEditorDAW?.() || globalScope.DAW,
    getElement = id => globalScope.document?.getElementById?.(id),
    isPerforming = () => false,
    getSelectedClips = () => [],
    setSelectionEnd = () => {},
    renderLoopRegion = () => {},
    updatePlayheadUI = () => {},
    startTransport = () => {},
    stopAllVoices = () => {},
    cancelAnimationFrame = (...args) =>
      globalScope.cancelAnimationFrame?.(...args),
    toast = () => {},
    formatTime = value => String(value)
  } = {}) {
    function toggleLoop() {
      const daw = getDAW();
      if (isPerforming()) {
        toast('لوپ در حالت ارنجر غیرفعال است');
        return;
      }
      daw.loopEnabled = !daw.loopEnabled;
      const button = getElement('loopToggleBtn');
      if (button) button.classList.toggle('loop-active', daw.loopEnabled);
      renderLoopRegion();
      toast(daw.loopEnabled ? 'Loop ON' : 'Loop OFF');
    }

    function setLoopA() {
      const daw = getDAW();
      daw.loopA = daw.playhead;
      if (daw.loopB <= daw.loopA) {
        daw.loopB = Math.max(daw.loopA + 1, daw.loopA + 5);
      }
      renderLoopRegion();
      toast('Loop A: ' + formatTime(daw.loopA));
    }

    function setLoopB() {
      const daw = getDAW();
      daw.loopB = daw.playhead;
      if (daw.loopA >= daw.loopB) {
        daw.loopA = Math.max(0, daw.loopB - 5);
      }
      renderLoopRegion();
      toast('Loop B: ' + formatTime(daw.loopB));
    }

    function clearLoop() {
      const daw = getDAW();
      daw.loopA = 0;
      daw.loopB = 10;
      setSelectionEnd(0);
      renderLoopRegion();
      toast('محدوده پاک شد');
    }

    function getSelectionBounds() {
      const clips = getSelectedClips();
      if (!clips.length) {
        toast('آیتمی انتخاب نشده');
        return null;
      }
      return {
        start: Math.min(...clips.map(clip => clip.start)),
        end: Math.max(...clips.map(clip => clip.start + clip.duration))
      };
    }

    function setLoopFromSelection() {
      const bounds = getSelectionBounds();
      if (!bounds) return;

      const daw = getDAW();
      daw.loopA = bounds.start;
      daw.loopB = bounds.end;
      setSelectionEnd(daw.loopB);
      daw.loopEnabled = false;
      renderLoopRegion();
      toast(
        'محدوده: ' +
          formatTime(daw.loopA) +
          ' → ' +
          formatTime(daw.loopB)
      );
    }

    function setLoopFromSelectionAndPlay() {
      if (isPerforming()) {
        toast('لوپ در حالت ارنجر غیرفعال است');
        return;
      }
      const bounds = getSelectionBounds();
      if (!bounds) return;

      const daw = getDAW();
      daw.loopA = bounds.start;
      daw.loopB = bounds.end;
      daw.loopEnabled = true;
      daw.playhead = daw.loopA;
      const button = getElement('loopToggleBtn');
      if (button) button.classList.add('loop-active');
      renderLoopRegion();
      updatePlayheadUI();

      if (daw.isPlaying) {
        daw.isPlaying = false;
        if (daw.rafId) cancelAnimationFrame(daw.rafId);
        stopAllVoices();
      }
      startTransport();
      toast(
        'Loop ON: ' +
          formatTime(daw.loopA) +
          ' → ' +
          formatTime(daw.loopB)
      );
    }

    return Object.freeze({
      toggleLoop,
      setLoopA,
      setLoopB,
      clearLoop,
      setLoopFromSelection,
      setLoopFromSelectionAndPlay
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreLoopControlService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
