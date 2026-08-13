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
      root.setAttribute('role', 'button');
      root.setAttribute('aria-label', 'اشتراک‌گذاری گروه‌نوازی');
      root.tabIndex = 0;
      root.title = 'اشتراک‌گذاری گروه‌نوازی';
      root.style.cssText = [
        'position:fixed', 'left:14px', 'top:14px', 'z-index:99999',
        'width:58px', 'height:58px', 'background:rgba(19,28,43,0.78)', 'color:#E2E8F0',
        'border:1px solid rgba(0,242,254,0.48)', 'border-radius:50%',
        'font-family:Vazirmatn,sans-serif', 'font-size:13px', 'box-shadow:0 8px 30px rgba(0,0,0,0.5)',
        'backdrop-filter:blur(16px)', 'overflow:visible', 'direction:rtl',
        'transition:width .22s ease,height .22s ease,border-radius .22s ease,box-shadow .22s ease'
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

      const headerEl = el('akord-sync-header');
      const bodyEl = el('akord-sync-body');
      if (headerEl) {
        headerEl.innerHTML = `
          <span id="akord-sync-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="26" height="26" fill="none"
              stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="16" r="3.2"></circle>
              <circle cx="24" cy="8" r="3.2"></circle>
              <circle cx="24" cy="24" r="3.2"></circle>
              <path d="M10.8 14.6 21.1 9.5M10.8 17.4l10.3 5.1"></path>
            </svg>
          </span>
          <span id="akord-sync-title">اشتراک‌گذاری گروه‌نوازی</span>
          <span id="akord-sync-toggle" aria-hidden="true">⌄</span>
        `;
        headerEl.style.cssText = [
          'display:flex', 'align-items:center', 'justify-content:center', 'gap:8px',
          'width:100%', 'height:100%', 'padding:8px', 'cursor:pointer',
          'color:#dffcff', 'background:linear-gradient(135deg,rgba(0,242,254,.22),rgba(255,46,147,.18))',
          'border-radius:inherit', 'transition:background .2s ease'
        ].join(';');
      }
      const toggleEl = el('akord-sync-toggle');
      const titleEl = el('akord-sync-title');
      if (bodyEl) bodyEl.style.display = 'none';
      if (titleEl) titleEl.style.display = 'none';
      if (toggleEl) toggleEl.style.display = 'none';
      if (qrCanvas) {
        qrCanvas.width = 280;
        qrCanvas.height = 280;
        qrCanvas.setAttribute('aria-label', 'QR code for phone connection');
        qrCanvas.style.cssText = [
          'display:block', 'width:280px', 'height:280px', 'background:#fff',
          'border-radius:4px', 'image-rendering:pixelated'
        ].join(';');
        if (qrCanvas.parentElement) {
          qrCanvas.parentElement.style.cssText = [
            'display:flex', 'justify-content:center', 'align-items:center',
            'margin:10px 0 8px', 'padding:12px', 'background:#fff',
            'border:1px solid rgba(255,255,255,.85)', 'border-radius:16px',
            'box-shadow:0 8px 22px rgba(0,0,0,.26)'
          ].join(';');
        }
      }

      // جمع/باز کردن پنل
      const togglePanel = () => {
        const body = el('akord-sync-body');
        const toggle = el('akord-sync-toggle');
        const title = el('akord-sync-title');
        const hidden = body.style.display === 'none';
        body.style.display = hidden ? 'block' : 'none';
        title.style.display = hidden ? 'inline' : 'none';
        toggle.style.display = hidden ? 'inline' : 'none';
        toggle.textContent = hidden ? '⌃' : '⌄';
        root.style.width = hidden ? '340px' : '58px';
        root.style.height = hidden ? 'auto' : '58px';
        root.style.borderRadius = hidden ? '18px' : '50%';
        root.style.overflow = hidden ? 'hidden' : 'visible';
        root.style.boxShadow = hidden
          ? '0 16px 42px rgba(0,0,0,.54)'
          : '0 8px 30px rgba(0,0,0,.5)';
        headerEl.style.justifyContent = hidden ? 'space-between' : 'center';
        headerEl.style.padding = hidden ? '10px 14px' : '8px';
        root.setAttribute('aria-expanded', String(hidden));
      };
      el('akord-sync-header').addEventListener('click', togglePanel);
      root.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          togglePanel();
        }
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
        // Keep the payload short and use an actual QR quiet zone. The old
        // renderer filled the whole canvas with modules, which makes phone
        // cameras hunt for the finder pattern and scan unreliably.
        const qr = globalScope.qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const count = qr.getModuleCount();
        const ctx = qrCanvas.getContext('2d');
        const size = qrCanvas.width;
        const quietModules = 4;
        const tile = Math.max(1, Math.floor(size / (count + quietModules * 2)));
        const codeSize = tile * count;
        const offset = Math.floor((size - codeSize) / 2);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#000';
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) {
              ctx.fillRect(offset + c * tile, offset + r * tile, tile, tile);
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
