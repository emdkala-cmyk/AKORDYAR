/**
 * ArchiveMetadataEditService
 *
 * Owns archive metadata form hydration and persistence.
 */
(function attachArchiveMetadataEditService(globalScope) {
  const KEY_OPTIONS = Object.freeze([
    'C', 'C#', 'D', 'D#', 'E', 'F',
    'F#', 'G', 'G#', 'A', 'A#', 'B'
  ]);
  const FEEL_6_8_LABEL = '2/4 (حس 6/8)';
  const FEEL_6_8_ID = '2/4-feel-6/8';

  function getDisplayTimeSignature(song, metadata) {
    if (typeof metadata?.getDisplayTimeSignature === 'function') {
      return metadata.getDisplayTimeSignature(song);
    }
    return song?.timeSignaturePreset === FEEL_6_8_ID ||
      song?.timeSignature === FEEL_6_8_LABEL
      ? FEEL_6_8_LABEL
      : song?.timeSignature || '4/4';
  }

  function setTimeSignature(song, value, metadata) {
    if (typeof metadata?.setTimeSignature === 'function') {
      metadata.setTimeSignature(song, value);
      return;
    }
    if (value === FEEL_6_8_LABEL || value === FEEL_6_8_ID) {
      song.timeSignature = '2/4';
      song.timeSignaturePreset = FEEL_6_8_ID;
    } else {
      song.timeSignature = value || '4/4';
      delete song.timeSignaturePreset;
    }
  }

  function create(context = {}) {
    const {
      getElement = id => globalScope.document?.getElementById(id),
      getAllSongs = () => [],
      setAllSongs = () => {},
      getEditSongId = () => null,
      setEditSongId = () => {},
      artistKey = value => value || '',
      pushUndo = () => {},
      resetSearchCache = () => {},
      resetArtistCache = () => {},
      render = () => {},
      renderArtists = () => {},
      updateActiveFilters = () => {},
      toast = () => {},
      now = () => new Date().toISOString(),
      OptionCtor = globalScope.Option,
      metadata = globalScope.SongMetadata
    } = context;

    function open(id) {
      const song = getAllSongs().find(item => String(item.id) === String(id));
      if (!song) return;
      setEditSongId(id);
      getElement('aeTitle').value = song.title || '';
      getElement('aeArtist').value = song.artist || '';
      getElement('aeAlbum').value = song.album || '';
      getElement('aeKey').value = song.key || 'C';
      getElement('aeKeyMode').value = song.keyMode || 'maj';
      getElement('aeBpm').value = song.tempo || song.bpm || 120;
      getElement('aeTimeSig').value = getDisplayTimeSignature(song, metadata);
      getElement('aeGenre').value = song.genre || '';
      getElement('aeCategory').value = (song.categories || []).join(', ');
      getElement('aeNotes').value = song.notes || '';

      const keySelect = getElement('aeKey');
      if (keySelect?.options && keySelect.options.length <= 1 &&
          typeof OptionCtor === 'function') {
        KEY_OPTIONS.forEach(key => keySelect.add(new OptionCtor(key, key)));
      }
      getElement('archiveEditOverlay')?.classList.add('show');
    }

    function close() {
      getElement('archiveEditOverlay')?.classList.remove('show');
      setEditSongId(null);
    }

    function save() {
      const id = getEditSongId();
      if (!id) return;
      pushUndo('ویرایش مشخصات');
      const songs = getAllSongs();
      const song = songs.find(item => String(item.id) === String(id));
      if (!song) return;

      song.title = getElement('aeTitle').value.trim() || 'بدون نام';
      song.artist = getElement('aeArtist').value.trim();
      song.artistKey = artistKey(song.artist);
      song.album = getElement('aeAlbum').value.trim();
      song.key = getElement('aeKey').value;
      song.keyMode = getElement('aeKeyMode').value;
      song.tempo = parseInt(getElement('aeBpm').value, 10) || 120;
      song.bpm = song.tempo;
      setTimeSignature(song, getElement('aeTimeSig').value, metadata);
      song.genre = getElement('aeGenre').value;
      song.categories = getElement('aeCategory').value
        .split(',')
        .map(category => category.trim())
        .filter(Boolean);
      song.notes = getElement('aeNotes').value.trim();
      song.updatedAt = now();

      setAllSongs(songs);
      resetSearchCache();
      resetArtistCache();
      close();
      render();
      renderArtists();
      updateActiveFilters();
      toast('مشخصات به‌روزرسانی شد');
    }

    return Object.freeze({ open, close, save });
  }

  const service = Object.freeze({ create, keyOptions: KEY_OPTIONS });
  globalScope.ArchiveMetadataEditService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
