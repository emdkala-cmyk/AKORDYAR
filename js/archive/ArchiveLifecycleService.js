/**
 * ArchiveLifecycleService
 *
 * Owns opening/closing the archive modal and one-time registration of its
 * base listeners. Selection, filtering and rendering remain injected.
 */
(function attachArchiveLifecycleService(globalScope) {
  function create(context = {}) {
    const {
      getElement,
      documentRef = globalScope.document,
      getViewMode,
      render,
      renderArtists,
      initArtistSection,
      applyFilters,
      handleListClick,
      handleListKeydown,
      stopAutoScroll,
      isFullscreen = () => false,
      setFullscreen = () => {},
      filterIds = ['filterSig', 'filterGenre', 'filterTempo', 'filterKey', 'filterSort']
    } = context;
    let eventsBound = false;
    let searchDebounceTimer = null;

    function bindEvents() {
      if (eventsBound) return;
      eventsBound = true;
      const search = getElement('archiveSearch');
      search.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(applyFilters, 200);
        getElement('archiveSearchClear').classList.toggle('show', !!search.value);
      });
      filterIds.forEach(id => getElement(id).addEventListener('change', applyFilters));
      getElement('archiveModal').addEventListener('click', event => {
        if (
          !event.target.closest('.archive-ctx-menu') &&
          !event.target.closest('.btn-menu')
        ) {
          getElement('archiveCtxMenu').classList.remove('show');
        }
      });
      getElement('archiveModal').addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
      });
      getElement('archiveList').addEventListener('click', handleListClick);
      getElement('archiveList').addEventListener('keydown', handleListKeydown);
    }

    function open() {
      getElement('archiveList').classList.toggle('table-view', getViewMode() === 'table');
      render();
      renderArtists();
      initArtistSection();
      getElement('archiveModal').classList.add('show');
      bindEvents();
    }

    function close() {
      getElement('archiveModal').classList.remove('show');
      getElement('archiveCtxMenu').classList.remove('show');
      stopAutoScroll();
      if (isFullscreen()) {
        setFullscreen(false);
        const dialog = documentRef.querySelector('.archive-modal-dialog');
        if (dialog) {
          dialog.style.width = '';
          dialog.style.height = '';
          dialog.style.maxWidth = '';
          dialog.style.maxHeight = '';
          dialog.style.borderRadius = '';
        }
      }
    }

    return Object.freeze({ open, close, bindEvents });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveLifecycleService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
