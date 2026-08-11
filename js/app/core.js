console.log("!!! APP_JS_LOADED_FROM_DISK !!!");
// ==========================================
// PART 1: Initialization & Electron Setup
// ==========================================
// ─── تشخیص صحیح محیط الکترون ───
// قبلاً از process.versions.electron استفاده می‌شد که با contextIsolation:true
// در دسترس نیست. حالا از window.electronAPI (که preload.js ست می‌کنه) استفاده می‌کنیم.
const isElectron = !!(typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron) ||
                   (typeof process !== 'undefined' && process.versions && !!process.versions.electron);
// fs و path در renderer با contextIsolation:true در دسترس نیستن.
// به‌جاش از window.electronAPI استفاده می‌کنیم که IPC handlers رو فراهم می‌کنه.
const fs = null; // استفاده نمی‌شه — به‌جاش از window.electronAPI.checkFileExists و readAudioFile استفاده می‌کنیم
const path = null; // استفاده نمی‌شه — به‌جاش از window.electronAPI.resolvePath و getProjectDir استفاده می‌کنیم

if (isElectron) {
  console.log('[App] Electron mode detected. electronAPI available:', !!window.electronAPI);
} else {
  console.log('[App] Browser mode detected.');
}


// ==========================================
// PART 2: Audio Import & Hard Drive Auto-Load
// ==========================================
// منطق loadAudioFromHardDrive / pathDirname / pathJoin / handleAudioImport /
// loadProject / resolveClipAudio به js/core/ProjectAudioService.js منتقل شده است.
// wrapperهای سازگاری بلافاصله بعد از ensureAudioCtx() تعریف شده‌اند.

/**
 * customPrompt — جایگزین window.prompt که در الکترون پشتیبانی نمی‌شه
 *
 * @param {string} message - پیام به کاربر
 * @param {string} defaultValue - مقدار پیش‌فرض
 * @returns {Promise<string|null>} - مقدار وارد شده یا null اگه کنسل بشه
 */
function customPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('customPromptModal');
    const titleEl = document.getElementById('customPromptTitle');
    const inputEl = document.getElementById('customPromptInput');
    const okBtn = document.getElementById('customPromptOk');
    const cancelBtn = document.getElementById('customPromptCancel');

    if (!modal || !inputEl || !okBtn || !cancelBtn) {
      // fallback به window.prompt اگه مودال موجود نبود
      resolve(window.prompt(message, defaultValue));
      return;
    }

    if (titleEl) titleEl.textContent = message;
    inputEl.value = defaultValue;

    modal.style.display = 'flex';
    setTimeout(() => { inputEl.focus(); inputEl.select(); }, 50);

    const cleanup = () => {
      modal.style.display = 'none';
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      inputEl.onkeydown = null;
    };

    okBtn.onclick = () => {
      const val = inputEl.value;
      cleanup();
      resolve(val);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); okBtn.click(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
    };
  });
}
if (typeof window !== 'undefined') window.customPrompt = customPrompt;

// تشخیص محیط مرورگر/پنجره الکترون
const isBrowser = typeof window !== 'undefined';

// تعریف ایمن DAW جهت جلوگیری از خطای window is not defined
const globalScope = isBrowser ? window : global;

globalScope.DAW = {
  audioContext: isBrowser ? new (window.AudioContext || window.webkitAudioContext)() : null,
  tracks: [],
  projectDuration: 0,
  selectedSectionIds: new Set(),
  player: null
};
    /* ===== I18N ===== */
    let currentLang = localStorage.getItem('appLang') || 'fa';
    const I18N = {
      fa: {
        project: 'پروژه', archive: 'آرشیو آهنگ\u200Cها', newSong: 'ترانه جدید', saveSong: 'ذخیره ترانه', arranger: 'ارنجر ترک', print: 'چاپ',
        brand: 'ترانه آکورد', major: 'ماژور', minor: 'مینور', textLabel: 'متن:', chordLabel: 'آکورد:', seqLabel: 'ترتیبی:',
        settings: 'تنظیمات', artist: 'خواننده', artistPlaceholder: 'نام خواننده', songTitle: 'نام ترانه', songTitlePlaceholder: 'نام ترانه', playTime: 'زمان پخش',
        interactiveSwitches: 'سوئیچ\u200Cهای تعاملی', manualSync: '🔗 سینک دستی (لاین گاید)', midiCtrl: '🎹 میدی کنترلر (MIDI)',
        close: 'بستن', play: 'پخش', tapLine: '👆 ثبت این خط (Ctrl+Space)', deleteTime: '🗑 حذف زمان', reset: '↺ ریست',
        start: 'ابتدا', pause: 'مکث', stop: 'توقف', end: 'انتها', fullscreenPopup: 'پنجره جداگانه تمام صفحه',
        untitled: 'بدون نام', chordEditor: 'ویرایشگر آکورد (Chord Assistant)', cancel: 'انصراف', delete: '🗑 حذف', confirm: 'ثبت',
        manualType: 'تایپ دستی:', placeOnTimeline: 'ثبت روی تایم\u200Cلاین', editSongChord: 'ویرایش آکورد ترانه', confirmBtn: 'تأیید',
        archiveTitle: '📂 آرشیو آهنگ\u200Cها', archiveSearch: 'جستجوی خواننده یا نام ترانه...', arrangerTitle: '🎼 ارنجر ترک',
        arrangerName: 'نام پلی‌لیست', saveName: 'ذخیره', save: 'ذخیره', export: 'اکسپورت', perform: 'اجرا', closeEditor: 'بستن',
        availableSongs: 'آهنگ\u200Cهای موجود', setlist: 'ست\u200Cلیست (بکش یا ↑↓)', newAudioLine: '＋ خط صوتی جدید', tracks: 'TRACKS',
        zoom: 'Zoom', split: '✂ Split', cut: '✂ Cut', copy: '⧉ Copy', paste: '📋 Paste', delClip: '🗑 Delete',
        noArranger: 'هنوز ارنجری نساخته\u200Cاید.', newArranger: '+ ارنجر جدید', edit: '✏️ ویرایش', load: 'بارگذاری',
        noSongs: 'ترانه\u200Cای ذخیره نشده', allInSetlist: 'همه آهنگ\u200Cها در ست\u200Cلیست\u200Cاند.', addFromLeft: 'از ستون چپ آهنگ اضافه کنید.',
        clickHint: 'کلیک = ویرایشگر | دابل\u200Cکلیک روی آکورد = ویرایش', loadHint: 'کلیک اسم لاین = لود',
        nothingUndo: 'عملی برای Undo وجود ندارد', nothingRedo: 'عملی برای Redo وجود ندارد',
        selectCompleteChord: 'لطفا یک آکورد کامل انتخاب کنید', chordEditedTo: 'آکورد ویرایش شد به', chordPlaced: 'آکورد روی لاین قرار گرفت',
        newTrackAdded: 'لاین جدید اضافه شد', decoding: 'در حال decode صدا...', loadedOk: 'لود OK:', loadFailed: 'لود ناموفق',
        nothingSelected: 'چیزی انتخاب نشده', deleted: 'حذف شد', clipsCopied: 'کلیپ کپی شد', cutDone: 'کات شد',
        clipboardEmpty: 'کلیپ\u200Cبورد خالی است', pastedAtPlayhead: 'پیست روی پلی\u200Cهد', splitDone: 'Split انجام شد',
        noClipToCut: 'در این نقطه کلیپی برای Cut نبود', clipsCut: 'Cut: کلیپ',
        syncFinished: 'سینک به پایان رسید!', selectPointsActive: 'حالت انتخاب نقاط فعال — روی متن کلیک کنید',
        selectPointsFirst: 'اول نقاط را انتخاب کنید', chordingStarted: 'آکوردگذاری شروع شد — با MIDI بزنید',
        emptySetlist: 'ست\u200Cلیست خالی است', arrangerStarted: 'ارنجر شروع شد — هر ترانه بعد از اتمام پخش، بعدی لود میشه',
        arrangerFinished: 'ارنجر تمام شد', focusMode: 'حالت تمرکز — فقط متن ترانه', normalMode: 'حالت عادی',
        popupBlocked: 'پاپ\u200Cآپ بلاک شد — اجازه پاپ\u200Cآپ را فعال کنید', midiConnected: 'MIDI متصل شد. کیبورد را بزنید...',
        midiError: 'خطا در اتصال MIDI', midiNotSupported: 'مرورگر از MIDI پشتیبانی نمی\u200Cکند', midiDisconnected: 'MIDI قطع شد',
        dawReady: 'DAW آماده است! Alt+Scroll = زوم | Shift+Click = Split | L = Loop',
        chordRecOn: 'ضبط آکورد روشن! کیبورد میدی را بزنید', chordRecOff: 'ضبط آکورد خاموش',
        chordDone: 'آکوردگذاری تمام شد', songN: 'ترانه', lineOf: 'خط', linesOf: 'خط از',
        syncExit: '◀ بستن', syncPlay: '▶ پخش', syncPause: '⏸ توقف',
        
      },
      en: {
        project: 'Project', archive: 'Song Archive', newSong: 'New Song', saveSong: 'Save Song', arranger: 'Track Arranger', print: 'Print',
        brand: 'Chord Song', major: 'Major', minor: 'Minor', textLabel: 'Text:', chordLabel: 'Chord:', seqLabel: 'Seq:',
        settings: 'Settings', artist: 'Artist', artistPlaceholder: 'Artist name', songTitle: 'Song Title', songTitlePlaceholder: 'Song name', playTime: 'Play Time',
        interactiveSwitches: 'Interactive Switches', manualSync: '🔗 Manual Sync (Line Guide)', midiCtrl: '🎹 MIDI Controller',
        close: 'Close', play: 'Play', tapLine: '👆 Tap This Line (Ctrl+Space)', deleteTime: '🗑 Delete Time', reset: '↺ Reset',
        start: 'Start', pause: 'Pause', stop: 'Stop', end: 'End', fullscreenPopup: 'Fullscreen Popup Window',
        untitled: 'Untitled', chordEditor: 'Chord Editor (Chord Assistant)', cancel: 'Cancel', delete: '🗑 Delete', confirm: 'Confirm',
        manualType: 'Manual type:', placeOnTimeline: 'Place on Timeline', editSongChord: 'Edit Song Chord', confirmBtn: 'OK',
        archiveTitle: '📂 Song Archive', archiveSearch: 'Search artist or song name...', arrangerTitle: '🎼 Track Arranger',
        arrangerName: 'Playlist name', saveName: 'Save', save: 'Save', export: 'Export', perform: 'Perform', closeEditor: 'Close',
        availableSongs: 'Available Songs', setlist: 'Setlist (drag or ↑↓)', newAudioLine: '＋ New Audio Line', tracks: 'TRACKS',
        zoom: 'Zoom', split: '✂ Split', cut: '✂ Cut', copy: '⧉ Copy', paste: '📋 Paste', delClip: '🗑 Delete',
        noArranger: 'No arranger created yet.', newArranger: '+ New Arranger', edit: '✏️ Edit', load: 'Load',
        noSongs: 'No songs saved', allInSetlist: 'All songs are in the setlist.', addFromLeft: 'Add songs from the left column.',
        clickHint: 'Click = Editor | Double-click chord = Edit', loadHint: 'Click track name = Load',
        nothingUndo: 'Nothing to Undo', nothingRedo: 'Nothing to Redo',
        selectCompleteChord: 'Please select a complete chord', chordEditedTo: 'Chord edited to', chordPlaced: 'Chord placed on line',
        newTrackAdded: 'New track added', decoding: 'Decoding audio...', loadedOk: 'Loaded OK:', loadFailed: 'Load failed',
        nothingSelected: 'Nothing selected', deleted: 'Deleted', clipsCopied: 'clips copied', cutDone: 'Cut',
        clipboardEmpty: 'Clipboard is empty', pastedAtPlayhead: 'Pasted at playhead', splitDone: 'Split done',
        noClipToCut: 'No clip to cut at this point', clipsCut: 'Cut: clips',
        syncFinished: 'Sync finished!', selectPointsActive: 'Point selection active — click on text',
        selectPointsFirst: 'Select points first', chordingStarted: 'Chording started — play MIDI',
        emptySetlist: 'Setlist is empty', arrangerStarted: 'Arranger started — next song loads after current finishes',
        arrangerFinished: 'Arranger finished', focusMode: 'Focus mode — lyrics only', normalMode: 'Normal mode',
        popupBlocked: 'Popup blocked — please allow popups', midiConnected: 'MIDI connected. Play your keyboard...',
        midiError: 'MIDI connection error', midiNotSupported: 'Browser doesn\'t support MIDI', midiDisconnected: 'MIDI disconnected',
        dawReady: 'DAW ready! Alt+Scroll = Zoom | Shift+Click = Split | L = Loop',
        chordRecOn: 'Chord recording ON! Play MIDI keyboard', chordRecOff: 'Chord recording OFF',
        chordDone: 'Chording complete', songN: 'Song', lineOf: 'of', linesOf: 'line of',
        syncExit: '◀ Close', syncPlay: '▶ Play', syncPause: '⏸ Pause',
      }
    };
    function t(key) { return I18N[currentLang]?.[key] || I18N['fa']?.[key] || key; }
    function applyI18n() {
      document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (k) el.textContent = t(k); });
      document.querySelectorAll('[data-i18n-title]').forEach(el => { const k = el.getAttribute('data-i18n-title'); if (k) el.title = t(k); });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const k = el.getAttribute('data-i18n-placeholder'); if (k) el.placeholder = t(k); });
      document.documentElement.dir = currentLang === 'fa' ? 'rtl' : 'ltr';
      document.documentElement.lang = currentLang;
      // Update dynamic elements
      if ($('edPrintTitle')) $('edPrintTitle').textContent = edCur?.title || t('untitled');
      const syncPlayBtn = $('syncPlayBtn');
      if (syncPlayBtn) syncPlayBtn.textContent = DAW.isPlaying ? t('syncPause') : t('syncPlay');
    }
    // ===== MIDI MONITOR =====
    let midiMonitorAutoScroll = true;
    const midiMsgTypes = {
      0x80: 'Note Off', 0x90: 'Note On', 0xA0: 'Aftertouch',
      0xB0: 'Control', 0xC0: 'Program', 0xD0: 'Channel', 0xE0: 'Pitch',
      0xF0: 'SysEx', 0xF1: 'MTC', 0xF8: 'Clock', 0xFA: 'Start', 0xFC: 'Stop', 0xFB: 'Continue', 0xFE: 'ActiveSense'
    };
    const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

    function toggleMidiMonitor() {
      const mon = $('midiMonitor');
      mon.classList.toggle('show');
    }

    function logMidiMsg(dir, msg) {
      const body = $('midiMonitorBody');
      if (!body) return;
      const status = msg[0] & 0xF0;
      const channel = msg[0] & 0x0F;
      const type = midiMsgTypes[status] || midiMsgTypes[msg[0]] || 'Unknown';
      const hex = [...msg].map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

      let detail = '';
      if (status === 0x90 && msg[2] > 0) {
        const noteName = noteNames[msg[1] % 12] + (Math.floor(msg[1] / 12) - 1);
        detail = `${noteName} vel:${msg[2]}`;
      } else if (status === 0x80 || (status === 0x90 && msg[2] === 0)) {
        const noteName = noteNames[msg[1] % 12] + (Math.floor(msg[1] / 12) - 1);
        detail = `${noteName} off`;
      } else if (status === 0xB0) {
        detail = `CC${msg[1]} val:${msg[2]}`;
      } else if (status === 0xC0) {
        detail = `prog:${msg[1]}`;
      } else if (msg[0] === 0xFA) detail = '▶ START';
      else if (msg[0] === 0xFC) detail = '⏹ STOP';
      else if (msg[0] === 0xFB) detail = '⏯ CONTINUE';
      else if (msg[0] === 0xF8) detail = '⏱ CLOCK';

      const now = new Date();
      const time = now.toLocaleTimeString('fa', { hour12: false });

      const div = document.createElement('div');
      div.className = 'midi-msg';
      const dirClass = dir === 'IN' ? 'in' : dir === 'OUT' ? 'out' : 'sys';
      div.innerHTML = `<span class="dir ${dirClass}">${dir}</span><span class="data">${type} ch${channel} ${detail}</span><span class="time">${hex}</span>`;
      body.appendChild(div);

      // Keep max 200 messages
      while (body.children.length > 200) body.removeChild(body.firstChild);
      if (midiMonitorAutoScroll) body.scrollTop = body.scrollHeight;
    }

    function clearMidiLog() { $('midiMonitorBody').innerHTML = ''; }

    function toggleMidiMonitorAutoScroll() {
      midiMonitorAutoScroll = !midiMonitorAutoScroll;
    }

    // Update MIDI monitor on every message
    function updateMidiMonitor(msg) {
      logMidiMsg('IN', msg);
    }

    function updateMidiMonitorOut(msg) {
      logMidiMsg('OUT', msg);
    }

    // Update status dot
    function updateMidiStatusDot() {
      const dot = $('midiStatusDot');
      if (dot) {
        dot.className = 'midi-status-dot ' + (midiAccess ? 'connected' : 'disconnected');
      }
    }

    // Update chord display in monitor
    function updateMidiChordDisplay(name, notes) {
      const info = $('midiChordInfo');
      const nameEl = $('midiChordName');
      const notesEl = $('midiChordNotes');
      if (info && nameEl && name) {
        info.style.display = 'block';
        nameEl.textContent = name;
        notesEl.textContent = notes || '';
      }
    }
    let metroActive = false, metroTimer = null, metroBeat = 0;
    let countInBars = 0; // 0=off, 1=1 bar, 2=2 bars before playback
    // ===== SNAP TO GRID =====
    let snapEnabled = true;
    let snapValue = 0.25; // seconds (default: 1/4 beat)

    /**
     * getTimeSignatureGridConfig - تبدیل Time Signature به مشخصات گرید
     * @param {string} timeSignature - رشته Time Signature مثل '4/4', '3/4', '6/8'
     * @returns {object} شامل numerator, denominator, beatUnit, beatsPerMeasure, subdivisionsPerBeat, unitsPerMeasure, measureDuration, beatDuration
     */
    function getTimeSignatureGridConfig(timeSignature, bpm) {
      return TimelineGrid.getTimeSignatureGridConfig(timeSignature, bpm || 120);
    }

    // Safe bridge: app.js keeps transport/audio/DOM ownership while the
    // extracted engine tracks beat transitions. The legacy path remains as a
    // fallback for backward compatibility.
    const metronomeEngineBridge =
      typeof window.MetronomeEngine === 'function' &&
      window.Meter &&
      typeof window.Meter.isStrongBeat === 'function'
        ? new window.MetronomeEngine({
            getMeterConfig: getTimeSignatureGridConfig,
            isStrongBeat: window.Meter.isStrongBeat
          })
        : null;

    // Safe bridge for AudioContextService: app.js keeps DAW.audioCtx ownership
    // while the extracted service synthesises the metronome click. The legacy
    // path remains as a fallback for backward compatibility.
    const audioContextServiceBridge =
      typeof window.AudioContextService === 'function'
        ? new window.AudioContextService()
        : null;

    // Safe bridge for MetronomeScheduler: the look-ahead scheduler reserves
    // metronome clicks ahead of time in audioCtx.currentTime, decoupling them
    // from the RAF transport loop (fixes stutter during zoom/scroll).
    let metronomeSchedulerBridge = null;
    function getMetronomeSchedulerBridge() {
      if (metronomeSchedulerBridge) return metronomeSchedulerBridge;
      if (
        typeof window.MetronomeScheduler !== 'function' ||
        !audioContextServiceBridge
      ) return null;
      metronomeSchedulerBridge = new window.MetronomeScheduler({
        audioContextService: audioContextServiceBridge,
        metronomeEngine: metronomeEngineBridge,
        getMeterConfig: getTimeSignatureGridConfig,
        isStrongBeat: window.Meter && typeof window.Meter.isStrongBeat === 'function'
          ? window.Meter.isStrongBeat
          : () => false
      });
      return metronomeSchedulerBridge;
    }

    function toggleSnap() {
      snapEnabled = !snapEnabled;
      $('snapBtn').classList.toggle('active', snapEnabled);
      toast(snapEnabled ? 'اسنپ فعال شد' : 'اسنپ غیرفعال شد');
    }

    function snapTime(time) {
      if (!snapEnabled) return time;
      // Snap to nearest grid point using snapValue set by applyQuantize
      return Math.round(time / snapValue) * snapValue;
    }

    // ===== QUANTIZE =====
    function showQuantizeModal() {
      $('quantizeModal').classList.toggle('show');
    }

    function applyQuantize(preset) {
      const bpm = edCur?.tempo || 120;
      const sig = edCur?.timeSignature || '4/4';
      const config = getTimeSignatureGridConfig(sig, bpm);
      const beatDur = config.beatDuration; // مدت واحد مخرج (سیاه در x/4، چنگ در x/8)
      const barDur = config.measureDuration; // مدت زمان یک میزان بر اساس Time Signature فعال

      switch(preset) {
        case '1/1': snapValue = barDur; break;           // 1 bar (بر اساس Time Signature فعال)
        case '1/2': snapValue = barDur / 2; break;       // half bar
        case '1/4': snapValue = beatDur; break;          // 1 beat
        case '1/8': snapValue = beatDur / 2; break;      // half beat
        case '1/16': snapValue = beatDur / 4; break;     // quarter beat
        case '1/32': snapValue = beatDur / 8; break;     // 1/8 beat
        case 'triplet': snapValue = beatDur / 3; break;
        case 'dotted': snapValue = beatDur * 1.5; break;
        default: snapValue = beatDur;
      }

      // Update UI
      document.querySelectorAll('.q-preset').forEach(el => el.classList.remove('active'));
      event.target.closest('.q-preset').classList.add('active');
      snapEnabled = true;
      $('snapBtn').classList.add('active');

      toast(`کوانتایز: ${preset} (${(snapValue * 1000).toFixed(0)}ms)`);
      $('quantizeModal').classList.remove('show');
    }

    // Close quantize modal on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#quantizeModal') && !e.target.closest('[onclick="showQuantizeModal()"]')) {
        $('quantizeModal')?.classList.remove('show');
      }
    });

    /**
     * quantizeSelectedChords — کوانتایز آکوردهای انتخاب‌شده در کورد لاین
     *
     * آکوردهای انتخاب‌شده (DAW.selectedIds) را بر اساس پریست کوانتایز فعلی
     * (snapValue) به نزدیک‌ترین نقطه گرید می‌چسباند.
     *
     * مثال:
     *   - پریست 1/1 (یک میزان): آکوردها به ابتدای میزان می‌چسبند
     *   - پریست 1/2 (نیم میزان): آکوردها به نزدیک‌ترین خط نیم میزان می‌چسبند
     *   - پریست 1/4 (یک ضرب): آکوردها به نزدیک‌ترین ضرب می‌چسبند
     *   - و ...
     */
    function quantizeSelectedChords() {
      // فقط کلیپ‌های آکورد (chord) را انتخاب کن
      const selectedChordClips = DAW.clips.filter(c => c.type === 'chord' && DAW.selectedIds.has(c.id));
      if (selectedChordClips.length === 0) {
        toast('آکوردی در کورد لاین انتخاب نشده است');
        return;
      }

      const bpm = edCur?.tempo || 120;
      const sig = edCur?.timeSignature || '4/4';
      const config = getTimeSignatureGridConfig(sig, bpm);
      const beatsPerBar = config.beatsPerMeasure;
      const beatDur = config.beatDuration; // مدت واحد مخرج (سیاه در x/4، چنگ در x/8)
      const barDur = config.measureDuration;

      // محاسبه گام گرید بر اساس پریست فعلی
      // snapValue در applyQuantize تنظیم می‌شود (مثلاً 1/1 = barDur، 1/2 = barDur/2، 1/4 = beatDur)
      let gridStep = snapValue;
      if (!gridStep || gridStep <= 0) gridStep = beatDur;

      // برای هر آکورد انتخاب‌شده، start را به نزدیک‌ترین نقطه گرید بچسبان
      let quantizedCount = 0;
      selectedChordClips.forEach(clip => {
        const origStart = clip.start;
        // گرد کردن به نزدیک‌ترین مضرب gridStep
        const snapped = Math.round(origStart / gridStep) * gridStep;
        // جلوگیری از منفی شدن
        clip.start = roundMs(Math.max(0, snapped));
        if (Math.abs(clip.start - origStart) > 0.001) quantizedCount++;
      });

      if (quantizedCount > 0) {
        saveState();
        renderClips();
        renderRuler();
        toast(`کوانتایز شد: ${quantizedCount} آکورد`);
      } else {
        toast('آکوردها از قبل روی گرید هستند');
      }
    }

    function toggleMetronome() {
      metroActive = !metroActive;
      $('metroToggleBtn').textContent = metroActive ? '🔊' : '🔇';
      if (metroActive && DAW.isPlaying) startMetronome();
      else stopMetronome();
    }
    function startMetronome() {
      stopMetronome();
      const _mbpm = parseInt($('edTempo')?.value) || 120;
      const _msig = $('edTimeSig')?.value || '4/4';
      // Look-ahead scheduler: reserves clicks ahead of time in audioCtx.currentTime.
      // This decouples metronome timing from the RAF loop (fixes zoom/scroll stutter).
      const scheduler = getMetronomeSchedulerBridge();
      if (scheduler) {
        // Start the metronome from the current playhead position so it stays
        // in sync with the transport. `startTime` is the AudioContext time at
        // which beat 0 should sound: ctx.currentTime - DAW.playhead.
        const _ctxNow = audioContextServiceBridge.getContext()?.currentTime || 0;
        const _playhead = Number.isFinite(DAW.playhead) ? DAW.playhead : 0;
        scheduler.start({
          bpm: _mbpm,
          timeSignature: _msig,
          startTime: _ctxNow - _playhead,
          soundType: APP_SETTINGS.metroSound || 'classic'
        });
        // Mark the metronome as running so pauseTransport()/stopTransport()
        // will call stopMetronome() (which stops the scheduler + audio nodes).
        metroTimer = true;
        return;
      }
      // Legacy fallback: beat transitions tracked from the RAF tick loop.
      const _mcfg = getTimeSignatureGridConfig(_msig, _mbpm);
      if (metronomeEngineBridge) metronomeEngineBridge.start();
      metroBeat = -1; // force first tick to always click
    }
    function stopMetronome() {
      const scheduler = getMetronomeSchedulerBridge();
      if (scheduler) scheduler.stop();
      if (metronomeEngineBridge) metronomeEngineBridge.stop();
      metroTimer = null;
      metroBeat = 0;
    }
    function playClick(isAccent) {
      // Proxy: all click synthesis (oscillators/gains) is delegated to
      // AudioContextService. app.js no longer builds Web Audio nodes directly.
      if (!audioContextServiceBridge) return;
      audioContextServiceBridge.playClick(isAccent, APP_SETTINGS.metroSound || 'classic');
    }

    // تابع کمکی برای چک کردن ضرب در حلقه پخش
    function checkMetronomeTick(playheadTime) {
      if (!metroActive || !DAW.isPlaying) return;
      const bpm = parseInt($('edTempo')?.value) || 120;
      const sig = $('edTimeSig')?.value || '4/4';
      const config = getTimeSignatureGridConfig(sig, bpm);
      const beatsPerBar = config.beatsPerMeasure;
      const beatDur = config.beatDuration;
      const currentBeat = Math.floor(playheadTime / beatDur);

      // [DEBUG] Metronome timing verification (log once per sig/bpm change)
      if (!checkMetronomeTick._lastLog || checkMetronomeTick._lastLog.sig !== sig || checkMetronomeTick._lastLog.bpm !== bpm) {
        console.log('[METRONOME TIMING]', {
          sig, bpm,
          numerator: config.numerator,
          denominator: config.denominator,
          beatDuration: config.beatDuration,
          measureDuration: config.measureDuration
        });
        checkMetronomeTick._lastLog = { sig, bpm };
      }

      if (metronomeEngineBridge) {
        const beatEvent = metronomeEngineBridge.nextBeat(playheadTime, {
          bpm,
          timeSignature: sig
        });

        if (beatEvent) {
          playClick(beatEvent.isAccent);
          metroBeat = beatEvent.beatIndex;
        }
        return;
      }

      // Backward-compatible fallback when MetronomeEngine is unavailable.
      if (currentBeat !== metroBeat) {
        playClick(window.Meter.isStrongBeat(currentBeat % beatsPerBar, sig));
        metroBeat = currentBeat;
      }
    }

    // ===== TAP TEMPO =====
    let tapTimes = [];
    function tapTempo() {
      const now = performance.now();
      tapTimes.push(now);
      if (tapTimes.length > 8) tapTimes.shift();
      if (tapTimes.length >= 2) {
        let total = 0;
        for (let i = 1; i < tapTimes.length; i++) total += tapTimes[i] - tapTimes[i - 1];
        const avgMs = total / (tapTimes.length - 1);
        const bpm = Math.round(60000 / avgMs);
        if (bpm >= 20 && bpm <= 300) {
          $('edTempo').value = bpm;
          if (edCur) { edCur.tempo = bpm; edSaveSong(); }
          toast(`تمپو: ${bpm} BPM`);
        }
      }
      // Reset if gap > 3 seconds
      if (tapTimes.length >= 2 && (tapTimes[tapTimes.length - 1] - tapTimes[tapTimes.length - 2]) > 3000) {
        tapTimes = [now];
      }
    }

    // ===== TEMPO DETECTION FROM SYNC =====
    function detectTempo() {
      if (!edCur || !edCur.syncTimes || edCur.syncTimes.length < 2) {
        toast('ابتدا سینک دستی را انجام دهید (حداقل ۲ لاین)');
        return;
      }

      const result = SyncAnalysis.detectTempoFromSyncTimes(edCur.syncTimes, {
        minDiff: 0.1,
        maxDiff: 10,
        minBpm: 60,
        maxBpm: 180
      });

      if (!result.ok) {
        toast('تمپو قابل تشخیص نبود');
        return;
      }

      const bestBpm = result.bpm;

      const tempoEl = $('edTempo');
      if (tempoEl) tempoEl.value = bestBpm;

      if (edCur) {
        edCur.tempo = bestBpm;
        edSaveSong();
      }

      toast(`تمپوی تشخیص داده شده: ${bestBpm} BPM (از ${result.intervals.length} لاین سینک)`);
    }

    // ===== KEY DETECTION FROM CHORDS =====
    function detectKey() {
      if (!edCur || !edCur.chords || edCur.chords.length === 0) {
        toast('آکوردی برای تشخیص گام وجود ندارد');
        return;
      }

      const result = SyncAnalysis.detectKeyFromChords(edCur.chords);

      if (!result.ok) {
        toast('گام قابل تشخیص نبود');
        return;
      }

      const bestKey = result.key;
      const bestMode = result.mode;

      const keyEl = $('edKey');
      const modeEl = $('edKeyMode');

      if (keyEl) keyEl.value = bestKey;
      if (modeEl) modeEl.value = bestMode;

      if (edCur) {
        edCur.key = bestKey;
        edCur.keyMode = bestMode;
        edSaveSong();
        edSyncToolbar();
        edRenderEditor();
      }

      toast(`گام تشخیص داده شده: ${bestKey} ${bestMode === 'maj' ? 'ماژور' : 'مینور'} (امتیاز: ${result.score})`);
    }

    function togglePanel(panel) {
      const el = panel === 'sidebar' ? document.querySelector('.sidebar') :
                 panel === 'inspector' ? document.querySelector('.inspector') :
                 panel === 'timeline' ? document.querySelector('.timeline') : null;
      if (!el) return;
      const isHidden = el.style.display === 'none';
      el.style.display = isHidden ? '' : 'none';
      // When timeline is hidden, collapse its grid row so workspace fills the space
      if (panel === 'timeline') {
        const app = document.querySelector('.app-container');
        const sep = $('timelineSep');
        if (sep) sep.style.display = el.style.display;
        if (app && !_focusMode) app.style.gridTemplateRows = isHidden ? 'auto 1fr 4px 320px' : 'auto 1fr 0px 0px';
      }
    }

    function toggleLang() {
      currentLang = currentLang === 'fa' ? 'en' : 'fa';
      localStorage.setItem('appLang', currentLang);
      applyI18n();
      toast(currentLang === 'fa' ? 'زبان فارسی' : 'English');
    }

    const COLORS = ['#3FB8AF', '#3182CE', '#D69E2E', '#9F7AEA', '#ED64A6', '#48BB78', '#ED8936', '#00B5D8'];
    
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const ALL_NOTE_NAMES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
    const ROOT_NOTES = ['None', ...ALL_NOTE_NAMES];
    const BASS_NOTES = ['None', ...ALL_NOTE_NAMES];
    const NOTE_TO_SHARP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    const NOTE_SEMITONE = { 'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11 };
    const CHORD_TYPES = ['None', 'maj', 'min', 'dim', 'aug', 'sus2', 'sus4'];
    const TENSIONS = ['', '7', 'M7', '9', 'b9', '#9', '11', '#11', '13', '6'];
    function chordTypeDisplay(type) { return type === 'min' ? 'm' : type === 'maj' ? '' : type; }

    const CHORD_INTERVALS = { 'maj': [0, 4, 7], 'min': [0, 3, 7], 'dim': [0, 3, 6], 'aug': [0, 4, 8], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7] };
    const TENSION_INTERVALS = { '7': [10], 'M7': [11], '9': [14, 10], 'b9': [13, 10], '#9': [15, 10], '11': [17, 10], '#11': [18, 10], '13': [21, 10], '6': [9] };

    const CHORD_TEMPLATES = [
      { type: 'maj', tension: '13', req: [0, 4, 7, 10, 21] }, { type: 'maj', tension: '11', req: [0, 4, 7, 10, 17] },
      { type: 'maj', tension: '9', req: [0, 4, 7, 10, 14] }, { type: 'maj', tension: 'b9', req: [0, 4, 7, 10, 13] },
      { type: 'maj', tension: '#9', req: [0, 4, 7, 10, 15] }, { type: 'maj', tension: '#11', req: [0, 4, 7, 10, 18] },
      { type: 'maj', tension: '7', req: [0, 4, 7, 10] }, { type: 'maj', tension: 'M7', req: [0, 4, 7, 11] },
      { type: 'maj', tension: '6', req: [0, 4, 7, 9] }, { type: 'maj', tension: '', req: [0, 4, 7] },

      { type: 'min', tension: '13', req: [0, 3, 7, 10, 21] }, { type: 'min', tension: '11', req: [0, 3, 7, 10, 17] },
      { type: 'min', tension: '9', req: [0, 3, 7, 10, 14] }, { type: 'min', tension: '7', req: [0, 3, 7, 10] },
      { type: 'min', tension: 'M7', req: [0, 3, 7, 11] }, { type: 'min', tension: '6', req: [0, 3, 7, 9] },
      { type: 'min', tension: '', req: [0, 3, 7] },

      { type: 'dim', tension: '7', req: [0, 3, 6, 9] }, { type: 'dim', tension: '', req: [0, 3, 6] },
      { type: 'aug', tension: '7', req: [0, 4, 8, 10] }, { type: 'aug', tension: '', req: [0, 4, 8] },
      { type: 'sus2', tension: '7', req: [0, 2, 7, 10] }, { type: 'sus2', tension: '', req: [0, 2, 7] },
      { type: 'sus4', tension: '7', req: [0, 5, 7, 10] }, { type: 'sus4', tension: '', req: [0, 5, 7] },
    ];
    /* =========================
   PERF / RENDER HELPERS
   ========================= */
const PERF = {
  lastSerializedState: '',
  lastSyncActiveLi: -2,
  lastSyncDoneKey: '',
  lastPopupActiveLi: -2,
  lastPopupDoneKey: '',
  lastEditorScrollTarget: -1,
  lastPopupScrollTarget: -1,
  lastSyncTimelinePct: -1,
  lastSyncTimeText: '',
  syncLinesCache: [],
  syncPanelNodes: [],
  rulerMajor: null,
  rulerTotal: -1,
  rulerWidth: -1,
  clipsVersion: 0,
  tracksVersion: 0,
  pendingRenderAll: false,
  pendingSyncPanelRender: false
};
globalScope.PERF = PERF;

function rafThrottle(fn) {
  let scheduled = false;
  let lastArgs = null;
  return function (...args) {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn.apply(this, lastArgs);
    });
  };
}

function debounce(fn, delay = 200) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function arrayShallowEqual(a = [], b = []) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function safeText(v) {
  return v == null ? '' : String(v);
}

function buildDoneKey(times = [], t = 0, activeLi = -1) {
  let key = '';
  for (let i = 0; i < times.length; i++) {
    const ti = times[i];
    if (Number.isFinite(ti) && ti < t && i !== activeLi) key += i + '|';
  }
  return key;
}

function centerScrollIfNeeded(container, targetEl, lastTargetRefName) {
  if (!container || !targetEl) return;
  const idx = +(targetEl.dataset.li ?? -1);
  if (PERF[lastTargetRefName] === idx) return;
  PERF[lastTargetRefName] = idx;
  const top = targetEl.offsetTop - (container.clientHeight / 2) + (targetEl.offsetHeight / 2);
  container.scrollTop = Math.max(0, top);
}

const requestRenderAll = rafThrottle(() => { renderAll(); });
const requestRenderSyncLyrics = debounce(() => { renderSyncLyrics(); }, 120);
/* =========================
   END PERF / RENDER HELPERS
   ========================= */


    const DAW = {
      tracks: [], clips: [], sections: [], selectedIds: new Set(), selectedSectionIds: new Set(), clipboard: [],
      playhead: 0, isPlaying: false, isScrubbing: false,
      timelineDuration: 120, pxPerSecond: 70, laneHeight: 64, loadTrackId: null,
      rafId: null, playOriginPerf: 0, playOriginTime: 0,
      audioCtx: null, masterGain: null, voices: new Map(),
      nextId: 100, bufferCache: new Map(), waveCache: new Map(),
      drag: null, marquee: null, editingChordClipId: null, selectedPlayhead: false,
      loopEnabled: false, loopA: 0, loopB: 10,
      // سیستم جدید Pool برای مدیریت فایل‌های صوتی
      pool: {}, // clipId -> clip metadata
      projectRoot: null,
      isRecording: false, recRafId: null, recAnalyser: null, recStream: null, recMediaRecorder: null,
      recStartTime: 0, recEndTime: 0, recPeaks: [], recLaneId: null
    };
    globalScope.DAW = DAW;

    let undoStack = [], undoIndex = -1, isApplyingHistory = false;
    let activeMidiNotes = new Set(), midiTimeout = null, isRecordingChords = false, currentRecordingClipId = null;
    let currentChord = { root: 'None', type: 'None', tension: '', bass: 'None' };
    let midiAccess = null;
    // Playhead scroll mode: 'page' (scrolls page by page) or 'center' (stationary center)
    DAW.playheadMode = 'page';
    // Selection end point for arranger (independent of loop)
    let selectionEnd = 0;

    const $ = (id) => document.getElementById(id);
    const uid = (p = 'c') => p + (DAW.nextId++);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const roundMs = (t) => Math.round(t * 1000) / 1000;

    // آپدیت nextId بر اساس بزرگ‌ترین ID موجود (جلوگیری از تداخل آیدی)
    function updateNextIdFromClips() {
      const allIds = [...DAW.clips.map(c => c.id), ...(DAW.sections || []).map(s => s.id)];
      allIds.forEach(id => {
        const num = parseInt(id.replace(/^[a-z]+/, ''), 10);
        if (!isNaN(num) && num >= DAW.nextId) DAW.nextId = num + 1;
      });
    }

    function formatTime(sec, ms = true) {
      sec = Math.max(0, sec || 0); const m = Math.floor(sec / 60); const s = Math.floor(sec % 60);
      const milli = Math.floor((sec % 1) * 1000); const base = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      return ms ? `${base}.${String(milli).padStart(3,'0')}` : base;
    }

    function toast(msg) {
      const t = $('toast'); t.textContent = msg; t.classList.add('show');
      clearTimeout(toast._tm); toast._tm = setTimeout(() => t.classList.remove('show'), 1700);
    }

    function ensureAudioCtx() {
      if (!DAW.audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        DAW.audioCtx = new Ctx(); DAW.masterGain = DAW.audioCtx.createGain();
        DAW.masterGain.gain.value = 1; DAW.masterGain.connect(DAW.audioCtx.destination);
      }
      if (DAW.audioCtx.state === 'suspended') DAW.audioCtx.resume().catch(() => {});
      return DAW.audioCtx;
    }

// ==========================================
// ProjectAudioService Bridge
// مالکیت state و AudioContext همچنان با app.js / DAW است.
// ==========================================
const projectAudioServiceBridge =
  typeof window.ProjectAudioService === 'function'
    ? new window.ProjectAudioService({
        state: DAW,

        isElectron: Boolean(
          typeof isElectron !== 'undefined' &&
          isElectron
        ),

        getElectronAPI: () =>
          typeof window !== 'undefined'
            ? window.electronAPI || null
            : null,

        ensureAudioCtx,

        renderTimeline: () => {
          if (typeof renderTimeline === 'function') {
            renderTimeline();
          }
        },

        getLoadingIndicator: () =>
          typeof document !== 'undefined'
            ? document.getElementById('loading-indicator')
            : null,

        logger: console
      })
    : null;

function requireProjectAudioService() {
  if (!projectAudioServiceBridge) {
    throw new Error(
      'ProjectAudioService در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.'
    );
  }

  return projectAudioServiceBridge;
}

// ==========================================
// ProjectAudioService thin wrappers
// برای سازگاری با call-siteهای قدیمی در app.js
// ==========================================

async function loadAudioFromHardDrive(filePath) {
  return requireProjectAudioService().loadAudioFromHardDrive(filePath);
}

function pathDirname(filePath) {
  return requireProjectAudioService().pathDirname(filePath);
}

function pathJoin(dir, relativePath) {
  return requireProjectAudioService().pathJoin(dir, relativePath);
}

async function handleAudioImport(file, copyToProject = false) {
  return requireProjectAudioService()
    .handleAudioImport(file, copyToProject);
}

async function loadProject(projectData, projectFilePath = null) {
  return requireProjectAudioService()
    .loadProject(projectData, projectFilePath);
}

async function resolveClipAudio(clip, projectFilePath = null) {
  return requireProjectAudioService()
    .resolveClipAudio(clip, projectFilePath);
}

// حفظ APIهای global قدیمی برای بخش‌های دیگر پروژه و ابزارهای legacy.
if (typeof window !== 'undefined') {
  window.loadAudioFromHardDrive =
    loadAudioFromHardDrive;

  window.pathDirname =
    pathDirname;

  window.pathJoin =
    pathJoin;
}

// ==========================================
// Editor Domain module accessors (Commit 1)
// ==========================================
function requireLyricsParser() {
  if (typeof window.LyricsParser !== 'object' || !window.LyricsParser) {
    throw new Error('LyricsParser در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.');
  }
  return window.LyricsParser;
}

function requireLyricPositionMapper() {
  if (typeof window.LyricPositionMapper !== 'object' || !window.LyricPositionMapper) {
    throw new Error('LyricPositionMapper در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.');
  }
  return window.LyricPositionMapper;
}

function requireChordLineSyncService() {
  if (typeof window.ChordLineSyncService !== 'object' || !window.ChordLineSyncService) {
    throw new Error('ChordLineSyncService در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.');
  }
  return window.ChordLineSyncService;
}

function attachHistoryService() {
  if (window.__historyAttached) return;
  window.__historyAttached = true;
  requireHistoryService().init({
    getDAW: () => DAW,
    getPERF: () => PERF,
    getEdCur: () => edCur,
    setEdCur: (v) => { edCur = v; window.EdCurAdapter?.setEdCur?.(v); },
    getEdSeqPoints: () => edSeqPoints,
    setEdSeqPoints: (v) => { edSeqPoints = v; },
    clearEdTimers: () => {
      clearTimeout(edCommitTimer);
      clearTimeout(edInputRenderTimer);
      clearTimeout(edSaveTimer);
    },
    getAutoSaveTimer: () => _autoSaveTimer,
    setAutoSaveTimer: (id) => { _autoSaveTimer = id; },
    edSaveSong,
    edSyncToolbar,
    edRenderEditor,
    updateNextIdFromClips,
    ensureAudioCtx,
    updateTrackMix,
    peaksFromBuffer,
    refreshClipWaveImage,
    renderAll,
    scheduleAllFromPlayhead,
    edFlushPendingCommit,
    edCommitTimerRef: () => edCommitTimer,
    toast,
    t
  });
}
    const timeToX = (t) => t * DAW.pxPerSecond;
    // WaveformService initialization
    window.waveformService = new window.WaveformService({
      ensureAudioCtx: () => ensureAudioCtx(),
      setAudioContext: (ctx) => {
        if (!DAW.audioCtx) DAW.audioCtx = ctx;
      },
      getWaveCache: () => DAW.waveCache,
      documentRef: document,
      clamp: (value, min, max) => clamp(value, min, max),
      timeToX: (value) => timeToX(value)
    });
    const xToTime = (x) => x / DAW.pxPerSecond;

    function getProjectEnd() { let end = 30; for (const c of DAW.clips) end = Math.max(end, c.start + c.duration); for (const s of (DAW.sections || [])) end = Math.max(end, s.start + s.duration); return Math.max(DAW.timelineDuration, end + 8); }
    function getClip(id) { return DAW.clips.find(c => c.id === id); }
    function selectedClips() { return DAW.clips.filter(c => DAW.selectedIds.has(c.id)); }
    function ensureTimelineFits(needed) { if (needed > DAW.timelineDuration) DAW.timelineDuration = needed; }

   function serializeState() {
  const tracks = DAW.tracks.map(t => {
    const copy = { ...t };
    delete copy._pannerNode;
    delete copy._gainNode;
    return copy;
  });

  const clips = DAW.clips.map(c => {
    const copy = { ...c };
    delete copy._peaks;
    delete copy.waveUrl;
    delete copy.buffer; // حذف buffer از ذخیره‌سازی
    delete copy.audioBuffer; // حذف audioBuffer
    delete copy._fileHandle; // حذف file handle
    // فقط مسیر نسبی و نام فایل باقی بماند
    return copy;
  });

  const sections = (DAW.sections || []).map(s => ({ ...s }));
  
  // پاک‌سازی pool از داده‌های runtime قبل از ذخیره
  const cleanPool = {};
  for (const [clipId, clip] of Object.entries(DAW.pool)) {
    const cleanClip = { ...clip };
    delete cleanClip.runtime;
    delete cleanClip._peaks;
    delete cleanClip.waveUrl;
    delete cleanClip.audioBuffer;
    delete cleanClip.buffer;
    cleanPool[clipId] = cleanClip;
  }

  return JSON.stringify({
    schema: 'akordyar-project',
    version: 2,
    project: {
      id: DAW.project?.id || '',
      name: DAW.project?.name || '',
      projectRoot: undefined // مسیر پروژه ذخیره نمی‌شود (نسبی کار می‌کند)
    },
    pool: cleanPool,
    tracks,
    clips,
    sections,
    edCur: edCur ? JSON.parse(JSON.stringify(edCur)) : null,
    edSeqPoints: Array.isArray(edSeqPoints)
      ? JSON.parse(JSON.stringify(edSeqPoints))
      : []
  });
}


let _autoSaveTimer = null;

function saveState() {
  if (isApplyingHistory) return;

  const state = serializeState();

  if (state === PERF.lastSerializedState) {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => edSaveSong(), 700);
    return;
  }

  undoStack = undoStack.slice(0, undoIndex + 1);
  undoStack.push(state);

  if (undoStack.length > 100) {
    undoStack.shift();
  }

  undoIndex = undoStack.length - 1;
  PERF.lastSerializedState = state;

  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => edSaveSong(), 700);
}


function applyState(stateStr) {
  if (!stateStr) return;

  isApplyingHistory = true;

  clearTimeout(_autoSaveTimer);
  clearTimeout(edCommitTimer);
  clearTimeout(edInputRenderTimer);
  clearTimeout(edSaveTimer);

  try {
    const state = JSON.parse(stateStr);

    DAW.tracks = state.tracks || [];
    DAW.clips = state.clips || [];
    DAW.sections = state.sections || [];
    DAW.selectedSectionIds = new Set();
    updateNextIdFromClips();

    if (state.edCur) {
      const keepId = edCur?.id;
      edCur = state.edCur;
      window.EdCurAdapter?.setEdCur?.(edCur); // sync legacy reference after loading state
      if (keepId != null) edCur.id = keepId;
    } else {
      edCur = null;
      window.EdCurAdapter?.setEdCur?.(null); // sync legacy reference when edCur is null
    }

    edSeqPoints = Array.isArray(state.edSeqPoints)
      ? state.edSeqPoints
      : (edCur?.seqPoints || []);

    if (edCur) {
      edCur.seqPoints = edSeqPoints;
      edSyncToolbar();
      function edGetSelectionState() {
  const editor = $('editor');
  const sel = document.getSelection();
  if (!editor || !sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return null;

  return {
    start: getOffsetWithinEditor(editor, range.startContainer, range.startOffset),
    end: getOffsetWithinEditor(editor, range.endContainer, range.endOffset),
    isCollapsed: range.collapsed
  };
}

      edRenderEditor(true);
    }

    ensureAudioCtx();

    DAW.tracks.forEach(t => {
      if (t.type === 'audio') {
        t._pannerNode = DAW.audioCtx.createStereoPanner();
        t._gainNode = DAW.audioCtx.createGain();
        t._pannerNode.connect(t._gainNode);
        t._gainNode.connect(DAW.masterGain);
        updateTrackMix(t.id);
      }
    });

    DAW.selectedIds.clear();
    
    // Rebuild waveforms for audio clips after undo/redo
    DAW.clips.forEach(clip => {
      if (clip.type === 'audio' && clip.bufferKey && DAW.bufferCache.has(clip.bufferKey)) {
        const buffer = DAW.bufferCache.get(clip.bufferKey);
        clip.sourceDuration = buffer.duration;
        clip._peaks = peaksFromBuffer(buffer, 2000);
        refreshClipWaveImage(clip);
      }
    });
    
    PERF.tracksVersion++;
    PERF.clipsVersion++;
    renderAll();

    if (DAW.isPlaying) {
      scheduleAllFromPlayhead();
    }

    PERF.lastSerializedState = stateStr;
  } finally {
    isApplyingHistory = false;
  }
}


    function edFlushPendingCommit() {
  if (!edCommitTimer) return;
  clearTimeout(edCommitTimer);
  edCommitTimer = null;
  edCommit();
}

function undo() {
  if (edCur && edCommitTimer) {
    edFlushPendingCommit();
  }

  if (undoIndex <= 0) {
    toast(t('nothingUndo'));
    return;
  }

  undoIndex--;
  applyState(undoStack[undoIndex]);
  toast('Undo');
}

    function redo() {
  if (undoIndex >= undoStack.length - 1) {
    toast(t('nothingRedo'));
    return;
  }

  undoIndex++;
  applyState(undoStack[undoIndex]);
  toast('Redo');
}


    async function decodeFileToBuffer(file) {
      return window.waveformService.decodeFileToBuffer(file);
    }

    function peaksFromBuffer(buffer, buckets = 2000) {
      return window.waveformService.peaksFromBuffer(buffer, buckets);
    }

    function drawWaveToCanvas(peaks, w, h) {
      return window.waveformService.drawWaveToCanvas(peaks, w, h);
    }

    function refreshClipWaveImage(clip) {
      return window.waveformService.refreshClipWaveImage(clip);
    }

    function updateTrackMix(trackId) {
      const tr = DAW.tracks.find(t => t.id === trackId); if (!tr || !tr._gainNode) return;
      const anySolo = DAW.tracks.some(t => t.solo); let gain = 0;
      if (anySolo) gain = tr.solo && !tr.muted ? tr.vol : 0; else gain = tr.muted ? 0 : tr.vol;
      tr._gainNode.gain.value = gain; tr._pannerNode.pan.value = tr.pan;
    }

    function stopAllVoices() {
      for (const [id, v] of DAW.voices) { try { v.source.onended = null; v.source.stop(0); } catch (_) {} try { v.source.disconnect(); } catch (_) {} try { v.gain.disconnect(); } catch (_) {} }
      DAW.voices.clear();
    }

    function scheduleAllFromPlayhead() {
      const ctx = ensureAudioCtx(); stopAllVoices();
      if (!DAW.isPlaying || DAW.isScrubbing) return;
      const nowT = DAW.playhead; const ctxNow = ctx.currentTime;
      DAW.clips.forEach(clip => {
        if (clip.type === 'chord') return;
        const tr = DAW.tracks.find(t => t.id === clip.trackId);
        if (tr && (tr.muted || (DAW.tracks.some(t => t.solo) && !tr.solo))) return;
        const buffer = DAW.bufferCache.get(clip.bufferKey); if (!buffer) return;
        const local = nowT - clip.start; if (local >= clip.duration) return;
        let when = ctxNow, mediaOffset = clip.offset, playDur = clip.duration;
        if (local < 0) when = ctxNow + (-local); else { mediaOffset = clip.offset + local; playDur = clip.duration - local; }
        if (mediaOffset >= buffer.duration - 0.0005) return; playDur = Math.min(playDur, buffer.duration - mediaOffset); if (playDur <= 0.005) return;
        const gain = ctx.createGain(); gain.gain.value = 1; gain.connect(tr._pannerNode);
        const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(gain);
        // Apply transpose via playbackRate
        const semitones = tr.transpose || 0;
        if (semitones !== 0) source.playbackRate.value = Math.pow(2, semitones / 12);
        try { source.start(when, mediaOffset, playDur); } catch (err) { return; }
        source.onended = () => { if (DAW.voices.get(clip.id)?.source === source) DAW.voices.delete(clip.id); };
        DAW.voices.set(clip.id, { source, gain });
      });
    }

    function renderAll() {
  renderTracks(); renderRuler(); renderClips(); renderLoopRegion(); updatePlayheadUI(); updateHud();
  edRenderClMarkers();
}


    function renderTracks() {
      const names = $('track-names-container'); const lanes = $('lanes-container'); names.innerHTML = ''; lanes.innerHTML = '';
      DAW.tracks.forEach((tr) => {
        const h = document.createElement('div'); h.className = 'track-name' + (DAW.loadTrackId === tr.id ? ' active-load' : ''); h.dataset.trackId = tr.id;
        if (tr.muted) h.classList.add('muted-track');
        if (DAW.tracks.some(t => t.solo) && !tr.solo && tr.type !== 'chord') h.classList.add('solo-dim-track');
        if (tr.type === 'chord') {
  const chordTarget =
    edCur && typeof edCur === 'object'
      ? edCur
      : tr;

  if (!Array.isArray(chordTarget.chordVersions)) {
    chordTarget.chordVersions = [];
  }

  const verCount = chordTarget.chordVersions.length;

  const curVer = Number.isInteger(chordTarget.activeChordVersion)
    ? chordTarget.activeChordVersion
    : 0;

  h.innerHTML = `
    <span
      class="t-icon"
      data-icon-pick="${tr.id}"
      title="تغییر آیکون"
    >${getIconSvg(tr.icon)}</span>

    <span class="t-label">${tr.name}</span>

    <div style="display:flex;gap:2px;align-items:center;">
      <button
        class="t-btn"
        data-chord-ver-prev=""
        title="ورژن قبلی"
        style="font-size:0.55rem;"
      >◀</button>

      <span
        style="font-size:0.55rem;color:var(--accent-cyan-glow);min-width:46px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-family:'JetBrains Mono';cursor:pointer;"
        data-chord-ver-label=""
        title="دوبار کلیک برای تغییر نام ورژن"
      >${chordTarget.chordVersions[curVer] && chordTarget.chordVersions[curVer].name ? chordTarget.chordVersions[curVer].name : 'V' + (curVer + 1)}</span>

      <button
        class="t-btn"
        data-chord-ver-next=""
        title="ورژن بعدی"
        style="font-size:0.55rem;"
      >▶</button>

      <button
        class="t-btn"
        data-chord-ver-add=""
        title="ورژن جدید"
        style="font-size:0.55rem;"
      >+</button>
    </div>

    <button
      class="t-btn ${tr.locked ? 'on-lock' : ''}"
      data-lock="${tr.id}"
      title="قفل"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </button>

    <button
      class="t-btn ${isRecordingChords ? 'on-rec' : ''}"
      data-rec="chord"
      title="ضبط آکورد"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="8"/>
      </svg>
    </button>
  `;

  // ── اتصال ابزارهای کورد لاین ──
  h.querySelector('[data-rec]').addEventListener('click', (e) => {
    e.stopPropagation();
    isRecordingChords = !isRecordingChords;
    renderAll();
    toast(isRecordingChords ? t('chordRecOn') : t('chordRecOff'));
  });
  h.querySelector('[data-lock]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    tr.locked = !tr.locked;
    saveState();
    renderTracks();
    renderClips();
    toast(tr.locked ? '🔒 آکوردهای کورد لاین قفل شد' : '🔓 آکوردهای کورد لاین باز شد');
  });
  h.querySelector('[data-chord-ver-prev]')?.addEventListener('click', (e) => { e.stopPropagation(); switchChordVersion(-1); });
  h.querySelector('[data-chord-ver-next]')?.addEventListener('click', (e) => { e.stopPropagation(); switchChordVersion(1); });
  h.querySelector('[data-chord-ver-add]')?.addEventListener('click', (e) => { e.stopPropagation(); addChordVersion(); });
  const _verLabel = h.querySelector('[data-chord-ver-label]');
  if (_verLabel) _verLabel.addEventListener('dblclick', (e) => { e.stopPropagation(); renameChordVersion(); });
  h.addEventListener('click', (e) => { if(!e.target.closest('button') && !e.target.closest('.t-icon') && !e.target.closest('[data-chord-ver-label]')) openChordEditor(); });

        } else if (tr.type === 'section') {
            h.innerHTML = `<span class="t-icon" data-icon-pick="${tr.id}" title="تغییر آیکون">${getIconSvg(tr.icon)}</span><span class="t-label">${tr.name}</span>`;
            h.querySelector('[data-icon-pick]')?.addEventListener('click', (e) => { e.stopPropagation(); openIconPicker(tr); });
        } else {
          const panPct = ((tr.pan + 1) / 2) * 100;
          const panLeftW = tr.pan < 0 ? Math.abs(tr.pan) * 50 : 0;
          const panRightW = tr.pan > 0 ? tr.pan * 50 : 0;
          const panColor = tr.pan === 0 ? '#E2E8F0' : (tr.pan < 0 ? 'var(--accent-neon-pink)' : 'var(--accent-teal)');
          h.innerHTML = `
            <div class="track-name-top-row">
              <span class="t-icon" data-icon-pick="${tr.id}" title="تغییر آیکون">${getIconSvg(tr.icon)}</span>
              <span class="t-label" contenteditable="true" spellcheck="false" style="cursor:text;min-width:40px;outline:none;">${tr.name}</span>
              <button class="t-btn" data-load="${tr.id}" title="لود آهنگ" style="font-size:0.7rem;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>
            </div>
            <div class="track-name-bottom-row">
              <button class="t-btn ${tr.muted ? 'on' : ''}" data-mute="${tr.id}">M</button>
              <button class="t-btn ${tr.solo ? 'on-solo' : ''}" data-solo="${tr.id}">S</button>
              <button class="t-btn ${tr.locked ? 'on-lock' : ''}" data-lock="${tr.id}" title="قفل ترک"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button>
              <input type="range" class="t-vol" min="0" max="1" step="0.01" value="${tr.vol}" data-vol="${tr.id}">
              <div class="pan-wrap" data-pan-wrap="${tr.id}">
                  <div class="pan-track">
                      <div class="pan-fill-left" style="width:${panLeftW}%;right:50%;"></div>
                      <div class="pan-fill-right" style="width:${panRightW}%;left:50%;"></div>
                  </div>
                  <div class="pan-center"></div>
                  <div class="pan-thumb" style="left:${panPct}%;border-color:${panColor};"></div>
                  <div class="pan-labels"><span>L</span><span>R</span></div>
              </div>
              <input type="range" class="t-pan" min="-1" max="1" step="0.01" value="${tr.pan}" data-pan="${tr.id}">
              <div class="t-transpose">
                <button class="t-trans-btn" data-trans-down="${tr.id}" title="بمل">♭</button>
                <span class="t-trans-val" data-trans-val="${tr.id}">${tr.transpose || 0}</span>
                <button class="t-trans-btn" data-trans-up="${tr.id}" title="دیز">♯</button>
              </div>
            </div>`;
          // Editable track name
          const label = h.querySelector('.t-label');
          label.addEventListener('blur', () => { tr.name = label.textContent.trim() || tr.name; if (typeof renderMixer === 'function' && $('mixerPanel') && $('mixerPanel').classList.contains('show')) renderMixer(); });
          label.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); label.blur(); } });
          label.addEventListener('mousedown', e => e.stopPropagation());
          // Load audio via dedicated button
          h.querySelector('[data-load]')?.addEventListener('click', (e) => { e.stopPropagation(); openFileForTrack(tr.id); });
          // Icon picker
          h.querySelector('[data-icon-pick]')?.addEventListener('click', (e) => { e.stopPropagation(); openIconPicker(tr); });
          h.querySelector('[data-mute]').addEventListener('click', (e) => { e.stopPropagation(); tr.muted = !tr.muted; updateTrackMix(tr.id); renderAll(); if(DAW.isPlaying) scheduleAllFromPlayhead(); });
          h.querySelector('[data-solo]').addEventListener('click', (e) => { e.stopPropagation(); tr.solo = !tr.solo; DAW.tracks.forEach(t => updateTrackMix(t.id)); renderAll(); if(DAW.isPlaying) scheduleAllFromPlayhead(); });
          h.querySelector('[data-lock]')?.addEventListener('click', (e) => { e.stopPropagation(); tr.locked = !tr.locked; saveState(); renderTracks(); renderClips(); toast(tr.locked ? 'ترک قفل شد' : 'ترک باز شد'); });
          // جلوگیری از درگ شدن هدر روی دکمه‌ها و کنترل‌ها
          h.querySelectorAll('button, input, .pan-wrap, .t-transpose').forEach(el => { el.draggable = false; el.addEventListener('mousedown', (e) => e.stopPropagation()); });
          h.querySelector('[data-vol]').addEventListener('input', (e) => { e.stopPropagation(); tr.vol = +e.target.value; updateTrackMix(tr.id); });
          // Pan wrapper interaction
          const panWrap = h.querySelector(`[data-pan-wrap="${tr.id}"]`);
          if (panWrap) {
            const updatePanVisual = () => {
              const panPctV = ((tr.pan + 1) / 2) * 100;
              const pL = tr.pan < 0 ? Math.abs(tr.pan) * 50 : 0;
              const pR = tr.pan > 0 ? tr.pan * 50 : 0;
              const pC = tr.pan === 0 ? '#E2E8F0' : (tr.pan < 0 ? 'var(--accent-neon-pink)' : 'var(--accent-teal)');
              panWrap.querySelector('.pan-fill-left').style.width = pL + '%';
              panWrap.querySelector('.pan-fill-right').style.width = pR + '%';
              panWrap.querySelector('.pan-thumb').style.left = panPctV + '%';
              panWrap.querySelector('.pan-thumb').style.borderColor = pC;
            };
            const onPanDrag = (e) => {
              const rect = panWrap.getBoundingClientRect();
              const x = (e.clientX || e.touches[0].clientX) - rect.left;
              const norm = Math.max(-1, Math.min(1, (x / rect.width) * 2 - 1));
              tr.pan = Math.round(norm * 100) / 100;
              h.querySelector('[data-pan]').value = tr.pan;
              ensureAudioCtx(); updateTrackMix(tr.id); updatePanVisual();
            };
            panWrap.addEventListener('mousedown', (e) => {
              e.stopPropagation(); onPanDrag(e);
              const onMove = (ev) => onPanDrag(ev);
              const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveState(); };
              document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
            });
            panWrap.addEventListener('click', (e) => e.stopPropagation());
            panWrap.addEventListener('dblclick', (e) => {
              e.stopPropagation(); e.preventDefault();
              tr.pan = 0;
              h.querySelector('[data-pan]').value = 0;
              ensureAudioCtx(); updateTrackMix(tr.id); updatePanVisual(); saveState();
            });
          }
          h.querySelector('[data-pan]').addEventListener('input', (e) => { e.stopPropagation(); tr.pan = +e.target.value; updateTrackMix(tr.id); });
          // Transpose controls
          const updateTransVal = () => {
            const v = tr.transpose || 0;
            const el = h.querySelector(`[data-trans-val="${tr.id}"]`);
            if (el) el.textContent = (v > 0 ? '+' : '') + v;
          };
          h.querySelector(`[data-trans-down="${tr.id}"]`)?.addEventListener('click', (e) => {
            e.stopPropagation();
            tr.transpose = Math.max(-12, (tr.transpose || 0) - 1);
            updateTransVal();
            if (DAW.isPlaying) scheduleAllFromPlayhead();
            saveState();
          });
          h.querySelector(`[data-trans-up="${tr.id}"]`)?.addEventListener('click', (e) => {
            e.stopPropagation();
            tr.transpose = Math.min(12, (tr.transpose || 0) + 1);
            updateTransVal();
            if (DAW.isPlaying) scheduleAllFromPlayhead();
            saveState();
          });
        }
        names.appendChild(h);

        // Track drag reordering — فقط از نواحی خالی هدر قابل درگ است
        h.addEventListener('mousedown', (e) => {
          // اگر روی دکمه، اسلایدر، لیبل، پن یا ترنپوز کلیک شده، درگ فعال نشود
          if (e.target.closest('button, input, .pan-wrap, .t-label, .t-transpose, .t-btn, .t-icon')) {
            h.draggable = false;
          } else {
            h.draggable = true;
          }
        });
        h.addEventListener('dragstart', (e) => {
          if (!h.draggable) { e.preventDefault(); return; }
          e.dataTransfer.setData('text/plain', tr.id);
          e.dataTransfer.effectAllowed = e.altKey ? 'copy' : 'move';
          h.style.opacity = '0.4';
        });
        h.addEventListener('dragend', () => { h.style.opacity = ''; });
        h.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move'; h.style.borderTop = '2px solid var(--accent-teal)'; });
        h.addEventListener('dragleave', () => { h.style.borderTop = ''; });
        h.addEventListener('drop', (e) => {
          e.preventDefault(); h.style.borderTop = '';
          const draggedId = e.dataTransfer.getData('text/plain');
          if (!draggedId || draggedId === tr.id) return;
          const fromIdx = DAW.tracks.findIndex(t => t.id === draggedId);
          const toIdx = DAW.tracks.findIndex(t => t.id === tr.id);
          if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
          if (e.altKey) {
            // ALT+drag = copy
            const src = DAW.tracks[fromIdx];
            const copy = JSON.parse(JSON.stringify(src));
            copy.id = uid('t');
            copy.name = src.name + ' (copy)';
            DAW.tracks.splice(toIdx + 1, 0, copy);
          } else {
            // Normal drag = move
            const [moved] = DAW.tracks.splice(fromIdx, 1);
            DAW.tracks.splice(toIdx, 0, moved);
          }
          saveState(); renderAll();
        });

        const lane = document.createElement('div'); lane.className = 'track-lane' + (tr.type === 'chord' ? ' chord-lane' : '') + (tr.type === 'section' ? ' section-lane' : ''); lane.dataset.trackId = tr.id;
        // Apply per-lane height if set
        if (tr.laneHeight) { h.style.setProperty('--lane-h', tr.laneHeight + 'px'); h.style.height = tr.laneHeight + 'px'; lane.style.setProperty('--lane-h', tr.laneHeight + 'px'); lane.style.height = tr.laneHeight + 'px'; }
        // Apply muted/solo/locked visual states to lane
        if (tr.muted) lane.classList.add('muted-lane');
        if (tr.locked) lane.classList.add('locked-lane');
        if (DAW.tracks.some(t => t.solo) && !tr.solo && tr.type !== 'chord') lane.classList.add('solo-dim-lane');
        // Per-lane resize handle (Cubase-style: drag bottom border)
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'lane-resize-handle bottom';
        resizeHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation(); e.preventDefault();
          resizeHandle.classList.add('active');
          const startY = e.clientY; const origH = tr.laneHeight || DAW.laneHeight;
          const onMove = (ev) => { const newH = Math.max(24, Math.min(200, origH + (ev.clientY - startY))); setLaneHeight(tr.id, newH); };
          const onUp = () => { resizeHandle.classList.remove('active'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveState(); };
          document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
        });
        lane.appendChild(resizeHandle);
        lane.addEventListener('mousedown', (e) => {
        clearEditorTextSelection();
        edClearChordSelection();
        if (e.target.closest('.clip') || e.target.closest('.section-tag')) return;
        // Clear section selection on any empty-area click (all lanes)
        if (DAW.selectedSectionIds.size > 0) { DAW.selectedSectionIds.clear(); renderClips(); }
        if (tr.locked) { toast('🔒 ترک قفل است'); return; }

        // Alt+Click on section track: create tag with styled modal
        if (tr.type === 'section' && e.altKey) {
          e.preventDefault(); e.stopPropagation();
          const t = clientToTime(e.clientX);
          // Use customPrompt for a styled modal instead of native prompt
          customPrompt('نام بخش:', 'ورس').then(name => {
            if (name && name.trim()) {
              const sec = { id: uid('c'), trackId: tr.id, label: name.trim(), start: roundMs(t), duration: 4, color: '#3FB8AF' };
              DAW.sections.push(sec);
              ensureTimelineFits(sec.start + sec.duration + 5);
              saveState(); renderClips();
            }
          });
          return;
        }

        // Alt+Click on chord track: open chord editor
        if (tr.type === 'chord' && e.altKey) {
          e.preventDefault(); e.stopPropagation();
          const t = clientToTime(e.clientX);
          // Create a temporary anchor at clicked time and open chord modal
          // IMPORTANT: Don't change edCur (which holds the song), use a local variable
          const chordTrack = DAW.tracks.find(track => track.id === tr.id);
          if (chordTrack) {
            const anchor = { time: t, x: e.clientX, y: e.clientY };
            // Store in a temp variable, don't overwrite edCur
            window._tempChordTrackAnchor = anchor;
            window._tempChordTrack = chordTrack;
            // Open the regular chord editor (not the song chord editor)
            openChordEditor(null);
            renderClips();
          }
          return;
        }

        // Double-click on section track: create tag with styled modal
        if (tr.type === 'section' && e.detail === 2) {
          e.preventDefault(); e.stopPropagation();
          const t = clientToTime(e.clientX);
          // Use customPrompt for a styled modal instead of native prompt
          customPrompt('نام بخش:', 'ورس').then(name => {
            if (name && name.trim()) {
              const sec = { id: uid('c'), trackId: tr.id, label: name.trim(), start: roundMs(t), duration: 4, color: '#3FB8AF' };
              DAW.sections.push(sec);
              ensureTimelineFits(sec.start + sec.duration + 5);
              saveState(); renderClips();
            }
          });
          return;
        }

  const t = clientToTime(e.clientX);


            
            if (e.shiftKey && lane) {
              e.preventDefault();
              cutAtTime(t, lane.dataset.trackId);
              return;
            }

            seekTransport(t, true);
            if (!e.ctrlKey && !e.metaKey) clearSelection();
            const p = clientToInnerPoint(e.clientX, e.clientY); DAW.marquee = { x0: p.x, y0: p.y };
            document.addEventListener('mousemove', onDocMouseMove); document.addEventListener('mouseup', onDocMouseUp);
        });
        const grid = document.createElement('canvas'); grid.className = 'lane-grid'; lane.appendChild(grid);
        if (!DAW.clips.some(c => c.trackId === tr.id) && !(tr.type === 'section' && (DAW.sections || []).some(s => s.trackId === tr.id))) { 
          const hint = document.createElement('div'); 
          hint.className = 'empty-lane-hint' + (tr.type === 'section' ? ' section-hint' : ''); 
          hint.textContent = tr.type === 'chord' ? t('clickHint') : (tr.type === 'section' ? 'دوبار کلیک برای ساخت بخش' : t('loadHint'));
          if (tr.type === 'section') {
            hint.addEventListener('dblclick', (e) => {
              e.preventDefault(); e.stopPropagation();
              const t = clientToTime(e.clientX);
              customPrompt('نام بخش:', 'ورس').then(name => {
                if (name && name.trim()) {
                  const sec = { id: uid('c'), trackId: tr.id, label: name.trim(), start: roundMs(t), duration: 4, color: '#3FB8AF' };
                  DAW.sections.push(sec);
                  ensureTimelineFits(sec.start + sec.duration + 5);
                  saveState(); renderClips();
                }
              });
            });
          }
          lane.appendChild(hint); 
        }
        lanes.appendChild(lane); drawLaneGrid(grid);
      });
    }

    // ===== Cubase-style Timeline Grid =====
    function timeToBarBeat(seconds) {
      const bpm = edCur?.tempo || 120;
      const sig = edCur?.timeSignature || '4/4';
      return window.Meter.timeToBarBeat(seconds, sig, bpm);
    }

    function barBeatToTime(bar, beat) {
      const bpm = edCur?.tempo || 120;
      const sig = edCur?.timeSignature || '4/4';
      return window.Meter.barBeatToTime(bar, beat, sig, bpm);
    }

    function drawLaneGrid(canvas) {
      TimelineGrid.drawLaneGrid(canvas, {
        total: getProjectEnd(),
        timeToX: timeToX,
        tempo: edCur?.tempo,
        timeSignature: edCur?.timeSignature,
        pxPerSec: DAW.pxPerSecond
      });
    }

    function renderRuler() {
      const total = getProjectEnd();
      TimelineGrid.renderRuler({
        total: total,
        timeToX: timeToX,
        tempo: edCur?.tempo,
        timeSignature: edCur?.timeSignature,
        pxPerSec: DAW.pxPerSecond,
        rulerEl: $('timeline-ruler'),
        labelsEl: $('ruler-labels'),
        tlInnerEl: $('tl-inner'),
        lanesEl: $('lanes-container'),
        onDurationChange: function(t) { DAW.timelineDuration = t; }
      });
    }

    function renderClips() {
      document.querySelectorAll('.clip').forEach(el => el.remove());
      document.querySelectorAll('.section-tag').forEach(el => el.remove());
      // Render audio & chord clips
      DAW.clips.forEach(clip => {
        const lane = document.querySelector(`.track-lane[data-track-id="${clip.trackId}"]`); if (!lane) return;
        const hint = lane.querySelector('.empty-lane-hint'); if (hint) hint.remove();
        if (clip.type !== 'chord') refreshClipWaveImage(clip);
        const el = document.createElement('div');
        el.className = 'clip' + (clip.type === 'chord' ? ' chord-clip' : '') + (DAW.selectedIds.has(clip.id) ? ' selected' : '');
        el.dataset.clipId = clip.id; el.style.left = timeToX(clip.start) + 'px'; el.style.width = Math.max(30, timeToX(clip.duration)) + 'px';
        if (clip.type !== 'chord') {
          el.style.background = `linear-gradient(180deg, ${clip.color}bb, ${clip.color}88)`;
          el.innerHTML = `<img class="clip-wave" alt="" draggable="false" ${clip.waveUrl ? `src="${clip.waveUrl}"` : ''}><div class="clip-title">${clip.name}</div><div class="resize-handle left" data-edge="left"></div><div class="resize-handle right" data-edge="right"></div>`;
          // Mouseover event to show file path in storageInfoBar
          el.addEventListener('mouseenter', (e) => {
            const filePath = getClipFilePath(clip);
            if (filePath) {
              const storageBar = document.getElementById('storageInfoBar');
              const storageText = document.getElementById('storageText');
              if (storageBar && storageText) {
                storageBar.style.display = 'block';
                storageText.textContent = filePath;
                storageText.title = filePath;
              }
            }
          });
          el.addEventListener('mouseleave', () => {
            const storageBar = document.getElementById('storageInfoBar');
            const storageText = document.getElementById('storageText');
            if (storageBar && storageText) {
              storageBar.style.display = 'none';
              storageText.textContent = '';
            }
          });
        } else {
          const chordColor = clip.color || '#9F7AEA';
          el.style.background = `linear-gradient(180deg, ${chordColor}cc, ${chordColor}77)`;
          el.style.borderColor = chordColor;
          el.innerHTML = `<span>${clip.name}</span><div class="resize-handle left" data-edge="left"></div><div class="resize-handle right" data-edge="right"></div>`;
        }
        el.addEventListener('mousedown', onClipMouseDown); lane.appendChild(el);
      });
      // Render section tags (fully decoupled from clips)
      DAW.sections.forEach(sec => {
        const lane = document.querySelector(`.track-lane[data-track-id="${sec.trackId}"]`); if (!lane) return;
        const hint = lane.querySelector('.empty-lane-hint'); if (hint) hint.remove();
        const el = document.createElement('div');
        el.className = 'section-tag' + (DAW.selectedSectionIds.has(sec.id) ? ' selected' : '');
        el.dataset.sectionId = sec.id;
        el.style.left = timeToX(sec.start) + 'px';
        el.style.width = Math.max(50, timeToX(sec.duration)) + 'px';
        el.textContent = sec.label;
        el.style.background = sec.color ? `rgba(${parseInt(sec.color.slice(1,3),16)},${parseInt(sec.color.slice(3,5),16)},${parseInt(sec.color.slice(5,7),16)},0.35)` : 'rgba(63,184,175,0.25)';
        el.style.borderColor = sec.color || 'var(--accent-teal)';

        // Drag to move + custom double-click detection
        // (native dblclick is unreliable because renderClips recreates elements)
        el.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();

          // Custom double-click: two clicks within 350ms at same position
          // Track state on sec object (survives renderClips element recreation)
          const now = Date.now();
          const dx = Math.abs(e.clientX - (sec._clickX || 0));
          const dy = Math.abs(e.clientY - (sec._clickY || 0));
          if (sec._clickTimer && (now - (sec._clickTime || 0)) < 350 && dx < 5 && dy < 5) {
            clearTimeout(sec._clickTimer);
            sec._clickTimer = null;
            // Double-click → enter rename mode
            el.contentEditable = 'true';
            el.focus();
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            const finishEdit = () => {
              el.contentEditable = 'false';
              const newName = el.textContent.trim();
              if (newName && newName !== sec.label) { sec.label = newName; saveState(); }
              el.removeEventListener('blur', finishEdit);
              el.removeEventListener('keydown', onKey);
            };
            const onKey = (ke) => {
              if (ke.key === 'Enter') { ke.preventDefault(); el.blur(); }
              if (ke.key === 'Escape') { el.textContent = sec.label; el.blur(); }
              ke.stopPropagation();
            };
            el.addEventListener('blur', finishEdit);
            el.addEventListener('keydown', onKey);
            return;
          }

          // First click → record position, start timer
          sec._clickX = e.clientX;
          sec._clickY = e.clientY;
          sec._clickTime = now;
          sec._clickTimer = setTimeout(() => { sec._clickTimer = null; }, 350);

          // Selection logic (same as clips)
          if (e.ctrlKey || e.metaKey) {
            if (DAW.selectedSectionIds.has(sec.id)) DAW.selectedSectionIds.delete(sec.id);
            else DAW.selectedSectionIds.add(sec.id);
            renderClips();
            return;
          }
          // If clicking an already-selected section, preserve full multi-selection for cross-lane drag
          if (!DAW.selectedSectionIds.has(sec.id)) {
            DAW.selectedSectionIds = new Set([sec.id]);
            DAW.selectedIds.clear();
            renderClips();
          }

          // Build cross-lane drag items from ALL selected items (clips + sections)
          const dragItems = [];
          selectedClips().forEach(c => dragItems.push({ id: c.id, origStart: c.start, origDur: c.duration, origOffset: c.offset }));
          (DAW.sections || []).filter(s => DAW.selectedSectionIds.has(s.id)).forEach(s => dragItems.push({ id: s.id, origStart: s.start, origDur: s.duration, origOffset: 0, _isSection: true }));
          if (dragItems.length === 0) return;

          DAW.drag = { type: 'move', edge: null, primaryId: sec.id, startX: e.clientX, items: dragItems };
          document.addEventListener('mousemove', onDocMouseMove);
          document.addEventListener('mouseup', onDocMouseUp);
        });
        // Resize handles (left + right) with snap
        const resL = document.createElement('div');
        resL.className = 'resize-handle left';
        resL.addEventListener('mousedown', (e) => {
          e.stopPropagation(); e.preventDefault();
          const startX = e.clientX; const origStart = sec.start; const origDur = sec.duration;
          const onMove = (ev) => {
            const dt = xToTime(ev.clientX - startX);
            let newStart = snapTime(origStart + dt); let newDur = origStart + origDur - newStart;
            if (newStart < 0) { newDur += newStart; newStart = 0; }
            if (newDur >= 0.5) { sec.start = roundMs(newStart); sec.duration = roundMs(newDur); el.style.left = timeToX(sec.start) + 'px'; el.style.width = Math.max(50, timeToX(sec.duration)) + 'px'; }
          };
          const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveState(); };
          document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
        });
        const resR = document.createElement('div');
        resR.className = 'resize-handle right';
        resR.addEventListener('mousedown', (e) => {
          e.stopPropagation(); e.preventDefault();
          const startX = e.clientX; const origDur = sec.duration;
          const onMove = (ev) => { sec.duration = Math.max(0.5, roundMs(snapTime(origDur + xToTime(ev.clientX - startX)))); el.style.width = Math.max(50, timeToX(sec.duration)) + 'px'; };
          const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveState(); };
          document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
        });
        el.appendChild(resL);
        el.appendChild(resR);
        lane.appendChild(el);
      });
    }

    function updatePlayheadUI() {
      const x = timeToX(DAW.playhead); $('main-playhead').style.left = x + 'px'; $('playhead-hit').style.left = x + 'px';
      $('time-display').value = formatTime(DAW.playhead); $('ph-label').textContent = formatTime(DAW.playhead);
      const activeChord = DAW.clips.filter(c => c.type === 'chord' && DAW.playhead >= c.start && DAW.playhead < c.start + c.duration).pop();
      if (activeChord && $('live-chord')) $('live-chord').textContent = activeChord.name;
      else if ($('live-chord')) $('live-chord').textContent = 'None';
    }

    function autoScrollToPlayhead() {
      const scroll = $('tl-scroll');
      if (!scroll) return;
      const x = timeToX(DAW.playhead);
      const margin = 80;
      if (x < scroll.scrollLeft + margin) {
        scroll.scrollLeft = Math.max(0, x - margin);
      } else if (x > scroll.scrollLeft + scroll.clientWidth - margin) {
        scroll.scrollLeft = Math.max(0, x - scroll.clientWidth + margin);
      }
    }

    function updateHud() { $('clip-count').textContent = String(DAW.clips.length + (DAW.sections || []).length); }

    // ===== ICON PICKER =====
    const ICON_SVG_MAP = {
      '🎤': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
      '🎸': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 2l-2 2c-1.5 1.5-4 1.5-5.5 0L11 6l-2-2c-1.5-1.5-4-1.5-5.5 0L2 4V20l2-2c1.5 1.5 4 1.5 5.5 0l1.5-1.5 2 2c1.5 1.5 4 1.5 5.5 0l2-2V2z"/><line x1="7" y1="11" x2="13" y2="17"/><line x1="11" y1="7" x2="17" y2="13"/></svg>',
      '🎹': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="6" y1="2" x2="6" y2="14"/><line x1="10" y1="2" x2="10" y2="14"/><line x1="14" y1="2" x2="14" y2="14"/><line x1="18" y1="2" x2="18" y2="14"/><rect x="4" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="8" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="12" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="16" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/></svg>',
      '🎺': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8m0 0l4 4m-4-4l-4 4"/><circle cx="12" cy="18" r="4"/><path d="M8 22h8"/></svg>',
      '🎻': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6m6-6v6"/><ellipse cx="12" cy="16" rx="6" ry="8"/><line x1="12" y1="8" x2="12" y2="24"/></svg>',
      '🥁': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="6"/><line x1="4" y1="6" x2="4" y2="18"/><line x1="20" y1="6" x2="20" y2="18"/><path d="M8 2l4 4m4-4l-4 4"/></svg>',
      '🎷': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l2 6-4 4"/><path d="M18 2l-2 6 4 4"/><path d="M12 8v14"/><circle cx="12" cy="22" r="2"/></svg>',
      '🎵': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
      '🎶': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 9l12-2"/></svg>',
      '🎼': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="9" y1="9" x2="21" y2="7"/></svg>',
      '🎙️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/><circle cx="12" cy="1" r="1" fill="currentColor"/></svg>',
      '🎧': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
      '📡': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/><circle cx="12" cy="12" r="2"/></svg>',
      '🎛️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
      '⏺': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>',
      '♫': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
      '🏷': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    };
    if (typeof IconRegistry !== 'undefined') { Object.assign(ICON_SVG_MAP, IconRegistry.getAll()); }
    function getIconSvg(icon) { return ICON_SVG_MAP[icon] || icon; }

    const INSTRUMENT_ICONS = ['🎤','🎸','🎹','🎺','🎻','🥁','🎷','🎵','🎶','🎼','🎙️','🎧','📡','🎛️','⏺','♫','🏷'];

    let _iconPickerTrack = null;

    function openIconPicker(track) {
      _iconPickerTrack = track;
      const grid = $('iconPickerGrid');
      grid.innerHTML = '';
      INSTRUMENT_ICONS.forEach(icon => {
        const item = document.createElement('div');
        item.className = 'icon-picker-item' + (icon === track.icon ? ' active' : '');
        item.innerHTML = getIconSvg(icon);
        item.onclick = () => {
          track.icon = icon;
          $('iconPickerOverlay').classList.remove('show');
          _iconPickerTrack = null;
          saveState(); renderAll();
        };
        grid.appendChild(item);
      });
      $('iconPickerOverlay').classList.add('show');
    }

    // Close icon picker on overlay click
    if ($('iconPickerOverlay')) {
      $('iconPickerOverlay').addEventListener('click', (e) => {
        if (e.target === $('iconPickerOverlay')) {
          $('iconPickerOverlay').classList.remove('show');
          _iconPickerTrack = null;
        }
      });
    }

    // ===== HEADER RESIZE (drag to resize track names column) =====
    (function initHeaderResize() {
      const resizeEl = document.getElementById('timelineHeaderResize');
      const grid = document.querySelector('.timeline-workspace-grid');
      if (!resizeEl || !grid) return;

      let startX = 0, startW = 0;
      const onMouseMove = (e) => {
        const dx = e.clientX - startX;
        const newW = Math.max(120, Math.min(500, startW + dx));
        grid.style.gridTemplateColumns = newW + 'px 4px 1fr';
        document.documentElement.style.setProperty('--header-w', newW + 'px');
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      resizeEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-w')) || 240;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    })();

    function addNewTrack(name, icon) {
      const n = DAW.tracks.length + 1; ensureAudioCtx();
      const newT = { id: uid('t'), name: name || `Line ${n}`, icon: icon || '🎛️', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0, locked: false };
      newT._pannerNode = DAW.audioCtx.createStereoPanner(); newT._gainNode = DAW.audioCtx.createGain();
      newT._pannerNode.connect(newT._gainNode); newT._gainNode.connect(DAW.masterGain); DAW.tracks.push(newT);
      saveState(); renderAll(); toast(t('newTrackAdded'));
    }

     let _audioSaveTimer = null;
     let _audioSaveRunning = false;
     let _audioSaveQueued = false;

     function scheduleAudioBlobSave() {
     if (!edCur?.id) return;

     clearTimeout(_audioSaveTimer);

    _audioSaveTimer = setTimeout(async () => {
    if (_audioSaveRunning) {
      _audioSaveQueued = true;
      return;
    }

    _audioSaveRunning = true;

    try {
      await saveAudioBlobsForProject(edCur.id);
    } catch (e) {
      console.warn('Audio save error:', e);
    } finally {
      _audioSaveRunning = false;

      if (_audioSaveQueued) {
        _audioSaveQueued = false;
        scheduleAudioBlobSave();
      }
    }
  }, 1200);
}

    function openFileForTrack(trackId) { DAW.loadTrackId = trackId; renderTracks(); $('audio-file-input').value = ''; $('audio-file-input').click(); }
    $('audio-file-input').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0]; const trackId = DAW.loadTrackId; DAW.loadTrackId = null; renderTracks();
      if (!file || !trackId) return;
      // Clear all selections before import
      clearSelection();
      try {
        ensureAudioCtx(); toast(t('decoding')); const { buffer } = await decodeFileToBuffer(file);
        
        // ایجاد شناسه پایدار برای کلیپ
        const clipId = 'clip_' + uid('c');
        
        // ذخیره در Pool
        const storageMode = await askAudioCopyMode(file.name);
        const storage = {
          mode: storageMode ? 'copy' : 'reference',
          projectPath: storageMode ? `Audio/${clipId}_${file.name}` : null,
          externalPath: storageMode ? null : (isElectron && file.path ? file.path : null)
        };
        
        DAW.pool[clipId] = {
          id: clipId,
          name: file.name.replace(/\.[^.]+$/, ''),
          originalName: file.name,
          storage: storage,
          sampleRate: buffer.sampleRate,
          channels: buffer.numberOfChannels,
          frames: buffer.length,
          duration: buffer.duration,
          offlineOps: []
        };
        
        // ذخیره در کش با کلید clipId
        DAW.bufferCache.set(clipId, buffer);

        const clip = {
          id: clipId,
          type: 'audio',
          trackId,
          name: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          start: roundMs(DAW.playhead),
          duration: buffer.duration,
          offset: 0,
          sourceDuration: buffer.duration,
          color: COLORS[DAW.clips.length % COLORS.length],
          _peaks: peaksFromBuffer(buffer, 2000),
          waveUrl: null,
          _embedded: storageMode,
          // ─── ذخیره Blob اصلی برای ذخیره حجم (به‌جای Base64) ───
          // این فایل MP3/WAV اصلی هست که مستقیماً در IndexedDB ذخیره می‌شه
          _originalBlob: storageMode ? file : null
        };
        // ذخیره مسیر/هندل فایل برای لینک‌شده‌ها
        if (!storageMode) {
          if (isElectron && file.path) {
            clip._filePath = file.path;
            console.log(`[INPUT] Electron file path saved: ${file.name} → ${file.path}`);
          } else if (isElectron) {
            // در الکترون ولی file.path موجود نیست (الکترون 32+)
            console.warn(`[INPUT] Electron but file.path is missing for: ${file.name}`);
            if (window.electronAPI && window.electronAPI.getPathForFile) {
              try {
                const filePath = await window.electronAPI.getPathForFile(file);
                if (filePath) {
                  clip._filePath = filePath;
                  console.log(`[INPUT] Got path via webUtils: ${file.name} → ${filePath}`);
                }
              } catch(_) {}
            }
            if (!clip._filePath) {
              try {
                await saveAudioBlobToDB(clipId, file, file.name);
                console.log(`[INPUT] Saved as blob fallback: ${file.name}`);
              } catch(e) {
                console.warn('[BLOB] Could not save file blob to IndexedDB:', e);
              }
            }
          } else {
            // ─── در مرورگر: فایل رو به‌صورت Blob در IndexedDB ذخیره کن ───
            try {
              await saveAudioBlobToDB(clipId, file, file.name);
            } catch(e) {
              console.warn('[BLOB] Could not save file blob to IndexedDB:', e);
            }
          }
        }
        refreshClipWaveImage(clip); DAW.clips.push(clip); DAW.selectedIds = new Set([clip.id]); ensureTimelineFits(clip.start + clip.duration + 5);
        saveState(); renderAll(); if (DAW.isPlaying) scheduleAllFromPlayhead();
        if (storageMode) {
          toast(`${t('loadedOk')} ${clip.name} (کپی در پروژه)`);
          saveAudioBlobsForProject(edCur.id).catch(() => {});
        } else {
          toast(`${t('loadedOk')} ${clip.name} (لینک — فقط مسیر ذخیره شد)`);
        }
        edSaveSong();
      } catch (err) { console.error(err); toast(t('loadFailed')); }
    });

    function setSelection(ids) {
  DAW.selectedIds = new Set(ids);
  renderClips();
  updateHud();
}

    function clearSelection() { DAW.selectedIds.clear(); DAW.selectedSectionIds.clear(); renderClips(); updateHud(); }
   function clearEditorTextSelection() {
     window.getSelection()?.removeAllRanges();
     $('editor')?.blur();
}

    // --- Clipboard Service Bridge ---
    // The service depends on editor callbacks, which are declared in the
    // later editor chunk. Create it lazily after that chunk is evaluated.
    let clipboardService = null;
    function getClipboardService() {
      if (clipboardService) return clipboardService;
      if (typeof ClipboardService !== 'function' || typeof edSaveSong !== 'function') return null;
      clipboardService = new ClipboardService({
        DAW,
        selectedClips,
        uid,
        roundMs,
        peaksFromBuffer,
        refreshClipWaveImage,
        ensureTimelineFits,
        saveState,
        renderAll,
        scheduleAllFromPlayhead,
        stopAllVoices,
        toast,
        t,
        edSaveSong
      });
      return clipboardService;
    }

    function deleteSelected() { getClipboardService()?.deleteSelected(); }
    function copySelected() { getClipboardService()?.copySelected(); }
    function cutSelected() { getClipboardService()?.cutSelected(); }
    function pasteClipboard() { getClipboardService()?.pasteClipboard(); }
    function duplicateSelected() { getClipboardService()?.duplicateSelected(); }
    function splitClipAt(clip, atTime) {
      const t = roundMs(atTime); if (t <= clip.start + 0.01 || t >= clip.start + clip.duration - 0.01) return null;
      const leftDur = roundMs(t - clip.start); const rightDur = roundMs(clip.duration - leftDur);
      clip.duration = leftDur; if (clip.type === 'audio') refreshClipWaveImage(clip);
      const right = { ...clip, id: uid('c'), start: t, duration: rightDur };
      if (clip.type === 'audio') { right.offset = roundMs(clip.offset + leftDur); refreshClipWaveImage(right); }
      DAW.clips.push(right); return right;
    }

    function splitSelectedAtPlayhead() {
      const sels = selectedClips(); if (!sels.length) { toast(t('nothingSelected')); return; } const created = [];
      sels.forEach(c => { const r = splitClipAt(c, DAW.playhead); if (r) created.push(r.id); });
      if (created.length) { DAW.selectedIds = new Set(created); saveState(); renderAll(); if (DAW.isPlaying) scheduleAllFromPlayhead(); toast(t('splitDone')); }
    }

    function cutAtTime(time, trackId = null) {
  const t = roundMs(time);
  if (!trackId) return false;

  const hits = DAW.clips.filter(c => {
    if (c.trackId !== trackId) return false;
    return t > c.start + 0.01 &&
           t < c.start + c.duration - 0.01;
  });

      if (!hits.length) {
        seekTransport(t, true);
        toast(t('noClipToCut'));
        return false;
      }

      const created = [];
sels.forEach(c => {
  if (c.type !== 'chord') return;
  const r = splitClipAt(c, DAW.playhead);
  if (r) created.push(r.id);
});


      seekTransport(t, true);
      if (created.length) {
        DAW.selectedIds = new Set(created);
        saveState(); renderAll();
        if (DAW.isPlaying) scheduleAllFromPlayhead();
        toast(`${t('clipsCut')}: ${hits.length}`);
        return true;
      }
      renderAll();
      return false;
    }

    function clientToTime(clientX) { const inner = $('tl-inner').getBoundingClientRect(); return clamp(xToTime(clientX - inner.left), 0, getProjectEnd()); }
    function clientToInnerPoint(clientX, clientY) { const inner = $('tl-inner').getBoundingClientRect(); return { x: clientX - inner.left, y: clientY - inner.top }; }

    function onClipMouseDown(e) {
  if (e.button !== 0) return;

  clearEditorTextSelection();
  edClearChordSelection();
  if ($('editor')) $('editor').blur();

  // Deselect sections when clicking on any clip
  if (DAW.selectedSectionIds.size > 0) { DAW.selectedSectionIds.clear(); renderClips(); }

  e.stopPropagation();
  e.preventDefault();

  const clipId = e.currentTarget.dataset.clipId;
  const clip = getClip(clipId);
  if (!clip) return;

  // Check if track is locked
  const track = DAW.tracks.find(t => t.id === clip.trackId);
  if (track && track.locked) { toast('ترک قفل است'); return; }

  edClearChordSelection();

  // دبل‌کلیک سفارشی (native dblclick به خاطر preventDefault و بازسازی کلیپ‌ها قابل‌اعتماد نیست)
  const _now = Date.now();
  const _dx = Math.abs(e.clientX - (clip._clickX || 0));
  const _dy = Math.abs(e.clientY - (clip._clickY || 0));
  if (clip._clickTimer && (_now - (clip._clickTime || 0)) < 350 && _dx < 5 && _dy < 5) {
    clearTimeout(clip._clickTimer); clip._clickTimer = null;
    if (clip.type === 'chord') openChordEditor(clip.id);
    return;
  }
  clip._clickX = e.clientX; clip._clickY = e.clientY; clip._clickTime = _now;
  clip._clickTimer = setTimeout(() => { clip._clickTimer = null; }, 350);

      // Shift+Click to Cut
      if (e.shiftKey) {
        const t = clientToTime(e.clientX);
        cutAtTime(t, clip.trackId);
        return;
      }

      // Alt+Click to Duplicate (Copy and immediately drag the copy)
      if (e.altKey) {
        const sels = selectedClips();
        if (!sels.find(c => c.id === clipId)) DAW.selectedIds = new Set([clipId]);
        
        const toDuplicate = selectedClips();
        const newIds = [];
        const dragItems = [];
        
        toDuplicate.forEach(c => {
            const newClip = { ...c, id: uid('c') };
            delete newClip._peaks;
            if (c.type === 'audio') {
                const buf = DAW.bufferCache.get(c.bufferKey);
                if (buf) newClip._peaks = peaksFromBuffer(buf, 2000);
                refreshClipWaveImage(newClip);
            }
            DAW.clips.push(newClip);
            newIds.push(newClip.id);
            dragItems.push({ id: newClip.id, origStart: newClip.start, origDur: newClip.duration, origOffset: newClip.offset });
        });
        
        DAW.selectedIds = new Set(newIds);
        DAW.drag = { type: 'move', edge: null, primaryId: dragItems[0]?.id, startX: e.clientX, items: dragItems };
        renderAll();
        document.addEventListener('mousemove', onDocMouseMove);
        document.addEventListener('mouseup', onDocMouseUp);
        return;
      }

      if (e.ctrlKey || e.metaKey) { if (DAW.selectedIds.has(clipId)) DAW.selectedIds.delete(clipId); else DAW.selectedIds.add(clipId); renderClips(); return; }
      // If clicking an already-selected clip, preserve the full multi-selection for cross-lane drag
      if (!DAW.selectedIds.has(clipId)) { DAW.selectedIds = new Set([clipId]); DAW.selectedSectionIds.clear(); renderClips(); }

      const edge = e.target.dataset.edge || null;
      let dragItems;
      if (edge) {
        // Resize: only the clicked clip
        dragItems = [{ id: clipId, origStart: clip.start, origDur: clip.duration, origOffset: clip.offset }];
      } else {
        // Move: all selected clips + all selected sections
        dragItems = selectedClips().map(c => ({ id: c.id, origStart: c.start, origDur: c.duration, origOffset: c.offset }));
        (DAW.sections || []).filter(s => DAW.selectedSectionIds.has(s.id)).forEach(s => dragItems.push({ id: s.id, origStart: s.start, origDur: s.duration, origOffset: 0, _isSection: true }));
      }
      DAW.drag = { type: edge ? 'resize' : 'move', edge, primaryId: clipId, startX: e.clientX, items: dragItems };
      document.addEventListener('mousemove', onDocMouseMove); document.addEventListener('mouseup', onDocMouseUp);
    }

    let dragOverLaneTrackId = null;

    function onDocMouseMove(e) {
      if (DAW.drag) {
        const dt = xToTime(e.clientX - DAW.drag.startX);
        
        // Check if we're over a different track lane during move
        if (DAW.drag.type === 'move') {
          const targetLane = e.target.closest('.track-lane');
          if (targetLane) {
            const laneTrackId = targetLane.dataset.trackId;
            const targetTrack = DAW.tracks.find(t => t.id === laneTrackId);
            // Only allow drop on audio tracks (not section or chord)
            if (targetTrack && targetTrack.type === 'audio') {
              dragOverLaneTrackId = laneTrackId;
            } else {
              dragOverLaneTrackId = null;
            }
          } else {
            dragOverLaneTrackId = null;
          }
        }
        
        if (DAW.drag.type === 'move') {
          DAW.drag.items.forEach(it => {
            let item;
            if (it._isSection) { item = (DAW.sections || []).find(s => s.id === it.id); }
            else { item = getClip(it.id); }
            if (!item) return;
            item.start = Math.max(0, roundMs(snapTime(it.origStart + dt)));
            ensureTimelineFits(item.start + (item.duration || it.origDur) + 5);
          });
        } else if (DAW.drag.type === 'resize') {
          const it = DAW.drag.items.find(x => x.id === DAW.drag.primaryId); const clip = getClip(DAW.drag.primaryId); if (!it || !clip) return;
          if (DAW.drag.edge === 'right') {
            const maxDur = clip.type === 'chord' ? 1000 : clip.sourceDuration - clip.offset;
            clip.duration = clamp(roundMs(snapTime(it.origDur + dt)), 0.03, maxDur); if (clip.type === 'audio') refreshClipWaveImage(clip);
          } else {
            let newStart = it.origStart + dt, newOffset = it.origOffset + dt, newDur = it.origDur - dt;
            if (clip.type === 'chord') {
               if (newStart < 0) { newDur += newStart; newStart = 0; }
               if (newDur > 0.03) { clip.start = roundMs(snapTime(newStart)); clip.duration = roundMs(it.origStart + it.origDur - snapTime(newStart)); }
            } else {
               if (newOffset < 0) { newStart -= newOffset; newDur += newOffset; newOffset = 0; }
               if (newStart < 0) { const sh = -newStart; newStart = 0; newOffset += sh; newDur -= sh; }
               if (newDur >= 0.03 && newOffset + newDur <= clip.sourceDuration + 1e-6) { clip.start = roundMs(newStart); clip.offset = roundMs(newOffset); clip.duration = roundMs(newDur); refreshClipWaveImage(clip); }
            }
          }
        }
        renderRuler(); renderClips(); updateHud();
      }
      if (DAW.marquee) {
        const p = clientToInnerPoint(e.clientX, e.clientY); const x1 = Math.min(DAW.marquee.x0, p.x), y1 = Math.min(DAW.marquee.y0, p.y);
        const x2 = Math.max(DAW.marquee.x0, p.x), y2 = Math.max(DAW.marquee.y0, p.y); const box = $('marquee');
        box.style.display = 'block'; box.style.left = x1 + 'px'; box.style.top = y1 + 'px'; box.style.width = (x2 - x1) + 'px'; box.style.height = (y2 - y1) + 'px';
        // Select clips inside marquee
        const clipIds = [];
        document.querySelectorAll('.clip').forEach(el => { const r = el.getBoundingClientRect(), ir = $('tl-inner').getBoundingClientRect(); const cx1 = r.left - ir.left, cy1 = r.top - ir.top, cx2 = cx1 + r.width, cy2 = cy1 + r.height; if (!(cx2 < x1 || cx1 > x2 || cy2 < y1 || cy1 > y2)) clipIds.push(el.dataset.clipId); });
        DAW.selectedIds = new Set(clipIds);
        document.querySelectorAll('.clip').forEach(el => el.classList.toggle('selected', DAW.selectedIds.has(el.dataset.clipId)));
        // Select sections inside marquee
        const secIds = [];
        document.querySelectorAll('.section-tag').forEach(el => { const r = el.getBoundingClientRect(), ir = $('tl-inner').getBoundingClientRect(); const cx1 = r.left - ir.left, cy1 = r.top - ir.top, cx2 = cx1 + r.width, cy2 = cy1 + r.height; if (!(cx2 < x1 || cx1 > x2 || cy2 < y1 || cy1 > y2)) secIds.push(el.dataset.sectionId); });
        DAW.selectedSectionIds = new Set(secIds);
        document.querySelectorAll('.section-tag').forEach(el => el.classList.toggle('selected', DAW.selectedSectionIds.has(el.dataset.sectionId)));
      }
    }

    function onDocMouseUp() {
      if (DAW.drag) {
        // If we were dragging over a different track lane, move clips to that track
        if (DAW.drag.type === 'move' && dragOverLaneTrackId) {
          DAW.drag.items.forEach(it => {
            const clip = getClip(it.id);
            if (clip && !it._isSection) {
              clip.trackId = dragOverLaneTrackId;
            }
          });
        }
        dragOverLaneTrackId = null;
        DAW.drag = null;
        saveState();
        if (DAW.isPlaying) scheduleAllFromPlayhead();
        renderAll();
      }
      if (DAW.marquee) { DAW.marquee = null; $('marquee').style.display = 'none'; renderClips(); }
      document.removeEventListener('mousemove', onDocMouseMove); document.removeEventListener('mouseup', onDocMouseUp);
    }

    function seekTransport(t, keepPlaying = true, noSnap = false) {
      DAW.playhead = PlayheadMath.clamp(roundMs(noSnap ? t : snapTime(t)), getProjectEnd());
      if (DAW.isPlaying) { var _ori = PlayheadMath.createOrigin(performance.now(), DAW.playhead); DAW.playOriginPerf = _ori.playOriginPerf; DAW.playOriginTime = _ori.playOriginTime; }
      updatePlayheadUI(); if (DAW.isPlaying && !DAW.isScrubbing) scheduleAllFromPlayhead(); else stopAllVoices();
    }

    // Return-to-start on pause (Cubase style)
    let returnToStartOnPause = false;
    let playStartPos = 0;

    function toggleReturnToStart() {
      returnToStartOnPause = !returnToStartOnPause;
      const btn = $('returnToStartBtn');
      if (btn) {
        btn.style.background = returnToStartOnPause ? 'var(--accent-teal)' : '';
        btn.style.color = returnToStartOnPause ? '#000' : '';
        btn.style.borderColor = returnToStartOnPause ? 'var(--accent-teal)' : '';
      }
      toast(returnToStartOnPause ? 'برگشت به ابتدا فعال شد' : 'برگشت به ابتدا غیرفعال شد');
    }

    function togglePlay() {
      if (DAW.isPlaying) {
        if (returnToStartOnPause) {
          const savedPos = playStartPos;
          pauseTransport();
          seekTransport(savedPos, false);
        } else {
          pauseTransport();
        }
      } else {
        playStartPos = DAW.playhead;
        startTransport();
      }
    }

    function startTransport() {
      ensureAudioCtx();
      DAW.isPlaying = true; DAW.isScrubbing = false; var _ori = PlayheadMath.createOrigin(performance.now(), DAW.playhead); DAW.playOriginPerf = _ori.playOriginPerf; DAW.playOriginTime = _ori.playOriginTime;
      $('play-btn').style.color = 'var(--accent-neon-pink)'; scheduleAllFromPlayhead();

      // Update perf play button
      if (perfModeActive) $('perfPlayBtn').textContent = '⏸';

      // Auto-start metronome if enabled
      if (metroActive && !metroTimer) startMetronome();

      const tick = () => {
        if (!DAW.isPlaying) return;
        if (!DAW.isScrubbing) DAW.playhead = PlayheadMath.getElapsed(performance.now(), DAW.playOriginPerf, DAW.playOriginTime);

        // Loop A-B: if playhead reaches B, jump back to A (math delegated to PlayheadMath)
        if (DAW.loopEnabled && !DAW.isRecording && DAW.playhead >= DAW.loopB) {
          var looped = PlayheadMath.applyLoop(DAW.playhead, DAW.loopEnabled, DAW.loopA, DAW.loopB);
          DAW.playhead = looped.playhead;
          var ori = PlayheadMath.createOrigin(performance.now(), DAW.playhead);
          DAW.playOriginPerf = ori.playOriginPerf;
          DAW.playOriginTime = ori.playOriginTime;
          scheduleAllFromPlayhead();
        }

        updatePlayheadUI();
        // Look-ahead scheduler runs independently of RAF. Only fall back to
        // RAF-based beat checking when the scheduler is unavailable.
        if (!getMetronomeSchedulerBridge()) checkMetronomeTick(DAW.playhead);
        const scroll = $('tl-scroll'); const x = timeToX(DAW.playhead);
        if (DAW.playheadMode === 'center') {
          // Stationary: keep playhead visually at center by scrolling
          scroll.scrollLeft = Math.max(0, x - scroll.clientWidth / 2);
        } else {
          // Page scrolling: playhead reaches right edge → jump back to left
          const margin = 60;
          if (x > scroll.scrollLeft + scroll.clientWidth - margin) {
            scroll.scrollLeft = Math.max(0, x - margin);
          } else if (x < scroll.scrollLeft + margin) {
            scroll.scrollLeft = Math.max(0, x - margin);
          }
        }
        // ─── Early prep: وقتی ۱۵ ثانیه به انتها مونده، شروع به ساختن state آهنگ بعدی کن ───
        // این زمان زیاد هست تا مطمئن بشیم حتی برای فایل‌های بزرگ هم کافیه.
        if (arrPerformActive && !_arrNextState && !arrPreparePending) {
          const end = getArrangerEnd();
          if (end > 0 && DAW.playhead >= end - 15) {
            // فقط اگر قبلاً برای این ایندکس prep شروع نشده، لاگ بزن
            if (_arrPrepStartedForIndex !== arrPerformIdx + 1) {
              _arrPrepStartedForIndex = arrPerformIdx + 1;
              console.log(`[Arranger] Starting prep at ${DAW.playhead.toFixed(1)}s (end: ${end.toFixed(1)}s)`);
            }
            arrPreparePending = true;
            prepareNextArrSong()
              .then(() => { arrPreparePending = false; })
              .catch((e) => {
                console.error('[Arranger] Prep failed:', e);
                arrPreparePending = false;
                _arrNextState = null;
              });
          }
        }
        if (DAW.playhead >= (arrPerformActive ? getArrangerEnd() : getProjectEnd())) {
          // Gapless arranger: hot-swap if next song is ready
          // Guard: اگر در حال کراس‌فید هستیم، صبر کن تا تموم شه
          if (arrPerformActive && _arrNextState && !_arrIsCrossfading) {
            const crossfadeDur = arrPerformData?.crossfade || 0;
            if (crossfadeDur > 0) arrCrossfadeSwap();
            else hotSwapToNextSong();
            DAW.rafId = requestAnimationFrame(tick); return;
          }
          // اگر کراس‌فید در حال اجراست، به تیک بعدی منتقل شو
          if (_arrIsCrossfading) {
            DAW.rafId = requestAnimationFrame(tick); return;
          }
          // ─── اگر _arrNextState آماده نیست ولی prep در حال اجراست: صبر کن (وارد حالت pause شو) ───
          // به‌جای stop، playback رو pause می‌کنیم تا وقتی prep تموم شد، ادامه بدیم
          if (arrPerformActive && !_arrNextState && arrPreparePending) {
            console.log('[Arranger] Reached end but prep still running. Entering wait mode...');
            // playback رو متوقف کن ولی transport رو stop نکن
            stopAllVoices();
            DAW.isPlaying = false;
            // ─── مکانیزم poll مستقل از tick ───
            // چون tick با DAW.isPlaying=false متوقف می‌شه، یک poll جداگانه می‌سازیم
            // که وقتی prep تموم شد، hot-swap رو انجام بده
            if (!_arrWaitPollActive) {
              _arrWaitPollActive = true;
              const waitPoll = () => {
                if (!arrPerformActive) { _arrWaitPollActive = false; return; }
                if (_arrNextState) {
                  console.log('[Arranger] Prep finished during wait — hot-swapping now');
                  _arrWaitPollActive = false;
                  if (arrPerformData?.crossfade > 0) arrCrossfadeSwap();
                  else hotSwapToNextSong();
                } else if (!arrPreparePending) {
                  // prep تموم شده ولی _arrNextState هنوز null — fallback
                  console.warn('[Arranger] Prep finished but no next state — fallback to loadArrSong');
                  _arrWaitPollActive = false;
                  arrPreparePending = true;
                  loadArrSong(arrPerformIdx + 1)
                    .then(() => { arrPreparePending = false; })
                    .catch((e) => { console.error(e); arrPreparePending = false; });
                } else {
                  // هنوز صبر کن
                  setTimeout(waitPoll, 100);
                }
              };
              setTimeout(waitPoll, 100);
            }
            return;
          }
          // ─── اگر نه prep در حال اجراست و نه _arrNextState آماده‌ست: fallback به loadArrSong ───
          if (arrPerformActive && !_arrNextState && !arrPreparePending) {
            console.warn('[Arranger] Next song not ready and no prep running — fallback to loadArrSong');
            arrPreparePending = true;
            loadArrSong(arrPerformIdx + 1)
              .then(() => { arrPreparePending = false; })
              .catch((e) => {
                console.error('[Arranger] Fallback loadArrSong failed:', e);
                arrPreparePending = false;
              });
            return;
          }
          stopTransport(); return;
        }
        // Update sync highlight during playback (works for both sync mode and popup)
        if (syncActive) updateSyncHighlight();
        else if (_lyricPopup && !_lyricPopup.closed) updateSyncHighlight();
        DAW.rafId = requestAnimationFrame(tick);
      };

      // Count-in: play metronome for N bars before starting
      if (countInBars > 0 && metroActive) {
        const bpm = parseInt($('edTempo')?.value) || 120;
        const sig = $('edTimeSig')?.value || '4/4';
        const config = getTimeSignatureGridConfig(sig, bpm);
        const beatsPerBar = config.beatsPerMeasure;
        const beatDur = config.beatDuration;
        let countBeat = 0;
        const totalBeats = countInBars * beatsPerBar;
        $('play-btn').style.color = 'var(--accent-cyan-glow)';
        toast('🔢 شمارش: ' + countInBars + ' میزان');
        const countInTick = () => {
          if (countBeat >= totalBeats) {
            DAW.isPlaying = true; DAW.isScrubbing = false; var _ori = PlayheadMath.createOrigin(performance.now(), DAW.playhead); DAW.playOriginPerf = _ori.playOriginPerf; DAW.playOriginTime = _ori.playOriginTime;
            $('play-btn').style.color = 'var(--accent-neon-pink)'; scheduleAllFromPlayhead();
            if (DAW.rafId) cancelAnimationFrame(DAW.rafId); DAW.rafId = requestAnimationFrame(tick);
            return;
          }
          playClick(countBeat % beatsPerBar === 0);
          countBeat++;
          setTimeout(countInTick, beatDur * 1000);
        };
        countInTick();
        // Stop metronome after count-in — it was only for counting
        metroActive = false;
        $('metroToggleBtn').textContent = '🔇';
        return;
      }

      DAW.isPlaying = true; DAW.isScrubbing = false; var _ori = PlayheadMath.createOrigin(performance.now(), DAW.playhead); DAW.playOriginPerf = _ori.playOriginPerf; DAW.playOriginTime = _ori.playOriginTime;
      $('play-btn').style.color = 'var(--accent-neon-pink)'; scheduleAllFromPlayhead();
      if (DAW.rafId) cancelAnimationFrame(DAW.rafId); DAW.rafId = requestAnimationFrame(tick);
    }

    function pauseTransport() {
      if (DAW.isRecording) endRec();
      DAW.isPlaying = false; DAW.isScrubbing = false; if (DAW.rafId) cancelAnimationFrame(DAW.rafId); DAW.rafId = null; stopAllVoices(); $('play-btn').style.color = 'var(--accent-cyan-glow)'; updatePlayheadUI();

      // Auto-stop metronome
      if (metroTimer) stopMetronome();

      // Clear sync highlights in editor
      const editorEl = $('editor');
      if (editorEl) [...editorEl.children].forEach(el => { el.classList.remove('sync-playing', 'sync-done'); });

      // Update perf play button
      if (perfModeActive) $('perfPlayBtn').textContent = '▶';
    }
    function stopTransport() { pauseTransport(); DAW.playhead = 0; updatePlayheadUI();
      // Auto-advance arranger when song finishes
      if (arrPerformActive && arrPerformData) {
        // If pause mode, don't auto-advance
        if (perfPauseMode && perfModeActive) {
          if (perfModeActive) renderPerfUI();
          return;
        }
        loadArrSong(arrPerformIdx + 1);
      }
      // Update perf UI play button
      if (perfModeActive) { $('perfPlayBtn').textContent = '▶'; renderPerfUI(); }
    }
    // Arranger end: uses selectionEnd if defined, otherwise end of song content
    // Does NOT depend on loopEnabled — selection range is separate from loop
    function getArrangerEnd() {
      if (selectionEnd > 0) return selectionEnd;
      // Fallback: end of last clip/section in current project
      let end = 0;
      DAW.clips.forEach(c => end = Math.max(end, c.start + c.duration));
      DAW.sections.forEach(s => end = Math.max(end, s.start + s.duration));
      return end > 0 ? end : getProjectEnd();
    }
    function transportToStart() { seekTransport(0); }
    function transportToEnd() { let end = 0; DAW.clips.forEach(c => end = Math.max(end, c.start + c.duration)); seekTransport(end); }

    /* ============================================================
       RECORDING (mic/input) + MIXER
       ============================================================ */
    function ensureRecLane() {
      let tr = DAW.tracks.find(t => t.id === 'tRec');
      if (!tr) {
        ensureAudioCtx();
        tr = { id: 'tRec', name: 'Rec', icon: '●', type: 'audio', isRec: true, muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0, locked: false };
        const idx = DAW.tracks.findIndex(t => t.type === 'section');
        if (idx >= 0) DAW.tracks.splice(idx + 1, 0, tr); else DAW.tracks.push(tr);
      }
      if (tr.type === 'audio' && !tr._gainNode) {
        ensureAudioCtx();
        tr._pannerNode = DAW.audioCtx.createStereoPanner();
        tr._gainNode = DAW.audioCtx.createGain();
        tr._pannerNode.connect(tr._gainNode);
        tr._gainNode.connect(DAW.masterGain);
      }
      if (typeof updateTrackMix === 'function') updateTrackMix(tr.id);
      return tr;
    }

    function updateRecUI() {
      const btn = $('recBtn');
      if (btn) btn.classList.toggle('rec-on', !!DAW.isRecording);
      const laneName = document.querySelector('.track-name[data-track-id="tRec"]');
      if (laneName) laneName.classList.toggle('rec-lane-name', !!DAW.isRecording);
      const lane = document.querySelector('.track-lane[data-track-id="tRec"]');
      if (lane) lane.classList.toggle('rec-lane', !!DAW.isRecording);
    }

    function recMimeType() {
      if (typeof MediaRecorder === 'undefined') return undefined;
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      for (const t of types) {
        try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (_) {}
      }
      return undefined;
    }

    async function startRec() {
      if (DAW.isRecording) return;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('ضبط صدا در این محیط پشتیبانی نمی‌شود'); return;
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err) {
        console.error(err);
        toast('دسترسی به میکروفن/ورودی صوتی رد شد'); return;
      }
      try {
        const ctx = ensureAudioCtx();
        const recLane = ensureRecLane(); renderAll();
        const audioSource = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
        const dest = ctx.createMediaStreamDestination();
        audioSource.connect(analyser);
        analyser.connect(dest);

        const chunks = [];
        const mrType = recMimeType();
        const recorder = new MediaRecorder(dest.stream, mrType ? { mimeType: mrType } : undefined);
        recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mrType || recorder.mimeType || 'audio/webm' });
          finishRec(blob);
        };

        DAW.isRecording = true;
        DAW.recLaneId = recLane ? recLane.id : 'tRec';
        DAW.recStartTime = DAW.playhead;
        DAW.recEndTime = DAW.playhead;
        DAW.recPeaks = [];
        DAW.recAnalyser = analyser;
        DAW.recStream = stream;
        DAW.recMediaRecorder = recorder;

        try { recorder.start(250); } catch (e) {
          console.error(e); toast('خطا در شروع ضبط');
          DAW.isRecording = false; cleanupRecResources(); return;
        }
        renderAll();
        updateRecUI();
        if (!DAW.isPlaying) startTransport();
        toast('● ضبط شروع شد — برای توقف R را بزنید');

        const tickRecWave = () => {
          if (!DAW.isRecording) { DAW.recRafId = null; return; }
          try {
            const data = new Float32Array(DAW.recAnalyser.fftSize);
            DAW.recAnalyser.getFloatTimeDomainData(data);
            let max = 0;
            for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > max) max = a; }
            DAW.recPeaks.push(max);
          } catch (_) {}
          renderLiveRecWave();
          DAW.recRafId = requestAnimationFrame(tickRecWave);
        };
        DAW.recRafId = requestAnimationFrame(tickRecWave);
      } catch (err) {
        console.error(err);
        toast('خطا در راه‌اندازی ضبط');
        DAW.isRecording = false; cleanupRecResources();
      }
    }

    function cleanupRecResources() {
      if (DAW.recRafId) { cancelAnimationFrame(DAW.recRafId); DAW.recRafId = null; }
      try { if (DAW.recMediaRecorder && DAW.recMediaRecorder.state !== 'inactive') DAW.recMediaRecorder.stop(); } catch (_) {}
      try { if (DAW.recStream) DAW.recStream.getTracks().forEach(t => t.stop()); } catch (_) {}
      DAW.recStream = null; DAW.recMediaRecorder = null; DAW.recAnalyser = null; DAW.recPeaks = [];
      document.querySelectorAll('.rec-live-clip').forEach(el => el.remove());
    }

    function endRec() {
      if (!DAW.isRecording) return;
      DAW.recEndTime = DAW.playhead;
      cleanupRecResources(); // رویداد onstop، finishRec را صدا می‌زند
      DAW.isRecording = false;
      updateRecUI();
    }

    function toggleRec() {
      if (DAW.isRecording) {
        endRec();
        if (DAW.isPlaying) pauseTransport();
      } else {
        startRec();
      }
    }

    function renderLiveRecWave() {
      const lane = document.querySelector('.track-lane[data-track-id="' + DAW.recLaneId + '"]');
      if (!lane) return;
      const dur = Math.max(0.02, DAW.playhead - DAW.recStartTime);
      const w = Math.min(20000, Math.max(6, Math.floor(timeToX(dur))));
      let el = document.querySelector('.clip.rec-live-clip');
      if (!el) {
        el = document.createElement('div');
        el.className = 'clip rec-live-clip';
        el.dataset.rec = '1';
        el.style.top = '6px';
        el.style.height = 'calc(var(--lane-h) - 12px)';
        el.style.pointerEvents = 'none';
        lane.appendChild(el);
      }
      el.style.left = timeToX(DAW.recStartTime) + 'px';
      el.style.width = w + 'px';
      el.innerHTML = '<img class="clip-wave" src="' + recWaveDataUrl(DAW.recPeaks, w, 52) + '"><div class="clip-title">● ضبط زنده</div>';
    }

    function recWaveDataUrl(peaks, w, h) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, w); canvas.height = Math.max(2, h);
      const c = canvas.getContext('2d');
      c.fillStyle = 'rgba(255,120,120,0.9)';
      const mid = h / 2;
      for (let i = 0; i < w; i++) {
        const idx = Math.min(peaks.length - 1, Math.floor((i / w) * peaks.length));
        const amp = Math.min(1, peaks[idx] || 0);
        const hh = Math.max(1.5, amp * (h * 0.86));
        c.fillRect(i, mid - hh / 2, 1, hh);
      }
      return canvas.toDataURL('image/png');
    }

    function finishRec(blob) {
      const start = DAW.recStartTime || 0;
      const end = (DAW.recEndTime != null && DAW.recEndTime >= start) ? DAW.recEndTime : DAW.playhead;
      const dur = Math.max(0.05, end - start);
      if (!blob || blob.size < 500) { toast('ضبط خالی بود'); return; }
      (async () => {
        try {
          ensureAudioCtx();
          const { buffer } = await decodeFileToBuffer(blob);
          const bufferKey = 'rec_' + uid('b') + '_' + Date.now();
          DAW.bufferCache.set(bufferKey, buffer);
          const clip = {
            id: uid('c'), type: 'audio', trackId: DAW.recLaneId || 'tRec',
            name: 'Recording ' + formatTime(start),
            start: roundMs(start), duration: roundMs(dur), offset: 0,
            sourceDuration: buffer.duration,
            color: '#EF4444', bufferKey,
            _peaks: peaksFromBuffer(buffer, 2000), waveUrl: null,
            _embedded: true, _originalBlob: blob
          };
          refreshClipWaveImage(clip);
          DAW.clips.push(clip);
          DAW.selectedIds = new Set([clip.id]);
          ensureTimelineFits(clip.start + clip.duration + 5);
          saveState(); renderAll();
          try { await saveAudioBlobToDB(bufferKey, blob, 'recording.webm'); } catch (_) {}
          toast('✓ ضبط ذخیره شد');
        } catch (err) {
          console.error(err);
          toast('خطا در ذخیره‌ی ضبط');
        }
      })();
    }

    /* ===== MIXER ===== */
    let _mixerPos = null;
    function toggleMixer() {
      const p = $('mixerPanel'); if (!p) return;
      initMixerDrag();
      const show = !p.classList.contains('show');
      p.classList.toggle('show', show);
      if (show) { if (_mixerPos) { p.style.transform = 'none'; p.style.left = _mixerPos.left + 'px'; p.style.top = _mixerPos.top + 'px'; } renderMixer(); }
    }
    function renderMixer() {
      const wrap = $('mixerChannels'); if (!wrap) return;
      wrap.innerHTML = '';
      const tracks = DAW.tracks.filter(t => t.type === 'audio');
      if (!tracks.length) { wrap.innerHTML = '<div style="color:var(--text-secondary);padding:12px;">ترک صوتی وجود ندارد</div>'; return; }
      tracks.forEach(tr => {
        const ch = document.createElement('div');
        ch.className = 'mixer-channel' + (tr.id === 'tRec' ? ' rec-channel' : '');
        const volPct = Math.round((tr.vol || 0) * 100);
        const bal = tr.pan < 0 ? 'L ' + Math.round(Math.abs(tr.pan) * 100) : (tr.pan > 0 ? 'R ' + Math.round(tr.pan * 100) : '(C)');
        ch.innerHTML =
          '<div class="mixer-ch-top"><span class="mixer-ch-name">' + (tr.icon || '') + '</span>' +
          '<input class="mixer-ch-name-input" value="' + tr.name + '" data-mn="' + tr.id + '" title="تغییر نام لاین" spellcheck="false"></div>' +
          '<div class="mixer-ch-controls">' +
            '<button class="t-btn ' + (tr.muted ? 'on' : '') + '" data-mm="' + tr.id + '" title="Mute">M</button>' +
            '<button class="t-btn ' + (tr.solo ? 'on-solo' : '') + '" data-ms="' + tr.id + '" title="Solo">S</button>' +
          '</div>' +
          '<div class="mixer-ch-fader"><label>Volume (' + volPct + '%)</label>' +
            '<input type="range" min="0" max="1" step="0.01" value="' + (tr.vol || 0) + '" data-mv="' + tr.id + '"></div>' +
          '<div class="mixer-ch-fader"><label>Balance ' + bal + '</label>' +
            '<input type="range" min="-1" max="1" step="0.01" value="' + (tr.pan || 0) + '" data-mp="' + tr.id + '"></div>';
        wrap.appendChild(ch);
      });
      wrap.querySelectorAll('[data-mn]').forEach(inp => inp.addEventListener('change', () => {
        const tr = DAW.tracks.find(t => t.id === inp.dataset.mn); if (!tr) return;
        tr.name = inp.value.trim() || tr.name; saveState(); renderTracks(); renderClips(); if (DAW.isPlaying) scheduleAllFromPlayhead();
      }));
      wrap.querySelectorAll('[data-mm]').forEach(b => b.addEventListener('click', () => {
        const tr = DAW.tracks.find(t => t.id === b.dataset.mm); if (!tr) return;
        tr.muted = !tr.muted; updateTrackMix(tr.id); renderMixer(); renderTracks(); renderClips(); if (DAW.isPlaying) scheduleAllFromPlayhead();
      }));
      wrap.querySelectorAll('[data-ms]').forEach(b => b.addEventListener('click', () => {
        const tr = DAW.tracks.find(t => t.id === b.dataset.ms); if (!tr) return;
        tr.solo = !tr.solo; DAW.tracks.forEach(t => updateTrackMix(t.id)); renderMixer(); renderTracks(); renderClips(); if (DAW.isPlaying) scheduleAllFromPlayhead();
      }));
      wrap.querySelectorAll('[data-mv]').forEach(r => r.addEventListener('input', () => {
        const tr = DAW.tracks.find(t => t.id === r.dataset.mv); if (!tr) return;
        tr.vol = +r.value; updateTrackMix(tr.id);
        r.parentElement.querySelector('label').textContent = 'Volume (' + Math.round(tr.vol * 100) + '%)';
      }));
      wrap.querySelectorAll('[data-mp]').forEach(r => {
        r.addEventListener('input', () => {
          const tr = DAW.tracks.find(t => t.id === r.dataset.mp); if (!tr) return;
          tr.pan = +r.value; updateTrackMix(tr.id);
          const lab = r.parentElement.querySelector('label');
          lab.textContent = 'Balance ' + (tr.pan < 0 ? 'L ' + Math.round(Math.abs(tr.pan) * 100) : (tr.pan > 0 ? 'R ' + Math.round(tr.pan * 100) : '(C)'));
        });
        r.addEventListener('dblclick', (e) => {
          e.preventDefault();
          const tr = DAW.tracks.find(t => t.id === r.dataset.mp); if (!tr) return;
          tr.pan = 0; r.value = 0; updateTrackMix(tr.id);
          r.parentElement.querySelector('label').textContent = 'Balance (C)';
        });
      });
    }
    function initMixerDrag() {
      const panel = $('mixerPanel'); if (!panel || panel._dragReady) return;
      panel._dragReady = true;
      const head = panel.querySelector('.mixer-head'); if (!head) return;
      head.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        const rect = panel.getBoundingClientRect();
        panel.style.transform = 'none';
        const offX = e.clientX - rect.left, offY = e.clientY - rect.top;
        const move = (ev) => {
          let x = ev.clientX - offX, y = ev.clientY - offY;
          x = Math.max(-panel.offsetWidth + 80, Math.min(x, window.innerWidth - 40));
          y = Math.max(0, Math.min(y, window.innerHeight - 30));
          panel.style.left = x + 'px'; panel.style.top = y + 'px';
        };
        const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); const r = panel.getBoundingClientRect(); _mixerPos = { left: r.left, top: r.top }; };
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      });
    }

    /* ============================================================
       SETTINGS (theme, audio device, toggles) + movable windows
       ============================================================ */
    const SETTINGS_KEY = 'ed_app_settings';
    let APP_SETTINGS = {};
    function loadSettings(){ try { APP_SETTINGS = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch(_){ APP_SETTINGS = {}; } }
    function saveSettings(){ try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(APP_SETTINGS)); } catch(_){} }
    const THEMES = {
      dark:     { '--dark-bg':'#0F131E', '--panel-bg':'#161B26', '--workspace-bg':'#121622', '--timeline-bg':'#0D1017', '--accent-teal':'#3FB8AF', '--accent-cyan-glow':'#00F2FE', '--accent-neon-pink':'#FF2E93' },
      midnight: { '--dark-bg':'#0a0c14', '--panel-bg':'#12141f', '--workspace-bg':'#0d0f18', '--timeline-bg':'#090b11', '--accent-teal':'#818CF8', '--accent-cyan-glow':'#A5B4FC', '--accent-neon-pink':'#FF6BB5' },
      ocean:    { '--dark-bg':'#04131c', '--panel-bg':'#0a2230', '--workspace-bg':'#071b27', '--timeline-bg':'#051420', '--accent-teal':'#21D4FD', '--accent-cyan-glow':'#4FB3E8', '--accent-neon-pink':'#FF7EB3' },
      sunset:   { '--dark-bg':'#1a0f14', '--panel-bg':'#2a1a22', '--workspace-bg':'#221320', '--timeline-bg':'#1a1018', '--accent-teal':'#FF9E6D', '--accent-cyan-glow':'#FFB1A8', '--accent-neon-pink':'#FF4D8D' },
      forest:   { '--dark-bg':'#08130d', '--panel-bg':'#101f16', '--workspace-bg':'#0c1811', '--timeline-bg':'#08140d', '--accent-teal':'#34D399', '--accent-cyan-glow':'#6EE7B7', '--accent-neon-pink':'#F472B6' }
    };
    function applyThemeVars(vars) { const r = document.documentElement.style; if (!vars) return; for (const k in vars) r.setProperty(k, vars[k]); }
    function applyTheme(name) {
      applyThemeVars(THEMES[name] || null);
      APP_SETTINGS.theme = name || 'dark'; saveSettings();
      if (APP_SETTINGS.accent) { const r = document.documentElement.style; r.setProperty('--accent-teal', APP_SETTINGS.accent); r.setProperty('--accent-cyan-glow', APP_SETTINGS.accent); }
    }
    function applyAccent(color) {
      const r = document.documentElement.style;
      r.setProperty('--accent-teal', color); r.setProperty('--accent-cyan-glow', color);
      APP_SETTINGS.accent = color; saveSettings();
    }
    async function loadOutputDevices() {
      const sel = $('setOutDevice'); if (!sel) return;
      try {
        if (navigator && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devs = await navigator.mediaDevices.enumerateDevices();
          devs.filter(d => d.kind === 'audiooutput').forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId; opt.textContent = d.label || ('خروجی ' + (sel.options.length + 1));
            sel.appendChild(opt);
          });
        }
      } catch(_) {}
      sel.value = APP_SETTINGS.outDevice || 'default';
    }
    function applyOutputDevice(id) {
      APP_SETTINGS.outDevice = id; saveSettings();
      try {
        const ctx = ensureAudioCtx();
        if (ctx && ctx.destination && typeof ctx.destination.setSinkId === 'function') {
          ctx.destination.setSinkId(id).then(() => toast('دستگاه خروجی تغییر کرد')).catch(() => toast('تغییر دستگاه پشتیبانی نمی‌شود'));
        } else { toast('تغییر دستگاه خروجی پشتیبانی نمی‌شود'); }
      } catch(_) { toast('تغییر دستگاه خروجی پشتیبانی نمی‌شود'); }
    }
    function applyMetroSound(val) {
      APP_SETTINGS.metroSound = val; saveSettings();
    }
    function applySettingsToggles() {
      const metro = $('setMetronome').checked;
      if (metro !== metroActive) toggleMetronome();
      APP_SETTINGS.metronome = metro;
      returnToStartOnPause = $('setReturnToStart').checked;
      APP_SETTINGS.returnToStart = returnToStartOnPause;
      const wantLock = $('setSizeLock').checked;
      if (wantLock !== !!_sizeLocked) toggleSizeLock();
      APP_SETTINGS.sizeLock = wantLock;
      saveSettings();
    }
    function openSettings() {
      loadSettings();
      if ($('setTheme')) $('setTheme').value = APP_SETTINGS.theme || 'dark';
      if (APP_SETTINGS.accent && $('setAccent')) $('setAccent').value = APP_SETTINGS.accent;
      if ($('setMetroSound')) $('setMetroSound').value = APP_SETTINGS.metroSound || 'classic';
      if ($('setMetronome')) $('setMetronome').checked = !!metroActive;
      if ($('setReturnToStart')) $('setReturnToStart').checked = !!returnToStartOnPause;
      if ($('setSizeLock')) $('setSizeLock').checked = !!_sizeLocked;
      $('settingsModal').classList.add('show');
      $('settingsModal').focus();
      loadOutputDevices();
    }
    function syncChordLineFromLyrics() {
      if (!edCur) { toast('سندی برای سینک وجود ندارد'); return; }
      
      // 1. Extract chords from edCur.chords (parsed from Lyrics)
      const lyricsChords = edCur.chords || [];
      
      // If no chords in Lyrics
      if (lyricsChords.length === 0) { 
        toast('هیچ آکوردی در Lyrics Chord وجود ندارد.');
        return; 
      }
      
      // 2. Sort chords by spatial position from right to left (RTL reading order)
      // منطق مرتب‌سازی به js/editor/ChordLineSyncService.js منتقل شده است.
      const lyricsChordsInSyncOrder = requireChordLineSyncService().sortLyricsChordsForSync(lyricsChords);
      
      // 3. Get current Chord Line clips from DAW.clips (the actual source of truth)
      const chordTrack = DAW.tracks.find(t => t.type === 'chord');
      let currentChordLineClips = [];
      
      if (chordTrack) {
        // Get all chord clips sorted by start time (left to right on timeline)
        currentChordLineClips = DAW.clips
          .filter(c => c.type === 'chord' && c.trackId === chordTrack.id)
          .sort((a, b) => a.start - b.start);
      }
      
      // If Chord Line is empty
      if (currentChordLineClips.length === 0) {
        toast('برای همگام‌سازی، ابتدا حداقل یک آکورد در Chord Line ایجاد کنید.');
        return;
      }
      
      // 4. Apply Lyrics chords to Chord Line from left to right
      // Only update the .name property of existing clips
      // منطق اعمال به js/editor/ChordLineSyncService.js منتقل شده است.
      const appliedCount = requireChordLineSyncService().applyChordNamesToClips(lyricsChordsInSyncOrder, currentChordLineClips);
      
      // 5. Update state and re-render
      edCur.hasManualChordLineEdits = false;
      
      // Re-render Chord Line popup if open
      if (_chordLinePopup && !_chordLinePopup.closed) {
        syncChordLinePopup();
      }
      
      // Save state to persist changes
      saveState();
      
      // Re-render timeline to show updated chord clips
      renderAll();
      
      // Show result message
      if (lyricsChordsInSyncOrder.length > currentChordLineClips.length) {
        toast(`فقط ${appliedCount} آکورد اول Lyrics روی ${currentChordLineClips.length} آکورد موجود در Chord Line اعمال شد.`);
      } else {
        toast(`✔ Chord Line با موفقیت از Lyrics Chord همگام شد (${appliedCount} آکورد).`);
      }
    }
    function closeSettings() { $('settingsModal').classList.remove('show'); }
    function resetSettings() {
      localStorage.removeItem(SETTINGS_KEY);
      APP_SETTINGS = {};
      applyTheme('dark');
      const r = document.documentElement.style;
      r.removeProperty('--accent-teal'); r.removeProperty('--accent-cyan-glow'); r.removeProperty('--accent-neon-pink');
      metroActive = false; if ($('metroToggleBtn')) $('metroToggleBtn').textContent = '🔇';
      returnToStartOnPause = false;
      if (_sizeLocked) toggleSizeLock();
      openSettings();
      toast('تنظیمات بازنشانی شد');
    }
    loadSettings();
    if (APP_SETTINGS.theme) applyTheme(APP_SETTINGS.theme);
    if (APP_SETTINGS.accent) { const r = document.documentElement.style; r.setProperty('--accent-teal', APP_SETTINGS.accent); r.setProperty('--accent-cyan-glow', APP_SETTINGS.accent); }

    // Generic: drag windows from their title/header
    function initMovableWindows() {
      document.addEventListener('mousedown', (e) => {
        const head = e.target.closest('h3, h4, .mv-head, .shortcut-panel-header');
        if (!head) return;
        if (head.closest('#arrangerModal')) return;
        const panel = head.closest('.mv-window') || head.closest('.chord-editor') || head.closest('.icon-picker-panel') || head.closest('.arr-song-note-panel') || head.closest('.shortcut-panel');
        if (!panel) return;
        if (e.target.closest('button, input, select, textarea')) return;
        e.preventDefault();
        const r = panel.getBoundingClientRect();
        const w = panel.offsetWidth, h = panel.offsetHeight;
        panel.style.position = 'fixed';
        panel.style.margin = '0';
        panel.style.left = r.left + 'px';
        panel.style.top = r.top + 'px';
        const ox = e.clientX - r.left, oy = e.clientY - r.top;
        const move = (me) => {
          let x = me.clientX - ox, y = me.clientY - oy;
          x = Math.max(-w + 60, Math.min(x, window.innerWidth - 40));
          y = Math.max(0, Math.min(y, window.innerHeight - 30));
          panel.style.left = x + 'px'; panel.style.top = y + 'px';
        };
        const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      });
    }
    initMovableWindows();

    // Playhead mode toggle
    function togglePlayheadMode() {
      DAW.playheadMode = DAW.playheadMode === 'page' ? 'center' : 'page';
      const btn = $('playheadModeBtn');
      if (btn) btn.classList.toggle('ph-center', DAW.playheadMode === 'center');
      toast(DAW.playheadMode === 'center' ? 'پلی‌هدر ثابت در مرکز' : 'اسکرول صفحه‌ای');
    }

    /* ===== HIGHLIGHT EFFECT ===== */
    const HL_EFFECTS = ['neon', 'frost', 'shift', 'depth', 'pulse'];
    const HL_NAMES = { neon: 'Neon Glow', frost: 'Frosted Glass', shift: 'Color Shift', depth: 'Double Shadow', pulse: 'Pulse Glow' };

    function getHighlightEffect() { return edCur?.styles?.highlightEffect || 'depth'; }

    function setHighlightEffect(effect) {
      if (!HL_EFFECTS.includes(effect)) return;
      if (!edCur) return;
      edCur.styles.highlightEffect = effect;
      // Update selector UI
      document.querySelectorAll('.hl-opt').forEach(el => {
        el.classList.toggle('active', el.dataset.effect === effect);
      });
      const nameEl = $('hl-effect-name');
      if (nameEl) nameEl.textContent = HL_NAMES[effect] || effect;
      // Apply to editor container
      applyHighlightClassToEditor();
      // Apply to popup
      applyHighlightClassToPopup();
      edSaveSong();
    }

    function applyHighlightClassToEditor() {
      const ed = $('editor');
      if (!ed) return;
      HL_EFFECTS.forEach(hl => ed.classList.remove('hl-' + hl));
      ed.classList.add('hl-' + getHighlightEffect());
    }

    function applyHighlightClassToPopup() {
      if (!_lyricPopup || _lyricPopup.closed) return;
      const popupDoc = _lyricPopup.document;
      if (!popupDoc) return;
      const body = popupDoc.body;
      if (!body) return;
      HL_EFFECTS.forEach(hl => body.classList.remove('hl-' + hl));
      body.classList.add('hl-' + getHighlightEffect());
    }

    function initHighlightEffect() {
      const effect = getHighlightEffect();
      document.querySelectorAll('.hl-opt').forEach(el => {
        el.classList.toggle('active', el.dataset.effect === effect);
      });
      const nameEl = $('hl-effect-name');
      if (nameEl) nameEl.textContent = HL_NAMES[effect] || effect;
      applyHighlightClassToEditor();
    }

    /* ===== LOOP A-B ===== */
    function toggleLoop() {
      DAW.loopEnabled = !DAW.loopEnabled;
      const btn = $('loopToggleBtn');
      if (btn) btn.classList.toggle('loop-active', DAW.loopEnabled);
      renderLoopRegion();
      toast(DAW.loopEnabled ? 'Loop ON' : 'Loop OFF');
    }

    function setLoopA() {
      DAW.loopA = DAW.playhead;
      if (DAW.loopB <= DAW.loopA) DAW.loopB = Math.max(DAW.loopA + 1, DAW.loopA + 5);
      renderLoopRegion();
      toast('Loop A: ' + formatTime(DAW.loopA));
    }

    function setLoopB() {
      DAW.loopB = DAW.playhead;
      if (DAW.loopA >= DAW.loopB) DAW.loopA = Math.max(0, DAW.loopB - 5);
      renderLoopRegion();
      toast('Loop B: ' + formatTime(DAW.loopB));
    }

    function clearLoop() {
      DAW.loopA = 0;
      DAW.loopB = 10;
      selectionEnd = 0;
      renderLoopRegion();
      toast('محدوده پاک شد');
    }

    // P key: set loop range from selection (no activate)
    function setLoopFromSelection() {
      const sels = selectedClips();
      if (!sels.length) { toast('آیتمی انتخاب نشده'); return; }
      const starts = sels.map(c => c.start);
      const ends = sels.map(c => c.start + c.duration);
      DAW.loopA = Math.min(...starts);
      DAW.loopB = Math.max(...ends);
      selectionEnd = DAW.loopB;
      DAW.loopEnabled = false;
      renderLoopRegion();
      toast('محدوده: ' + formatTime(DAW.loopA) + ' → ' + formatTime(DAW.loopB));
    }

    // Alt+P: set loop range from selection + activate + play from start
    function setLoopFromSelectionAndPlay() {
      const sels = selectedClips();
      if (!sels.length) { toast('آیتمی انتخاب نشده'); return; }
      const starts = sels.map(c => c.start);
      const ends = sels.map(c => c.start + c.duration);
      DAW.loopA = Math.min(...starts);
      DAW.loopB = Math.max(...ends);
      DAW.loopEnabled = true;
      DAW.playhead = DAW.loopA;
      const btn = $('loopToggleBtn');
      if (btn) btn.classList.add('loop-active');
      renderLoopRegion();
      updatePlayheadUI();
      // Stop any current playback, then start fresh from loopA
      if (DAW.isPlaying) { DAW.isPlaying = false; if (DAW.rafId) cancelAnimationFrame(DAW.rafId); stopAllVoices(); }
      startTransport();
      toast('Loop ON: ' + formatTime(DAW.loopA) + ' → ' + formatTime(DAW.loopB));
    }

    function renderLoopRegion() {
      const strip = $('loop-strip');
      const locators = $('loop-locators');
      const locLeft = $('loop-loc-left');
      const locRight = $('loop-loc-right');
      const hasRange = DAW.loopA < DAW.loopB;

      if (!hasRange) {
        if (strip) strip.style.display = 'none';
        if (locators) locators.style.display = 'none';
        return;
      }

      const xA = timeToX(DAW.loopA);
      const xB = timeToX(DAW.loopB);
      const w = xB - xA;

      if (strip) {
        strip.style.display = 'block';
        strip.style.left = xA + 'px';
        strip.style.width = w + 'px';
        if (DAW.loopEnabled) {
          strip.classList.add('loop-active');
          strip.classList.remove('loop-inactive');
        } else {
          strip.classList.remove('loop-active');
          strip.classList.add('loop-inactive');
        }
      }
      if (locators) locators.style.display = 'block';
      if (locLeft) locLeft.style.left = (xA - 5) + 'px';
      if (locRight) locRight.style.left = (xB - 5) + 'px';
    }

    // Cubase-style locator dragging on ruler
    (function initLoopDrag() {
      let dragTarget = null;

      $('loop-loc-left')?.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); dragTarget = 'A'; addDragListeners(); });
      $('loop-loc-right')?.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); dragTarget = 'B'; addDragListeners(); });

      function addDragListeners() {
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragUp);
      }
      function onDragMove(e) {
        if (!dragTarget) return;
        const inner = $('tl-inner');
        if (!inner) return;
        const rect = inner.getBoundingClientRect();
        const t = clamp(xToTime(e.clientX - rect.left), 0, getProjectEnd());
        if (dragTarget === 'A') {
          DAW.loopA = Math.min(t, DAW.loopB - 0.5);
        } else {
          DAW.loopB = Math.max(t, DAW.loopA + 0.5);
        }
        renderLoopRegion();
      }
      function onDragUp() {
        if (dragTarget) { dragTarget = null; saveState(); }
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragUp);
      }
    })();

    /* ===== POPUP WINDOW FULLSCREEN ===== */
    let _lyricPopup = null;
    let _focusMode = false;
    let _savedGridRows = ''; // saved gridTemplateRows before focus mode
    function toggleFocusMode() {
      _focusMode = !_focusMode;
      document.body.classList.toggle('focus-mode', _focusMode);
      // Override inline gridTemplateRows from timeline-sep drag
      const grid = $('app-container') || document.querySelector('.app-container');
      if (grid) {
        if (_focusMode) {
          _savedGridRows = grid.style.gridTemplateRows;
          grid.style.gridTemplateRows = '';
        } else {
          grid.style.gridTemplateRows = _savedGridRows || '';
        }
      }
      if (_focusMode) toast(t('focusMode'));
      else toast(t('normalMode'));
      if (typeof edCur !== 'undefined' && edCur) { setTimeout(() => edRenderChords(), 50); }
    }
    function openLyricPopup() {
      if (_lyricPopup && !_lyricPopup.closed) { _lyricPopup.focus(); return; }
      _lyricPopup = window.open('', 'lyricPopup', 'width=900,height=700,menubar=no,toolbar=no,location=no,status=no');
      if (!_lyricPopup) { toast(t('popupBlocked')); return; }
      try { _lyricPopup.__popupRole = 'player'; } catch(_) {}
      syncLyricPopup();
      setTimeout(safeMirrorTimeline, 1000);
    }

    // ===== LYRIC-ONLY POPUP (singer view, no chords) =====
    let _lyricOnlyPopup = null;
    function openLyricOnlyPopup() {
      if (_lyricOnlyPopup && !_lyricOnlyPopup.closed) { _lyricOnlyPopup.focus(); return; }
      _lyricOnlyPopup = window.open('', 'lyricOnlyPopup', 'width=650,height=400,menubar=no,toolbar=no,location=no,status=no');
      if (!_lyricOnlyPopup) { toast(t('popupBlocked')); return; }
      try { _lyricOnlyPopup.__popupRole = 'singer'; } catch(_) {}
      syncLyricOnlyPopup();
    }
    function syncLyricOnlyPopup() {
      if (!_lyricOnlyPopup || _lyricOnlyPopup.closed) return;
      if (!edCur) return;
      const doc = _lyricOnlyPopup.document;
      const title = edCur.title || 'بدون نام';
      const artist = edCur.artist || '';
      const tSize = edCur.styles?.tSize || 38;
      const tColor = edCur.styles?.tColor || '#0fa966';
      const tFont = edCur.styles?.tFont || 'Vazirmatn';
      const tBold = edCur.styles?.tBold ? 'bold' : 'normal';
      const align = edCur.styles?.align || 'center';
      const lines = (edCur.lyrics || '').split('\n');

      doc.title = title + ' — ' + artist + ' | خواننده';
      doc.documentElement.dir = 'rtl';
      doc.documentElement.lang = 'fa';
      doc.head.innerHTML = `
        <style>
          @font-face { font-family: 'Vazirmatn'; src: url('../fonts/Vazirmatn-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'Vazirmatn Bold'; src: url('../fonts/Vazirmatn-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Thin'; src: url('../fonts/Vazirmatn-Thin.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Black'; src: url('../fonts/Vazirmatn-Black.woff2') format('woff2'); }
          @font-face { font-family: 'BArshia'; src: url('../fonts/BArshia.woff2') format('woff2'); }
          @font-face { font-family: 'BFarnaz'; src: url('../fonts/BFarnaz.woff2') format('woff2'); }
          @font-face { font-family: 'BJadid'; src: url('../fonts/BJadidBd.woff2') format('woff2'); }
          @font-face { font-family: 'BZar'; src: url('../fonts/BZar.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'BZar Bold'; src: url('../fonts/BZarBd.woff2') format('woff2'); }
          @font-face { font-family: 'Lalezar'; src: url('../fonts/Lalezar-Regular.woff2') format('woff2'); }
          @font-face { font-family: 'Mada'; src: url('../fonts/Mada-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Rubik'; src: url('../fonts/Rubik-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'JetBrains Mono'; src: url('../fonts/JetBrainsMono-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'JetBrains Mono Bold'; src: url('../fonts/JetBrainsMono-Bold.woff2') format('woff2'); }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0F131E; color: #E2E8F0; font-family: 'Vazirmatn', sans-serif; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
          .lop-header { text-align: center; padding: 8px 12px 4px; background: linear-gradient(180deg, #1C2333, #161B26); border-bottom: 1px solid #232B3E; }
          .lop-header .title { font-size: 15px; font-weight: 900; color: #00F2FE; }
          .lop-header .sub { font-size: 10px; color: #718096; }
          .lop-body { flex: 1; overflow: auto; padding: 16px 20px; position: relative; line-height: 2.4; }
          .lop-body { flex: 1; overflow-y: auto; padding: 16px; }
          .eline { min-height: 1.2em; white-space: pre-wrap; }
          .lop-active { color: #FF2E93 !important; text-shadow: 0 0 8px rgba(255,46,147,0.5); }
          .lop-active-bg { background: rgba(255,46,147,0.08); border-radius: 6px; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #1A202C; }
          ::-webkit-scrollbar-thumb { background: #4A5568; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #718096; }
        </style>`;
      let html = `<div class="lop-header"><div class="title">${title}</div><div class="sub">${artist}</div></div><div class="lop-body" id="lopBody">`;
      lines.forEach((line, i) => {
        html += `<div class="eline" data-li="${i}" style="font-size:${tSize}px;color:${tColor};font-family:'${tFont}';font-weight:${tBold};text-align:${align};">${line || '\u200B'}</div>`;
      });
      html += '</div>';
      doc.body.innerHTML = html;
      doc.body.setAttribute('data-popup-role', 'singer');

      // Sync playhead highlight
      window.addEventListener('message', function lopSync(ev) {
        if (ev.data?.type === 'syncUpdate') {
          if (_lyricOnlyPopup.closed) { window.removeEventListener('message', lopSync); return; }
          const body = _lyricOnlyPopup.document.getElementById('lopBody');
          if (!body) return;
          const activeIdx = ev.data.activeIdx;
          [...body.children].forEach(el => {
            if (!el.dataset.li) return;
            const li = +el.dataset.li;
            el.classList.toggle('lop-active', li === activeIdx);
            el.classList.toggle('lop-active-bg', li === activeIdx);
          });
          if (activeIdx >= 0) {
            const activeEl = body.querySelector('[data-li="' + activeIdx + '"]');
            if (activeEl) {
              const bodyH = body.clientHeight;
              const elTop = activeEl.offsetTop;
              const elH = activeEl.offsetHeight;
              body.scrollTo({ top: elTop - bodyH / 2 + elH / 2, behavior: 'smooth' });
            }
          }
        }
      });
      // Direct highlight sync (same pattern as lyricPopup)
      function _syncSingerHighlight() {
        if (!_lyricOnlyPopup || _lyricOnlyPopup.closed) return;
        const body = _lyricOnlyPopup.document.getElementById('lopBody');
        if (!body) return;
        const times = edCur?.syncTimes || [];
        const t = DAW?.playhead || 0;
        let activeIdx = -1;
        for (let i = 0; i < times.length; i++) {
          if (Number.isFinite(times[i]) && times[i] <= t) activeIdx = i;
          else if (Number.isFinite(times[i]) && times[i] > t) break;
        }
        [...body.children].forEach(el => {
          if (!el.dataset.li) return;
          const li = +el.dataset.li;
          el.classList.toggle('lop-active', li === activeIdx);
          el.classList.toggle('lop-active-bg', li === activeIdx);
        });
        if (activeIdx >= 0) {
          const activeEl = body.querySelector('[data-li="' + activeIdx + '"]');
          if (activeEl) {
            const bodyH = body.clientHeight;
            body.scrollTo({ top: activeEl.offsetTop - bodyH / 2 + activeEl.offsetHeight / 2, behavior: 'smooth' });
          }
        }
      }
      _lyricOnlyPopup._syncHighlight = _syncSingerHighlight;
    }

    // ===== CHORD LINE POPUP (detachable, small) =====
    let _chordLinePopup = null;
    function openChordLinePopup() {
      if (_chordLinePopup && !_chordLinePopup.closed) { _chordLinePopup.focus(); return; }
      _chordLinePopup = window.open('', 'chordLinePopup', 'width=650,height=400,menubar=no,toolbar=no,location=no,status=no');
      if (!_chordLinePopup) { toast(t('popupBlocked')); return; }
      syncChordLinePopup();
    }
    function syncChordLinePopup() {
      if (!_chordLinePopup || _chordLinePopup.closed) return;
      if (!edCur) return;
      const doc = _chordLinePopup.document;
      const title = edCur.title || 'بدون نام';
      const artist = edCur.artist || '';
      const keyStr = SongMetadata.getDisplayKey(edCur);
      const tSize = edCur.styles?.tSize || 38;
      const tColor = edCur.styles?.tColor || '#0fa966';
      const tFont = edCur.styles?.tFont || 'Vazirmatn';
      const tBold = edCur.styles?.tBold ? 'bold' : 'normal';
      const align = edCur.styles?.align || 'center';
      const cSize = edCur.styles?.cSize || 38;
      const cColor = edCur.styles?.cColor || '#e6aa28';
      const cFont = edCur.styles?.cFont || 'JetBrains Mono';
      const lines = (edCur.lyrics || '').split('\n');
      // Use independent chordLineClips state - this is the source of truth for Chord Line display
      const chordLineClips = edCur.chordLineClips || [];
      const transpose = edCur.transpose || 0;
      // Render chords from chordLineClips with transpose applied
      const chords = chordLineClips.map(ch => ({ 
        lineIndex: ch.lineIndex, 
        charIndex: ch.charIndex, 
        anchorType: ch.anchorType, 
        _name: ch.name ? edTransposeChord(ch.name, transpose) : '' 
      }));

      doc.title = title + ' — ' + artist + ' | Chord Line';
      doc.documentElement.dir = 'rtl';
      doc.documentElement.lang = 'fa';
      doc.head.innerHTML = `
        <style>
          @font-face { font-family: 'Vazirmatn'; src: url('../fonts/Vazirmatn-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'Vazirmatn Bold'; src: url('../fonts/Vazirmatn-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Thin'; src: url('../fonts/Vazirmatn-Thin.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Black'; src: url('../fonts/Vazirmatn-Black.woff2') format('woff2'); }
          @font-face { font-family: 'BArshia'; src: url('../fonts/BArshia.woff2') format('woff2'); }
          @font-face { font-family: 'BFarnaz'; src: url('../fonts/BFarnaz.woff2') format('woff2'); }
          @font-face { font-family: 'BJadid'; src: url('../fonts/BJadidBd.woff2') format('woff2'); }
          @font-face { font-family: 'BZar'; src: url('../fonts/BZar.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'BZar Bold'; src: url('../fonts/BZarBd.woff2') format('woff2'); }
          @font-face { font-family: 'Lalezar'; src: url('../fonts/Lalezar-Regular.woff2') format('woff2'); }
          @font-face { font-family: 'Mada'; src: url('../fonts/Mada-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Rubik'; src: url('../fonts/Rubik-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'JetBrains Mono'; src: url('../fonts/JetBrainsMono-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'JetBrains Mono Bold'; src: url('../fonts/JetBrainsMono-Bold.woff2') format('woff2'); }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0F131E; color: #E2E8F0; font-family: 'Vazirmatn', sans-serif; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
          .clp-header { text-align: center; padding: 8px 12px 4px; background: linear-gradient(180deg, #1C2333, #161B26); border-bottom: 1px solid #232B3E; }
          .clp-header .title { font-size: 15px; font-weight: 900; color: #00F2FE; }
          .clp-header .sub { font-size: 10px; color: #718096; }
          .clp-controls { display: flex; gap: 8px; padding: 8px 12px; background: #161B26; border-bottom: 1px solid #232B3E; align-items: center; justify-content: center; }
          .clp-btn { background: #232B3E; color: #E2E8F0; border: 1px solid #2D3748; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.15s; }
          .clp-btn:hover { background: #2D3748; border-color: #4A5568; }
          .clp-btn:active { transform: translateY(1px); }
          .clp-btn-primary { background: #0fa966; border-color: #0fa966; color: #fff; }
          .clp-btn-primary:hover { background: #0c8a54; }
          .clp-body { flex: 1; overflow: auto; padding: 16px 20px; position: relative; line-height: 2.4; }
          .clp-body { flex: 1; overflow-y: auto; padding: 16px; }
          .eline { min-height: 1.2em; white-space: pre-wrap; }
          .clp-chord { position: absolute; pointer-events: none; font-weight: bold; color: ${cColor}; font-family: '${cFont}', monospace; font-size: ${cSize}px; direction: ltr; white-space: nowrap; z-index: 5; }
          .clp-chord-line { position: absolute; width: 2px; pointer-events: none; opacity: .4; background: ${cColor}; z-index: 4; }
          .clp-active { color: #FF2E93 !important; text-shadow: 0 0 8px rgba(255,46,147,0.5); }
          .clp-active-bg { background: rgba(255,46,147,0.08); border-radius: 6px; }
        </style>`;
      let html = `<div class="clp-header"><div class="title">${title}</div><div class="sub">${artist} · ${keyStr}</div></div>`;
      // Add controls container with Sync and Transpose buttons
      html += `<div class="clp-controls">
        <button class="clp-btn clp-btn-primary" id="clpSyncBtn" title="بروزرسانی Chord Line از Lyrics Chord">🔄 سینک</button>
        <button class="clp-btn" id="clpTransDown" title="بمل">♭</button>
        <span id="clpTransVal" style="color:#718096;font-size:12px;font-weight:600;min-width:24px;text-align:center;display:inline-block;">${transpose > 0 ? '+' : ''}${transpose}</span>
        <button class="clp-btn" id="clpTransUp" title="دیز">♯</button>
        <button class="clp-btn" id="clpCopyBtn" title="کپی آکوردها">✔ کپی</button>
      </div>`;
      html += `<div class="clp-body" id="clpBody">`;
      lines.forEach((line, i) => {
        html += `<div class="eline" data-li="${i}" style="font-size:${tSize}px;color:${tColor};font-family:'${tFont}';font-weight:${tBold};text-align:${align};">${line || '\u200B'}</div>`;
      });
      html += '</div>';
      doc.body.innerHTML = html;

      // Attach event listeners to controls
      const syncBtn = doc.getElementById('clpSyncBtn');
      const transUpBtn = doc.getElementById('clpTransUp');
      const transDownBtn = doc.getElementById('clpTransDown');
      const transValSpan = doc.getElementById('clpTransVal');
      const copyBtn = doc.getElementById('clpCopyBtn');

      // Sync button: copy chords from Lyrics to chordLineClips with spatial ordering
      if (syncBtn) {
        syncBtn.onclick = () => {
          if (!edCur) return;
          
          // 1. Extract chords from edCur.chords (parsed from Lyrics)
          const lyricsChords = edCur.chords || [];
          
          // If no chords in Lyrics
          if (lyricsChords.length === 0) { 
            toast('هیچ آکوردی در Lyrics Chord وجود ندارد.');
            return; 
          }
          
          // 2. Sort chords by spatial position from right to left (RTL reading order)
          // For Persian text: index 0 is on the far right, higher indices go to the left
          // So ascending sort (a.charIndex - b.charIndex) gives us right-to-left order
          const lyricsChordsInSyncOrder = [...lyricsChords].sort((a, b) => {
            if (a.lineIndex !== b.lineIndex) {
              return a.lineIndex - b.lineIndex;
            }
            // Ascending order: smaller charIndex (right side) comes first
            return a.charIndex - b.charIndex;
          });
          
          // 3. Get current Chord Line clips
          const currentChordLineClips = edCur.chordLineClips || [];
          
          // If Chord Line is empty
          if (currentChordLineClips.length === 0) {
            toast('برای همگام‌سازی، ابتدا حداقل یک آکورد در Chord Line ایجاد کنید.');
            return;
          }
          
          // 4. Apply Lyrics chords to Chord Line from left to right
          let appliedCount = Math.min(lyricsChordsInSyncOrder.length, currentChordLineClips.length);
          
          for (let i = 0; i < appliedCount; i++) {
            currentChordLineClips[i].name = lyricsChordsInSyncOrder[i].name;
          }
          
          // 5. Update state and re-render
          edCur.chordLineClips = currentChordLineClips;
          edCur.hasManualChordLineEdits = false;
          syncChordLinePopup();
          
          // Show result message
          if (lyricsChordsInSyncOrder.length > currentChordLineClips.length) {
            toast(`فقط ${appliedCount} آکورد اول Lyrics روی ${currentChordLineClips.length} آکورد موجود در Chord Line اعمال شد.`);
          } else {
            toast(`✔ Chord Line با موفقیت از Lyrics Chord همگام شد (${appliedCount} آکورد).`);
          }
        };
      }

      // Transpose Up button: only modify chordLineClips
      if (transUpBtn) {
        transUpBtn.onclick = () => {
          if (!edCur || !edCur.chordLineClips) return;
          const newTranspose = (edCur.transpose || 0) + 1;
          edCur.transpose = newTranspose;
          // Update transpose display
          if (transValSpan) transValSpan.textContent = (newTranspose > 0 ? '+' : '') + newTranspose;
          // Re-render chords with new transpose (only affects chordLineClips)
          syncChordLinePopup();
        };
      }

      // Transpose Down button: only modify chordLineClips
      if (transDownBtn) {
        transDownBtn.onclick = () => {
          if (!edCur || !edCur.chordLineClips) return;
          const newTranspose = (edCur.transpose || 0) - 1;
          edCur.transpose = newTranspose;
          // Update transpose display
          if (transValSpan) transValSpan.textContent = (newTranspose > 0 ? '+' : '') + newTranspose;
          // Re-render chords with new transpose (only affects chordLineClips)
          syncChordLinePopup();
        };
      }

      // Copy button: copy chord names to clipboard
      if (copyBtn) {
        copyBtn.onclick = () => {
          if (!edCur || !edCur.chordLineClips || edCur.chordLineClips.length === 0) {
            toast('آکوردی برای کپی وجود ندارد');
            return;
          }
          const transpose = edCur.transpose || 0;
          const chordNames = edCur.chordLineClips.map(ch => ch.name ? edTransposeChord(ch.name, transpose) : '').filter(n => n);
          if (chordNames.length === 0) {
            toast('آکوردی برای کپی وجود ندارد');
            return;
          }
          const textToCopy = chordNames.join(' ');
          navigator.clipboard.writeText(textToCopy).then(() => {
            toast('✔ ' + chordNames.length + ' آکورد کپی شد');
          }).catch(() => {
            toast('خطا در کپی');
          });
        };
      }

      // Render chords
      const pb = doc.getElementById('clpBody');
      const wrapRect = pb.getBoundingClientRect();
      const GAP = Math.max(10, cSize * 0.6);
      const MARGIN = 5;

      chords.forEach(ch => {
        if (!ch._name) return;
        const lineEl = pb.children[ch.lineIndex];
        if (!lineEl) return;

        const segs = [];
        let total = 0;
        const walker = doc.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          segs.push({ node, start: total, len: node.textContent.length });
          total += node.textContent.length;
        }
        if (!segs.length) return;

        const len = total;
        const r = doc.createRange();
        if (ch.anchorType === 'LineStart') {
          const s = segs[0]; r.setStart(s.node, 0); r.setEnd(s.node, Math.min(1, s.len));
        } else if (ch.anchorType === 'LineEnd') {
          const s = segs[segs.length - 1]; const p = Math.max(0, s.len - 1);
          r.setStart(s.node, p); r.setEnd(s.node, Math.min(p + 1, s.len));
        } else {
          const ci = Math.min(ch.charIndex, Math.max(0, len - 1));
          const s = segs.find(sg => ci >= sg.start && ci < sg.start + sg.len) || segs[segs.length - 1];
          const local = Math.max(0, ci - s.start);
          r.setStart(s.node, Math.min(local, s.len));
          r.setEnd(s.node, Math.min(local + 1, s.len));
        }
        const rect = r.getBoundingClientRect();
        const x = (ch.anchorType === 'LineStart') ? rect.right + MARGIN : (ch.anchorType === 'LineEnd') ? rect.left - MARGIN : (rect.left + rect.right) / 2;
        const top = rect.top - wrapRect.top + pb.scrollTop - cSize - GAP;

        const el = doc.createElement('span');
        el.className = 'clp-chord';
        el.textContent = ch._name;
        el.style.top = top + 'px';
        el.style.left = (x - wrapRect.left - el.offsetWidth / 2) + 'px';
        pb.appendChild(el);

        const ln = doc.createElement('div');
        ln.className = 'clp-chord-line';
        ln.style.left = (x - wrapRect.left) + 'px';
        ln.style.top = (top + cSize) + 'px';
        ln.style.height = Math.max(4, GAP) + 'px';
        pb.appendChild(ln);
      });

      // Sync playhead highlight
      window.addEventListener('message', function clpSync(ev) {
        if (ev.data?.type === 'syncUpdate') {
          if (_chordLinePopup.closed) { window.removeEventListener('message', clpSync); return; }
          const body = _chordLinePopup.document.getElementById('clpBody');
          if (!body) return;
          [...body.children].forEach(el => {
            if (!el.dataset.li) return;
            const li = +el.dataset.li;
            el.classList.toggle('clp-active', li === ev.data.activeIdx);
            el.classList.toggle('clp-active-bg', li === ev.data.activeIdx);
          });
        }
      });
    }

    // === Player View persistent settings (survives popup rebuilds) ===
    const _pvSettingsKey = 'achord_player_view_settings';
    const _pvDefaults = { font:'Vazirmatn', tColor:'#0fa966', cColor:'#e6aa28', hlColor:'#FF2E93', bgColor:'#0F131E', tSize:53, cSize:40, scaleLock:true, bold:true };
    let _pvSettings = Object.assign({}, _pvDefaults);
    try { const s = JSON.parse(localStorage.getItem(_pvSettingsKey)); if (s) _pvSettings = Object.assign({}, _pvDefaults, s); } catch(_) {}
    function _pvSave() { try { localStorage.setItem(_pvSettingsKey, JSON.stringify(_pvSettings)); } catch(_) {} }
    // Wheel handlers — re-attached on each syncLyricPopup() call
    const _fontList = [
      'Vazirmatn', 
      'Vazirmatn Thin', 
      'Vazirmatn Bold', 
      'Vazirmatn Black', 
      'BArshia', 
      'BFarnaz', 
      'BJadid', 
      'BZar', 
      'BZar Bold', 
      'Lalezar'
    ];
    
    // Helper to ensure font name is properly quoted for CSS
    function _getFontFamilyCSS(fontName) {
      return "'" + fontName + "', sans-serif";
    }
    function _pvSetupWheelHandlers() {
      if (!_lyricPopup || _lyricPopup.closed) return;
      const pDoc = _lyricPopup.document;
      // Remove old handler if exists
      if (_lyricPopup._pvWheelHandler) {
        pDoc.removeEventListener('wheel', _lyricPopup._pvWheelHandler);
      }
      // Create new handler
      const handler = (e) => {
        if (!_lyricPopup || _lyricPopup.closed) return;
        const target = e.target;
        // Ctrl+Wheel anywhere → lyric size
        if (e.ctrlKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 1 : -1;
          _pvSettings.tSize = Math.max(12, Math.min(55, _pvSettings.tSize + delta));
          if (_pvSettings.scaleLock) {
            _pvSettings.cSize = Math.max(8, Math.min(40, Math.round(_pvSettings.tSize * 0.7)));
          }
          _pvSave(); _pvApply();
          return;
        }
        // Plain wheel on chord → chord size
        if (target && target.classList && target.classList.contains('p-chord')) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 1 : -1;
          _pvSettings.cSize = Math.max(8, Math.min(40, _pvSettings.cSize + delta));
          if (_pvSettings.scaleLock) {
            _pvSettings.tSize = Math.max(12, Math.min(55, Math.round(_pvSettings.cSize / 0.7)));
          }
          _pvSave(); _pvApply();
          return;
        }
        // Wheel on font selector → cycle fonts
        if (target && target.id === 'pv-font') {
          e.preventDefault();
          let idx = _fontList.indexOf(_pvSettings.font);
          idx = e.deltaY < 0 ? (idx - 1 + _fontList.length) % _fontList.length : (idx + 1) % _fontList.length;
          _pvSettings.font = _fontList[idx];
          target.value = _pvSettings.font;
          _pvSave(); _pvApply();
          return;
        }
      };
      _lyricPopup._pvWheelHandler = handler;
      pDoc.addEventListener('wheel', handler, { passive: false });
    }

    function syncLyricPopup() {
      if (!_lyricPopup || _lyricPopup.closed) return;
      // If popup already has chord script, update in-place (no full rebuild)
      const _existingScript = _lyricPopup.document.querySelector('script[data-pv="chord"]');
      if (_existingScript) {
        const doc = _lyricPopup.document;
        const pb = doc.getElementById('popupBody');
        if (!pb) return;

        const lines = (edCur?.lyrics || '').split('\n');
        const transpose = edCur?.transpose || 0;
        const chords = (edCur?.chords || []).map(ch => ({
          lineIndex: ch.lineIndex, charIndex: ch.charIndex,
          anchorType: ch.anchorType, _name: edTransposeChord(ch.name, transpose)
        }));
        const tSize = edCur?.styles?.tSize || 38;
        const tColor = edCur?.styles?.tColor || '#0fa966';
        const tFont = edCur?.styles?.tFont || 'Vazirmatn';
        const tBold = edCur?.styles?.tBold ? 'bold' : 'normal';
        const align = edCur?.styles?.align || 'center';

        // بررسی آیا ساختار خط‌ها واقعاً عوض شده
        const existingLines = Array.from(pb.querySelectorAll('.popup-sync-line'));
        let structureChanged = existingLines.length !== lines.length;
        if (!structureChanged) {
          for (let i = 0; i < lines.length; i++) {
            if (!existingLines[i] || existingLines[i].textContent !== (lines[i] || '\u200B')) {
              structureChanged = true; break;
            }
          }
        }

        if (structureChanged) {
          // فقط وقتی تعداد خط‌ها یا متن عوض شده rebuild کن
          let h = '';
          lines.forEach((line, i) => {
            h += `<div class="eline popup-sync-line" data-li="${i}">${line || '\u200B'}</div>`;
          });
          pb.innerHTML = h;
        }

        // آپدیت text و style خط‌ها روی DOM موجود
        const lineEls = pb.querySelectorAll('.popup-sync-line');
        lineEls.forEach((el, i) => {
          const nextText = lines[i] || '\u200B';
          if (el.textContent !== nextText) el.textContent = nextText;
          el.style.fontSize = tSize + 'px';
          el.style.color = tColor;
          el.style.fontFamily = `'${tFont}', sans-serif`;
          el.style.fontWeight = tBold;
          el.style.textAlign = align;
        });

        // آپدیت chord data و رندر
        _lyricPopup._pChords = chords;
        try {
          _lyricPopup._pStructureVersion = (_lyricPopup._pStructureVersion || 0) + (structureChanged ? 1 : 0);
          // اگر ساختار عوض شده، کش المان‌های chord قبلی را پاک کن
          if (structureChanged) {
            _lyricPopup.eval('if(typeof _pChordEls!=="undefined"){Object.keys(_pChordEls).forEach(function(k){var el=_pChordEls[k];if(el&&el.isConnected)el.remove();delete _pChordEls[k];});}if(typeof _pChordLineEls!=="undefined"){Object.keys(_pChordLineEls).forEach(function(k){var el=_pChordLineEls[k];if(el&&el.isConnected)el.remove();delete _pChordLineEls[k];});}');
          }
          const _evalChords = '_pChords=' + JSON.stringify(chords) + ';' +
            'window._pStructureVersion=' + JSON.stringify(_lyricPopup._pStructureVersion || 0) + ';' +
            'if(typeof _pScheduleChordRender==="function"){_pScheduleChordRender("' + (structureChanged ? 'structure' : 'data') + '");' +
            '}else if(typeof _pRenderChords==="function"){_pRenderChords();}';
          _lyricPopup.eval('(function(){' + _evalChords + '})();');
          // Fallback chain: اگر rAF یا layout هنوز آماده نباشد
          if (structureChanged) {
            [120, 300, 600].forEach(function(ms) {
              setTimeout(function() {
                try {
                  if (_lyricPopup && !_lyricPopup.closed && typeof _lyricPopup._pRenderChords === 'function') {
                    _lyricPopup.eval('(function(){' + _evalChords + 'window._pRenderReason="fallback";if(typeof _pScheduleChordRender==="function"){_pScheduleChordRender("structure");}else{_pRenderChords();}})();');
                  }
                } catch(_) {}
              }, ms);
            });
          }
        } catch(_) {
          // اگر eval کل fail شد، fallback بعد از layout
          setTimeout(function() {
            try {
              if (_lyricPopup && !_lyricPopup.closed && typeof _lyricPopup._pRenderChords === 'function') {
                _lyricPopup._pRenderChords();
              }
            } catch(_) {}
          }, 250);
        }

        // Re-apply saved settings
        try {
          const s = JSON.parse(localStorage.getItem('${_pvSettingsKey}')) || {};
          lineEls.forEach(el => {
            el.style.fontSize = (s.tSize || tSize) + 'px';
            el.style.color = s.tColor || tColor;
            el.style.fontWeight = s.bold ? 'bold' : tBold;
            el.style.fontFamily = "'" + (s.font || tFont) + "', sans-serif";
          });
          if (s.cSize || s.cColor) {
            _lyricPopup.eval(
              '(function(){' +
                '_pCfg.cSize=' + JSON.stringify(s.cSize || 38) + ';' +
                '_pCfg.cColor=' + JSON.stringify(s.cColor || '#e6aa28') + ';' +
                'if(typeof _pScheduleChordRender==="function"){_pScheduleChordRender("style");' +
                '}else if(typeof _pRenderChords==="function"){_pRenderChords();}' +
              '})();'
            );
          }
        } catch(_) {}
        // Force Reflow: مجبور کردن مرورگر به محاسبه مجدد چیدمان
        try { void pb.offsetHeight; } catch(_) {}
        // Dispatch resize event to force layout recalculation
        try { _lyricPopup.dispatchEvent(new Event('resize')); } catch(_) {}
        return;
      }
      const title = edCur?.title || t('untitled');
      const artist = edCur?.artist || '';
      const keyStr = (edCur?.key || 'C') + ((edCur?.keyMode || 'maj') === 'min' ? 'm' : '');
      const sub = [artist, keyStr ? (currentLang==='fa'?'گام: ':'Key: ') + keyStr : null].filter(Boolean).join('  ·  ');
      const tSize = edCur?.styles?.tSize || 38;
      const tColor = edCur?.styles?.tColor || '#0fa966';
      const tFont = edCur?.styles?.tFont || 'Vazirmatn';
      const tBold = edCur?.styles?.tBold ? 'bold' : 'normal';
      const align = edCur?.styles?.align || 'center';
      const cSize = edCur?.styles?.cSize || 38;
      const cColor = edCur?.styles?.cColor || '#e6aa28';
      const cFont = edCur?.styles?.cFont || 'JetBrains Mono';
      const transpose = edCur?.transpose || 0;
      const lines = (edCur?.lyrics || '').split('\n');
      const chords = (edCur?.chords || []).map(ch => ({ lineIndex: ch.lineIndex, charIndex: ch.charIndex, anchorType: ch.anchorType, _name: edTransposeChord(ch.name, transpose) }));
      _lyricPopup.document.title = title + ' — ' + artist + ' | نوازنده';
      _lyricPopup.document.documentElement.dir = 'rtl';
      _lyricPopup.document.documentElement.lang = 'fa';
      _lyricPopup.document.head.innerHTML = `
        <style>
          @font-face { font-family: 'Vazirmatn'; src: url('../fonts/Vazirmatn-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'Vazirmatn Bold'; src: url('../fonts/Vazirmatn-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Thin'; src: url('../fonts/Vazirmatn-Thin.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Black'; src: url('../fonts/Vazirmatn-Black.woff2') format('woff2'); }
          @font-face { font-family: 'BArshia'; src: url('../fonts/BArshia.woff2') format('woff2'); }
          @font-face { font-family: 'BFarnaz'; src: url('../fonts/BFarnaz.woff2') format('woff2'); }
          @font-face { font-family: 'BJadid'; src: url('../fonts/BJadidBd.woff2') format('woff2'); }
          @font-face { font-family: 'BZar'; src: url('../fonts/BZar.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'BZar Bold'; src: url('../fonts/BZarBd.woff2') format('woff2'); }
          @font-face { font-family: 'Lalezar'; src: url('../fonts/Lalezar-Regular.woff2') format('woff2'); }
          @font-face { font-family: 'Mada'; src: url('../fonts/Mada-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Rubik'; src: url('../fonts/Rubik-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'JetBrains Mono'; src: url('../fonts/JetBrainsMono-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'JetBrains Mono Bold'; src: url('../fonts/JetBrainsMono-Bold.woff2') format('woff2'); }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0F131E; color: #E2E8F0; font-family: 'Vazirmatn', sans-serif; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
          .popup-header { text-align: center; padding: 16px 20px 10px; background: linear-gradient(180deg, #1C2333, #161B26); border-bottom: 1px solid #232B3E; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
          .popup-header .title { font-size: 20px; font-weight: 900; color: #00F2FE; text-shadow: 0 0 20px rgba(0,242,254,0.3); }
          .popup-header .sub { font-size: 12px; color: #718096; margin-top: 3px; }
          .popup-body { flex: 1; overflow: auto; padding: 30px 40px; position: relative; }
          .eline { min-height: 1.4em; line-height: 2.6; white-space: pre-wrap; transition: opacity 0.3s ease, color 0.3s ease, background 0.3s ease, text-shadow 0.3s ease; }
          .popup-sync-line {
  position: relative;
  margin-top: 1.8em;
  padding: 4px 12px;
  border-bottom: none !important;
  transition: opacity 0.2s ease, color 0.2s ease, background 0.2s ease, text-shadow 0.2s ease;
}

.popup-sync-line.active {
  color: #fff;
  border-radius: 8px;
  z-index: 10;
}

.popup-sync-line.done {
  opacity: 0.50;
}

/* ===== Highlight Effects (matching main editor) ===== */
@keyframes hl-gradient-sweep { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes hl-pulse-glow { 0%,100% { box-shadow: 0 0 8px rgba(34,211,100,0.3), inset 0 0 12px rgba(34,211,100,0.05); } 50% { box-shadow: 0 0 20px rgba(34,211,100,0.6), inset 0 0 20px rgba(34,211,100,0.1); } }
@keyframes hl-text-pulse { 0%,100% { text-shadow: 0 0 6px rgba(34,211,100,0.5), 0 0 12px rgba(34,211,100,0.3); } 50% { text-shadow: 0 0 12px rgba(34,211,100,0.8), 0 0 30px rgba(34,211,100,0.5), 0 0 50px rgba(34,211,100,0.2); } }
/* Neon */
body.hl-neon .popup-sync-line.active { color: #00F2FE; text-shadow: 0 0 8px rgba(0,242,254,0.8), 0 0 20px rgba(0,242,254,0.4); }
body.hl-neon .popup-sync-line.active::before { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: linear-gradient(180deg, rgba(0,242,254,0.2), rgba(0,242,254,0.04) 55%, transparent); border: 1px solid rgba(0,242,254,0.3); border-radius: 8px; pointer-events: none; box-shadow: 0 0 15px rgba(0,242,254,0.3), 0 0 30px rgba(0,242,254,0.1); }
/* Frost */
body.hl-frost .popup-sync-line.active { color: #fff; }
body.hl-frost .popup-sync-line.active::before { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 50%, rgba(200,220,255,0.08) 100%); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; pointer-events: none; box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 16px rgba(0,0,0,0.3); }
body.hl-frost .popup-sync-line.active::after { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: rgba(255,255,255,0.06); backdrop-filter: blur(8px); border-radius: 12px; pointer-events: none; z-index: -1; }
/* Shift */
body.hl-shift .popup-sync-line.active { background: linear-gradient(135deg, #ff2e93, #7b2fff, #00F2FE, #3FB8AF, #ff2e93); background-size: 400% 400%; animation: hl-gradient-sweep 4s ease infinite; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
body.hl-shift .popup-sync-line.active::before { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: linear-gradient(135deg, rgba(255,46,147,0.15), rgba(123,47,255,0.15), rgba(0,242,254,0.15)); background-size: 400% 400%; animation: hl-gradient-sweep 4s ease infinite; border-radius: 8px; pointer-events: none; }
/* Depth */
body.hl-depth .popup-sync-line.active { color: #E2E8F0; text-shadow: 0 1px 0 rgba(0,0,0,0.8), 0 2px 0 rgba(0,0,0,0.7), 0 3px 0 rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.5), 0 0 15px rgba(255,46,147,0.3); }
body.hl-depth .popup-sync-line.active::before { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: linear-gradient(180deg, rgba(255,46,147,0.15), rgba(255,46,147,0.02) 60%, transparent); border: 1px solid rgba(255,46,147,0.2); border-radius: 8px; pointer-events: none; box-shadow: 0 6px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(255,46,147,0.2); }
/* Pulse */
body.hl-pulse .popup-sync-line.active { color: #22D364; animation: hl-text-pulse 2s ease-in-out infinite; }
body.hl-pulse .popup-sync-line.active::before { content: ''; position: absolute; left: 0; right: 0; top: -1.8em; bottom: 0; background: linear-gradient(180deg, rgba(34,211,100,0.12), rgba(34,211,100,0.02) 55%, transparent); border: 1px solid rgba(34,211,100,0.25); border-radius: 10px; pointer-events: none; animation: hl-pulse-glow 2s ease-in-out infinite; }

          .p-chord {
  position: absolute;
  pointer-events: none;
  font-weight: bold;
  color: ${cColor};
  font-family: '${cFont}', monospace;
  font-size: ${cSize}px;
  line-height: 1.15;
  box-sizing: border-box;
  background: transparent;
  border-radius: 4px;
  padding: 0 2px;
  direction: ltr;
  white-space: nowrap;
  z-index: 5;
}

          .p-chord-line { position: absolute; width: 2px; pointer-events: none; opacity: .5; background: ${cColor}; z-index: 4; }

          #pv-settings-toggle { transition: color 0.2s, transform 0.2s; }
          #pv-settings-toggle:hover { color: #00F2FE; transform: scale(1.05); }
          #pv-settings { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
          #pv-settings select { transition: border-color 0.2s, box-shadow 0.2s; }
          #pv-settings select:hover, #pv-settings select:focus { border-color: #00F2FE; box-shadow: 0 0 0 2px rgba(0,242,254,0.15); outline: none; }
          #pv-settings input[type="range"] { transition: filter 0.2s; }
          #pv-settings input[type="range"]:hover { filter: brightness(1.3); }
          #pv-settings label:hover { background: rgba(255,255,255,0.04); }
          .pv-hint { font-size: 10px; color: #4A5568; margin-top: 8px; text-align: center; letter-spacing: 0.3px; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #1A202C; }
          ::-webkit-scrollbar-thumb { background: #4A5568; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #718096; }
        </style>`;
      let html = `<div class="popup-header"><div class="title">${title}</div><div class="sub">${sub}</div>
        <div id="pv-settings-toggle" style="cursor:pointer;font-size:11px;color:#718096;margin-top:4px;user-select:none;transition:color 0.2s;">⚙ تنظیمات نمایش</div>
        <div id="pv-settings" style="display:none;text-align:right;padding:12px 14px;font-size:12px;margin-top:8px;background:linear-gradient(135deg,#1A202C,#161B26);border:1px solid #2D3748;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:center;">
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;">فونت:
              <select id="pv-font" style="background:#0D1117;color:#E2E8F0;border:1px solid #30363D;border-radius:8px;padding:4px 10px;font-size:11px;cursor:pointer;transition:border-color 0.2s;">
                <option value="Vazirmatn">Vazirmatn</option><option value="Vazirmatn Thin">Vazirmatn Thin</option><option value="Vazirmatn Bold">Vazirmatn Bold</option><option value="Vazirmatn Black">Vazirmatn Black</option><option value="BArshia">BArshia</option><option value="BFarnaz">BFarnaz</option><option value="BJadid">BJadid</option><option value="BZar">BZar</option><option value="BZar Bold">BZar Bold</option><option value="Lalezar">Lalezar</option>
              </select>
            </label>
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="color" id="pv-tColor" value="${tColor}" style="width:24px;height:24px;border:2px solid #30363D;border-radius:6px;cursor:pointer;background:none;padding:0;"> متن</label>
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="color" id="pv-cColor" value="${cColor}" style="width:24px;height:24px;border:2px solid #30363D;border-radius:6px;cursor:pointer;background:none;padding:0;"> آکورد</label>
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="color" id="pv-bgColor" value="#0F131E" style="width:24px;height:24px;border:2px solid #30363D;border-radius:6px;cursor:pointer;background:none;padding:0;"> پس‌زمینه</label>
            <div style="display:flex;align-items:center;gap:5px;color:#A0AEC0;">متن: <input type="range" id="pv-tSize" min="12" max="55" value="${tSize}" style="width:70px;accent-color:#00F2FE;height:4px;"> <span id="pv-tSizeVal" style="min-width:22px;text-align:center;font-family:monospace;color:#00F2FE;font-weight:bold;">${tSize}</span></div>
            <div style="display:flex;align-items:center;gap:5px;color:#A0AEC0;">آکورد: <input type="range" id="pv-cSize" min="8" max="40" value="${cSize}" style="width:70px;accent-color:#00F2FE;height:4px;"> <span id="pv-cSizeVal" style="min-width:22px;text-align:center;font-family:monospace;color:#00F2FE;font-weight:bold;">${cSize}</span></div>
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:background 0.2s;" title="قفل نسبت اندازه متن و آکورد"><input type="checkbox" id="pv-scaleLock" checked style="accent-color:#00F2FE;"> 🔗 قفل</label>
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:background 0.2s;"><input type="checkbox" id="pv-bold" style="accent-color:#00F2FE;"> <b>B</b> ضخیم</label>
          </div>
          <div class="pv-hint">Ctrl+Wheel: تغییر اندازه متن | Wheel روی آکورد: تغییر اندازه آکورد | Wheel روی فونت: پیمایش فونت‌ها</div>
        </div>
      </div><div class="popup-body" id="popupBody">`;
      lines.forEach((line, i) => {
        html += `<div class="eline popup-sync-line" data-li="${i}" style="font-size:${tSize}px;color:${tColor};font-family:'${tFont}';font-weight:${tBold};text-align:${align};">${line || '\u200B'}</div>`;
      });
      html += '</div>';
      // ظرف خالی برای نوار آکورد آینه‌ای + دستگیره ریسایز
      html += '<div id="chordMirrorResize" style="position:fixed;bottom:0;left:0;width:100%;height:94px;z-index:9999;">' +
        '<div id="chordMirrorHandle" style="width:100%;height:4px;background:linear-gradient(90deg,#4A5568,#9F7AEA,#4A5568);cursor:ns-resize;border-radius:2px 2px 0 0;opacity:0.5;transition:opacity 0.2s;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.5\'"></div>' +
        '<div id="playerChordMirror" style="width:100%;height:90px;background:#111;overflow:hidden;border-top:1px solid #333;"></div>' +
        '</div>';
      _lyricPopup.document.body.innerHTML = html;
      _lyricPopup.document.body.setAttribute('data-popup-role', 'player');
      // Apply highlight effect class to popup body
      applyHighlightClassToPopup();
      // Inject chord positioning script via createElement (not insertAdjacentHTML)
      const chordsJson = JSON.stringify(chords);
      const configJson = JSON.stringify({ cSize, cColor, cFont });
      const sc = _lyricPopup.document.createElement('script');
      sc.setAttribute('data-pv', 'chord');
      sc.textContent = `
        var _pChords = ${chordsJson};
        var _pCfg = ${configJson};
        var _pChordEls = Object.create(null);
        var _pChordLineEls = Object.create(null);
        var _pRenderPending = false;
        var _pRenderReason = 'init';
        var _pStructureVersion = 0;
        var _pLastRenderedSignature = '';
        var _pLastStructureVersion = -1;

        function _pChordKey(ch) {
          return [ch.lineIndex, ch.charIndex, ch.anchorType || ''].join('|');
        }

        function _pAnchorRect(editorEl, ch) {
          var lineEl = editorEl.children[ch.lineIndex]; if (!lineEl) return null;
          var segs = [], total = 0, node;
          var walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
          while (node = walker.nextNode()) { segs.push({ node: node, start: total, len: node.textContent.length }); total += node.textContent.length; }
          if (!segs.length) return null;
          var len = total, r = document.createRange();
          if (ch.anchorType === 'LineStart') { var s = segs[0]; r.setStart(s.node,0); r.setEnd(s.node,Math.min(1,s.len)); }
          else if (ch.anchorType === 'LineEnd') { var s2 = segs[segs.length-1]; var p = Math.max(0,s2.len-1); r.setStart(s2.node,p); r.setEnd(s2.node,Math.min(p+1,s2.len)); }
          else { var ci = Math.min(ch.charIndex, Math.max(0, len-1)); var s3 = null; for (var k=0;k<segs.length;k++) { if (ci >= segs[k].start && ci < segs[k].start+segs[k].len) { s3=segs[k]; break; } } if(!s3) s3=segs[segs.length-1]; var local = Math.max(0, ci-s3.start); r.setStart(s3.node, Math.min(local,s3.len)); r.setEnd(s3.node, Math.min(local+1,s3.len)); }
          return { rect: r.getBoundingClientRect(), lineRect: lineEl.getBoundingClientRect(), type: ch.anchorType };
        }

        function _pChordSignature() {
          return JSON.stringify({
            chords: (_pChords || []).map(function(ch) { return { l: ch.lineIndex, c: ch.charIndex, a: ch.anchorType, n: ch._name }; }),
            cSize: _pCfg.cSize, cColor: _pCfg.cColor, cFont: _pCfg.cFont
          });
        }

        function _pEnsureChordEl(key, pb) {
          var el = _pChordEls[key];
          if (el && el.isConnected) return { el: el, created: false };
          el = document.createElement('span');
          el.className = 'p-chord';
          el.setAttribute('data-chord-key', key);
          el.style.cssText = 'position:absolute;pointer-events:none;font-weight:bold;line-height:1.15;box-sizing:border-box;background:transparent;z-index:5;direction:ltr;white-space:nowrap;visibility:hidden;';
          pb.appendChild(el);
          _pChordEls[key] = el;
          return { el: el, created: true };
        }

        function _pEnsureChordLineEl(key, pb) {
          var el = _pChordLineEls[key];
          if (el && el.isConnected) return { el: el, created: false };
          el = document.createElement('div');
          el.className = 'p-chord-line';
          el.setAttribute('data-chordline-key', key);
          el.style.cssText = 'position:absolute;width:2px;pointer-events:none;opacity:.5;z-index:4;visibility:hidden;';
          pb.appendChild(el);
          _pChordLineEls[key] = el;
          return { el: el, created: true };
        }

        function _pCleanupUnused(usedKeys) {
          Object.keys(_pChordEls).forEach(function(key) {
            if (usedKeys[key]) return;
            var el = _pChordEls[key];
            if (el && el.isConnected) el.remove();
            delete _pChordEls[key];
          });
          Object.keys(_pChordLineEls).forEach(function(key) {
            if (usedKeys[key]) return;
            var el = _pChordLineEls[key];
            if (el && el.isConnected) el.remove();
            delete _pChordLineEls[key];
          });
        }

        function _pRenderChords() {
          var pb = document.getElementById('popupBody');
          if (!pb) return;
          var signature = _pChordSignature();
          var structureChanged = _pLastStructureVersion !== _pStructureVersion;
          var contentChanged = _pLastRenderedSignature !== signature;
          if (!structureChanged && !contentChanged && _pRenderReason !== 'resize') return;

          var wrapRect = pb.getBoundingClientRect();
          var scrollTop = pb.scrollTop;
          var GAP = Math.max(10, _pCfg.cSize * 0.6);
          var MARGIN = 5;
          var usedKeys = Object.create(null);

          (_pChords || []).forEach(function(ch) {
            if (!ch || !ch._name) return;
            var a = _pAnchorRect(pb, ch);
            if (!a) return;
            var key = _pChordKey(ch);
            var ensured = _pEnsureChordEl(key, pb);
            var el = ensured.el;
            usedKeys[key] = true;
            // آپدیت text و style فقط اگر عوض شده
            if (el.textContent !== ch._name) el.textContent = ch._name;
            var nf = _pCfg.cSize + 'px', nc = _pCfg.cColor, nfa = '"' + _pCfg.cFont + '",monospace';
            if (el.style.fontSize !== nf) el.style.fontSize = nf;
            if (el.style.color !== nc) el.style.color = nc;
            if (el.style.fontFamily !== nfa) el.style.fontFamily = nfa;
            var elW = el.offsetWidth;
            var x;
            if (ch.anchorType === 'LineStart') { x = a.rect.right + MARGIN; }
            else if (ch.anchorType === 'LineEnd') { x = a.rect.left - MARGIN; }
            else { x = (a.rect.left + a.rect.right) / 2; }
            var nt = (a.rect.top - wrapRect.top + scrollTop - _pCfg.cSize - GAP) + 'px';
            var nl = (x - wrapRect.left - elW / 2) + 'px';
            if (el.style.top !== nt) el.style.top = nt;
            if (el.style.left !== nl) el.style.left = nl;
            if (ensured.created) el.style.visibility = 'visible';

            // Chord line (vertical connector from chord to lyric)
            var lnEnsured = _pEnsureChordLineEl(key, pb);
            var ln = lnEnsured.el;
            var lnX = (x - wrapRect.left) + 'px';
            var lnTop = (parseFloat(nt) + _pCfg.cSize) + 'px';
            var lnH = Math.max(4, GAP) + 'px';
            if (ln.style.left !== lnX) ln.style.left = lnX;
            if (ln.style.top !== lnTop) ln.style.top = lnTop;
            if (ln.style.height !== lnH) ln.style.height = lnH;
            if (ln.style.background !== _pCfg.cColor) ln.style.background = _pCfg.cColor;
            if (lnEnsured.created) ln.style.visibility = 'visible';
          });
          _pCleanupUnused(usedKeys);
          _pLastRenderedSignature = signature;
          _pLastStructureVersion = _pStructureVersion;
          _pRenderReason = 'idle';
        }

        function _pScheduleChordRender(reason) {
          _pRenderReason = reason || _pRenderReason || 'unknown';
          if (_pRenderPending) return;
          _pRenderPending = true;
          requestAnimationFrame(function() { _pRenderPending = false; _pRenderChords(); });
        }

        _pScheduleChordRender('init');
        window.addEventListener('resize', function() { _pScheduleChordRender('resize'); });

        window._pCfg = _pCfg;
        window._pChords = _pChords;
        window._pRenderChords = _pRenderChords;
        window._pScheduleChordRender = _pScheduleChordRender;
        window._pChordEls = _pChordEls;
        window._pChordLineEls = _pChordLineEls;

        // === Wheel handlers ===
        var _pvKey = '${_pvSettingsKey}';
        function _pvLoad() { try { return JSON.parse(localStorage.getItem(_pvKey)) || {}; } catch(e) { return {}; } }
        function _pvSaveLocal(s) { try { localStorage.setItem(_pvKey, JSON.stringify(s)); } catch(e) {} }
        function _pvApplyLocal(s) {
          document.body.style.background = s.bgColor || '#0F131E';
          var fontName = s.font || 'Vazirmatn';
          document.querySelectorAll('.eline').forEach(function(el) {
            el.style.color = s.tColor || '#0fa966';
            el.style.fontSize = (s.tSize || 38) + 'px';
            el.style.fontWeight = s.bold ? 'bold' : 'normal';
            el.style.fontFamily = fontName;
          });
          _pCfg.cSize = s.cSize || 38;
          _pCfg.cColor = s.cColor || '#e6aa28';
          _pCfg.cFont = fontName;
          if (typeof _pScheduleChordRender === 'function') { _pScheduleChordRender('style'); }
          else { _pRenderChords(); }
        }
        document.addEventListener('wheel', function(e) {
          var s = _pvLoad(); if (!s.tSize) s.tSize = 20; if (!s.cSize) s.cSize = 14;
          if (s.scaleLock === undefined) s.scaleLock = true;
          var t = e.target;
          if (t && t.id === 'pv-tSize') {
            e.preventDefault();
            s.tSize = Math.max(12, Math.min(55, s.tSize + (e.deltaY < 0 ? 1 : -1)));
            if (s.scaleLock) s.cSize = Math.max(8, Math.min(40, Math.round(s.tSize * 0.7)));
            t.value = s.tSize;
            var tv = document.getElementById('pv-tSizeVal'); if (tv) tv.textContent = s.tSize;
            var cs = document.getElementById('pv-cSize'); var cv = document.getElementById('pv-cSizeVal');
            if (cs) cs.value = s.cSize; if (cv) cv.textContent = s.cSize;
            _pvSaveLocal(s); _pvApplyLocal(s); return;
          }
          if (t && t.id === 'pv-cSize') {
            e.preventDefault();
            s.cSize = Math.max(8, Math.min(40, s.cSize + (e.deltaY < 0 ? 1 : -1)));
            if (s.scaleLock) s.tSize = Math.max(12, Math.min(55, Math.round(s.cSize / 0.7)));
            t.value = s.cSize;
            var cv2 = document.getElementById('pv-cSizeVal'); if (cv2) cv2.textContent = s.cSize;
            var ts = document.getElementById('pv-tSize'); var tv2 = document.getElementById('pv-tSizeVal');
            if (ts) ts.value = s.tSize; if (tv2) tv2.textContent = s.tSize;
            _pvSaveLocal(s); _pvApplyLocal(s); return;
          }
          if (t && t.id === 'pv-font') {
            e.preventDefault();
            var _fl = ['Vazirmatn','Vazirmatn Thin','Vazirmatn Bold','Vazirmatn Black','BArshia','BFarnaz','BJadid','BZar','BZar Bold','Lalezar'];
            var idx = _fl.indexOf(s.font || 'Vazirmatn');
            idx = e.deltaY < 0 ? (idx - 1 + _fl.length) % _fl.length : (idx + 1) % _fl.length;
            s.font = _fl[idx]; t.value = s.font;
            _pvSaveLocal(s); _pvApplyLocal(s); return;
          }
        }, { passive: false });
      `;
      _lyricPopup.document.body.appendChild(sc);
      // Override _pCfg with saved Player View settings (not editor defaults)
      _lyricPopup._pCfg = { cSize: _pvSettings.cSize, cColor: _pvSettings.cColor, cFont: 'JetBrains Mono' };

// ==========================================
// PART 3: Project Load & Audio Export (WAV)
// ==========================================
// منطق load/resolve صوت پروژه به js/core/ProjectAudioService.js منتقل شده است.

/**
 * تبدیل AudioBuffer به فرمت استاندارد WAV جهت ذخیره‌سازی
 */
function bufferToWave(abuffer, len) {
  let numOfChan = abuffer.numberOfChannels,
      length = len * numOfChan * 2 + 44,
      out = new DataView(new ArrayBuffer(length)),
      channels = [], i, sample,
      offset = 0, pos = 0;

  function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
  function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (i = 0; i < numOfChan; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (offset < len) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }
  return new Blob([out], { type: "audio/wav" });
  // ==========================================
// PART 4: Timeline Rendering & UI Event Listeners
// ==========================================

/**
 * رندر کردن ظاهر تراک‌ها روی تایم‌لاین
 */
function renderTimeline() {
  const container = document.getElementById('timeline-tracks-container');
  if (!container) return;
  container.innerHTML = '';

  DAW.tracks.forEach(track => {
    const trackEl = document.createElement('div');
    trackEl.className = 'track-row';
    trackEl.innerHTML = `
      <div class="track-header">${track.name}</div>
      <div class="track-content"></div>
    `;
    container.appendChild(trackEl);
  });
}

// اتصال رویدادهای اولیه صفحه پس از بارگذاری DOM - بخش اول (خط ۳۶۲۳)
document.addEventListener('DOMContentLoaded', () => {
  const audioInput = document.getElementById('audio-file-input');
  if (audioInput) {
    audioInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];

      if (!file) {
        return;
      }

      const copy = confirm("آیا می‌خواهید فایل صوتی در پوشه پروژه کپی شود؟");

      try {
        await handleAudioImport(file, copy);
      } catch (error) {
        console.error('[AudioImport] Failed to import audio file:', error);

        if (typeof toast === 'function') {
          toast('خطا در وارد کردن فایل صوتی');
        }
      } finally {
        e.target.value = '';
      }
    });
  }

  // ============================================
  // Menu Command Handlers (Electron)
  // ============================================
  if (isElectron && window.electronAPI && window.electronAPI.onMenuCommand) {
    console.log('[App] Registering menu command handlers...');

    // File Menu
    window.electronAPI.onMenuCommand('menu-new-song', () => {
      console.log('[Menu] New Song requested');
      if (typeof createNewProject === 'function') createNewProject();
      else alert('قابلیت ایجاد پروژه جدید هنوز پیاده‌سازی نشده است.');
    });

    window.electronAPI.onMenuCommand('menu-open-project', () => {
      console.log('[Menu] Open Project requested');
      if (typeof openProjectDialog === 'function') openProjectDialog();
      else alert('قابلیت باز کردن پروژه هنوز پیاده‌سازی نشده است.');
    });

    window.electronAPI.onMenuCommand('menu-save', () => {
      console.log('[Menu] Save requested');
      if (typeof saveCurrentProject === 'function') saveCurrentProject();
      else alert('قابلیت ذخیره پروژه هنوز پیاده‌سازی نشده است.');
    });

    window.electronAPI.onMenuCommand('menu-save-as', () => {
      console.log('[Menu] Save As requested');
      if (typeof saveProjectAs === 'function') saveProjectAs();
      else alert('قابلیت ذخیره با نام جدید هنوز پیاده‌سازی نشده است.');
    });

    window.electronAPI.onMenuCommand('menu-export', () => {
      console.log('[Menu] Export requested');
      if (typeof exportProject === 'function') exportProject();
      else alert('قابلیت خروجی گرفتن هنوز پیاده‌سازی نشده است.');
    });

    window.electronAPI.onMenuCommand('menu-import', () => {
      console.log('[Menu] Import requested');
      if (typeof importProject === 'function') importProject();
      else alert('قابلیت ورود پروژه هنوز پیاده‌سازی نشده است.');
    });

    // Playback Menu
    window.electronAPI.onMenuCommand('menu-play-pause', () => {
      console.log('[Menu] Play/Pause requested');
      if (typeof togglePlayPause === 'function') togglePlayPause();
      else if (typeof playPause === 'function') playPause();
      else alert('قابلیت پخش/توقف هنوز پیاده‌سازی نشده است.');
    });

    window.electronAPI.onMenuCommand('menu-stop', () => {
      console.log('[Menu] Stop requested');
      if (typeof stopPlayback === 'function') stopPlayback();
      else if (typeof perfStop === 'function') perfStop();
      else alert('قابلیت توقف پخش هنوز پیاده‌سازی نشده است.');
    });

    window.electronAPI.onMenuCommand('menu-go-to-start', () => {
      console.log('[Menu] Go to Start requested');
      if (typeof goToStart === 'function') goToStart();
      else if (DAW && typeof seekTo === 'function') seekTo(0);
      else alert('قابلیت رفتن به ابتدا هنوز پیاده‌سازی نشده است.');
    });

    window.electronAPI.onMenuCommand('menu-go-to-end', () => {
      console.log('[Menu] Go to End requested');
      if (typeof goToEnd === 'function') goToEnd();
      else alert('قابلیت رفتن به انتها هنوز پیاده‌سازی نشده است.');
    });

    // Tools Menu
    window.electronAPI.onMenuCommand('menu-arranger', () => {
      console.log('[Menu] Arranger requested');
      const panel = document.getElementById('arr-perf-panel');
      if (panel) {
        panel.style.display = panel.style.display === 'none' || panel.style.display === '' ? 'flex' : 'none';
      } else {
        alert('پنجره Arranger پیدا نشد.');
      }
    });

    window.electronAPI.onMenuCommand('menu-archive', () => {
      console.log('[Menu] Archive requested');
      if (typeof edOpenArchive === 'function') {
        edOpenArchive();
      } else {
        alert('آرشیو هنوز بارگذاری نشده است.');
      }
    });

    window.electronAPI.onMenuCommand('menu-midi-settings', () => {
      console.log('[Menu] MIDI Settings requested');
      if (typeof openMidiSettings === 'function') openMidiSettings();
      else alert('تنظیمات MIDI هنوز پیاده‌سازی نشده است.');
    });

    window.electronAPI.onMenuCommand('menu-preferences', () => {
      console.log('[Menu] Preferences requested');
      if (typeof openPreferences === 'function') openPreferences();
      else alert('تنظیمات برنامه هنوز پیاده‌سازی نشده است.');
    });

    console.log('[App] Menu command handlers registered successfully.');
  }
});
}
      // Also override on the popup's global scope for the chord script
      try { _lyricPopup.eval('_pCfg.cSize=' + _pvSettings.cSize + ';_pCfg.cColor="' + _pvSettings.cColor + '";'); } catch(_) {}
      // Settings panel initialization — use persistent _pvSettings from outer scope
      const _pvDoc = _lyricPopup.document;
      function _pvApply() {
        const root = _pvDoc.body;
        root.style.background = _pvSettings.bgColor;
        // Apply to all lines
        _pvDoc.querySelectorAll('.eline').forEach(el => {
          el.style.color = _pvSettings.tColor;
          el.style.fontSize = _pvSettings.tSize + 'px';
          el.style.fontWeight = _pvSettings.bold ? 'bold' : 'normal';
          el.style.fontFamily = _getFontFamilyCSS(_pvSettings.font);
        });
        // Update chord config in popup's global scope
        try { _lyricPopup.eval('_pCfg.cSize=' + _pvSettings.cSize + ';_pCfg.cColor="' + _pvSettings.cColor + '";'); } catch(_) {}
        // Re-render chords with new sizes
        try { _lyricPopup.eval('if(typeof _pScheduleChordRender==="function"){_pScheduleChordRender("style");}else if(typeof _pRenderChords==="function"){_pRenderChords();}'); } catch(_) {}
      }
      // Toggle settings panel (auto-hide: clicking outside closes it)
      const _pvToggle = _pvDoc.getElementById('pv-settings-toggle');
      const _pvPanel = _pvDoc.getElementById('pv-settings');
      if (_pvToggle && _pvPanel) {
        _pvToggle.onclick = (e) => { e.stopPropagation(); _pvPanel.style.display = _pvPanel.style.display === 'none' ? 'block' : 'none'; };
        _pvDoc.body.addEventListener('click', (e) => { if (!_pvPanel.contains(e.target) && e.target !== _pvToggle) _pvPanel.style.display = 'none'; });
      }
      // Wire up controls
      const _pvFont = _pvDoc.getElementById('pv-font'); if (_pvFont) { _pvFont.value = _pvSettings.font; _pvFont.onchange = () => { _pvSettings.font = _pvFont.value; _pvSave(); _pvApply(); }; }
      const _pvTC = _pvDoc.getElementById('pv-tColor'); if (_pvTC) { _pvTC.value = _pvSettings.tColor; _pvTC.oninput = () => { _pvSettings.tColor = _pvTC.value; _pvSave(); _pvApply(); }; }
      const _pvCC = _pvDoc.getElementById('pv-cColor'); if (_pvCC) { _pvCC.value = _pvSettings.cColor; _pvCC.oninput = () => { _pvSettings.cColor = _pvCC.value; _pvSave(); _pvApply(); }; }
      const _pvBG = _pvDoc.getElementById('pv-bgColor'); if (_pvBG) { _pvBG.value = _pvSettings.bgColor; _pvBG.oninput = () => { _pvSettings.bgColor = _pvBG.value; _pvSave(); _pvApply(); }; }
      const _pvTS = _pvDoc.getElementById('pv-tSize'); const _pvTV = _pvDoc.getElementById('pv-tSizeVal');
      if (_pvTS) { _pvTS.value = _pvSettings.tSize; if (_pvTV) _pvTV.textContent = _pvSettings.tSize; _pvTS.oninput = () => { _pvSettings.tSize = +_pvTS.value; if (_pvTV) _pvTV.textContent = _pvSettings.tSize; if (_pvSettings.scaleLock) { _pvSettings.cSize = Math.round(_pvSettings.tSize * 0.7); const cs = _pvDoc.getElementById('pv-cSize'); const cv = _pvDoc.getElementById('pv-cSizeVal'); if (cs) cs.value = _pvSettings.cSize; if (cv) cv.textContent = _pvSettings.cSize; } _pvSave(); _pvApply(); }; }
      const _pvCS = _pvDoc.getElementById('pv-cSize'); const _pvCV = _pvDoc.getElementById('pv-cSizeVal');
      if (_pvCS) { _pvCS.value = _pvSettings.cSize; if (_pvCV) _pvCV.textContent = _pvSettings.cSize; _pvCS.oninput = () => { _pvSettings.cSize = +_pvCS.value; if (_pvCV) _pvCV.textContent = _pvSettings.cSize; if (_pvSettings.scaleLock) { _pvSettings.tSize = Math.round(_pvSettings.cSize / 0.7); const ts = _pvDoc.getElementById('pv-tSize'); const tv = _pvDoc.getElementById('pv-tSizeVal'); if (ts) ts.value = _pvSettings.tSize; if (tv) tv.textContent = _pvSettings.tSize; } _pvSave(); _pvApply(); }; }
      const _pvSL = _pvDoc.getElementById('pv-scaleLock'); if (_pvSL) { _pvSL.checked = _pvSettings.scaleLock; _pvSL.onchange = () => { _pvSettings.scaleLock = _pvSL.checked; _pvSave(); }; }
      const _pvBold = _pvDoc.getElementById('pv-bold'); if (_pvBold) { _pvBold.checked = _pvSettings.bold; _pvBold.onchange = () => { _pvSettings.bold = _pvBold.checked; _pvSave(); _pvApply(); }; }
      // Apply saved settings on load
      _pvApply();
      // ریسایز درگ‌کردنی نوار آکورد
      (function() {
        const _handle = _pvDoc.getElementById('chordMirrorHandle');
        const _wrapper = _pvDoc.getElementById('chordMirrorResize');
        const _mirror = _pvDoc.getElementById('playerChordMirror');
        if (!_handle || !_wrapper || !_mirror) return;
        let _dragging = false, _startY = 0, _startH = 0;
        _handle.addEventListener('mousedown', function(e) {
          e.preventDefault(); _dragging = true; _startY = e.clientY; _startH = _wrapper.offsetHeight;
          _pvDoc.body.style.cursor = 'ns-resize'; _pvDoc.body.style.userSelect = 'none';
        });
        _pvDoc.addEventListener('mousemove', function(e) {
          if (!_dragging) return;
          const newH = Math.max(40, Math.min(300, _startH + (_startY - e.clientY)));
          _wrapper.style.height = newH + 'px';
          _mirror.style.height = (newH - 4) + 'px';
        });
        _pvDoc.addEventListener('mouseup', function() {
          if (_dragging) { _dragging = false; _pvDoc.body.style.cursor = ''; _pvDoc.body.style.userSelect = ''; }
        });
      })();
      // Highlight sync: update popup directly from main window (not postMessage)
      // فقط class toggling — هیچ inline style reset — هیچ DOM rebuild
      let _pvLastScrolledIdx = -999;
      function _syncLyricPopupHighlight() {
        if (!_lyricPopup || _lyricPopup.closed) return;
        const popupBody = _lyricPopup.document.getElementById('popupBody');
        if (!popupBody) return;
        const times = edCur?.syncTimes || [];
        const t = DAW?.playhead || 0;
        let activeIdx = -1;
        for (let i = 0; i < times.length; i++) {
          if (Number.isFinite(times[i]) && times[i] <= t) activeIdx = i;
          else if (Number.isFinite(times[i]) && times[i] > t) break;
        }
        // فقط class toggling — بدون reset inline styles
        [...popupBody.children].forEach(el => {
          if (!el.dataset.li) return;
          const li = +el.dataset.li;
          el.classList.toggle('active', li === activeIdx);
          el.classList.toggle('done', (times[li] != null) && times[li] < t && li !== activeIdx);
        });
        // اسکرول فقط وقتی خط فعال عوض شده
        if (activeIdx >= 0 && activeIdx !== _pvLastScrolledIdx) {
          _pvLastScrolledIdx = activeIdx;
          const activeEl = popupBody.querySelector('[data-li="' + activeIdx + '"]');
          if (activeEl) {
            const bodyH = popupBody.clientHeight;
            popupBody.scrollTo({ top: activeEl.offsetTop - bodyH / 2 + activeEl.offsetHeight / 2, behavior: 'smooth' });
          }
        }
      }
      _lyricPopup._syncHighlight = _syncLyricPopupHighlight;
      // Fallback chord render chain: اگر rAF اولیه در full rebuild fail شد
      [200, 500, 1000].forEach(function(ms) {
        setTimeout(function() {
          try {
            if (_lyricPopup && !_lyricPopup.closed && typeof _lyricPopup._pRenderChords === 'function') {
              _lyricPopup._pRenderChords();
            }
          } catch(_) {}
        }, ms);
      });
      // Force Reflow: مجبور کردن مرورگر به محاسبه مجدد چیدمان
      try {
        const _pb = _lyricPopup.document.getElementById('popupBody');
        if (_pb) void _pb.offsetHeight;
        _lyricPopup.dispatchEvent(new Event('resize'));
      } catch(_) {}
    }

    /* ===== SYNC / LINE GUIDE ===== */
    let syncCursor = 0,
    syncHistory = [],
    syncRedoHistory = [],
    syncWatch = null,
    syncActive = false;

let lastSyncActiveLi = -999;
let syncTapKeyHandler = null;

    /* ===== SYNC / LINE GUIDE — پل SyncModeController (Commit 2a) ===== */
    // state همچنان متعلق به app.js است؛ کنترلر از طریق accessor می‌خواند/می‌نویسد.
    const syncModeState = {
      get active() { return syncActive; }, set active(v) { syncActive = v; },
      get cursor() { return syncCursor; }, set cursor(v) { syncCursor = v; },
      get history() { return syncHistory; }, set history(v) { syncHistory = v; },
      get redoHistory() { return syncRedoHistory; }, set redoHistory(v) { syncRedoHistory = v; },
      get watch() { return syncWatch; }, set watch(v) { syncWatch = v; },
      get tapKeyHandler() { return syncTapKeyHandler; }, set tapKeyHandler(v) { syncTapKeyHandler = v; },
      get lastActiveLi() { return lastSyncActiveLi; }, set lastActiveLi(v) { lastSyncActiveLi = v; }
    };

    // Commit 2b — accessor روی stateهای seq/CL (تعریف letها در app.js می‌ماند؛
    // edSeq* در ادامهٔ فایل و edCl* کمی پایین‌تر تعریف می‌شوند — closureها فقط هنگام فراخوانی مقدار می‌خوانند)
    const seqClState = {
      get seqModeActive() { return edSeqModeActive; }, set seqModeActive(v) { edSeqModeActive = v; },
      get seqPoints() { return edSeqPoints; }, set seqPoints(v) { edSeqPoints = v; },
      get chordingActive() { return edSeqChordingActive; }, set chordingActive(v) { edSeqChordingActive = v; },
      get seqCursor() { return edSeqCursor; }, set seqCursor(v) { edSeqCursor = v; },
      get clMode() { return edClMode; }, set clMode(v) { edClMode = v; },
      get clTapActive() { return edClTapActive; }, set clTapActive(v) { edClTapActive = v; },
      get clMarkers() { return edClMarkers; }, set clMarkers(v) { edClMarkers = v; }
    };

    let syncModeControllerBridge = null;

    function createSyncModeControllerBridge() {
      if (syncModeControllerBridge) return syncModeControllerBridge;
      if (typeof window.SyncModeController !== 'function') return null;

      syncModeControllerBridge = new window.SyncModeController({
            state: syncModeState,
            seqState: seqClState,
            getDAW: () => DAW,
            getEdCur: () => (typeof edCur !== 'undefined' ? edCur : null),
            $: (id) => $(id),
            t: (key) => t(key),
            toast: (msg) => toast(msg),
            edSaveSong: () => edSaveSong(),
            startTransport: () => startTransport(),
            pauseTransport: () => pauseTransport(),
            seekTransport: (time, keepPlaying) => seekTransport(time, keepPlaying),
            getProjectEnd: () => getProjectEnd(),
            getLyricPopup: () => (typeof _lyricPopup !== 'undefined' ? _lyricPopup : null),
            getLyricOnlyPopup: () => (typeof _lyricOnlyPopup !== 'undefined' ? _lyricOnlyPopup : null),
            getChordLinePopup: () => (typeof _chordLinePopup !== 'undefined' ? _chordLinePopup : null),
            edRenderChords: () => edRenderChords(),
            edCommit: () => edCommit(),
            saveState: () => saveState(),
            renderAll: () => renderAll(),
            uid: (p) => uid(p),
            roundMs: (v) => roundMs(v),
            ensureTimelineFits: (v) => ensureTimelineFits(v),
            timeToX: (v) => timeToX(v),
            formatTime: (v) => formatTime(v),
            openChordLinePopup: () => openChordLinePopup(),
            getPerformanceStore: () => window.RuntimeStateAdapter?.getPerformanceStore?.() || null,
            windowRef: window,
            logger: console
          });
      return syncModeControllerBridge;
    }

    function requireSyncModeController() {
      const controller = createSyncModeControllerBridge();
      if (!controller) {
        throw new Error('SyncModeController در دسترس نیست. ترتیب scriptها در Akordyar.html را بررسی کنید.');
      }
      return controller;
    }

    function renderSyncLyrics() { return requireSyncModeController().renderSyncLyrics(); }
    function selectSyncLine(li) { return requireSyncModeController().selectSyncLine(li); }
    function syncTap() { return requireSyncModeController().syncTap(); }
    function updateSyncHighlight() { return requireSyncModeController().updateSyncHighlight(); }



    // Sync tick loop و ورود/خروج حالت سینک — wrapperهای SyncModeController
    function syncTick() { return requireSyncModeController().syncTick(); }
    function enterSyncMode() { return requireSyncModeController().enterSyncMode(); }
    function exitSyncMode() { return requireSyncModeController().exitSyncMode(); }

    // Chord visibility toggle (editor only, independent of popup)
    if ($('edToggleChords')) $('edToggleChords').onclick = () => {
      edChordsVisible = !edChordsVisible;
      $('edToggleChords').classList.toggle('active', edChordsVisible);
      edRenderChords();
    };

    // Sequential chords (آکورد ترتیبی)
    function edRemapSeqPoints(oldText, newText) {
      if (!edCur?.seqPoints?.length) return;
      // منطق remap به js/editor/LyricPositionMapper.js منتقل شده است.
      edCur.seqPoints.forEach(sp => requireLyricPositionMapper().remapAnchorToNewText(sp, oldText, newText));
      edCur.seqPoints = edCur.seqPoints.filter(p => p.lineIndex >= 0);
      if (edSeqModeActive) edSeqPoints = edCur.seqPoints;
    }

    function edToggleSeqMode() { return requireSyncModeController().edToggleSeqMode(); }
    function edStartSeqChording() { return requireSyncModeController().edStartSeqChording(); }
    function edSeqNavigate(dir) { return requireSyncModeController().edSeqNavigate(dir); }

    if ($('edSeqToggle')) $('edSeqToggle').onclick = edToggleSeqMode;
    if ($('edSeqStart')) $('edSeqStart').onclick = edStartSeqChording;
    if ($('edSeqPrev')) $('edSeqPrev').onclick = () => edSeqNavigate(-1);
    if ($('edSeqNext')) $('edSeqNext').onclick = () => edSeqNavigate(1);

    // ===== Sequential: حالت کورد لاین (نقطه‌گذاری با آهنگ روی تایم لاین) =====
    let edClMode = false, edClTapActive = false, edClMarkers = [];
    function edUpdateClCount() { return requireSyncModeController().edUpdateClCount(); }
    function edRenderClMarkers() { return requireSyncModeController().edRenderClMarkers(); }
    function edSetSeqMode(mode) { return requireSyncModeController().edSetSeqMode(mode); }
    function edToggleClTap() { return requireSyncModeController().edToggleClTap(); }
    function edClTap() { return requireSyncModeController().edClTap(); }
    function edClUndoMarker() { return requireSyncModeController().edClUndoMarker(); }
    function edClClearMarkers() { return requireSyncModeController().edClClearMarkers(); }
    function edClApplyMarkers() { return requireSyncModeController().edClApplyMarkers(); }
    if ($('edSeqModeLyrics')) $('edSeqModeLyrics').onclick = () => edSetSeqMode('lyrics');
    if ($('edSeqModeChord')) $('edSeqModeChord').onclick = () => edSetSeqMode('chord');
    if ($('edClStart')) $('edClStart').onclick = edToggleClTap;
    if ($('edClUndo')) $('edClUndo').onclick = edClUndoMarker;
    if ($('edClClear')) $('edClClear').onclick = edClClearMarkers;
    if ($('edClApply')) $('edClApply').onclick = edClApplyMarkers;
    edUpdateClCount();

    // Editor click for seq mode point placement
    if ($('editor')) $('editor').addEventListener('click', (e) => {
      if (!edSeqModeActive) return;
      e.preventDefault();
      const sel = window.getSelection(); if (!sel.rangeCount) return;
      const rng = sel.getRangeAt(0);
      const lineEl = rng.startContainer.parentElement?.closest?.('.eline') || (rng.startContainer.classList?.contains('eline') ? rng.startContainer : null);
      if (!lineEl) return;
      const lineIndex = [...$('editor').children].indexOf(lineEl);
      const text = lineEl.textContent.replace(/\u200B/g,'');
      const off = Math.min(rng.startOffset, text.length);
      let anchorType = 'OnCharacter', charIndex = off;
      if (off === 0) anchorType = 'LineStart';
      else if (off >= text.length) anchorType = 'LineEnd';
      edSeqPoints.push({ anchorType, lineIndex, charIndex, name: '' });
      edCur.seqPoints = edSeqPoints; edRenderChords(); edCommit();

    }, true);

    // Wire up sync buttons — wrapper SyncModeController
    function initSyncUI() { return requireSyncModeController().initSyncUI(); }

    /* ===== ARRANGER ===== */
    let arrangers = JSON.parse(localStorage.getItem('arrangers_v1') || '[]');
    window.arrangers = arrangers; // exposed for ProjectHub
    let editingArr = null;

    // ===== Normalize playlist name for comparison (case-insensitive, whitespace-insensitive) =====
    const normalizePlaylistName = (name) =>
      String(name || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("fa-IR");

    // ===== Check if playlist name already exists (excluding optional current id) =====
    function playlistNameExists(name, excludeId = null) {
      const normalizedName = normalizePlaylistName(name);
      return arrangers.some(a => a.id !== excludeId && normalizePlaylistName(a.name) === normalizedName);
    }

    // ===== Arranger Enhanced: Per-song settings =====
    // Each arranger item: { id, transpose: 0, notes: '' }
    // Arranger level: { crossfade: 0, pauseBetween: false }
    function ensureArrItem(arr, idx) {
      if (!arr._itemSettings) arr._itemSettings = {};
      const id = arr.items[idx];
      if (!arr._itemSettings[id]) arr._itemSettings[id] = { transpose: 0, notes: '' };
      return arr._itemSettings[id];
    }
    function getArrItemSetting(arr, songId) {
      if (!arr._itemSettings) return { transpose: 0, notes: '' };
      return arr._itemSettings[songId] || { transpose: 0, notes: '' };
    }

    function saveArrangers() { localStorage.setItem('arrangers_v1', JSON.stringify(arrangers)); }

    function openArrangerModal() {
      $('arrangerModal').classList.add('show');
      renderArrangerManager();
      // اگر ارنجری وجود داره، مستقیم ادیتور رو باز کن
      if (arrangers.length > 0) {
        editingArr = arrangers[0];
        openArrEditor();
      } else {
        $('arrEditor').style.display = 'none';
      }
      // درگ پنل ارنجر
      _setupArrangerModalDrag();
      // اضافه کردن هندلر کیبورد برای دکمه ESC و فوکوس
      const arrModal = $('arrangerModal');
      if (arrModal) {
        arrModal.focus();
        if (!arrModal._escHandler) {
          arrModal._escHandler = (e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              closeArrangerModal();
            }
          };
          arrModal.addEventListener('keydown', arrModal._escHandler);
        }
      }
    }
    function closeArrangerModal() {
      $('arrangerModal').classList.remove('show');
      // ریست موقعیت
      const editor = $('arrangerModal').querySelector('.chord-editor');
      if (editor) { editor.style.left = ''; editor.style.top = ''; }
      editingArr = null;
    }

    // Expose for ProjectHub (Hub arranger track click)
    window.openArrangerModal = openArrangerModal;
    window.closeArrangerModal = closeArrangerModal;

    // درگ arrangerModal
    function _setupArrangerModalDrag() {
      const handle = $('arrModalDragHandle');
      const modal = $('arrangerModal');
      const editor = modal.querySelector('.chord-editor');
      if (!handle || !editor || handle._dragSetup) return;
      handle._dragSetup = true;
      let dragging = false, startX, startY, origX, origY;
      handle.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'H3') {
          if (e.target.tagName === 'H3') {} else return;
        }
        dragging = true;
        const rect = editor.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        origX = rect.left; origY = rect.top;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        editor.style.left = (origX + e.clientX - startX) + 'px';
        editor.style.top = (origY + e.clientY - startY) + 'px';
      });
      document.addEventListener('mouseup', () => { dragging = false; });
    }

    function renderArrangerManager() {
      const box = $('arrManager'); box.innerHTML = '';

      // ─── هدر بخش پلی‌لیست‌ها ───
      const header = document.createElement('div');
      header.className = 'arr-manager-header';
      header.innerHTML = `
        <div style="display:flex;align-items:center;">
          <h4>📋 پلی‌لیست‌های ذخیره‌شده</h4>
          <span class="arr-count-badge">${arrangers.length}</span>
        </div>
      `;
      box.appendChild(header);

      // ─── نوار ابزار: پلی‌لیست جدید + ایمپورت/اکسپورت ───
      const toolbar = document.createElement('div');
      toolbar.className = 'arr-manager-toolbar';
      toolbar.innerHTML = `
        <button class="arr-btn-new" onclick="createNewArranger()" title="ساخت پلی‌لیست جدید">
          ＋ پلی‌لیست جدید
        </button>
        <div style="display:flex;gap:6px;">
          <button class="arr-btn-import" onclick="importArrangerFromFile()" title="بارگذاری یک پلی‌لیست از فایل JSON">
            📥 ورود یک پلی‌لیست
          </button>
          <button class="arr-btn-import" onclick="importAllPlaylistsFromFile()" title="بارگذاری کامل همه پلی‌لیست‌ها از فایل پشتیبان">
            📥 ورود کامل پلی‌لیست‌ها
          </button>
          <button class="arr-btn-import" onclick="exportAllPlaylistsToFile()" title="خروجی کامل همه پلی‌لیست‌ها در یک فایل" ${arrangers.length === 0 ? 'disabled' : ''}>
            📤 خروجی کامل پلی‌لیست‌ها
          </button>
        </div>
      `;
      box.appendChild(toolbar);

      // ─── حالت خالی ───
      if (!arrangers.length) {
        const empty = document.createElement('div');
        empty.className = 'arr-empty-state';
        empty.innerHTML = `
          <div class="arr-empty-icon">🎼</div>
          <div class="arr-empty-text">هنوز پلی‌لیستی نساخته‌اید.<br>روی «پلی‌لیست جدید» بزنید تا اولین پلی‌لیست رو بسازید.</div>
        `;
        box.appendChild(empty);
        return;
      }

      // ─── لیست کارت‌های پلی‌لیست ───
      arrangers.forEach(arr => {
        const isActive = editingArr && editingArr.id === arr.id;
        const card = document.createElement('div');
        card.className = 'arr-card' + (isActive ? ' arr-card-active' : '');

        // ساخت badge ها برای کراس‌فید و توقف
        const badges = [];
        if (arr.crossfade) badges.push(`<span class="arr-badge badge-crossfade">🔄 کراس‌فید: ${arr.crossfade}s</span>`);
        if (arr.pauseBetween) badges.push(`<span class="arr-badge badge-pause">⏸ توقف بین آهنگ‌ها</span>`);

        card.innerHTML = `
          <div class="meta">
            <b>${arr.name || t('untitled')}</b>
            <span>${arr.items.length} ${t('songN')}</span>
            ${badges.length ? `<div class="arr-card-badges">${badges.join('')}</div>` : ''}
          </div>
          <div class="acts">
            <button data-a="edit" title="ویرایش">✏️ ویرایش</button>
            <button data-a="export" class="act-export" title="خروجی به فایل">📤</button>
            <button data-a="del" class="act-del" title="حذف">🗑</button>
          </div>
        `;

        card.onclick = (e) => {
          const a = e.target.dataset.a;
          if (!a) {
            // کلیک روی کارت = ویرایش
            editingArr = arr;
            openArrEditor();
            return;
          }
          if (a === 'del') {
            if (confirm(`حذف پلی‌لیست «${arr.name || t('untitled')}»؟`)) {
              arrangers = arrangers.filter(x => x.id !== arr.id);
              saveArrangers();
              if (editingArr && editingArr.id === arr.id) {
                editingArr = null;
                $('arrEditor').style.display = 'none';
              }
              renderArrangerManager();
              toast('🗑 پلی‌لیست حذف شد');
            }
          } else if (a === 'edit') {
            editingArr = arr;
            openArrEditor();
          } else if (a === 'export') {
            exportArranger(arr);
          }
        };
        box.appendChild(card);
      });
    }

    // Send current song to Arranger Track
    function sendCurrentSongToArranger() {
      if (!edCur) { toast('ترانه‌ای باز نیست'); return; }
      // Save current song to archive first
      edSaveToArchive().then(() => {
        // If no arrangers exist, create one
        if (!arrangers.length) {
          const arr = { id: Date.now(), name: 'پلی‌لیست جدید', items: [], crossfade: 0, pauseBetween: false };
          arrangers.unshift(arr);
          editingArr = arr;
        } else {
          // Use first arranger or last edited one
          editingArr = arrangers[0];
        }
        // Add current song to arranger if not already there
        if (!editingArr.items.includes(edCur.id)) {
          editingArr.items.push(edCur.id);
        }
        saveArrangers();
        // Open arranger editor
        openArrangerModal();
        toast('ترانه به پلی‌لیست اضافه شد');
      });
    }

    async function createNewArranger() {
      const name = await customPrompt('نام پلی‌لیست جدید:', 'پلی‌لیست ' + (arrangers.length + 1));
      if (name === null) return; // کاربر کنسل کرد
      const trimmedName = name.trim() || ('پلی‌لیست ' + (arrangers.length + 1));

      // ─── بررسی نام تکراری با مقایسه normalize شده ───
      if (playlistNameExists(trimmedName)) {
        toast(`⚠ پلی‌لیستی با نام «${trimmedName}» از قبل وجود دارد. نام دیگری انتخاب کنید.`);
        return createNewArranger(); // دوباره بپرس
      }

      const arr = { 
        id: 'playlist_' + Date.now(), 
        name: trimmedName, 
        items: [], 
        crossfade: 0, 
        pauseBetween: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      arrangers.unshift(arr);
      saveArrangers();
      editingArr = arr;
      renderArrangerManager(); // اول لیست پلی‌لیست‌ها رو refresh کن
      openArrEditor();          // بعد ادیتور رو باز کن
      toast(`✅ پلی‌لیست «${arr.name}» ساخته شد`);
    }

    // Expose for ProjectHub (Hub "➕ جدید" button)
    window.createNewArranger = createNewArranger;

    function openArrEditor() {
      if (!editingArr) return;
      // ابتدا style های قدیمی رو پاک کن
      const arrManager = $('arrManager');
      arrManager.style.maxHeight = '';
      arrManager.style.borderBottom = '';
      arrManager.style.paddingBottom = '';
      arrManager.style.marginBottom = '';

      // ادیتور رو نمایش بده
      const arrEditor = $('arrEditor');
      arrEditor.style.display = 'block';

      // اطمینان از اینکه پنجره ارنجر هم نمایش داده شده
      const modal = $('arrangerModal');
      if (modal && !modal.classList.contains('show')) {
        modal.classList.add('show');
      }

      $('arrName').value = editingArr.name || '';
      // Sync crossfade/pause controls
      if (editingArr.crossfade) {
        $('arrCrossfadeRange').value = editingArr.crossfade;
        $('arrCrossfadeVal').textContent = editingArr.crossfade + 's';
      } else {
        $('arrCrossfadeRange').value = '0';
        $('arrCrossfadeVal').textContent = '0s';
      }
      if (editingArr.pauseBetween) $('arrPauseBtn').classList.add('arr-stl-active');
      else $('arrPauseBtn').classList.remove('arr-stl-active');
      renderArrPool(); renderArrSetlist();
      // Reset to editor tab
      switchArrTab('editor');
      // Highlight active arranger card
      renderArrangerManager();
      console.log(`[Arranger] Editor opened for: "${editingArr.name}"`);
    }

    function switchArrTab(tab) {
      document.querySelectorAll('.arr-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      $('arrTabEditor').style.display = tab === 'editor' ? '' : 'none';
      $('arrTabSongs').style.display = tab === 'songs' ? '' : 'none';
      if (tab === 'songs') renderArrSongsList();
    }

    function renderArrSongsList() {
      const box = $('arrSongsList');
      if (!editingArr || !editingArr.items.length) {
        box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-secondary);">ترانه‌ای در این ارنجر وجود ندارد</div>';
        return;
      }
      const allSongs = edGetAllSongs();
      let html = '';
      editingArr.items.forEach((songId, idx) => {
        const song = allSongs.find(s => s.id === songId);
        if (!song) return;
        const setting = getArrItemSetting(editingArr, songId);
        const key = song.key || '';
        const rhythm = song.rhythm || '';
        const transpose = setting.transpose ? (setting.transpose > 0 ? '+' + setting.transpose : setting.transpose) : '0';
        html += `<div class="arr-song-card">
          <div class="song-header">
            <div class="song-num">${idx + 1}</div>
            <div class="song-title">${song.title || 'بدون عنوان'}</div>
          </div>
          <div class="song-meta">
            ${song.artist ? '<span>🎤 ' + song.artist + '</span>' : ''}
            ${key ? '<span>🎵 گام: ' + key + '</span>' : ''}
            ${rhythm ? '<span>🥁 ریتم: ' + rhythm + '</span>' : ''}
            <span>♯ تغییر گام: ${transpose}</span>
          </div>
          ${setting.notes ? '<div style="margin-top:6px;font-size:0.8rem;color:var(--accent-cyan-glow);">📝 ' + setting.notes + '</div>' : ''}
        </div>`;
      });
      box.innerHTML = html;
    }
    function closeArrEditor() {
      saveArrangers();
      $('arrEditor').style.display = 'none';
      editingArr = null;
      renderArrangerManager();
    }

    /**
     * saveCurrentArranger — ذخیره پلی‌لیست فعلی
     * نام پلی‌لیست رو از input می‌خونه، در localStorage ذخیره می‌کنه،
     * و لیست پلی‌لیست‌ها رو refresh می‌کنه.
     * اگر نام تکراری باشه، خطا میده.
     */
    function saveCurrentArranger() {
      if (!editingArr) {
        toast('⚠ هیچ پلی‌لیستی در حال ویرایش نیست');
        return;
      }
      const nameInput = $('arrName');
      let newName = nameInput ? nameInput.value.trim() : '';
      if (!newName) newName = 'پلی‌لیست بدون نام';

      // ─── بررسی نام تکراری با مقایسه normalize شده (به‌جز خود پلی‌لیست فعلی) ───
      if (playlistNameExists(newName, editingArr.id)) {
        toast(`⚠ پلی‌لیستی با نام «${newName}» از قبل وجود دارد.`);
        return;
      }

      editingArr.name = newName;
      editingArr.updatedAt = new Date().toISOString();

      // ذخیره crossfade فعلی
      const cfRange = $('arrCrossfadeRange');
      if (cfRange) editingArr.crossfade = parseFloat(cfRange.value) || 0;

      saveArrangers();
      renderArrangerManager();
      toast(`✅ پلی‌لیست «${editingArr.name}» ذخیره شد (${editingArr.items.length} آهنگ)`);
    }

    // Debounced save for playlist name input
    let _saveNameDebounceTimer = null;
    function saveCurrentArrangerDebounced() {
      if (_saveNameDebounceTimer) clearTimeout(_saveNameDebounceTimer);
      _saveNameDebounceTimer = setTimeout(() => {
        saveCurrentArranger();
      }, 500);
    }

    /**
     * exportCurrentArranger — اکسپورت پلی‌لیست فعلی به فایل JSON
     */
    function exportCurrentArranger() {
      if (!editingArr) {
        toast('⚠ هیچ پلی‌لیستی در حال ویرایش نیست');
        return;
      }
      // اول پلی‌لیست رو ذخیره کن
      saveCurrentArranger();
      exportArranger(editingArr);
    }

    /**
     * exportArranger — اکسپورت یک پلی‌لیست مشخص به فایل JSON
     * @param {Object} arr - پلی‌لیست برای اکسپورت
     */
    async function exportArranger(arr) {
      if (!arr) { toast('⚠ پلی‌لیست نامعتبر'); return; }

      const allSongs = edGetAllSongs();
      const songData = {};
      arr.items.forEach(id => {
        const song = allSongs.find(s => s.id === id);
        if (song) songData[id] = song;
      });

      const exportData = {
        type: 'akordyar-playlist',
        version: '1.0',
        name: arr.name || 'پلی‌لیست',
        items: arr.items,
        crossfade: arr.crossfade || 0,
        pauseBetween: !!arr.pauseBetween,
        _itemSettings: arr._itemSettings || {},
        songs: songData,
        exportDate: new Date().toISOString()
      };

      const fileName = (arr.name || 'playlist').replace(/[\/\\:*?"<>|]/g, '_') + '.json';

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'JSON Playlist', accept: { 'application/json': ['.json'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(exportData, null, 2));
          await writable.close();
          toast(`✅ اکسپورت شد: ${fileName}`);
        } catch (e) {
          if (e.name !== 'AbortError') toast('خطا در اکسپورت: ' + e.message);
        }
      } else {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        toast(`✅ اکسپورت شد: ${fileName}`);
      }
    }

    /**
     * importArrangerFromFile — بارگذاری پلی‌لیست از فایل JSON
     * اگر پلی‌لیستی با همان نام وجود داشته باشد، خطا می‌دهد.
     */
    async function importArrangerFromFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);

          // بررسی فرمت
          if (!data || (!data.items && !data.songs)) {
            toast('❌ فایل معتبر نیست — فرمت پلی‌لیست نیست');
            return;
          }

          // بررسی نسخه فایل
          const supportedVersions = [1, '1.0', 2, '2.0'];
          if (data.version && !supportedVersions.includes(data.version)) {
            toast(`❌ نسخه فایل (${data.version}) پشتیبانی نمی‌شود.`);
            return;
          }

          // خواندن و اعتبارسنجی نام پلی‌لیست
          let baseName = data.name || file.name.replace(/\.json$/i, '');
          if (!baseName || !baseName.trim()) {
            toast('❌ نام پلی‌لیست در فایل خالی است.');
            return;
          }
          baseName = baseName.trim();

          // ─── بررسی نام تکراری با مقایسه normalize شده ───
          if (playlistNameExists(baseName)) {
            toast(`⚠ پلی‌لیستی با نام «${baseName}» از قبل وجود دارد.\nبرای ورود این فایل، ابتدا نام پلی‌لیست را در فایل خروجی یا در پروژه‌ی مبدا تغییر دهید.`);
            return;
          }

          // اعتبارسنجی items
          if (!Array.isArray(data.items)) {
            toast('❌ آرایه‌ی items در فایل معتبر نیست.');
            return;
          }

          // بررسی songId برای هر آیتم
          for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            // آیتم می‌تونه هم رشته/عدد (songId مستقیم) باشه هم آبجکت با خاصیت songId
            const songId = (item && typeof item === 'object') ? item.songId : item;
            if (!songId) {
              toast(`❌ آیتم شماره ${i + 1} فاقد songId معتبر است.`);
              return;
            }
          }

          // اگر آهنگ‌ها داخل فایل هستن، اول اونا رو به آرشیو اضافه کن
          let importedSongsCount = 0;
          if (data.songs && typeof data.songs === 'object') {
            const allSongs = edGetAllSongs();
            for (const [id, song] of Object.entries(data.songs)) {
              if (song && song.title) {
                if (!allSongs.find(s => s.id === id)) {
                  allSongs.push(song);
                  importedSongsCount++;
                }
              }
            }
            if (importedSongsCount > 0) {
              edSetAllSongs(allSongs);
              console.log(`[Import] ${importedSongsCount} song(s) imported from playlist`);
            }
          }

          // ساخت پلی‌لیست جدید با ساختار استاندارد
          const newArr = {
            id: 'playlist_' + Date.now(),
            name: baseName,
            items: Array.isArray(data.items) ? data.items.map(it => (it && typeof it === 'object') ? it.songId : it) : [],
            crossfade: data.crossfade || 0,
            pauseBetween: !!data.pauseBetween,
            _itemSettings: data._itemSettings || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          arrangers.unshift(newArr);
          saveArrangers();
          editingArr = newArr;
          renderArrangerManager();
          openArrEditor();

          toast(`✅ پلی‌لیست «${newArr.name}» بارگذاری شد (${newArr.items.length} آهنگ${importedSongsCount > 0 ? `، ${importedSongsCount} آهنگ جدید` : ''})`);
        } catch (e) {
          console.error('[Import] Error:', e);
          toast('❌ خطا در بارگذاری فایل: ' + e.message);
        }
      };
      input.click();
    }

    // Crossfade control
    function arrSetCrossfade(val) {
      if (editingArr) { editingArr.crossfade = val; saveArrangers(); }
      $('arrCrossfadeVal').textContent = val + 's';
    }

    // Pause between songs toggle
    function arrTogglePauseBetween() {
      if (!editingArr) return;
      editingArr.pauseBetween = !editingArr.pauseBetween;
      $('arrPauseBtn').classList.toggle('arr-stl-active', editingArr.pauseBetween);
      saveArrangers();
    }

    // Auto transpose all songs
    async function arrAutoTranspose() {
      if (!editingArr) return;
      const val = await customPrompt('تغییر گام برای همه آهنگ‌ها (مثلاً 2 یا -3):', '0');
      if (val === null) return;
      const semi = parseInt(val);
      if (isNaN(semi)) return;
      const allSongs = edGetAllSongs();
      editingArr.items.forEach(id => {
        const setting = ensureArrItem(editingArr, editingArr.items.indexOf(id));
        setting.transpose = (setting.transpose || 0) + semi;
      });
      saveArrangers(); renderArrSetlist();
    }

    // Clear all notes
    function arrClearNotes() {
      if (!editingArr || !confirm('یادداشت‌های همه آهنگ‌ها پاک شود؟')) return;
      editingArr.items.forEach(id => {
        const setting = ensureArrItem(editingArr, editingArr.items.indexOf(id));
        setting.notes = '';
      });
      saveArrangers(); renderArrSetlist();
    }

    // Song Note Modal
    let _arrNoteIdx = -1;
    function arrFilterSongs() {
      renderArrPool();
      renderArrSetlist();
    }
    function openArrSongNote(idx) {
      _arrNoteIdx = idx;
      const allSongs = edGetAllSongs();
      const id = editingArr.items[idx];
      const song = allSongs.find(x => x.id === id);
      const setting = ensureArrItem(editingArr, idx);
      $('arrSongNoteTitle').textContent = (song ? (song.title || 'بدون نام') : '') + ' — یادداشت اجرا';
      $('arrSongNoteText').value = setting.notes || '';
      $('arrSongNoteOverlay').classList.add('show');
    }
    function closeArrSongNote() {
      $('arrSongNoteOverlay').classList.remove('show');
      _arrNoteIdx = -1;
    }
    function saveArrSongNote() {
      if (_arrNoteIdx < 0 || !editingArr) return;
      const setting = ensureArrItem(editingArr, _arrNoteIdx);
      setting.notes = $('arrSongNoteText').value;
      saveArrangers(); closeArrSongNote(); renderArrSetlist();
    }

    function renderArrPool() {
      const box = $('arrPool'); box.innerHTML = '';
      const allSongs = edGetAllSongs();
      const inList = new Set(editingArr.items);
      let avail = allSongs.filter(s => !inList.has(s.id));
      const query = ($('arrSearchInput')?.value || '').trim().toLowerCase();
      if (query) {
        avail = avail.filter(s => {
          const matchText = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.key || '') + ' ' + (s.genre || '')).toLowerCase();
          return matchText.includes(query);
        });
      }
      if (!avail.length) { box.innerHTML = `<div style="padding:14px;color:var(--text-secondary);font-size:13px;">${query ? 'نتیجه‌ای یافت نشد' : t('allInSetlist')}</div>`; return; }
      avail.forEach(s => {
        const it = document.createElement('div'); it.className = 'arr-item';
        it.innerHTML = `<span class="ai-title">${s.title || t('untitled')}<small>${s.artist || '—'}</small></span><button>＋</button>`;
        it.onclick = () => { editingArr.items.push(s.id); saveArrangers(); renderArrPool(); renderArrSetlist(); };
        box.appendChild(it);
      });
    }

    // ===== Arranger Setlist Management =====
    let _arrDragIndex = null; // Persist drag index across render calls

    function renderArrSetlist() {
      const box = $('arrSetlist'); box.innerHTML = '';
      if (!editingArr.items.length) { box.innerHTML = `<div style="padding:14px;color:var(--text-secondary);font-size:13px;">${t('addFromLeft')}</div>`; return; }
      const allSongs = edGetAllSongs();
      const query = ($('arrSearchInput')?.value || '').trim().toLowerCase();
      
      editingArr.items.forEach((id, i) => {
        const s = allSongs.find(x => x.id === id); if (!s) return;
        // Live filtering
        if (query) {
          const matchText = ((s.title || '') + ' ' + (s.artist || '') + ' ' + (s.key || '') + ' ' + (s.genre || '')).toLowerCase();
          if (!matchText.includes(query)) return;
        }
        const setting = ensureArrItem(editingArr, i);
        const transVal = setting.transpose || 0;
        const transSign = transVal > 0 ? '+' + transVal : String(transVal);
        const hasNotes = !!(setting.notes && setting.notes.trim());
        const it = document.createElement('div'); it.className = 'arr-item'; it.draggable = true; it.dataset.i = i;
        it.innerHTML = `
          <div class="arr-item-controls">
            <button data-a="up" title="بالا">↑</button>
            <button data-a="down" title="پایین">↓</button>
            <span class="arr-item-number">${i + 1}</span>
          </div>
          <div class="arr-item-info" draggable="true">
            <span class="ai-title">${s.title || t('untitled')}</span>
            <small>${s.artist || '—'}</small>
          </div>
          <div class="ai-ctrls">
            <button class="ai-trans-btn" data-a="trans-down" title="بمل">♭</button>
            <span class="ai-trans-val">${transSign}</span>
            <button class="ai-trans-btn" data-a="trans-up" title="دیز">♯</button>
            <button class="ai-notes-btn ${hasNotes ? 'has-notes' : ''}" data-a="notes" title="یادداشت اجرا">📝</button>
            <button data-a="del" title="حذف">✕</button>
          </div>`;
        it.onclick = (e) => {
          const btn = e.target.closest('[data-a]');
          if (!btn) return;
          const a = btn.dataset.a;
          if (a === 'up' && i > 0) { [editingArr.items[i - 1], editingArr.items[i]] = [editingArr.items[i], editingArr.items[i - 1]]; }
          else if (a === 'down' && i < editingArr.items.length - 1) { [editingArr.items[i + 1], editingArr.items[i]] = [editingArr.items[i], editingArr.items[i + 1]]; }
          else if (a === 'del') { editingArr.items.splice(i, 1); }
          else if (a === 'trans-up') { setting.transpose = (setting.transpose || 0) + 1; }
          else if (a === 'trans-down') { setting.transpose = (setting.transpose || 0) - 1; }
          else if (a === 'notes') { openArrSongNote(i); return; }
          else return;
          saveArrangers(); renderArrSetlist();
        };
        it.addEventListener('dragstart', () => { _arrDragIndex = i; it.style.opacity = '.4'; });
        it.addEventListener('dragover', e => { e.preventDefault(); it.classList.add('dragover'); });
        it.addEventListener('dragleave', () => it.classList.remove('dragover'));
        it.addEventListener('drop', e => {
          e.preventDefault(); it.classList.remove('dragover');
          if (_arrDragIndex === null || _arrDragIndex === i) return;
          const moved = editingArr.items.splice(_arrDragIndex, 1)[0];
          editingArr.items.splice(i, 0, moved);
          saveArrangers(); renderArrSetlist(); _arrDragIndex = null;
        });
        it.addEventListener('dragend', () => { it.style.opacity = ''; });
        box.appendChild(it);
      });
    }

    // ===== Performance Mode (Live Dashboard) =====
    let arrPerformIdx = -1, arrPerformActive = false, arrPerformData = null, arrPreparePending = false;
    let _arrNextState = null;
    let _arrHasLoggedNoNextSong = false; // جلوگیری از تکرار لاگ "No more songs"
    let _arrPrepStartedForIndex = -1;    // جلوگیری از تکرار لاگ "Starting prep"
    let perfModeActive = false;
    let perfStageMode = false;
    let perfPauseMode = false;
    let perfLiveTranspose = 0;
    let perfTimer = null, perfStartTime = 0;

    // Crossfade state
    let _arrCrossfadeGain = null;
    let _arrIsCrossfading = false;

    // ─── Background Preload State ───
    // برای preload همه آهنگ‌های ارنجر در پس‌زمینه
    let _bgPreloadActive = false;
    let _bgPreloadedSongIds = new Set(); // آهنگ‌هایی که preload شد

    // ─── Wait Poll State ───
    // وقتی آهنگ فعلی تموم می‌شه ولی prep آهنگ بعدی هنوز انجام نشده،
    // این فلگ فعال می‌شه و یک poll مستقل از tick، منتظر اتمام prep می‌مونه
    let _arrWaitPollActive = false;

    async function openPerfMode() {
      if (!editingArr || !editingArr.items.length) { toast(t('emptySetlist')); return; }
      arrPerformData = editingArr;
      arrPerformIdx = 0;
      arrPerformActive = true;
      perfModeActive = true;
      perfLiveTranspose = 0;
      perfPauseMode = !!editingArr.pauseBetween;
      _arrNextState = null;

      const panel = $('arrPerfOverlay');
      panel.style.display = 'flex';
      $('perfArrangerName').textContent = '🎤 ' + (editingArr.name || 'اجرا');
      $('perfPauseModeBtn').classList.toggle('arr-stl-active', perfPauseMode);

      // درگ پنل
      _setupPerfPanelDrag(panel);

      closeArrangerModal();
      renderPerfUI();
      await loadArrSong(0);
      renderPerfUI();
      startPerfTimer();

      // ─── Background preload همه آهنگ‌های ارنجر ───
      // این کار تضمین می‌کنه که وقتی به آهنگ بعدی می‌رسیم، صدا از قبل لود شده.
      // preload به‌صورت غیرمسدودکننده در پس‌زمینه انجام می‌شه.
      _startBackgroundPreload();

      // باز کردن Player View و Singer View مثل F9
      if (typeof openLyricOnlyPopup === 'function') openLyricOnlyPopup();
      if (typeof openLyricPopup === 'function') setTimeout(openLyricPopup, 300);
    }

    // درگ پنل اجرا
    function _setupPerfPanelDrag(panel) {
      const handle = $('arrPerfDragHandle');
      if (!handle || handle._dragSetup) return;
      handle._dragSetup = true;
      let dragging = false, startX, startY, origX, origY;
      handle.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        origX = rect.left; origY = rect.top;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        panel.style.left = (origX + e.clientX - startX) + 'px';
        panel.style.top = (origY + e.clientY - startY) + 'px';
        panel.style.right = 'auto';
      });
      document.addEventListener('mouseup', () => { dragging = false; });
    }

    function perfStop() {
      arrPerformActive = false;
      perfModeActive = false;
      _arrNextState = null;
      _bgPreloadActive = false; // توقف background preload
      _arrWaitPollActive = false; // توقف wait poll
      arrPreparePending = false; // reset prep flag
      _arrHasLoggedNoNextSong = false; // reset no-next-song log flag
      _arrPrepStartedForIndex = -1;    // reset prep log flag
      pauseTransport();
      $('arrPerfOverlay').style.display = 'none';
      stopPerfTimer();
    }

    /**
     * _startBackgroundPreload — preload تمام آهنگ‌های ارنجر در پس‌زمینه
     *
     * این تابع بلافاصله بعد از openPerfMode صدا زده می‌شه و تمام آهنگ‌های
     * ست‌لیست رو به‌صورت یکی‌یکی preload می‌کنه. این کار تضمین می‌کنه که
     * وقتی به آهنگ بعدی می‌رسیم، بافر صوتی از قبل در DAW.bufferCache هست.
     *
     * مهم: این تابع غیرمسدودکننده هست و نباید پخش فعلی رو مختل کنه.
     */
    function _startBackgroundPreload() {
      if (_bgPreloadActive) return;
      if (!arrPerformData || !arrPerformData.items.length) return;

      _bgPreloadActive = true;
      _bgPreloadedSongIds = new Set();

      const allSongs = edGetAllSongs();
      const songsToPreload = arrPerformData.items
        .map(id => allSongs.find(s => s.id === id))
        .filter(s => s); // فیلتر null ها

      console.log(`[BG Preload] Starting background preload for ${songsToPreload.length} songs`);

      // اجرای preload به‌صورت زنجیره‌ای (یکی‌یکی، نه موازی) برای جلوگیری از overload
      (async () => {
        for (let i = 0; i < songsToPreload.length; i++) {
          if (!_bgPreloadActive) {
            console.log('[BG Preload] Cancelled');
            return;
          }
          const song = songsToPreload[i];
          if (_bgPreloadedSongIds.has(song.id)) continue;

          try {
            // اگه آهنگ فعلی داره پخش می‌شه و نزدیک انتها هست، اولویت با prepareNextArrSong باشه
            // اینجا فقط preload می‌کنیم اگه bufferCache نداشته باشیم
            const hasAudioClips = song._dawClips && song._dawClips.some(c => c.type !== 'chord' && c.bufferKey);
            if (!hasAudioClips) {
              _bgPreloadedSongIds.add(song.id);
              continue;
            }

            // چک کن: آیا همه بافرها از قبل لود شدن؟
            const allLoaded = song._dawClips.every(c =>
              c.type === 'chord' || !c.bufferKey || DAW.bufferCache.has(c.bufferKey)
            );
            if (allLoaded) {
              _bgPreloadedSongIds.add(song.id);
              continue;
            }

            console.log(`[BG Preload] (${i + 1}/${songsToPreload.length}) Preloading: "${song.title || song.id}"`);
            await preloadAudioForSong(song);
            _bgPreloadedSongIds.add(song.id);

            // یک وقفه کوتاه بین هر آهنگ برای اجازه دادن به playback tick
            await new Promise(r => setTimeout(r, 50));
          } catch (e) {
            console.warn(`[BG Preload] Error preloading "${song.title}":`, e);
            _bgPreloadedSongIds.add(song.id); // علامت‌گذاری به‌عنوان پردازش‌شده برای جلوگیری از loop بی‌نهایت
          }
        }
        console.log('[BG Preload] Complete');
        _bgPreloadActive = false;
      })();
    }

    function perfTogglePauseMode() {
      document.activeElement?.blur();
      perfPauseMode = !perfPauseMode;
      $('perfPauseModeBtn').classList.toggle('arr-stl-active', perfPauseMode);
    }

    function perfTogglePlay() {
      document.activeElement?.blur();
      if (DAW.isPlaying) {
        pauseTransport();
        $('perfPlayBtn').textContent = '▶';
      } else {
        ensureAudioCtx();
        if (DAW.playhead <= 0) seekTransport(0, false);
        startTransport();
        $('perfPlayBtn').textContent = '⏸';
      }
    }

    function perfRestartSong() {
      document.activeElement?.blur();
      seekTransport(0, false);
      ensureAudioCtx();
      startTransport();
      $('perfPlayBtn').textContent = '⏸';
    }

    function perfPrevSong() {
      document.activeElement?.blur();
      if (arrPerformIdx > 0) {
        arrPerformActive = true;
        loadArrSong(arrPerformIdx - 1);
        renderPerfUI();
      }
    }

    function perfNextSong() {
      document.activeElement?.blur();
      if (arrPerformData && arrPerformIdx < arrPerformData.items.length - 1) {
        arrPerformActive = true;
        loadArrSong(arrPerformIdx + 1);
        renderPerfUI();
      }
    }

    // Per-song transpose during performance
    function perfTranspose(semi) {
      document.activeElement?.blur();
      if (!arrPerformData) return;
      const setting = ensureArrItem(arrPerformData, arrPerformIdx);
      setting.transpose = (setting.transpose || 0) + semi;
      // Apply transpose to all audio tracks
      DAW.tracks.forEach(t => {
        if (t.type === 'audio') {
          t.transpose = (t.transpose || 0) + semi;
        }
      });
      if (DAW.isPlaying) scheduleAllFromPlayhead();
      saveArrangers();
      perfLiveTranspose += semi;
      renderPerfUI();
    }

    // Tempo change during performance
    function perfTempoChange(delta) {
      const cur = parseInt($('edTempo')?.value) || 120;
      const newVal = clamp(cur + delta, 20, 300);
      $('edTempo').value = newVal;
      if (edCur) { edCur.tempo = newVal; edSaveSong(); }
      renderPerfUI();
    }

    // Jump to specific song from performance sidebar
    function perfJumpToSong(idx) {
      if (idx < 0 || !arrPerformData || idx >= arrPerformData.items.length) return;
      arrPerformActive = true;
      loadArrSong(idx);
      renderPerfUI();
    }

    // Render performance mode UI
    function renderPerfUI() {
      if (!perfModeActive || !arrPerformData) return;
      const arr = arrPerformData;
      const allSongs = edGetAllSongs();

      // Current song info
      const songId = arr.items[arrPerformIdx];
      const song = allSongs.find(s => s.id === songId);
      const setting = getArrItemSetting(arr, songId);

      $('perfSongNum').textContent = `${arrPerformIdx + 1} / ${arr.items.length}`;
      $('perfSongTitle').textContent = song ? (song.title || 'بدون نام') : '—';
      $('perfSongArtist').textContent = song ? (song.artist || '') : '';
      const keyName = song?.key || edCur?.key || 'C';
      const keyMode = song?.keyMode || edCur?.keyMode || 'maj';
      const transVal = setting.transpose || 0;
      $('perfSongKey').innerHTML = `${keyName} ${keyMode === 'maj' ? 'ماژور' : 'مینور'} ${transVal ? `<span class="perf-trans">(${transVal > 0 ? '+' : ''}${transVal})</span>` : ''}`;
      $('perfTransVal').textContent = transVal > 0 ? '+' + transVal : String(transVal);
      if ($('perfTempoVal')) $('perfTempoVal').textContent = edCur?.tempo || 120;

      // Render setlist
      const setlistEl = $('perfSetlist');
      if (!setlistEl) return;
      setlistEl.innerHTML = '';
      
      let draggedIndex = -1;
      
      arr.items.forEach((id, i) => {
        const s = allSongs.find(x => x.id === id);
        const st = getArrItemSetting(arr, id);
        const div = document.createElement('div');
        div.className = 'arr-perf-setlist-item' + (i === arrPerformIdx ? ' pf-current' : '') + (i === arrPerformIdx + 1 ? ' pf-next' : '') + (i < arrPerformIdx ? ' pf-done' : '');
        div.draggable = true;
        div.innerHTML = `<span class="pf-num">${i + 1}</span><span class="pf-name">${s ? (s.title || 'بدون نام') : '—'}</span><span class="pf-key">${s?.key || '—'}${st.transpose ? (st.transpose > 0 ? '+' : '') + st.transpose : ''}</span>`;
        
        // Click to jump
        div.onclick = () => perfJumpToSong(i);
        
        // Drag events
        div.addEventListener('dragstart', (e) => {
          draggedIndex = i;
          div.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(i));
        });
        
        div.addEventListener('dragend', () => {
          draggedIndex = -1;
          div.classList.remove('dragging');
          // Remove all drag-over styles
          Array.from(setlistEl.children).forEach(child => {
            child.classList.remove('drag-over-top', 'drag-over-bottom');
            child.style.borderTop = '';
            child.style.borderBottom = '';
          });
        });
        
        div.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (draggedIndex === -1 || draggedIndex === i) return;
          
          const rect = div.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          
          // Remove old classes
          Array.from(setlistEl.children).forEach(child => {
            child.classList.remove('drag-over-top', 'drag-over-bottom');
            child.style.borderTop = '';
            child.style.borderBottom = '';
          });
          
          if (e.clientY < midpoint) {
            div.classList.add('drag-over-top');
            div.style.borderTop = '2px solid var(--accent-teal)';
          } else {
            div.classList.add('drag-over-bottom');
            div.style.borderBottom = '2px solid var(--accent-teal)';
          }
        });
        
        div.addEventListener('dragleave', () => {
          div.classList.remove('drag-over-top', 'drag-over-bottom');
          div.style.borderTop = '';
          div.style.borderBottom = '';
        });
        
        div.addEventListener('drop', (e) => {
          e.preventDefault();
          if (draggedIndex === -1 || draggedIndex === i) return;
          
          const rect = div.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          let dropIndex = i;
          
          // Determine insert position
          if (e.clientY < midpoint) {
            dropIndex = i;
          } else {
            dropIndex = i + 1;
          }
          
          // Adjust if dragging from before the drop position
          if (draggedIndex < dropIndex) {
            dropIndex--;
          }
          
          // Reorder the array
          if (draggedIndex !== dropIndex) {
            const movedItem = arr.items.splice(draggedIndex, 1)[0];
            arr.items.splice(dropIndex, 0, movedItem);
            
            // Save updated playlist
            saveArrangers();
            
            // Re-render to reflect changes
            renderPerfPanel();
          }
          
          // Cleanup
          draggedIndex = -1;
          div.classList.remove('drag-over-top', 'drag-over-bottom');
          div.style.borderTop = '';
          div.style.borderBottom = '';
        });
        
        setlistEl.appendChild(div);
      });

      // Render section navigation buttons
      const secNav = $('perfSectionNav');
      secNav.innerHTML = '';
      const sections = ['مقدمه', 'ورس', 'کورس', 'بریج', 'آوترو'];
      const sectionTimes = [0]; // at least start
      if (DAW.sections && DAW.sections.length) {
        DAW.sections.forEach(s => sectionTimes.push(s.start));
      }
      // Add end
      sectionTimes.push(getArrangerEnd());
      sections.forEach((name, i) => {
        if (i < sectionTimes.length - 1 || i === 0) {
          const btn = document.createElement('button');
          btn.textContent = name;
          btn.onclick = () => {
            if (i < sectionTimes.length) {
              seekTransport(sectionTimes[i], false);
              if (!DAW.isPlaying) { ensureAudioCtx(); startTransport(); $('perfPlayBtn').textContent = '⏸'; }
            }
          };
          secNav.appendChild(btn);
        }
      });

      // Show notes if any
      const noteBadge = $('perfNoteBadge');
      if (setting.notes && setting.notes.trim()) {
        $('perfNoteText').textContent = setting.notes;
        noteBadge.classList.add('show');
      } else {
        noteBadge.classList.remove('show');
      }

      // Scroll to current in sidebar
      const currentItem = setlistEl.querySelector('.pf-current');
      if (currentItem) currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Timer for performance
    function startPerfTimer() {
      stopPerfTimer();
      perfStartTime = Date.now();
      perfTimer = setInterval(() => {
        if (!perfModeActive) return;
        const elapsed = Date.now() - perfStartTime;
        const min = Math.floor(elapsed / 60000);
        const sec = Math.floor((elapsed % 60000) / 1000);
        $('perfTime').textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      }, 1000);
    }
    function stopPerfTimer() {
      if (perfTimer) { clearInterval(perfTimer); perfTimer = null; }
    }

    // Override startArrangerPerform to use new perf mode
    async function startArrangerPerform() {
      await openPerfMode();
    }

    // Pre-build the next song's full DAW state while current plays
    // این تابع حالا با try/catch/finally کامل نوشته شده تا arrPreparePending
    // هرگز گیر نکنه. اگه خطایی رخ بده، retry می‌کنه.
    async function prepareNextArrSong(retryCount = 0) {
      const arr = arrPerformData || editingArr;
      const nextIdx = arrPerformIdx + 1;

      // اگر آهنگ بعدی وجود نداره، _arrNextState رو null کن
      if (!arr || nextIdx >= arr.items.length) {
        _arrNextState = null;
        // فقط یک‌بار لاگ بزن
        if (!_arrHasLoggedNoNextSong) {
          _arrHasLoggedNoNextSong = true;
          console.log('[Arranger Prep] No more songs — _arrNextState cleared');
        }
        return;
      }

      const allSongs = edGetAllSongs();
      const song = allSongs.find(s => s.id === arr.items[nextIdx]);
      if (!song) {
        _arrNextState = null;
        console.warn(`[Arranger Prep] Song at index ${nextIdx} not found in archive (id: ${arr.items[nextIdx]})`);
        return;
      }

      try {
        const songData = JSON.parse(JSON.stringify(song));
        if (!songData.styles) songData.styles = {};
        const defaults = { tSize:23,tColor:'#0fa966',tFont:'Vazirmatn',tBold:true,align:'center',cSize:23,cColor:'#e6aa28',cFont:'JetBrains Mono' };
        Object.keys(defaults).forEach(k => { if (songData.styles[k] === undefined) songData.styles[k] = defaults[k]; });

        // ─── Pre-load کامل صدا برای آهنگ بعدی ───
        const preloadResult = await preloadAudioForSong(songData);
        if (preloadResult.missing > 0) {
          console.warn(`[Arranger Prep] ${preloadResult.missing} audio clip(s) missing for "${songData.title}":`, preloadResult.missingNames);
        } else {
          console.log(`[Arranger Prep] ✓ Audio ready for "${songData.title}" (loaded: ${preloadResult.loaded})`);
        }

        const tracks = songData._dawTracks ? JSON.parse(JSON.stringify(songData._dawTracks)) : [];
        let clips = songData._dawClips ? JSON.parse(JSON.stringify(songData._dawClips)) : [];
        let sections = songData._dawSections ? JSON.parse(JSON.stringify(songData._dawSections)) : [];
        const oldSec = clips.filter(c => c.type === 'section');
        if (oldSec.length) { oldSec.forEach(c => { sections.push({ id: c.id, trackId: c.trackId, label: c.name, start: c.start, duration: c.duration, color: c.color }); }); clips = clips.filter(c => c.type !== 'section'); }

        const loopState = songData._dawLoop ? { loopEnabled: !!songData._dawLoop.loopEnabled, loopA: songData._dawLoop.loopA || 0, loopB: songData._dawLoop.loopB || 10 } : { loopEnabled: false, loopA: 0, loopB: 10 };
        const selEnd = (loopState.loopA < loopState.loopB) ? loopState.loopB : 0;

        // آپدیت sourceDuration و peaks برای کلیپ‌های که لود شدن
        clips.forEach(c => { if (c.type !== 'chord' && c.bufferKey && DAW.bufferCache.has(c.bufferKey)) { const buffer = DAW.bufferCache.get(c.bufferKey); c.sourceDuration = buffer.duration; c._peaks = peaksFromBuffer(buffer, 2000); } });

        // Apply per-song transpose to tracks
        const nextSetting = getArrItemSetting(arr, arr.items[nextIdx]);
        if (nextSetting.transpose) {
          tracks.forEach(t => { if (t.type === 'audio') t.transpose = (t.transpose || 0) + nextSetting.transpose; });
        }

        _arrNextState = { song: songData, idx: nextIdx, clips, sections, tracks, edCur: songData, selectionEnd: selEnd, loopState };
        console.log(`[Arranger Prep] ✓ _arrNextState ready for song ${nextIdx + 1}: "${songData.title}"`);
        
        // ─── تأیید نهایی: مطمئن شو همه بافرهای مورد نیاز واقعاً لود شدن ───
        const audioClipsInNext = clips.filter(c => c.type !== 'chord' && c.bufferKey);
        const missingBuffers = audioClipsInNext.filter(c => !DAW.bufferCache.has(c.bufferKey));
        if (missingBuffers.length > 0) {
          console.warn(`[Arranger Prep] ⚠ ${missingBuffers.length} buffer(s) still missing after prep:`, missingBuffers.map(c => c.fileName || c.bufferKey));
          // تلاش مجدد برای لود بافرهای گمشده
          await restoreAudioForProjectSilently(songData.id, true);
          console.log(`[Arranger Prep] ✓ Retry complete - buffers rechecked`);
        }
      } catch (e) {
        console.error(`[Arranger Prep] Error preparing song ${nextIdx + 1} (retry ${retryCount}):`, e);
        _arrNextState = null;

        // Retry mechanism: حداکثر ۲ بار با وقفه ۱ ثانیه
        if (retryCount < 2 && arrPerformActive) {
          console.log(`[Arranger Prep] Retrying in 1s... (attempt ${retryCount + 1}/2)`);
          await new Promise(r => setTimeout(r, 1000));
          if (arrPerformActive && arrPerformIdx === nextIdx - 1) {
            return prepareNextArrSong(retryCount + 1);
          }
        }
      }
    }

    // Crossfade between songs — نسخه بهبودیافته با overlap واقعی
    //
    // استراتژی:
    //   1. صدای آهنگ فعلی رو از طریق masterGain fade-out می‌کنیم
    //   2. همزمان hot-swap می‌کنیم و آهنگ جدید رو schedule می‌کنیم
    //   3. masterGain رو fade-in می‌کنیم
    //
    // این روش یک "gapless crossfade" ایجاد می‌کنه: در طول fadeTime،
    // صدای قدیمی fade-out و صدای جدید fade-in می‌شه. در نقطه میانی،
    // هر دو آهنگ در حال پخش هستن (overlap).
    function arrCrossfadeSwap() {
      const crossfadeDur = arrPerformData?.crossfade || 0;
      if (crossfadeDur <= 0 || !_arrNextState) { hotSwapToNextSong(); return; }

      _arrIsCrossfading = true;
      ensureAudioCtx();
      const ctx = DAW.audioCtx;
      const curGain = DAW.masterGain;
      const now = ctx.currentTime;
      const fadeTime = Math.min(Math.max(crossfadeDur, 0.5), 5); // بین 0.5 تا 5 ثانیه

      console.log(`[Arranger Crossfade] Starting ${fadeTime}s crossfade`);

      // ─── مرحله 1: fade-out صدای فعلی ───
      const currentVolume = curGain.gain.value;
      curGain.gain.cancelScheduledValues(now);
      curGain.gain.setValueAtTime(currentVolume, now);
      curGain.gain.linearRampToValueAtTime(0, now + fadeTime * 0.5);

      // ─── مرحله 2: در نیمه راه، hot-swap کن ───
      // در این نقطه، masterGain صفر هست، پس swap بی‌صدا انجام می‌شه
      setTimeout(() => {
        try {
          // قبل از swap، صدای فعلی رو کامل قطع کن
          stopAllVoices();

          // hot-swap به آهنگ جدید
          hotSwapToNextSong();

          // حالا masterGain رو از 0 به 1 fade-in کن
          const fadeInNow = ctx.currentTime;
          curGain.gain.cancelScheduledValues(fadeInNow);
          curGain.gain.setValueAtTime(0, fadeInNow);
          curGain.gain.linearRampToValueAtTime(currentVolume, fadeInNow + fadeTime * 0.5);

          console.log('[Arranger Crossfade] Fade-in started');
        } catch(e) {
          console.error('[Arranger Crossfade] Error during swap:', e);
        } finally {
          _arrIsCrossfading = false;
        }
      }, fadeTime * 500); // نصف fadeTime به میلی‌ثانیه
    }
