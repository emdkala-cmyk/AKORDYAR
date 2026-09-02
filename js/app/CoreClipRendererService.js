/*
 * CoreClipRendererService
 *
 * Renders audio and chord clips without owning DAW state.
 */
(function attachCoreClipRendererService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || {},
    timeToX = value => value,
    refreshClipWaveImage = () => {},
    getClipFilePath = () => '',
    onClipMouseDown = () => {},
    openTimelineChordEditor = () => {},
    renderSections = () => {},
    refreshSections = () => renderSections(),
    getFreeWarpService = () => null
  } = {}) {
    let warpMode = false;
    function setWarpMode(active) { warpMode = active; }
    function getWarpMode() { return warpMode; }

    function isSelectedClip(daw, clipId) {
      return daw.selectedIds?.has?.(clipId) ||
        (Array.isArray(daw.selectedIds) && daw.selectedIds.includes(clipId));
    }

    function getDragGuideClip(daw) {
      const clips = Array.isArray(daw.clips) ? daw.clips : [];
      const primaryId =
        daw.drag?.type === 'move' ? daw.drag.primaryId : null;
      const primary = clips.find(clip => clip.id === primaryId);
      if (primary) return primary;

      const selected = clips.filter(clip => isSelectedClip(daw, clip.id));
      if (selected.length === 1) return selected[0];

      const selectedTrackClips = clips.filter(
        clip => clip.trackId === daw.selectedTrackId
      );
      return selectedTrackClips.length === 1
        ? selectedTrackClips[0]
        : null;
    }

    function renderDragGuide(daw) {
      const guide = documentRef.getElementById?.('clip-drag-guide');
      if (!guide?.style) return;
      const clip = getDragGuideClip(daw);
      const start = Number(clip?.start);
      if (!clip || !Number.isFinite(start)) {
        guide.style.display = 'none';
        guide.dataset.clipId = '';
        return;
      }
      guide.style.display = 'block';
      guide.style.left = `${timeToX(start)}px`;
      guide.dataset.clipId = clip.id;
    }

    function getHitpointTimelineTime(clip, hitpoint) {
      const warpEngine = globalScope.FreeWarpEngine;
      const markers =
        warpEngine && clip.warpMarkers?.length >= 2
          ? warpEngine.sortMarkers(clip.warpMarkers)
          : null;
      const sourceStart = Number(clip.offset) || 0;
      const sourceTime = Number.isFinite(Number(hitpoint?.sourceTime))
        ? Number(hitpoint.sourceTime)
        : sourceStart;
      return markers
        ? warpEngine.sourceToTimeline(sourceTime, markers)
        : clip.start + sourceTime - sourceStart;
    }

    function toPixels(value) {
      const pixels = Number(timeToX(Number(value) || 0));
      return Number.isFinite(pixels) ? pixels : 0;
    }

    function updateClipGeometry(element, clip) {
      element.style.left = `${toPixels(clip.start)}px`;
      element.style.width = `${Math.max(30, toPixels(clip.duration))}px`;

      if (clip.type === 'chord') return;

      const snapMarker = element.querySelector?.('.snap-marker');
      if (snapMarker?.style) {
        snapMarker.style.left = `${toPixels(clip.snapPointOffset || 0)}px`;
      }

      const warpMarkers = new Map(
        (clip.warpMarkers || [])
          .filter(marker => marker?.id)
          .map(marker => [marker.id, marker])
      );
      element.querySelectorAll?.('.warp-marker').forEach(marker => {
        const warpMarker = warpMarkers.get(marker.dataset?.markerId);
        if (!warpMarker?.timelineTime && warpMarker?.timelineTime !== 0) return;
        marker.style.left =
          `${toPixels(warpMarker.timelineTime - clip.start)}px`;
      });

      element.querySelectorAll?.('.hitpoint-marker').forEach(marker => {
        const index = Number(marker.dataset?.hitpointIndex);
        const hitpoint = Number.isInteger(index)
          ? clip.hitpoints?.[index]
          : null;
        const timelineTime = getHitpointTimelineTime(clip, hitpoint);
        if (!Number.isFinite(timelineTime)) return;
        marker.style.left =
          `${toPixels(timelineTime - clip.start)}px`;
      });
    }

    function refreshGeometry() {
      const daw = getDAW() || {};
      const clipsById = new Map(
        (daw.clips || []).map(clip => [clip.id, clip])
      );
      let updated = 0;
      documentRef.querySelectorAll?.('.clip').forEach(element => {
        const clip = clipsById.get(element.dataset?.clipId);
        if (!clip) return;
        updateClipGeometry(element, clip);
        updated += 1;
      });
      renderDragGuide(daw);
      refreshSections?.();
      return updated;
    }

    function render(options = {}) {
      const preserveWaveforms = options.preserveWaveforms === true;
      documentRef.querySelectorAll('.clip').forEach(element => element.remove());
      const daw = getDAW() || {};
      (daw.clips || []).forEach(clip => {
        const lane = documentRef.querySelector(
          `.track-lane[data-track-id="${clip.trackId}"]`
        );
        if (!lane) return;
        lane.querySelector?.('.empty-lane-hint')?.remove?.();

        if (
          clip.type !== 'chord' &&
          (!preserveWaveforms || !clip.waveUrl)
        ) {
          refreshClipWaveImage(clip);
        }

        const element = documentRef.createElement('div');
        const isDragPreview =
          daw.drag?.type === 'move' &&
          daw.drag.items?.some(item => item.id === clip.id);
        element.className =
          'clip' +
          (clip.type === 'chord' ? ' chord-clip' : ' audio-clip') +
          (daw.selectedIds?.has?.(clip.id) ? ' selected' : '') +
          (isDragPreview ? ' drag-preview' : '');
        element.dataset.clipId = clip.id;
        element.style.left = timeToX(clip.start) + 'px';
        element.style.width = Math.max(30, timeToX(clip.duration)) + 'px';

        if (clip.type !== 'chord') {
          element.style.background =
            `linear-gradient(180deg, ${clip.color}bb, ${clip.color}88)`;
          // Snap point indicator
          const snapOffset = clip.snapPointOffset || 0;
          const snapMarkerHtml = snapOffset > 0
            ? `<div class="snap-marker" style="left:${timeToX(snapOffset)}px" title="Snap: ${snapOffset.toFixed(2)}s"></div>`
            : '';
          // Warp markers
          let warpHtml = '';
          if (clip.warpMarkers && clip.warpMarkers.length > 2) {
            const clipStart = clip.start;
            for (const wm of clip.warpMarkers) {
              if (wm.id === '_start' || wm.id === '_end') continue;
              const wmX = timeToX(wm.timelineTime - clipStart);
              warpHtml += `<div class="warp-marker" data-marker-id="${wm.id}" style="left:${wmX}px" title="Warp: ${wm.timelineTime.toFixed(2)}s"></div>`;
            }
          }
          let hitpointHtml = '';
          if (
            clip.hitpointsVisible !== false &&
            Array.isArray(clip.hitpoints) &&
            clip.hitpoints.length
          ) {
            for (
              let hitpointIndex = 0;
              hitpointIndex < clip.hitpoints.length;
              hitpointIndex++
            ) {
              const hitpoint = clip.hitpoints[hitpointIndex];
              if (hitpoint?.enabled === false) continue;
              const timelineTime = getHitpointTimelineTime(clip, hitpoint);
              if (!Number.isFinite(timelineTime)) continue;
              const markerX = timeToX(timelineTime - clip.start);
              const strength = Math.round(
                Math.max(0, Math.min(1, Number(hitpoint.strength) || 0)) * 100
              );
              hitpointHtml +=
                `<div class="hitpoint-marker" data-hitpoint-index="${hitpointIndex}" style="left:${markerX}px" title="Hitpoint ${strength}%"></div>`;
            }
          }
          element.innerHTML =
            `<img class="clip-wave" alt="" draggable="false" ${clip.waveUrl ? `src="${clip.waveUrl}"` : ''}><div class="clip-title">${clip.name}</div>${snapMarkerHtml}${hitpointHtml}${warpHtml}<div class="resize-handle left" data-edge="left"></div><div class="resize-handle right" data-edge="right"></div>`;
          element.addEventListener('mouseenter', () => {
            const filePath = getClipFilePath(clip);
            if (!filePath) return;
            const storageBar = documentRef.getElementById('storageInfoBar');
            const storageText = documentRef.getElementById('storageText');
            if (storageBar && storageText) {
              storageBar.style.display = 'block';
              storageText.textContent = filePath;
              storageText.title = filePath;
            }
          });
          element.addEventListener('mouseleave', () => {
            const storageBar = documentRef.getElementById('storageInfoBar');
            const storageText = documentRef.getElementById('storageText');
            if (storageBar && storageText) {
              storageBar.style.display = 'none';
              storageText.textContent = '';
            }
          });
        } else {
          const chordColor = clip.color || '#9F7AEA';
          element.style.background =
            `linear-gradient(180deg, ${chordColor}cc, ${chordColor}77)`;
          element.style.borderColor = chordColor;
          element.innerHTML =
            `<span>${clip.name}</span><div class="resize-handle left" data-edge="left"></div><div class="resize-handle right" data-edge="right"></div>`;
          element.addEventListener('dblclick', event => {
            event.preventDefault();
            event.stopPropagation();
            openTimelineChordEditor(clip.id);
          });
        }

        element.addEventListener('pointerdown', event => onClipMouseDown(event));
        lane.appendChild(element);
      });
      renderDragGuide(daw);
      renderSections?.();
    }

    return Object.freeze({
      render,
      refreshGeometry,
      setWarpMode,
      getWarpMode
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreClipRendererService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
