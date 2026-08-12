/**
 * performanceBridge.js — پل ارتباطی بین edCur و معماری Performance
 *
 * 1. SongDocument جدید از edCur
 * 2. playbackState از DAW
 * 3. Singer/Player popup با full render روی contentUpdated
 * 4. Embedded view با full render روی contentUpdated
 * 5. onPerformanceSongChanged: API مرکزی برای تعویض آهنگ
 */

let _songDocument = null;
const performanceWindowBridge = window.WindowBridge;

function isPerformancePopupOpen(popup) {
  return performanceWindowBridge?.isOpen?.(popup) ?? Boolean(popup && !popup.closed);
}

function getPerformancePopupDocument(popup) {
  return performanceWindowBridge?.getDocument?.(popup) || popup?.document || null;
}

function getRuntimeStateAdapter() {
  return window.RuntimeStateAdapter || null;
}

function getRuntimeDAW() {
  return getRuntimeStateAdapter()?.getDAW?.() || null;
}

function getRuntimePerformanceStore() {
  return getRuntimeStateAdapter()?.getPerformanceStore?.() || null;
}

function getCurrentSong() {
  return window.EdCurAdapter?.getEdCur?.() || null;
}

/* ═══════════════════════════════════════════════
   rebuildSongDocumentFromEdCur
   ═══════════════════════════════════════════════ */

function rebuildSongDocumentFromEdCur() {
  const song = getCurrentSong();
  const store = getRuntimePerformanceStore();
  if (!song) return;
  if (!window.SongDocumentModel || !window.SharedEngine) return;

  _songDocument = window.SongDocumentModel.buildSongDocumentFromEdCur(song);
  _songDocument = window.SharedEngine.processSong(_songDocument);

  if (store) {
    store.setSongDocument(_songDocument);

    // ریست هایلایت برای آهنگ جدید
    store.setHighlightState({
      activeLineId: null,
      activeTokenId: null,
      activeChordId: null,
      doneLines: new Set()
    });

    if (typeof publishPerformanceState === 'function') publishPerformanceState();
  }
}

/* ═══════════════════════════════════════════════
   onPerformanceSongChanged — API مرکزی تعویض آهنگ
   ═══════════════════════════════════════════════ */

function onPerformanceSongChanged(embeddedContainer) {
  if (typeof rebuildSongDocumentFromEdCur === 'function') {
    rebuildSongDocumentFromEdCur();
  }

  const store = getRuntimePerformanceStore();
  if (!store) return;

  const st = store.getState();
  const hl = st.highlightState || null;
  const vsEmb = (st.viewStates && st.viewStates.embeddedPerformanceView) || {};

  // Embedded full render (نه update)
  let box = embeddedContainer;
  if (!box) {
    box =
      document.getElementById('perfLyricsBox') ||
      document.querySelector('.arr-perf-lyrics-box') ||
      document.getElementById('arr-perf-lyrics-box');
  }

  if (
    box &&
    window.EmbeddedPerformanceRenderer &&
    typeof EmbeddedPerformanceRenderer.renderEmbeddedPerformanceView === 'function'
  ) {
    EmbeddedPerformanceRenderer.renderEmbeddedPerformanceView(
      st.songDocument, hl, vsEmb, box
    );
  }

  // Force full render در popupها
  if (typeof _forceRenderOpenPopupsFull === 'function') {
    _forceRenderOpenPopupsFull();
  }
}

window.onPerformanceSongChanged = onPerformanceSongChanged;

/* ═══════════════════════════════════════════════
   viewStyles sync
   ═══════════════════════════════════════════════ */

function syncViewStylesFromEdCur() {
  const song = getCurrentSong();
  const store = getRuntimePerformanceStore();
  if (!song || !store) return;
  const vs = song.viewStyles || {};
  store.setViewState('singerView', vs.singerView || {});
  store.setViewState('playerView', vs.playerView || {});
  store.setViewState('embeddedPerformanceView', vs.embeddedPerformanceView || {});
}

function syncViewStylesToEdCur() {
  const song = getCurrentSong();
  const store = getRuntimePerformanceStore();
  if (!song || !store) return;
  song.viewStyles = song.viewStyles || {};
  ['singerView', 'playerView', 'embeddedPerformanceView'].forEach(key => {
    song.viewStyles[key] = store.getViewState(key) || {};
  });
}

/* ═══════════════════════════════════════════════
   Playback sync loop
   ═══════════════════════════════════════════════ */

let _perfBridgeRafId = null;
let _lastPerfSyncTime = 0;

function startPlaybackSync() {
  if (_perfBridgeRafId) return;
  const tick = () => {
    const daw = getRuntimeDAW();
    const store = getRuntimePerformanceStore();
    if (!daw) {
      _perfBridgeRafId = requestAnimationFrame(tick);
      return;
    }
    const now = performance.now();
    if (now - _lastPerfSyncTime > 33) {
      _lastPerfSyncTime = now;
      if (store && window.SharedEngine && _songDocument) {
        store.setPlaybackState({
          time: daw.playhead || 0,
          isPlaying: !!daw.isPlaying
        });
        const hl = window.SharedEngine.computeHighlight(
          store.getState().playbackState, _songDocument
        );
        store.setHighlightState(hl);
      }
    }
    _perfBridgeRafId = requestAnimationFrame(tick);
  };
  _perfBridgeRafId = requestAnimationFrame(tick);
}

function stopPlaybackSync() {
  if (_perfBridgeRafId) {
    cancelAnimationFrame(_perfBridgeRafId);
    _perfBridgeRafId = null;
  }
}

/* ═══════════════════════════════════════════════
   BroadcastChannel: cross-window sync
   ═══════════════════════════════════════════════ */

let _performanceChannel = null;
let _lastBroadcastSnapshot = null;

function ensurePerformanceChannel() {
  if (_performanceChannel || typeof BroadcastChannel === 'undefined') return _performanceChannel;
  _performanceChannel = new BroadcastChannel('achord-performance-v2');

  _performanceChannel.addEventListener('message', (event) => {
    const data = event && event.data;
    if (!data || !data.type) return;
    if (data.type === 'performanceState') {
      const store = getRuntimePerformanceStore();
      if (!store) return;
      if (typeof store.hydrateState === 'function') {
        store.hydrateState(data.payload);
      }
    }
  });

  return _performanceChannel;
}

function publishPerformanceState() {
  const store = getRuntimePerformanceStore();
  if (typeof BroadcastChannel === 'undefined' || !store) return;
  const payload = store.getSerializableState();
  const snapshot = JSON.stringify(payload);
  if (snapshot === _lastBroadcastSnapshot) return;
  _lastBroadcastSnapshot = snapshot;
  ensurePerformanceChannel();
  if (_performanceChannel) {
    _performanceChannel.postMessage({ type: 'performanceState', payload: payload });
  }
}

function wirePerformanceBroadcasts() {
  const store = getRuntimePerformanceStore();
  if (!store) return;
  store.subscribe('contentUpdated', publishPerformanceState);
  store.subscribe('keyChanged', publishPerformanceState);
  store.subscribe('playbackStateChanged', publishPerformanceState);
  store.subscribe('highlightChanged', publishPerformanceState);
  store.subscribe('viewStateChanged', publishPerformanceState);
}

/* ═══════════════════════════════════════════════
   Singer View Popup
   ═══════════════════════════════════════════════ */

let _singerPopup = null;
let _singerUnsubs = [];
let _singerCloseTimer = null;

function _clearSingerUnsubs() {
  _singerUnsubs.forEach(function (u) {
    try { if (typeof u === 'function') u(); } catch (e) {}
  });
  _singerUnsubs = [];
}

function openSingerView() {
  const store = getRuntimePerformanceStore();
  if (!store) return;

  if (performanceWindowBridge?.isOpen?.(_singerPopup)) {
    performanceWindowBridge.focus(_singerPopup);
    // Full render با سند فعلی
    try {
      const root = getPerformancePopupDocument(_singerPopup)?.getElementById('singer-root');
      if (root && window.SingerViewRenderer) {
        const st = store.getState();
        SingerViewRenderer.renderSingerView(
          st.songDocument, st.highlightState, st.viewStates.singerView, root
        );
      }
    } catch (e) {}
    return;
  }

  _clearSingerUnsubs();

  _singerPopup = performanceWindowBridge?.open?.({
    windowRef: window,
    url: '',
    name: 'achord_singer_v2',
    features: 'width=700,height=600,menubar=no,toolbar=no,location=no,status=no'
  }) || window.open(
    '', 'achord_singer_v2',
    'width=700,height=600,menubar=no,toolbar=no,location=no,status=no'
  );
  if (!_singerPopup) { if (typeof toast === 'function') toast('پنجره بلاک شده'); return; }

  const doc = getPerformancePopupDocument(_singerPopup);
  if (!doc) return;
  doc.title = 'Singer View — Achord';
  doc.documentElement.dir = 'rtl';
  doc.documentElement.lang = 'fa';
  doc.body.style.margin = '0';
  doc.body.style.height = '100%';
  doc.body.style.background = '#0b0f14';
  doc.body.innerHTML =
    '<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;700;900&display=swap" rel="stylesheet">' +
    '<style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#0F131E;color:#E2E8F0;font-family:"Vazirmatn",sans-serif;overflow:hidden;height:100vh;}#singer-root{width:100%;height:100vh;overflow-y:auto;padding:20px;}</style>' +
    '<div id="singer-root"></div>';

  const root = doc.getElementById('singer-root');

  function renderSingerFull() {
    if (!isPerformancePopupOpen(_singerPopup) || !root) return;
    if (!window.SingerViewRenderer) return;
    const st = store.getState();
    SingerViewRenderer.renderSingerView(
      st.songDocument, st.highlightState, st.viewStates.singerView, root
    );
  }

  function renderSingerHighlight() {
    if (!isPerformancePopupOpen(_singerPopup) || !root) return;
    if (!window.SingerViewRenderer) return;
    const st = store.getState();
    SingerViewRenderer.updateSingerHighlight(
      st.highlightState, st.viewStates.singerView, root
    );
  }

  renderSingerFull();
  if (typeof publishPerformanceState === 'function') publishPerformanceState();

  // contentUpdated = full render (تعویض آهنگ)
  _singerUnsubs.push(store.subscribe('contentUpdated', renderSingerFull));
  _singerUnsubs.push(store.subscribe('keyChanged', renderSingerFull));
  _singerUnsubs.push(store.subscribe('viewStateChanged', renderSingerFull));
  // highlight/playback = فقط update
  _singerUnsubs.push(store.subscribe('highlightChanged', renderSingerHighlight));
  _singerUnsubs.push(store.subscribe('playbackStateChanged', renderSingerHighlight));

  startPlaybackSync();

  if (_singerCloseTimer) clearInterval(_singerCloseTimer);
  _singerCloseTimer = setInterval(function () {
    if (!isPerformancePopupOpen(_singerPopup)) {
      clearInterval(_singerCloseTimer);
      _singerCloseTimer = null;
      _clearSingerUnsubs();
      _singerPopup = null;
    }
  }, 800);
}

/* ═══════════════════════════════════════════════
   Player View Popup
   ═══════════════════════════════════════════════ */

let _playerPopup = null;
let _playerUnsubs = [];

function _clearPlayerUnsubs() {
  _playerUnsubs.forEach(function (u) {
    try { if (typeof u === 'function') u(); } catch (e) {}
  });
  _playerUnsubs = [];
}

function openPlayerView() {
  // از popup قدیمی استفاده کن
  if (typeof openLyricPopup === 'function') { openLyricPopup(); return; }
  toast('Player View در دسترس نیست');
}

/* ═══════════════════════════════════════════════
   Embedded Performance View
   ═══════════════════════════════════════════════ */

let _embeddedContainer = null;
let _embeddedUnsubs = [];

function attachEmbeddedView(containerEl) {
  _embeddedContainer = containerEl;
  const store = getRuntimePerformanceStore();
  if (!store) return;

  function renderEmbeddedFull() {
    if (!_embeddedContainer) return;
    const st = store.getState();
    EmbeddedPerformanceRenderer.renderEmbeddedPerformanceView(
      st.songDocument, st.highlightState,
      st.viewStates.embeddedPerformanceView, _embeddedContainer
    );
  }

  function renderEmbeddedHighlight() {
    if (!_embeddedContainer) return;
    const st = store.getState();
    EmbeddedPerformanceRenderer.updateEmbeddedHighlight(
      st.highlightState,
      st.viewStates.embeddedPerformanceView, _embeddedContainer
    );
  }

  renderEmbeddedFull();
  _embeddedUnsubs.push(
    store.subscribe('contentUpdated', renderEmbeddedFull),
    store.subscribe('keyChanged', renderEmbeddedFull),
    store.subscribe('highlightChanged', renderEmbeddedHighlight),
    store.subscribe('viewStateChanged', (ev) => {
      if (ev.viewId === 'embeddedPerformanceView') renderEmbeddedFull();
    })
  );

  _forceRenderEmbedded = renderEmbeddedFull;
  startPlaybackSync();
}

let _forceRenderEmbedded = null;

function forceRenderEmbeddedView() {
  if (_forceRenderEmbedded) _forceRenderEmbedded();
  else if (typeof rebuildSongDocumentFromEdCur === 'function') {
    rebuildSongDocumentFromEdCur();
  }
}

function detachEmbeddedView() {
  _embeddedUnsubs.forEach(fn => fn());
  _embeddedUnsubs = [];
  _embeddedContainer = null;
  _forceRenderEmbedded = null;
}

/* ═══════════════════════════════════════════════
   Force render all open popups
   ═══════════════════════════════════════════════ */

function _forceRenderOpenPopupsFull() {
  const store = getRuntimePerformanceStore();
  if (!store) return;

  // Singer
  try {
    if (isPerformancePopupOpen(_singerPopup)) {
      const root = getPerformancePopupDocument(_singerPopup)?.getElementById('singer-root');
      if (root && window.SingerViewRenderer) {
        const st = store.getState();
        SingerViewRenderer.renderSingerView(
          st.songDocument, st.highlightState, st.viewStates.singerView, root
        );
      }
    }
  } catch (e) {}
  // Player
  try {
    if (isPerformancePopupOpen(_playerPopup)) {
      const root = getPerformancePopupDocument(_playerPopup)?.getElementById('player-root');
      if (root && window.PlayerViewRenderer) {
        const st = store.getState();
        PlayerViewRenderer.renderPlayerView(
          st.songDocument, st.highlightState, st.viewStates.playerView, root
        );
      }
    }
  } catch (e) {}
}

/* ═══════════════════════════════════════════════
   Cleanup
   ═══════════════════════════════════════════════ */

function destroyPerformanceBridge() {
  stopPlaybackSync();
  if (_singerCloseTimer) {
    clearInterval(_singerCloseTimer);
    _singerCloseTimer = null;
  }
  if (performanceWindowBridge?.isOpen?.(_singerPopup)) {
    performanceWindowBridge.close(_singerPopup);
  }
  if (performanceWindowBridge?.isOpen?.(_playerPopup)) {
    performanceWindowBridge.close(_playerPopup);
  }
  if (_performanceChannel && typeof _performanceChannel.close === 'function') {
    _performanceChannel.close();
    _performanceChannel = null;
  }
  _clearSingerUnsubs();
  _clearPlayerUnsubs();
  _singerPopup = null;
  _playerPopup = null;
  detachEmbeddedView();
}

/* ═══════════════════════════════════════════════
   Auto-init
   ═══════════════════════════════════════════════ */

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    ensurePerformanceChannel();
    wirePerformanceBroadcasts();
  });
}
