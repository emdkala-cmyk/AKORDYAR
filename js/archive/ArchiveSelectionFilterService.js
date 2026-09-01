/**
 * ArchiveSelectionFilterService
 *
 * Coordinates archive selection state and filter controls. Song mutation
 * actions remain in ArchiveModule; this service only updates selection/filter
 * state and requests rendering.
 */
(function attachArchiveSelectionFilterService(globalScope) {
  function create(context = {}) {
    const {
      getElement,
      selectedIds,
      getSelectMode,
      setSelectMode,
      render,
      getCurrentTab,
      getAllSongs,
      getArtistFilter,
      setArtistFilter,
      renderArtists,
      updateActiveFilters,
      filterIds = ['filterSig', 'filterGenre', 'filterTempo', 'filterKey', 'filterSort'],
      t = globalScope.t || (k => k)
    } = context;

    function updateBulkControls() {
      getElement('archSelectBtn').classList.toggle('active-blue', getSelectMode());
      getElement('archiveBulkBar').classList.toggle('show', getSelectMode());
      getElement('bulkCount').textContent = selectedIds.size + ' انتخاب شده';
    }

    function getVisibleSongIds() {
      return Array.from(
        getElement('archiveList').querySelectorAll('[data-song-id]')
      ).map(row => String(row.dataset.songId));
    }

    function syncSelectAllCheckbox() {
      const checkbox = getElement('archiveList').querySelector('.arch-select-all-cb');
      if (!checkbox) return;
      const visible = getVisibleSongIds();
      if (!visible.length) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
        return;
      }
      const count = visible.filter(id => selectedIds.has(id)).length;
      checkbox.checked = count === visible.length;
      checkbox.indeterminate = count > 0 && count < visible.length;
    }

    function toggleMode() {
      setSelectMode(!getSelectMode());
      selectedIds.clear();
      updateBulkControls();
      render();
    }

    function toggle(id) {
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      updateBulkControls();
      syncSelectAllCheckbox();
      render();
    }

    function selectAll(checked) {
      const visible = getVisibleSongIds();
      if (checked) visible.forEach(id => selectedIds.add(id));
      else visible.forEach(id => selectedIds.delete(id));
      updateBulkControls();
      render();
    }

    function getFilteredSongs() {
      return getAllSongs().filter(song => {
        if (getCurrentTab() === 'fav') return !song.deletedAt && song.favorite;
        if (getCurrentTab() === 'trash') return !!song.deletedAt;
        return !song.deletedAt;
      });
    }

    function applyFilters() {
      render();
    }

    function clearFilters() {
      getElement('archiveSearch').value = '';
      getElement('archiveSearchClear').classList.remove('show');
      ['filterSig', 'filterGenre', 'filterTempo', 'filterKey'].forEach(
        id => { getElement(id).value = ''; }
      );
      getElement('filterSort').value = 'newest';
      setArtistFilter(null);
      renderArtists();
      render();
      updateActiveFilters();
    }

    return Object.freeze({
      toggleMode,
      toggle,
      selectAll,
      syncSelectAllCheckbox,
      getVisibleSongIds,
      getFilteredSongs,
      applyFilters,
      clearFilters,
      updateBulkControls
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveSelectionFilterService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
