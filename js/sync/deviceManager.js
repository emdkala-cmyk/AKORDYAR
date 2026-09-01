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
    const PANEL_POSITION_KEY = 'akordyar.syncPanelPosition.v1';
    let panelEl = null;
    let qrCanvas = null;
    let qrGridEl = null;
    let partQrGridEl = null;
    let partSelectEl = null;
    let partDetailsEl = null;
    let partUrlEl = null;
    let primaryIpEl = null;
    let listEl = null;
    let statusEl = null;
    let qrPayloads = [];
    let qrSelectedPartId = '';
    let qrRequestedPartId = '';
    let _pollTimer = null;
    let unsubscribeScoreChanges = null;
    let lastSyncInfo = null;
    let connectionService = null;
    let panelToggle = null;

    function el(id) { return document.getElementById(id); }

    function clampPanelPosition(root, left, top) {
      const width = root.offsetWidth || 36;
      const height = root.offsetHeight || 36;
      return {
        left: Math.max(0, Math.min(Number(left) || 0, Math.max(0, window.innerWidth - width))),
        top: Math.max(0, Math.min(Number(top) || 0, Math.max(0, window.innerHeight - height)))
      };
    }

    function loadPanelPosition(root) {
      try {
        const saved = JSON.parse(globalScope.localStorage?.getItem(PANEL_POSITION_KEY) || 'null');
        if (!saved) return;
        const position = clampPanelPosition(root, saved.left, saved.top);
        root.style.left = `${position.left}px`;
        root.style.top = `${position.top}px`;
      } catch (_) {
        // Position persistence is best effort.
      }
    }

    function savePanelPosition(root) {
      try {
        const rect = root.getBoundingClientRect();
        globalScope.localStorage?.setItem(PANEL_POSITION_KEY, JSON.stringify({
          left: parseFloat(root.style.left) || rect.left,
          top: parseFloat(root.style.top) || rect.top
        }));
      } catch (_) {
        // Position persistence is best effort.
      }
    }

    function buildPanel() {
      if (panelEl) return panelEl;

      const root = document.createElement('div');
      root.id = 'akord-sync-panel';
      root.setAttribute('role', 'button');
      root.setAttribute('aria-label', t('groupSharing'));
      root.tabIndex = 0;
      root.title = t('groupSharing');
      root.style.cssText = [
        'position:fixed', 'left:14px', 'top:14px', 'z-index:99999',
        'width:36px', 'height:36px', 'max-height:calc(100vh - 20px)',
        'background:rgba(19,28,43,0.78)', 'color:#E2E8F0',
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
          <div id="akord-sync-url" style="text-align:center;color:#00F2FE;font-size:12px;word-break:break-all;margin-bottom:6px;"></div>
          <div id="akord-sync-ips" style="text-align:center;color:#64748b;font-size:10px;word-break:break-all;margin-bottom:6px;"></div>
          <div id="akord-sync-qr-grid" class="live-score-qr-grid"></div>
          <details id="akord-sync-part-details" class="live-score-qr-details">
            <summary>نمایش QR اختصاصی سازها</summary>
            <label class="live-score-qr-part-label" for="akord-sync-part-select">انتخاب ساز</label>
            <select id="akord-sync-part-select" class="live-score-qr-part-select" aria-label=t('selectInstrument')></select>
            <div id="akord-sync-part-url" class="live-score-qr-part-url"></div>
            <div id="akord-sync-part-qr-grid" class="live-score-qr-grid"></div>
          </details>
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
      loadPanelPosition(root);
      qrCanvas = el('akord-sync-qr');
      qrGridEl = el('akord-sync-qr-grid');
      partQrGridEl = el('akord-sync-part-qr-grid');
      partSelectEl = el('akord-sync-part-select');
      partDetailsEl = el('akord-sync-part-details');
      partUrlEl = el('akord-sync-part-url');
      primaryIpEl = el('akord-sync-url');
      listEl = el('akord-sync-list');
      statusEl = el('akord-sync-status');
      connectionService = globalScope.LiveScoreConnectionService?.create?.({
        onChange: () => renderConnectionList()
      }) || null;

      const headerEl = el('akord-sync-header');
      const bodyEl = el('akord-sync-body');
      if (headerEl) {
        headerEl.innerHTML = `
          <span id="akord-sync-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
              stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="6" height="6"></rect>
              <rect x="15" y="3" width="6" height="6"></rect>
              <rect x="3" y="15" width="6" height="6"></rect>
              <path d="M15 15h3v3h-3zM18 18h3v3h-3zM15 21h3"></path>
            </svg>
          </span>
          <span id="akord-sync-title">اشتراک‌گذاری گروه‌نوازی</span>
          <span id="akord-sync-toggle" aria-hidden="true">⌄</span>
        `;
        headerEl.style.cssText = [
          'display:flex', 'align-items:center', 'justify-content:center', 'gap:6px',
          'width:100%', 'height:100%', 'padding:6px', 'cursor:grab',
          'touch-action:none', 'user-select:none',
          'color:#dffcff', 'background:linear-gradient(135deg,rgba(0,242,254,.22),rgba(255,46,147,.18))',
          'border-radius:inherit', 'transition:background .2s ease'
        ].join(';');
      }
      const toggleEl = el('akord-sync-toggle');
      const titleEl = el('akord-sync-title');
      if (bodyEl) {
        bodyEl.style.display = 'none';
        bodyEl.style.maxHeight = 'calc(100vh - 82px)';
        bodyEl.style.overflowY = 'auto';
        bodyEl.style.overscrollBehavior = 'contain';
      }
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
        root.style.width = hidden ? 'min(520px, calc(100vw - 20px))' : '36px';
        root.style.height = hidden ? 'auto' : '36px';
        root.style.maxHeight = hidden ? 'calc(100vh - 20px)' : '36px';
        root.style.borderRadius = hidden ? '18px' : '50%';
        root.style.overflow = hidden ? 'hidden' : 'visible';
        root.style.boxShadow = hidden
          ? '0 16px 42px rgba(0,0,0,.54)'
          : '0 8px 30px rgba(0,0,0,.5)';
        headerEl.style.justifyContent = hidden ? 'space-between' : 'center';
        headerEl.style.padding = hidden ? '10px 14px' : '8px';
        if (body) {
          body.style.maxHeight = hidden ? 'calc(100vh - 82px)' : '0';
          body.style.overflowY = hidden ? 'auto' : 'hidden';
        }
        root.setAttribute('aria-expanded', String(hidden));
      };
      panelToggle = togglePanel;
      let suppressHeaderClick = false;
      let dragSession = null;
      const finishHeaderDrag = (event, persist = true) => {
        if (!dragSession || event.pointerId !== dragSession.pointerId) return;
        const wasDragged = dragSession.moved;
        window.removeEventListener('pointermove', dragSession.move, true);
        window.removeEventListener('pointerup', dragSession.end, true);
        window.removeEventListener('pointercancel', dragSession.cancel, true);
        try {
          headerEl.releasePointerCapture?.(dragSession.pointerId);
        } catch (_) {}
        dragSession = null;
        headerEl.style.cursor = 'grab';
        if (wasDragged) {
          suppressHeaderClick = true;
          if (persist) savePanelPosition(root);
        }
      };

      headerEl.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const rect = root.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        const pointerId = event.pointerId;
        const move = moveEvent => {
          if (!dragSession || moveEvent.pointerId !== pointerId) return;
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          if (!dragSession.moved && Math.hypot(dx, dy) < 3) return;
          dragSession.moved = true;
          const position = clampPanelPosition(root, rect.left + dx, rect.top + dy);
          root.style.left = `${position.left}px`;
          root.style.top = `${position.top}px`;
        };
        const end = endEvent => finishHeaderDrag(endEvent);
        const cancel = cancelEvent => finishHeaderDrag(cancelEvent, false);
        dragSession = { pointerId, moved: false, move, end, cancel };
        headerEl.style.cursor = 'grabbing';
        event.preventDefault();
        try {
          headerEl.setPointerCapture?.(pointerId);
        } catch (_) {}
        window.addEventListener('pointermove', move, { capture: true, passive: false });
        window.addEventListener('pointerup', end, { capture: true });
        window.addEventListener('pointercancel', cancel, { capture: true });
      });

      headerEl.addEventListener('click', () => {
        if (suppressHeaderClick) {
          suppressHeaderClick = false;
          return;
        }
        togglePanel();
      });
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

      partSelectEl?.addEventListener('change', () => {
        qrSelectedPartId = partSelectEl.value || '';
        if (partDetailsEl) partDetailsEl.open = Boolean(qrSelectedPartId);
        renderSelectedPartQr();
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

    function currentScoreParts() {
      const state = globalScope.PerformanceStore?.getState?.() || {};
      const xmlScore = state.musicXmlScoreState?.score ||
        globalScope.EditorRuntimeAdapter?.getSong?.()?.musicXmlScore || null;
      const midiScore = state.midiScoreState?.score ||
        globalScope.EditorRuntimeAdapter?.getSong?.()?.midiScore || null;
      const score = xmlScore || midiScore;
      const normalized = xmlScore
        ? (globalScope.MusicXmlScoreModel?.normalize?.(score) || score)
        : (globalScope.MidiScoreModel?.normalize?.(score) || score);
      return {
        parts: normalized?.parts || [],
        mappings: state.musicXmlScoreState?.mappings ||
          globalScope.EditorRuntimeAdapter?.getSong?.()?.scorePartMappings || []
      };
    }

    function renderPlayViewQr(info) {
      if (!qrGridEl || !globalScope.LiveScoreQrService) return;
      const url = String(info?.clientUrl || '');
      const payloads = url
        ? [{ partId: 'player-view', role: 'playerView', label: 'Play View', url }]
        : [];
      globalScope.LiveScoreQrService.renderCards(qrGridEl, payloads, {
        showStatus: false
      });
    }

    function renderPartSelector() {
      if (!partSelectEl || !globalScope.document) return;
      partSelectEl.replaceChildren();
      qrPayloads.forEach(payload => {
        const option = document.createElement('option');
        option.value = payload.partId;
        option.textContent = payload.label || payload.role || payload.partId;
        option.selected = String(payload.partId) === String(qrSelectedPartId);
        partSelectEl.appendChild(option);
      });
      partSelectEl.disabled = qrPayloads.length === 0;
      if (!qrPayloads.length) {
        const option = document.createElement('option');
        option.textContent = t('noInstrumentAvailable');
        partSelectEl.appendChild(option);
      }
    }

    function renderSelectedPartQr() {
      if (!partQrGridEl || !globalScope.LiveScoreQrService) return;
      const selected = qrSelectedPartId
        ? qrPayloads.filter(payload => String(payload.partId) === String(qrSelectedPartId))
        : [];
      const payload = selected[0] || null;
      if (partUrlEl) {
        partUrlEl.textContent = payload?.url
          ? `آدرس اختصاصی ساز: ${payload.url}`
          : 'برای نمایش QR اختصاصی، یک ساز را انتخاب کنید';
      }
      globalScope.LiveScoreQrService.renderCards(partQrGridEl, selected, {
        connectionService
      });
    }

    function expandPanel() {
      const body = el('akord-sync-body');
      if (body && body.style.display === 'none') {
        el('akord-sync-header')?.click();
      }
    }

    function selectPartQr(partId = '', { open = true, toggleIfOpen = false } = {}) {
      if (!panelEl) buildPanel();
      const value = String(partId || '');
      const hasPayload = !value ||
        qrPayloads.some(payload => String(payload.partId) === value);
      const body = el('akord-sync-body');
      const panelIsOpen = body && body.style.display !== 'none';
      const sameSelection = hasPayload && String(qrSelectedPartId) === value;
      if (open && toggleIfOpen && panelIsOpen && sameSelection) {
        panelToggle?.();
        return true;
      }
      qrRequestedPartId = hasPayload ? '' : value;
      qrSelectedPartId = hasPayload ? value : '';
      if (partDetailsEl) partDetailsEl.open = Boolean(qrSelectedPartId);
      renderPartSelector();
      renderSelectedPartQr();
      if (!hasPayload) refreshInfo();
      if (open) expandPanel();
      return true;
    }

    function renderPartQrs(info) {
      if (!globalScope.LiveScoreQrService) return;
      const source = currentScoreParts();
      qrPayloads = globalScope.LiveScoreQrService.buildPayloads({
        baseUrl: info?.clientUrl || '',
        parts: source.parts,
        mappings: source.mappings
      });
      const requestedPartId = qrRequestedPartId || qrSelectedPartId;
      const hasRequestedPart = qrPayloads.some(payload =>
        String(payload.partId) === String(requestedPartId)
      );
      qrSelectedPartId = hasRequestedPart ? requestedPartId : '';
      qrRequestedPartId = '';
      if (partDetailsEl) partDetailsEl.open = Boolean(qrSelectedPartId);
      renderPlayViewQr(info);
      renderPartSelector();
      renderSelectedPartQr();
      if (connectionService) {
        qrPayloads.forEach(payload => connectionService.setState(
          payload.partId,
          connectionService.getState(payload.partId)
        ));
      }
    }

    function refresh() {
      return refreshInfo();
    }

    function renderConnectionList() {
      if (!listEl || !connectionService) return;
      listEl.replaceChildren();
      connectionService.getStates().forEach(peer => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:4px 6px;margin:3px 0;border-radius:6px;background:#f3f4f6;display:flex;justify-content:space-between;color:#111827;';
        row.innerHTML = `<span>${peer.name || peer.partId}</span><span>${peer.status} · ${peer.ip || ''}</span>`;
        listEl.appendChild(row);
      });
    }

    async     function refreshInfo() {
      try {
        const resp = await fetch('/api/sync/info?' + Date.now());
        if (!resp.ok) return;
        const info = await resp.json();
        lastSyncInfo = info;
        if (primaryIpEl) {
          const ip = info.localIp || '127.0.0.1';
          const port = info.port ? `:${info.port}` : '';
          primaryIpEl.textContent = `IP پلی‌ویوو: ${ip}${port}`;
        }
        const ipsEl = el('akord-sync-ips');
        if (ipsEl && info.lanIps && info.lanIps.length > 1) {
          ipsEl.textContent = t('otherAddresses') + info.lanIps.join(' , ');
        } else if (ipsEl) {
          ipsEl.textContent = '';
        }
        renderPartQrs(info);
        connectionService?.updateFromInfo?.(info);
      } catch (e) { /* ignore */ }
    }

    function setStatus(connected, slaveCount) {
      if (!statusEl) return;
      if (connected) {
        statusEl.textContent = `✅ متصل — ${slaveCount || 0} گوشی وصل شده`;
        statusEl.style.color = '#4ade80';
      } else {
        statusEl.textContent = t('connectingToSync');
        statusEl.style.color = '#fbbf24';
      }
    }

    function addDevice(peer) {
      if (!listEl) return;
      const row = document.createElement('div');
      row.id = 'peer-' + peer.id;
      row.style.cssText = 'padding:4px 6px;margin:3px 0;border-radius:6px;background:#f3f4f6;display:flex;justify-content:space-between;color:#111827;';
      row.innerHTML = `<span>${peer.name || t('phone')}${peer.partId ? ` · ${peer.partId}` : ''}</span><span>${peer.ip || ''}</span>`;
      listEl.appendChild(row);
    }

    function removeDevice(id) {
      const row = el('peer-' + id);
      if (row && row.parentNode) row.parentNode.removeChild(row);
    }

    function start() {
      buildPanel();
      if (!unsubscribeScoreChanges) {
        const store = globalScope.PerformanceStore;
        const onScoreChanged = () => {
          if (lastSyncInfo) renderPartQrs(lastSyncInfo);
          else refreshInfo();
        };
        const unsubXml = store?.subscribe?.('musicXmlScoreChanged', onScoreChanged);
        const unsubMidi = store?.subscribe?.('midiScoreChanged', onScoreChanged);
        if (unsubXml || unsubMidi) {
          unsubscribeScoreChanges = () => {
            unsubXml?.();
            unsubMidi?.();
          };
        }
      }
      // توجه: masterSync.js خودش در DOMContentLoaded متصل می‌شود؛
      // اینجا فقط بررسی می‌کنیم (برای جلوگیری از دو اتصال همزمان که
      // باعث حلقه connect/disconnect در هاب می‌شود)
      const Master = globalScope.AkordMasterSync;
      if (Master && typeof Master.ensureConnected === 'function') {
        Master.ensureConnected();
      }

      refreshInfo();
      connectionService?.start?.(2500);
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
        globalScope.AkordMasterSyncEvents.onJoin = peer => {
          addDevice(peer);
          connectionService?.setState?.(peer.partId || peer.role || peer.id, {
            status: 'connected',
            ip: peer.ip,
            peerId: peer.id,
            name: peer.name
          });
        };
        globalScope.AkordMasterSyncEvents.onLeave = peer => {
          removeDevice(peer.id);
          connectionService?.setState?.(peer.partId || peer.role || peer.id, { status: 'disconnected' });
        };
      }
    }

    function stop() {
      if (_pollTimer) clearInterval(_pollTimer);
      unsubscribeScoreChanges?.();
      unsubscribeScoreChanges = null;
      const Master = globalScope.AkordMasterSync;
      if (Master) Master.disconnect();
      if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
      panelEl = null;
    }

    return {
      start,
      stop,
      buildPanel,
      addDevice,
      removeDevice,
      setStatus,
      selectPartQr,
      refresh,
      getQrPayloads: () => qrPayloads.slice()
    };
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
