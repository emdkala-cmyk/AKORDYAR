/**
 * inject-debug.js — دیباگ درجایافته برای بررسی وضعیت سینک توی همون پنجرهٔ
 * اصلی Akordyar (جایی که PerformanceStore و AkordMasterSync واقعاً لود
 * میشوند). خروجی را در یک پنل شناور نشان میدهد.
 */

(function () {
  'use strict';
  function panel() {
    let p = document.getElementById('akord-inject-debug');
    if (!p) {
      p = document.createElement('div');
      p.id = 'akord-inject-debug';
      p.style.cssText = 'position:fixed;top:0;right:0;z-index:999999;width:320px;max-height:60vh;overflow:auto;background:rgba(0,0,0,0.9);color:#0f0;font:12px monospace;padding:8px;border:1px solid #0f0;direction:ltr;text-align:left;';
      document.body.appendChild(p);
    }
    return p;
  }
  function L(msg, cls) {
    const p = panel();
    const d = document.createElement('div');
    d.style.color = cls === 'bad' ? '#f87171' : cls === 'warn' ? '#fbbf24' : cls === 'ok' ? '#4ade80' : '#0f0';
    d.textContent = msg;
    p.appendChild(d);
    p.scrollTop = p.scrollHeight;
  }
  function run() {
    L('=== Akordyar Sync Debug ===');
    L('AkordSyncProtocol: ' + (typeof AkordSyncProtocol !== 'undefined'));
    L('PerformanceStore: ' + (typeof PerformanceStore !== 'undefined'));
    L('AkordMasterSync: ' + (typeof AkordMasterSync !== 'undefined'));
    L('AkordDeviceManager: ' + (typeof AkordDeviceManager !== 'undefined'));
    L('PlayerViewRenderer: ' + (typeof PlayerViewRenderer !== 'undefined'));
    if (typeof AkordMasterSync !== 'undefined') {
      L('MasterSync.isConnected: ' + AkordMasterSync.isConnected(), AkordMasterSync.isConnected() ? 'ok' : 'warn');
    }
    if (typeof PerformanceStore !== 'undefined') {
      const st = PerformanceStore.getState();
      const lines = (st.songDocument && st.songDocument.lines || []).length;
      L('songDocument.lines: ' + lines, lines > 0 ? 'ok' : 'warn');
      L('playback: ' + JSON.stringify(st.playbackState));
    }
    fetch('/api/sync/info?' + Date.now()).then(r => r.json()).then(i => {
      L('server masters=' + i.masters + ' slaves=' + i.slaves + ' total=' + i.total);
    }).catch(e => L('server err: ' + e.message, 'bad'));
    L('--- برای تست ارسال doc، در کنسول تایپ کنید: window.__sendTestDoc() ---');
  }

  window.__sendTestDoc = function () {
    if (typeof AkordMasterSync === 'undefined' || !AkordMasterSync.isConnected()) { L('MasterSync متصل نیست', 'bad'); return; }
    // استفاده از دسترسی داخلی: مستقیم به هاب نمیتوانیم، پس PerformanceStore را آپدیت میکنیم
    if (typeof PerformanceStore !== 'undefined') {
      PerformanceStore.setSongDocument({ lines: [{ id: 'd1', text: 'تست مستقیم از دیباگ', chords: [{ name: 'G', charIndex: 0 }] }] });
      L('songDocument تست ست شد — باید به گوشی برسد', 'ok');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(run, 2500);
  });
  // اگر DOM قبلاً لود شده
  if (document.readyState !== 'loading') setTimeout(run, 2500);
})();
