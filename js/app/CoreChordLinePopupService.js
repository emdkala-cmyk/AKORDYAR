/*
 * CoreChordLinePopupService
 *
 * Owns the detachable Chord Line popup renderer and its popup-local controls.
 * The editor song state and popup bridge remain injected so the renderer can
 * run independently from the legacy core module.
 */
(function attachCoreChordLinePopupService(globalScope) {
  'use strict';

  function create({
    getPopup = () => null,
    setPopup = () => {},
    getSongState = () => null,
    isPopupOpen = () => false,
    popupDocument = () => null,
    openPopupWindow = () => null,
    focusPopupWindow = () => {},
    popupWindowBridge = null,
    windowRef = globalScope,
    navigatorRef = globalScope.navigator,
    nodeFilter = globalScope.NodeFilter || { SHOW_TEXT: 4 },
    transposeChord = (name) => name,
    translate = key => key,
    toast = () => {}
  } = {}) {
    function openChordLinePopup() {
      const popup = getPopup();
      if (isPopupOpen(popup)) {
        focusPopupWindow(popup);
        return;
      }
      const nextPopup = openPopupWindow(
        'chordLinePopup',
        'width=650,height=400,menubar=no,toolbar=no,location=no,status=no'
      );
      setPopup(nextPopup);
      if (!nextPopup) {
        toast(translate('popupBlocked'));
        return;
      }
      syncChordLinePopup();
    }

    function syncChordLinePopup() {
      const popup = getPopup();
      if (!isPopupOpen(popup)) return;
      const snapshot = getSongState()?.getPresentationSnapshot?.();
      if (!snapshot) return;
      const doc = popupDocument(popup);
      if (!doc) return;
      const { title, artist, key, keyMode, lyrics, styles } = snapshot;
      const keyStr = key + (keyMode === 'min' ? 'm' : '');
      const { tSize, tColor, tFont, tBold, align, cSize, cColor, cFont } =
        styles;
      const lines = lyrics.split('\n');
      const chordLineClips = snapshot.chordLineClips;
      const transpose = snapshot.transpose;
      const chords = chordLineClips.map(ch => ({
        lineIndex: ch.lineIndex,
        charIndex: ch.charIndex,
        anchorType: ch.anchorType,
        _name: ch.name ? transposeChord(ch.name, transpose) : ''
      }));

      doc.title = title + ' — ' + artist + ' | Chord Line';
      doc.documentElement.dir = 'rtl';
      doc.documentElement.lang = 'fa';
      doc.head.innerHTML = `
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
          .clp-header { text-align: center; padding: 8px 12px 4px; background: linear-gradient(180deg, #1C2333, #161B26); border-bottom: 1px solid #232B3E; }
          .clp-header .title { font-size: 15px; font-weight: 900; color: #00F2FE; }
          .clp-header .sub { font-size: 10px; color: #718096; }
          .clp-controls { display: flex; gap: 8px; padding: 8px 12px; background: #161B26; border-bottom: 1px solid #232B3E; align-items: center; justify-content: center; }
          .clp-btn { background: #232B3E; color: #E2E8F0; border: 1px solid #2D3748; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.15s; }
          .clp-btn:hover { background: #2D3748; border-color: #4A5568; }
          .clp-btn:active { transform: translateY(1px); }
          .clp-btn-primary { background: #0fa966; border-color: #0fa966; color: #fff; }
          .clp-btn-primary:hover { background: #0c8a54; }
          .clp-body { flex: 1; overflow: auto; padding: 16px 20px; position: relative; line-height: 2.4; }
          .clp-body { flex: 1; overflow-y: auto; padding: 16px; }
          .eline { min-height: 1.2em; white-space: pre-wrap; }
          .clp-chord { position: absolute; pointer-events: none; font-weight: bold; color: ${cColor}; font-family: '${cFont}', monospace; font-size: ${cSize}px; direction: ltr; white-space: nowrap; z-index: 5; }
          .clp-chord-line { position: absolute; width: 2px; pointer-events: none; opacity: .4; background: ${cColor}; z-index: 4; }
          .clp-active { color: #FF2E93 !important; text-shadow: 0 0 8px rgba(255,46,147,0.5); }
          .clp-active-bg { background: rgba(255,46,147,0.08); border-radius: 6px; }
        </style>`;
      let html = `<div class="clp-header"><div class="title">${title}</div><div class="sub">${artist} · ${keyStr}</div></div>`;
      const tf = globalScope.t || (k => k);
      html += `<div class="clp-controls">
        <button class="clp-btn clp-btn-primary" id="clpSyncBtn" title="${tf('refresh')}">🔄 ${tf('sync')}</button>
        <button class="clp-btn" id="clpTransDown" title="${tf('flat')}">♭</button>
        <span id="clpTransVal" style="color:#718096;font-size:12px;font-weight:600;min-width:24px;text-align:center;display:inline-block;">${transpose > 0 ? '+' : ''}${transpose}</span>
        <button class="clp-btn" id="clpTransUp" title="${tf('sharp')}">♯</button>
        <button class="clp-btn" id="clpCopyBtn" title="${tf('copy')}">✔ ${tf('copy')}</button>
      </div>`;
      html += `<div class="clp-body" id="clpBody">`;
      lines.forEach((line, i) => {
        html += `<div class="eline" data-li="${i}" style="font-size:${tSize}px;color:${tColor};font-family:'${tFont}';font-weight:${tBold};text-align:${align};">${line || '\u200B'}</div>`;
      });
      html += '</div>';
      doc.body.innerHTML = html;

      const syncBtn = doc.getElementById('clpSyncBtn');
      const transUpBtn = doc.getElementById('clpTransUp');
      const transDownBtn = doc.getElementById('clpTransDown');
      const transValSpan = doc.getElementById('clpTransVal');
      const copyBtn = doc.getElementById('clpCopyBtn');

      if (syncBtn) {
        syncBtn.onclick = () => {
          const songState = getSongState();
          const song = songState?.currentSong?.();
          if (!song) return;
          const lyricsChords = songState.getChords(song);
          if (lyricsChords.length === 0) {
            toast('هیچ آکوردی در Lyrics Chord وجود ندارد.');
            return;
          }
          const lyricsChordsInSyncOrder = [...lyricsChords].sort((a, b) => {
            if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
            return a.charIndex - b.charIndex;
          });
          const currentChordLineClips = songState.getChordLineClips(song);
          if (currentChordLineClips.length === 0) {
            toast('برای همگام‌سازی، ابتدا حداقل یک آکورد در Chord Line ایجاد کنید.');
            return;
          }
          const appliedCount = Math.min(
            lyricsChordsInSyncOrder.length,
            currentChordLineClips.length
          );
          for (let i = 0; i < appliedCount; i++) {
            currentChordLineClips[i].name = lyricsChordsInSyncOrder[i].name;
          }
          songState.setChordLineClips(currentChordLineClips, song);
          songState.markChordLineSynced(song);
          syncChordLinePopup();
          if (lyricsChordsInSyncOrder.length > currentChordLineClips.length) {
            toast(`فقط ${appliedCount} آکورد اول Lyrics روی ${currentChordLineClips.length} آکورد موجود در Chord Line اعمال شد.`);
          } else {
            toast(`✔ Chord Line با موفقیت از Lyrics Chord همگام شد (${appliedCount} آکورد).`);
          }
        };
      }

      if (transUpBtn) {
        transUpBtn.onclick = () => {
          const songState = getSongState();
          if (!songState?.getChordLineClips?.().length) return;
          const newTranspose = songState.getTranspose() + 1;
          songState.setTranspose(newTranspose);
          if (transValSpan) transValSpan.textContent = (newTranspose > 0 ? '+' : '') + newTranspose;
          syncChordLinePopup();
        };
      }

      if (transDownBtn) {
        transDownBtn.onclick = () => {
          const songState = getSongState();
          if (!songState?.getChordLineClips?.().length) return;
          const newTranspose = songState.getTranspose() - 1;
          songState.setTranspose(newTranspose);
          if (transValSpan) transValSpan.textContent = (newTranspose > 0 ? '+' : '') + newTranspose;
          syncChordLinePopup();
        };
      }

      if (copyBtn) {
        copyBtn.onclick = () => {
          const songState = getSongState();
          const clips = songState?.getChordLineClips?.() || [];
          if (clips.length === 0) {
            toast('آکوردی برای کپی وجود ندارد');
            return;
          }
          const currentTranspose = songState.getTranspose();
          const chordNames = clips
            .map(ch => ch.name ? transposeChord(ch.name, currentTranspose) : '')
            .filter(Boolean);
          if (chordNames.length === 0) {
            toast('آکوردی برای کپی وجود ندارد');
            return;
          }
          navigatorRef?.clipboard?.writeText?.(chordNames.join(' ')).then(
            () => toast('✔ ' + chordNames.length + ' آکورد کپی شد'),
            () => toast('خطا در کپی')
          );
        };
      }

      const pb = doc.getElementById('clpBody');
      if (!pb) return;
      const wrapRect = pb.getBoundingClientRect();
      const gap = Math.max(10, cSize * 0.6);
      const margin = 5;
      chords.forEach(ch => {
        if (!ch._name) return;
        const lineEl = pb.children[ch.lineIndex];
        if (!lineEl) return;
        const segs = [];
        let total = 0;
        const walker = doc.createTreeWalker(lineEl, nodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          segs.push({ node, start: total, len: node.textContent.length });
          total += node.textContent.length;
        }
        if (!segs.length) return;
        const range = doc.createRange();
        if (ch.anchorType === 'LineStart') {
          const segment = segs[0];
          range.setStart(segment.node, 0);
          range.setEnd(segment.node, Math.min(1, segment.len));
        } else if (ch.anchorType === 'LineEnd') {
          const segment = segs[segs.length - 1];
          const position = Math.max(0, segment.len - 1);
          range.setStart(segment.node, position);
          range.setEnd(segment.node, Math.min(position + 1, segment.len));
        } else {
          const charIndex = Math.min(ch.charIndex, Math.max(0, total - 1));
          const segment =
            segs.find(item => charIndex >= item.start && charIndex < item.start + item.len) ||
            segs[segs.length - 1];
          const local = Math.max(0, charIndex - segment.start);
          range.setStart(segment.node, Math.min(local, segment.len));
          range.setEnd(segment.node, Math.min(local + 1, segment.len));
        }
        const rect = range.getBoundingClientRect();
        const x = ch.anchorType === 'LineStart'
          ? rect.right + margin
          : ch.anchorType === 'LineEnd'
            ? rect.left - margin
            : (rect.left + rect.right) / 2;
        const top = rect.top - wrapRect.top + pb.scrollTop - cSize - gap;

        const chordElement = doc.createElement('span');
        chordElement.className = 'clp-chord';
        chordElement.textContent = ch._name;
        chordElement.style.top = top + 'px';
        chordElement.style.left =
          x - wrapRect.left - chordElement.offsetWidth / 2 + 'px';
        pb.appendChild(chordElement);

        const lineElement = doc.createElement('div');
        lineElement.className = 'clp-chord-line';
        lineElement.style.left = x - wrapRect.left + 'px';
        lineElement.style.top = top + cSize + 'px';
        lineElement.style.height = Math.max(4, gap) + 'px';
        pb.appendChild(lineElement);
      });

      popupWindowBridge?.onMessage?.({
        windowRef,
        getSource: () => getPopup(),
        type: 'syncUpdate',
        handler: event => {
          const currentPopup = getPopup();
          if (!isPopupOpen(currentPopup)) return;
          const body = popupDocument(currentPopup)?.getElementById('clpBody');
          if (!body) return;
          [...body.children].forEach(element => {
            if (!element.dataset.li) return;
            const lineIndex = +element.dataset.li;
            const active = lineIndex === event.data.activeIdx;
            element.classList.toggle('clp-active', active);
            element.classList.toggle('clp-active-bg', active);
          });
        }
      });
    }

    return Object.freeze({ openChordLinePopup, syncChordLinePopup });
  }

  const service = Object.freeze({ create });
  globalScope.CoreChordLinePopupService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
