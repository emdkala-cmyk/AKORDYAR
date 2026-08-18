/**
 * ScoreController
 *
 * The existing command name is kept for compatibility, but this controller
 * now presents MusicXML as the authoritative read-only engraving source and
 * keeps MIDI as the timing source/fallback renderer.
 */
(function attachMidiScoreController(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getSong = () => null,
    setSong = () => {},
    saveSong = () => {},
    onSongChanged = () => {},
    toast = () => {},
    importService = globalScope.MidiScoreImportService,
    model = globalScope.MidiScoreModel,
    renderer = globalScope.MidiScoreRenderer,
    musicXmlImportService = globalScope.MusicXmlScoreImportService,
    musicXmlModel = globalScope.MusicXmlScoreModel,
    musicXmlRenderer = globalScope.MusicXmlScoreRenderer
  } = {}) {
    if (!importService?.create) {
      throw new TypeError('ScoreController requires MidiScoreImportService');
    }
    if (!model?.normalize || !renderer?.renderSvg) {
      throw new TypeError('ScoreController requires MidiScoreModel/MidiScoreRenderer');
    }

    const midiService = importService.create();
    const xmlService = musicXmlImportService?.create?.() || null;
    let selectedPartId = null;
    let selectedMode = 'musicxml';
    let activeSeconds = 0;
    let bound = false;

    function element(id) {
      return documentRef?.getElementById?.(id) || null;
    }

    function midiScore() {
      const song = getSong();
      return song?.midiScore ? model.normalize(song.midiScore) : null;
    }

    function musicXmlScore() {
      const song = getSong();
      return song?.musicXmlScore && musicXmlModel?.normalize
        ? musicXmlModel.normalize(song.musicXmlScore)
        : null;
    }

    function score() {
      return selectedMode === 'musicxml' ? musicXmlScore() : midiScore();
    }

    function scoreClock() {
      return globalScope.ScorePlayheadService?.create?.({
        midiScore: midiScore(),
        musicXmlScore: musicXmlScore()
      }) || null;
    }

    function close() {
      const modal = element('midiScoreModal');
      if (!modal) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }

    function chooseMode(mode) {
      if (mode === 'musicxml' && !musicXmlScore()) return;
      if (mode === 'midi' && !midiScore()) return;
      selectedMode = mode;
      selectedPartId = null;
      render();
    }

    function choosePart(partId) {
      selectedPartId = partId;
      render();
    }

    function renderParts(currentScore) {
      const partsElement = element('midiScoreParts');
      if (!partsElement) return;
      partsElement.replaceChildren();

      const modes = [];
      if (musicXmlScore()) modes.push({ id: 'musicxml', label: 'MusicXML' });
      if (midiScore()) modes.push({ id: 'midi', label: 'MIDI' });
      modes.forEach(mode => {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = `midi-score-part-btn midi-score-mode-btn${selectedMode === mode.id ? ' active' : ''}`;
        button.textContent = mode.label;
        button.addEventListener('click', () => chooseMode(mode.id));
        partsElement.appendChild(button);
      });

      (currentScore?.parts || []).forEach(part => {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = `midi-score-part-btn${part.id === selectedPartId ? ' active' : ''}`;
        button.dataset.partId = part.id;
        button.textContent = `${part.name || part.id}${part.roleLabel ? ` · ${part.roleLabel}` : ''}`;
        button.addEventListener('click', () => choosePart(part.id));
        partsElement.appendChild(button);
      });
    }

    function chordOverlay() {
      const song = getSong();
      const midi = midiScore();
      const conversions = midi?.conversions;
      return (song?.rawChords || song?.chords || [])
        .map(chord => {
          const seconds = Number(chord?.time ?? chord?.start ?? chord?.startTime);
          const text = chord?.name || chord?.text || chord?.chord || '';
          if (!text || !Number.isFinite(seconds)) return null;
          return {
            tick: conversions?.secondsToTick ? conversions.secondsToTick(seconds) : seconds,
            text
          };
        })
        .filter(Boolean);
    }

    function ensureSelectedPart(currentScore) {
      if (!currentScore) return;
      const exists = currentScore.parts?.some(part => String(part.id) === String(selectedPartId));
      if (!exists) selectedPartId = currentScore.activePartId || currentScore.parts?.[0]?.id || null;
    }

    function render() {
      const modal = element('midiScoreModal');
      const currentScore = score();
      if (!modal || !currentScore) return;
      ensureSelectedPart(currentScore);

      const normalized = selectedMode === 'musicxml'
        ? musicXmlModel.normalize(currentScore)
        : model.setActivePart(currentScore, selectedPartId);
      const song = getSong();
      if (selectedMode === 'musicxml' && song?.musicXmlScore) {
        song.musicXmlScore = musicXmlModel.serialize(normalized);
      } else if (song?.midiScore) {
        song.midiScore = model.serialize(normalized);
      }

      renderParts(normalized);
      const meta = element('midiScoreMeta');
      if (meta) {
        if (selectedMode === 'musicxml') {
          const summary = musicXmlModel.getSummary(normalized);
          const meter = normalized.meterMap?.events?.[0];
          const key = musicXmlRenderer?.keyLabel?.(normalized.keyMap?.events?.[0]) || 'C';
          meta.textContent =
            `${summary.title || summary.fileName || 'MusicXML'} · ` +
            `${summary.partCount} پارت · ${summary.noteCount} نت · ${summary.measureCount} میزان` +
            (meter ? ` · ${meter.numerator}/${meter.denominator}` : '') +
            ` · گام ${key}`;
        } else {
          const summary = model.getSummary(normalized);
          const meter = normalized.meterMap?.events?.[0];
          const bpm = normalized.tempoMap?.events?.[0]?.bpm;
          const key = renderer.getKeySignatureLabel?.(normalized) || 'C';
          meta.textContent =
            `${summary.fileName || 'MIDI'} · ${summary.trackCount} ترک · ` +
            `${summary.noteCount} نت · ${Number(summary.durationSeconds || 0).toFixed(2)} ثانیه` +
            (meter ? ` · ${meter.numerator}/${meter.denominator}` : '') +
            (bpm ? ` · ♩=${Math.round(bpm)}` : '') +
            ` · گام ${key}`;
        }
      }

      const viewer = element('midiScoreViewer');
      if (viewer) {
        const activeRenderer = selectedMode === 'musicxml' ? musicXmlRenderer : renderer;
        const part = selectedMode === 'musicxml'
          ? musicXmlModel.getPart(normalized, selectedPartId)
          : model.getPart(normalized, selectedPartId);
        viewer.innerHTML = activeRenderer.renderSvg(normalized, selectedPartId, {
          activeTime: activeSeconds,
          activeTick: scoreClock()?.secondsToTick?.(activeSeconds),
          midiScore: midiScore(),
          chords: selectedMode === 'musicxml' ? chordOverlay() : null,
          ariaLabel: `${part?.name || 'Score'} score`
        });
        const svg = viewer.querySelector('svg');
        if (svg) viewer.style.setProperty('--midi-score-width', `${svg.getAttribute('width') || 0}px`);
      }
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }

    async function importMidiFile(file) {
      if (!file) return null;
      try {
        toast('در حال خواندن فایل MIDI…');
        const parsed = await midiService.parseFile(file);
        const song = getSong();
        if (!song) throw new Error('ترانه‌ای برای افزودن MIDI وجود ندارد');
        midiService.applyToSong(song, parsed);
        setSong(song);
        selectedMode = musicXmlScore() ? 'musicxml' : 'midi';
        selectedPartId = parsed.activePartId || parsed.parts?.[0]?.id || null;
        onSongChanged(song, parsed);
        saveSong();
        render();
        toast(`MIDI وارد شد: ${parsed.parts.length} پارت، ${model.getSummary(parsed).noteCount} نت`);
        return parsed;
      } catch (error) {
        console.error('[MIDI Score] Import failed:', error);
        toast(`خطا در ورود MIDI: ${error?.message || 'فایل نامعتبر است'}`);
        return null;
      }
    }

    async function importMusicXmlFile(file) {
      if (!file || !xmlService) return null;
      try {
        toast('در حال خواندن فایل MusicXML…');
        const parsed = await xmlService.parseFile(file);
        const song = getSong();
        if (!song) throw new Error('ترانه‌ای برای افزودن MusicXML وجود ندارد');
        xmlService.applyToSong(song, parsed, {
          midiScore: song.midiScore,
          mappings: song.scorePartMappings
        });
        if (song.midiScore && musicXmlModel?.attachMidiTiming) {
          song.musicXmlScore = musicXmlModel.serialize(
            musicXmlModel.attachMidiTiming(
              song.musicXmlScore,
              model.normalize(song.midiScore),
              song.scorePartMappings
            )
          );
        }
        setSong(song);
        selectedMode = 'musicxml';
        selectedPartId = parsed.activePartId || parsed.parts?.[0]?.id || null;
        onSongChanged(song, parsed);
        saveSong();
        render();
        toast(`MusicXML وارد شد: ${parsed.parts.length} پارت`);
        return parsed;
      } catch (error) {
        console.error('[MusicXML Score] Import failed:', error);
        toast(`خطا در ورود MusicXML: ${error?.message || 'فایل نامعتبر است'}`);
        return null;
      }
    }

    function bindInput() {
      if (bound) return;
      bound = true;
      const midiInput = element('midi-file-input');
      if (midiInput) {
        midiInput.addEventListener('change', async event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) await importMidiFile(file);
        });
      }
      const xmlInput = element('musicxml-file-input');
      if (xmlInput && xmlService) {
        xmlInput.addEventListener('change', async event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) await importMusicXmlFile(file);
        });
      }
    }

    function openImporter() {
      bindInput();
      const input = element('midi-file-input');
      if (input) input.click();
      else toast('ورودی فایل MIDI پیدا نشد');
    }

    function openMusicXmlImporter() {
      bindInput();
      const input = element('musicxml-file-input');
      if (input) input.click();
      else toast('ورودی فایل MusicXML پیدا نشد');
    }

    function open() {
      bindInput();
      if (musicXmlScore()) {
        selectedMode = 'musicxml';
        render();
      } else if (midiScore()) {
        selectedMode = 'midi';
        render();
      } else {
        openMusicXmlImporter();
      }
    }

    function updatePlayhead(seconds) {
      activeSeconds = Math.max(0, Number(seconds) || 0);
      const viewer = element('midiScoreViewer');
      const currentScore = score();
      if (!viewer || !currentScore || !selectedPartId) return;
      const playhead = viewer.querySelector('[data-score-playhead]');
      if (playhead) {
        const activeRenderer = selectedMode === 'musicxml' ? musicXmlRenderer : renderer;
        const x = activeRenderer.getPlayheadX(currentScore, selectedPartId, activeSeconds, {
          midiScore: midiScore(),
          activeTick: scoreClock()?.secondsToTick?.(activeSeconds)
        });
        playhead.setAttribute('x1', String(x));
        playhead.setAttribute('x2', String(x));
      } else {
        render();
      }
    }

    function clearScore() {
      const song = getSong();
      if (!song?.midiScore) return false;
      midiService.removeFromSong(song);
      setSong(song);
      onSongChanged(song, null);
      saveSong();
      close();
      toast('اطلاعات MIDI حذف شد');
      return true;
    }

    function clearMusicXmlScore() {
      const song = getSong();
      if (!song?.musicXmlScore || !xmlService) return false;
      xmlService.removeFromSong(song);
      setSong(song);
      onSongChanged(song, null);
      saveSong();
      close();
      toast('اطلاعات MusicXML حذف شد');
      return true;
    }

    bindInput();
    return Object.freeze({
      open,
      openImporter,
      openMusicXmlImporter,
      close,
      render,
      importFile: importMidiFile,
      importMusicXmlFile,
      updatePlayhead,
      clearScore,
      clearMusicXmlScore,
      getScore: score,
      getMidiScore: midiScore,
      getMusicXmlScore: musicXmlScore,
      chooseMode
    });
  }

  const api = Object.freeze({ create });
  globalScope.MidiScoreController = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
