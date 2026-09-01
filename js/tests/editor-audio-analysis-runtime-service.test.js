const assert = require('node:assert/strict');
const serviceFactory = require(
  '../editor/EditorAudioAnalysisRuntimeService.js'
);

function buildWorld() {
  const elements = {
    edTempo: { value: '120' },
    edKey: { value: 'C' },
    edKeyMode: { value: 'maj' },
    aiTempoBtn: { disabled: false },
    aiKeyBtn: { disabled: false },
    aiChordBtn: { disabled: false },
    aiAnalyzeAllBtn: { disabled: false },
    aiAnalysisStatus: { style: {}, textContent: '', display: 'none' }
  };

  const fakeBuffer = { sampleRate: 44100, duration: 16 };
  const daw = {
    tracks: [{ id: 't0', type: 'chord' }, { id: 't1', type: 'audio' }],
    clips: [
      {
        id: 'clip_a',
        type: 'audio',
        trackId: 't1',
        bufferKey: 'bk_a',
        duration: 16
      }
    ],
    bufferCache: new Map([['bk_a', fakeBuffer]]),
    selectedIds: new Set(['clip_a'])
  };

  const song = {
    key: 'C',
    keyMode: 'maj',
    tempo: 120,
    transpose: 0,
    lyrics: 'satr aval\nsatr dovom\nsatr sevom',
    syncTimes: [0, 5, 10],
    chords: [],
    baseChordNames: []
  };

  const calls = { saveSong: 0, saveState: 0, commit: 0, timing: 0, toolbar: 0, renderEditor: 0, renderChords: 0, renderTracks: 0, renderClips: 0, renderAll: 0, fits: 0 };
  const messages = [];

  const songState = {
    currentSong: () => song,
    getSyncTimes: target => target.syncTimes,
    getLyrics: target => target.lyrics,
    setTempo: value => { song.tempo = value; return true; },
    setKey: (key, mode) => { song.key = key; song.keyMode = mode; return true; }
  };

  const legacy = {
    detectTempoCalls: 0,
    detectKeyCalls: 0,
    detectTempo() { this.detectTempoCalls += 1; },
    detectKey() { this.detectKeyCalls += 1; }
  };

  const analysisResult = {
    ok: true,
    tempo: { ok: true, bpm: 96.4, period: 0.625, beatOffset: 0.1, confidence: 0.8 },
    key: { ok: true, key: 'D', keySemitone: 2, mode: 'min', score: 0.9, confidence: 0.85 },
    chords: {
      ok: true,
      count: 3,
      segmentDuration: 1,
      chords: [
        { start: 0.5, end: 2.5, root: 2, quality: 'min', name: 'Dm', confidence: 0.8 },
        { start: 2.5, end: 5.5, root: 7, quality: 'maj', name: 'G', confidence: 0.75 },
        { start: 6.0, end: 9.0, root: 9, quality: 'min', name: 'Am', confidence: 0.7 }
      ]
    }
  };

  let analysisCalls = 0;

  const service = serviceFactory.create({
    engine: {
      analyzeAudio: async () => {
        analysisCalls += 1;
        return analysisResult;
      }
    },
    getDAW: () => daw,
    getSong: () => song,
    getSongState: () => songState,
    getElement: id => elements[id] || null,
    legacyRuntime: legacy,
    restoreAudio: async () => ({ loaded: 0 }),
    transposeChordName: (name, semitones) => (semitones ? `${name}+${semitones}` : name),
    transposeKeyName: (key, semitones) => (semitones ? `${key}+${semitones}` : key),
    saveSong: () => { calls.saveSong += 1; },
    saveState: () => { calls.saveState += 1; },
    commit: () => { calls.commit += 1; },
    handleTimingChange: () => { calls.timing += 1; },
    syncToolbar: () => { calls.toolbar += 1; },
    renderEditor: () => { calls.renderEditor += 1; },
    renderChords: () => { calls.renderChords += 1; },
    renderTracks: () => { calls.renderTracks += 1; },
    renderClips: () => { calls.renderClips += 1; },
    renderAll: () => { calls.renderAll += 1; },
    ensureTimelineFits: () => { calls.fits += 1; },
    uid: prefix => `${prefix}_test${Math.random().toString(36).slice(2, 6)}`,
    roundMs: value => value,
    toast: message => messages.push(message)
  });

  return {
    service, elements, daw, song, calls, messages, legacy,
    analysisCalls: () => analysisCalls
  };
}

/* ---------------- tempo ---------------- */

(async () => {
  {
    const world = buildWorld();
    await world.service.detectTempo();
    assert.equal(world.elements.edTempo.value, 96, 'edTempo updated');
    assert.equal(world.song.tempo, 96, 'song tempo updated');
    assert.ok(world.calls.saveSong >= 1, 'song saved');
    assert.ok(world.calls.timing >= 1, 'timing refreshed');
    assert.ok(world.messages.at(-1).includes('96'), 'tempo toast mentions bpm');
    assert.equal(world.elements.aiTempoBtn.disabled, false, 'buttons re-enabled');
    assert.equal(world.elements.aiAnalysisStatus.style.display, 'none', 'status hidden');
  }

  /* ---------------- key ---------------- */

  {
    const world = buildWorld();
    await world.service.detectKey();
    assert.equal(world.song.key, 'D', 'key set');
    assert.equal(world.song.keyMode, 'min', 'mode set');
    assert.equal(world.song.originalKey, 'D', 'original key recorded');
    assert.equal(world.elements.edKey.value, 'D', 'edKey updated');
    assert.equal(world.elements.edKeyMode.value, 'min', 'edKeyMode updated');
    assert.ok(world.messages.at(-1).includes('D'), 'key toast mentions key');
  }

  /* ---------------- chords ---------------- */

  {
    const world = buildWorld();
    await world.service.detectChords();

    const chordClips = world.daw.clips.filter(
      clip => clip.type === 'chord' && clip._detected
    );
    assert.equal(chordClips.length, 3, 'three detected chord clips on timeline');
    assert.ok(
      chordClips.every(clip => clip.trackId === 't0'),
      'chord clips live on the chord track'
    );
    assert.equal(chordClips[0].name, 'Dm', 'first clip name');
    assert.equal(chordClips[1].start, 2.5, 'second clip start');
    assert.ok(chordClips[0].duration >= 0.4, 'clip duration sane');
    assert.ok(world.calls.fits >= 1, 'timeline fitted');

    // Lyrics anchoring via syncTimes [0, 5, 10]:
    //  Dm(0.5s) -> line 0, G(2.5s) -> line 0, Am(6.0s) -> line 1
    assert.equal(world.song.chords.length, 3, 'lyrics chords inserted');
    assert.equal(world.song.chords[0].lineIndex, 0, 'Dm on line 0');
    assert.equal(world.song.chords[0].name, 'Dm', 'Dm name on lyrics');
    assert.equal(world.song.chords[1].lineIndex, 0, 'G on line 0');
    assert.ok(world.song.chords[1].charIndex > 0, 'G placed inside line');
    assert.equal(world.song.chords[2].lineIndex, 1, 'Am on line 1');
    assert.deepEqual(
      world.song.baseChordNames,
      ['Dm', 'G', 'Am'],
      'base names aligned'
    );
    assert.ok(world.calls.commit >= 1, 'history committed');
    assert.ok(world.messages.at(-1).includes('آکورد'), 'chord toast');

    // Re-run must replace previous detected artifacts (idempotency).
    await world.service.detectChords();
    const afterClips = world.daw.clips.filter(
      clip => clip.type === 'chord' && clip._detected
    );
    assert.equal(afterClips.length, 3, 're-run replaces detected clips');
    assert.equal(world.song.chords.length, 3, 're-run replaces lyric chords');
  }

  /* ---------------- transposed song keeps base names ---------------- */

  {
    const world = buildWorld();
    world.song.transpose = 2;
    await world.service.detectChords();
    assert.equal(world.song.chords[0].name, 'Dm+2', 'display name transposed');
    assert.equal(world.song.baseChordNames[0], 'Dm', 'base name untransposed');
    const clip = world.daw.clips.find(c => c.type === 'chord' && c._detected);
    assert.equal(clip.name, 'Dm+2', 'timeline name transposed');
  }

  /* ---------------- key with transpose ---------------- */

  {
    const world = buildWorld();
    world.song.transpose = 2;
    await world.service.detectKey();
    assert.equal(world.song.key, 'D+2', 'displayed key transposed');
    assert.equal(world.song.originalKey, 'D', 'original key kept');
  }

  /* ---------------- no audio -> legacy fallback ---------------- */

  {
    const world = buildWorld();
    world.daw.clips = [];
    world.daw.bufferCache = new Map();
    await world.service.detectTempo();
    assert.equal(world.legacy.detectTempoCalls, 1, 'legacy tempo fallback');
    await world.service.detectKey();
    assert.equal(world.legacy.detectKeyCalls, 1, 'legacy key fallback');
    await world.service.detectChords();
    assert.ok(
      world.messages.some(message => message.includes('فایل صوتی')),
      'chords without audio warns user'
    );
  }

  /* ---------------- analyzeAll applies everything ---------------- */

  {
    const world = buildWorld();
    await world.service.analyzeAll();
    assert.equal(world.song.tempo, 96, 'tempo applied');
    assert.equal(world.song.key, 'D', 'key applied');
    assert.equal(
      world.daw.clips.filter(clip => clip.type === 'chord' && clip._detected).length,
      3,
      'chord clips applied'
    );
    assert.ok(world.messages.at(-1).includes('تحلیل کامل'), 'summary toast');
  }

  console.log('editor-audio-analysis-runtime-service.test.js — all assertions passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
