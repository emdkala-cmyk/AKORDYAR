/**
 * sync/mobileClient.js — کلاینت گوشی (Slave) که روی مرورگر موبایل اجرا می‌شود
 *
 * این فایل روی صفحه sync-client.html لود می‌شود. کارها:
 *  1. به SyncHub وصل می‌شود و نقش Slave را اعلام می‌کند.
 *  2. پیام‌های DOC / VIEW / SNAPSHOT / PLAYHEAD / HIGHLIGHT را دریافت میکند.
 *  3. با همان PlayerViewRenderer برنامه (پنل F9 دسکتاپ) رندر میکند —
 *     یعنی دقیقاً همان نمای نوازنده روی گوشی تکرار می‌شود.
 *  4. اسلیو فقط تنظیمات محلی دارد: فونت، رنگ، زوم — که روی دستگاه خودش اعمال
 *     می‌شود و به مستر یا بقیه ارسال نمیشود (طبق درخواست: کنترل فقط از لپ‌تاپ).
 *
 * طراحی آینده‌نگر: این همان قراردادی است که اپلیکیشن نیتیو موبایل آینده پیاده
 * می‌کند؛ فقط لایه رندر (RendererBase / PlayerViewRenderer) با نسخه نیتیو جایگزین
 * می‌شود.
 */

(function attachMobileClient(globalScope) {
  'use strict';

  const Protocol = globalScope.AkordSyncProtocol;

  const MobileClient = (() => {
    const MOBILE_VIEW_STORAGE_KEY = 'akord_mobile_view_v3';
    const DEFAULT_MOBILE_VIEW = {
      fontSize: 20,
      showQuantizeGrid: false,
      mobileLayout: true,
      textColor: '#0fa966',
      chordColor: '#e6aa28'
    };
    let ws = null;
    let connected = false;
    let container = null;
    let currentDoc = null;
    let currentKey = null;
    let timeline = null;
    let playback = { time: 0, isPlaying: false, duration: 0 };
    let playbackAnchor = {
      time: 0,
      receivedAt: performance.now(),
      isPlaying: false,
      duration: 0
    };
    let playbackRafId = null;
    let remoteView = null;          // viewState که از مستر آمده (پیش‌فرض)
    let highlight = {
      activeLineId: null, activeTokenId: null, activeChordId: null, doneLines: new Set()
    };
    let lastRenderedHighlightKey = '';
    let localOverride = Object.assign({}, DEFAULT_MOBILE_VIEW); // تنظیمات محلی گوشی

    function url() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      return `${proto}://${location.host}/sync`;
    }

    function mergedView() {
      // ترکیب view مستر + تنظیمات محلی گوشی (محلی اولویت دارد)
      return Object.assign(
        {},
        remoteView || {},
        localOverride || {},
        // Match the default desktop Player View palette on the phone.
        {
          backgroundColor: '#0F131E',
          textColor: '#0fa966',
          chordColor: '#e6aa28',
          highlightColor: '#FF2E93',
          showQuantizeGrid: false,
          mobileLayout: true
        }
      );
    }

    function getRenderedPlayback(now = performance.now()) {
      const base = Object.assign({}, playback);
      if (!base.isPlaying) return base;

      const elapsed = Math.max(0, now - playbackAnchor.receivedAt) / 1000;
      const duration = Number(base.duration) || 0;
      const time = Math.max(0, playbackAnchor.time + elapsed);
      return Object.assign(base, {
        time: duration > 0 ? Math.min(duration, time) : time
      });
    }

    function setPlaybackState(next) {
      const now = performance.now();
      const incoming = Object.assign({}, playback, next || {});
      const incomingTime = Math.max(0, Number(incoming.time) || 0);
      const previous = getRenderedPlayback(now);
      const discontinuity =
        !playback.isPlaying ||
        !incoming.isPlaying ||
        Math.abs(incomingTime - (Number(playback.time) || 0)) > 0.75;

      // WebSocket packets carry the authoritative position, but they arrive
      // after network latency.  Keep a continuous local anchor between
      // packets and never move backwards because a newer packet describes an
      // earlier instant than our already-rendered prediction.
      const anchorTime = discontinuity
        ? incomingTime
        : Math.max(incomingTime, Number(previous.time) || 0);

      playback = incoming;
      playbackAnchor = {
        time: anchorTime,
        receivedAt: now,
        isPlaying: !!incoming.isPlaying,
        duration: Number(incoming.duration) || 0
      };
    }

    function highlightKey(value) {
      return JSON.stringify([
        value?.activeLineId || null,
        value?.activeTokenId || null,
        value?.activeChordId || null,
        Array.from(value?.doneLines || [])
      ]);
    }

    function getRenderedHighlight() {
      if (
        currentDoc &&
        globalScope.SharedEngine &&
        typeof globalScope.SharedEngine.computeHighlight === 'function'
      ) {
        return globalScope.SharedEngine.computeHighlight(
          getRenderedPlayback(),
          currentDoc
        );
      }
      return highlight;
    }

    function renderFull() {
      if (!container || !currentDoc) { if (typeof dbg === 'function') dbg('renderFull skip: container=' + !!container + ' doc=' + !!currentDoc); return; }
      if (globalScope.PlayerViewRenderer) {
        try {
          globalScope.PlayerViewRenderer.renderPlayerView(
            currentDoc, highlight, mergedView(), container
          );
          if (typeof dbg === 'function') dbg('renderFull OK lines=' + (currentDoc.lines || []).length);
        } catch (e) {
          if (typeof dbg === 'function') dbg('renderFull ERROR: ' + e.message);
          console.error('[MobileClient] renderFull', e);
        }
      } else {
        if (typeof dbg === 'function') dbg('PlayerViewRenderer undefined!');
      }
      lastRenderedHighlightKey = '';
      renderHighlight(true);
    }

    function renderHighlight(force = false) {
      if (!container) return;
      const nextHighlight = getRenderedHighlight();
      const key = highlightKey(nextHighlight);
      if (!force && key === lastRenderedHighlightKey) return;
      lastRenderedHighlightKey = key;
      if (globalScope.PlayerViewRenderer) {
        globalScope.PlayerViewRenderer.updatePlayerHighlight(
          nextHighlight, mergedView(), container
        );
      }
    }

    function renderTimeline(nextPlayback = getRenderedPlayback()) {
      if (typeof updateMobileTimeline === 'function') {
        updateMobileTimeline(timeline, nextPlayback);
      }
      globalScope.updatePlaybackUI?.(nextPlayback);
    }

    function renderPlaybackFrame() {
      const nextPlayback = getRenderedPlayback();
      renderTimeline(nextPlayback);
      renderHighlight();
      playbackRafId = requestAnimationFrame(renderPlaybackFrame);
    }

    function startPlaybackRenderLoop() {
      if (playbackRafId) return;
      playbackRafId = requestAnimationFrame(renderPlaybackFrame);
    }

    function send(type, payload) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(Protocol.pack(type, payload)));
    }

    function connect() {
      if (typeof WebSocket === 'undefined' || !Protocol) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

      try { ws = new WebSocket(url()); }
      catch (e) { console.error('[MobileClient]', e); return; }

      ws.onopen = () => {
        connected = true;
        send(Protocol.MSG.HELLO, { role: Protocol.ROLE.SLAVE, name: 'Phone', clientVersion: Protocol.PROTOCOL_VERSION });
        if (typeof updateStatus === 'function') updateStatus(true);
      };

      ws.onmessage = (ev) => {
        try {
          const dm = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
          if (typeof dbg === 'function') dbg('RX ' + dm.t);
        } catch (e) {}
        const res = Protocol.unpack(ev.data);
        if (!res.ok) return;
        const msg = res.message;
        const p = msg.p || {};
        switch (msg.t) {
          case Protocol.MSG.PING:
            send(Protocol.MSG.PONG, {});
            break;
          case Protocol.MSG.SNAPSHOT:
            currentDoc = p.doc || null;
            currentKey = p.keyState || null;
            remoteView = p.view || null;
            playback = { time: 0, isPlaying: false, duration: 0 };
            setPlaybackState(p.playback || {});
            timeline = p.timeline || timeline;
            if (p.highlight) applyHighlight(p.highlight);
            renderFull();
            renderTimeline();
            break;
          case Protocol.MSG.DOC:
            currentDoc = p.doc || null;
            currentKey = p.keyState || null;
            if (p.timeline) timeline = p.timeline;
            renderFull();
            renderTimeline();
            break;
          case Protocol.MSG.VIEW:
            remoteView = p.view || null;
            renderFull();
            break;
          case Protocol.MSG.HIGHLIGHT:
            applyHighlight(p);
            renderHighlight(true);
            break;
          case Protocol.MSG.PLAYHEAD:
            setPlaybackState(p);
            renderTimeline();
            break;
          case Protocol.MSG.TIMELINE:
            timeline = p;
            renderTimeline();
            break;
          case Protocol.MSG.PEER_LEAVE:
            break;
          default:
            break;
        }
      };

      ws.onclose = () => {
        connected = false;
        if (typeof updateStatus === 'function') updateStatus(false);
        setTimeout(connect, 2000);
      };
      ws.onerror = () => {};
    }

    function applyHighlight(p) {
      highlight = {
        activeLineId: p.activeLineId || null,
        activeTokenId: p.activeTokenId || null,
        activeChordId: p.activeChordId || null,
        doneLines: new Set(p.doneLines || [])
      };
    }

    function seek(time) {
      const duration = Number(playback.duration) || 0;
      const value = Math.max(0, Math.min(Number(time) || 0, duration || Number(time) || 0));
      send(Protocol.MSG.SEEK_REQUEST, { time: value });
    }

    function requestTransport(action) {
      if (!['play', 'pause', 'stop'].includes(action)) return;
      send(Protocol.MSG.TRANSPORT_REQUEST, { action });
    }

    /**
     * تنظیمات محلی گوشی — فقط روی این دستگاه اعمال می‌شود.
     * @param {object} patch { fontSize, fontFamily, chordColor, textColor, highlightColor, backgroundColor, scale, showChords }
     */
    function setLocalView(patch) {
      localOverride = Object.assign({}, localOverride, patch || {});
      try {
        localStorage.setItem(
          MOBILE_VIEW_STORAGE_KEY,
          JSON.stringify(localOverride)
        );
      } catch (e) {}
      renderFull();
    }

    function loadLocalView() {
      try {
        const raw = localStorage.getItem(MOBILE_VIEW_STORAGE_KEY);
        if (raw) {
          localOverride = Object.assign({}, DEFAULT_MOBILE_VIEW, JSON.parse(raw));
        }
        localOverride.showQuantizeGrid = false;
        localOverride.mobileLayout = true;
      } catch (e) {}
    }

    function init(el) {
      container = el;
      loadLocalView();
      startPlaybackRenderLoop();
      connect();
    }

    function isConnected() { return connected; }

    function getLocalView() {
      return Object.assign({}, localOverride);
    }

    return {
      init,
      connect,
      setLocalView,
      getLocalView,
      seek,
      requestTransport,
      isConnected
    };
  })();

  globalScope.AkordMobileClient = MobileClient;

})(typeof window !== 'undefined' ? window : globalThis);
