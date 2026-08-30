/*
 * CorePlayerViewPopupBuilderService
 *
 * Builds the Player View popup document for a full lyric/chord rebuild.
 */
(function attachCorePlayerViewPopupBuilderService(globalScope) {
  'use strict';

  function create({
    popup = null,
    getPopup = () => popup,
    popupWindowBridge,
    chordRenderer,
    settingsRuntime,
    applyHighlightClassToPopup
  } = {}) {
    function render({
      documentRef,
      title,
      sub,
      lines,
      styles,
      chords
    }) {
      const { tSize, tColor, tFont, tBold, align, cSize, cColor, cFont } = styles;
      documentRef.title = title + ' — ' + (sub.split('  ·  ')[0] || '') + ' | نوازنده';
      documentRef.documentElement.dir = 'rtl';
      documentRef.documentElement.lang = 'fa';
      documentRef.head.innerHTML = `
        <style>
          @font-face { font-family: 'Vazirmatn'; src: url('../fonts/Vazirmatn-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'Vazirmatn Bold'; src: url('../fonts/Vazirmatn-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Thin'; src: url('../fonts/Vazirmatn-Thin.woff2') format('woff2'); }
          @font-face { font-family: 'Vazirmatn Black'; src: url('../fonts/Vazirmatn-Black.woff2') format('woff2'); }
          @font-face { font-family: 'BArshia'; src: url('../fonts/BArshia.woff2') format('woff2'); }
          @font-face { font-family: 'BFarnaz'; src: url('../fonts/BFarnaz.woff2') format('woff2'); }
          @font-face { font-family: 'BJadid'; src: url('../fonts/BJadidBd.woff2') format('woff2'); }
          @font-face { font-family: 'BZar'; src: url('../fonts/BZar.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'BZar Bold'; src: url('../fonts/BZarBd.woff2') format('woff2'); }
          @font-face { font-family: 'Lalezar'; src: url('../fonts/Lalezar-Regular.woff2') format('woff2'); }
          @font-face { font-family: 'Mada'; src: url('../fonts/Mada-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'Rubik'; src: url('../fonts/Rubik-Bold.woff2') format('woff2'); }
          @font-face { font-family: 'JetBrains Mono'; src: url('../fonts/JetBrainsMono-Regular.woff2') format('woff2'); font-weight: normal; }
          @font-face { font-family: 'JetBrains Mono Bold'; src: url('../fonts/JetBrainsMono-Bold.woff2') format('woff2'); }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0F131E; color: #E2E8F0; font-family: 'Vazirmatn', sans-serif; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
          .popup-header { text-align: center; padding: 16px 20px 10px; background: linear-gradient(180deg, #1C2333, #161B26); border-bottom: 1px solid #232B3E; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
          .popup-header .title { font-size: 20px; font-weight: 900; color: #00F2FE; text-shadow: 0 0 20px rgba(0,242,254,0.3); }
          .popup-header .sub { font-size: 12px; color: #718096; margin-top: 3px; }
          .popup-body { flex: 1; overflow: auto; padding: 30px 40px; position: relative; }
          .eline { min-height: 1.4em; line-height: 2.6; white-space: pre-wrap; }
          .popup-sync-line { position: relative; margin-top: 1.8em; padding: 4px 12px; border-bottom: none !important; transition: opacity 1.2s cubic-bezier(0.22, 0.61, 0.36, 1), color 1.2s cubic-bezier(0.22, 0.61, 0.36, 1), background 1.2s cubic-bezier(0.22, 0.61, 0.36, 1), text-shadow 1.2s cubic-bezier(0.22, 0.61, 0.36, 1); }
          .popup-sync-line::before { content: ''; position: absolute; left: 0; right: 0; top: -0.7em; bottom: 0.4em; opacity: 0; border-radius: 8px; pointer-events: none; z-index: -1; transition: opacity 1.2s cubic-bezier(0.22, 0.61, 0.36, 1), background 1.2s cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 1.2s cubic-bezier(0.22, 0.61, 0.36, 1); }
          .popup-sync-line.active { border-radius: 8px; z-index: 10; }
          .popup-sync-line.active::before { opacity: 1; }
          .popup-sync-line.done { opacity: 0.58; }
          @keyframes hl-gradient-sweep { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          @keyframes hl-pulse-glow { 0%,100% { box-shadow: 0 0 8px rgba(34,211,100,0.3), inset 0 0 12px rgba(34,211,100,0.05); } 50% { box-shadow: 0 0 20px rgba(34,211,100,0.6), inset 0 0 20px rgba(34,211,100,0.1); } }
          @keyframes hl-text-pulse { 0%,100% { text-shadow: 0 0 6px rgba(34,211,100,0.5), 0 0 12px rgba(34,211,100,0.3); } 50% { text-shadow: 0 0 12px rgba(34,211,100,0.8), 0 0 30px rgba(34,211,100,0.5), 0 0 50px rgba(34,211,100,0.2); } }
          body.hl-neon .popup-sync-line.active { color: #00F2FE !important; text-shadow: 0 0 8px rgba(0,242,254,0.8), 0 0 20px rgba(0,242,254,0.4); }
          body.hl-neon .popup-sync-line.active::before { background: linear-gradient(180deg, rgba(0, 242, 254, 0.2), rgba(0, 242, 254, 0.04) 55%, transparent); border: 1px solid rgba(0, 242, 254, 0.3); box-shadow: 0 0 15px rgba(0, 242, 254, 0.3), 0 0 30px rgba(0, 242, 254, 0.1); }
          body.hl-frost .popup-sync-line.active { }
          body.hl-frost .popup-sync-line.active::before { background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 50%, rgba(200,220,255,0.08) 100%); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 16px rgba(0,0,0,0.3); }
          .popup-sync-line::after { content: ''; position: absolute; left: 0; right: 0; top: -0.7em; bottom: 0.4em; opacity: 0; border-radius: 12px; pointer-events: none; z-index: -1; transition: opacity 1.2s cubic-bezier(0.22, 0.61, 0.36, 1); }
          body.hl-frost .popup-sync-line.active::after { opacity: 1; background: rgba(255,255,255,0.06); backdrop-filter: blur(8px); }
          body.hl-shift .popup-sync-line.active { background: linear-gradient(135deg, #ff2e93, #7b2fff, #00F2FE, #3FB8AF, #ff2e93); background-size: 400% 400%; animation: hl-gradient-sweep 4s ease infinite; -webkit-background-clip: text; -webkit-text-fill-color: transparent !important; background-clip: text; }
          body.hl-shift .popup-sync-line.active::before { background: linear-gradient(135deg, rgba(255,46,147,0.15), rgba(123,47,255,0.15), rgba(0,242,254,0.15)); background-size: 400% 400%; animation: hl-gradient-sweep 4s ease infinite; border-radius: 8px; }
          body.hl-depth .popup-sync-line.active { text-shadow: 0 1px 0 rgba(0,0,0,0.8), 0 2px 0 rgba(0,0,0,0.7), 0 3px 0 rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.5), 0 0 15px rgba(255,46,147,0.3); }
          body.hl-depth .popup-sync-line.active::before { background: linear-gradient(180deg, rgba(255, 46, 147, 0.15), rgba(255, 46, 147, 0.02) 60%, transparent); border: 1px solid rgba(255, 46, 147, 0.2); box-shadow: 0 6px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(255,46,147,0.2); }
          body.hl-pulse .popup-sync-line.active { color: #22D364 !important; animation: hl-text-pulse 2s ease-in-out infinite; }
          body.hl-pulse .popup-sync-line.active::before { background: linear-gradient(180deg, rgba(34, 211, 100, 0.12), rgba(34, 211, 100, 0.02) 55%, transparent); border: 1px solid rgba(34, 211, 100, 0.25); border-radius: 10px; animation: hl-pulse-glow 2s ease-in-out infinite; }
          .p-chord { position: absolute; pointer-events: none; font-weight: bold; color: ${cColor}; font-family: '${cFont}', monospace; font-size: ${cSize}px; line-height: 1.15; box-sizing: border-box; background: transparent; border-radius: 4px; padding: 0 2px; direction: ltr; white-space: nowrap; z-index: 30 !important; }
          .p-chord-line { position: absolute; width: 2px; pointer-events: none; opacity: .5; background: ${cColor}; z-index: 29 !important; }
          #pv-settings-toggle { transition: color 0.2s, transform 0.2s; }
          #pv-settings-toggle:hover { color: #00F2FE; transform: scale(1.05); }
          #pv-settings { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
          #pv-settings select { transition: border-color 0.2s, box-shadow 0.2s; }
          #pv-settings select:hover, #pv-settings select:focus { border-color: #00F2FE; box-shadow: 0 0 0 2px rgba(0,242,254,0.15); outline: none; }
          #pv-settings input[type="range"] { transition: filter 0.2s; }
          #pv-settings input[type="range"]:hover { filter: brightness(1.3); }
          #pv-settings label:hover { background: rgba(255,255,255,0.04); }
          .pv-hint { font-size: 10px; color: #4A5568; margin-top: 8px; text-align: center; letter-spacing: 0.3px; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #1A202C; }
          ::-webkit-scrollbar-thumb { background: #4A5568; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #718096; }
        </style>`;
      let html = `<div class="popup-header"><div class="title">${title}</div><div class="sub">${sub}</div>
        <div id="pv-settings-toggle" style="cursor:pointer;font-size:11px;color:#718096;margin-top:4px;user-select:none;transition:color 0.2s;">⚙ تنظیمات نمایش</div>
        <div id="pv-settings" style="display:none;text-align:right;padding:12px 14px;font-size:12px;margin-top:8px;background:linear-gradient(135deg,#1A202C,#161B26);border:1px solid #2D3748;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:center;">
            <label style="color:#A0AEC0;display:flex;align-items:center;gap:5px;">فونت:
              <select id="pv-font"><option value="Vazirmatn">Vazirmatn</option><option value="Vazirmatn Thin">Vazirmatn Thin</option><option value="Vazirmatn Bold">Vazirmatn Bold</option><option value="Vazirmatn Black">Vazirmatn Black</option><option value="BArshia">BArshia</option><option value="BFarnaz">BFarnaz</option><option value="BJadid">BJadid</option><option value="BZar">BZar</option><option value="BZar Bold">BZar Bold</option><option value="Lalezar">Lalezar</option></select>
            </label>
            <label><input type="color" id="pv-tColor" value="${tColor}"> متن</label>
            <label><input type="color" id="pv-cColor" value="${cColor}"> آکورد</label>
            <label><input type="color" id="pv-bgColor" value="#0F131E"> پس‌زمینه</label>
            <div>متن: <input type="range" id="pv-tSize" min="12" max="55" value="${tSize}"> <span id="pv-tSizeVal">${tSize}</span></div>
            <div>آکورد: <input type="range" id="pv-cSize" min="8" max="40" value="${cSize}"> <span id="pv-cSizeVal">${cSize}</span></div>
            <label><input type="checkbox" id="pv-scaleLock" checked> 🔗 قفل</label>
            <label><input type="checkbox" id="pv-bold"> <b>B</b> ضخیم</label>
          </div>
          <div class="pv-hint">Ctrl+Wheel: تغییر اندازه متن | Wheel روی آکورد: تغییر اندازه آکورد | Wheel روی فونت: پیمایش فونت‌ها</div>
        </div>
      </div><div class="popup-body" id="popupBody">`;
      lines.forEach((line, index) => {
        html += `<div class="eline popup-sync-line" data-li="${index}" style="font-size:${tSize}px;color:${tColor};font-family:'${tFont}';font-weight:${tBold};text-align:${align};">${line || '\u200B'}</div>`;
      });
      html += '</div><div id="chordMirrorResize" style="position:fixed;bottom:0;left:0;width:100%;height:94px;z-index:9999;">' +
        '<div id="chordMirrorHandle" style="width:100%;height:4px;cursor:ns-resize;"></div>' +
        '<div id="playerChordMirror" style="width:100%;height:90px;background:#111;overflow:hidden;"></div></div>';
      documentRef.body.innerHTML = html;
      documentRef.body.setAttribute('data-popup-role', 'player');
      const popupBody = documentRef.getElementById?.('popupBody');
      if (popupBody) popupBody.scrollTop = 0;
      applyHighlightClassToPopup?.();
      const script = chordRenderer?.createScript?.(
        documentRef,
        chords,
        { cSize, cColor, cFont }
      );
      if (!script) throw new Error('Player View chord renderer unavailable.');
      documentRef.body.appendChild(script);
      const saved = settingsRuntime?.getSettings?.() || {};
      popupWindowBridge?.set?.(getPopup?.() || popup, '_pCfg', {
        cSize: saved.cSize || cSize,
        cColor: saved.cColor || cColor,
        cFont: 'JetBrains Mono'
      });
      settingsRuntime?.initialize?.();
    }

    return Object.freeze({ render });
  }

  const service = Object.freeze({ create });
  globalScope.CorePlayerViewPopupBuilderService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
