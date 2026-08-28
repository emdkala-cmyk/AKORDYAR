/*
 * CorePopupRuntimeService
 *
 * Composes popup state, focus mode and Player View orchestration outside
 * app/core.js. The individual popup renderers remain independent services;
 * this module only owns their application-level wiring and lifecycle.
 */
(function attachCorePopupRuntimeService(globalScope) {
  'use strict';

  function requireService(service, name) {
    if (!service || typeof service.create !== 'function') {
      throw new Error(
        `${name} باید قبل از app/core.js بارگذاری شود.`
      );
    }
    return service;
  }

  function create({
    state = {},
    window = {},
    actions = {},
    services = {}
  } = {}) {
    let lyricPopup = state.lyricPopup || null;
    let lyricOnlyPopup = state.lyricOnlyPopup || null;
    let chordLinePopup = state.chordLinePopup || null;
    let focusMode = Boolean(state.focusMode);
    const getLyricPopup =
      typeof state.getLyricPopup === 'function'
        ? state.getLyricPopup
        : () => lyricPopup;
    const setLyricPopup =
      typeof state.setLyricPopup === 'function'
        ? state.setLyricPopup
        : value => {
            lyricPopup = value;
          };
    const getLyricOnlyPopup =
      typeof state.getLyricOnlyPopup === 'function'
        ? state.getLyricOnlyPopup
        : () => lyricOnlyPopup;
    const setLyricOnlyPopup =
      typeof state.setLyricOnlyPopup === 'function'
        ? state.setLyricOnlyPopup
        : value => {
            lyricOnlyPopup = value;
          };
    const getChordLinePopup =
      typeof state.getChordLinePopup === 'function'
        ? state.getChordLinePopup
        : () => chordLinePopup;
    const setChordLinePopup =
      typeof state.setChordLinePopup === 'function'
        ? state.setChordLinePopup
        : value => {
            chordLinePopup = value;
          };
    const getFocusMode =
      typeof state.getFocusMode === 'function'
        ? state.getFocusMode
        : () => focusMode;
    const setFocusMode =
      typeof state.setFocusMode === 'function'
        ? state.setFocusMode
        : value => {
            focusMode = Boolean(value);
          };

    const {
      documentRef = globalScope.document,
      windowRef = globalScope,
      navigatorRef = windowRef?.navigator,
      nodeFilter = windowRef?.NodeFilter,
      popupWindowBridge = null,
      isPopupOpen = popup => Boolean(popup && !popup.closed),
      popupDocument = popup => popup?.document || null,
      openPopupWindow = () => null,
      focusPopupWindow = () => {},
      EventCtor = windowRef?.Event,
      schedule = (...args) => windowRef?.setTimeout?.(...args),
      safeMirrorTimeline = () => {}
    } = window;

    const {
      getSongState = () => null,
      getDAW = () => ({}),
      getTransportPlayhead = () => 0,
      getTransportVisualPlayhead = getTransportPlayhead,
      getHighlightState = () =>
        globalScope.RuntimeStateAdapter?.getPerformanceStore?.()
          ?.getState?.().highlightState || null,
      getSyncTimes = () => [],
      transposeChord = name => name,
      renderChords = () => {},
      toast = () => {},
      translate = key => key,
      getCurrentLang = () => globalScope.currentLang || 'fa',
      applyHighlightClassToPopup = () => {}
    } = actions;

    const {
      focusMode: focusModeService,
      lyricOnlyPopup: lyricOnlyPopupService,
      chordLinePopup: chordLinePopupService,
      playerViewSettings: playerViewSettingsService,
      playerViewPopupSync: playerViewPopupSyncService,
      playerViewPopupBuilder: playerViewPopupBuilderService,
      playerViewPopup: playerViewPopupService,
      chordRenderer
    } = services;

    function installPopupHighlightLoop(popup, doc) {
      if (!popup || !doc?.body) return;
      const script = doc.createElement('script');
      script.textContent =
        '(function(){if(window.__akordHighlightLoopStarted)return;window.__akordHighlightLoopStarted=true;function frame(){try{window._syncHighlight?.()}catch(_){}if(!window.closed)window.requestAnimationFrame(frame)}frame()})();';
      doc.body.appendChild(script);
    }

    const focusRuntime = requireService(
      focusModeService,
      'CoreFocusModeService'
    ).create({
      documentRef,
      getElement: id => documentRef?.getElementById?.(id),
      getFocusMode,
      setFocusMode,
      getSongState,
      schedule,
      renderChords,
      toast,
      translate
    });

    const lyricOnlyRuntime = requireService(
      lyricOnlyPopupService,
      'CoreLyricOnlyPopupService'
    ).create({
      getPopup: getLyricOnlyPopup,
      isPopupOpen,
      popupDocument,
      getSnapshot: () => getSongState()?.getPresentationSnapshot?.(),
      popupWindowBridge,
      windowRef,
      getDAW,
      getTransportPlayhead,
      getTransportVisualPlayhead,
      getSyncTimes,
      installPopupHighlightLoop
    });

    const chordLineRuntime = requireService(
      chordLinePopupService,
      'CoreChordLinePopupService'
    ).create({
      getPopup: getChordLinePopup,
      setPopup: setChordLinePopup,
      getSongState,
      isPopupOpen,
      popupDocument,
      openPopupWindow,
      focusPopupWindow,
      popupWindowBridge,
      windowRef,
      navigatorRef,
      nodeFilter,
      transposeChord,
      translate,
      toast
    });

    const settingsRuntime = requireService(
      playerViewSettingsService,
      'CorePlayerViewSettingsService'
    ).create({
      getPopup: getLyricPopup,
      isPopupOpen,
      popupDocument,
      popupWindowBridge,
      windowRef,
      getSongState,
      getDAW,
      getTransportPlayhead,
      getTransportVisualPlayhead,
      getHighlightState,
      installPopupHighlightLoop,
      schedule,
      EventCtor
    });

    const popupSyncRuntime = requireService(
      playerViewPopupSyncService,
      'CorePlayerViewPopupSyncService'
    ).create({
      getPopup: getLyricPopup,
      documentRef: () => popupDocument(getLyricPopup()),
      popupWindowBridge,
      getSnapshot: () => getSongState()?.getPresentationSnapshot?.(),
      transposeChord,
      getSettings: () => settingsRuntime.getSettings(),
      isPopupOpen,
      schedule,
      EventCtor
    });

    const popupBuilderRuntime = requireService(
      playerViewPopupBuilderService,
      'CorePlayerViewPopupBuilderService'
    ).create({
      getPopup: getLyricPopup,
      popupWindowBridge,
      chordRenderer,
      settingsRuntime,
      applyHighlightClassToPopup
    });

    const playerPopupRuntime = requireService(
      playerViewPopupService,
      'CorePlayerViewPopupService'
    ).create({
      getPopup: getLyricPopup,
      isPopupOpen,
      popupDocument,
      getSnapshot: () => getSongState()?.getPresentationSnapshot?.(),
      translate,
      getCurrentLang,
      transposeChord,
      popupSyncRuntime,
      popupBuilderRuntime
    });

    function syncLyricPopup(...args) {
      return playerPopupRuntime?.sync?.(...args);
    }

    function syncLyricOnlyPopup(...args) {
      return lyricOnlyRuntime?.sync?.(...args);
    }

    function openLyricPopup() {
      const popup = getLyricPopup();
      if (isPopupOpen(popup)) {
        focusPopupWindow(popup);
        syncLyricPopup();
        return;
      }
      const nextPopup = openPopupWindow(
        'lyricPopup',
        'width=900,height=700,menubar=no,toolbar=no,location=no,status=no'
      );
      setLyricPopup(nextPopup);
      if (!nextPopup) {
        toast(translate('popupBlocked'));
        return;
      }
      popupWindowBridge?.set?.(nextPopup, '__popupRole', 'player');
      syncLyricPopup();
      schedule(safeMirrorTimeline, 1000);
    }

    function openLyricOnlyPopup() {
      const popup = getLyricOnlyPopup();
      if (isPopupOpen(popup)) {
        focusPopupWindow(popup);
        syncLyricOnlyPopup();
        return;
      }
      const nextPopup = openPopupWindow(
        'lyricOnlyPopup',
        'width=650,height=400,menubar=no,toolbar=no,status=no,location=no'
      );
      setLyricOnlyPopup(nextPopup);
      if (!nextPopup) {
        toast(translate('popupBlocked'));
        return;
      }
      popupWindowBridge?.set?.(nextPopup, '__popupRole', 'singer');
      syncLyricOnlyPopup();
    }

    return Object.freeze({
      getLyricPopup: () => getLyricPopup?.() || null,
      getLyricOnlyPopup: () => getLyricOnlyPopup?.() || null,
      getChordLinePopup: () => getChordLinePopup?.() || null,
      getFocusMode: () => Boolean(getFocusMode?.()),
      openLyricPopup,
      syncLyricPopup,
      openLyricOnlyPopup,
      syncLyricOnlyPopup,
      openChordLinePopup: chordLineRuntime.openChordLinePopup,
      syncChordLinePopup: chordLineRuntime.syncChordLinePopup,
      toggleFocusMode: focusRuntime.toggleFocusMode,
      getSettings: settingsRuntime.getSettings,
      save: settingsRuntime.save,
      apply: settingsRuntime.apply,
      setupWheelHandlers: settingsRuntime.setupWheelHandlers,
      syncHighlight: settingsRuntime.syncHighlight,
      initialize: settingsRuntime.initialize,
      fontFamily: settingsRuntime.fontFamily,
      syncExistingPopup: popupSyncRuntime.syncExistingPopup,
      render: popupBuilderRuntime.render
    });
  }

  const service = Object.freeze({ create });
  globalScope.CorePopupRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
