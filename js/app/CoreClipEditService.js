/**
 * CoreClipEditService
 *
 * Owns timeline cut orchestration. Clip splitting itself remains injected
 * from CoreClipService so audio waveform and clip identity rules stay in one
 * place.
 */
(function attachCoreClipEditService(globalScope) {
  'use strict';

  function create({
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || {},
    roundMs = value => value,
    splitClipAt = () => null,
    seekTransport = () => {},
    saveState = () => {},
    renderAll = () => {},
    scheduleAllFromPlayhead = () => {},
    toast = () => {},
    translate = value => globalScope.t?.(value) ?? value
  } = {}) {
    function cutAtTime(time, trackId = null) {
      const cutTime = roundMs(time);
      if (!trackId) return false;

      const daw = getDAW();
      const hits = (daw?.clips || []).filter(clip => (
        clip.trackId === trackId &&
        cutTime > clip.start + 0.01 &&
        cutTime < clip.start + clip.duration - 0.01
      ));

      if (!hits.length) {
        seekTransport(cutTime, true);
        toast(translate('noClipToCut'));
        return false;
      }

      const created = [];
      hits.forEach(clip => {
        const right = splitClipAt(clip, cutTime);
        if (right) created.push(right.id);
      });

      seekTransport(cutTime, true);
      if (!created.length) {
        renderAll();
        return false;
      }

      daw.selectedIds = new Set(created);
      saveState();
      renderAll();
      if (daw.isPlaying) scheduleAllFromPlayhead();
      toast(`${translate('clipsCut')}: ${hits.length}`);
      return true;
    }

    return Object.freeze({ cutAtTime });
  }

  const service = Object.freeze({ create });
  globalScope.CoreClipEditService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
