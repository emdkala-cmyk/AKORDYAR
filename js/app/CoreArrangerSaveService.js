/*
 * CoreArrangerSaveService
 *
 * Persists the current arranger metadata and debounces name edits.
 */
(function attachCoreArrangerSaveService(globalScope) {
  'use strict';

  function create({
    getElement = id => globalScope.document?.getElementById?.(id),
    getEditingArr = () => null,
    playlistNameExists = () => false,
    saveArrangers = () => {},
    renderArrangerManager = () => {},
    toast = () => {},
    isoNow = () => new Date().toISOString(),
    schedule = (...args) => globalScope.setTimeout?.(...args),
    cancel = id => globalScope.clearTimeout?.(id)
  } = {}) {
    let saveNameTimer = null;

    function saveCurrentArranger() {
      const editingArr = getEditingArr?.();
      if (!editingArr) {
        toast?.(t('noPlaylistEditing'));
        return;
      }

      const nameInput = getElement?.('arrName');
      let newName = nameInput ? nameInput.value.trim() : '';
      if (!newName) newName = t('untitledPlaylist');

      if (playlistNameExists?.(newName, editingArr.id)) {
        toast?.(t('playlistNameExists'));
        return;
      }

      editingArr.name = newName;
      editingArr.updatedAt = isoNow();
      const crossfadeRange = getElement?.('arrCrossfadeRange');
      if (crossfadeRange) {
        editingArr.crossfade = parseFloat(crossfadeRange.value) || 0;
      }

      saveArrangers?.();
      renderArrangerManager?.();
      toast?.(t('playlistSaved'));
    }

    function saveCurrentArrangerDebounced() {
      cancel?.(saveNameTimer);
      saveNameTimer = schedule?.(() => saveCurrentArranger(), 500);
    }

    return Object.freeze({
      saveCurrentArranger,
      saveCurrentArrangerDebounced
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerSaveService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
