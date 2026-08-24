/**
 * DAWRuntimeState
 *
 * Factory for the DAW runtime shape. It does not own audio or transport
 * behavior; those remain injected into the existing core orchestration.
 */
(function attachDAWRuntimeState(globalScope) {
  function create(overrides = {}) {
    return Object.assign({
      tracks: [],
      clips: [],
      sections: [],
      selectedIds: new Set(),
      selectedSectionIds: new Set(),
      clipboard: [],
      playhead: 0,
      isPlaying: false,
      isScrubbing: false,
      timelineDuration: 120,
      pxPerSecond: 70,
      laneHeight: 64,
      loadTrackId: null,
      selectedTrackId: null,
      rafId: null,
      playOriginPerf: 0,
      playOriginTime: 0,
      playOriginAudio: null,
      audioCtx: null,
      masterGain: null,
      voices: new Map(),
      nextId: 100,
      bufferCache: new Map(),
      waveCache: new Map(),
      drag: null,
      marquee: null,
      editingChordClipId: null,
      selectedPlayhead: false,
      loopEnabled: false,
      loopA: 0,
      loopB: 10,
      // Independent from the editor loop: arranger start/transition markers.
      arrangerMarkers: { enabled: false, start: 0, end: 0 },
      pool: {},
      projectRoot: null,
      isRecording: false,
      recRafId: null,
      recAnalyser: null,
      recStream: null,
      recMediaRecorder: null,
      recStartTime: 0,
      recEndTime: 0,
      recPeaks: [],
      recLaneId: null
    }, overrides && typeof overrides === 'object' ? overrides : {});
  }

  globalScope.DAWRuntimeState = Object.freeze({ create });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.DAWRuntimeState;
  }
})(typeof window !== 'undefined' ? window : globalThis);
