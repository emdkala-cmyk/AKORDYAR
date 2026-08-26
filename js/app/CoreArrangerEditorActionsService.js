/**
 * CoreArrangerEditorActionsService
 *
 * Owns the arranger editor shell actions: tab switching, closing the editor,
 * and exporting the currently edited arranger.
 */
(function attachCoreArrangerEditorActionsService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getEditingArr = () => null,
    setEditingArr = () => {},
    saveArrangers = () => {},
    renderArrangerManager = () => {},
    renderArrSongsList = () => {},
    saveCurrentArranger = () => {},
    exportArranger = () => {},
    toast = () => {}
  } = {}) {
    function switchArrTab(tab) {
      documentRef?.querySelectorAll?.('.arr-tab')
        ?.forEach?.(element => {
          element.classList?.toggle?.(
            'active',
            element.dataset?.tab === tab
          );
        });
      const editorTab = getElement('arrTabEditor');
      const songsTab = getElement('arrTabSongs');
      if (editorTab?.style) editorTab.style.display = tab === 'editor' ? '' : 'none';
      if (songsTab?.style) songsTab.style.display = tab === 'songs' ? '' : 'none';
      if (tab === 'songs') renderArrSongsList?.();
    }

    function closeArrEditor() {
      saveArrangers?.();
      const editor = getElement('arrEditor');
      if (editor?.style) editor.style.display = 'none';
      setEditingArr?.(null);
      renderArrangerManager?.();
    }

    function exportCurrentArranger() {
      const editingArr = getEditingArr?.();
      if (!editingArr) {
        toast?.('⚠ هیچ پلی‌لیستی در حال ویرایش نیست');
        return;
      }
      saveCurrentArranger?.();
      return exportArranger?.(editingArr);
    }

    return Object.freeze({
      switchArrTab,
      closeArrEditor,
      exportCurrentArranger
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerEditorActionsService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
