/**
 * CoreFreeWarpService
 *
 * Manages warp markers on audio clips, warp tool mode, and multi-track
 * phase-locked warping.  Integrates FreeWarpEngine (pure math) with
 * the DAW runtime state and WarpAudioRendererService (pitch-preserving
 * time stretch used for playback).
 *
 * Data model extension on each AudioClip:
 *   clip.snapPointOffset  — seconds from clip start to the sync anchor
 *   clip.warpMarkers      — Array<{ id, sourceTime, timelineTime, pinned }>
 */
(function attachCoreFreeWarpService(globalScope) {
  'use strict';

  const WARP_TOOL_MODE = 'warp';
  const MIN_SEGMENT = 0.01; // seconds — minimum distance between markers

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
    scheduleAllFromPlayhead = () => {},
    toast = () => {},
    getWarpAudioRenderer = () => null,
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
     * Ensure a clip has a warpMarkers array whose _start/_end markers track
     * the clip bounds.  For trimmed clips the mapped source window is
     * [clip.offset, clip.offset + clip.duration].  Interior markers follow
     * the audio content when the clip moves.
     */
    function ensureWarpMarkers(clipId) {
      const clip = getClip(clipId);
      if (!clip || clip.type !== 'audio') return;
      const srcDur = clip.sourceDuration || clip.duration;
      const offset = Math.max(0, clip.offset || 0);

      if (!clip.warpMarkers) {
        clip.warpMarkers = FreeWarp.defaultMarkers(
          clip.start,
          clip.duration,
          clip.snapPointOffset || 0,
          offset
        );
        return;
      }

      const markers = FreeWarp.sortMarkers(clip.warpMarkers);
      const startM = markers.find(m => m.id === '_start');
      const endM = markers.find(m => m.id === '_end');
      if (!startM || !endM) {
        clip.warpMarkers = FreeWarp.defaultMarkers(
          clip.start,
          clip.duration,
          clip.snapPointOffset || 0,
          offset
        );
        return;
      }

      // clip moved since markers were last synced → shift content markers
      const delta = clip.start - startM.timelineTime;
      if (Math.abs(delta) > 1e-9) {
        markers.forEach(m => { m.timelineTime += delta; });
      }
      // re-pin bounds to the current clip window (handles resizes too)
      startM.sourceTime = offset;
      startM.timelineTime = clip.start;
      endM.sourceTime = Math.min(offset + clip.duration, srcDur);
      endM.timelineTime = clip.start + clip.duration;

      // keep interior markers strictly inside the bounds
      const lo = clip.start + MIN_SEGMENT;
      const hi = clip.start + clip.duration - MIN_SEGMENT;
      markers.forEach(m => {
        if (m.id === '_start' || m.id === '_end') return;
        m.timelineTime = Math.min(hi, Math.max(lo, m.timelineTime));
      });
      clip.warpMarkers = FreeWarp.sortMarkers(markers);
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
     * sourceTime is computed from existing markers via the warp mapping.
     */
    function insertWarpMarker(clipId, timelineTime) {
      const clip = getClip(clipId);
      if (!clip || clip.type !== 'audio') return null;
      ensureWarpMarkers(clipId);

      const markers = FreeWarp.sortMarkers(clip.warpMarkers);
      const sourceTime = FreeWarp.timelineToSource(timelineTime, markers);
      if (sourceTime == null) return null;

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
      renderWarpAudio(clipId, { reschedule: true });
    }

    /**
     * Move a warp marker to a new timeline position (live during drag).
     * Neighbouring markers stay frozen, so segment A stretches while
     * segment B compresses — the classic 3-marker anchor behaviour.
     * No saveState/renderClips here — the caller drives the drag loop.
     */
    function moveWarpMarker(clipId, markerId, newTimelineTime) {
      const clip = getClip(clipId);
      if (!clip || !clip.warpMarkers) return;

      const markers = FreeWarp.sortMarkers(clip.warpMarkers);
      const dragIdx = markers.findIndex(m => m.id === markerId);
      if (dragIdx < 0) return;

      clip.warpMarkers = FreeWarp.applyWarpDrag(markers, dragIdx, newTimelineTime, null);

      // Multi-track: apply same stretch delta to all selected clips
      const daw = getDAW();
      if (daw?.selectedIds && daw.selectedIds.size > 1) {
        const srcMarker = markers[dragIdx];
        const newMarker = clip.warpMarkers.find(m => m.id === markerId);
        if (srcMarker && newMarker) {
          const delta = newMarker.timelineTime - srcMarker.timelineTime;
          applyGroupWarpDelta(clipId, delta);
        }
      }
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

    /* ---- commit + audio rendering ---- */

    /**
     * Kick (or reuse) a warped-buffer render for the clip's current
     * markers.  When done, refresh the waveform and — when requested —
     * reschedule playback so the audible stretch matches the grid.
     */
    function renderWarpAudio(clipId, { reschedule = false } = {}) {
      const renderer = getWarpAudioRenderer?.();
      const clip = getClip(clipId);
      if (!renderer || !clip || clip.type !== 'audio') return;
      ensureWarpMarkers(clipId);
      renderer.ensureWarpedBuffer(clip, {
        onDone: buffer => {
          refreshClipWaveImage(clip);
          renderClips({ preserveWaveforms: true });
          if (reschedule && buffer && getDAW()?.isPlaying) {
            scheduleAllFromPlayhead();
          }
        }
      });
    }

    /**
     * Commit a warp drag: optionally snap the dragged marker to the grid,
     * persist state, redraw the warped waveform and re-render warped audio
     * so playback stays locked to the metronome/grid.
     */
    function commitWarp(clipId, { markerId = null, timelineTime = null } = {}) {
      const clip = getClip(clipId);
      if (!clip || clip.type !== 'audio') return;
      ensureWarpMarkers(clipId);

      if (markerId && Number.isFinite(Number(timelineTime))) {
        const markers = FreeWarp.sortMarkers(clip.warpMarkers);
        const idx = markers.findIndex(m => m.id === markerId);
        if (idx > 0) {
          clip.warpMarkers = FreeWarp.applyWarpDrag(
            markers,
            idx,
            timelineTime,
            isSnapEnabled() ? snapTime : null
          );
        }
      }

      saveState();
      refreshClipWaveImage(clip);
      renderClips({ preserveWaveforms: true });
      renderWarpAudio(clipId, { reschedule: true });
    }

    /**
     * Warped AudioBuffer for playback (null until rendered / when the
     * marker set does not warp anything).
     */
    function getWarpedAudioBuffer(clip) {
      const renderer = getWarpAudioRenderer?.();
      if (!renderer) return null;
      return renderer.getWarpedBuffer(clip);
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
      // commit + audio
      commitWarp,
      renderWarpAudio,
      getWarpedAudioBuffer,
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
