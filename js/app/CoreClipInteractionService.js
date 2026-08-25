/*
 * CoreClipInteractionService
 *
 * Owns clip pointer events, drag/resize updates and marquee selection.
 * The service keeps the existing DAW state contract while allowing core.js
 * to provide only the runtime dependencies and public bridge.
 */
(function attachCoreClipInteractionService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getDAW = () => globalScope.getEditorDAW?.() || globalScope.DAW,
    getClip = id => globalScope.getClip?.(id),
    selectedClips = () => globalScope.selectedClips?.() || [],
    clearEditorTextSelection = () => {},
    clearChordSelection = () => globalScope.edClearChordSelection?.(),
    renderClips = () => {},
    renderAll = () => {},
    renderRuler = () => {},
    updateHud = () => {},
    clientToTime = value => value,
    clientToInnerPoint = (x, y) => ({ x, y }),
    xToTime = value => value,
    snapTime = value => value,
    roundMs = value => value,
    clamp = (value, min, max) => Math.max(min, Math.min(max, value)),
    ensureTimelineFits = () => {},
    refreshClipWaveImage = () => {},
    peaksFromBuffer = () => [],
    cutAtTime = () => {},
    openTimelineChordEditor = () => {},
    startPointerDrag = () => {},
    saveState = () => {},
    scheduleAllFromPlayhead = () => {},
    toast = () => {},
    uid = prefix => `${prefix}${Date.now()}`,
    clearTimer = globalScope.clearTimeout
  } = {}) {
    let dragOverLaneTrackId = null;

    function getSelectedSectionIds(daw) {
      if (!(daw.selectedSectionIds instanceof Set)) {
        daw.selectedSectionIds = new Set(daw.selectedSectionIds || []);
      }
      return daw.selectedSectionIds;
    }

    function getMarqueeLaneElements(selector) {
      const marquee = getDAW()?.marquee;
      const trackId = String(marquee?.trackId ?? '');
      if (!trackId) return [];

      const lane = Array.from(
        documentRef?.querySelectorAll?.('.track-lane') || []
      ).find(element => String(element.dataset?.trackId ?? '') === trackId);
      return lane
        ? Array.from(lane.querySelectorAll?.(selector) || [])
        : [];
    }

    function onClipMouseDown(event) {
      if (event.button !== 0) return;

      clearEditorTextSelection();
      clearChordSelection();
      getElement('editor')?.blur?.();

      const daw = getDAW();
      const selectedSectionIds = getSelectedSectionIds(daw);
      if (selectedSectionIds.size > 0) {
        selectedSectionIds.clear();
        renderClips();
      }

      event.stopPropagation?.();
      event.preventDefault?.();

      const clipId = event.currentTarget?.dataset?.clipId;
      const clip = getClip(clipId);
      if (!clip) return;

      const track = (daw.tracks || []).find(item => item.id === clip.trackId);
      if (track?.locked) {
        toast('ترک قفل است');
        return;
      }

      clearChordSelection();

      const now = Date.now();
      const dx = Math.abs(event.clientX - (clip._clickX || 0));
      const dy = Math.abs(event.clientY - (clip._clickY || 0));
      if (
        clip._clickTimer &&
        (now - (clip._clickTime || 0)) < 350 &&
        dx < 5 &&
        dy < 5
      ) {
        clearTimer?.(clip._clickTimer);
        clip._clickTimer = null;
        if (clip.type === 'chord') openTimelineChordEditor(clip.id);
        return;
      }

      clip._clickX = event.clientX;
      clip._clickY = event.clientY;
      clip._clickTime = now;
      clip._clickTimer = globalScope.setTimeout?.(
        () => { clip._clickTimer = null; },
        350
      );

      if (event.shiftKey) {
        cutAtTime(clientToTime(event.clientX), clip.trackId);
        return;
      }

      if (event.altKey) {
        const selected = selectedClips();
        if (!selected.find(item => item.id === clipId)) {
          daw.selectedIds = new Set([clipId]);
        }

        const duplicates = selectedClips();
        const newIds = [];
        const dragItems = [];
        duplicates.forEach(item => {
          const newClip = { ...item, id: uid('c') };
          delete newClip._peaks;
          if (item.type === 'audio') {
            const buffer = daw.bufferCache?.get?.(item.bufferKey);
            if (buffer) newClip._peaks = peaksFromBuffer(buffer, 2000);
            refreshClipWaveImage(newClip);
          }
          daw.clips.push(newClip);
          newIds.push(newClip.id);
          dragItems.push({
            id: newClip.id,
            origStart: newClip.start,
            origDur: newClip.duration,
            origOffset: newClip.offset
          });
        });

        daw.selectedIds = new Set(newIds);
        daw.drag = {
          type: 'move',
          edge: null,
          primaryId: dragItems[0]?.id,
          startX: event.clientX,
          items: dragItems
        };
        renderAll();
        startPointerDrag(
          getElement('tl-inner') || event.currentTarget,
          event,
          onDocMouseMove,
          onDocMouseUp
        );
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (daw.selectedIds.has(clipId)) daw.selectedIds.delete(clipId);
        else daw.selectedIds.add(clipId);
        renderClips();
        return;
      }

      if (!daw.selectedIds.has(clipId)) {
        daw.selectedIds = new Set([clipId]);
        selectedSectionIds.clear();
        renderClips();
      }

      const edge = event.target?.dataset?.edge || null;
      const dragItems = edge
        ? [{
            id: clipId,
            origStart: clip.start,
            origDur: clip.duration,
            origOffset: clip.offset
          }]
        : selectedClips()
          .map(item => ({
            id: item.id,
            origStart: item.start,
            origDur: item.duration,
            origOffset: item.offset
          }))
          .concat(
            (daw.sections || [])
              .filter(section => selectedSectionIds.has(section.id))
              .map(section => ({
                id: section.id,
                origStart: section.start,
                origDur: section.duration,
                origOffset: 0,
                _isSection: true
              }))
          );

      daw.drag = {
        type: edge ? 'resize' : 'move',
        edge,
        primaryId: clipId,
        startX: event.clientX,
        items: dragItems
      };
      startPointerDrag(
        getElement('tl-inner') || event.currentTarget,
        event,
        onDocMouseMove,
        onDocMouseUp
      );
    }

    function updateDragOverLane(event, daw) {
      const pointerTarget =
        documentRef?.elementFromPoint?.(event.clientX, event.clientY) ||
        event.target;
      const targetLane = pointerTarget?.closest?.('.track-lane');
      if (!targetLane) {
        dragOverLaneTrackId = null;
        return;
      }

      const laneTrackId = targetLane.dataset?.trackId;
      const targetTrack = (daw.tracks || []).find(
        track => track.id === laneTrackId
      );
      dragOverLaneTrackId =
        targetTrack?.type === 'audio' ? laneTrackId : null;
    }

    function updateMoveDrag(delta, daw) {
      daw.drag.items.forEach(item => {
        const target = item._isSection
          ? (daw.sections || []).find(section => section.id === item.id)
          : getClip(item.id);
        if (!target) return;
        target.start = Math.max(
          0,
          roundMs(snapTime(item.origStart + delta))
        );
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
        if (clip.type === 'audio') refreshClipWaveImage(clip);
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
        refreshClipWaveImage(clip);
      }
    }

    function intersects(element, x1, y1, x2, y2, innerRect) {
      const rect = element.getBoundingClientRect();
      const cx1 = rect.left - innerRect.left;
      const cy1 = rect.top - innerRect.top;
      const cx2 = cx1 + rect.width;
      const cy2 = cy1 + rect.height;
      return !(cx2 < x1 || cx1 > x2 || cy2 < y1 || cy1 > y2);
    }

    function updateMarquee(event, daw) {
      const point = clientToInnerPoint(event.clientX, event.clientY);
      const x1 = Math.min(daw.marquee.x0, point.x);
      const y1 = Math.min(daw.marquee.y0, point.y);
      const x2 = Math.max(daw.marquee.x0, point.x);
      const y2 = Math.max(daw.marquee.y0, point.y);
      const box = getElement('marquee');
      if (box?.style) {
        box.style.display = 'block';
        box.style.left = `${x1}px`;
        box.style.top = `${y1}px`;
        box.style.width = `${x2 - x1}px`;
        box.style.height = `${y2 - y1}px`;
      }

      const inner = getElement('tl-inner');
      if (!inner?.getBoundingClientRect) return;
      const innerRect = inner.getBoundingClientRect();
      const clipIds = [];
      getMarqueeLaneElements('.clip').forEach(element => {
        const clip = getClip(element.dataset?.clipId);
        if (
          clip &&
          intersects(element, x1, y1, x2, y2, innerRect)
        ) {
          clipIds.push(element.dataset.clipId);
        }
      });
      daw.selectedIds = new Set(clipIds);
      documentRef?.querySelectorAll?.('.clip')?.forEach?.(element => {
        element.classList.toggle(
          'selected',
          daw.selectedIds.has(element.dataset?.clipId)
        );
      });

      const sectionIds = [];
      getMarqueeLaneElements('.section-tag').forEach(element => {
        const section = (daw.sections || []).find(
          item => item.id === element.dataset?.sectionId
        );
        if (
          section &&
          intersects(element, x1, y1, x2, y2, innerRect)
        ) {
          sectionIds.push(element.dataset.sectionId);
        }
      });
      daw.selectedSectionIds = new Set(sectionIds);
      documentRef?.querySelectorAll?.('.section-tag')?.forEach?.(element => {
        element.classList.toggle(
          'selected',
          daw.selectedSectionIds.has(element.dataset?.sectionId)
        );
      });
    }

    function onDocMouseMove(event) {
      const daw = getDAW();
      if (daw.drag) {
        const delta = xToTime(event.clientX - daw.drag.startX);
        if (daw.drag.type === 'move') {
          updateDragOverLane(event, daw);
          updateMoveDrag(delta, daw);
        } else if (daw.drag.type === 'resize') {
          updateResizeDrag(delta, daw);
        }
        renderRuler();
        renderClips();
        updateHud();
      }
      if (daw.marquee) updateMarquee(event, daw);
    }

    function onDocMouseUp() {
      const daw = getDAW();
      if (daw.drag) {
        if (daw.drag.type === 'move' && dragOverLaneTrackId) {
          daw.drag.items.forEach(item => {
            const clip = getClip(item.id);
            if (clip && !item._isSection) {
              clip.trackId = dragOverLaneTrackId;
            }
          });
        }
        dragOverLaneTrackId = null;
        daw.drag = null;
        saveState();
        if (daw.isPlaying) scheduleAllFromPlayhead();
        renderAll();
      }
      if (daw.marquee) {
        daw.marquee = null;
        const box = getElement('marquee');
        if (box?.style) box.style.display = 'none';
        renderClips();
      }
      documentRef?.removeEventListener?.('mousemove', onDocMouseMove);
      documentRef?.removeEventListener?.('mouseup', onDocMouseUp);
    }

    return Object.freeze({
      getMarqueeLaneElements,
      onClipMouseDown,
      onDocMouseMove,
      onDocMouseUp
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreClipInteractionService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
