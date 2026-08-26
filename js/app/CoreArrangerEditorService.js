/*
 * CoreArrangerEditorService
 *
 * Opens and synchronizes arranger editor controls without owning arranger state.
 */
(function attachCoreArrangerEditorService(globalScope) {
  'use strict';

  function create({
    getElement = id => globalScope.document?.getElementById?.(id),
    getEditingArr = () => null,
    renderArrPool = () => {},
    renderArrSetlist = () => {},
    switchArrTab = () => {},
    renderArrangerManager = () => {},
    logger = console
  } = {}) {
    function open() {
      const editingArr = getEditingArr?.();
      if (!editingArr) return;

      const arrManager = getElement?.('arrManager');
      if (arrManager?.style) {
        arrManager.style.maxHeight = '';
        arrManager.style.borderBottom = '';
        arrManager.style.paddingBottom = '';
        arrManager.style.marginBottom = '';
      }

      const arrEditor = getElement?.('arrEditor');
      if (arrEditor?.style) arrEditor.style.display = 'block';

      const modal = getElement?.('arrangerModal');
      if (modal?.classList && !modal.classList.contains('show')) {
        modal.classList.add('show');
      }

      const nameInput = getElement?.('arrName');
      if (nameInput) nameInput.value = editingArr.name || '';

      const crossfade = editingArr.crossfade || 0;
      const crossfadeRange = getElement?.('arrCrossfadeRange');
      if (crossfadeRange) {
        crossfadeRange.value = crossfade ? editingArr.crossfade : '0';
      }
      const crossfadeValue = getElement?.('arrCrossfadeVal');
      if (crossfadeValue) crossfadeValue.textContent = crossfade + 's';

      const pauseButton = getElement?.('arrPauseBtn');
      if (pauseButton?.classList) {
        if (editingArr.pauseBetween) {
          pauseButton.classList.add('arr-stl-active');
        } else {
          pauseButton.classList.remove('arr-stl-active');
        }
      }

      renderArrPool?.();
      renderArrSetlist?.();
      switchArrTab?.('editor');
      renderArrangerManager?.();
      logger.log?.(`[Arranger] Editor opened for: "${editingArr.name}"`);
    }

    return Object.freeze({ open });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerEditorService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
