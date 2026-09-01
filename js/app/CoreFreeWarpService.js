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

    function getSelectedAudioClipIds(primaryClipId) {
      const daw = getDAW();
      const clipIds = new Set([primaryClipId]);
      const selectedIds = daw?.selectedIds;
      if (selectedIds?.forEach) {
        selectedIds.forEach(selectedId => {
          const selectedClip = getClip(selectedId);
          if (selectedClip?.type === 'audio') clipIds.add(selectedId);
        });
      }
      return [...clipIds];
    }

    function getGroupMarker(
      clip,
      primaryMarkers,
      primaryMarkerId,
      primaryMarkerIndex
    ) {
      if (!clip || !primaryMarkers?.length) return null;
      ensureWarpMarkers(clip.id);
      let markers = FreeWarp.sortMarkers(clip.warpMarkers);
      let markerIndex = markers.findIndex(
        marker => marker.id === primaryMarkerId
      );
      if (markerIndex > 0 && markerIndex < markers.length - 1) {
        return { markers, markerIndex };
      }

      const groupMarkerId = `group_${primaryMarkerId}`;
      markerIndex = markers.findIndex(marker => marker.id === groupMarkerId);
      if (markerIndex > 0 && markerIndex < markers.length - 1) {
        return { markers, markerIndex };
      }

      if (
        primaryMarkerIndex > 0 &&
        primaryMarkerIndex < primaryMarkers.length - 1 &&
        primaryMarkerIndex < markers.length - 1
      ) {
        return { markers, markerIndex: primaryMarkerIndex };
      }

      const primaryMarker = primaryMarkers[primaryMarkerIndex];
      const primaryStart = primaryMarkers[0];
      const primaryEnd = primaryMarkers[primaryMarkers.length - 1];
      if (!primaryMarker || !primaryStart || !primaryEnd) return null;

      const sourceSpan = primaryEnd.sourceTime - primaryStart.sourceTime;
      const timelineSpan =
        primaryEnd.timelineTime - primaryStart.timelineTime;
      const sourceRatio = sourceSpan > 1e-9
        ? (primaryMarker.sourceTime - primaryStart.sourceTime) / sourceSpan
        : timelineSpan > 1e-9
          ? (primaryMarker.timelineTime - primaryStart.timelineTime) / timelineSpan
          : 0.5;
      const normalizedRatio = Math.min(
        0.99,
        Math.max(0.01, Number.isFinite(sourceRatio) ? sourceRatio : 0.5)
      );
      const targetStart = markers[0];
      const targetEnd = markers[markers.length - 1];
      const sourceTime =
        targetStart.sourceTime +
        normalizedRatio * (targetEnd.sourceTime - targetStart.sourceTime);
      const timelineTime =
        targetStart.timelineTime +
        normalizedRatio * (targetEnd.timelineTime - targetStart.timelineTime);

      markers = FreeWarp.insertMarker(
        markers,
        groupMarkerId,
        sourceTime,
        timelineTime,
        false
      );
      clip.warpMarkers = markers;
      markerIndex = markers.findIndex(marker => marker.id === groupMarkerId);
      return markerIndex > 0 && markerIndex < markers.length - 1
        ? { markers, markerIndex }
        : null;
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
      if (!clip || clip.type !== 'audio') return;
      ensureWarpMarkers(clipId);

      const markers = FreeWarp.sortMarkers(clip.warpMarkers);
      const dragIdx = markers.findIndex(m => m.id === markerId);
      if (dragIdx < 0) return;

      clip.warpMarkers = FreeWarp.applyWarpDrag(markers, dragIdx, newTimelineTime, null);

      const sourceMarker = markers[dragIdx];
      const movedMarker = clip.warpMarkers.find(m => m.id === markerId);
      if (sourceMarker && movedMarker) {
        const delta = movedMarker.timelineTime - sourceMarker.timelineTime;
        applyGroupWarpDelta(
          clipId,
          delta,
          markers,
          markerId,
          dragIdx
        );
      }
    }

    /**
     * Apply the same warp ratio to all selected clips (phase-locked).
     */
    function applyGroupWarpDelta(
      primaryClipId,
      delta,
      primaryMarkers,
      primaryMarkerId,
      primaryMarkerIndex
    ) {
      if (!Number.isFinite(delta) || Math.abs(delta) < 1e-12) return;

      getSelectedAudioClipIds(primaryClipId).forEach(selectedClipId => {
        if (selectedClipId === primaryClipId) return;
        const clip = getClip(selectedClipId);
        const groupMarker = getGroupMarker(
          clip,
          primaryMarkers,
          primaryMarkerId,
          primaryMarkerIndex
        );
        if (!groupMarker) return;
        const currentMarker = groupMarker.markers[groupMarker.markerIndex];
        clip.warpMarkers = FreeWarp.applyWarpDrag(
          groupMarker.markers,
          groupMarker.markerIndex,
          currentMarker.timelineTime + delta,
          null
        );
        refreshClipWaveImage(clip);
      });
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
    function renderWarpAudio(
      clipId,
      { reschedule = false, onDone = null } = {}
    ) {
      const renderer = getWarpAudioRenderer?.();
      const clip = getClip(clipId);
      if (!renderer || !clip || clip.type !== 'audio') {
        onDone?.(null);
        return;
      }
      ensureWarpMarkers(clipId);
      renderer.ensureWarpedBuffer(clip, {
        onDone: buffer => {
          refreshClipWaveImage(clip);
          renderClips({ preserveWaveforms: true });
          onDone?.(buffer);
          if (reschedule && buffer && getDAW()?.isPlaying) {
            scheduleAllFromPlayhead();
          }
        }
      });
    }

    function renderWarpGroupAudio(clipIds, { reschedule = false } = {}) {
      const renderer = getWarpAudioRenderer?.();
      if (!renderer) return;
      const audioClipIds = clipIds.filter(clipId => {
        const clip = getClip(clipId);
        return clip?.type === 'audio';
      });
      if (!audioClipIds.length) return;

      let pending = audioClipIds.length;
      const onDone = () => {
        pending -= 1;
        if (pending === 0 && reschedule && getDAW()?.isPlaying) {
          scheduleAllFromPlayhead();
        }
      };
      audioClipIds.forEach(clipId => {
        renderWarpAudio(clipId, { onDone });
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
      const groupClipIds = getSelectedAudioClipIds(clipId);
      const primaryMarkers = FreeWarp.sortMarkers(clip.warpMarkers);
      let primaryMarkerIndex = -1;
      let warpDelta = 0;

      if (markerId && Number.isFinite(Number(timelineTime))) {
        primaryMarkerIndex = primaryMarkers.findIndex(
          marker => marker.id === markerId
        );
        if (
          primaryMarkerIndex > 0 &&
          primaryMarkerIndex < primaryMarkers.length - 1
        ) {
          const oldTimelineTime =
            primaryMarkers[primaryMarkerIndex].timelineTime;
          clip.warpMarkers = FreeWarp.applyWarpDrag(
            primaryMarkers,
            primaryMarkerIndex,
            timelineTime,
            isSnapEnabled() ? snapTime : null
          );
          const committedMarker = clip.warpMarkers.find(
            marker => marker.id === markerId
          );
          if (committedMarker) {
            warpDelta =
              committedMarker.timelineTime - oldTimelineTime;
          }
          if (Math.abs(warpDelta) > 1e-12) {
            applyGroupWarpDelta(
              clipId,
              warpDelta,
              primaryMarkers,
              markerId,
              primaryMarkerIndex
            );
          }
        }
      }

      groupClipIds.forEach(selectedClipId => {
        const selectedClip = getClip(selectedClipId);
        if (!selectedClip || selectedClip.type !== 'audio') return;
        ensureWarpMarkers(selectedClipId);
        refreshClipWaveImage(selectedClip);
      });
      saveState();
      renderClips({ preserveWaveforms: true });
      renderWarpGroupAudio(groupClipIds, { reschedule: true });
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
