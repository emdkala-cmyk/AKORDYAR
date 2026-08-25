/*
 * CoreSelectionService
 *
 * Owns clip/section selection state and its timeline DOM projection. The
 * service intentionally keeps rendering optional so marquee drag can update
 * classes without rebuilding every clip element on each pointer move.
 */
(function attachCoreSelectionService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getDAW = () => globalScope.getEditorDAW?.() || globalScope.DAW,
    renderClips = () => {},
    updateHud = () => {}
  } = {}) {
    function ensureSets(daw) {
      if (!(daw.selectedIds instanceof Set)) {
        daw.selectedIds = new Set(daw.selectedIds || []);
      }
      if (!(daw.selectedSectionIds instanceof Set)) {
        daw.selectedSectionIds = new Set(daw.selectedSectionIds || []);
      }
      return daw;
    }

    function syncDom() {
      const daw = ensureSets(getDAW() || {});
      documentRef?.querySelectorAll?.('.clip')?.forEach?.(element => {
        element.classList?.toggle?.(
          'selected',
          daw.selectedIds.has(element.dataset?.clipId)
        );
      });
      documentRef?.querySelectorAll?.('.section-tag')?.forEach?.(element => {
        element.classList?.toggle?.(
          'selected',
          daw.selectedSectionIds.has(element.dataset?.sectionId)
        );
      });
    }

    function setSelection(ids) {
      const daw = ensureSets(getDAW() || {});
      daw.selectedIds = new Set(ids || []);
      renderClips();
      updateHud();
      return daw.selectedIds;
    }

    function clearSelection() {
      const daw = ensureSets(getDAW() || {});
      daw.selectedIds.clear();
      daw.selectedSectionIds.clear();
      renderClips();
      updateHud();
      return daw.selectedIds;
    }

    function clearSectionSelection({ render = true } = {}) {
      const daw = ensureSets(getDAW() || {});
      daw.selectedSectionIds.clear();
      if (render) renderClips();
      else syncDom();
      return daw.selectedSectionIds;
    }

    function toggleClipSelection(clipId, { render = true } = {}) {
      const daw = ensureSets(getDAW() || {});
      if (daw.selectedIds.has(clipId)) daw.selectedIds.delete(clipId);
      else daw.selectedIds.add(clipId);
      if (render) renderClips();
      else syncDom();
      return daw.selectedIds;
    }

    function setClipSelection(ids, { render = false } = {}) {
      const daw = ensureSets(getDAW() || {});
      daw.selectedIds = new Set(ids || []);
      if (render) renderClips();
      else syncDom();
      return daw.selectedIds;
    }

    function setSectionSelection(ids, { render = false } = {}) {
      const daw = ensureSets(getDAW() || {});
      daw.selectedSectionIds = new Set(ids || []);
      if (render) renderClips();
      else syncDom();
      return daw.selectedSectionIds;
    }

    return Object.freeze({
      setSelection,
      clearSelection,
      clearSectionSelection,
      toggleClipSelection,
      setClipSelection,
      setSectionSelection,
      syncDom
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreSelectionService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
