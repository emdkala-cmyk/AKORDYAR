/*
 * CoreClipInteractionService
 *
 * Owns clip pointer events and marquee selection. Drag/resize mutations are
 * delegated to CoreClipDragService.
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
        renderAll
      });
    if (!clipDragService) throw new Error(
      'CoreClipDragService باید قبل از CoreClipInteractionService بارگذاری شود.'
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
            origOffset: newClip.offset
          });
        });

        selectClips(newIds, { render: false });
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
      selectClips(clipIds, { render: false });

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
      selectSections(sectionIds, { render: false });
    }

    function onDocMouseMove(event) {
      const daw = getDAW();
      if (clipDragService.update(event)) {
        renderRuler();
        renderClips();
        updateHud();
      }
      if (daw.marquee) updateMarquee(event, daw);
    }

    function onDocMouseUp() {
      const daw = getDAW();
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
