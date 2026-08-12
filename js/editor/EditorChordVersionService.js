/**
 * EditorChordVersionService
 *
 * مدیریت نسخه‌های آکورد و snapshot کلیپ‌های chord بدون وابستگی به DOM یا global state.
 */
(function attachEditorChordVersionService(globalScope) {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function create({
    getSong = () => null,
    getDAW = () => null,
    uid = value => value,
    roundMs = value => value,
    renderEditor = () => {},
    saveState = () => {},
    renderTracks = () => {},
    renderClips = () => {},
    refreshKeyUI = () => {},
    customPrompt = async () => null,
    toast = () => {}
  } = {}) {
    function chordTrack(daw = getDAW()) {
      return daw?.tracks?.find(track => track.type === 'chord') || null;
    }

    function chordClips(daw = getDAW(), track = chordTrack(daw)) {
      return track
        ? (daw.clips || []).filter(
            clip => clip.type === 'chord' && clip.trackId === track.id
          )
        : [];
    }

    function ensureInitialized() {
      const song = getSong();
      if (!song) return false;
      if (!Array.isArray(song.chordVersions)) song.chordVersions = [];
      if (song.activeChordVersion === undefined) song.activeChordVersion = 0;
      if (song.chordVersions.length === 0) {
        const clips = chordClips();
        song.chordVersions.push({
          name: 'V1',
          chords: clone(song.chords || []),
          clips: clone(clips.map(clip => ({
            start: clip.start,
            duration: clip.duration,
            color: clip.color
          }))),
          transpose: song.transpose || 0,
          key: song.key || 'C',
          keyMode: song.keyMode || 'maj'
        });
        song.activeChordVersion = 0;
      }
      return true;
    }

    function saveCurrent() {
      const song = getSong();
      if (!song || !Array.isArray(song.chordVersions)) return false;
      const version = song.chordVersions[song.activeChordVersion || 0];
      if (!version) return false;
      version.chords = clone(song.chords || []);
      version.transpose = song.transpose || 0;
      version.key = song.key || 'C';
      version.keyMode = song.keyMode || 'maj';
      const track = chordTrack();
      if (track) {
        version.clips = clone(chordClips().map(clip => ({
          start: clip.start,
          duration: clip.duration,
          color: clip.color,
          name: clip.name
        })));
      }
      return true;
    }

    function loadToTimeline(versionIndex) {
      const song = getSong();
      const daw = getDAW();
      const version = song?.chordVersions?.[versionIndex];
      const track = chordTrack(daw);
      if (!song || !version || !track) return false;

      daw.clips = (daw.clips || []).filter(
        clip => !(clip.type === 'chord' && clip.trackId === track.id)
      );
      const savedClips = Array.isArray(version.clips) ? version.clips : [];
      savedClips.forEach((saved, index) => {
        const name = saved?.name || version.chords?.[index]?.name || '';
        if (!name) return;
        daw.clips.push({
          id: uid('c'),
          type: 'chord',
          trackId: track.id,
          name,
          start: saved.start != null ? saved.start : roundMs(index * 2),
          duration: saved.duration || 2,
          color: saved.color || '#9F7AEA'
        });
      });
      return true;
    }

    function switchVersion(direction) {
      const song = getSong();
      if (!song || !ensureInitialized()) return false;
      saveCurrent();
      const current = song.activeChordVersion || 0;
      const next = Math.max(
        0,
        Math.min(song.chordVersions.length - 1, current + direction)
      );
      if (next === current) {
        toast('ورژن ' + (current + 1) + ' (آخرین)');
        return false;
      }
      const version = song.chordVersions[next];
      song.activeChordVersion = next;
      song.chords = clone(version.chords || []);
      song.transpose = version.transpose !== undefined ? version.transpose : 0;
      if (version.key) song.key = version.key;
      if (version.keyMode) song.keyMode = version.keyMode;
      renderEditor(true);
      loadToTimeline(next);
      saveState();
      renderTracks();
      renderClips();
      refreshKeyUI();
      toast('ورژن: ' + (version.name || 'V' + (next + 1)));
      return true;
    }

    function addVersion() {
      const song = getSong();
      if (!song || !ensureInitialized()) return false;
      if (song.chordVersions.length >= 10) {
        toast('حداکثر ۱۰ ورژن');
        return false;
      }
      saveCurrent();
      const index = song.chordVersions.length;
      song.chordVersions.push({
        name: 'V' + (index + 1),
        chords: [],
        clips: [],
        transpose: song.transpose || 0,
        key: song.key || 'C',
        keyMode: song.keyMode || 'maj'
      });
      song.activeChordVersion = index;
      song.chords = [];
      const track = chordTrack();
      if (track) {
        const daw = getDAW();
        daw.clips = (daw.clips || []).filter(
          clip => !(clip.type === 'chord' && clip.trackId === track.id)
        );
      }
      renderEditor(true);
      saveState();
      renderTracks();
      renderClips();
      toast('ورژن جدید: V' + (index + 1));
      return true;
    }

    async function renameVersion() {
      const song = getSong();
      if (!song?.chordVersions) return false;
      const index = song.activeChordVersion || 0;
      const version = song.chordVersions[index];
      if (!version) return false;
      const name = await customPrompt(
        'نام ورژن:',
        version.name || 'V' + (index + 1)
      );
      if (name === null || !name.trim()) return false;
      version.name = name.trim();
      saveState();
      renderTracks();
      toast('نام ورژن: ' + version.name);
      return true;
    }

    function syncTransposeToTimeline() {
      const song = getSong();
      const clips = chordClips();
      if (!song || !clips.length) return false;
      clips.forEach((clip, index) => {
        if (index < song.chords?.length && song.chords[index].name) {
          clip.name = song.chords[index].name;
        }
      });
      saveState();
      renderClips();
      return true;
    }

    return Object.freeze({
      ensureInitialized,
      saveCurrent,
      loadToTimeline,
      switchVersion,
      addVersion,
      renameVersion,
      syncTransposeToTimeline
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorChordVersionService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
