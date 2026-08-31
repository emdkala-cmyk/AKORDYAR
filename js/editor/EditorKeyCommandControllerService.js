/*
 * EditorKeyCommandControllerService
 *
 * Coordinates key, transpose and accidental-spelling commands. Pure song
 * mutations stay in EditorKeyCommandService; this controller owns UI refresh,
 * persistence and the small set of DOM bindings around those commands.
 */
(function attachEditorKeyCommandControllerService(globalScope) {
  'use strict';

  const DEFAULT_NOTE_NAMES = Object.freeze([
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#',
    'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
  ]);

  function create({
    getSong = () => null,
    documentRef = globalScope.document,
    storage = globalScope.localStorage,
    notationService = globalScope.EditorNotationService,
    transposeService = globalScope.TransposeService,
    commandServiceFactory = globalScope.EditorKeyCommandService,
    ensureBaseChordNamesAligned = null,
    renderChords = () => {},
    renderEditor = () => {},
    syncTransposeToTimelineChords = () => {},
    saveSong = () => {},
    saveCurrentVersion = () => {},
    rebuildPerformanceSongDocument = () => {},
    toast = () => {},
    customPrompt = (message, defaultValue = '') =>
      Promise.resolve(globalScope.prompt?.(message, defaultValue)),
    noteNames = DEFAULT_NOTE_NAMES
  } = {}) {
    const element = id => documentRef?.getElementById?.(id);
    const allNoteNames = Object.freeze([
      ...(Array.isArray(noteNames) ? noteNames : DEFAULT_NOTE_NAMES)
    ]);
    const validNotes = new Set(allNoteNames);
    let accidentalPreference = 'auto';
    let keySyncing = false;
    let bound = false;

    function resolveAccidentalPreference() {
      if (accidentalPreference === 'sharp') return true;
      if (accidentalPreference === 'flat') return false;

      const song = getSong?.();
      const key = song?.originalKey || song?.key;
      const fromKey = key?.endsWith('m') ? key.slice(0, -1) : key;
      const preference = transposeService?.keySignaturePreference?.(fromKey);
      return preference === true || preference === false
        ? preference
        : null;
    }

    const commandOptions = {
      transposeChord: (name, semitones) =>
        notationService?.transposeChord?.(
          name,
          semitones,
          resolveAccidentalPreference()
        ) || name,
      transposeKey: (key, semitones, preferSharp) =>
        notationService?.transposeKey?.(
          key,
          semitones,
          preferSharp
        ) || key,
      keyDelta: (fromKey, toKey) =>
        notationService?.keyDelta?.(fromKey, toKey)
    };
    if (typeof ensureBaseChordNamesAligned === 'function') {
      commandOptions.ensureBaseChordNamesAligned =
        ensureBaseChordNamesAligned;
    }

    const commandService =
      typeof commandServiceFactory?.create === 'function'
        ? commandServiceFactory.create(commandOptions)
        : null;

    function isValidNote(note) {
      return Boolean(note) && validNotes.has(note);
    }

    function transposeChord(name, semitones) {
      if (!semitones || !name) return name;
      return notationService?.transposeChord?.(
        name,
        semitones,
        resolveAccidentalPreference()
      ) || name;
    }

    function baseNameFromDisplayed(name, song = getSong?.()) {
      const transpose = Number(song?.transpose) || 0;
      return transpose && name
        ? transposeChord(name, -transpose)
        : (name || '');
    }

    function transposeKeyName(key, semitones) {
      return commandService?.transposeKeyName?.(
        key,
        semitones,
        resolveAccidentalPreference()
      ) || key;
    }

    function keyToSemi(key) {
      return commandService?.keyToSemi?.(key) ?? -1;
    }

    function keyDelta(fromKey, toKey) {
      return commandService?.keyDelta?.(fromKey, toKey) ?? 0;
    }

    function transposeChordNamesInPlace(chords, semitones) {
      return commandService?.transposeChordNamesInPlace?.(
        chords,
        semitones
      ) || 0;
    }

    function refreshKeyUI() {
      const song = getSong?.();
      keySyncing = true;
      if (song) {
        const key = element('edKey');
        const mode = element('edKeyMode');
        if (key) key.value = song.key || 'C';
        if (mode) mode.value = song.keyMode || 'maj';
      }
      keySyncing = false;

      const originalKeyLabel = element('edOrigKeyLabel');
      if (originalKeyLabel && song) {
        const originalKey = song.originalKey || song.key;
        const originalMode = song.originalKeyMode || song.keyMode;
        originalKeyLabel.textContent =
          '🎵 ' + originalKey + (originalMode === 'min' ? 'm' : '');
        originalKeyLabel.title =
          'گام اورجینال: ' +
          originalKey +
          (originalMode === 'min' ? 'm' : '') +
          ' | کلیک=تغییر | Alt+کلیک=انتقال به گام پروژه';
      }

      const value = song?.transpose || 0;
      const transposeValue = element('edTransVal');
      if (transposeValue) {
        transposeValue.textContent = (value > 0 ? '+' : '') + value;
      }
    }

    function renderAllChordsAndText() {
      renderChords(true);
      renderEditor(false);
      syncTransposeToTimelineChords();
    }

    function applyResult(
      result,
      { saveVersion = false, rebuild = true } = {}
    ) {
      if (!result?.changed) return false;
      if (saveVersion) saveCurrentVersion();
      refreshKeyUI();
      renderAllChordsAndText();
      saveSong();
      if (rebuild) rebuildPerformanceSongDocument();
      return true;
    }

    function applyTranspose(newTranspose) {
      const result = commandService?.applyTranspose?.(
        getSong?.(),
        newTranspose,
        resolveAccidentalPreference()
      );
      return applyResult(result, { saveVersion: true });
    }

    function applyKeyChange(newKey, newMode) {
      const result = commandService?.applyKeyChange?.(
        getSong?.(),
        newKey,
        newMode
      );
      return applyResult(result);
    }

    function applyOriginalKeyChange(newKey, newMode) {
      const result = commandService?.applyOriginalKeyChange?.(
        getSong?.(),
        newKey,
        newMode
      );
      return applyResult(result, { saveVersion: true });
    }

    function syncProjectKeyToOriginal() {
      const result = commandService?.syncProjectKeyToOriginal?.(getSong?.());
      return applyResult(result, { saveVersion: true });
    }

    function resetToOriginalKey() {
      const result = commandService?.resetToOriginalKey?.(getSong?.());
      return applyResult(result, { rebuild: false });
    }

    function toggleAccidental() {
      const song = getSong?.();
      if (!song || song.editorLocked) {
        toast('🔒 ویرایشگر قفل است');
        return false;
      }

      const convert = transposeService?.convertAccidentals;
      if (typeof convert !== 'function') {
        toast('موتور آکورد در دسترس نیست');
        return false;
      }

      const accidentalNames = (song.chords || [])
        .map(chord => chord.name || '')
        .filter(name => /[#♯]|[b♭]/.test(name));
      const toFlat =
        !accidentalNames.length ||
        !accidentalNames.every(name => /[b♭]/.test(name));

      let converted = 0;
      (song.chords || []).forEach(chord => {
        if (!chord.name) return;
        const nextName = convert(chord.name, toFlat);
        if (nextName !== chord.name) {
          chord.name = nextName;
          converted += 1;
        }
      });
      if (Array.isArray(song.baseChordNames)) {
        song.baseChordNames = song.baseChordNames.map(name =>
          name ? convert(name, toFlat) : name
        );
      }

      if (!converted) {
        toast('آکوردی برای تبدیل یافت نشد');
        return false;
      }

      renderAllChordsAndText();
      saveSong();
      rebuildPerformanceSongDocument();
      toast(
        toFlat
          ? `آکوردها به بمل ♭ تبدیل شدند (${converted})`
          : `آکوردها به دیز ♯ تبدیل شدند (${converted})`
      );
      return true;
    }

    function initAccidentalSelector() {
      try {
        const saved = storage?.getItem?.('ed_accidental_pref');
        if (saved === 'sharp' || saved === 'flat' || saved === 'auto') {
          accidentalPreference = saved;
        }
      } catch (_) {}

      const host = element('headerCenterControls');
      if (!host || element('edAccidentalSel')) return;

      const wrap = documentRef.createElement('div');
      wrap.className = 'ed-grp';
      wrap.style.cssText =
        'display:inline-flex;align-items:center;gap:4px;';
      const translateFn = globalScope.t || (k => k);
      const label = documentRef.createElement('span');
      label.textContent = translateFn('note') || 'نت:';
      label.style.cssText =
        'font-size:0.7rem;color:var(--text-secondary);';
      const select = documentRef.createElement('select');
      select.id = 'edAccidentalSel';
      select.style.cssText =
        'background:#0D1117;color:#E2E8F0;border:1px solid #30363D;border-radius:6px;padding:2px 6px;font-size:0.75rem;cursor:pointer;';

      [
        ['auto', translateFn('accidentalAuto') || 'خودکار'],
        ['sharp', translateFn('accidentalSharp') || 'دیز ♯'],
        ['flat', translateFn('accidentalFlat') || 'بمل ♭']
      ].forEach(([value, text]) => {
        const option = documentRef.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
      });
      select.value = accidentalPreference;
      select.addEventListener('change', () => {
        accidentalPreference = select.value;
        try {
          storage?.setItem?.(
            'ed_accidental_pref',
            accidentalPreference
          );
        } catch (_) {}

        const song = getSong?.();
        if (song) {
          if (song.transpose) applyTranspose(song.transpose);
          else {
            refreshKeyUI();
            renderAllChordsAndText();
          }
        }
        toast(
          'نمایش نت: ' +
          (accidentalPreference === 'sharp'
            ? 'دیز ♯'
            : accidentalPreference === 'flat'
              ? 'بمل ♭'
              : 'خودکار')
        );
      });

      wrap.appendChild(label);
      wrap.appendChild(select);
      host.appendChild(wrap);
    }

    function bind() {
      if (bound) return;
      bound = true;

      element('edTransUp')?.addEventListener('click', () => {
        const song = getSong?.();
        if (song?.editorLocked) {
          toast('🔒 ویرایشگر قفل است');
          return;
        }
        if (song) applyTranspose((song.transpose || 0) + 1);
      });
      element('edTransDown')?.addEventListener('click', () => {
        const song = getSong?.();
        if (song?.editorLocked) {
          toast('🔒 ویرایشگر قفل است');
          return;
        }
        if (song) applyTranspose((song.transpose || 0) - 1);
      });
      element('edTransVal')?.addEventListener('dblclick', () => {
        if (getSong?.()) applyTranspose(0);
      });
      element('edToggleAccidental')?.addEventListener(
        'click',
        toggleAccidental
      );
      element('edOrigKeyLabel')?.addEventListener('click', event => {
        const song = getSong?.();
        if (!song) return;
        if (song.editorLocked) {
          toast('🔒 ویرایشگر قفل است');
          return;
        }

        if (event.altKey) {
          const originalKey = song.originalKey || song.key || 'C';
          const originalMode =
            song.originalKeyMode || song.keyMode || 'maj';
          syncProjectKeyToOriginal();
          toast(
            'گام پروژه با گام اورجینال یکی شد: ' +
            originalKey +
            (originalMode === 'min' ? 'm' : '')
          );
          return;
        }

        const currentKey = song.originalKey || song.key || 'C';
        const currentMode = song.originalKeyMode || song.keyMode || 'maj';
        const currentValue =
          currentKey + (currentMode === 'min' ? 'm' : '');
        Promise.resolve(
          customPrompt(
            'گام اورجینال آهنگ رو مشخص کنید:',
            currentValue
          )
        ).then(nextValue => {
          if (
            !nextValue ||
            nextValue.trim() === '' ||
            nextValue.trim() === currentValue
          ) {
            return;
          }
          const value = nextValue.trim();
          const nextMode =
            value.endsWith('m') && value.length > 1 ? 'min' : 'maj';
          const nextKey =
            nextMode === 'min' ? value.replace(/m$/, '') : value;
          if (!isValidNote(nextKey)) {
            toast('گام نامعتبر: ' + nextKey);
            return;
          }
          applyOriginalKeyChange(nextKey, nextMode);
          toast(
            'گام اورجینال ذخیره شد: ' +
            nextKey +
            (nextMode === 'min' ? 'm' : '')
          );
        });
      });
    }

    return Object.freeze({
      commandService,
      noteNames: allNoteNames,
      isKeySyncing: () => keySyncing,
      resolveAccidentalPreference,
      isValidNote,
      baseNameFromDisplayed,
      transposeChord,
      transposeKeyName,
      keyToSemi,
      keyDelta,
      transposeChordNamesInPlace,
      refreshKeyUI,
      renderAllChordsAndText,
      applyTranspose,
      applyKeyChange,
      applyOriginalKeyChange,
      syncProjectKeyToOriginal,
      resetToOriginalKey,
      toggleAccidental,
      initAccidentalSelector,
      bind
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorKeyCommandControllerService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
