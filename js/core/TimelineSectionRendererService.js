/**
 * TimelineSectionRendererService
 *
 * Owns section-tag projection and interaction wiring. Clip rendering remains
 * in the core until its DOM and selection contracts are migrated separately.
 */
(function attachTimelineSectionRendererService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    getDAW = () => null,
    timeToX = value => value,
    xToTime = value => value,
    snapTime = value => value,
    roundMs = value => value,
    renderClips = () => {},
    selectedClips = () => [],
    startPointerDrag = () => {},
    getTimelineInner = () => documentRef?.getElementById?.('tl-inner'),
    onDocumentMouseMove = () => {},
    onDocumentMouseUp = () => {},
    saveState = () => {},
    schedule = globalScope.setTimeout,
    clearTimer = globalScope.clearTimeout
  } = {}) {
    function getSelectedSectionIds(daw) {
      if (!(daw.selectedSectionIds instanceof Set)) {
        daw.selectedSectionIds = new Set(daw.selectedSectionIds || []);
      }
      return daw.selectedSectionIds;
    }

    function renderSections() {
      documentRef?.querySelectorAll?.('.section-tag')
        ?.forEach?.(element => element.remove());

      const daw = getDAW() || {};
      const selectedSectionIds = getSelectedSectionIds(daw);
      (daw.sections || []).forEach(section => {
        const lane = documentRef?.querySelector?.(
          `.track-lane[data-track-id="${section.trackId}"]`
        );
        if (!lane) return;

        const hint = lane.querySelector?.('.empty-lane-hint');
        if (hint) hint.remove();

        const element = documentRef.createElement('div');
        element.className =
          'section-tag' +
          (selectedSectionIds.has(section.id) ? ' selected' : '');
        element.dataset.sectionId = section.id;
        element.style.left = `${timeToX(section.start)}px`;
        element.style.width = `${Math.max(50, timeToX(section.duration))}px`;
        element.textContent = section.label;
        element.style.background = section.color
          ? `rgba(${parseInt(section.color.slice(1, 3), 16)},${parseInt(section.color.slice(3, 5), 16)},${parseInt(section.color.slice(5, 7), 16)},0.35)`
          : 'rgba(63,184,175,0.25)';
        element.style.borderColor = section.color || 'var(--accent-teal)';

        element.addEventListener('mousedown', event => {
          if (event.button !== 0) return;
          event.stopPropagation();
          event.preventDefault();

          const now = Date.now();
          const dx = Math.abs(event.clientX - (section._clickX || 0));
          const dy = Math.abs(event.clientY - (section._clickY || 0));
          if (
            section._clickTimer &&
            (now - (section._clickTime || 0)) < 350 &&
            dx < 5 &&
            dy < 5
          ) {
            clearTimer?.(section._clickTimer);
            section._clickTimer = null;
            element.contentEditable = 'true';
            element.focus();
            const range = documentRef.createRange();
            range.selectNodeContents(element);
            const selection = windowRef?.getSelection?.();
            selection?.removeAllRanges?.();
            selection?.addRange?.(range);
            const finishEdit = () => {
              element.contentEditable = 'false';
              const newName = element.textContent.trim();
              if (newName && newName !== section.label) {
                section.label = newName;
                saveState();
              }
              element.removeEventListener('blur', finishEdit);
              element.removeEventListener('keydown', onKey);
            };
            const onKey = keyEvent => {
              if (keyEvent.key === 'Enter') {
                keyEvent.preventDefault();
                element.blur();
              }
              if (keyEvent.key === 'Escape') {
                element.textContent = section.label;
                element.blur();
              }
              keyEvent.stopPropagation();
            };
            element.addEventListener('blur', finishEdit);
            element.addEventListener('keydown', onKey);
            return;
          }

          section._clickX = event.clientX;
          section._clickY = event.clientY;
          section._clickTime = now;
          section._clickTimer = schedule?.(
            () => { section._clickTimer = null; },
            350
          );

          if (event.ctrlKey || event.metaKey) {
            if (selectedSectionIds.has(section.id)) {
              selectedSectionIds.delete(section.id);
            } else {
              selectedSectionIds.add(section.id);
            }
            renderClips();
            return;
          }

          if (!selectedSectionIds.has(section.id)) {
            daw.selectedSectionIds = new Set([section.id]);
            daw.selectedIds?.clear?.();
            renderClips();
          }

          const dragItems = [];
          selectedClips().forEach(clip => dragItems.push({
            id: clip.id,
            origStart: clip.start,
            origDur: clip.duration,
            origOffset: clip.offset
          }));
          (daw.sections || [])
            .filter(item => getSelectedSectionIds(daw).has(item.id))
            .forEach(item => dragItems.push({
              id: item.id,
              origStart: item.start,
              origDur: item.duration,
              origOffset: 0,
              _isSection: true
            }));
          if (dragItems.length === 0) return;

          daw.drag = {
            type: 'move',
            edge: null,
            primaryId: section.id,
            startX: event.clientX,
            items: dragItems
          };
          startPointerDrag(
            getTimelineInner?.() || event.currentTarget,
            event,
            onDocumentMouseMove,
            onDocumentMouseUp
          );
        });

        const resizeLeft = documentRef.createElement('div');
        resizeLeft.className = 'resize-handle left';
        resizeLeft.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          event.stopPropagation();
          event.preventDefault();
          const startX = event.clientX;
          const originalStart = section.start;
          const originalDuration = section.duration;
          const onMove = moveEvent => {
            const delta = xToTime(moveEvent.clientX - startX);
            let nextStart = snapTime(originalStart + delta);
            let nextDuration = originalStart + originalDuration - nextStart;
            if (nextStart < 0) {
              nextDuration += nextStart;
              nextStart = 0;
            }
            if (nextDuration >= 0.5) {
              section.start = roundMs(nextStart);
              section.duration = roundMs(nextDuration);
              element.style.left = `${timeToX(section.start)}px`;
              element.style.width =
                `${Math.max(50, timeToX(section.duration))}px`;
            }
          };
          startPointerDrag(resizeLeft, event, onMove, saveState);
        });

        const resizeRight = documentRef.createElement('div');
        resizeRight.className = 'resize-handle right';
        resizeRight.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          event.stopPropagation();
          event.preventDefault();
          const startX = event.clientX;
          const originalDuration = section.duration;
          const onMove = moveEvent => {
            section.duration = Math.max(
              0.5,
              roundMs(snapTime(
                originalDuration + xToTime(moveEvent.clientX - startX)
              ))
            );
            element.style.width =
              `${Math.max(50, timeToX(section.duration))}px`;
          };
          startPointerDrag(resizeRight, event, onMove, saveState);
        });

        element.appendChild(resizeLeft);
        element.appendChild(resizeRight);
        lane.appendChild(element);
      });
    }

    function refreshGeometry() {
      const daw = getDAW() || {};
      const sectionsById = new Map(
        (daw.sections || []).map(section => [section.id, section])
      );
      let updated = 0;
      documentRef?.querySelectorAll?.('.section-tag')
        ?.forEach?.(element => {
          const section = sectionsById.get(element.dataset?.sectionId);
          if (!section) return;
          element.style.left = `${timeToX(section.start)}px`;
          element.style.width =
            `${Math.max(50, timeToX(section.duration))}px`;
          updated += 1;
        });
      return updated;
    }

    return Object.freeze({ renderSections, refreshGeometry });
  }

  const service = Object.freeze({ create });
  globalScope.TimelineSectionRendererService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
