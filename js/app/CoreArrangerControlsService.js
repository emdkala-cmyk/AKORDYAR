/**
 * CoreArrangerControlsService
 *
 * Owns arranger editor controls while receiving the active arranger and
 * rendering/persistence callbacks from core.
 */
(function attachCoreArrangerControlsService(globalScope) {
  'use strict';

  function create({
    getEditingArr = () => null,
    getElement = id => globalScope.document?.getElementById?.(id),
    ensureArrItem = () => ({}),
    customPrompt = () => Promise.resolve(null),
    confirm = message => globalScope.confirm?.(message) || false,
    saveArrangers = () => {},
    renderArrPool = () => {},
    renderArrSetlist = () => {}
  } = {}) {
    function arrSetCrossfade(value) {
      const editingArr = getEditingArr?.();
      if (editingArr) {
        editingArr.crossfade = value;
        saveArrangers?.();
      }
      const output = getElement('arrCrossfadeVal');
      if (output) output.textContent = value + 's';
    }

    function arrTogglePauseBetween() {
      const editingArr = getEditingArr?.();
      if (!editingArr) return;
      editingArr.pauseBetween = !editingArr.pauseBetween;
      getElement('arrPauseBtn')?.classList?.toggle?.(
        'arr-stl-active',
        editingArr.pauseBetween
      );
      saveArrangers?.();
    }

    async function arrAutoTranspose() {
      const editingArr = getEditingArr?.();
      if (!editingArr) return;
      const value = await customPrompt(
        'تغییر گام برای همه آهنگ‌ها (مثلاً 2 یا -3):',
        '0'
      );
      if (value === null) return;
      const semitones = parseInt(value);
      if (Number.isNaN(semitones)) return;
      editingArr.items.forEach((id, index) => {
        const setting = ensureArrItem(editingArr, index);
        setting.transpose = (setting.transpose || 0) + semitones;
      });
      saveArrangers?.();
      renderArrSetlist?.();
    }

    function arrClearNotes() {
      const editingArr = getEditingArr?.();
      if (!editingArr || !confirm('یادداشت‌های همه آهنگ‌ها پاک شود؟')) {
        return;
      }
      editingArr.items.forEach((id, index) => {
        const setting = ensureArrItem(editingArr, index);
        setting.notes = '';
      });
      saveArrangers?.();
      renderArrSetlist?.();
    }

    function arrFilterSongs() {
      renderArrPool?.();
      renderArrSetlist?.();
    }

    return Object.freeze({
      arrSetCrossfade,
      arrTogglePauseBetween,
      arrAutoTranspose,
      arrClearNotes,
      arrFilterSongs
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerControlsService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
