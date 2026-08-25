/**
 * CoreClipService
 *
 * Owns small, stateful clip operations shared by the timeline and editor.
 * Audio waveform rendering remains injected so this service does not own
 * Web Audio or DOM concerns.
 */
(function attachCoreClipService(globalScope) {
  'use strict';

  function create({
    getDAW = () => globalScope.getEditorDAW?.() || globalScope.DAW || {},
    uid = prefix => `${prefix || 'c'}${Date.now()}`,
    roundMs = value => value,
    refreshClipWaveImage = () => {},
    saveState = () => {},
    renderAll = () => {},
    scheduleAllFromPlayhead = () => {},
    toast = () => {},
    translate = value => globalScope.t?.(value) ?? value
  } = {}) {
    function getClip(id) {
      return (getDAW()?.clips || []).find(clip => clip.id === id);
    }

    function selectedClips() {
      const daw = getDAW() || {};
      const selectedIds = daw.selectedIds;
      if (!selectedIds?.has) return [];
      return (daw.clips || []).filter(clip => selectedIds.has(clip.id));
    }

    function splitClipAt(clip, atTime) {
      if (!clip) return null;
      const time = roundMs(atTime);
      if (
        time <= clip.start + 0.01 ||
        time >= clip.start + clip.duration - 0.01
      ) {
        return null;
      }

      const leftDuration = roundMs(time - clip.start);
      const rightDuration = roundMs(clip.duration - leftDuration);
      clip.duration = leftDuration;
      if (clip.type === 'audio') refreshClipWaveImage(clip);

      const right = {
        ...clip,
        id: uid('c'),
        start: time,
        duration: rightDuration
      };
      if (clip.type === 'audio') {
        right.offset = roundMs(clip.offset + leftDuration);
        refreshClipWaveImage(right);
      }

      const daw = getDAW();
      if (Array.isArray(daw.clips)) daw.clips.push(right);
      return right;
    }

    function splitSelectedAtPlayhead() {
      const selected = selectedClips();
      if (!selected.length) {
        toast(translate('nothingSelected'));
        return;
      }

      const created = [];
      const playhead = getDAW()?.playhead;
      selected.forEach(clip => {
        const right = splitClipAt(clip, playhead);
        if (right) created.push(right.id);
      });

      if (!created.length) return;
      const daw = getDAW();
      daw.selectedIds = new Set(created);
      saveState();
      renderAll();
      if (daw.isPlaying) scheduleAllFromPlayhead();
      toast(translate('splitDone'));
    }

    return Object.freeze({
      getClip,
      selectedClips,
      splitClipAt,
      splitSelectedAtPlayhead
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreClipService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
