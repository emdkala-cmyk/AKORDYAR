/**
 * EditorToolbarService — editor metadata/style projection and bindings.
 *
 * The service owns only toolbar DOM wiring and a tiny size-lock UI state.
 * Song mutations and application side effects are supplied as callbacks.
 */
(function attachEditorToolbarService(globalScope) {
  const LOCKED_ICON =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" ' +
    'rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  const UNLOCKED_ICON =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" ' +
    'rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';

  function create({
    documentRef = globalScope.document,
    getSong = () => null,
    getElement = id => documentRef?.getElementById?.(id),
    isKeySyncing = () => false,
    archArtistKey = value => value || '',
    render = () => {},
    renderChords = () => {},
    save = () => {},
    sync = () => {},
    applyKeyChange = () => {},
    refreshKeyUI = () => {},
    renderTracks = () => {},
    renderRuler = () => {},
    renderClips = () => {},
    toast = () => {},
    noteNames = []
  } = {}) {
    let sizeLocked = false;
    let bound = false;

    function element(id) {
      return typeof getElement === 'function' ? getElement(id) : null;
    }

    function syncToolbar() {
      const song = getSong();
      if (!song) return;
      const styles = song.styles || {};
      const values = {
        edArtist: song.artist,
        edTitle: song.title,
        edTextSize: styles.tSize,
        edTextColor: styles.tColor,
        edTextFont: styles.tFont,
        edChordSize: styles.cSize,
        edChordColor: styles.cColor,
        edChordFont: styles.cFont,
        edTimeSig: song.timeSignature || '4/4',
        edTempo: song.tempo || 120,
        edGenre: song.genre || ''
      };
      Object.entries(values).forEach(([id, value]) => {
        const target = element(id);
        if (target && value !== undefined) target.value = value;
      });

      const bold = element('edTextBold');
      if (bold) bold.classList.toggle('active', Boolean(styles.tBold));

      const alignIds = {
        right: 'edAlignRight',
        center: 'edAlignCenter',
        left: 'edAlignLeft'
      };
      Object.entries(alignIds).forEach(([, id]) => {
        element(id)?.classList.toggle(
          'active',
          id === alignIds[styles.align || 'center']
        );
      });
      refreshKeyUI();
    }

    function updateStyle(key, value) {
      const song = getSong();
      if (!song || song.editorLocked) return false;
      if (!song.styles || typeof song.styles !== 'object') song.styles = {};
      song.styles[key] = value;
      render(false);
      setTimeout(() => renderChords(true), 0);
      save();
      return true;
    }

    function syncSizeLocked(changedId) {
      const song = getSong();
      if (!sizeLocked || !song || song.editorLocked) return;
      const source = element(changedId);
      const value = Number.parseInt(source?.value, 10) || 23;
      if (changedId === 'edTextSize') {
        song.styles.cSize = value;
        if (element('edChordSize')) element('edChordSize').value = value;
      } else {
        song.styles.tSize = value;
        if (element('edTextSize')) element('edTextSize').value = value;
      }
    }

    function toggleSizeLock() {
      sizeLocked = !sizeLocked;
      const button = element('edSizeLockBtn');
      if (button) {
        button.innerHTML = sizeLocked ? UNLOCKED_ICON : LOCKED_ICON;
        button.classList.toggle('active', sizeLocked);
      }
      toast(
        sizeLocked
          ? '🔗 قفل اندازه فعال — متن و آکورد همزمان تغییر می‌کنند'
          : '🔓 قفل اندازه غیرفعال'
      );
      return sizeLocked;
    }

    function toggleEditorLock() {
      const song = getSong();
      if (!song) return false;
      song.editorLocked = !song.editorLocked;
      const button = element('edEditorLockBtn');
      if (button) {
        button.innerHTML = song.editorLocked ? LOCKED_ICON : UNLOCKED_ICON;
        button.classList.toggle('editor-lock-blink', song.editorLocked);
      }
      const editor = element('editor');
      if (editor) editor.contentEditable = song.editorLocked ? 'false' : 'true';
      [
        'edTextSize', 'edChordSize', 'edTextFont', 'edChordFont',
        'edTextBold', 'edAlignRight', 'edAlignCenter', 'edAlignLeft',
        'edRemoveAsterisks', 'edReverseChords', 'edDoBoth'
      ].forEach(id => {
        const target = element(id);
        if (target) target.disabled = song.editorLocked;
      });
      toast(song.editorLocked ? '🔒 ویرایشگر قفل شد' : '🔓 ویرایشگر باز شد');
      return song.editorLocked;
    }

    function bindStyle(id, key, isColor = false) {
      const target = element(id);
      if (!target) return;
      const handler = () => {
        const value = isColor
          ? target.value
          : target.type === 'number'
            ? Number(target.value)
            : target.value;
        updateStyle(key, value);
        if (id === 'edTextSize' || id === 'edChordSize') {
          syncSizeLocked(id);
        }
      };
      if (target.tagName === 'SELECT') target.onchange = handler;
      else target.oninput = handler;
    }

    function bind() {
      if (bound) return;
      bound = true;

      bindStyle('edTextSize', 'tSize');
      bindStyle('edTextColor', 'tColor', true);
      bindStyle('edTextFont', 'tFont');
      bindStyle('edChordSize', 'cSize');
      bindStyle('edChordColor', 'cColor', true);
      bindStyle('edChordFont', 'cFont');

      const bold = element('edTextBold');
      if (bold) {
        bold.onclick = () => {
          const song = getSong();
          if (!song || song.editorLocked) return;
          song.styles.tBold = !song.styles.tBold;
          syncToolbar();
          render(false);
          save();
        };
      }

      [['edAlignRight', 'right'], ['edAlignCenter', 'center'], ['edAlignLeft', 'left']]
        .forEach(([id, value]) => {
          const target = element(id);
          if (!target) return;
          target.onclick = () => {
            const song = getSong();
            if (!song || song.editorLocked) return;
            song.styles.align = value;
            syncToolbar();
            render(false);
            save();
          };
        });

      const artist = element('edArtist');
      if (artist) artist.oninput = () => {
        const song = getSong();
        if (!song) return;
        song.artist = artist.value;
        song.artistKey = archArtistKey(song.artist);
        render(false);
        save();
      };

      const title = element('edTitle');
      if (title) title.oninput = () => {
        const song = getSong();
        if (!song) return;
        song.title = title.value;
        render(false);
        save();
      };

      const key = element('edKey');
      if (key) key.onchange = () => {
        const song = getSong();
        if (isKeySyncing() || !song) return;
        if (song.editorLocked) {
          key.value = song.key;
          toast('🔒 ویرایشگر قفل است');
          return;
        }
        applyKeyChange(key.value, element('edKeyMode')?.value || song.keyMode || 'maj');
      };

      const keyMode = element('edKeyMode');
      if (keyMode) keyMode.onchange = () => {
        const song = getSong();
        if (isKeySyncing() || !song) return;
        applyKeyChange(song.key, keyMode.value);
      };

      const timeSignature = element('edTimeSig');
      if (timeSignature) timeSignature.onchange = () => {
        const song = getSong();
        if (!song) return;
        song.timeSignature = timeSignature.value;
        save();
        renderTracks();
        renderRuler();
        renderClips();
      };

      const tempo = element('edTempo');
      if (tempo) tempo.oninput = () => {
        const song = getSong();
        if (!song) return;
        song.tempo = Number.parseInt(tempo.value, 10) || 120;
        save();
      };

      const genre = element('edGenre');
      if (genre) genre.onchange = () => {
        const song = getSong();
        if (!song) return;
        song.genre = genre.value;
        save();
      };

      const sizeLock = element('edSizeLockBtn');
      if (sizeLock) sizeLock.onclick = () => toggleSizeLock();
      const editorLock = element('edEditorLockBtn');
      if (editorLock) editorLock.onclick = () => toggleEditorLock();

      const header = documentRef?.querySelector?.('.header-center-controls');
      header?.addEventListener?.('wheel', event => {
        const target = event.target;
        if (target.type === 'number') {
          event.preventDefault();
          const step = event.shiftKey ? 5 : 1;
          const min = Number.parseFloat(target.min) || -Infinity;
          const max = Number.parseFloat(target.max) || Infinity;
          const value = Number.parseFloat(target.value) || 0;
          target.value = Math.max(
            min,
            Math.min(max, value + (event.deltaY < 0 ? step : -step))
          );
          target.dispatchEvent(new (globalScope.Event || Event)('input', { bubbles: true }));
        } else if (target.tagName === 'SELECT') {
          event.preventDefault();
          const options = target.options;
          if (!options?.length) return;
          target.selectedIndex =
            (target.selectedIndex + (event.deltaY < 0 ? -1 : 1) + options.length) %
            options.length;
          target.dispatchEvent(new (globalScope.Event || Event)('change', { bubbles: true }));
          target.dispatchEvent(new (globalScope.Event || Event)('input', { bubbles: true }));
        }
      }, { passive: false });

      const select = element('edKey');
      if (select && Array.isArray(noteNames)) {
        noteNames.forEach(note => {
          if (![...select.options].some(option => option.value === note)) {
            const option = documentRef?.createElement?.('option');
            if (!option) return;
            option.value = note;
            option.textContent = note;
            select.add(option);
          }
        });
      }
    }

    return Object.freeze({
      bind,
      syncToolbar,
      updateStyle,
      toggleSizeLock,
      toggleEditorLock,
      syncSizeLocked,
      getSizeLocked: () => sizeLocked
    });
  }

  globalScope.EditorToolbarService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
