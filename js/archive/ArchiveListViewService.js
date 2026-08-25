/**
 * ArchiveListViewService
 *
 * Coordinates archive list/table view controls and delegated list actions.
 * Song operations are injected so this service does not own archive mutations.
 */
(function attachArchiveListViewService(globalScope) {
  function create(context = {}) {
    const {
      documentRef = globalScope.document,
      storage = globalScope.localStorage,
      getElement = id => documentRef?.getElementById(id),
      getViewMode = () => 'card',
      setViewMode = () => {},
      getCurrentTab = () => 'all',
      setCurrentTab = () => {},
      render = () => {},
      loadSong = () => {},
      loadSongReadOnly = () => {},
      editSong = () => {},
      toggleFavorite = () => {},
      duplicateSong = () => {},
      exportSong = () => {},
      trashSong = () => {},
      restoreSong = () => {},
      permanentDelete = () => {},
      showContextMenu = () => {}
    } = context;

    function setView(mode) {
      setViewMode(mode);
      storage?.setItem('arch_view_mode', mode);
      getElement('archViewCard')?.classList.toggle('active-blue', mode === 'card');
      getElement('archViewTable')?.classList.toggle('active-blue', mode === 'table');
      getElement('archiveList')?.classList.toggle('table-view', mode === 'table');
      render();
    }

    function setTab(tab) {
      setCurrentTab(tab);
      documentRef
        ?.querySelectorAll('.archive-tabs .at-tab')
        .forEach(element => element.classList.toggle('active', element.dataset.tab === tab));
      render();
    }

    function dispatchAction(action, id, event) {
      switch (action) {
        case 'open':
          loadSong(id);
          break;
        case 'readonly':
          loadSongReadOnly(id);
          break;
        case 'edit':
          editSong(id);
          break;
        case 'fav':
          toggleFavorite(id);
          break;
        case 'duplicate':
          duplicateSong(id);
          break;
        case 'export':
          exportSong(id);
          break;
        case 'trash':
          trashSong(id);
          break;
        case 'restore':
          restoreSong(id);
          break;
        case 'permanent-delete':
          permanentDelete(id);
          break;
        case 'menu':
          showContextMenu(event, id);
          break;
        default:
          break;
      }
    }

    function handleListClick(event) {
      const card = event.target.closest('[data-song-id]');
      if (!card) return;
      const id = String(card.dataset.songId);
      const actionElement = event.target.closest('[data-arch-action]');
      if (actionElement) {
        event.stopPropagation();
        dispatchAction(actionElement.dataset.archAction, id, event);
        return;
      }
      if (!event.target.closest('.archive-card-actions') &&
          !event.target.closest('.archive-card-check')) {
        loadSong(id);
      }
    }

    function handleListKeydown(event) {
      if (event.key !== 'Enter' && event.key !== 'Delete') return;
      const card = event.target.closest('[data-song-id]');
      if (!card) return;
      const id = String(card.dataset.songId);
      if (event.key === 'Enter') loadSong(id);
      if (event.key === 'Delete') trashSong(id);
    }

    return Object.freeze({
      setView,
      setTab,
      dispatchAction,
      handleListClick,
      handleListKeydown
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveListViewService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
