/*
 * CoreClipDeletionService
 *
 * Owns destructive cleanup of selected timeline clips and sections. The
 * clipboard service delegates here so copy/paste state and deletion policy
 * remain separate.
 */
(function attachCoreClipDeletionService(globalScope) {
  'use strict';

  function create({
    getDAW = () => globalScope.getEditorDAW?.() || globalScope.DAW,
    stopAllVoices = () => globalScope.stopAllVoices?.(),
    saveState = () => globalScope.saveState?.(),
    renderAll = () => globalScope.renderAll?.(),
    scheduleAllFromPlayhead = () =>
      globalScope.scheduleAllFromPlayhead?.(),
    toast = () => {},
    translate = key => globalScope.t?.(key) ?? key
  } = {}) {
    function deleteSelected() {
      const daw = getDAW();
      if (!daw) return false;

      const clipIds = [...(daw.selectedIds || [])];
      const sectionIds = [...(daw.selectedSectionIds || [])];
      if (!clipIds.length && !sectionIds.length) {
        toast(translate('nothingSelected'));
        return false;
      }

      stopAllVoices?.();
      if (clipIds.length) {
        daw.clips = (daw.clips || []).filter(
          clip => !daw.selectedIds.has(clip.id)
        );
        daw.selectedIds.clear();
      }
      if (sectionIds.length) {
        daw.sections = (daw.sections || []).filter(
          section => !daw.selectedSectionIds.has(section.id)
        );
        daw.selectedSectionIds.clear();
      }

      saveState();
      renderAll();
      if (daw.isPlaying) scheduleAllFromPlayhead();
      toast(translate('deleted'));
      return true;
    }

    return Object.freeze({ deleteSelected });
  }

  const service = Object.freeze({ create });
  globalScope.CoreClipDeletionService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
