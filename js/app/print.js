// ==========================================
// PART: Print Song (چاپ دقیق با آکوردها)
// ==========================================
/**
 * printSong — چاپ ترانه با آکوردها دقیقاً در همان جایگاه ادیتور
 *
 * روش کار:
 * 1. یک iframe مخفی ساخته می‌شود
 * 2. متن ترانه با همان استایل‌های ادیتور (فونت، اندازه، رنگ، تراز) داخل iframe رندر می‌شود
 * 3. آکوردها با همان الگوریتم موقعیت‌یابی (anchorRectIn) ولی داخل خود iframe
 *    رندر می‌شوند تا مختصات دقیقاً با چاپ هماهنگ باشد
 * 4. iframe.contentWindow.print() فراخوانی می‌شود و iframe بعد از چاپ حذف می‌شود
 */
function printSong() {
  const song = window.EditorRuntimeAdapter?.getSong?.() || null;
  if (!song) { toast('ابتدا یک ترانه باز کنید'); return; }
  if (printSong._active) return;
  printSong._active = true;

  try {
    const editorEl = $('editor');
    const chordLayerEl = $('chordLayer');
    const editorWrapEl = $('editorWrap');
    if (!editorEl || !chordLayerEl || !editorWrapEl) {
      toast('خطا در دسترسی به ادیتور');
      printSong._active = false;
      return;
    }

    // ─── ساخت کانتینر چاپ ───
    let pc = document.getElementById('printContainer');
    if (!pc) { pc = document.createElement('div'); pc.id = 'printContainer'; document.body.appendChild(pc); }
    pc.innerHTML = '';

    // ─── هدر چاپ ───
    const st = song.styles || {};
    const hdr = document.createElement('div'); hdr.className = 'print-header';
    const ttl = document.createElement('div'); ttl.className = 'title';
    const sub = document.createElement('div'); sub.className = 'sub';
    const dk = song.key || song.originalKey || 'C';
    const ks = dk + (song.keyMode === 'min' ? 'm' : '');
    const sp = [];
    if (song.artist) sp.push(song.artist);
    if (song.key) sp.push((currentLang === 'fa' ? 'گام: ' : 'Key: ') + ks);
    if (song.transpose) sp.push((currentLang === 'fa' ? 'ترنسپوز ' : 'Transpose ') + (song.transpose > 0 ? '+' : '') + song.transpose);
    ttl.textContent = song.title || t('untitled');
    sub.textContent = sp.join('  •  ');
    hdr.appendChild(ttl); hdr.appendChild(sub);
    pc.appendChild(hdr);

    // ─── کلون محتوای ادیتور (متن + لایه آکورد) ───
    const wrap = document.createElement('div'); wrap.id = 'printWrap';
    const wrapW = editorWrapEl.offsetWidth;

    // کلون متن
    const lyrics = editorEl.cloneNode(true);
    lyrics.id = 'lyricContent';
    lyrics.removeAttribute('contenteditable');
    lyrics.removeAttribute('spellcheck');
    const tSize = st.tSize || 23;
    lyrics.style.cssText = 'white-space:pre-wrap;word-break:break-word;line-height:2.3;padding-top:0;' +
      'font-size:' + tSize + 'px;' +
      'color:' + (st.tColor || '#0fa966') + ';' +
      'font-family:' + (st.tFont || 'Vazirmatn') + ';' +
      'font-weight:' + (st.tBold ? 'bold' : 'normal') + ';' +
      'text-align:' + (st.align || 'center') + ';';
    lyrics.style.unicodeBidi = 'plaintext';
    // اعمال رنگ خطوط
    const lc = song.lineColors || [];
    Array.from(lyrics.children).forEach(function(c, i) {
      if (lc[i]) c.style.color = lc[i];
    });

    const cSize = st.cSize || 23;
    const GAP = Math.max(10, cSize * 0.6);
    const chordPadTop = cSize + GAP;

    wrap.style.cssText = 'position:relative;overflow:visible!important;width:' + wrapW + 'px;padding-top:' + chordPadTop + 'px;';
    wrap.appendChild(lyrics);
    pc.appendChild(wrap);

    // ایجاد لایه آکوردها تازه با محاسبه موقعیت از روی متن کلون‌شده (بدون offset اسکرول)
    const chordOverlay = document.createElement('div');
    chordOverlay.id = 'chordOverlay';
    chordOverlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:10;overflow:visible!important;';
    wrap.appendChild(chordOverlay); // باید قبل از ساخت آکوردها در DOM باشد تا offsetWidth کار کند

    const cColor = st.cColor || '#e6aa28';
    const isRTL = window.getComputedStyle(lyrics).direction === 'rtl';
    const MARGIN = 5;
    const wrapRect = wrap.getBoundingClientRect();

    (song.chords || []).forEach(function(ch, idx) {
      if (!ch.name) return;
      const lineEl = lyrics.children[ch.lineIndex];
      if (!lineEl) return;

      try {
      // یافتن موقعیت کاراکتر با Range API (همان الگوریتم anchorRectIn)
      const segs = [];
      let total = 0, node;
      const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
      while (node = walker.nextNode()) { segs.push({ node: node, start: total, len: node.textContent.length }); total += node.textContent.length; }
      if (!segs.length) return;
      const len = total;
      const r = document.createRange();
      if (ch.anchorType === 'LineStart') { var s0 = segs[0]; r.setStart(s0.node, 0); r.setEnd(s0.node, Math.min(1, s0.len)); }
      else if (ch.anchorType === 'LineEnd') { var sl = segs[segs.length - 1]; var p = Math.max(0, sl.len - 1); r.setStart(sl.node, p); r.setEnd(sl.node, Math.min(p + 1, sl.len)); }
      else { var i = Math.min(ch.charIndex, Math.max(0, len - 1)); var sg = segs.find(function(x) { return i >= x.start && i < x.start + x.len; }) || segs[segs.length - 1]; var loc = Math.max(0, i - sg.start); r.setStart(sg.node, Math.min(loc, sg.len)); r.setEnd(sg.node, Math.min(loc + 1, sg.len)); }

      var rect = r.getBoundingClientRect();

      var el = document.createElement('span');
      el.className = 'chord';
      el.textContent = ch.name;
      el.style.cssText = 'font-size:' + cSize + 'px;color:' + (ch.color || cColor) + ';font-family:' + (st.cFont || 'JetBrains Mono') + ';position:absolute;font-weight:700;white-space:nowrap;';

      var x;
      if (ch.anchorType === 'LineStart') { x = isRTL ? rect.right + MARGIN : rect.left - MARGIN; }
      else if (ch.anchorType === 'LineEnd') { x = isRTL ? rect.left - MARGIN : rect.right + MARGIN; }
      else if (ch.anchorType === 'BetweenCharacters') { x = rect.right; }
      else { x = (rect.left + rect.right) / 2; }

      chordOverlay.appendChild(el);

      var top = rect.top - wrapRect.top - cSize - GAP;
      el.style.top = top + 'px';
      el.style.left = (x - wrapRect.left - el.offsetWidth / 2) + 'px';

      var line = document.createElement('div');
      line.className = 'chord-anchor-line';
      line.style.cssText = 'background:' + (ch.color || cColor) + ';opacity:.6;position:absolute;left:' + (x - wrapRect.left) + 'px;top:' + (top + cSize) + 'px;height:' + Math.max(4, GAP) + 'px;';
      chordOverlay.appendChild(line);

      } catch (chErr) {
        console.error('[Print] Error building chord idx=' + idx + ' name=' + (ch.name || '?') + ' lineIndex=' + ch.lineIndex + ' charIndex=' + ch.charIndex + ' anchorType=' + ch.anchorType, chErr);
      }
    });

    // ─── چاپ ───
    const doPrint = function() {
      try {
        if (isElectron && window.electronAPI && window.electronAPI.printHtml) {
          const safeTitle = (song.title || t('untitled')).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const html = '<!DOCTYPE html>\n<html dir="rtl" lang="fa">\n<head>\n<meta charset="UTF-8">\n<title>' + safeTitle + '</title>\n<style>\n'
            + '*{box-sizing:border-box;margin:0;padding:0;}\n'
            + 'body{font-family:\'Vazirmatn\',\'Tahoma\',sans-serif;background:#fff;color:#000;padding:20px;direction:rtl;}\n'
            + '.print-header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #333;}\n'
            + '.print-header .title{font-size:26px;font-weight:900;color:#000;}\n'
            + '.print-header .sub{font-size:13px;color:#555;margin-top:4px;font-weight:400;}\n'
            + '#printWrap{position:relative;overflow:visible!important;}\n'
            + '#lyricContent{white-space:pre-wrap;word-break:break-word;line-height:2.3;}\n'
            + '#chordOverlay{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:10;overflow:visible!important;}\n'
            + '.eline{white-space:pre-wrap;word-break:break-word;margin-bottom:4px;}\n'
            + '.chord,.chord-print{position:absolute;font-weight:700;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact;}\n'
            + '.chord-anchor-line,.chord-print-anchor{position:absolute;opacity:0.4;-webkit-print-color-adjust:exact;print-color-adjust:exact;}\n'
            + '@media print{body{padding:0;}}\n</style>\n</head>\n<body>\n' + pc.innerHTML + '\n</body>\n</html>';
          window.electronAPI.printHtml(html).then(function(res) {
            if (!res || !res.success) { console.error('[Print] Error:', res); toast('خطا در چاپ'); }
          }).catch(function(err) {
            console.error('[Print] Error:', err); toast('خطا در چاپ');
          }).finally(function() {
            if (pc && pc.parentNode) pc.parentNode.removeChild(pc);
            printSong._active = false;
          });
        } else {
          pc.style.cssText = 'position:absolute;top:0;left:0;width:100%;background:#fff;z-index:99999;visibility:visible;';
          window.focus();
          window.print();
          setTimeout(function() {
            if (pc && pc.parentNode) pc.parentNode.removeChild(pc);
            printSong._active = false;
          }, 1000);
        }
      } catch (e) {
        console.error('[Print] Error:', e);
        toast('خطا در چاپ');
        if (pc && pc.parentNode) pc.parentNode.removeChild(pc);
        printSong._active = false;
      }
    };

    // کمی تأخیر برای اطمینان از کلون کامل
    setTimeout(doPrint, 150);

  } catch (e) {
    console.error('[Print] Error building content:', e);
    toast('خطا در آماده‌سازی چاپ');
    const px = document.getElementById('printContainer');
    if (px && px.parentNode) px.parentNode.removeChild(px);
    printSong._active = false;
  }
}

// expose to global scope
window.printSong = printSong;

