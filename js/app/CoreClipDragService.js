/*
 * CoreClipDragService
 *
 * Owns timeline clip/section move and resize mutations. Pointer event
 * orchestration remains in CoreClipInteractionService; this module only
 * changes DAW drag state and commits the completed operation.
 */
(function attachCoreClipDragService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getClip = () => null,
    xToTime = value => value,
    snapTime = value => value,
    roundMs = value => value,
    clamp = (value, min, max) => Math.max(min, Math.min(max, value)),
    ensureTimelineFits = () => {},
    refreshClipWaveImage = () => {},
    saveState = () => {},
    scheduleAllFromPlayhead = () => {},
    renderAll = () => {},
    isSnapEnabled = () => false,
    getFreeWarpService = () => null
  } = {}) {
    // Snap-to-snapPoint: when snap is ON, align the clip's snapPoint to the grid
    function snapWithSnapPoint(newStart, clip) {
      if (!isSnapEnabled()) return newStart;
      const snapOffset = clip?.snapPointOffset || 0;
      if (snapOffset <= 0) return snapTime(newStart);
      // snap the snapPoint position, not the clip start
      const snapPointTime = newStart + snapOffset;
      const snappedGrid = snapTime(snapPointTime);
      return snappedGrid - snapOffset;
    }

    // Keep warp markers glued to the clip window: _start/_end re-pin to the
    // clip bounds and interior markers follow the audio content shift.
    function syncWarpMarkersToClip(clip, interiorShift = 0) {
      if (!clip?.warpMarkers) return;
      const srcDur = clip.sourceDuration || clip.duration;
      const offset = Math.max(0, clip.offset || 0);
      clip.warpMarkers = clip.warpMarkers.map(m => {
        if (m.id === '_start') {
          return { ...m, sourceTime: offset, timelineTime: clip.start };
        }
        if (m.id === '_end') {
          return {
            ...m,
            sourceTime: Math.min(offset + clip.duration, srcDur),
            timelineTime: clip.start + clip.duration
          };
        }
        return { ...m, timelineTime: m.timelineTime + interiorShift };
      });
    }

    let dragOverLaneTrackId = null;
    let dragOverLaneTrackIndex = null;

    function audioTrackIds(daw) {
      return (daw?.tracks || [])
        .filter(track => track?.type === 'audio')
        .map(track => track.id);
    }

    function trackIndexForClip(item, daw) {
      const trackId = item?.origTrackId || getClip(item?.id)?.trackId;
      return audioTrackIds(daw).indexOf(trackId);
    }

    function updateDragOverLane(event, daw) {
      const pointerTarget =
        documentRef?.elementFromPoint?.(event.clientX, event.clientY) ||
        event.target;
      const targetLane = pointerTarget?.closest?.('.track-lane');
      if (!targetLane) {
        dragOverLaneTrackId = null;
        dragOverLaneTrackIndex = null;
        return;
      }

      const laneTrackId = targetLane.dataset?.trackId;
      const targetTrack = (daw.tracks || []).find(
        track => track.id === laneTrackId
      );
      if (targetTrack?.type !== 'audio') {
        dragOverLaneTrackId = null;
        dragOverLaneTrackIndex = null;
        return;
      }
      dragOverLaneTrackId = laneTrackId;
      dragOverLaneTrackIndex = audioTrackIds(daw).indexOf(laneTrackId);
    }

    function updateMoveDrag(delta, daw) {
      daw.drag.items.forEach(item => {
        const target = item._isSection
          ? (daw.sections || []).find(section => section.id === item.id)
          : getClip(item.id);
        if (!target) return;
        const clip = !item._isSection ? getClip(item.id) : null;
        target.start = Math.max(
          0,
          roundMs(snapWithSnapPoint(item.origStart + delta, clip))
        );
        if (clip?.warpMarkers) {
          // Warp markers ride along with the audio content; apply the shift
          // from the drag-origin snapshot so it never compounds per event.
          if (!item._origWarpMarkers) {
            item._origWarpMarkers = clip.warpMarkers.map(m => ({ ...m }));
          }
          const shift = target.start - item.origStart;
          clip.warpMarkers = item._origWarpMarkers.map(m => ({
            ...m,
            timelineTime: m.timelineTime + shift
          }));
        }
        ensureTimelineFits(
          target.start + (target.duration || item.origDur) + 5
        );
      });
    }

    function updateResizeDrag(delta, daw) {
      const item = daw.drag.items.find(
        entry => entry.id === daw.drag.primaryId
      );
      const clip = getClip(daw.drag.primaryId);
      if (!item || !clip) return;

      if (daw.drag.edge === 'right') {
        const maxDur = clip.type === 'chord'
          ? 1000
          : clip.sourceDuration - clip.offset;
        clip.duration = clamp(
          roundMs(snapTime(item.origDur + delta)),
          0.03,
          maxDur
        );
        if (clip.type === 'audio') {
          syncWarpMarkersToClip(clip, 0);
          refreshClipWaveImage(clip);
        }
        return;
      }

      let newStart = item.origStart + delta;
      let newOffset = item.origOffset + delta;
      let newDuration = item.origDur - delta;
      if (clip.type === 'chord') {
        if (newStart < 0) {
          newDuration += newStart;
          newStart = 0;
        }
        if (newDuration > 0.03) {
          clip.start = roundMs(snapTime(newStart));
          clip.duration = roundMs(
            item.origStart + item.origDur - snapTime(newStart)
          );
        }
        return;
      }

      if (newOffset < 0) {
        newStart -= newOffset;
        newDuration += newOffset;
        newOffset = 0;
      }
      if (newStart < 0) {
        const shift = -newStart;
        newStart = 0;
        newOffset += shift;
        newDuration -= shift;
      }
      if (
        newDuration >= 0.03 &&
        newOffset + newDuration <= clip.sourceDuration + 1e-6
      ) {
        clip.start = roundMs(newStart);
        clip.offset = roundMs(newOffset);
        clip.duration = roundMs(newDuration);
        if (clip.warpMarkers) {
          // the clip head moved — interior markers follow the audio
          syncWarpMarkersToClip(clip, clip.start - item.origStart);
        }
        refreshClipWaveImage(clip);
      }
    }

    function applyGroupTrackDrop(daw) {
      if (
        !daw?.drag ||
        daw.drag.type !== 'move' ||
        dragOverLaneTrackIndex == null
      ) {
        return;
      }

      const trackIds = audioTrackIds(daw);
      const clipItems = daw.drag.items.filter(item => !item._isSection);
      if (!clipItems.length) return;

      const primaryItem = clipItems.find(
        item => item.id === daw.drag.primaryId
      ) || clipItems[0];
      const primaryIndex = trackIndexForClip(primaryItem, daw);
      if (primaryIndex < 0) return;

      const originalIndices = clipItems
        .map(item => trackIndexForClip(item, daw))
        .filter(index => index >= 0);
      if (!originalIndices.length) return;

      const desiredDelta = dragOverLaneTrackIndex - primaryIndex;
      const minimumDelta = -Math.min(...originalIndices);
      const maximumDelta =
        trackIds.length - 1 - Math.max(...originalIndices);
      const trackDelta = clamp(
        desiredDelta,
        minimumDelta,
        Math.max(minimumDelta, maximumDelta)
      );

      clipItems.forEach(item => {
        const clip = getClip(item.id);
        const originalIndex = trackIndexForClip(item, daw);
        const destination = trackIds[originalIndex + trackDelta];
        if (clip && destination) clip.trackId = destination;
      });
    }

    function update(event) {
      const daw = getDAW();
      if (!daw?.drag) return false;

      const delta = xToTime(event.clientX - daw.drag.startX);
      if (daw.drag.type === 'move') {
        updateDragOverLane(event, daw);
        updateMoveDrag(delta, daw);
      } else if (daw.drag.type === 'resize') {
        updateResizeDrag(delta, daw);
      }
      return true;
    }

    function finish() {
      const daw = getDAW();
      if (!daw?.drag) return false;

      if (daw.drag.type === 'move' && dragOverLaneTrackId) {
        applyGroupTrackDrop(daw);
      }
      // Moved/resized warped clips need a fresh stretched buffer so
      // playback keeps matching the new marker layout.
      const warpService = getFreeWarpService?.();
      if (warpService) {
        daw.drag.items.forEach(item => {
          if (item._isSection) return;
          const clip = getClip(item.id);
          if (clip?.type === 'audio' && clip.warpMarkers) {
            warpService.renderWarpAudio(item.id, { reschedule: true });
          }
        });
      }
      dragOverLaneTrackId = null;
      dragOverLaneTrackIndex = null;
      daw.drag = null;
      saveState();
      if (daw.isPlaying) scheduleAllFromPlayhead();
      renderAll();
      return true;
    }

    return Object.freeze({ update, finish });
  }

  const service = Object.freeze({ create });
  globalScope.CoreClipDragService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
