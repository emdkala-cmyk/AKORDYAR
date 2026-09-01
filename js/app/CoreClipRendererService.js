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
    getFreeWarpService = () => null
  } = {}) {
    let warpMode = false;
    function setWarpMode(active) { warpMode = active; }
    function getWarpMode() { return warpMode; }
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
        element.className =
          'clip' +
          (clip.type === 'chord' ? ' chord-clip' : '') +
          (daw.selectedIds?.has?.(clip.id) ? ' selected' : '');
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
            const clipDur = clip.sourceDuration || clip.duration;
            for (const wm of clip.warpMarkers) {
              if (wm.id === '_start' || wm.id === '_end') continue;
              const wmX = timeToX(wm.timelineTime - clipStart);
              warpHtml += `<div class="warp-marker" data-marker-id="${wm.id}" style="left:${wmX}px" title="Warp: ${wm.timelineTime.toFixed(2)}s"></div>`;
            }
          }
          element.innerHTML =
            `<img class="clip-wave" alt="" draggable="false" ${clip.waveUrl ? `src="${clip.waveUrl}"` : ''}><div class="clip-title">${clip.name}</div>${snapMarkerHtml}${warpHtml}<div class="resize-handle left" data-edge="left"></div><div class="resize-handle right" data-edge="right"></div>`;
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
      renderSections?.();
    }

    return Object.freeze({ render, setWarpMode, getWarpMode });
  }

  const service = Object.freeze({ create });
  globalScope.CoreClipRendererService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
