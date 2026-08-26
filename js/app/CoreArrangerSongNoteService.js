/**
 * CoreArrangerSongNoteService
 *
 * Owns the Arranger song-note modal state and persistence callbacks without
 * owning the arranger collection itself.
 */
(function attachCoreArrangerSongNoteService(globalScope) {
  'use strict';

  function create({
    getEditingArr = () => null,
    getAllSongs = () => [],
    getElement = id => globalScope.document?.getElementById?.(id),
    ensureArrItem = () => ({}),
    saveArrangers = () => {},
    renderArrSetlist = () => {}
  } = {}) {
    let noteIndex = -1;

    function openArrSongNote(index) {
      const editingArr = getEditingArr?.();
      if (!editingArr) return;

      noteIndex = index;
      const allSongs = getAllSongs?.() || [];
      const id = editingArr.items[index];
      const song = allSongs.find(item => item.id === id);
      const setting = ensureArrItem(editingArr, index);
      const title = getElement('arrSongNoteTitle');
      const text = getElement('arrSongNoteText');
      const overlay = getElement('arrSongNoteOverlay');
      if (title) {
        title.textContent =
          (song ? (song.title || 'بدون نام') : '') + ' — یادداشت اجرا';
      }
      if (text) text.value = setting.notes || '';
      overlay?.classList?.add?.('show');
    }

    function closeArrSongNote() {
      getElement('arrSongNoteOverlay')?.classList?.remove?.('show');
      noteIndex = -1;
    }

    function saveArrSongNote() {
      const editingArr = getEditingArr?.();
      if (noteIndex < 0 || !editingArr) return;
      const setting = ensureArrItem(editingArr, noteIndex);
      setting.notes = getElement('arrSongNoteText')?.value || '';
      saveArrangers?.();
      closeArrSongNote();
      renderArrSetlist?.();
    }

    return Object.freeze({
      openArrSongNote,
      closeArrSongNote,
      saveArrSongNote
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerSongNoteService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
