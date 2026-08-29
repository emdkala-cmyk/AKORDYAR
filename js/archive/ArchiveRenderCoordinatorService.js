/**
 * ArchiveRenderCoordinatorService
 *
 * Coordinates archive filtering, sorting, counters and the hand-off to the
 * markup renderer. It does not build markup and it does not own archive state;
 * both are injected so the legacy facade can keep its public names.
 */
(function attachArchiveRenderCoordinatorService(globalScope) {
  function create(context = {}) {
    const {
      getElement = id => globalScope.document?.getElementById(id),
      getAllSongs = () => [],
      normalizeText = value => String(value ?? '').trim().toLowerCase(),
      extractSearchText = song => normalizeText(song?.title),
      getCurrentTab = () => 'all',
      getArtistFilter = () => null,
      matchDefaultArtist = () => null,
      artistKey = value => normalizeText(value),
      getViewMode = () => 'card',
      getSelectMode = () => false,
      getSelectedIds = () => new Set(),
      getActiveSongId = () => null,
      renderList = () => {},
      renderEmpty = () => {}
    } = context;
    const FEEL_6_8_LABEL = '2/4 (حس 6/8)';
    const FEEL_6_8_ID = '2/4-feel-6/8';

    function normalizeSignature(value) {
      return normalizeText(String(value ?? ''))
        .replace(/[()[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function getSignatureIdentity(valueOrSong) {
      const isSong = valueOrSong && typeof valueOrSong === 'object';
      const raw = normalizeSignature(
        isSong ? valueOrSong.timeSignature : valueOrSong
      );
      const preset = isSong
        ? normalizeSignature(valueOrSong.timeSignaturePreset)
        : '';
      if (
        preset === FEEL_6_8_ID ||
        preset === normalizeSignature(FEEL_6_8_LABEL) ||
        raw === FEEL_6_8_ID ||
        raw === normalizeSignature(FEEL_6_8_LABEL) ||
        raw === '2/4 6/8'
      ) {
        return FEEL_6_8_ID;
      }
      return raw || '4/4';
    }

    function getSignatureQueryIdentity(value) {
      const normalized = normalizeSignature(value);
      if (!normalized) return null;
      if (
        normalized === FEEL_6_8_ID ||
        normalized === normalizeSignature(FEEL_6_8_LABEL) ||
        normalized === '2/4 6/8'
      ) {
        return FEEL_6_8_ID;
      }
      if (/^\d+\s*\/\s*\d+$/.test(normalized)) return normalized;
      return null;
    }

    function matchesSignatureQuery(song, query) {
      const queryIdentity = getSignatureQueryIdentity(query);
      if (!queryIdentity) return null;
      return getSignatureIdentity(song) === queryIdentity;
    }

    function filterByTab(songs, currentTab) {
      if (currentTab === 'fav') return songs.filter(song => !song.deletedAt && song.favorite);
      if (currentTab === 'trash') return songs.filter(song => song.deletedAt);
      return songs.filter(song => !song.deletedAt);
    }

    function matchesFilters(song, filters) {
      const {
        query,
        artistFilter,
        signature,
        genre,
        keyFilter,
        tempoRange
      } = filters;
      const signatureQueryMatch = matchesSignatureQuery(song, query);
      if (signatureQueryMatch === false) return false;
      if (
        signatureQueryMatch === null &&
        query &&
        !extractSearchText(song).includes(query)
      ) return false;
      if (artistFilter) {
        const rawArtist = song.artist || song.artistName || song.singer || '';
        const matched = matchDefaultArtist(rawArtist);
        const songKey = matched
          ? artistKey(matched.normalizedName)
          : artistKey(rawArtist);
        if (songKey !== artistFilter) return false;
      }
      if (
        signature &&
        getSignatureIdentity(song) !== getSignatureQueryIdentity(signature)
      ) return false;
      if (genre && song.genre !== genre) return false;
      if (keyFilter === '_maj' && song.keyMode !== 'maj') return false;
      if (keyFilter === '_min' && song.keyMode !== 'min') return false;
      if (
        keyFilter &&
        keyFilter !== '_maj' &&
        keyFilter !== '_min' &&
        song.key !== keyFilter
      ) {
        return false;
      }
      if (tempoRange) {
        const bpm = song.tempo || song.bpm || 120;
        if (tempoRange === 'slow' && bpm > 80) return false;
        if (tempoRange === 'mid' && (bpm <= 80 || bpm > 120)) return false;
        if (tempoRange === 'fast' && (bpm <= 120 || bpm > 160)) return false;
        if (tempoRange === 'vfast' && bpm <= 160) return false;
      }
      return true;
    }

    function sortSongs(songs, sort) {
      songs.sort((a, b) => {
        switch (sort) {
          case 'newest':
            return (b.createdAt || '').localeCompare(a.createdAt || '');
          case 'oldest':
            return (a.createdAt || '').localeCompare(b.createdAt || '');
          case 'title':
            return (a.title || '').localeCompare(b.title || '', 'fa');
          case 'artist':
            return (a.artist || '').localeCompare(b.artist || '', 'fa');
          case 'lastEdit':
            return (b.updatedAt || '').localeCompare(a.updatedAt || '');
          case 'lastOpen':
            return (b.lastOpenedAt || '').localeCompare(a.lastOpenedAt || '');
          case 'key':
            return (a.key || '').localeCompare(b.key || '');
          case 'bpm':
            return (a.tempo || 0) - (b.tempo || 0);
          default:
            return 0;
        }
      });
      return songs;
    }

    function render() {
      const allSongs = getAllSongs();
      const currentTab = getCurrentTab();
      const activeAll = allSongs.filter(song => !song.deletedAt);
      const query = normalizeText(getElement('archiveSearch')?.value || '');
      const signature = getElement('filterSig')?.value || '';
      const genre = getElement('filterGenre')?.value || '';
      const tempoRange = getElement('filterTempo')?.value || '';
      const keyFilter = getElement('filterKey')?.value || '';
      const sort = getElement('filterSort')?.value || 'newest';

      getElement('tabCountAll').textContent = activeAll.length;
      getElement('tabCountFav').textContent =
        activeAll.filter(song => song.favorite).length;
      getElement('tabCountTrash').textContent =
        allSongs.filter(song => song.deletedAt).length;
      getElement('archiveTotalCount').textContent = `(${activeAll.length} ترانه)`;

      const songs = filterByTab(allSongs, currentTab).filter(song =>
        matchesFilters(song, {
          query,
          artistFilter: getArtistFilter(),
          signature,
          genre,
          keyFilter,
          tempoRange
        })
      );
      sortSongs(songs, sort);

      getElement('archiveResultCount').textContent = songs.length + ' نتیجه';
      const isTrash = currentTab === 'trash';
      getElement('archiveStatusText').textContent =
        isTrash ? 'سطل زباله' : currentTab === 'fav' ? 'علاقه‌مندی‌ها' : 'همه ترانه‌ها';
      getElement('archiveFilterBar').style.display = isTrash ? 'none' : '';

      const list = getElement('archiveList');
      list.innerHTML = '';
      if (!songs.length) {
        renderEmpty(list, {
          query,
          isTrash,
          currentTab
        });
        return;
      }
      renderList(list, songs, {
        viewMode: getViewMode(),
        selectMode: getSelectMode(),
        selectedIds: getSelectedIds(),
        activeId: getActiveSongId()
      });
    }

    return Object.freeze({ render });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveRenderCoordinatorService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
