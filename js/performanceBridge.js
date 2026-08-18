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

function installPerformancePopupHighlightLoop(popup, doc) {
  if (!popup || !doc?.body) return;
  const script = doc.createElement('script');
  script.textContent = `
    (function () {
      if (window.__akordPerformanceHighlightLoopStarted) return;
      window.__akordPerformanceHighlightLoopStarted = true;
      function frame() {
        try {
          if (typeof window._syncHighlight === 'function') {
            window._syncHighlight();
          }
        } catch (_) {}
        if (!window.closed) window.requestAnimationFrame(frame);
      }
      frame();
    })();
  `;
  doc.body.appendChild(script);
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

function getRuntimePlaybackDuration(daw) {
  if (!daw) return 0;
  let end = Number(daw.timelineDuration) || 0;
  for (const clip of daw.clips || []) {
    const start = Number(clip?.start) || 0;
    const duration = Number(clip?.duration) || 0;
    end = Math.max(end, start + duration);
  }
  for (const section of daw.sections || []) {
    const start = Number(section?.start) || 0;
    const duration = Number(section?.duration) || 0;
    end = Math.max(end, start + duration);
  }
  return Math.max(0, end);
}

/**
 * Read the authoritative transport position without depending on the
 * editor window's RAF loop.  The propagation loop below is only a state
 * publisher; AudioContext remains the playback clock.
 */
function getRuntimePlaybackTime(daw) {
  if (!daw) return 0;
  const audioNow = daw.audioCtx?.currentTime;
  if (
    daw.isPlaying &&
    Number.isFinite(daw.playOriginAudio) &&
    Number.isFinite(daw.playOriginTime) &&
    Number.isFinite(audioNow)
  ) {
    return Math.max(
      0,
      daw.playOriginTime + Math.max(0, audioNow - daw.playOriginAudio)
    );
  }
  return Number.isFinite(Number(daw.playhead))
    ? Math.max(0, Number(daw.playhead))
    : 0;
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

let _perfBridgeTimerId = null;
let _perfBridgeRunning = false;
let _lastPerfSyncTime = 0;

function publishPlaybackSync() {
  const daw = getRuntimeDAW();
  const store = getRuntimePerformanceStore();
  if (!daw || !store || !window.SharedEngine || !_songDocument) return;

  const now = performance.now();
  if (now - _lastPerfSyncTime < 24) return;
  _lastPerfSyncTime = now;

  const playbackState = {
    time: getRuntimePlaybackTime(daw),
    isPlaying: !!daw.isPlaying,
    duration: getRuntimePlaybackDuration(daw)
  };
  store.setPlaybackState(playbackState);
  store.setHighlightState(
    window.SharedEngine.computeHighlight(playbackState, _songDocument)
  );
}

function schedulePlaybackSync() {
  if (!_perfBridgeRunning || _perfBridgeTimerId) return;
  _perfBridgeTimerId = setTimeout(() => {
    _perfBridgeTimerId = null;
    publishPlaybackSync();
    schedulePlaybackSync();
  }, 33);
}

function startPlaybackSync() {
  if (_perfBridgeRunning) return;
  _perfBridgeRunning = true;
  publishPlaybackSync();
  schedulePlaybackSync();
}

function stopPlaybackSync() {
  _perfBridgeRunning = false;
  if (_perfBridgeTimerId) clearTimeout(_perfBridgeTimerId);
  _perfBridgeTimerId = null;
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
  store.subscribe('midiScoreChanged', publishPerformanceState);
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
let _singerClockHighlightKey = '';

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

  function renderSingerHighlightFromClock() {
    if (!isPerformancePopupOpen(_singerPopup) || !root) return;
    if (!window.SingerViewRenderer) return;

    const daw = getRuntimeDAW();
    const st = store.getState();
    const playbackState = {
      time: getRuntimePlaybackTime(daw),
      isPlaying: !!daw?.isPlaying,
      duration: getRuntimePlaybackDuration(daw)
    };
    const nextHighlight =
      window.SharedEngine && _songDocument
        ? window.SharedEngine.computeHighlight(playbackState, _songDocument)
        : st.highlightState;
    const key = JSON.stringify([
      nextHighlight?.activeLineId || null,
      nextHighlight?.activeTokenId || null,
      nextHighlight?.activeChordId || null,
      Array.from(nextHighlight?.doneLines || [])
    ]);
    if (key === _singerClockHighlightKey) return;
    _singerClockHighlightKey = key;
    SingerViewRenderer.updateSingerHighlight(
      nextHighlight, st.viewStates.singerView, root
    );
  }

  renderSingerFull();
  _singerClockHighlightKey = '';
  if (typeof publishPerformanceState === 'function') publishPerformanceState();

  // contentUpdated = full render (تعویض آهنگ)
  _singerUnsubs.push(store.subscribe('contentUpdated', renderSingerFull));
  _singerUnsubs.push(store.subscribe('keyChanged', renderSingerFull));
  _singerUnsubs.push(store.subscribe('viewStateChanged', renderSingerFull));
  // highlight/playback = فقط update
  _singerUnsubs.push(store.subscribe('highlightChanged', renderSingerHighlight));
  _singerUnsubs.push(store.subscribe('playbackStateChanged', renderSingerHighlight));

  performanceWindowBridge?.set?.(
    _singerPopup,
    '_syncHighlight',
    renderSingerHighlightFromClock
  );
  installPerformancePopupHighlightLoop(_singerPopup, doc);
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
    // Keep the shared playback state alive even when no performance popup is
    // open.  The published position is derived from AudioContext, not from
    // this timer's cadence.
    startPlaybackSync();
  });
}
