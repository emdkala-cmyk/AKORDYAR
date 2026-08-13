/**
 * syncHub.js — مرکز سینک WebSocket (Node side)
 *
 * مدل: یک Master (لپ‌تاپ) و چندین Slave (گوشی).
 *  - Master مجاز است پیام‌های doc / playhead / highlight / view بفرستد.
 *  - Hub این پیام‌ها را بلافاصله به همه Slaveها broadcast می‌کند.
 *  - Slave فقط اجازه دارد hello / pong بفرستد؛ اگر state بفرستد رد می‌شود.
 *
 * طراحی آینده‌نگر: هیچ منطق رندر یا UI اینجا نیست — فقط مسیریابی پیام.
 * اپلیکیشن نیتیو آینده دقیقاً همین قرارداد را روی موبایل پیاده می‌کند.
 */

'use strict';

const { WebSocketServer } = require('ws');
const os = require('os');
const crypto = require('crypto');
const Protocol = require('../js/sync/protocol.js');

function createSyncHub(httpServer, options = {}) {
  const path = options.path || '/sync';
  const heartbeatInterval = options.heartbeatInterval || 15000;

  const wss = new WebSocketServer({ server: httpServer, path });

  /** @type {Map<string, {ws: any, role: string, name: string, ip: string, lastSeen: number}>} */
  const peers = new Map();
  let masterId = null;
  let peerSeq = 0;
  // آخرین snapshot دریافتی از مستر — برای ارسال به اسلیوهای تازه‌وارد (حتی اگر
  // مستر در لحظهٔ اتصال اسلیو مشغول باشد یا اتصالش لحظهای قطع شود)
  let lastSnapshot = null;

  function log(tag, msg) {
    console.log(`\x1b[35m[SyncHub]\x1b[0m \x1b[90m[${tag}]\x1b[0m ${msg}`);
  }

  function getLocalIp() {
    const ifaces = os.networkInterfaces();
    const candidates = [];
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          candidates.push(iface.address);
        }
      }
    }
    return candidates[0] || '127.0.0.1';
  }

  function send(ws, type, payload, meta) {
    if (!ws || ws.readyState !== ws.OPEN) return;
    try {
      ws.send(JSON.stringify(Protocol.pack(type, payload, meta)));
    } catch (e) { /* ignore */ }
  }

  function broadcast(type, payload, meta, exceptId) {
    const data = JSON.stringify(Protocol.pack(type, payload, meta));
    for (const [id, peer] of peers) {
      if (id === exceptId) continue;
      if (peer.ws.readyState === peer.ws.OPEN) {
        try { peer.ws.send(data); } catch (e) { /* ignore */ }
      }
    }
  }

  function peersSnapshot(forRole) {
    const list = [];
    for (const [id, peer] of peers) {
      if (id === masterId) continue; // مستر را در لیست دستگاه‌ها نشان نمی‌دهیم
      list.push({ id, role: peer.role, name: peer.name, ip: peer.ip });
    }
    return list;
  }

  function assignId(role) {
    peerSeq += 1;
    const rand = crypto.randomBytes(3).toString('hex');
    return `${role}_${peerSeq}_${rand}`;
  }

  function handleHello(peer, message) {
    const role = message.p && message.p.role;
    const name = (message.p && message.p.name) || (role === Protocol.ROLE.MASTER ? 'Laptop' : 'Phone');

    if (!Protocol.isValidRole(role)) {
      send(peer.ws, 'welcome', { ok: false, error: Protocol.ERROR_CODE.UNKNOWN_ROLE });
      return;
    }

    // فقط اجازه بده یک Master داشته باشیم.
    // نکته مهم: هر بار که کلاینت مستر reconnect می‌کند، آیدی جدیدی می‌گیرد،
    // پس نباید مستر قبلی را ببندیم (باعث حلقه connect/disconnect می‌شود).
    // فقط masterId را به‌روزرسانی می‌کنیم؛ اگر مستر قبلی هنوز در لیست است
    // و زنده است، آن را به عنوان همان نشست در نظر می‌گیریم و نمی‌بندیم.
    if (role === Protocol.ROLE.MASTER) {
      // پاکسازی نشست‌های مستر مرده (غیر از نشست فعلی)
      if (masterId && masterId !== peer.id && peers.has(masterId)) {
        const prev = peers.get(masterId);
        if (prev && (!prev.ws || prev.ws.readyState !== prev.ws.OPEN)) {
          peers.delete(masterId);
        }
        // اگر هنوز زنده است، آن را نمی‌بندیم — فقط آیدی را جایگزین می‌کنیم
      }
      masterId = peer.id;
    }

    peer.role = role;
    peer.name = name;
    peer.lastSeen = Date.now();

    send(peer.ws, 'welcome', {
      ok: true,
      you: { id: peer.id, role, name },
      protocolVersion: Protocol.PROTOCOL_VERSION,
      localIp: getLocalIp(),
      port: options.port || (httpServer && httpServer.address() ? httpServer.address().port : null)
    });

    // به بقیه اطلاع بده که دستگاه جدیدی آمده
    broadcast('peer-join', { id: peer.id, role, name, ip: peer.ip }, null, peer.id);

    // اگر اسلیو تازه‌وارد است و snapshot قبلی داریم، بلافاصله بفرست
    if (role === Protocol.ROLE.SLAVE && lastSnapshot) {
      send(peer.ws, Protocol.MSG.SNAPSHOT, lastSnapshot);
      log('peer', `snapshot فوری برای ${name} ارسال شد`);
    }

    log('peer', `${name} (${role}) connected — total ${peers.size}`);
  }

  function handleMasterMessage(peer, message) {
    const type = message.t;
    // فقط پیام‌های مجاز مستر را عبور بده
    if (type === Protocol.MSG.DOC ||
        type === Protocol.MSG.PLAYHEAD ||
        type === Protocol.MSG.HIGHLIGHT ||
        type === Protocol.MSG.VIEW) {
      // به‌روزرسانی snapshot داخلی برای اسلیوهای بعدی
      if (type === Protocol.MSG.SNAPSHOT) {
        lastSnapshot = message.p;
      } else if (type === Protocol.MSG.DOC) {
        lastSnapshot = Object.assign({}, lastSnapshot, { doc: message.p.doc, keyState: message.p.keyState });
      } else if (type === Protocol.MSG.HIGHLIGHT) {
        lastSnapshot = Object.assign({}, lastSnapshot, { highlight: message.p });
      } else if (type === Protocol.MSG.VIEW) {
        lastSnapshot = Object.assign({}, lastSnapshot, { view: message.p.view });
      }
      broadcast(type, message.p, message.m);
    }
  }

  function handlePong(peer) {
    peer.lastSeen = Date.now();
  }

  wss.on('connection', (ws, req) => {
    const ip = (req && req.socket && req.socket.remoteAddress) || 'unknown';
    const id = assignId('pending');
    const peer = { id, ws, role: 'pending', name: 'pending', ip, lastSeen: Date.now() };
    peers.set(id, peer);

    ws.on('message', (raw) => {
      const result = Protocol.unpack(raw);
      if (!result.ok) {
        send(ws, 'welcome', { ok: false, error: result.reason, message: result.message });
        return;
      }
      const message = result.message;

      switch (message.t) {
        case Protocol.MSG.HELLO:
          handleHello(peer, message);
          break;
        case Protocol.MSG.PONG:
          handlePong(peer);
          break;
        case Protocol.MSG.DOC:
        case Protocol.MSG.PLAYHEAD:
        case Protocol.MSG.HIGHLIGHT:
        case Protocol.MSG.VIEW:
          // فقط مستر اجازه دارد
          if (peer.role !== Protocol.ROLE.MASTER) {
            send(ws, 'welcome', { ok: false, error: Protocol.ERROR_CODE.FORBIDDEN });
            return;
          }
          handleMasterMessage(peer, message);
          break;
        default:
          // پیام‌های دیگر نادیده گرفته شوند
          break;
      }
    });

    ws.on('close', (code, reason) => {
      const wasMaster = peer.id === masterId;
      if (wasMaster) masterId = null;
      peers.delete(peer.id);
      broadcast('peer-leave', { id: peer.id, role: peer.role });
      log('peer', `${peer.name} (${peer.role}) disconnected code=${code} reason=${reason ? reason.toString() : ''} — total ${peers.size}`);
    });

    ws.on('error', (err) => {
      log('peer', `WS error on ${peer.name}: ${err && err.message}`);
      if (err && err.stack) console.error(err.stack);
    });
  });

  // Heartbeat — حفظ اتصال روی نقطه‌اتصال و حذف بی‌جان‌ها
  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const [id, peer] of peers) {
      if (now - peer.lastSeen > heartbeatInterval * 2) {
        try { peer.ws.terminate(); } catch (e) {}
        peers.delete(id);
        if (id === masterId) masterId = null;
        continue;
      }
      send(peer.ws, Protocol.MSG.PING, {});
    }
  }, heartbeatInterval);

  wss.on('close', () => clearInterval(heartbeat));

  return {
    wss,
    getPeerCount: () => peers.size,
    getSlaveCount: () => {
      let n = 0;
      for (const [, p] of peers) if (p.role === Protocol.ROLE.SLAVE) n++;
      return n;
    },
    getLocalIp,
    /** ارسال snapshot کامل فعلی به یک اسلیو تازه‌وارد (از سمت مستر فراخوانی می‌شود) */
    broadcastSnapshot: (snapshot) => broadcast(Protocol.MSG.SNAPSHOT, snapshot),
    close: () => { clearInterval(heartbeat); wss.close(); }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createSyncHub };
}
