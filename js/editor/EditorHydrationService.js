/**
 * EditorHydrationService
 *
 * منطق مشترک آماده‌سازی سند و بازگردانی state تایم‌لاین را از editor.js جدا
 * می‌کند. این سرویس مالک state نیست و فقط از DAW و callbackهای تزریق‌شده استفاده
 * می‌کند تا مرز legacy و مسیر جدید قابل‌آزمون باقی بماند.
 */
(function attachEditorHydrationService(globalScope) {
  const DEFAULT_STYLES = Object.freeze({
    tSize: 38,
    tColor: '#0fa966',
    tFont: 'Vazirmatn',
    tBold: true,
    align: 'center',
    cSize: 38,
    cColor: '#e6aa28',
    cFont: 'JetBrains Mono'
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeSong(song, {
    repairSong,
    ensureSongParsed,
    styleDefaults = DEFAULT_STYLES
  } = {}) {
    if (!song || typeof song !== 'object') return song;

    const repaired = typeof repairSong === 'function' ? repairSong(song) : song;
    const normalized = repaired && typeof repaired === 'object' ? repaired : song;

    ensureSongParsed?.(normalized);
    if (normalized.midiScore && globalScope.MidiScoreModel?.normalize) {
      try {
        normalized.midiScore = globalScope.MidiScoreModel.serialize(
          globalScope.MidiScoreModel.normalize(normalized.midiScore)
        );
      } catch (error) {
        // Keep legacy/project loading resilient if a partial MIDI snapshot is
        // encountered; the original field remains available for diagnostics.
        globalScope.console?.warn?.('[MIDI Score] Hydration skipped:', error);
      }
    }
    if (normalized.musicXmlScore && globalScope.MusicXmlScoreModel?.normalize) {
      try {
        normalized.musicXmlScore = globalScope.MusicXmlScoreModel.serialize(
          globalScope.MusicXmlScoreModel.normalize(normalized.musicXmlScore)
        );
      } catch (error) {
        globalScope.console?.warn?.('[MusicXML Score] Hydration skipped:', error);
      }
    }
    if (!Array.isArray(normalized.scorePartMappings)) normalized.scorePartMappings = [];
    if (!normalized.liveScoreSettings || typeof normalized.liveScoreSettings !== 'object') {
      normalized.liveScoreSettings = {
        enabled: Boolean(normalized.musicXmlScore),
        readOnly: true,
        countInEnabled: true,
        countInMeasures: 0,
        mapping: [],
        ipAssignments: {},
        transpositionSettings: {},
        chordLineVisibility: {},
        playheadMode: 'line'
      };
    } else {
      normalized.liveScoreSettings = {
        ...normalized.liveScoreSettings,
        readOnly: true,
        enabled: normalized.liveScoreSettings.enabled !== false,
        countInEnabled: normalized.liveScoreSettings.countInEnabled !== false,
        countInMeasures: Math.max(0, Number(normalized.liveScoreSettings.countInMeasures) || 0),
        mapping: Array.isArray(normalized.liveScoreSettings.mapping)
          ? normalized.liveScoreSettings.mapping
          : normalized.scorePartMappings,
        ipAssignments: normalized.liveScoreSettings.ipAssignments &&
          typeof normalized.liveScoreSettings.ipAssignments === 'object'
          ? normalized.liveScoreSettings.ipAssignments : {},
        transpositionSettings: normalized.liveScoreSettings.transpositionSettings &&
          typeof normalized.liveScoreSettings.transpositionSettings === 'object'
          ? normalized.liveScoreSettings.transpositionSettings : {},
        chordLineVisibility: normalized.liveScoreSettings.chordLineVisibility &&
          typeof normalized.liveScoreSettings.chordLineVisibility === 'object'
          ? normalized.liveScoreSettings.chordLineVisibility : {},
        playheadMode: normalized.liveScoreSettings.playheadMode === 'measure'
          ? 'measure'
          : 'line'
      };
    }
    if (!normalized.styles) normalized.styles = {};
    if (!normalized.lineColors) normalized.lineColors = [];
    if (!normalized.chordVersions) normalized.chordVersions = [];
    if (normalized.activeChordVersion === undefined) {
      normalized.activeChordVersion = 0;
    }

    Object.keys(styleDefaults || {}).forEach(key => {
      if (normalized.styles[key] === undefined) {
        normalized.styles[key] = styleDefaults[key];
      }
    });

    return normalized;
  }

  function restoreEditorLock(song, {
    documentRef = globalScope.document
  } = {}) {
    if (!song?.editorLocked) return;

    const editor = documentRef?.getElementById?.('editor');
    if (editor) editor.contentEditable = 'false';

    const lockButton = documentRef?.getElementById?.('edEditorLockBtn');
    if (lockButton) {
      lockButton.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" ' +
        'rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    }
  }

  function migrateSectionClips(daw) {
    if (!daw) return [];
    if (!Array.isArray(daw.clips)) daw.clips = [];
    if (!Array.isArray(daw.sections)) daw.sections = [];

    const oldSections = daw.clips.filter(clip => clip?.type === 'section');
    if (oldSections.length === 0) return [];

    oldSections.forEach(clip => {
      daw.sections.push({
        id: clip.id,
        trackId: clip.trackId,
        label: clip.name,
        start: clip.start,
        duration: clip.duration,
        color: clip.color
      });
    });
    daw.clips = daw.clips.filter(clip => clip?.type !== 'section');
    return oldSections;
  }

  function restoreDawState(song, {
    daw,
    cloneTracks = false,
    cloneClips = false,
    cloneSections = true,
    sectionsFallbackEmpty = false,
    updateNextIdFromClips
  } = {}) {
    if (!daw) return {
      migratedSections: [],
      loopState: null,
      arrangerMarkers: { enabled: false, start: 0, end: 0 },
      tempoMap: null
    };

    // Tempo changes belong to the loaded song. Clear the previous song's
    // runtime map before restoring the next song's map.
    daw.tempoMap = song?.tempoMap ? clone(song.tempoMap) : null;

    if (song?._dawTracks) {
      daw.tracks = cloneTracks ? clone(song._dawTracks) : song._dawTracks;
    }
    if (song?._dawClips) {
      daw.clips = cloneClips ? clone(song._dawClips) : song._dawClips;
    }
    if (song?._dawSections) {
      daw.sections = cloneSections ? clone(song._dawSections) : song._dawSections;
    } else if (sectionsFallbackEmpty) {
      daw.sections = [];
    }

    updateNextIdFromClips?.();
    const migratedSections = migrateSectionClips(daw);

    let loopState = null;
    if (song?._dawLoop) {
      loopState = {
        loopEnabled: !!song._dawLoop.loopEnabled,
        loopA: song._dawLoop.loopA || 0,
        loopB: song._dawLoop.loopB || 10
      };
      daw.loopEnabled = loopState.loopEnabled;
      daw.loopA = loopState.loopA;
      daw.loopB = loopState.loopB;
    }

    const arrangerMarkers = globalScope.ArrangerMarkerService?.fromSong?.(song) || {
      enabled: song?._arrangerMarkers?.enabled === true,
      start: Math.max(0, Number(song?._arrangerMarkers?.start) || 0),
      end: Math.max(0, Number(song?._arrangerMarkers?.end) || 0)
    };
    daw.arrangerMarkers = arrangerMarkers;

    return {
      migratedSections,
      loopState,
      arrangerMarkers,
      tempoMap: daw.tempoMap
    };
  }

  function initializeAudioTracks(daw, {
    ensureAudioCtx,
    updateTrackMix
  } = {}) {
    if (!daw || typeof ensureAudioCtx !== 'function') return;

    ensureAudioCtx();
    daw.tracks?.forEach(track => {
      if (track?.type !== 'audio' || !daw.audioCtx) return;
      track._pannerNode = daw.audioCtx.createStereoPanner();
      track._gainNode = daw.audioCtx.createGain();
      track._pannerNode.connect(track._gainNode);
      track._gainNode.connect(daw.masterGain);
      updateTrackMix?.(track.id);
    });
  }

  function hydrateSong(song, options = {}) {
    const normalized = normalizeSong(song, options);
    restoreEditorLock(normalized, options);
    const dawState = restoreDawState(normalized, options);

    if (options.initializeAudioTracks) {
      initializeAudioTracks(options.daw, options);
    }

    return { song: normalized, ...dawState };
  }

  const service = Object.freeze({
    DEFAULT_STYLES,
    normalizeSong,
    restoreEditorLock,
    migrateSectionClips,
    restoreDawState,
    initializeAudioTracks,
    hydrateSong
  });

  globalScope.EditorHydrationService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
