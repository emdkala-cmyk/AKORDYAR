/*
 * CoreLoopControlService
 *
 * Owns loop commands while CoreLoopVisualService remains responsible for
 * rendering and dragging the loop boundary.
 */
(function attachCoreLoopControlService(globalScope) {
  'use strict';

  function create({
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
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
    isSnapEnabled = () => true,
    snapTime = value => value,
    toast = () => {},
    formatTime = value => String(value)
  } = {}) {
    function loopTimeFrom(value) {
      const numeric = Number(value);
      const bounded = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
      const snapped = isSnapEnabled()
        ? Number(snapTime(bounded))
        : bounded;
      return Number.isFinite(snapped) ? Math.max(0, snapped) : bounded;
    }

    function restartPlaybackFromLoopStart(daw) {
      if (!daw?.isPlaying) return false;

      daw.playhead = daw.loopA;
      daw.isPlaying = false;
      if (daw.rafId != null) {
        cancelAnimationFrame(daw.rafId);
        daw.rafId = null;
      }
      stopAllVoices();
      updatePlayheadUI();
      startTransport();
      return true;
    }

    function toggleLoop() {
      const daw = getDAW();
      if (isPerforming()) {        toast(t('loopDisabledInArranger'));
        return;
      }
      daw.loopEnabled = !daw.loopEnabled;
      const button = getElement('loopToggleBtn');
      if (button) button.classList.toggle('loop-active', daw.loopEnabled);
      renderLoopRegion();
      if (daw.loopEnabled && daw.loopB > daw.loopA) {
        restartPlaybackFromLoopStart(daw);
      }
      toast(daw.loopEnabled ? 'Loop ON' : 'Loop OFF');
    }

    function setLoopA() {
      const daw = getDAW();
      daw.loopA = loopTimeFrom(daw.playhead);
      if (daw.loopB <= daw.loopA) {
        daw.loopB = Math.max(daw.loopA + 1, daw.loopA + 5);
      }
      renderLoopRegion();
      toast('Loop A: ' + formatTime(daw.loopA));
    }

    function setLoopB() {
      const daw = getDAW();
      daw.loopB = loopTimeFrom(daw.playhead);
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
      toast(t('rangeCleared'));
    }

    function getSelectionBounds() {
      const clips = getSelectedClips();
      if (!clips.length) {
        toast(t('nothingSelected'));
        return null;
      }
      return {
        start: loopTimeFrom(Math.min(...clips.map(clip => clip.start))),
        end: loopTimeFrom(
          Math.max(...clips.map(clip => clip.start + clip.duration))
        )
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
      if (isPerforming()) {        toast(t('loopDisabledInArranger'));
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

      if (daw.isPlaying) {
        restartPlaybackFromLoopStart(daw);
      } else {
        updatePlayheadUI();
        startTransport();
      }
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
