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
    getDAW = () =>
      globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    importService = globalScope.MidiScoreImportService,
    model = globalScope.MidiScoreModel,
    renderer = globalScope.MidiScoreRenderer,
    musicXmlImportService = globalScope.MusicXmlScoreImportService,
    musicXmlModel = globalScope.MusicXmlScoreModel,
    musicXmlRenderer = globalScope.ScoreRenderer || globalScope.MusicXmlScoreRenderer,
    scoreRenderer = globalScope.ScoreRenderer || musicXmlRenderer,
    transposeService = globalScope.ScoreTransposeService,
    scorePlayheadService = globalScope.EditorScorePlayheadService
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
    let scoreClockService = null;
    let lastPlayheadSystem = -1;
    let lastAutoScrollAt = 0;
    let renderToken = 0;

    function element(id) {
      return documentRef?.getElementById?.(id) || null;
    }

    function refreshQrParts() {
      globalScope.AkordDeviceManager?.refresh?.();
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

    function projectTempo() {
      const song = getSong();
      const daw = getDAW();
      const value = Number(song?.tempo) || Number(daw?.tempo) || 120;
      return value > 0 ? value : 120;
    }

    function playheadMode() {
      return globalScope.ScoreRenderer?.normalizePlayheadMode?.(
        getSong()?.liveScoreSettings?.playheadMode
      ) || (getSong()?.liveScoreSettings?.playheadMode === 'measure' ? 'measure' : 'line');
    }

    function setPlayheadMode(value) {
      const song = getSong();
      if (!song) return false;
      const nextMode = String(value || '').toLowerCase() === 'measure'
        ? 'measure'
        : 'line';
      song.liveScoreSettings = {
        ...(song.liveScoreSettings || {}),
        playheadMode: nextMode
      };
      setSong(song);
      saveSong();
      onSongChanged(song, musicXmlScore() || midiScore());
      render();
      return true;
    }

    function syncScoresToProjectKey() {
      const song = getSong();
      if (!song || !transposeService) return false;
      const targetKey = song.key || song.originalKey || 'C';
      const targetMode = song.keyMode || song.originalKeyMode || 'major';
      let changed = false;
      if (song.midiScore) {
        song.midiScore = model.serialize(
          transposeService.transposeMidiScore(song.midiScore, targetKey, targetMode)
        );
        changed = true;
      }
      if (song.musicXmlScore && musicXmlModel?.serialize) {
        song.musicXmlScore = musicXmlModel.serialize(
          transposeService.transposeMusicXmlScore(song.musicXmlScore, targetKey, targetMode)
        );
        changed = true;
      }
      if (!changed) {
        toast('ابتدا یک فایل MIDI یا MusicXML وارد کنید');
        return false;
      }
      song.liveScoreSettings = {
        ...(song.liveScoreSettings || {}),
        scoreKeySync: {
          key: targetKey,
          mode: targetMode,
          updatedAt: new Date().toISOString()
        }
      };
      setSong(song);
      saveSong();
      onSongChanged(song, musicXmlScore() || midiScore());
      refreshQrParts();
      render();
      toast(`نت‌های سازها با گام پروژه (${targetKey}${String(targetMode).startsWith('min') ? 'm' : ''}) همگام شد`);
      return true;
    }

    function scoreClock() {
      return globalScope.ScorePlayheadService?.create?.({
        midiScore: midiScore(),
        musicXmlScore: musicXmlScore(),
        projectTempo: projectTempo()
      }) || null;
    }

    function editorScoreClock() {
      if (!scoreClockService) {
        scoreClockService = scorePlayheadService?.create?.({
          midiScore: midiScore(),
          musicXmlScore: musicXmlScore(),
          projectTempo: projectTempo(),
          renderer: scoreRenderer
        }) || null;
      } else {
        scoreClockService.setScores?.({
          midiScore: midiScore(),
          musicXmlScore: musicXmlScore(),
          projectTempo: projectTempo()
        });
      }
      return scoreClockService;
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

    function chordVisibility(partId, currentScore = musicXmlScore()) {
      const song = getSong();
      const settings = song?.liveScoreSettings?.chordLineVisibility;
      if (settings && Object.prototype.hasOwnProperty.call(settings, partId)) {
        return settings[partId] !== false;
      }
      const part = musicXmlModel?.getPart?.(currentScore, partId);
      return part?.showChords === true;
    }

    function setChordVisibility(partId, visible) {
      const song = getSong();
      const currentScore = musicXmlScore();
      if (!song || !currentScore || !partId) return false;
      const next = musicXmlModel?.assignPart
        ? musicXmlModel.assignPart(currentScore, partId, { showChords: visible })
        : currentScore;
      song.musicXmlScore = musicXmlModel.serialize(next);
      song.liveScoreSettings = {
        ...(song.liveScoreSettings || {}),
        chordLineVisibility: {
          ...(song.liveScoreSettings?.chordLineVisibility || {}),
          [partId]: Boolean(visible)
        }
      };
      setSong(song);
      saveSong();
      onSongChanged(song, next);
      refreshQrParts();
      render();
      return true;
    }

    function renderParts(currentScore) {
      const partsElement = element('midiScoreParts');
      if (!partsElement) return;
      partsElement.replaceChildren();

      const syncButton = documentRef.createElement('button');
      syncButton.type = 'button';
      syncButton.className = 'midi-score-part-btn midi-score-sync-btn';
      syncButton.textContent = '🎼 همگام‌سازی با گام پروژه';
      syncButton.title = 'ترنسپوز نت‌های همه سازها و بازسازی علامت گام در ابتدای میزان‌ها';
      syncButton.addEventListener('click', syncScoresToProjectKey);
      partsElement.appendChild(syncButton);

      if (selectedMode === 'musicxml' && selectedPartId) {
        const chordToggle = documentRef.createElement('button');
        chordToggle.type = 'button';
        chordToggle.className = 'midi-score-part-btn midi-score-chord-toggle';
        const visible = chordVisibility(selectedPartId, currentScore);
        chordToggle.textContent = `آکوردها: ${visible ? 'روشن' : 'خاموش'}`;
        chordToggle.setAttribute('aria-pressed', String(visible));
        chordToggle.title = 'نمایش یا مخفی‌کردن آکوردها روی میزان‌ها';
        chordToggle.addEventListener('click', () => {
          setChordVisibility(selectedPartId, !chordVisibility(selectedPartId, musicXmlScore()));
        });
        partsElement.appendChild(chordToggle);
      }

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

      const playheadSelect = documentRef.createElement('select');
      playheadSelect.className = 'midi-score-playhead-mode-select';
      playheadSelect.setAttribute('aria-label', 'حالت پلی‌هد');
      [
        { value: 'line', label: 'پلی‌هد: خط' },
        { value: 'measure', label: 'پلی‌هد: هایلایت میزان' }
      ].forEach(optionData => {
        const option = documentRef.createElement('option');
        option.value = optionData.value;
        option.textContent = optionData.label;
        option.selected = optionData.value === playheadMode();
        playheadSelect.appendChild(option);
      });
      playheadSelect.addEventListener('change', () => {
        setPlayheadMode(playheadSelect.value);
      });
      partsElement.appendChild(playheadSelect);

      (currentScore?.parts || []).forEach(part => {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = `midi-score-part-btn${part.id === selectedPartId ? ' active' : ''}`;
        button.dataset.partId = part.id;
        button.textContent = `${part.name || part.id}${part.roleLabel ? ` · ${part.roleLabel}` : ''}`;
        button.addEventListener('click', () => choosePart(part.id));
        partsElement.appendChild(button);
        const qrButton = documentRef.createElement('button');
        qrButton.type = 'button';
        qrButton.className = 'midi-score-part-btn midi-score-qr-btn';
        qrButton.textContent = 'QR';
        qrButton.title = 'نمایش QR اختصاصی همین پارت';
        qrButton.setAttribute('aria-label', `QR ${part.name || part.id}`);
        qrButton.addEventListener('click', event => {
          event.stopPropagation();
          const deviceManager = globalScope.AkordDeviceManager;
          if (deviceManager?.selectPartQr?.(part.id, { toggleIfOpen: true })) {
            toast(`QR پارت «${part.name || part.id}» انتخاب شد`);
          } else {
            toast('پنل QR هنوز آماده نیست؛ ابتدا اشتراک‌گذاری را باز کنید');
          }
        });
        partsElement.appendChild(qrButton);
      });
    }

    function renderEmptyState() {
      const modal = element('midiScoreModal');
      const partsElement = element('midiScoreParts');
      const viewer = element('midiScoreViewer');
      const meta = element('midiScoreMeta');
      if (!modal || !viewer) return;

      partsElement?.replaceChildren();
      if (meta) {
        meta.textContent = 'ابتدا یک فایل چندپارتی MIDI یا MusicXML وارد کنید';
      }
      viewer.replaceChildren();
      const state = documentRef.createElement('div');
      state.className = 'midi-score-empty-state';
      const title = documentRef.createElement('strong');
      title.textContent = 'محیط نت‌خوان آماده است';
      const description = documentRef.createElement('p');
      description.textContent =
        'پس از ورود فایل، هر ساز به‌صورت یک تب جدا نمایش داده می‌شود؛ ' +
        'با انتخاب تب، نت همان ساز را می‌بینید.';
      const actions = documentRef.createElement('div');
      actions.className = 'midi-score-empty-actions';
      const midiButton = documentRef.createElement('button');
      midiButton.type = 'button';
      midiButton.className = 'midi-score-action';
      midiButton.textContent = '📥 ورود MIDI چندپارتی';
      midiButton.addEventListener('click', openImporter);
      const xmlButton = documentRef.createElement('button');
      xmlButton.type = 'button';
      xmlButton.className = 'midi-score-action';
      xmlButton.textContent = '📄 ورود MusicXML چندپارتی';
      xmlButton.addEventListener('click', openMusicXmlImporter);
      actions.append(midiButton, xmlButton);
      state.append(title, description, actions);
      viewer.appendChild(state);
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }

    function chordOverlay() {
      const song = getSong();
      const midi = midiScore();
      const secondsToTick = scoreClock()?.secondsToTick ||
        (seconds => seconds);
      const dawClips = getDAW()?.clips?.filter(clip =>
        clip &&
        clip.type === 'chord' &&
        String(clip.name || clip.label || clip.text || '').trim()
      ) || [];
      const storedClips = Array.isArray(song?.chordLineClips)
        ? song.chordLineClips.filter(clip =>
            String(clip?.name || clip?.label || clip?.text || '').trim()
          )
        : [];
      const source = dawClips.length
        ? dawClips
        : (storedClips.length ? storedClips : (song?.rawChords || song?.chords || []));
      return source
        .map(chord => {
          const seconds = Number(
            chord?.start ??
            chord?.time ??
            chord?.startTime ??
            chord?.seconds ??
            chord?.startSeconds
          );
          const text = String(
            chord?.name ||
            chord?.label ||
            chord?.text ||
            chord?.chord ||
            ''
          )
            .replace(/^\[|\]$/g, '')
            .trim();
          if (!text || !Number.isFinite(seconds)) return null;
          return {
            tick: secondsToTick(seconds),
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
      if (!modal) return;
      if (!currentScore) {
        renderEmptyState();
        return;
      }
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
        const part = selectedMode === 'musicxml'
          ? musicXmlModel.getPart(normalized, selectedPartId)
          : model.getPart(normalized, selectedPartId);
        if (selectedMode === 'musicxml') {
          const token = ++renderToken;
          viewer.classList.add('score-render-pending');
          viewer.replaceChildren();
          const root = documentRef.createElement('div');
          root.className = 'score-viewer-root';
          root.setAttribute('aria-label', `${part?.name || 'Score'} score`);
          viewer.appendChild(root);
          Promise.resolve(scoreRenderer.renderInto(root, normalized, selectedPartId, {
            zoom: 1,
            chords: chordOverlay(),
            showChords: chordVisibility(selectedPartId, normalized),
            playheadMode: playheadMode()
          })).then(instance => {
            if (token !== renderToken || !instance) return;
            viewer.classList.remove('score-render-pending');
            const position = scoreRenderer.getPlayheadPosition(normalized, selectedPartId, activeSeconds, {
              root,
              midiScore: midiScore(),
              activeTick: scoreClock()?.secondsToTick?.(activeSeconds)
            });
            scoreRenderer.updatePlayhead?.(root, {
              ...position,
              playheadMode: playheadMode()
            });
          }).catch(error => {
            if (token !== renderToken) return;
            viewer.classList.remove('score-render-pending');
            const message = documentRef.createElement('div');
            message.className = 'score-render-error';
            message.setAttribute('role', 'alert');
            message.textContent = `خطا در نمایش استاندارد MusicXML: ${error?.message || 'رندر OSMD ناموفق بود'}`;
            root.replaceChildren(message);
            console.error('[ScoreRenderer] OSMD render failed:', error);
          });
        } else {
          const activeRenderer = renderer;
          viewer.innerHTML = activeRenderer.renderSvg(normalized, selectedPartId, {
            activeTime: activeSeconds,
            activeTick: scoreClock()?.secondsToTick?.(activeSeconds),
            midiScore: midiScore(),
            chords: null,
            ariaLabel: `${part?.name || 'Score'} score`,
            playheadMode: playheadMode()
          });
          const svg = viewer.querySelector('svg');
          if (svg) viewer.style.setProperty('--midi-score-width', `${svg.getAttribute('width') || 0}px`);
        }
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
        refreshQrParts();
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
        refreshQrParts();
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
        renderEmptyState();
      }
    }

    function updatePlayhead(seconds) {
      activeSeconds = Math.max(0, Number(seconds) || 0);
      const viewer = element('midiScoreViewer');
      const currentScore = score();
      if (!viewer || !currentScore || !selectedPartId) return;
      const playhead = viewer.querySelector('[data-score-playhead]');
      const root = selectedMode === 'musicxml'
        ? viewer.querySelector('.score-viewer-root')
        : null;
      if (selectedMode === 'musicxml' && root && scoreRenderer?.getPlayheadPosition) {
        const clock = editorScoreClock();
        const position = clock?.positionAt
          ? clock.positionAt(activeSeconds, {
              score: currentScore,
              partId: selectedPartId,
              root,
              activeTick: clock.secondsToTick(activeSeconds),
              loop: {
                enabled: Boolean(getDAW()?.loopEnabled),
                start: getDAW()?.loopA,
                end: getDAW()?.loopB
              }
            })
          : scoreRenderer.getPlayheadPosition(currentScore, selectedPartId, activeSeconds, {
              root,
              midiScore: midiScore(),
              activeTick: clock?.secondsToTick?.(activeSeconds)
            });
        scoreRenderer.updatePlayhead?.(root, {
          ...position,
          playheadMode: playheadMode()
        });
        const now = performance.now();
        if (
          viewer &&
          position.systemChanged &&
          now - lastAutoScrollAt > 180
        ) {
          const target = editorScoreClock()?.viewportTarget?.(position, viewer);
          if (target) {
            lastAutoScrollAt = now;
            try {
              viewer.scrollTo({ left: target.left, top: target.top, behavior: 'smooth' });
            } catch (_) {
              viewer.scrollLeft = target.left;
              viewer.scrollTop = target.top;
            }
          }
        }
        lastPlayheadSystem = position.systemIndex;
      } else if (playhead || renderer.updatePlayhead) {
        const position = renderer.getPlayheadPosition
          ? renderer.getPlayheadPosition(currentScore, selectedPartId, activeSeconds, {
              midiScore: midiScore(),
              activeTick: scoreClock()?.secondsToTick?.(activeSeconds)
            })
          : {
              x: renderer.getPlayheadX(currentScore, selectedPartId, activeSeconds, {
                midiScore: midiScore(),
                activeTick: scoreClock()?.secondsToTick?.(activeSeconds)
              }),
              yTop: 0,
              yBottom: 0,
              systemIndex: 0
            };
        if (renderer.updatePlayhead) {
          renderer.updatePlayhead(viewer, {
            ...position,
            playheadMode: playheadMode()
          });
        } else if (playhead) {
          const x = position.x;
          playhead.setAttribute('x1', String(x));
          playhead.setAttribute('x2', String(x));
          if (Number.isFinite(position.yTop)) playhead.setAttribute('y1', String(position.yTop));
          if (Number.isFinite(position.yBottom)) playhead.setAttribute('y2', String(position.yBottom));
          playhead.dataset.system = String(position.systemIndex || 0);
        }
        lastPlayheadSystem = position.systemIndex;
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
      refreshQrParts();
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
      refreshQrParts();
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
      syncScoresToProjectKey,
      getScore: score,
      getMidiScore: midiScore,
      getMusicXmlScore: musicXmlScore,
      chooseMode,
      getPlayheadMode: playheadMode,
      setPlayheadMode
    });
  }

  const api = Object.freeze({ create });
  globalScope.MidiScoreController = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
