/**
 * sync/deviceManager.js — پنل مدیریت دستگاه‌ها روی دسکتاپ (Master UI)
 *
 * وظایف:
 *  - نمایش آدرس LAN و QR کد برای اتصال گوشی (بدون تایپ دستی).
 *  - لیست گوشی‌های متصل (Slaveها) و تعداد آن‌ها.
 *  - دکمه روشن/خاموش کردن MasterSync.
 *  - نمایش وضعیت اتصال به SyncHub.
 *
 * این ماژول فقط UI است؛ منطق انتقال در masterSync.js و syncHub.js جدا شده.
 */

(function attachDeviceManager(globalScope) {
  'use strict';

  const DeviceManager = (() => {
    let panelEl = null;
    let qrCanvas = null;
    let listEl = null;
    let statusEl = null;
    let _pollTimer = null;

    function el(id) { return document.getElementById(id); }

    function buildPanel() {
      if (panelEl) return panelEl;

      const root = document.createElement('div');
      root.id = 'akord-sync-panel';
      root.style.cssText = [
        'position:fixed', 'left:12px', 'bottom:12px', 'z-index:99999',
        'width:300px', 'background:rgba(15,19,30,0.96)', 'color:#E2E8F0',
        'border:1px solid rgba(0,242,254,0.35)', 'border-radius:12px',
        'font-family:Vazirmatn,sans-serif', 'font-size:13px', 'box-shadow:0 8px 30px rgba(0,0,0,0.5)',
        'backdrop-filter:blur(6px)', 'overflow:hidden', 'direction:rtl'
      ].join(';');

      root.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(90deg,rgba(0,242,254,0.15),rgba(255,46,147,0.15));cursor:pointer;" id="akord-sync-header">
          <span style="font-weight:700;">🎸 اشتراک‌گذاری گروه‌نوازی</span>
          <span id="akord-sync-toggle" style="font-size:18px;">▾</span>
        </div>
        <div id="akord-sync-body" style="padding:12px;">
          <div id="akord-sync-status" style="color:#7dd3fc;margin-bottom:8px;">در حال اتصال…</div>
          <div style="text-align:center;margin:6px 0;">
            <canvas id="akord-sync-qr" width="180" height="180" style="background:#fff;border-radius:8px;"></canvas>
          </div>
          <div style="text-align:center;color:#94a3b8;font-size:11px;margin-bottom:4px;">با گوشی اسکن کنید</div>
          <div id="akord-sync-url" style="text-align:center;color:#00F2FE;font-size:12px;word-break:break-all;margin-bottom:6px;"></div>
          <div id="akord-sync-ips" style="text-align:center;color:#64748b;font-size:10px;word-break:break-all;margin-bottom:6px;"></div>
          <div style="text-align:center;margin-bottom:8px;">
            <button id="akord-sync-refresh" style="background:rgba(0,242,254,0.15);border:1px solid rgba(0,242,254,0.4);color:#00F2FE;border-radius:8px;padding:4px 12px;font-family:inherit;cursor:pointer;font-size:11px;margin:2px;">🔄 تازهسازی آدرس</button>
            <button id="akord-sync-resend" style="background:rgba(255,46,147,0.15);border:1px solid rgba(255,46,147,0.4);color:#FF2E93;border-radius:8px;padding:4px 12px;font-family:inherit;cursor:pointer;font-size:11px;margin:2px;">📤 ارسال مجدد به گوشیها</button>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">
            <div style="color:#94a3b8;margin-bottom:4px;">دستگاه‌های متصل:</div>
            <div id="akord-sync-list" style="max-height:120px;overflow-y:auto;"></div>
          </div>
        </div>
      `;

      document.body.appendChild(root);
      panelEl = root;
      qrCanvas = el('akord-sync-qr');
      listEl = el('akord-sync-list');
      statusEl = el('akord-sync-status');

      // جمع/باز کردن پنل
      el('akord-sync-header').addEventListener('click', () => {
        const body = el('akord-sync-body');
        const toggle = el('akord-sync-toggle');
        const hidden = body.style.display === 'none';
        body.style.display = hidden ? 'block' : 'none';
        toggle.textContent = hidden ? '▾' : '▸';
      });

      // تازه‌سازی دستی آدرس (برای وقتی هاتسپات بعد از باز شدن برنامه روشن می‌شود)
      el('akord-sync-refresh').addEventListener('click', (e) => {
        e.stopPropagation();
        refreshInfo();
      });

      el('akord-sync-resend').addEventListener('click', (e) => {
        e.stopPropagation();
        const Master = globalScope.AkordMasterSync;
        if (Master && Master.resendSnapshot) {
          Master.resendSnapshot();
          if (typeof toast === 'function') toast('وضعیت فعلی به گوشیها ارسال شد');
        }
      });

      return root;
    }

    function renderQR(text) {
      if (!qrCanvas || !text) return;
      if (typeof globalScope.qrcode === 'undefined') {
        console.warn('[DeviceManager] کتابخانه qrcode لود نشده');
        return;
      }
      try {
        const qr = globalScope.qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const count = qr.getModuleCount();
        const ctx = qrCanvas.getContext('2d');
        const size = qrCanvas.width;
        const tile = size / count;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#000';
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) {
              ctx.fillRect(Math.floor(c * tile), Math.floor(r * tile), Math.ceil(tile), Math.ceil(tile));
            }
          }
        }
      } catch (e) { console.error('[DeviceManager] QR error', e); }
    }

    async     function refreshInfo() {
      try {
        const resp = await fetch('/api/sync/info?' + Date.now());
        if (!resp.ok) return;
        const info = await resp.json();
        const urlEl = el('akord-sync-url');
        if (urlEl) urlEl.textContent = info.clientUrl || '';
        const ipsEl = el('akord-sync-ips');
        if (ipsEl && info.lanIps && info.lanIps.length > 1) {
          ipsEl.textContent = 'آدرس‌های دیگر: ' + info.lanIps.join(' , ');
        } else if (ipsEl) {
          ipsEl.textContent = '';
        }
        renderQR(info.clientUrl || '');
      } catch (e) { /* ignore */ }
    }

    function setStatus(connected, slaveCount) {
      if (!statusEl) return;
      if (connected) {
        statusEl.textContent = `✅ متصل — ${slaveCount || 0} گوشی وصل شده`;
        statusEl.style.color = '#4ade80';
      } else {
        statusEl.textContent = '⏳ در حال اتصال به سرور سینک…';
        statusEl.style.color = '#fbbf24';
      }
    }

    function addDevice(peer) {
      if (!listEl) return;
      const row = document.createElement('div');
      row.id = 'peer-' + peer.id;
      row.style.cssText = 'padding:4px 6px;margin:3px 0;border-radius:6px;background:rgba(0,242,254,0.08);display:flex;justify-content:space-between;';
      row.innerHTML = `<span>${peer.name || 'گوشی'}</span><span style="color:#94a3b8;">${peer.ip || ''}</span>`;
      listEl.appendChild(row);
    }

    function removeDevice(id) {
      const row = el('peer-' + id);
      if (row && row.parentNode) row.parentNode.removeChild(row);
    }

    function start() {
      buildPanel();
      // توجه: masterSync.js خودش در DOMContentLoaded متصل می‌شود؛
      // اینجا فقط بررسی می‌کنیم (برای جلوگیری از دو اتصال همزمان که
      // باعث حلقه connect/disconnect در هاب می‌شود)
      const Master = globalScope.AkordMasterSync;
      if (Master && typeof Master.ensureConnected === 'function') {
        Master.ensureConnected();
      }

      refreshInfo();
      _pollTimer = setInterval(() => {
        const connected = Master ? Master.isConnected() : false;
        // تعداد اسلیو از طریق API
        fetch('/api/sync/info').then(r => r.json()).then(info => {
          setStatus(connected, info.slaves || 0);
          // رفرش لیست فقط در صورت نیاز (ساده‌سازی: هر بار پاک می‌کنیم و دوباره می‌سازیم)
        }).catch(() => {});
      }, 3000);

      // گوش دادن به رویدادهای هاب از طریق یک کانال ساده (در صورت وجود)
      if (globalScope.AkordMasterSyncEvents) {
        globalScope.AkordMasterSyncEvents.onJoin = addDevice;
        globalScope.AkordMasterSyncEvents.onLeave = removeDevice;
      }
    }

    function stop() {
      if (_pollTimer) clearInterval(_pollTimer);
      const Master = globalScope.AkordMasterSync;
      if (Master) Master.disconnect();
      if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
      panelEl = null;
    }

    return { start, stop, buildPanel, addDevice, removeDevice, setStatus };
  })();

  globalScope.AkordDeviceManager = DeviceManager;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      // پنل را فقط وقتی Akordyar.html لود شده بساز (نه صفحه گوشی)
      if (globalScope.location && globalScope.location.pathname.endsWith('sync-client.html')) return;
      if (globalScope.AkordMasterSync) {
        try { DeviceManager.start(); }
        catch (e) { console.error('[DeviceManager]', e); }
      }
    });
  }

})(typeof window !== 'undefined' ? window : globalThis);
