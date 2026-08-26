/**
 * EditorColorToolService — context-aware color tools for the editor.
 *
 * The service owns color-tool state, palette UI, paint/eyedropper behavior and
 * timeline brush gestures. Song/runtime mutations and rendering are supplied
 * through explicit callbacks so editor.js does not own this interaction block.
 */
(function attachEditorColorToolService(globalScope) {
  'use strict';

  const QUICK_COLORS = [
    '#FF2E93', '#FF6B6B', '#FFA726', '#FFD54F',
    '#4DB6AC', '#4FC3F7', '#7986CB', '#9F7AEA'
  ];

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getDAW = () => null,
    getSongState = () => null,
    getSelectedChords = () => [],
    getClip = () => null,
    getBaseClipMouseDown = () => null,
    setClipMouseDown = () => {},
    saveState = () => {},
    renderChords = () => {},
    renderClips = () => {},
    saveSong = () => {},
    toast = () => {},
    defaultColor = '#3FB8AF'
  } = {}) {
    let colorToolMode = null;
    let currentColor = defaultColor;
    let timelineBrushDrag = null;
    let initialized = false;
    let clipMousePatched = false;

    const element = id => (
      typeof getElement === 'function' ? getElement(id) : null
    );

    function isColorToolActive() {
      return colorToolMode === 'brush' || colorToolMode === 'eyedropper';
    }

    function initQuickBar() {
      const bar = element('colorQuickBar');
      if (!bar) return;
      bar.innerHTML = '';
      QUICK_COLORS.forEach(color => {
        const swatch = documentRef?.createElement?.('div');
        if (!swatch) return;
        swatch.className =
          'color-quick-swatch' +
          (color === currentColor ? ' active' : '');
        swatch.style.background = color;
        swatch.title = color;
        swatch.onclick = event => {
          event.stopPropagation();
          selectColor(color);
        };
        bar.appendChild(swatch);
      });
    }

    function rgbToHex(rgb) {
      if (!rgb || typeof rgb !== 'string' || rgb.startsWith('#')) return rgb;
      const matches = rgb.match(/(\d+)/g);
      if (!matches || matches.length < 3) return rgb;
      return '#' + matches
        .slice(0, 3)
        .map(value => Number(value).toString(16).padStart(2, '0'))
        .join('');
    }

    function selectColor(color) {
      if (!color) return currentColor;
      currentColor = color;
      const picker = element('colorPickerInput');
      if (picker) picker.value = color;
      documentRef?.querySelectorAll?.('.color-quick-swatch')?.forEach(swatch => {
        swatch.classList.toggle(
          'active',
          swatch.style.background === color ||
          rgbToHex(swatch.style.background) === color
        );
      });
      return currentColor;
    }

    function toggleColorTool(mode) {
      if (colorToolMode === mode) {
        deactivateColorTool();
        return null;
      }

      colorToolMode = mode;
      const bar = element('colorQuickBar');
      const brushButton = element('colorBrushBtn');
      const eyedropperButton = element('colorEyedropperBtn');

      if (mode === 'brush') {
        brushButton?.classList?.add('active');
        brushButton?.classList?.remove('active-eyedropper');
        eyedropperButton?.classList?.remove('active', 'active-eyedropper');
        documentRef?.body?.classList?.add('color-tool-brush');
        documentRef?.body?.classList?.remove('color-tool-eyedropper');
      } else {
        eyedropperButton?.classList?.add('active-eyedropper');
        eyedropperButton?.classList?.remove('active');
        brushButton?.classList?.remove('active', 'active-eyedropper');
        documentRef?.body?.classList?.add('color-tool-eyedropper');
        documentRef?.body?.classList?.remove('color-tool-brush');
      }

      if (bar) {
        bar.classList.add('show');
        initQuickBar();
      }
      return colorToolMode;
    }

    function deactivateColorTool() {
      colorToolMode = null;
      element('colorBrushBtn')?.classList?.remove('active', 'active-eyedropper');
      element('colorEyedropperBtn')?.classList?.remove('active', 'active-eyedropper');
      documentRef?.body?.classList?.remove(
        'color-tool-brush',
        'color-tool-eyedropper'
      );
      element('colorQuickBar')?.classList?.remove('show');
      return true;
    }

    function applyColorToClip(clip, color) {
      if (!clip) return false;
      clip.color = color;
      const clipElement = documentRef?.querySelector?.(
        `.clip[data-clip-id="${clip.id}"]`
      );
      if (clipElement) {
        if (clip.type === 'chord') {
          clipElement.style.background =
            `linear-gradient(180deg, ${color}cc, ${color}77)`;
          clipElement.style.borderColor = color;
        } else {
          clipElement.style.background =
            `linear-gradient(180deg, ${color}bb, ${color}88)`;
        }
      }
      return true;
    }

    function applyColorToSection(section, color) {
      if (!section) return false;
      section.color = color;
      const sectionElement = documentRef?.querySelector?.(
        `.section-tag[data-section-id="${section.id}"]`
      );
      if (sectionElement) {
        sectionElement.style.background =
          `rgba(${parseInt(color.slice(1, 3), 16)},` +
          `${parseInt(color.slice(3, 5), 16)},` +
          `${parseInt(color.slice(5, 7), 16)},0.35)`;
        sectionElement.style.borderColor = color;
      }
      return true;
    }

    function paintLyricChord(index, event = {}) {
      const songState = getSongState();
      const song = songState?.currentSong?.();
      const chords = songState?.getChords?.() || [];
      const chord = chords[index];
      if (!song || !chord || song.editorLocked) return false;

      if (colorToolMode === 'brush') {
        if (event.shiftKey) {
          songState.setChordColorStyle(currentColor);
          songState.clearChordColors();
          saveState();
          renderChords();
          saveSong();
          toast('رنگ همه آکوردها: ' + currentColor);
          return true;
        }

        const selected = getSelectedChords() || [];
        const selectedIndices = selected.includes(index) && selected.length > 1
          ? [...selected]
          : [index];
        selectedIndices.forEach(selectedIndex => {
          if (songState.getChords()[selectedIndex]) {
            songState.setChordColor(selectedIndex, currentColor);
          }
        });
        saveState();
        renderChords();
        saveSong();
        toast(
          selectedIndices.length > 1
            ? `رنگ ${selectedIndices.length} آکورد اعمال شد`
            : 'رنگ آکورد: ' + currentColor
        );
        return true;
      }

      if (colorToolMode === 'eyedropper') {
        selectColor(songState.getChordColor(index, '#e6aa28'));
        toast('رنگ نمونه: ' + currentColor);
        deactivateColorTool();
        return true;
      }

      return false;
    }

    function paintContextAware(event) {
      if (!event?.target) return false;
      const isGlobal = Boolean(event.shiftKey);
      const songState = getSongState();
      const song = songState?.currentSong?.();
      const daw = getDAW() || {};
      const sections = daw.sections || [];
      const clips = daw.clips || [];
      const closest = selector => event.target.closest?.(selector);

      if (colorToolMode === 'brush') {
        const sectionTag = closest('.section-tag');
        if (sectionTag) {
          const section = sections.find(
            item => item.id === sectionTag.dataset.sectionId
          );
          if (!section) return false;
          if (isGlobal) {
            sections.forEach(item => applyColorToSection(item, currentColor));
            saveState();
            renderClips();
            toast('همه بخش‌ها رنگ شد');
          } else {
            applyColorToSection(section, currentColor);
            saveState();
            toast('رنگ بخش: ' + currentColor);
          }
          return true;
        }

        const clipElement = closest('.clip');
        if (clipElement) {
          const clip = getClip(clipElement.dataset.clipId);
          if (!clip) return false;
          if (isGlobal) {
            clips.forEach(item => {
              if (item.type === clip.type) applyColorToClip(item, currentColor);
            });
            saveState();
            renderClips();
            toast(
              'همه ' +
              (clip.type === 'chord' ? 'آکوردهای تایم‌لاین' : 'کلیپ‌ها') +
              ' رنگ شد'
            );
          } else {
            applyColorToClip(clip, currentColor);
            saveState();
            toast('رنگ کلیپ: ' + currentColor);
          }
          return true;
        }

        const line = closest('.eline');
        if (line && song) {
          const lineIndex = parseInt(line.dataset.lineIndex, 10);
          if (isGlobal) {
            songState.setTextColor(currentColor);
            songState.clearLineColors();
            documentRef?.querySelectorAll?.('#editor .eline')?.forEach(item => {
              item.style.color = currentColor;
            });
            saveState();
            saveSong();
            toast('رنگ همه متن: ' + currentColor);
          } else if (lineIndex >= 0) {
            songState.setLineColor(lineIndex, currentColor);
            line.style.color = currentColor;
            saveState();
            saveSong();
            toast('رنگ خط ' + (lineIndex + 1) + ': ' + currentColor);
          }
          return true;
        }

        const chordElement = closest('.chord');
        if (chordElement && song) {
          const chordIndex = parseInt(chordElement.dataset.idx, 10);
          return paintLyricChord(chordIndex, {
            ...event,
            shiftKey: isGlobal
          });
        }

        if (closest('#editor') && song) {
          if (isGlobal) {
            songState.setTextColor(currentColor);
            songState.clearLineColors();
            documentRef?.querySelectorAll?.('#editor .eline')?.forEach(item => {
              item.style.color = currentColor;
            });
            saveState();
            saveSong();
            toast('رنگ همه متن: ' + currentColor);
          }
          return true;
        }

        const lane = closest('.track-lane');
        if (lane) {
          const trackClips = clips.filter(
            clip => clip.trackId === lane.dataset.trackId
          );
          trackClips.forEach(clip => applyColorToClip(clip, currentColor));
          saveState();
          renderClips();
          toast(trackClips.length + ' کلیپ رنگ شد');
          return true;
        }
        return false;
      }

      if (colorToolMode === 'eyedropper') {
        const sectionTag = closest('.section-tag');
        if (sectionTag) {
          const section = sections.find(
            item => item.id === sectionTag.dataset.sectionId
          );
          if (section) {
            selectColor(section.color || '#3FB8AF');
            toast('رنگ نمونه بخش: ' + currentColor);
            deactivateColorTool();
            return true;
          }
        }

        const clipElement = closest('.clip');
        if (clipElement) {
          const clip = getClip(clipElement.dataset.clipId);
          if (clip) {
            selectColor(clip.color);
            toast('رنگ نمونه: ' + currentColor);
            deactivateColorTool();
            return true;
          }
        }

        const line = closest('.eline');
        if (line && song) {
          const lineIndex = parseInt(line.dataset.lineIndex, 10);
          selectColor(songState.getLineColor(lineIndex, '#0fa966'));
          toast('رنگ نمونه: ' + currentColor);
          deactivateColorTool();
          return true;
        }

        const chordElement = closest('.chord');
        if (chordElement && song) {
          const chordIndex = parseInt(chordElement.dataset.idx, 10);
          selectColor(songState.getChordColor(chordIndex, '#e6aa28'));
          toast('رنگ نمونه: ' + currentColor);
          deactivateColorTool();
          return true;
        }

        if (closest('#editor') && song) {
          selectColor(songState.getStyles().tColor || '#0fa966');
          toast('رنگ نمونه: ' + currentColor);
          deactivateColorTool();
          return true;
        }

        const lane = closest('.track-lane');
        if (lane) {
          const first = clips.find(
            clip => clip.trackId === lane.dataset.trackId && clip.color
          );
          if (first) {
            selectColor(first.color);
            toast('رنگ نمونه: ' + currentColor);
            deactivateColorTool();
            return true;
          }
        }
      }

      return false;
    }

    function getTimelineItemAtPoint(clientX, clientY) {
      const lanes = element('lanes-container');
      if (!lanes) return null;

      const directTarget = documentRef?.elementFromPoint?.(clientX, clientY);
      const directItem = directTarget?.closest?.('.clip, .section-tag');
      if (
        directItem &&
        (typeof lanes.contains !== 'function' || lanes.contains(directItem))
      ) {
        return directItem;
      }

      const items = lanes.querySelectorAll?.('.clip, .section-tag') || [];
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const rect = items[index].getBoundingClientRect?.();
        if (
          rect &&
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return items[index];
        }
      }
      return null;
    }

    function paintTimelineItemAtPoint(clientX, clientY) {
      if (!timelineBrushDrag || colorToolMode !== 'brush') return false;
      const item = getTimelineItemAtPoint(clientX, clientY);
      if (!item) {
        timelineBrushDrag.lastKey = null;
        return false;
      }

      const key = item.classList.contains('section-tag')
        ? `section:${item.dataset.sectionId}`
        : `clip:${item.dataset.clipId}`;
      if (timelineBrushDrag.lastKey === key) return false;
      timelineBrushDrag.lastKey = key;

      if (item.classList.contains('section-tag')) {
        const section = (getDAW()?.sections || []).find(
          candidate => candidate.id === item.dataset.sectionId
        );
        if (!section) return false;
        applyColorToSection(section, currentColor);
      } else {
        const clip = getClip(item.dataset.clipId);
        if (!clip) return false;
        applyColorToClip(clip, currentColor);
      }

      timelineBrushDrag.changed = true;
      timelineBrushDrag.paintedKeys.add(key);
      return true;
    }

    function finishTimelineBrushDrag(event) {
      if (!timelineBrushDrag) return false;
      if (
        event?.pointerId != null &&
        timelineBrushDrag.pointerId != null &&
        event.pointerId !== timelineBrushDrag.pointerId
      ) {
        return false;
      }

      const drag = timelineBrushDrag;
      timelineBrushDrag = null;
      documentRef?.removeEventListener?.('pointermove', drag.move, true);
      documentRef?.removeEventListener?.('pointerup', drag.end, true);
      documentRef?.removeEventListener?.('pointercancel', drag.end, true);
      documentRef?.body?.classList?.remove('timeline-color-dragging');

      if (drag.changed) {
        saveState();
        renderClips();
        toast(`رنگ ${drag.paintedKeys.size} آیتم اعمال شد`);
      }
      return true;
    }

    function beginTimelineBrushDrag(event) {
      if (colorToolMode !== 'brush' || event?.button !== 0) return false;
      finishTimelineBrushDrag();

      const pointerId = event.pointerId;
      const move = moveEvent => {
        if (moveEvent.pointerId !== pointerId) return;
        paintTimelineItemAtPoint(moveEvent.clientX, moveEvent.clientY);
        moveEvent.preventDefault?.();
        moveEvent.stopPropagation?.();
      };
      const end = endEvent => finishTimelineBrushDrag(endEvent);

      timelineBrushDrag = {
        pointerId,
        lastKey: null,
        changed: false,
        paintedKeys: new Set(),
        move,
        end
      };
      documentRef?.body?.classList?.add('timeline-color-dragging');
      documentRef?.addEventListener?.('pointermove', move, true);
      documentRef?.addEventListener?.('pointerup', end, true);
      documentRef?.addEventListener?.('pointercancel', end, true);
      paintTimelineItemAtPoint(event.clientX, event.clientY);
      event.preventDefault?.();
      event.stopPropagation?.();
      return true;
    }

    function patchClipMouse() {
      if (clipMousePatched) return;
      const original = getBaseClipMouseDown?.();
      if (typeof original !== 'function') return;

      setClipMouseDown(function colorToolClipMouseDown(event) {
        if (isColorToolActive() && event.button === 0) {
          const clipId = event.currentTarget?.dataset?.clipId;
          if (clipId) {
            const clip = getClip(clipId);
            if (clip && colorToolMode === 'brush') {
              applyColorToClip(clip, currentColor);
              saveState();
              renderClips();
              event.stopPropagation?.();
              event.preventDefault?.();
              toast('رنگ کلیپ: ' + currentColor);
              return;
            }
            if (clip && colorToolMode === 'eyedropper') {
              selectColor(clip.color);
              toast('رنگ نمونه: ' + currentColor);
              deactivateColorTool();
              event.stopPropagation?.();
              event.preventDefault?.();
              return;
            }
          }
        }
        original.call(this, event);
      });
      clipMousePatched = true;
    }

    function handleSectionTagMouseDown(event) {
      if (!isColorToolActive() || event.button !== 0) return;
      if (colorToolMode !== 'eyedropper') return;
      const sectionTag = event.target?.closest?.('.section-tag');
      if (!sectionTag) return;
      const section = (getDAW()?.sections || []).find(
        item => item.id === sectionTag.dataset.sectionId
      );
      if (!section) return;

      if (colorToolMode === 'brush') {
        if (event.shiftKey) {
          (getDAW()?.sections || []).forEach(item =>
            applyColorToSection(item, currentColor)
          );
          toast('همه بخش‌ها رنگ شد');
        } else {
          applyColorToSection(section, currentColor);
          toast('رنگ بخش: ' + currentColor);
        }
        saveState();
        event.preventDefault?.();
        event.stopPropagation?.();
      } else if (colorToolMode === 'eyedropper') {
        selectColor(section.color || '#3FB8AF');
        toast('رنگ نمونه: ' + currentColor);
        deactivateColorTool();
        event.preventDefault?.();
        event.stopPropagation?.();
      }
    }

    function handleEditorWrapMouseDown(event) {
      if (!isColorToolActive() || event.button !== 0) return;
      if (paintContextAware(event)) {
        event.preventDefault?.();
        event.stopPropagation?.();
      } else if (!event.target?.closest?.('#colorQuickBar, #colorPickerInput')) {
        deactivateColorTool();
      }
    }

    function handleDocumentMouseDown(event) {
      if (!isColorToolActive()) return;
      if (event.target?.closest?.(
        '#colorBrushBtn, #colorEyedropperBtn, #colorPickerInput, ' +
        '#colorQuickBar, .chord, .eline, .clip, .section-tag, .track-lane'
      )) {
        return;
      }
      deactivateColorTool();
    }

    function handleLaneMouseDown(event) {
      if (!isColorToolActive() || event.button !== 0) return;
      if (colorToolMode === 'brush') return;
      if (
        event.target?.closest?.('.clip') ||
        event.target?.closest?.('.section-tag')
      ) {
        return;
      }
      if (paintContextAware(event)) {
        event.preventDefault?.();
        event.stopPropagation?.();
      }
    }

    function bindTimelineBrushDrag() {
      const lanes = element('lanes-container');
      if (!lanes) return;
      lanes.addEventListener?.('pointerdown', event => {
        if (colorToolMode !== 'brush' || event.button !== 0) return;
        beginTimelineBrushDrag(event);
      }, true);
    }

    function bind() {
      if (initialized) return true;
      bindTimelineBrushDrag();
      patchClipMouse();

      const lanes = element('lanes-container');
      lanes?.addEventListener?.('mousedown', handleSectionTagMouseDown, true);

      const editorWrap = element('editorWrap');
      editorWrap?.addEventListener?.('mousedown', handleEditorWrapMouseDown, true);

      documentRef?.addEventListener?.(
        'mousedown',
        handleDocumentMouseDown,
        true
      );
      lanes?.addEventListener?.('mousedown', handleLaneMouseDown, true);
      initialized = true;
      return true;
    }

    return Object.freeze({
      bind,
      init: bind,
      isColorToolActive,
      toggleColorTool,
      deactivateColorTool,
      selectColor,
      paintLyricChord,
      paintContextAware,
      getTimelineItemAtPoint,
      paintTimelineItemAtPoint,
      beginTimelineBrushDrag,
      finishTimelineBrushDrag,
      applyColorToClip,
      applyColorToSection,
      getColorToolMode: () => colorToolMode,
      getCurrentColor: () => currentColor
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorColorToolService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
