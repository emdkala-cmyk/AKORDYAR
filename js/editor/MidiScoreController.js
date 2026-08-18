/**
 * MidiScoreController
 *
 * Small UI adapter for the read-only MIDI score surface.  It owns no clock:
 * playback callers can push the current Audio-Clock-derived seconds through
 * updatePlayhead().
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
    renderer = globalScope.MidiScoreRenderer
  } = {}) {
    if (!importService?.create) throw new TypeError('MidiScoreController requires MidiScoreImportService');
    if (!model?.normalize) throw new TypeError('MidiScoreController requires MidiScoreModel');
    if (!renderer?.renderSvg) throw new TypeError('MidiScoreController requires MidiScoreRenderer');

    const service = importService.create();
    let selectedPartId = null;
    let bound = false;
    let activeSeconds = 0;

    function getElement(id) {
      return documentRef?.getElementById?.(id) || null;
    }

    function getScore() {
      const song = getSong();
      return song?.midiScore ? model.normalize(song.midiScore) : null;
    }

    function close() {
      const modal = getElement('midiScoreModal');
      if (!modal) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }

    function choosePart(partId) {
      selectedPartId = partId;
      render();
    }

    function renderParts(score) {
      const partsEl = getElement('midiScoreParts');
      if (!partsEl) return;
      partsEl.replaceChildren();
      (score?.parts || []).forEach(part => {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = `midi-score-part-btn${part.id === selectedPartId ? ' active' : ''}`;
        button.dataset.partId = part.id;
        button.textContent = `${part.name} · ${part.roleLabel}`;
        button.addEventListener('click', () => choosePart(part.id));
        partsEl.appendChild(button);
      });
    }

    function render() {
      const modal = getElement('midiScoreModal');
      const score = getScore();
      if (!modal || !score) return;
      if (!selectedPartId || !model.getPart(score, selectedPartId)) {
        selectedPartId = score.activePartId || score.parts[0]?.id || null;
      }
      const normalized = model.setActivePart(score, selectedPartId);
      const song = getSong();
      if (song?.midiScore) song.midiScore = model.serialize(normalized);

      renderParts(normalized);
      const summary = model.getSummary(normalized);
      const meta = getElement('midiScoreMeta');
      if (meta) {
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
      const viewer = getElement('midiScoreViewer');
      if (viewer) {
        viewer.innerHTML = renderer.renderSvg(normalized, selectedPartId, {
          activeTime: activeSeconds,
          ariaLabel: `${model.getPart(normalized, selectedPartId)?.name || 'MIDI'} score`
        });
        const svg = viewer.querySelector('svg');
        if (svg) {
          viewer.style.setProperty('--midi-score-width', `${svg.getAttribute('width') || 0}px`);
        }
      }
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }

    async function importFile(file) {
      if (!file) return null;
      try {
        toast('در حال خواندن فایل MIDI…');
        const score = await service.parseFile(file);
        const song = getSong();
        if (!song) throw new Error('ترانه‌ای برای افزودن MIDI باز نیست');
        service.applyToSong(song, score);
        setSong(song);
        selectedPartId = score.activePartId || score.parts[0]?.id || null;
        onSongChanged(song, score);
        saveSong();
        render();
        toast(`MIDI وارد شد: ${score.parts.length} پارت، ${model.getSummary(score).noteCount} نت`);
        return score;
      } catch (error) {
        console.error('[MIDI Score] Import failed:', error);
        toast(`خطا در ورود MIDI: ${error?.message || 'فایل نامعتبر است'}`);
        return null;
      }
    }

    function bindInput() {
      if (bound) return;
      const input = getElement('midi-file-input');
      if (!input) return;
      bound = true;
      input.addEventListener('change', async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) await importFile(file);
      });
    }

    function openImporter() {
      bindInput();
      const input = getElement('midi-file-input');
      if (input) input.click();
      else toast('ورودی فایل MIDI پیدا نشد');
    }

    function open() {
      bindInput();
      if (getScore()) render();
      else openImporter();
    }

    function updatePlayhead(seconds) {
      activeSeconds = Math.max(0, Number(seconds) || 0);
      const viewer = getElement('midiScoreViewer');
      const score = getScore();
      if (!viewer || !score || !selectedPartId) return;
      const playhead = viewer.querySelector('[data-score-playhead]');
      if (playhead) {
        const x = renderer.getPlayheadX(score, selectedPartId, activeSeconds);
        playhead.setAttribute('x1', String(x));
        playhead.setAttribute('x2', String(x));
        return;
      }
      // Keep the note highlight and playhead in one render path when a score
      // was opened before the first playback update.
      render();
    }

    function clearScore() {
      const song = getSong();
      if (!song?.midiScore) return false;
      service.removeFromSong(song);
      setSong(song);
      onSongChanged(song, null);
      saveSong();
      close();
      toast('اطلاعات MIDI حذف شد');
      return true;
    }

    bindInput();
    return Object.freeze({
      open,
      openImporter,
      close,
      render,
      importFile,
      updatePlayhead,
      clearScore,
      getScore
    });
  }

  const api = Object.freeze({ create });
  globalScope.MidiScoreController = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
