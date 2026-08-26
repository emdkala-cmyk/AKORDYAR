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
        toast?.('⚠ هیچ پلی‌لیستی در حال ویرایش نیست');
        return;
      }

      const nameInput = getElement?.('arrName');
      let newName = nameInput ? nameInput.value.trim() : '';
      if (!newName) newName = 'پلی‌لیست بدون نام';

      if (playlistNameExists?.(newName, editingArr.id)) {
        toast?.(`⚠ پلی‌لیستی با نام «${newName}» از قبل وجود دارد.`);
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
      toast?.(
        `✅ پلی‌لیست «${editingArr.name}» ذخیره شد (${editingArr.items.length} آهنگ)`
      );
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
