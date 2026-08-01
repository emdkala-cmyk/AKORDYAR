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

/* ═══════════════════════════════════════════════
   rebuildSongDocumentFromEdCur
   ═══════════════════════════════════════════════ */

function rebuildSongDocumentFromEdCur() {
  if (typeof edCur === 'undefined' || !edCur) return;
  if (!window.SongDocumentModel || !window.SharedEngine) return;

  _songDocument = SongDocumentModel.buildSongDocumentFromEdCur(edCur);
  _songDocument = SharedEngine.processSong(_songDocument);

  if (window.PerformanceStore) {
    PerformanceStore.setSongDocument(_songDocument);

    // ریست هایلایت برای آهنگ جدید
    PerformanceStore.setHighlightState({
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

  if (!window.PerformanceStore) return;

  const st = PerformanceStore.getState();
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
  if (typeof edCur === 'undefined' || !edCur) return;
  if (!window.PerformanceStore) return;
  const vs = edCur.viewStyles || {};
  PerformanceStore.setViewState('singerView', vs.singerView || {});
  PerformanceStore.setViewState('playerView', vs.playerView || {});
  PerformanceStore.setViewState('embeddedPerformanceView', vs.embeddedPerformanceView || {});
}

function syncViewStylesToEdCur() {
  if (typeof edCur === 'undefined' || !edCur) return;
  if (!window.PerformanceStore) return;
  edCur.viewStyles = edCur.viewStyles || {};
  ['singerView', 'playerView', 'embeddedPerformanceView'].forEach(key => {
    edCur.viewStyles[key] = PerformanceStore.getViewState(key) || {};
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
    if (typeof DAW === 'undefined') {
      _perfBridgeRafId = requestAnimationFrame(tick);
      return;
    }
    const now = performance.now();
    if (now - _lastPerfSyncTime > 33) {
      _lastPerfSyncTime = now;
      if (window.PerformanceStore && window.SharedEngine && _songDocument) {
        PerformanceStore.setPlaybackState({
          time: DAW.playhead || 0,
          isPlaying: !!DAW.isPlaying
        });
        const hl = SharedEngine.computeHighlight(
          PerformanceStore.getState().playbackState, _songDocument
        );
        PerformanceStore.setHighlightState(hl);
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
      if (!window.PerformanceStore) return;
      if (typeof PerformanceStore.hydrateState === 'function') {
        PerformanceStore.hydrateState(data.payload);
      }
    }
  });

  return _performanceChannel;
}

function publishPerformanceState() {
  if (typeof BroadcastChannel === 'undefined' || !window.PerformanceStore) return;
  const payload = PerformanceStore.getSerializableState();
  const snapshot = JSON.stringify(payload);
  if (snapshot === _lastBroadcastSnapshot) return;
  _lastBroadcastSnapshot = snapshot;
  ensurePerformanceChannel();
  if (_performanceChannel) {
    _performanceChannel.postMessage({ type: 'performanceState', payload: payload });
  }
}

function wirePerformanceBroadcasts() {
  if (!window.PerformanceStore) return;
  PerformanceStore.subscribe('contentUpdated', publishPerformanceState);
  PerformanceStore.subscribe('keyChanged', publishPerformanceState);
  PerformanceStore.subscribe('playbackStateChanged', publishPerformanceState);
  PerformanceStore.subscribe('highlightChanged', publishPerformanceState);
  PerformanceStore.subscribe('viewStateChanged', publishPerformanceState);
}

/* ═══════════════════════════════════════════════
   Singer View Popup
   ═══════════════════════════════════════════════ */

let _singerPopup = null;
let _singerUnsubs = [];

function _clearSingerUnsubs() {
  _singerUnsubs.forEach(function (u) {
    try { if (typeof u === 'function') u(); } catch (e) {}
  });
  _singerUnsubs = [];
}

function openSingerView() {
  if (_singerPopup && !_singerPopup.closed) {
    _singerPopup.focus();
    // Full render با سند فعلی
    try {
      const root = _singerPopup.document.getElementById('singer-root');
      if (root && window.PerformanceStore && window.SingerViewRenderer) {
        const st = PerformanceStore.getState();
        SingerViewRenderer.renderSingerView(
          st.songDocument, st.highlightState, st.viewStates.singerView, root
        );
      }
    } catch (e) {}
    return;
  }

  _clearSingerUnsubs();

  _singerPopup = window.open(
    '', 'achord_singer_v2',
    'width=700,height=600,menubar=no,toolbar=no,location=no,status=no'
  );
  if (!_singerPopup) { if (typeof toast === 'function') toast('پنجره بلاک شده'); return; }

  const doc = _singerPopup.document;
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
    if (!_singerPopup || _singerPopup.closed || !root) return;
    if (!window.PerformanceStore || !window.SingerViewRenderer) return;
    const st = PerformanceStore.getState();
    SingerViewRenderer.renderSingerView(
      st.songDocument, st.highlightState, st.viewStates.singerView, root
    );
  }

  function renderSingerHighlight() {
    if (!_singerPopup || _singerPopup.closed || !root) return;
    if (!window.PerformanceStore || !window.SingerViewRenderer) return;
    const st = PerformanceStore.getState();
    SingerViewRenderer.updateSingerHighlight(
      st.highlightState, st.viewStates.singerView, root
    );
  }

  renderSingerFull();
  if (typeof publishPerformanceState === 'function') publishPerformanceState();

  // contentUpdated = full render (تعویض آهنگ)
  _singerUnsubs.push(PerformanceStore.subscribe('contentUpdated', renderSingerFull));
  _singerUnsubs.push(PerformanceStore.subscribe('keyChanged', renderSingerFull));
  _singerUnsubs.push(PerformanceStore.subscribe('viewStateChanged', renderSingerFull));
  // highlight/playback = فقط update
  _singerUnsubs.push(PerformanceStore.subscribe('highlightChanged', renderSingerHighlight));
  _singerUnsubs.push(PerformanceStore.subscribe('playbackStateChanged', renderSingerHighlight));

  startPlaybackSync();

  const closeTimer = setInterval(function () {
    if (!_singerPopup || _singerPopup.closed) {
      clearInterval(closeTimer);
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

  function renderEmbeddedFull() {
    if (!_embeddedContainer) return;
    const st = PerformanceStore.getState();
    EmbeddedPerformanceRenderer.renderEmbeddedPerformanceView(
      st.songDocument, st.highlightState,
      st.viewStates.embeddedPerformanceView, _embeddedContainer
    );
  }

  function renderEmbeddedHighlight() {
    if (!_embeddedContainer) return;
    const st = PerformanceStore.getState();
    EmbeddedPerformanceRenderer.updateEmbeddedHighlight(
      st.highlightState,
      st.viewStates.embeddedPerformanceView, _embeddedContainer
    );
  }

  renderEmbeddedFull();
  _embeddedUnsubs.push(
    PerformanceStore.subscribe('contentUpdated', renderEmbeddedFull),
    PerformanceStore.subscribe('keyChanged', renderEmbeddedFull),
    PerformanceStore.subscribe('highlightChanged', renderEmbeddedHighlight),
    PerformanceStore.subscribe('viewStateChanged', (ev) => {
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
}

/* ═══════════════════════════════════════════════
   Force render all open popups
   ═══════════════════════════════════════════════ */

function _forceRenderOpenPopupsFull() {
  // Singer
  try {
    if (_singerPopup && !_singerPopup.closed) {
      const root = _singerPopup.document.getElementById('singer-root');
      if (root && window.PerformanceStore && window.SingerViewRenderer) {
        const st = PerformanceStore.getState();
        SingerViewRenderer.renderSingerView(
          st.songDocument, st.highlightState, st.viewStates.singerView, root
        );
      }
    }
  } catch (e) {}
  // Player
  try {
    if (_playerPopup && !_playerPopup.closed) {
      const root = _playerPopup.document.getElementById('player-root');
      if (root && window.PerformanceStore && window.PlayerViewRenderer) {
        const st = PerformanceStore.getState();
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
  if (_singerPopup && !_singerPopup.closed) _singerPopup.close();
  if (_playerPopup && !_playerPopup.closed) _playerPopup.close();
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
