/**
 * ArchiveSongLoadService
 *
 * Loads an editable song from the archive while keeping read-only loading
 * outside this service.
 */
(function attachArchiveSongLoadService(globalScope) {
  function create(context = {}) {
    const {
      getAllSongs = () => [],
      getCurrentSong = () => null,
      getLoading = () => false,
      setLoading = () => {},
      ensureSongParsed = () => {},
      hasUnsavedChanges = () => false,
      confirmUnsaved = async () => false,
      saveCurrent = async () => {},
      closeArchive = () => {},
      loadProject = async () => {},
      setAllSongs = () => {},
      now = () => new Date().toISOString(),
      toast = () => {},
      t = globalScope.t || (k => k),
      logError = (...args) => console.error(...args)
    } = context;

    async function load(id) {
      if (getLoading()) return;
      setLoading(true);
      try {
        const song = getAllSongs().find(item => String(item.id) === String(id));
        if (!song || song.deletedAt) {
          toast(t('songNotFoundSingle'));
          setLoading(false);
          return;
        }
        toast(t('loading'));
        ensureSongParsed(song);
        if (getCurrentSong() && hasUnsavedChanges()) {
          const shouldSave = await confirmUnsaved();
          if (shouldSave) await saveCurrent();
        }
        closeArchive();
        await loadProject(song);
        const loadedSong = getCurrentSong();
        const allSongs = getAllSongs();
        const index = allSongs.findIndex(
          item => String(item.id) === String(loadedSong?.id)
        );
        if (index > -1) {
          allSongs[index].lastOpenedAt = now();
          setAllSongs(allSongs);
        }
        toast(t('projectLoaded') + (loadedSong?.title || t('untitled')));
      } catch (error) {
        logError('Archive load error:', error);
        toast(t('audioLoadFailed') + (error.message || t('unknown')));
      } finally {
        setLoading(false);
      }
    }

    return Object.freeze({ load });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveSongLoadService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
