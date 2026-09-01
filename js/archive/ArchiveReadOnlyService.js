/**
 * ArchiveReadOnlyService
 *
 * Owns read-only archive loading, the read-only banner and editable-copy
 * creation. Editable loading itself remains in ArchiveSongLoadService.
 */
(function attachArchiveReadOnlyService(globalScope) {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function create(context = {}) {
    const {
      documentRef = globalScope.document,
      getElement = id => documentRef?.getElementById(id),
      getAllSongs = () => [],
      getCurrentSong = () => null,
      setAllSongs = () => {},
      setSong = () => {},
      generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      ensureSongParsed = () => {},
      closeArchive = () => {},
      loadProject = async () => {},
      getLoading = () => false,
      setLoading = () => {},
      setReadOnly = () => {},
      now = () => new Date().toISOString(),
      toast = () => {},
      logError = (...args) => console.error(...args)
    } = context;

    function showBanner() {
      let banner = getElement('readOnlyBanner');
      if (!banner) {
        banner = documentRef.createElement('div');
        banner.id = 'readOnlyBanner';
        banner.style.cssText =
          'position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(255,165,0,0.95);color:#000;text-align:center;padding:8px;font-weight:700;font-size:0.85rem;display:flex;justify-content:center;align-items:center;gap:12px;';
        documentRef.body.appendChild(banner);
      }
      banner.innerHTML =
        '👁 حالت فقط‌خواندنی | <button data-action="archExitReadOnly" style="background:#000;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:700;" type="button">خروج از فقط‌خواندنی</button> <button data-action="archCreateEditableCopy" style="background:#fff;color:#000;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:700;" type="button">ایجاد نسخه قابل ویرایش</button>';
      if (!banner._actionListenerAttached) {
        const actions = {
          archExitReadOnly: exitReadOnly,
          archCreateEditableCopy: createEditableCopy
        };
        banner.addEventListener('click', event => {
          const control = event.target.closest('[data-action]');
          if (!control) return;
          const action = actions[control.dataset.action];
          if (typeof action === 'function') action(event, control);
        });
        banner._actionListenerAttached = true;
      }
      banner.style.display = 'flex';
    }

    function exitReadOnly() {
      setReadOnly(false);
      const banner = getElement('readOnlyBanner');
      banner?.remove();
      toast('حالت فقط‌خواندنی غیرفعال شد');
    }

    async function createEditableCopy() {
      const sourceSong = getCurrentSong();
      if (!sourceSong) return;
      exitReadOnly();
      const copy = clone(sourceSong);
      copy.id = generateId();
      copy.title = (copy.title || 'بدون نام') + ' (نسخه قابل ویرایش)';
      copy.createdAt = now();
      copy.updatedAt = now();
      const songs = getAllSongs();
      songs.unshift(copy);
      setAllSongs(songs);
      setSong(copy);
      toast('نسخه قابل ویرایش ساخته شد');
    }

    async function loadReadOnly(id) {
      if (getLoading()) return;
      setLoading(true);
      try {
        const song = getAllSongs().find(item => String(item.id) === String(id));
        if (!song || song.deletedAt) {
          toast('ترانه یافت نشد');
          setLoading(false);
          return;
        }
        toast('در حال باز کردن ترانه...');
        ensureSongParsed(song);
        closeArchive();
        await loadProject(song);
        setReadOnly(true);
        const loadedSong = getCurrentSong();
        const songs = getAllSongs();
        const index = songs.findIndex(
          item => String(item.id) === String(loadedSong?.id)
        );
        if (index > -1) {
          songs[index].lastOpenedAt = now();
          setAllSongs(songs);
        }
        showBanner();
        toast('ترانه در حالت فقط‌خواندنی باز شد');
      } catch (error) {
        logError('Archive readonly load error:', error);
        toast('خطا در لود ترانه: ' + (error.message || 'خطای ناشناخته'));
      } finally {
        setLoading(false);
      }
    }

    return Object.freeze({
      loadReadOnly,
      showBanner,
      exitReadOnly,
      createEditableCopy
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveReadOnlyService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
