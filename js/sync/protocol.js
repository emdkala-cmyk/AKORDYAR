/**
 * sync/protocol.js — پروتکل مشترک سینک بین لپ‌تاپ (Master) و گوشی (Slave)
 *
 * این فایل هم در Node (syncHub) و هم در مرورگر (masterSync / mobileClient)
 * لود می‌شود، پس نباید به هیچ ماژول Node یا مرورگر خاصی وابسته باشد.
 *
 * طراحی آینده‌نگر:
 *  - پیام‌ها نسخه‌دار هستند (PROTOCOL_VERSION) تا اپلیکیشن نیتیو آینده
 *    بتواند با همین قرارداد کار کند.
 *  - داده سند از داده پخش (playhead) جدا شد تا تغییرات فریم‌به‌فریم پخش
 *    باعث ارسال مجدد کل سند نشود (صرفه‌جویی در پهنای باند نقطه‌اتصال).
 */

(function attachSyncProtocol(globalScope) {
  'use strict';

  const PROTOCOL_VERSION = 1;
  const MAGIC = 'AKORDSYNC';

  const ROLE = Object.freeze({
    MASTER: 'master',   // لپ‌تاپ — فقط او اجازه ارسال state دارد
    SLAVE:  'slave'     // گوشی — فقط دریافت می‌کند + تنظیمات محلی خودش
  });

  const MSG = Object.freeze({
    // ===== handshake =====
    HELLO:     'hello',       // ورود کلاینت: { role, name, clientVersion }
    WELCOME:   'welcome',     // پاسخ هاب: { you, peers, protocolVersion }
    PEER_JOIN: 'peer-join',   // یک دستگاه جدید وصل شد
    PEER_LEAVE:'peer-leave',  // یک دستگاه قطع شد

    // ===== از Master به Hub =====
    DOC:      'doc',          // ساختار ترانه (موقع تعویض/تغییر آهنگ): { doc, keyState }
    PLAYHEAD: 'playhead',     // وضعیت پخش هر فریم: { time, isPlaying }
    HIGHLIGHT:'highlight',    // هایلایت خط فعال: { activeLineId, doneLines }
    VIEW:     'view',         // viewState پیش‌فرض مستر (برای اولین رندر اسلیو)
    TIMELINE: 'timeline',     // آینه‌ی تایم‌لاین آکوردها
    SEEK_REQUEST: 'seek-request', // درخواست جابه‌جایی تایم‌لاین از گوشی
    TRANSPORT_REQUEST: 'transport-request', // play/pause/stop از گوشی

    // ===== از Hub به Slave =====
    SNAPSHOT: 'snapshot',     // ارسال کل وضعیت فعلی به اسلیو تازه‌وارد
    PING:     'ping',
    PONG:     'pong'
  });

  const ERROR_CODE = Object.freeze({
    BAD_PROTOCOL: 'bad_protocol',
    UNKNOWN_ROLE: 'unknown_role',
    FORBIDDEN:    'forbidden'   // اسلیو سعی کرد state بفرستد
  });

  /**
   * ساخت یک پیام استاندارد.
   */
  function pack(type, payload, meta) {
    return {
      magic: MAGIC,
      v: PROTOCOL_VERSION,
      t: type,
      ts: (typeof Date !== 'undefined' ? Date.now() : 0),
      p: payload || {},
      m: meta || undefined
    };
  }

  /**
   * اعتبارسنجی یک پیام دریافتی.
   * خروجی: { ok, reason, message }
   */
  function unpack(raw) {
    let msg;
    try {
      if (typeof raw === 'string') {
        msg = JSON.parse(raw);
      } else if (raw && typeof raw.toString === 'function') {
        // Buffer / ArrayBuffer / Uint8Array (محیط Node)
        const text = raw.toString('utf8');
        msg = JSON.parse(text);
      } else {
        msg = raw;
      }
    } catch (e) {
      return { ok: false, reason: ERROR_CODE.BAD_PROTOCOL, message: 'invalid json' };
    }
    if (!msg || msg.magic !== MAGIC) {
      return { ok: false, reason: ERROR_CODE.BAD_PROTOCOL, message: 'bad magic' };
    }
    if (typeof msg.t !== 'string' || !MSG[msg.t.toUpperCase()]) {
      return { ok: false, reason: ERROR_CODE.BAD_PROTOCOL, message: 'unknown msg type' };
    }
    return { ok: true, reason: null, message: msg };
  }

  function isValidRole(role) {
    return role === ROLE.MASTER || role === ROLE.SLAVE;
  }

  const Protocol = Object.freeze({
    PROTOCOL_VERSION,
    MAGIC,
    ROLE,
    MSG,
    ERROR_CODE,
    pack,
    unpack,
    isValidRole
  });

  // CommonJS (Node) و global (مرورگر) هر دو پشتیبانی شوند
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Protocol;
  }
  globalScope.AkordSyncProtocol = Protocol;

})(typeof window !== 'undefined' ? window : globalThis);
