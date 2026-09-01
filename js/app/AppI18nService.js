/**
 * AppI18nService
 *
 * Owns application translations and language switching. Legacy global names
 * remain available because classic scripts and inline actions still consume
 * them.
 */
(function attachAppI18nService(globalScope) {
  'use strict';

  const I18N = Object.freeze({
    fa: Object.freeze({
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
      syncExit: '◀ بستن', syncPlay: '▶ پخش', syncPause: '⏸ توقف'
    }),
    en: Object.freeze({
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
      syncExit: '◀ Close', syncPlay: '▶ Play', syncPause: '⏸ توقف'
    })
  });

  function normalizeLanguage(language) {
    return language === 'en' ? 'en' : 'fa';
  }

  function readLanguage(storage) {
    try {
      return normalizeLanguage(storage?.getItem?.('appLang') || 'fa');
    } catch (_) {
      return 'fa';
    }
  }

  function create({
    storage = globalScope.localStorage,
    documentRef = globalScope.document,
    getSongState = () => globalScope.requireEditorSongStateService?.(),
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    toast = null
  } = {}) {
    let currentLang = readLanguage(storage);

    function t(key) {
      return I18N[currentLang]?.[key] || I18N.fa?.[key] || key;
    }

    function getCurrentLang() {
      return currentLang;
    }

    function setLanguage(language, { persist = true } = {}) {
      currentLang = normalizeLanguage(language);
      if (persist) {
        try {
          storage?.setItem?.('appLang', currentLang);
        } catch (_) {
          // Language preference is best-effort.
        }
      }
      return currentLang;
    }

    function applyI18n() {
      if (!documentRef) return;
      documentRef.querySelectorAll?.('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) element.textContent = t(key);
      });
      documentRef.querySelectorAll?.('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (key) element.title = t(key);
      });
      documentRef.querySelectorAll?.('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (key) element.placeholder = t(key);
      });
      if (documentRef.documentElement) {
        documentRef.documentElement.dir = currentLang === 'fa' ? 'rtl' : 'ltr';
        documentRef.documentElement.lang = currentLang;
      }

      const getElement = id => documentRef.getElementById?.(id);
      const titleElement = getElement('edPrintTitle');
      const title = getSongState?.()?.getPresentationSnapshot?.()?.title;
      if (titleElement) titleElement.textContent = title || t('untitled');

      const syncPlayButton = getElement('syncPlayBtn');
      if (syncPlayButton) {
        syncPlayButton.textContent = getDAW?.()?.isPlaying
          ? t('syncPause')
          : t('syncPlay');
      }
    }

    function toggleLang() {
      const language = setLanguage(currentLang === 'fa' ? 'en' : 'fa');
      applyI18n();
      const notify = toast || globalScope.toast;
      notify?.(language === 'fa' ? 'زبان فارسی' : 'English');
      return language;
    }

    return Object.freeze({
      t,
      getCurrentLang,
      setLanguage,
      applyI18n,
      toggleLang
    });
  }

  const service = Object.freeze({ create, messages: I18N });
  const runtime = create();

  globalScope.AppI18nService = service;
  globalScope.I18N = I18N;
  globalScope.t = runtime.t;
  globalScope.getCurrentLang = runtime.getCurrentLang;
  globalScope.setCurrentLang = runtime.setLanguage;
  globalScope.applyI18n = runtime.applyI18n;
  globalScope.toggleLang = runtime.toggleLang;
  Object.defineProperty(globalScope, 'currentLang', {
    configurable: true,
    enumerable: false,
    get: runtime.getCurrentLang,
    set: value => runtime.setLanguage(value)
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
