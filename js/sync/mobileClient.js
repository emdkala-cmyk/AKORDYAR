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
    const MOBILE_VIEW_STORAGE_KEY = 'akord_mobile_view_v2';
    const DEFAULT_MOBILE_VIEW = { fontSize: 20 };
    let ws = null;
    let connected = false;
    let container = null;
    let currentDoc = null;
    let currentKey = null;
    let remoteView = null;          // viewState که از مستر آمده (پیش‌فرض)
    let highlight = {
      activeLineId: null, activeTokenId: null, activeChordId: null, doneLines: new Set()
    };
    let localOverride = Object.assign({}, DEFAULT_MOBILE_VIEW); // تنظیمات محلی گوشی

    function url() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      return `${proto}://${location.host}/sync`;
    }

    function mergedView() {
      // ترکیب view مستر + تنظیمات محلی گوشی (محلی اولویت دارد)
      return Object.assign({}, remoteView || {}, localOverride || {});
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
    }

    function renderHighlight() {
      if (!container) return;
      if (globalScope.PlayerViewRenderer) {
        globalScope.PlayerViewRenderer.updatePlayerHighlight(
          highlight, mergedView(), container
        );
      }
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
            if (p.highlight) applyHighlight(p.highlight);
            renderFull();
            break;
          case Protocol.MSG.DOC:
            currentDoc = p.doc || null;
            currentKey = p.keyState || null;
            renderFull();
            break;
          case Protocol.MSG.VIEW:
            remoteView = p.view || null;
            renderFull();
            break;
          case Protocol.MSG.HIGHLIGHT:
            applyHighlight(p);
            renderHighlight();
            break;
          case Protocol.MSG.PLAYHEAD:
            // گوشی نمایشگر است؛ playhead را فقط برای همگامسازی زمان نگه می‌داریم
            // (رندر PlayerView بر اساس activeLineId است، نه زمان خام)
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
      } catch (e) {}
    }

    function init(el) {
      container = el;
      loadLocalView();
      connect();
    }

    function isConnected() { return connected; }

    return { init, connect, setLocalView, isConnected };
  })();

  globalScope.AkordMobileClient = MobileClient;

})(typeof window !== 'undefined' ? window : globalThis);
