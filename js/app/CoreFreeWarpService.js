/**
 * CoreFreeWarpService
 *
 * Manages warp markers on audio clips, warp tool mode, and multi-track
 * phase-locked warping.  Integrates FreeWarpEngine (pure math) with
 * the DAW runtime state.
 *
 * Data model extension on each AudioClip:
 *   clip.snapPointOffset  — seconds from clip start to the sync anchor
 *   clip.warpMarkers      — Array<{ id, sourceTime, timelineTime, pinned }>
 */
(function attachCoreFreeWarpService(globalScope) {
  'use strict';

  const WARP_TOOL_MODE = 'warp';

  function create({
    getDAW = () => null,
    getClip = () => null,
    getTransportState = () => ({}),
    snapTime = v => v,
    isSnapEnabled = () => false,
    roundMs = v => v,
    saveState = () => {},
    renderAll = () => {},
    renderClips = () => {},
    refreshClipWaveImage = () => {},
    toast = () => {},
    uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    FreeWarp = globalScope.FreeWarpEngine
  } = {}) {

    /* ---- snap marker ---- */

    /**
     * Set or move the snap point offset on a clip.
     * offset is in seconds from clip start.
     */
    function setSnapPoint(clipId, offset) {
      const clip = getClip(clipId);
      if (!clip || clip.type !== 'audio') return;
      clip.snapPointOffset = Math.max(0, Number(offset) || 0);
      saveState();
      renderClips();
    }

    /**
     * Get the snap point offset (default 0).
     */
    function getSnapPoint(clipId) {
      const clip = getClip(clipId);
      return clip?.snapPointOffset || 0;
    }

    /**
     * Get the snap point absolute timeline position.
     */
    function getSnapPointTime(clipId) {
      const clip = getClip(clipId);
      if (!clip) return 0;
      return clip.start + (clip.snapPointOffset || 0);
    }

    /* ---- warp markers ---- */

    /**
     * Ensure a clip has a warpMarkers array with default start/end markers.
     */
    function ensureWarpMarkers(clipId) {
      const clip = getClip(clipId);
      if (!clip || clip.type !== 'audio') return;
      if (!clip.warpMarkers) {
        clip.warpMarkers = FreeWarp.defaultMarkers(
          clip.start,
          clip.sourceDuration || clip.duration,
          clip.snapPointOffset || 0
        );
      }
    }

    /**
     * Get warp markers for a clip (sorted by timelineTime).
     */
    function getWarpMarkers(clipId) {
      ensureWarpMarkers(clipId);
      const clip = getClip(clipId);
      return clip ? FreeWarp.sortMarkers(clip.warpMarkers) : [];
    }

    /**
     * Insert a warp marker at a timeline position.
     * sourceTime is computed from existing markers via inverse mapping.
     */
    function insertWarpMarker(clipId, timelineTime) {
      const clip = getClip(clipId);
      if (!clip || clip.type !== 'audio') return null;
      ensureWarpMarkers(clipId);

      const markers = FreeWarp.sortMarkers(clip.warpMarkers);
      const srcTime = FreeWarp.sourceToTimeline(timelineTime, markers);
      // sourceToTimeline gives us the source position for the given timeline position
      // But we actually want the inverse: given a timeline position, what source time does it map to?
      // The function name is confusing — let me use timelineToSource instead
      const sourceTime = FreeWarp.timelineToSource(timelineTime, markers);

      const id = `wm_${uid('w')}`;
      clip.warpMarkers = FreeWarp.insertMarker(markers, id, sourceTime, timelineTime, false);
      saveState();
      renderClips();
      return id;
    }

    /**
     * Remove a warp marker by id.
     */
    function removeWarpMarker(clipId, markerId) {
      const clip = getClip(clipId);
      if (!clip || !clip.warpMarkers) return;
      clip.warpMarkers = FreeWarp.removeMarker(clip.warpMarkers, markerId);
      saveState();
      renderClips();
    }

    /**
     * Move a warp marker to a new timeline position.
     * If snap is on, the position is snapped to grid.
     * For multi-track: applies the same stretch ratio to all selected clips.
     */
    function moveWarpMarker(clipId, markerId, newTimelineTime) {
      const clip = getClip(clipId);
      if (!clip || !clip.warpMarkers) return;

      const markers = FreeWarp.sortMarkers(clip.warpMarkers);
      const dragIdx = markers.findIndex(m => m.id === markerId);
      if (dragIdx < 0) return;

      // Caller handles snap before calling — just apply the drag
      clip.warpMarkers = FreeWarp.applyWarpDrag(markers, dragIdx, newTimelineTime, null);

      // Multi-track: apply same stretch ratio to all selected clips
      const daw = getDAW();
      if (daw?.selectedIds && daw.selectedIds.size > 1) {
        const srcMarker = markers[dragIdx];
        const newMarker = clip.warpMarkers.find(m => m.id === markerId);
        if (srcMarker && newMarker) {
          const delta = newMarker.timelineTime - srcMarker.timelineTime;
          applyGroupWarpDelta(clipId, delta);
        }
      }
      // No saveState/renderClips here — caller does that on drag end
    }

    /**
     * Apply the same warp ratio to all selected clips (phase-locked).
     */
    function applyGroupWarpDelta(primaryClipId, delta) {
      const daw = getDAW();
      if (!daw?.selectedIds) return;

      for (const cid of daw.selectedIds) {
        if (cid === primaryClipId) continue;
        const clip = getClip(cid);
        if (!clip || clip.type !== 'audio' || !clip.warpMarkers) continue;
        // Shift all non-pinned markers by the same time delta
        clip.warpMarkers = clip.warpMarkers.map(m =>
          m.pinned ? m : { ...m, timelineTime: m.timelineTime + delta }
        );
      }
    }

    /**
     * Recalculate all warp markers when a clip is moved on the timeline.
     * Shifts all marker timelineTimes by the delta.
     */
    function shiftWarpMarkers(clipId, delta) {
      const clip = getClip(clipId);
      if (!clip || !clip.warpMarkers) return;
      clip.warpMarkers = clip.warpMarkers.map(m => ({
        ...m,
        timelineTime: m.timelineTime + delta
      }));
    }

    /**
     * Get source time for a given timeline position on a clip.
     * Returns the source audio sample time for playback.
     */
    function getSourceTime(clipId, timelineTime) {
      ensureWarpMarkers(clipId);
      const clip = getClip(clipId);
      if (!clip) return timelineTime;
      const markers = FreeWarp.sortMarkers(clip.warpMarkers);
      return FreeWarp.timelineToSource(timelineTime, markers);
    }

    /**
     * Get the effective warped duration of a clip.
     */
    function getWarpedDuration(clipId) {
      ensureWarpMarkers(clipId);
      const clip = getClip(clipId);
      if (!clip) return 0;
      return FreeWarp.effectiveDuration(FreeWarp.sortMarkers(clip.warpMarkers));
    }

    /* ---- mode management ---- */

    function setWarpMode(active) {
      const state = getTransportState();
      if (state) {
        state.toolMode = active ? WARP_TOOL_MODE : 'pointer';
      }
    }

    function isWarpMode() {
      const state = getTransportState();
      return state?.toolMode === WARP_TOOL_MODE;
    }

    /* ---- public API ---- */

    return Object.freeze({
      // snap marker
      setSnapPoint,
      getSnapPoint,
      getSnapPointTime,
      // warp markers
      ensureWarpMarkers,
      getWarpMarkers,
      insertWarpMarker,
      removeWarpMarker,
      moveWarpMarker,
      shiftWarpMarkers,
      getSourceTime,
      getWarpedDuration,
      // mode
      setWarpMode,
      isWarpMode,
      // constants
      WARP_TOOL_MODE
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreFreeWarpService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
