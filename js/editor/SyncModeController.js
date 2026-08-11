/**
 * SyncModeController — کنترلر حالت Sync (اتصال خطوط ترانه به زمان)
 *
 * استخراج‌شده از app.js در Commit 2a برنامهٔ Editor Domain Extraction.
 *
 * این کنترلر مالک state نیست؛ state اصلی (syncActive، syncCursor، syncHistory و…)
 * همچنان به‌صورت let در app.js باقی است — چون خوانندگان خارجی (tick حمل‌ونقل،
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
    getEdCur,
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
    logger = console
  } = {}) {
    if (!state) {
      throw new TypeError('SyncModeController requires a state accessor object');
    }
    if (!DAW) {
      throw new TypeError('SyncModeController requires the DAW reference');
    }
    if (typeof getEdCur !== 'function') {
      throw new TypeError('SyncModeController requires getEdCur');
    }
    if (typeof $ !== 'function') {
      throw new TypeError('SyncModeController requires $');
    }

    this.state = state;
    this.DAW = DAW;
    this.getEdCur = getEdCur;
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

    this.logger = logger || console;
  }

  formatSyncTime(t) {
    if (!Number.isFinite(t)) return '--:--.-';
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(4, '0')}`;
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
    d.onclick = () => this.selectSyncLine(li);

    return d;
  }

  renderSyncLyrics() {
    const box = this.$('syncLyrics');
    if (!box) return;

    const edCur = this.getEdCur();
    const lines = (edCur?.lyrics || '').split('\n');
    const times = edCur?.syncTimes || [];
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
        row.onclick = () => this.selectSyncLine(li);
      }

      const textEl = row.querySelector('.s-text');
      const timeEl = row.querySelector('.s-time');

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
    if (li < 0) li = 0;
    this.state.cursor = li;

    const rows = document.querySelectorAll('#syncLyrics .sline');
    let selectedEl = null;

    rows.forEach(el => {
      const isSel = (+el.dataset.li === li);
      if (el.classList.contains('selected') !== isSel) {
        el.classList.toggle('selected', isSel);
      }
      if (isSel) selectedEl = el;
    });

    if (selectedEl) {
      selectedEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }

    const edCur = this.getEdCur();
    const total = (edCur?.lyrics || '').split('\n').length;
    const info = this.$('syncInfo');
    if (info) {
      info.textContent = `${this.t('linesOf')} ${li + 1} ${this.t('lineOf')} ${total}`;
    }
  }

  syncTap() {
    const state = this.state;
    if (!state.active) return;
    const edCur = this.getEdCur();
    const lines = (edCur?.lyrics || '').split('\n');
    if (state.cursor >= lines.length) return;
    const t = this.DAW.playhead;
    state.history.push(JSON.stringify(edCur?.syncTimes || []));
    state.redoHistory = [];
    if (!edCur.syncTimes) edCur.syncTimes = [];
    edCur.syncTimes[state.cursor] = t;
    // Skip empty lines
    let next = state.cursor + 1;
    while (next < lines.length && !lines[next].trim()) { edCur.syncTimes[next] = t; next++; }
    state.cursor = next;
    this.renderSyncLyrics();
    if (state.cursor >= lines.length) {
      // اصلاح عمدی نسبت به نسخهٔ legacy: در app.js متغیر محلی `t` (عدد playhead)
      // تابع i18n را shadow می‌کرد و فراخوانی t('syncFinished') خطای
      // TypeError می‌داد؛ بنابراین مسیر پایان sync هرگز toast/save را کامل نمی‌کرد.
      // اینجا this.t (i18n واقعی) استفاده می‌شود. — ثبت در گزارش روند، Commit 2a.
      this.toast(this.t('syncFinished'));
      if (this.DAW.isPlaying) this.pauseTransport();
    }
    this.edSaveSong();
  }

  updateSyncHighlight() {
    const t = this.DAW.playhead;
    const edCur = this.getEdCur();
    const times = edCur?.syncTimes || [];
    let activeLi = -1;

    for (let i = 0; i < times.length; i++) {
      const tm = times[i];
      if (Number.isFinite(tm) && tm <= t) {
        activeLi = i;
      } else if (Number.isFinite(tm) && tm > t) {
        break;
      }
    }

    // === Performance Architecture v2: sync playback + highlight to Store ===
    if (typeof PerformanceStore !== 'undefined' && typeof SharedEngine !== 'undefined' && typeof _songDocument !== 'undefined' && _songDocument) {
      PerformanceStore.setPlaybackState({ time: t, isPlaying: !!this.DAW.isPlaying });
      const hl = SharedEngine.computeHighlight(PerformanceStore.getState().playbackState, _songDocument);
      PerformanceStore.setHighlightState(hl);
    }

    // اگر خط فعال عوض نشده، فقط در صورت نیاز تایم/پروگرس پنل را آپدیت کن
    const changed = activeLi !== this.state.lastActiveLi;
    this.state.lastActiveLi = activeLi;

    // Highlight lines in main editor
    const editorEl = this.$('editor');
    if (editorEl) {
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
      document.querySelectorAll('#syncLyrics .sline').forEach(el => {
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

      const total = this.getProjectEnd();
      if (total > 0) {
        const fill = this.$('syncTimelineFill');
        if (fill) fill.style.width = (t / total * 100) + '%';
      }

      const curTime = this.$('syncCurTime');
      if (curTime) curTime.textContent = this.formatSyncTime(t);
    }

    // Sync highlight to popup windows (direct DOM update, not postMessage)
    const lyricPopup = this.getLyricPopup();
    if (lyricPopup && !lyricPopup.closed && lyricPopup._syncHighlight) {
      lyricPopup._syncHighlight();
    }
    const lyricOnlyPopup = this.getLyricOnlyPopup();
    if (lyricOnlyPopup && !lyricOnlyPopup.closed && lyricOnlyPopup._syncHighlight) {
      lyricOnlyPopup._syncHighlight();
    }
    const chordLinePopup = this.getChordLinePopup();
    if (chordLinePopup && !chordLinePopup.closed && chordLinePopup._syncHighlight) {
      chordLinePopup._syncHighlight();
    }
  }

  // Sync tick loop
  syncTick() {
    if (!this.state.active) return;

    this.updateSyncHighlight();
    this.state.watch = requestAnimationFrame(() => this.syncTick());
  }

  enterSyncMode() {
    const state = this.state;
    state.active = true;
    state.cursor = 0;
    const edCur = this.getEdCur();
    const lines = (edCur?.lyrics || '').split('\n');
    while (state.cursor < lines.length && !lines[state.cursor].trim()) state.cursor++;
    if (state.cursor >= lines.length) state.cursor = 0;
    if (!edCur.syncTimes) edCur.syncTimes = [];
    state.history = []; state.redoHistory = [];
    this.renderSyncLyrics();
    this.$('syncSection').classList.add('show');
    // Add Space key handler for sync tap
    state.tapKeyHandler = (e) => {
      if (e.code === 'Space' && e.ctrlKey && state.active && !e.target.closest('input,textarea,[contenteditable]')) {
        e.preventDefault(); this.syncTap();
      }
    };
    window.addEventListener('keydown', state.tapKeyHandler);
    // Start highlight tick
    this.syncTick();
  }

  exitSyncMode() {
    const state = this.state;
    state.active = false;
    this.$('syncSection').classList.remove('show');
    if (state.tapKeyHandler) { window.removeEventListener('keydown', state.tapKeyHandler); state.tapKeyHandler = null; }
    if (state.watch) { cancelAnimationFrame(state.watch); state.watch = null; }
    this.edSaveSong();
  }

  // Wire up sync buttons
  initSyncUI() {
    const state = this.state;
    const edCurRef = () => this.getEdCur();
    if (this.$('tab-sync')) this.$('tab-sync').onclick = () => {
      const tab = this.$('tab-sync');
      if (state.active) { this.exitSyncMode(); tab.classList.remove('active-teal'); return; }
      tab.classList.add('active-teal');
      this.enterSyncMode();
    };
    if (this.$('syncExitBtn')) this.$('syncExitBtn').onclick = () => { this.exitSyncMode(); const tab = this.$('tab-sync'); if (tab) tab.classList.remove('active-teal'); };
    if (this.$('syncPlayBtn')) this.$('syncPlayBtn').onclick = () => {
      if (this.DAW.isPlaying) { this.pauseTransport(); this.$('syncPlayBtn').textContent = this.t('syncPlay'); } else { this.startTransport(); this.$('syncPlayBtn').textContent = this.t('syncPause'); }
    };
    if (this.$('syncTapBtn')) this.$('syncTapBtn').onclick = () => this.syncTap();
    if (this.$('syncMinus')) this.$('syncMinus').onclick = () => {
      const edCur = edCurRef();
      if (!edCur?.syncTimes) return;
      state.history.push(JSON.stringify(edCur.syncTimes)); state.redoHistory = [];
      let t = edCur.syncTimes[state.cursor]; if (!Number.isFinite(t)) t = this.DAW.playhead;
      edCur.syncTimes[state.cursor] = Math.max(0, t - 0.1); this.renderSyncLyrics(); this.edSaveSong();
    };
    if (this.$('syncPlus')) this.$('syncPlus').onclick = () => {
      const edCur = edCurRef();
      if (!edCur?.syncTimes) return;
      state.history.push(JSON.stringify(edCur.syncTimes)); state.redoHistory = [];
      let t = edCur.syncTimes[state.cursor]; if (!Number.isFinite(t)) t = this.DAW.playhead;
      edCur.syncTimes[state.cursor] = t + 0.1; this.renderSyncLyrics(); this.edSaveSong();
    };
    if (this.$('syncDelBtn')) this.$('syncDelBtn').onclick = () => {
      const edCur = edCurRef();
      if (!edCur?.syncTimes) return;
      state.history.push(JSON.stringify(edCur.syncTimes)); state.redoHistory = [];
      edCur.syncTimes[state.cursor] = undefined; this.renderSyncLyrics(); this.edSaveSong();
    };
    if (this.$('syncResetBtn')) this.$('syncResetBtn').onclick = () => {
      if (!confirm('تمام زمان‌های سینک پاک شود؟')) return;
      const edCur = edCurRef();
      state.history.push(JSON.stringify(edCur?.syncTimes || [])); state.redoHistory = [];
      edCur.syncTimes = []; state.cursor = 0; this.renderSyncLyrics(); this.edSaveSong();
    };
    if (this.$('syncUndoBtn')) this.$('syncUndoBtn').onclick = () => {
      if (!state.history.length) return;
      const edCur = edCurRef();
      state.redoHistory.push(JSON.stringify(edCur?.syncTimes || []));
      edCur.syncTimes = JSON.parse(state.history.pop()); this.renderSyncLyrics(); this.edSaveSong();
    };
    if (this.$('syncRedoBtn')) this.$('syncRedoBtn').onclick = () => {
      if (!state.redoHistory.length) return;
      const edCur = edCurRef();
      state.history.push(JSON.stringify(edCur?.syncTimes || []));
      edCur.syncTimes = JSON.parse(state.redoHistory.pop()); this.renderSyncLyrics(); this.edSaveSong();
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
