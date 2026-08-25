/*
 * CoreFocusModeService
 *
 * Owns the DOM mutation for editor focus mode while the legacy boolean state
 * remains injectable for editor and panel-layout compatibility.
 */
(function attachCoreFocusModeService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getFocusMode = () => false,
    setFocusMode = () => {},
    getSongState = () => null,
    schedule = callback => globalScope.setTimeout?.(callback, 50),
    renderChords = () => globalScope.edRenderChords?.(),
    toast = () => {},
    translate = key => globalScope.t?.(key) ?? key
  } = {}) {
    let savedGridRows = '';

    function toggleFocusMode() {
      const nextFocusMode = !getFocusMode();
      setFocusMode(nextFocusMode);
      documentRef?.body?.classList.toggle('focus-mode', nextFocusMode);

      const grid =
        getElement('app-container') ||
        documentRef?.querySelector?.('.app-container');
      if (grid) {
        if (nextFocusMode) {
          savedGridRows = grid.style.gridTemplateRows;
          grid.style.gridTemplateRows = '';
        } else {
          grid.style.gridTemplateRows = savedGridRows || '';
        }
      }

      toast(translate(nextFocusMode ? 'focusMode' : 'normalMode'));
      if (getSongState?.()?.currentSong?.()) {
        schedule(() => renderChords(), 50);
      }
    }

    return Object.freeze({ toggleFocusMode });
  }

  const service = Object.freeze({ create });
  globalScope.CoreFocusModeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
