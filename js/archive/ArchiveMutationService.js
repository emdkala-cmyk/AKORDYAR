/**
 * ArchiveMutationService
 *
 * Owns archive song mutations that change lifecycle flags or create copies:
 * trash, restore, permanent delete, favorite and duplicate operations.
 */
(function attachArchiveMutationService(globalScope) {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function create(context = {}) {
    const {
      getAllSongs,
      setAllSongs,
      selectedIds = new Set(),
      clearSelected = () => selectedIds.clear(),
      setSelectMode = () => {},
      updateSelectionUi = () => {},
      confirm,
      pushUndo,
      deleteAudioBlobsForProject = async () => {},
      generateId,
      render,
      renderArtists,
      updateActiveFilters,
      resetSearchCache,
      escapeHtml = value => String(value ?? ''),
      toast,
      now = () => new Date().toISOString()
    } = context;

    function findSong(id, songs = getAllSongs()) {
      return songs.find(song => String(song.id) === String(id));
    }

    function refresh({ artists = true, filters = true, resetCache = false } = {}) {
      if (resetCache) resetSearchCache?.();
      render?.();
      if (artists) renderArtists?.();
      if (filters) updateActiveFilters?.();
    }

    async function bulkTrash() {
      if (!selectedIds.size) return;
      const ok = await confirm(
        'انتقال به سطل زباله',
        `${selectedIds.size} ترانه به سطل زباله منتقل شود؟`,
        'انتقال'
      );
      if (!ok) return;
      pushUndo('انتقال گروهی');
      const songs = getAllSongs();
      const timestamp = now();
      songs.forEach(song => {
        if (selectedIds.has(String(song.id))) song.deletedAt = timestamp;
      });
      setAllSongs(songs);
      clearSelected();
      setSelectMode(false);
      updateSelectionUi();
      refresh();
      toast?.('ترانه‌ها به سطل زباله منتقل شدند');
    }

    async function bulkFavorite(add) {
      if (!selectedIds.size) return;
      pushUndo(add ? 'افزودن گروهی' : 'حذف گروهی علاقه‌مندی');
      const songs = getAllSongs();
      songs.forEach(song => {
        if (selectedIds.has(String(song.id))) song.favorite = add;
      });
      setAllSongs(songs);
      refresh();
      toast?.(add ? 'به علاقه‌مندی اضافه شد' : 'از علاقه‌مندی حذف شد');
    }

    async function trash(id) {
      const songs = getAllSongs();
      const song = findSong(id, songs);
      if (!song) return;
      const ok = await confirm(
        'انتقال به سطل زباله',
        `ترانه «${escapeHtml(song.title || t('untitled'))}» به سطل زباله منتقل شود؟`,
        'انتقال'
      );
      if (!ok) return;
      pushUndo('انتقال به سطل زباله');
      song.deletedAt = now();
      setAllSongs(songs);
      refresh();
      toast?.('ترانه به سطل زباله منتقل شد');
    }

    async function restore(id) {
      pushUndo('بازیابی');
      const songs = getAllSongs();
      const song = findSong(id, songs);
      if (song) {
        song.deletedAt = null;
        song.updatedAt = now();
      }
      setAllSongs(songs);
      refresh();
      toast?.('ترانه بازیابی شد');
    }

    async function permanentDelete(id) {
      const songs = getAllSongs();
      const song = findSong(id, songs);
      if (!song) return;
      const ok = await confirm(
        'حذف دائمی',
        `<strong>⚠️ این عمل غیرقابل بازگشت است!</strong><br>ترانه «${escapeHtml(song.title || t('untitled'))}» برای همیشه حذف خواهد شد.`,
        'حذف دائمی',
        true
      );
      if (!ok) return;
      pushUndo('حذف دائمی');
      const index = songs.findIndex(item => String(item.id) === String(id));
      if (index > -1) songs.splice(index, 1);
      setAllSongs(songs);
      try {
        await deleteAudioBlobsForProject(id);
      } catch (_) {}
      refresh();
      toast?.('ترانه برای همیشه حذف شد');
    }

    function toggleFavorite(id) {
      pushUndo('تغییر علاقه‌مندی');
      const songs = getAllSongs();
      const song = findSong(id, songs);
      if (song) song.favorite = !song.favorite;
      setAllSongs(songs);
      render?.();
    }

    function duplicate(id) {
      const songs = getAllSongs();
      const song = findSong(id, songs);
      if (!song) return;
      const copy = clone(song);
      copy.id = generateId();
      copy.title = (copy.title || t('untitled')) + ' (کپی)';
      copy.createdAt = now();
      copy.updatedAt = now();
      copy.lastOpenedAt = null;
      songs.unshift(copy);
      setAllSongs(songs);
      refresh({ resetCache: true });
      toast?.('نسخه کپی ساخته شد');
    }

    return Object.freeze({
      bulkTrash,
      bulkFavorite,
      trash,
      restore,
      permanentDelete,
      toggleFavorite,
      duplicate
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveMutationService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
