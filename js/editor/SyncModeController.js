/**
 * SyncModeController — کنترلر حالت Sync (اتصال خطوط ترانه به زمان)
 *
 * استخراج‌شده از runtime ادیتور در Commit 2a برنامهٔ Editor Domain Extraction.
 *
 * این کنترلر مالک state نیست؛ state اصلی (syncActive، syncCursor، syncHistory و…)
 * همچنان به‌صورت state در runtime ادیتور نگهداری می‌شود — چون خوانندگان خارجی (tick حمل‌ونقل،
 * shortcutها، key handler کلید ۰) همان متغیرها را می‌خوانند. کنترلر از طریق
 * accessor object با getter/setter closure روی همان متغیرها کار می‌کند و
 * منبع حقیقت واحد حفظ می‌شود.
 *
 * توجه: PerformanceStore/SharedEngine/_songDocument با همان guardهای typeof
 * کد اصلی دسترسی می‌شوند؛ در نبودشان (مثلاً تست Node) همان‌طور که قبل رد می‌شدند،
 * رد می‌شوند.
 */
class SyncModeController {
  constructor({
    state,
    DAW,
    getDAW,
    songState,
    $,
    t,
    toast,
    edSaveSong,
    startTransport,
    pauseTransport,
    seekTransport,
    getProjectEnd,
    getLyricPopup,
    getLyricOnlyPopup,
    getChordLinePopup,
    seqState = null,
    edRenderChords,
    edCommit,
    saveState,
    renderAll,
    uid,
    roundMs,
    ensureTimelineFits,
    timeToX,
    formatTime,
    openChordLinePopup,
    getPerformanceStore,
    applyHighlightClassToEditor,
    windowRef,
    windowBridge,
    logger = console
  } = {}) {
    if (!state) {
      throw new TypeError('SyncModeController requires a state accessor object');
    }
    const runtimeDAW = typeof getDAW === 'function' ? getDAW() : DAW;
    if (!runtimeDAW) {
      throw new TypeError('SyncModeController requires the DAW reference');
    }
    if (!songState || typeof songState.getLyrics !== 'function') {
      throw new TypeError('SyncModeController requires songState');
    }
    if (typeof $ !== 'function') {
      throw new TypeError('SyncModeController requires $');
    }

    this.state = state;
    this.getDAW = typeof getDAW === 'function' ? getDAW : () => runtimeDAW;
    this.songState = songState;
    this.$ = $;

    this.t = typeof t === 'function' ? t : (key) => key;
    this.toast = typeof toast === 'function' ? toast : () => {};
    this.edSaveSong = typeof edSaveSong === 'function' ? edSaveSong : () => {};
    this.startTransport = typeof startTransport === 'function' ? startTransport : () => {};
    this.pauseTransport = typeof pauseTransport === 'function' ? pauseTransport : () => {};
    this.seekTransport = typeof seekTransport === 'function' ? seekTransport : () => {};
    this.getProjectEnd = typeof getProjectEnd === 'function' ? getProjectEnd : () => 0;

    this.getLyricPopup = typeof getLyricPopup === 'function' ? getLyricPopup : () => null;
    this.getLyricOnlyPopup = typeof getLyricOnlyPopup === 'function' ? getLyricOnlyPopup : () => null;
    this.getChordLinePopup = typeof getChordLinePopup === 'function' ? getChordLinePopup : () => null;

    // Commit 2b — seq/CL: accessor روی stateهای seq/CL (edSeqModeActive، edClMarkers و…)
    this.seqState = seqState;
    this.edRenderChords = typeof edRenderChords === 'function' ? edRenderChords : () => {};
    this.edCommit = typeof edCommit === 'function' ? edCommit : () => {};
    this.saveState = typeof saveState === 'function' ? saveState : () => {};
    this.renderAll = typeof renderAll === 'function' ? renderAll : () => {};
    this.uid = typeof uid === 'function' ? uid : (p) => `${p}_0`;
    this.roundMs = typeof roundMs === 'function' ? roundMs : (v) => Math.round(v * 1000) / 1000;
    this.ensureTimelineFits = typeof ensureTimelineFits === 'function' ? ensureTimelineFits : () => {};
    this.timeToX = typeof timeToX === 'function' ? timeToX : (v) => v;
    this.formatTime = typeof formatTime === 'function' ? formatTime : () => '';
    this.openChordLinePopup = typeof openChordLinePopup === 'function' ? openChordLinePopup : () => {};
    this.getPerformanceStore =
      typeof getPerformanceStore === 'function'
        ? getPerformanceStore
        : () => (
            typeof window !== 'undefined'
              ? window.RuntimeStateAdapter?.getPerformanceStore?.() || null
              : null
          );
    this.applyHighlightClassToEditor =
      typeof applyHighlightClassToEditor === 'function'
        ? applyHighlightClassToEditor
        : () => {};
    this.window =
      windowRef ||
      (typeof window !== 'undefined' ? window : null);
    this.windowBridge =
      windowBridge ||
      this.window?.WindowBridge ||
      null;

    this.logger = logger || console;
    this.syncEditLine = null;
    this.syncTimeInput = null;
    this.syncPreviewTimer = null;
    this.syncPreviewActive = false;
    this.syncPanelWheelTarget = null;
    this.syncPanelWheelHandler = null;
  }

  _getSyncRows() {
    const box = this.$('syncLyrics');
    if (box?.querySelectorAll) return box.querySelectorAll('.sline');
    if (typeof document !== 'undefined') {
      return document.querySelectorAll('#syncLyrics .sline');
    }
    return [];
  }

  _scrollSyncRowIntoView(row, { center = false } = {}) {
    const box = this.$('syncLyrics');
    if (!box || !row) return;

    const rowTop = Number(row.offsetTop) || 0;
    const rowHeight = Number(row.offsetHeight) || 0;
    const rowBottom = rowTop + rowHeight;
    const scrollTop = Number(box.scrollTop) || 0;
    const boxHeight = Number(box.clientHeight) || 0;
    if (!boxHeight) return;

    const padding = 12;
    let nextScrollTop = null;
    if (center) {
      nextScrollTop = rowTop - boxHeight / 2 + rowHeight / 2;
    } else if (rowTop < scrollTop + padding) {
      nextScrollTop = Math.max(0, rowTop - padding);
    } else if (rowBottom > scrollTop + boxHeight - padding) {
      nextScrollTop = Math.max(0, rowBottom - boxHeight + padding);
    }

    if (nextScrollTop !== null) {
      const scrollHeight = Number(box.scrollHeight) || 0;
      const maxScrollTop = Math.max(0, scrollHeight - boxHeight);
      nextScrollTop = Math.min(maxScrollTop, Math.max(0, nextScrollTop));
    }

    if (nextScrollTop === null || Math.abs(nextScrollTop - scrollTop) < 1) return;
    if (typeof box.scrollTo === 'function') {
      box.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
    } else {
      box.scrollTop = nextScrollTop;
    }
  }

  _updateSyncEditState() {
    this._getSyncRows().forEach(row => {
      row.classList?.toggle(
        'sync-time-editing',
        Number(row.dataset?.li) === this.syncEditLine
      );
    });
  }

  _bindSyncLineInteractions(row, timeEl, li) {
    row.onclick = () => this.selectSyncLine(li);
    row.ondblclick = event => {
      event.preventDefault?.();
      event.stopPropagation?.();
      this.seekSyncLine(li);
    };

    if (timeEl) {
      timeEl.ondblclick = event => {
        event.preventDefault?.();
        event.stopPropagation?.();
        this.editSyncTime(li, event);
      };
    }
  }

  handleSyncPanelWheel(event) {
    if (!event?.ctrlKey) return false;

    const row = event.target?.closest?.('.sline');
    const lineIndex = Number(row?.dataset?.li);
    if (!row || !Number.isFinite(lineIndex)) return false;

    event.preventDefault?.();
    event.stopPropagation?.();
    return this.adjustSyncTimeFromWheel(lineIndex, event);
  }

  _syncPopupHighlight(popup) {
    if (!popup) return false;

    if (this.windowBridge?.isOpen && this.windowBridge?.call) {
      if (!this.windowBridge.isOpen(popup)) return false;
      return this.windowBridge.call(popup, '_syncHighlight');
    }

    // Compatibility fallback for isolated legacy callers that do not inject
    // WindowBridge yet. The application path always uses the bridge.
    if (popup.closed === true || typeof popup._syncHighlight !== 'function') {
      return false;
    }
    try {
      popup._syncHighlight();
      return true;
    } catch (_) {
      return false;
    }
  }

  _requireSeqState() {
    if (!this.seqState) {
      throw new Error('SyncModeController: seqState تزریق نشده است — اتصال runtime ادیتور را بررسی کنید.');
    }
    return this.seqState;
  }

  formatSyncTime(t) {
    if (!Number.isFinite(t)) return '--:--.-';
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(4, '0')}`;
  }

  parseSyncTime(value) {
    const normalized = String(value ?? '').trim().replace(',', '.');
    if (!normalized) return NaN;

    const parts = normalized.split(':');
    let seconds = NaN;
    if (parts.length === 1) {
      seconds = Number(parts[0]);
    } else if (parts.length === 2) {
      seconds = Number(parts[0]) * 60 + Number(parts[1]);
    } else if (parts.length === 3) {
      seconds =
        Number(parts[0]) * 3600 +
        Number(parts[1]) * 60 +
        Number(parts[2]);
    }

    return Number.isFinite(seconds) && seconds >= 0 ? seconds : NaN;
  }

  createSyncLineEl(line, li, time) {
    const d = document.createElement('div');
    d.className = 'sline';
    d.dataset.li = li;

    const text = document.createElement('span');
    text.className = 's-text';
    text.textContent = line || ' ';

    const timeEl = document.createElement('span');
    timeEl.className = 's-time';
    timeEl.textContent = this.formatSyncTime(time);

    d.appendChild(text);
    d.appendChild(timeEl);
    this._bindSyncLineInteractions(d, timeEl, li);

    return d;
  }

  renderSyncLyrics() {
    const box = this.$('syncLyrics');
    if (!box) return;

    const lines = this.songState.getLyrics().split('\n');
    const times = this.songState.getSyncTimes();
    const existingCount = box.children.length;

    // فقط وقتی تعداد خط‌ها عوض شده، rebuild کامل انجام بده
    if (existingCount !== lines.length) {
      const frag = document.createDocumentFragment();

      lines.forEach((line, li) => {
        frag.appendChild(this.createSyncLineEl(line, li, times[li]));
      });

      box.replaceChildren(frag);
      this.selectSyncLine(this.state.cursor);
      return;
    }

    // در حالت عادی فقط سطرهایی که لازم است آپدیت شوند
    for (let li = 0; li < lines.length; li++) {
      const row = box.children[li];
      if (!row) continue;

      if (row.dataset.li !== String(li)) {
        row.dataset.li = li;
      }

      const textEl = row.querySelector('.s-text');
      const timeEl = row.querySelector('.s-time');
      this._bindSyncLineInteractions(row, timeEl, li);

      const nextText = lines[li] || ' ';
      const nextTime = this.formatSyncTime(times[li]);

      if (textEl && textEl.textContent !== nextText) {
        textEl.textContent = nextText;
      }

      if (timeEl && timeEl.textContent !== nextTime) {
        timeEl.textContent = nextTime;
      }
    }

    this.selectSyncLine(this.state.cursor);
  }

  selectSyncLine(li) {
    const total = this.songState.getLyrics().split('\n').length;
    const numericLine = Number(li);
    li = Number.isFinite(numericLine) ? Math.floor(numericLine) : 0;
    li = Math.max(0, Math.min(Math.max(0, total), li));
    this.state.cursor = li;

    const rows = this._getSyncRows();
    let selectedEl = null;

    rows.forEach(el => {
      const isSel = (+el.dataset.li === li);
      if (el.classList.contains('selected') !== isSel) {
        el.classList.toggle('selected', isSel);
      }
      if (isSel) selectedEl = el;
    });

    if (selectedEl) {
      this._scrollSyncRowIntoView(selectedEl);
    }

    this._updateSyncEditState();
    const info = this.$('syncInfo');
    if (info) {
      info.textContent = `${this.t('linesOf')} ${li + 1} ${this.t('lineOf')} ${total}`;
    }
  }

  editSyncTime(li, event) {
    if (typeof document === 'undefined') return false;
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const lines = this.songState.getLyrics().split('\n');
    const numericLine = Number(li);
    const lineIndex = Number.isFinite(numericLine)
      ? Math.max(0, Math.min(Math.max(0, lines.length - 1), Math.floor(numericLine)))
      : 0;

    this.syncTimeInput?.finish?.(false);
    this.syncEditLine = lineIndex;
    this.selectSyncLine(lineIndex);

    let row = null;
    this._getSyncRows().forEach(candidate => {
      if (Number(candidate.dataset?.li) === lineIndex) row = candidate;
    });
    const timeEl = row?.querySelector?.('.s-time');
    if (!timeEl) return false;

    const existingInput = timeEl.querySelector?.('.s-time-input');
    if (existingInput) {
      existingInput.focus?.();
      existingInput.select?.();
      return true;
    }

    const times = this.songState.getSyncTimes();
    const daw = this.getDAW();
    const existingTime = Number(times[lineIndex]);
    const currentTime = Number.isFinite(existingTime)
      ? existingTime
      : (Number.isFinite(Number(daw?.playhead)) ? Number(daw.playhead) : 0);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 's-time-input';
    input.value = this.formatSyncTime(currentTime);
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.title = 'زمان را به صورت ثانیه یا دقیقه:ثانیه وارد کنید';

    let finished = false;
    const finish = commit => {
      if (finished) return;
      finished = true;
      if (this.syncTimeInput?.input === input) this.syncTimeInput = null;
      timeEl.classList?.remove('editing');

      if (commit) {
        const parsedTime = this.parseSyncTime(input.value);
        if (Number.isFinite(parsedTime)) {
          const nextTime = this.roundMs(parsedTime);
          if (!Number.isFinite(existingTime) || nextTime !== existingTime) {
            this.state.history.push(JSON.stringify(times));
            this.state.redoHistory = [];
            this.songState.setSyncTime(lineIndex, nextTime);
            this.edSaveSong();
          }
          this.renderSyncLyrics();
          const currentDaw = this.getDAW();
          this.seekTransport(nextTime, Boolean(currentDaw?.isPlaying), true);
          this.updateSyncHighlight();
          return;
        }
      }

      this.renderSyncLyrics();
    };

    input.onkeydown = keyEvent => {
      if (keyEvent.key === 'Enter') {
        keyEvent.preventDefault?.();
        finish(true);
      } else if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault?.();
        finish(false);
      }
    };
    input.onblur = () => finish(true);
    timeEl.replaceChildren(input);
    timeEl.classList?.add('editing');
    this.syncTimeInput = { input, finish };
    input.focus?.();
    input.select?.();
    return true;
  }

  seekSyncLine(li) {
    const lines = this.songState.getLyrics().split('\n');
    const numericLine = Number(li);
    const lineIndex = Number.isFinite(numericLine)
      ? Math.max(0, Math.min(Math.max(0, lines.length - 1), Math.floor(numericLine)))
      : 0;

    this.syncEditLine = lineIndex;
    this.selectSyncLine(lineIndex);

    const times = this.songState.getSyncTimes();
    const time = Number(times[lineIndex]);
    if (!Number.isFinite(time)) return false;

    const daw = this.getDAW();
    this.seekTransport(time, Boolean(daw?.isPlaying), true);
    this.updateSyncHighlight();
    return true;
  }

  adjustSyncTime(lineIndex, delta, { preview = false } = {}) {
    const lines = this.songState.getLyrics().split('\n');
    if (!lines.length) return null;

    const numericLine = Number(lineIndex);
    const targetLine = Number.isFinite(numericLine)
      ? Math.max(0, Math.min(lines.length - 1, Math.floor(numericLine)))
      : 0;
    const amount = Number(delta);
    if (!Number.isFinite(amount) || amount === 0) return null;

    const times = this.songState.getSyncTimes();
    const daw = this.getDAW();
    let currentTime = Number(times[targetLine]);
    if (!Number.isFinite(currentTime)) {
      currentTime = Number(daw?.playhead);
      if (!Number.isFinite(currentTime)) currentTime = 0;
    }

    const nextTime = this.roundMs(Math.max(0, currentTime + amount));
    this.state.history.push(JSON.stringify(times));
    this.state.redoHistory = [];
    this.songState.setSyncTime(targetLine, nextTime);
    this.state.cursor = targetLine;
    this.syncEditLine = targetLine;
    this.renderSyncLyrics();

    if (preview) {
      this.previewSyncAudio(nextTime);
    } else {
      const currentDaw = this.getDAW();
      this.seekTransport(nextTime, Boolean(currentDaw?.isPlaying), true);
    }

    this.edSaveSong();
    return nextTime;
  }

  adjustSyncTimeFromWheel(lineIndex, event) {
    if (!event?.ctrlKey) return false;
    const deltaY = Number(event?.deltaY);
    if (!Number.isFinite(deltaY) || deltaY === 0) return false;

    event.preventDefault?.();
    event.stopPropagation?.();
    this.syncEditLine = lineIndex;
    const delta = deltaY < 0 ? 0.5 : -0.5;
    return this.adjustSyncTime(lineIndex, delta, { preview: true }) !== null;
  }

  _clearSyncPreviewTimer() {
    if (this.syncPreviewTimer === null) return;
    clearTimeout(this.syncPreviewTimer);
    this.syncPreviewTimer = null;
  }

  _armSyncPreviewStop() {
    this._clearSyncPreviewTimer();
    this.syncPreviewTimer = setTimeout(() => {
      this.syncPreviewTimer = null;
      if (!this.syncPreviewActive) return;
      const daw = this.getDAW();
      if (daw?.isPlaying) this.pauseTransport();
      this.syncPreviewActive = false;
    }, 350);
  }

  cancelSyncPreview() {
    this._clearSyncPreviewTimer();
    if (this.syncPreviewActive && this.getDAW()?.isPlaying) {
      this.pauseTransport();
    }
    this.syncPreviewActive = false;
  }

  previewSyncAudio(time) {
    const daw = this.getDAW();
    if (!daw) return false;

    const wasPlaying = Boolean(daw.isPlaying);
    this._clearSyncPreviewTimer();
    this.seekTransport(time, true, true);

    if (!wasPlaying && !this.syncPreviewActive) {
      this.syncPreviewActive = true;
      this.startTransport();
    }

    if (this.syncPreviewActive) this._armSyncPreviewStop();
    return true;
  }

  syncTap() {
    const state = this.state;
    if (!state.active) return;
    this.syncTimeInput?.finish?.(false);
    const lines = this.songState.getLyrics().split('\n');
    if (state.cursor >= lines.length) return;
    const daw = this.getDAW();
    const t = daw.playhead;
    state.history.push(JSON.stringify(this.songState.getSyncTimes()));
    state.redoHistory = [];
    this.songState.setSyncTime(state.cursor, t);
    // Skip empty lines
    let next = state.cursor + 1;
    while (next < lines.length && !lines[next].trim()) {
      this.songState.setSyncTime(next, t);
      next++;
    }
    state.cursor = next;
    this.syncEditLine = null;
    this.renderSyncLyrics();
    if (state.cursor >= lines.length) {
      // اصلاح عمدی نسبت به نسخهٔ قبلی: متغیر محلی `t` (عدد playhead)
      // تابع i18n را shadow می‌کرد و فراخوانی t('syncFinished') خطای
      // TypeError می‌داد؛ بنابراین مسیر پایان sync هرگز toast/save را کامل نمی‌کرد.
      // اینجا this.t (i18n واقعی) استفاده می‌شود. — ثبت در گزارش روند، Commit 2a.
      this.toast(this.t('syncFinished'));
      if (this.getDAW().isPlaying) this.pauseTransport();
    }
    this.edSaveSong();
  }

  updateSyncHighlight() {
    const t = this.getDAW().playhead;
    const times = this.songState.getSyncTimes();
    const lyricLines = this.songState.getLyrics().split('\n');
    const sharedEngine =
      typeof window !== 'undefined' ? window.SharedEngine : null;
    let activeLi =
      typeof sharedEngine?.resolveActiveLineIndex === 'function'
        ? sharedEngine.resolveActiveLineIndex(times, t, lyricLines)
        : -1;

    if (activeLi < 0 && typeof sharedEngine?.resolveActiveLineIndex !== 'function') {
      let activeTime = Number.NEGATIVE_INFINITY;
      times.forEach((value, index) => {
        const cueTime = Number(value);
        const lyricLine = lyricLines[index];
        const visibleLine =
          index >= lyricLines.length ||
          (typeof lyricLine === 'string' && lyricLine.trim().length > 0);
        if (
          Number.isFinite(cueTime) &&
          cueTime <= t &&
          visibleLine &&
          cueTime >= activeTime
        ) {
          activeLi = index;
          activeTime = cueTime;
        }
      });
      if (activeLi < 0 && times.some(time => Number.isFinite(time))) {
        activeLi = lyricLines.findIndex(line => line.trim());
        if (activeLi < 0) {
          activeLi = times.findIndex(time => Number.isFinite(time));
        }
      }
    }

    // === Performance Architecture v2: sync playback + highlight to Store ===
    const store = this.getPerformanceStore();
    const songDocument = store?.getState?.().songDocument || null;
    if (
      store &&
      sharedEngine &&
      songDocument &&
      typeof sharedEngine.computeHighlight === 'function'
    ) {
      store.setPlaybackState({ time: t, isPlaying: !!this.getDAW().isPlaying });
      const hl = sharedEngine.computeHighlight(
        store.getState().playbackState,
        songDocument
      );
      store.setHighlightState(hl);
    }

    // اگر خط فعال عوض نشده، فقط در صورت نیاز تایم/پروگرس پنل را آپدیت کن
    const changed = activeLi !== this.state.lastActiveLi;
    this.state.lastActiveLi = activeLi;

    // Highlight lines in main editor
    const editorEl = this.$('editor');
    if (editorEl) {
      // Song reloads/renderers may replace the editor root. Re-apply the
      // selected effect, but the service is idempotent so this is safe per
      // transport tick and does not restart CSS animations.
      this.applyHighlightClassToEditor();
      [...editorEl.children].forEach((el, li) => {
        if (!el.classList.contains('eline')) return;

        const isPlaying = (li === activeLi);
        const isDone = Number.isFinite(times[li]) && times[li] < t && li !== activeLi;

        if (changed || el.classList.contains('sync-playing') !== isPlaying) {
          el.classList.toggle('sync-playing', isPlaying);
        }

        if (changed || el.classList.contains('sync-done') !== isDone) {
          el.classList.toggle('sync-done', isDone);
        }
      });

      // Center active line in editorWrap فقط وقتی خط عوض شد
      if (changed && activeLi >= 0 && editorEl.children[activeLi]) {
        const wrap = this.$('editorWrap');
        if (wrap) {
          const activeEl = editorEl.children[activeLi];
          const wrapH = wrap.clientHeight;
          const elTop = activeEl.offsetTop;
          const elH = activeEl.offsetHeight;

          wrap.scrollTo({
            top: elTop - wrapH / 2 + elH / 2,
            behavior: 'smooth'
          });
        }
      }
    }

    // Update sync panel UI
    if (this.state.active) {
      const syncRows = this._getSyncRows();
      syncRows.forEach(el => {
        const li = +el.dataset.li;

        const isPlaying = (li === activeLi);
        const isDone = Number.isFinite(times[li]) && times[li] < t && li !== activeLi;

        if (changed || el.classList.contains('playing') !== isPlaying) {
          el.classList.toggle('playing', isPlaying);
        }

        if (changed || el.classList.contains('done') !== isDone) {
          el.classList.toggle('done', isDone);
        }
      });

      if (changed && activeLi >= 0) {
        let activeSyncRow = null;
        syncRows.forEach(row => {
          if (Number(row.dataset?.li) === activeLi) activeSyncRow = row;
        });
        if (activeSyncRow) {
          this._scrollSyncRowIntoView(activeSyncRow, { center: true });
        }
      }

      const total = this.getProjectEnd();
      if (total > 0) {
        const fill = this.$('syncTimelineFill');
        if (fill) fill.style.width = (t / total * 100) + '%';
      }

      const curTime = this.$('syncCurTime');
      if (curTime) curTime.textContent = this.formatSyncTime(t);
    }

    // Sync highlight through WindowBridge; popup DOM remains outside this
    // controller's ownership boundary.
    this._syncPopupHighlight(this.getLyricPopup());
    this._syncPopupHighlight(this.getLyricOnlyPopup());
    this._syncPopupHighlight(this.getChordLinePopup());
  }

  // Sync tick loop
  syncTick() {
    if (!this.state.active) return;

    this.updateSyncHighlight();
    this.state.watch = requestAnimationFrame(() => this.syncTick());
  }

  enterSyncMode() {
    const state = this.state;
    this.syncTimeInput?.finish?.(false);
    this.cancelSyncPreview();
    state.active = true;
    state.cursor = 0;
    this.syncEditLine = null;
    const lines = this.songState.getLyrics().split('\n');
    while (state.cursor < lines.length && !lines[state.cursor].trim()) state.cursor++;
    if (state.cursor >= lines.length) state.cursor = 0;
    this.songState.ensureSyncTimes();
    state.history = []; state.redoHistory = [];
    this.renderSyncLyrics();
    this.$('syncSection').classList.add('show');
    // Ctrl+Space sync tap is routed through EditorKeyboardService.
    state.tapKeyHandler = null;
    // Start highlight tick
    this.syncTick();
  }

  exitSyncMode() {
    const state = this.state;
    this.syncTimeInput?.finish?.(false);
    this.cancelSyncPreview();
    state.active = false;
    this.syncEditLine = null;
    this.$('syncSection').classList.remove('show');
    state.tapKeyHandler = null;
    if (state.watch) { cancelAnimationFrame(state.watch); state.watch = null; }
    this.edSaveSong();
  }

  /* ===== Commit 2b: Sequential chords (آکورد ترتیبی) ===== */

  edToggleSeqMode() {
    const ss = this._requireSeqState();
    ss.seqModeActive = !ss.seqModeActive;
    if (ss.seqModeActive) {
      ss.seqPoints = [];
      this.songState.setSeqPoints([]);
      ss.chordingActive = false;
      this.$('edSeqToggle').classList.add('active');
      this.toast(this.t('selectPointsActive'));
    } else {
      this.$('edSeqToggle').classList.remove('active');
      this.songState.setSeqPoints(ss.seqPoints);
      this.edRenderChords();
      this.edCommit();
    }
  }

  edStartSeqChording() {
    const ss = this._requireSeqState();
    if (ss.seqPoints.length === 0) { this.toast(this.t('selectPointsFirst')); return; }
    ss.seqModeActive = false; this.$('edSeqToggle').classList.remove('active');
    ss.chordingActive = true; ss.seqCursor = 0;
    this.songState.appendChords(ss.seqPoints.map(sp => ({ ...sp, name: '' })));
    this.edRenderChords();
    this.edCommit();

    this.toast(this.t('chordingStarted'));
  }

  edSeqNavigate(dir) {
    const ss = this._requireSeqState();
    if (!ss.chordingActive) return;
    ss.seqCursor = Math.max(0, Math.min(ss.seqPoints.length - 1, ss.seqCursor + dir));
    this.edRenderChords();
  }

  /* ===== Sequential: حالت کورد لاین (نقطه‌گذاری با آهنگ روی تایم لاین) ===== */

  edUpdateClCount() {
    const ss = this._requireSeqState();
    const c = this.$('edClCount'); if (c) c.textContent = ss.clMarkers.length ? String(ss.clMarkers.length) : '';
  }

  edRenderClMarkers() {
    const ss = this._requireSeqState();
    const lanes = this.$('lanes-container'); if (!lanes) return;
    let overlay = this.$('clMarkersOverlay');
    if (!overlay) { overlay = document.createElement('div'); overlay.id = 'clMarkersOverlay'; overlay.className = 'cl-markers-overlay'; lanes.appendChild(overlay); }
    overlay.innerHTML = '';
    if (!ss.clMarkers.length) { overlay.style.display = 'none'; return; }
    overlay.style.display = '';
    ss.clMarkers.forEach((m, i) => {
      const mk = document.createElement('div');
      mk.className = 'cl-tap-marker' + (ss.clTapActive ? ' armed' : '');
      mk.style.left = this.timeToX(m.time) + 'px';
      const badge = document.createElement('div');
      badge.className = 'cl-tap-badge';
      badge.textContent = i + 1;
      badge.title = 'نقطه ' + (i + 1) + ' — ' + this.formatTime(m.time) + ' (کلیک = حذف)';
      badge.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); if (i >= 0 && i < ss.clMarkers.length) { ss.clMarkers.splice(i, 1); this.edRenderClMarkers(); this.edUpdateClCount(); } });
      mk.appendChild(badge); overlay.appendChild(mk);
    });
  }

  edSetSeqMode(mode) {
    const ss = this._requireSeqState();
    ss.clMode = (mode === 'chord');
    const ly = this.$('edSeqModeLyrics'), ch = this.$('edSeqModeChord');
    if (ly) ly.classList.toggle('active', !ss.clMode);
    if (ch) ch.classList.toggle('active', ss.clMode);
    const lt = this.$('edSeqLyricsTools'), ct = this.$('edSeqChordTools');
    if (lt) lt.style.display = ss.clMode ? 'none' : '';
    if (ct) ct.style.display = ss.clMode ? '' : 'none';
    // هنگام رفتن به کورد لاین، حالت انتخاب نقطه روی متن (لایرس) را ببند
    if (ss.clMode && ss.seqModeActive) this.edToggleSeqMode();
    if (!ss.clMode) { ss.clTapActive = false; const b = this.$('edClStart'); if (b) b.classList.remove('active'); }
    this.edRenderClMarkers();
    // Open Chord Line popup when switching to chord mode
    if (ss.clMode) this.openChordLinePopup();
  }

  edToggleClTap() {
    const ss = this._requireSeqState();
    ss.clTapActive = !ss.clTapActive;
    const b = this.$('edClStart'); if (b) b.classList.toggle('active', ss.clTapActive);
    this.edRenderClMarkers(); this.edUpdateClCount();
    this.toast(ss.clTapActive ? 'نقطه‌گذاری کورد لاین فعال شد — آهنگ را پخش کن و هر بار تعویض آکورد، کلید ۰ را بزن' : 'نقطه‌گذاری متوقف شد');
  }

  edClTap() {
    const ss = this._requireSeqState();
    if (!ss.clTapActive) { this.toast('اول روی ⏺ کلیک کن تا نقطه‌گذاری با آهنگ فعال شود'); return; }
    const daw = this.getDAW();
    if (!daw || typeof daw.playhead !== 'number') return;
    const t = this.roundMs(Math.max(0, daw.playhead));
    ss.clMarkers.push({ time: t });
    this.ensureTimelineFits(t + 6);
    this.edRenderClMarkers(); this.edUpdateClCount();
  }

  edClUndoMarker() {
    const ss = this._requireSeqState();
    if (!ss.clMarkers.length) { this.toast('نقطه‌ای برای حذف نیست'); return; }
    ss.clMarkers.pop(); this.edRenderClMarkers(); this.edUpdateClCount();
  }

  edClClearMarkers() {
    const ss = this._requireSeqState();
    if (!ss.clMarkers.length) return;
    ss.clMarkers = []; this.edRenderClMarkers(); this.edUpdateClCount(); this.toast('همه نقاط پاک شد');
  }

  edClApplyMarkers() {
    const ss = this._requireSeqState();
    if (!ss.clMarkers.length) { this.toast('اول با آهنگ نقطه‌گذاری کن (دکمه ⏺ و کلید ۰)'); return; }
    const lyrics = this.songState
      .getChords()
      .filter(c => c && c.name && String(c.name).trim() !== '');
    if (lyrics.length === 0) { this.toast('آکوردی در بخش لایرس نیست تا کپی شود'); return; }
    if (lyrics.length !== ss.clMarkers.length) {
      this.toast('⚠️ تعداد آکوردهای لایرس (' + lyrics.length + ') با تعداد نقاط تایم‌لاین (' + ss.clMarkers.length + ') یکی نیست — اول تعداد را برابر کن');
      return;
    }
    const daw = this.getDAW();
    const chordTrack = daw.tracks.find(t => t.type === 'chord');
    if (!chordTrack) { this.toast('ترک کورد لاین پیدا نشد'); return; }
    // آکوردها در Song Runtime به ترتیب موسیقایی ذخیره شده‌اند (از بیت اول تا آخر)
    // Chord Line فقط جهت نمایش LTR دارد — ترتیب موسیقایی باید حفظ شود
    ss.clMarkers.forEach((m, i) => {
      daw.clips.push({ id: this.uid('c'), type: 'chord', trackId: chordTrack.id, name: lyrics[i].name, start: this.roundMs(m.time), duration: 2, color: '#9F7AEA' });
    });
    const lastT = ss.clMarkers[ss.clMarkers.length - 1].time;
    ss.clMarkers = []; ss.clTapActive = false;
    const b = this.$('edClStart'); if (b) b.classList.remove('active');
    this.edRenderClMarkers(); this.edUpdateClCount();
    this.ensureTimelineFits(lastT + 6);
    this.saveState(); this.renderAll(); this.edSaveSong();
    this.toast('✔ ' + lyrics.length + ' آکورد لایرس به کورد لاین (تایم‌لاین) کپی شد');
  }

  // Wire up sync buttons
  initSyncUI() {
    const state = this.state;
    const syncLyrics = this.$('syncLyrics');
    if (this.syncPanelWheelTarget && this.syncPanelWheelHandler) {
      this.syncPanelWheelTarget.removeEventListener(
        'wheel',
        this.syncPanelWheelHandler,
        true
      );
    }
    if (syncLyrics?.addEventListener) {
      this.syncPanelWheelTarget = syncLyrics;
      this.syncPanelWheelHandler = event => this.handleSyncPanelWheel(event);
      syncLyrics.addEventListener(
        'wheel',
        this.syncPanelWheelHandler,
        { capture: true, passive: false }
      );
    } else {
      this.syncPanelWheelTarget = null;
      this.syncPanelWheelHandler = null;
    }
    if (this.$('tab-sync')) this.$('tab-sync').onclick = () => {
      const tab = this.$('tab-sync');
      if (state.active) { this.exitSyncMode(); tab.classList.remove('active-teal'); return; }
      tab.classList.add('active-teal');
      this.enterSyncMode();
    };
    if (this.$('syncExitBtn')) this.$('syncExitBtn').onclick = () => { this.exitSyncMode(); const tab = this.$('tab-sync'); if (tab) tab.classList.remove('active-teal'); };
    if (this.$('syncPlayBtn')) this.$('syncPlayBtn').onclick = () => {
      if (this.getDAW().isPlaying) { this.pauseTransport(); this.$('syncPlayBtn').textContent = this.t('syncPlay'); } else { this.startTransport(); this.$('syncPlayBtn').textContent = this.t('syncPause'); }
    };
    if (this.$('syncTapBtn')) this.$('syncTapBtn').onclick = () => this.syncTap();
    if (this.$('syncMinus')) this.$('syncMinus').onclick = () => {
      this.adjustSyncTime(state.cursor, -0.5);
    };
    if (this.$('syncPlus')) this.$('syncPlus').onclick = () => {
      this.adjustSyncTime(state.cursor, 0.5);
    };
    if (this.$('syncDelBtn')) this.$('syncDelBtn').onclick = () => {
      const times = this.songState.getSyncTimes();
      state.history.push(JSON.stringify(times)); state.redoHistory = [];
      this.songState.setSyncTime(state.cursor, undefined);
      this.renderSyncLyrics(); this.edSaveSong();
    };
    if (this.$('syncResetBtn')) this.$('syncResetBtn').onclick = () => {
      if (!confirm('تمام زمان‌های سینک پاک شود؟')) return;
      state.history.push(JSON.stringify(this.songState.getSyncTimes())); state.redoHistory = [];
      this.songState.replaceSyncTimes([]); state.cursor = 0;
      this.renderSyncLyrics(); this.edSaveSong();
    };
    if (this.$('syncUndoBtn')) this.$('syncUndoBtn').onclick = () => {
      if (!state.history.length) return;
      state.redoHistory.push(JSON.stringify(this.songState.getSyncTimes()));
      this.songState.replaceSyncTimes(JSON.parse(state.history.pop()));
      this.renderSyncLyrics(); this.edSaveSong();
    };
    if (this.$('syncRedoBtn')) this.$('syncRedoBtn').onclick = () => {
      if (!state.redoHistory.length) return;
      state.history.push(JSON.stringify(this.songState.getSyncTimes()));
      this.songState.replaceSyncTimes(JSON.parse(state.redoHistory.pop()));
      this.renderSyncLyrics(); this.edSaveSong();
    };
    if (this.$('syncTimeline')) this.$('syncTimeline').onclick = (e) => {
      const rect = this.$('syncTimeline').getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.seekTransport(ratio * this.getProjectEnd(), true);
      this.updateSyncHighlight();
    };
  }
}

if (typeof window !== 'undefined') {
  window.SyncModeController = SyncModeController;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncModeController;
}
