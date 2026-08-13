/**
 * sync/masterSync.js — کلاینت مستر (سمت لپ‌تاپ / مرورگر)
 *
 * کارها:
 *  1. به SyncHub وصل می‌شود و نقش Master را اعلام می‌کند.
 *  2. به PerformanceStore (منبع واحد state) subscribe می‌شود.
 *  3. تغییرات را طبق پروتکل می‌فرستد:
 *       - DOC / VIEW  → فقط وقتی ساختار یا viewState عوض شود (سنگین)
 *       - PLAYHEAD    → هر فریم پخش (سبک: فقط time + isPlaying)
 *       - HIGHLIGHT   → وقتی خط فعال یا خطوط خوانده‌شده عوض شود
 *  4. وقتی اسلیو تازه‌وارد می‌آید (peer-join)، snapshot کامل می‌فرستد
 *     تا گوشی بلافاصله ترانه را نشان دهد.
 *
 * اینجا هیچ رندری انجام نمی‌شود — فقط انتقال state.
 * (همین الگو در اپلیکیشن نیتیو آینده تکرار می‌شود.)
 */

(function attachMasterSync(globalScope) {
  'use strict';

  const Protocol = globalScope.AkordSyncProtocol;

  function getStore() {
    return globalScope.PerformanceStore || null;
  }

  function buildSnapshot() {
    const store = getStore();
    if (!store) return null;
    const st = store.getSerializableState();
    return {
      doc: st.songDocument,
      keyState: st.keyState,
      view: st.viewStates && st.viewStates.playerView,
      playback: st.playbackState,
      highlight: st.highlightState
    };
  }

  const MasterSync = (() => {
    let ws = null;
    let connected = false;
    let deviceName = 'Laptop';
    let _unsubs = [];
    let _lastHighlightKey = '';
    let _rafScheduled = false;

    function url() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      let origin;
      try { origin = location.origin; } catch (e) {}
      if (!origin || origin === 'null' || origin === 'file://') {
        origin = 'http://127.0.0.1:3000';
      }
      const wsOrigin = proto + '://' + origin.replace(/^https?:\/\//, '');
      return wsOrigin + '/sync';
     }

    function send(type, payload, meta) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(Protocol.pack(type, payload, meta)));
    }

    function pushDoc() {
      const store = getStore();
      if (!store) return;
      const st = store.getState();
      send(Protocol.MSG.DOC, {
        doc: st.songDocument,
        keyState: st.keyState
      });
      send(Protocol.MSG.VIEW, { view: st.viewStates && st.viewStates.playerView });
    }

    function pushPlayhead() {
      // ارسال در next frame برای جلوگیری از انباشت پیام در یک فریم
      if (_rafScheduled) return;
      _rafScheduled = true;
      requestAnimationFrame(() => {
        _rafScheduled = false;
        const store = getStore();
        if (!store) return;
        const pb = store.getState().playbackState;
        send(Protocol.MSG.PLAYHEAD, {
          time: pb.time,
          isPlaying: pb.isPlaying,
          duration: pb.duration || 0
        });
      });
    }

    function pushHighlight() {
      const store = getStore();
      if (!store) return;
      const hl = store.getState().highlightState;
      const key = JSON.stringify([
        hl.activeLineId, hl.activeTokenId, hl.activeChordId,
        Array.from(hl.doneLines || [])
      ]);
      if (key === _lastHighlightKey) return;
      _lastHighlightKey = key;
      send(Protocol.MSG.HIGHLIGHT, {
        activeLineId: hl.activeLineId,
        activeTokenId: hl.activeTokenId,
        activeChordId: hl.activeChordId,
        doneLines: Array.from(hl.doneLines || [])
      });
    }

    function onPeerJoin() {
      // یک اسلیو جدید وصل شد → snapshot کامل بفرست
      const snap = buildSnapshot();
      if (snap) send(Protocol.MSG.SNAPSHOT, snap);
    }

    function wireStore() {
      const store = getStore();
      if (!store) return;
      _unsubs.push(store.subscribe('contentUpdated', pushDoc));
      _unsubs.push(store.subscribe('keyChanged', pushDoc));
      _unsubs.push(store.subscribe('viewStateChanged', (ev) => {
        if (!ev || ev.viewId === 'playerView' || !ev.viewId) pushDoc();
      }));
      _unsubs.push(store.subscribe('playbackStateChanged', pushPlayhead));
      _unsubs.push(store.subscribe('highlightChanged', pushHighlight));
    }

    function clearStore() {
      _unsubs.forEach(fn => { try { fn(); } catch (e) {} });
      _unsubs = [];
    }

    function connect(name) {
      if (typeof WebSocket === 'undefined' || !Protocol) {
        console.warn('[MasterSync] WebSocket یا Protocol در دسترس نیست');
        return;
      }
      deviceName = name || deviceName;
      // اگر قبلاً یه ws داشتیم که بسته شده، آن را پاک کنیم
      if (ws && (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)) {
        try { ws.onclose = null; } catch (e) {}
        ws = null;
      }
      // اگر هنوز ws فعالی داریم، اتصال جدید نساز (از حلقه جلوگیری می‌کند)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
      }

      let socket;
      try {
        const u = url();
        console.log('[MasterSync] connecting to', u);
        socket = new WebSocket(u);
        ws = socket;
        // Electron sometimes reports code 1006 without exposing the
        // underlying reason. Keep the socket identity and readyState in the
        // log so a stale socket cannot be mistaken for the current one.
        console.log('[MasterSync] socket created readyState=' + socket.readyState);
      } catch (e) {
        console.error('[MasterSync] connect error', e);
        return;
      }

      ws.onopen = () => {
        if (ws !== socket) return;
        console.log('[MasterSync] socket open readyState=' + socket.readyState);
        connected = true;
        send(Protocol.MSG.HELLO, { role: Protocol.ROLE.MASTER, name: deviceName, clientVersion: Protocol.PROTOCOL_VERSION });
        wireStore();
        // اولین snapshot بلافاصله بعد از welcome
      };

      ws.onmessage = (ev) => {
        const res = Protocol.unpack(ev.data);
        if (!res.ok) return;
        const t = res.message.t;
        if (t === Protocol.MSG.PING) {
          // Keep the master session alive. The hub terminates peers that do
          // not answer its heartbeat within two intervals.
          send(Protocol.MSG.PONG, {});
        } else if (t === Protocol.MSG.WELCOME && res.message.p.ok) {
          // مستر تایید شد؛ snapshot اولیه بفرست
          const snap = buildSnapshot();
          if (snap) send(Protocol.MSG.SNAPSHOT, snap);
        } else if (t === Protocol.MSG.PEER_JOIN) {
          onPeerJoin();
        } else if (t === Protocol.MSG.SEEK_REQUEST) {
          const time = Number(res.message.p && res.message.p.time);
          if (Number.isFinite(time) && typeof globalScope.seekTransport === 'function') {
            globalScope.seekTransport(time, false, true);
          }
        } else if (t === Protocol.MSG.TRANSPORT_REQUEST) {
          const action = res.message.p && res.message.p.action;
          if (action === 'play' && typeof globalScope.startTransport === 'function') {
            globalScope.startTransport();
          } else if (action === 'pause' && typeof globalScope.pauseTransport === 'function') {
            globalScope.pauseTransport();
          } else if (action === 'stop' && typeof globalScope.stopTransport === 'function') {
            globalScope.stopTransport();
          }
        }
      };

      ws.onclose = (ev) => {
        if (ws !== socket) return;
        connected = false;
        clearStore();
        console.warn('[MasterSync] disconnected code=' + (ev && ev.code) +
          ' reason=' + (ev && ev.reason) +
          ' readyState=' + socket.readyState +
          ' wasClean=' + (ev && ev.wasClean));
        // تلاش مجدد پس از ۳ ثانیه (زمان بیشتر برای جلوگیری از حلقه)
        setTimeout(() => { if (!connected) connect(deviceName); }, 3000);
      };

      ws.onerror = (ev) => {
        if (ws === socket) {
          console.warn('[MasterSync] socket error', ev);
        }
      };
    }

    function isConnected() { return connected; }

    // اطمینان از اتصال بدون ایجاد اتصال دوم (جلوگیری از حلقه)
    function ensureConnected() {
      if (connected) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      connect(deviceName);
    }

    function resendSnapshot() {
      const snap = buildSnapshot();
      if (snap) send(Protocol.MSG.SNAPSHOT, snap);
    }

    function disconnect() {
      clearStore();
      if (ws) { try { ws.close(); } catch (e) {} }
      ws = null;
      connected = false;
    }

    return { connect, disconnect, isConnected, ensureConnected, resendSnapshot };
  })();

  globalScope.AkordMasterSync = MasterSync;

  // خودکار وصل شو وقتی DOM آماده شد (فقط اگر PerformanceStore هست)
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      if (globalScope.PerformanceStore && Protocol) {
        MasterSync.connect('Laptop');
      }
    });
  }

})(typeof window !== 'undefined' ? window : globalThis);
