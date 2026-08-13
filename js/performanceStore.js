/**
 * performanceStore.js — استور مرکزی: state مشترک + event bus + per-view settings
 *
 * یک منبع واحد برای همه Viewها.
 * Viewها فقط subscribe می‌کنند، هیچ state مستقلی نگه نمی‌دارند.
 */

const PerformanceStore = (() => {

  /* ═══════════════════════════════════════════════
     Event Bus
     ═══════════════════════════════════════════════ */

  const subscribers = {
    contentUpdated:        [],
    keyChanged:            [],
    playbackStateChanged:  [],
    highlightChanged:      [],
    viewStateChanged:      []
  };

  function emit(eventName, payload) {
    const arr = subscribers[eventName];
    if (!arr) return;
    arr.slice().forEach(fn => {
      try { fn(payload); } catch (e) { console.error('[PerformanceStore]', eventName, e); }
    });
  }

  function subscribe(eventName, fn) {
    if (!subscribers[eventName]) subscribers[eventName] = [];
    subscribers[eventName].push(fn);
    return () => unsubscribe(eventName, fn);
  }

  function unsubscribe(eventName, fn) {
    const arr = subscribers[eventName];
    if (!arr) return;
    const idx = arr.indexOf(fn);
    if (idx >= 0) arr.splice(idx, 1);
  }

  /* ═══════════════════════════════════════════════
     State
     ═══════════════════════════════════════════════ */

  const state = {
    songDocument: null,

    keyState: {
      originalKey: 'C',
      currentKey:  'C',
      transpose:   0,
      mode:        'major'
    },

    playbackState: {
      time:      0,
      isPlaying: false,
      duration: 0
    },

    highlightState: {
      activeLineId:  null,
      activeTokenId: null,
      activeChordId: null,
      doneLines:     new Set()
    },

    viewStates: {}
  };

  /* ═══════════════════════════════════════════════
     Per-View Settings (localStorage fallback)
     ═══════════════════════════════════════════════ */

  const STORAGE_KEY = 'achord_view_settings_v1';

  const defaultViewStates = {
    singerView: {
      fontFamily:     'Vazirmatn',
      fontSize:       32,
      lineHeight:     2.2,
      scale:          1,
      textColor:      '#E2E8F0',
      highlightColor: '#FF2E93',
      backgroundColor:'#0F131E',
      showChords:     false
    },
    playerView: {
      fontFamily:     'Vazirmatn',
      fontSize:       24,
      lineHeight:     2.0,
      scale:          1,
      textColor:      '#E2E8F0',
      chordColor:     '#00F2FE',
      highlightColor: '#FF2E93',
      backgroundColor:'#0F131E',
      showChords:     true
    },
    embeddedPerformanceView: {
      fontFamily:     'Vazirmatn',
      fontSize:       36,
      lineHeight:     2.2,
      scale:          1,
      textColor:      '#E2E8F0',
      chordColor:     '#e6aa28',
      highlightColor: '#FF2E93',
      backgroundColor:'rgba(0,0,0,0.3)',
      theme:          'glass',
      showChords:     true
    }
  };

  function loadViewSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      Object.keys(defaultViewStates).forEach(key => {
        state.viewStates[key] = Object.assign({}, defaultViewStates[key], saved[key] || {});
      });
    } catch (e) {
      Object.keys(defaultViewStates).forEach(key => {
        state.viewStates[key] = Object.assign({}, defaultViewStates[key]);
      });
    }
  }

  function saveViewSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.viewStates));
    } catch (e) { /* ignore */ }
  }

  loadViewSettings();

  /* ═══════════════════════════════════════════════
     Public API
     ═══════════════════════════════════════════════ */

  function getState() {
    return state;
  }

  function setSongDocument(doc) {
    state.songDocument = doc;
    if (doc) {
      state.keyState.originalKey = doc.originalKey || 'C';
      state.keyState.currentKey  = doc.currentKey || 'C';
      state.keyState.transpose   = doc.transpose || 0;
      state.keyState.mode        = doc.mode || 'major';
    }
    emit('contentUpdated', doc);
  }

  function updateSongContent(patchFn) {
    if (typeof patchFn === 'function' && state.songDocument) {
      patchFn(state.songDocument);
      emit('contentUpdated', state.songDocument);
    }
  }

  function setKeyState(keyState) {
    Object.assign(state.keyState, keyState);
    emit('keyChanged', state.keyState);
  }

  function setPlaybackState(playbackState) {
    Object.assign(state.playbackState, playbackState);
    emit('playbackStateChanged', state.playbackState);
  }

  function sameSet(a, b) {
    if (a === b) return true;
    if (!(a instanceof Set) || !(b instanceof Set)) return false;
    if (a.size !== b.size) return false;
    for (const v of a) { if (!b.has(v)) return false; }
    return true;
  }

  function setHighlightState(highlightState) {
    const nextDoneLines =
      highlightState.doneLines instanceof Set
        ? highlightState.doneLines
        : Array.isArray(highlightState.doneLines)
          ? new Set(highlightState.doneLines)
          : new Set();

    // جلوگیری از emit بی‌مورد
    if (
      state.highlightState.activeLineId  === highlightState.activeLineId &&
      state.highlightState.activeTokenId === highlightState.activeTokenId &&
      state.highlightState.activeChordId === highlightState.activeChordId &&
      sameSet(state.highlightState.doneLines, nextDoneLines)
    ) return;

    state.highlightState.activeLineId  = highlightState.activeLineId;
    state.highlightState.activeTokenId = highlightState.activeTokenId;
    state.highlightState.activeChordId = highlightState.activeChordId;
    state.highlightState.doneLines     = nextDoneLines;

    emit('highlightChanged', state.highlightState);
  }

  function setViewState(viewId, partialState) {
    if (!state.viewStates[viewId]) {
      state.viewStates[viewId] = Object.assign({}, defaultViewStates[viewId] || {});
    }
    Object.assign(state.viewStates[viewId], partialState);
    saveViewSettings();
    emit('viewStateChanged', { viewId: viewId, viewState: state.viewStates[viewId] });
  }

  function getViewState(viewId) {
    return state.viewStates[viewId] || null;
  }

  /**
   * خروجی serialize‌شده از state برای انتقال بین windowها
   */
  function getSerializableState() {
    const st = getState();
    return {
      songDocument:    st.songDocument,
      keyState:        Object.assign({}, st.keyState),
      playbackState:   Object.assign({}, st.playbackState),
      highlightState: {
        activeLineId:  st.highlightState.activeLineId,
        activeTokenId: st.highlightState.activeTokenId,
        activeChordId: st.highlightState.activeChordId,
        doneLines:     Array.from(st.highlightState.doneLines || [])
      },
      viewStates: JSON.parse(JSON.stringify(st.viewStates || {}))
    };
  }

  /**
   * بازیابی state از payload serialize‌شده (برای cross-window sync)
   */
  function hydrateState(payload) {
    if (!payload) return;

    let contentChanged = false;

    if (payload.songDocument !== undefined) {
      state.songDocument = payload.songDocument;
      contentChanged = true;
    }
    if (payload.keyState) {
      Object.assign(state.keyState, payload.keyState);
    }
    if (payload.playbackState) {
      Object.assign(state.playbackState, payload.playbackState);
    }
    if (payload.highlightState) {
      const hs = payload.highlightState;
      const hlChanged = state.highlightState.activeLineId !== hs.activeLineId;
      state.highlightState.activeLineId  = hs.activeLineId  || null;
      state.highlightState.activeTokenId = hs.activeTokenId || null;
      state.highlightState.activeChordId = hs.activeChordId || null;
      state.highlightState.doneLines     = new Set(hs.doneLines || []);
      if (hlChanged) emit('highlightChanged', state.highlightState);
    }
    if (payload.viewStates) {
      Object.assign(state.viewStates, payload.viewStates);
    }

    // emit events so subscribers (popup/embedded) re-render
    if (contentChanged) emit('contentUpdated', state.songDocument);
    emit('playbackStateChanged', state.playbackState);
  }

  /**
   * ریست کامل store به حالت اولیه (برای load پروژه جدید)
   */
  function resetStore() {
    state.songDocument = null;
    Object.assign(state.keyState, { originalKey: 'C', currentKey: 'C', transpose: 0, mode: 'major' });
    Object.assign(state.playbackState, { time: 0, isPlaying: false, duration: 0 });
    Object.assign(state.highlightState, { activeLineId: null, activeTokenId: null, activeChordId: null, doneLines: new Set() });
  }

  return {
    getState,
    getSerializableState,
    hydrateState,
    subscribe,
    unsubscribe,
    setSongDocument,
    updateSongContent,
    resetStore,
    setKeyState,
    setPlaybackState,
    setHighlightState,
    setViewState,
    getViewState,
    defaultViewStates
  };

})();

if (typeof window !== 'undefined') {
  window.PerformanceStore = PerformanceStore;
}
