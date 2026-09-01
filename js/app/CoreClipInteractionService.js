/*
 * CoreClipInteractionService
 *
 * Owns clip pointer events and marquee selection. Drag/resize mutations are
 * delegated to CoreClipDragService.
 */
(function attachCoreClipInteractionService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getClip = () => null,
    selectedClips = () => [],
    clearEditorTextSelection = () => {},
    clearChordSelection = (...args) =>
      globalScope.AkordyarEditorApi?.clearChordSelection?.(...args),
    selectionService = null,
    clearSectionSelection = () => {},
    toggleClipSelection = clipId => {
      const daw = getDAW();
      if (daw.selectedIds.has(clipId)) daw.selectedIds.delete(clipId);
      else daw.selectedIds.add(clipId);
    },
    setSelection = ids => {
      const daw = getDAW();
      daw.selectedIds = new Set(ids || []);
    },
    setClipSelection = ids => {
      const daw = getDAW();
      daw.selectedIds = new Set(ids || []);
    },
    setSectionSelection = ids => {
      const daw = getDAW();
      daw.selectedSectionIds = new Set(ids || []);
    },
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
    const selection = selectionService || {};
    const clearSections = (...args) =>
      (selection.clearSectionSelection || clearSectionSelection)(...args);
    const toggleClip = (...args) =>
      (selection.toggleClipSelection || toggleClipSelection)(...args);
    const selectAll = (...args) =>
      (selection.setSelection || setSelection)(...args);
    const selectClips = (...args) =>
      (selection.setClipSelection || setClipSelection)(...args);
    const selectSections = (...args) =>
      (selection.setSectionSelection || setSectionSelection)(...args);
    const clipDragService =
      globalScope.CoreClipDragService?.create?.({
        documentRef,
        getDAW,
        getClip,
        xToTime,
        snapTime,
        roundMs,
        clamp,
        ensureTimelineFits,
        refreshClipWaveImage,
        saveState,
        scheduleAllFromPlayhead,
        renderAll,
        isSnapEnabled: () =>
          globalScope.AkordyarCoreApi?.isSnapEnabled?.() ?? false,
        getFreeWarpService: () => getWarpService()
      });
    if (!clipDragService) throw new Error(
      'CoreClipDragService must be loaded before CoreClipInteractionService.'
    );

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

    /* ============================================================
       WARP MODE — anchor-based time stretch interaction
       ============================================================ */
    function getWarpService() {
      return globalScope.AkordyarCoreApi?.getFreeWarpService?.() || null;
    }
    function isWarpMode() {
      return globalScope.AkordyarCoreApi?.isWarpMode?.() === true;
    }

    /**
     * Find the nearest user-created warp marker to a click position.
     * Uses pixel proximity, not exact click-on-element.
     * Returns { marker, index } or null.
     */
    function findNearestWarpMarker(clip, clientX, clipElement) {
      const warp = getWarpService();
      if (!warp) return null;
      const markers = warp.getWarpMarkers(clip.id);
      if (markers.length <= 2) return null; // only _start and _end
      const clipRect = clipElement?.getBoundingClientRect?.();
      if (!clipRect) return null;
      const clipDuration = clip.duration; // element width maps clip.duration
      const clipWidthPx = clipRect.width;
      const HIT_PX = 24; // half-width of the ::after hit area
      let best = null;
      let bestDist = Infinity;
      for (let i = 0; i < markers.length; i++) {
        const wm = markers[i];
        if (wm.id === '_start' || wm.id === '_end') continue;
        const wmPx = clipRect.left +
          ((wm.timelineTime - clip.start) / clipDuration) * clipWidthPx;
        const dist = Math.abs(clientX - wmPx);
        if (dist < bestDist && dist < HIT_PX) {
          bestDist = dist;
          best = { marker: wm, index: i };
        }
      }
      return best;
    }

    /**
     * Start a warp drag: freeze the neighbouring anchors and attach
     * document-level mousemove/mouseup.  The drag state lives on daw.drag
     * so other handlers can see it.
     */
    function startWarpDrag(clip, markerId, markers, index, clientX, clipElement) {
      const daw = getDAW();
      const clipRect = clipElement?.getBoundingClientRect?.();
      // Golden rule: the previous/next anchors are frozen for the whole
      // drag — not one millisecond of their audio may move.
      daw.drag = {
        type: 'warp',
        clipId: clip.id,
        markerId,
        startX: clientX,
        origTimelineTime: markers[index].timelineTime,
        prevAnchorTime: markers[index - 1]?.timelineTime ?? clip.start,
        nextAnchorTime: markers[index + 1]?.timelineTime ?? clip.start + clip.duration,
        clipStart: clip.start,
        clipDuration: clip.duration,
        clipWidthPx: clipRect ? clipRect.width : 100
      };
      documentRef.addEventListener('mousemove', onWarpDragMove);
      documentRef.addEventListener('mouseup', onWarpDragEnd);
    }

    function onWarpDragMove(event) {
      const daw = getDAW();
      const drag = daw?.drag;
      if (!drag || drag.type !== 'warp') return;
      const warp = getWarpService();
      if (!warp) return;
      const clip = getClip(drag.clipId);
      if (!clip) return;

      // Convert pixel delta to time delta
      const pxDelta = event.clientX - drag.startX;
      let newTime = drag.origTimelineTime + xToTime(pxDelta);

      // Clamp: must stay strictly between the frozen anchor markers
      newTime = Math.min(
        drag.nextAnchorTime - 0.005,
        Math.max(drag.prevAnchorTime + 0.005, newTime)
      );

      // Live magnetic snap while dragging
      const snapEnabled = globalScope.AkordyarCoreApi?.isSnapEnabled?.();
      if (snapEnabled) {
        newTime = snapTime(newTime);
      }

      // Move the marker — segment A stretches while segment B compresses
      warp.moveWarpMarker(drag.clipId, drag.markerId, newTime);

      // Elastic waveform preview: redraw the peaks through the new warp
      // mapping so the stretch is visible under the cursor while dragging.
      refreshClipWaveImage(clip);
      renderClips({ preserveWaveforms: true });

      const markerEl = documentRef.querySelector(
        `.clip[data-clip-id="${drag.clipId}"] .warp-marker[data-marker-id="${drag.markerId}"]`
      );
      if (markerEl) markerEl.classList.add('dragging');
      const clipEl = documentRef.querySelector(
        `.clip[data-clip-id="${drag.clipId}"]`
      );
      if (clipEl) clipEl.classList.add('warp-dragging');
    }

    function onWarpDragEnd() {
      const daw = getDAW();
      const drag = daw?.drag;
      if (drag?.type === 'warp') {
        daw.drag = null;
        const warp = getWarpService();
        const clip = getClip(drag.clipId);
        if (warp && clip) {
          // Snap the dropped marker to the grid, persist, redraw the
          // warped waveform and re-render the stretched audio buffer.
          const markers = warp.getWarpMarkers(drag.clipId);
          const current = markers.find(m => m.id === drag.markerId);
          warp.commitWarp(drag.clipId, {
            markerId: drag.markerId,
            timelineTime: current ? current.timelineTime : null
          });
        } else {
          saveState();
          renderClips();
        }
      }
      documentRef?.removeEventListener?.('mousemove', onWarpDragMove);
      documentRef?.removeEventListener?.('mouseup', onWarpDragEnd);
    }

    /* ============================================================
       CLIP POINTER DOWN — main entry point
       ============================================================ */
    function onClipMouseDown(event) {
      if (event.button !== 0) return;

      clearEditorTextSelection();
      clearChordSelection();
      getElement('editor')?.blur?.();

      const daw = getDAW();
      const selectedSectionIds = getSelectedSectionIds(daw);
      if (selectedSectionIds.size > 0) {
        clearSections({ render: true });
      }

      event.stopPropagation?.();
      event.preventDefault?.();

      const clipId = event.currentTarget?.dataset?.clipId;
      const clip = getClip(clipId);
      if (!clip) return;

      const track = (daw.tracks || []).find(item => item.id === clip.trackId);
      if (track?.locked) {
        toast('Track is locked');
        return;
      }

      clearChordSelection();

      /* ---- WARP MODE ---- */
      if (isWarpMode() && clip.type === 'audio') {
        const warp = getWarpService();
        if (!warp) return;

        warp.ensureWarpMarkers(clip.id);
        const clipElement = event.currentTarget;
        const markers = warp.getWarpMarkers(clip.id);

        // Try to find nearest existing warp marker within hit area
        const nearest = findNearestWarpMarker(clip, event.clientX, clipElement);

        if (nearest) {
          if (event.altKey) {
            // Alt+click removes the marker
            warp.removeWarpMarker(clip.id, nearest.marker.id);
            return;
          }
          // Start dragging the existing marker (anchors freeze inside)
          startWarpDrag(
            clip,
            nearest.marker.id,
            markers,
            nearest.index,
            event.clientX,
            clipElement
          );
          return;
        }

        // No marker nearby — insert a new one at the click position
        const clipRect = clipElement?.getBoundingClientRect?.();
        if (clipRect) {
          const relX = event.clientX - clipRect.left;
          const clickTime = clip.start + (relX / clipRect.width) * clip.duration;
          warp.insertWarpMarker(clip.id, clickTime);
          renderClips();
        }
        return;
      }

      /* ---- NORMAL MODE (select, move, resize) ---- */
      const now = Date.now();
      const dx = Math.abs(event.clientX - (clip._clickX || 0));
      const dy = Math.abs(event.clientY - (clip._clickY || 0));
      if (
        clip._clickTimer &&
        (now - (clip._clickTime || 0)) < 350 &&
        dx < 5 && dy < 5
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
        () => { clip._clickTimer = null; }, 350
      );

      if (event.shiftKey) {
        cutAtTime(clientToTime(event.clientX), clip.trackId);
        return;
      }

      if (event.altKey) {
        const selected = selectedClips();
        if (!selected.find(item => item.id === clipId)) {
          selectClips([clipId], { render: false });
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
            origOffset: newClip.offset,
            origTrackId: newClip.trackId
          });
        });
        selectClips(newIds, { render: false });
        daw.drag = {
          type: 'move', edge: null,
          primaryId: dragItems[0]?.id,
          startX: event.clientX,
          items: dragItems
        };
        renderAll();
        startPointerDrag(
          getElement('tl-inner') || event.currentTarget,
          event, onDocMouseMove, onDocMouseUp
        );
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        toggleClip(clipId, { render: true });
        return;
      }

      if (!daw.selectedIds.has(clipId)) {
        clearSections({ render: false });
        selectAll([clipId]);
      }

      const edge = event.target?.dataset?.edge || null;
      const dragItems = edge
        ? [{
            id: clipId,
            origStart: clip.start,
            origDur: clip.duration,
            origOffset: clip.offset,
            origTrackId: clip.trackId
          }]
        : selectedClips()
            .map(item => ({
              id: item.id,
              origStart: item.start,
              origDur: item.duration,
              origOffset: item.offset,
              origTrackId: item.trackId
            }))
            .concat(
              (daw.sections || [])
                .filter(section => selectedSectionIds.has(section.id))
                .map(section => ({ id: section.id, origStart: section.start, origDuration: section.duration, origOffset: 0, _isSection: true }))
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
        event, onDocMouseMove, onDocMouseUp
      );
    }

    /* ---- Marquee ---- */
    function intersects(element, x1, y1, x2, y2, innerRect) {
      const rect = element.getBoundingClientRect();
      const cx1 = rect.left - innerRect.left;
      const cy1 = rect.top - innerRect.top;
      return !(cx1 + rect.width < x1 || cx1 > x2 || cy1 + rect.height < y1 || cy1 > y2);
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
        if (clip && intersects(element, x1, y1, x2, y2, innerRect)) {
          clipIds.push(element.dataset.clipId);
        }
      });
      selectClips(clipIds, { render: false });
      const sectionIds = [];
      getMarqueeLaneElements('.section-tag').forEach(element => {
        const section = (daw.sections || []).find(
          item => item.id === element.dataset?.sectionId
        );
        if (section && intersects(element, x1, y1, x2, y2, innerRect)) {
          sectionIds.push(element.dataset.sectionId);
        }
      });
      selectSections(sectionIds, { render: false });
    }

    /* ---- Global document handlers ---- */
    function onDocMouseMove(event) {
      const daw = getDAW();
      if (daw?.drag?.type === 'warp') {
        onWarpDragMove(event);
        return;
      }
      if (clipDragService.update(event)) {
        renderRuler();
        renderClips();
        updateHud();
      }
      if (daw.marquee) updateMarquee(event, daw);
    }

    function onDocMouseUp() {
      const daw = getDAW();
      if (daw?.drag?.type === 'warp') {
        onWarpDragEnd();
        return;
      }
      clipDragService.finish();
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
