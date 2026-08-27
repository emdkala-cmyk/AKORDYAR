/*
 * CorePlayerViewChordRendererService
 *
 * Builds the isolated popup-window script responsible for chord positioning.
 */
(function attachCorePlayerViewChordRendererService(globalScope) {
  'use strict';

  function createScript(documentRef, chords, config) {
    const script = documentRef.createElement('script');
    script.setAttribute('data-pv', 'chord');
    script.textContent = `
        var _pChords = ${JSON.stringify(chords)};
        var _pCfg = ${JSON.stringify(config)};
        var _pChordEls = Object.create(null);
        var _pChordLineEls = Object.create(null);
        var _pRenderPending = false;
        var _pRenderReason = 'init';
        var _pStructureVersion = 0;
        var _pLastRenderedSignature = '';
        var _pLastStructureVersion = -1;

        function _pChordKey(ch) {
          return [ch.lineIndex, ch.charIndex, ch.anchorType || ''].join('|');
        }

        function _pAnchorRect(editorEl, ch) {
          var lineEl = editorEl.children[ch.lineIndex]; if (!lineEl) return null;
          var segs = [], total = 0, node;
          var walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
          while (node = walker.nextNode()) { segs.push({ node: node, start: total, len: node.textContent.length }); total += node.textContent.length; }
          if (!segs.length) return null;
          var len = total, r = document.createRange();
          if (ch.anchorType === 'LineStart') { var s = segs[0]; r.setStart(s.node,0); r.setEnd(s.node,Math.min(1,s.len)); }
          else if (ch.anchorType === 'LineEnd') { var s2 = segs[segs.length-1]; var p = Math.max(0,s2.len-1); r.setStart(s2.node,p); r.setEnd(s2.node,Math.min(p+1,s2.len)); }
          else { var ci = Math.min(ch.charIndex, Math.max(0, len-1)); var s3 = null; for (var k=0;k<segs.length;k++) { if (ci >= segs[k].start && ci < segs[k].start+segs[k].len) { s3=segs[k]; break; } } if(!s3) s3=segs[segs.length-1]; var local = Math.max(0, ci-s3.start); r.setStart(s3.node, Math.min(local,s3.len)); r.setEnd(s3.node, Math.min(local+1,s3.len)); }
          return { rect: r.getBoundingClientRect(), lineRect: lineEl.getBoundingClientRect(), type: ch.anchorType };
        }

        function _pChordSignature() {
          return JSON.stringify({
            chords: (_pChords || []).map(function(ch) { return { l: ch.lineIndex, c: ch.charIndex, a: ch.anchorType, n: ch._name }; }),
            cSize: _pCfg.cSize, cColor: _pCfg.cColor, cFont: _pCfg.cFont
          });
        }

        function _pEnsureChordEl(key, pb) {
          var el = _pChordEls[key];
          if (el && el.isConnected) return { el: el, created: false };
          el = document.createElement('span');
          el.className = 'p-chord';
          el.setAttribute('data-chord-key', key);
          el.style.cssText = 'position:absolute;pointer-events:none;font-weight:bold;line-height:1.15;box-sizing:border-box;background:transparent;z-index:5;direction:ltr;white-space:nowrap;visibility:hidden;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;';
          pb.appendChild(el);
          _pChordEls[key] = el;
          return { el: el, created: true };
        }

        function _pEnsureChordLineEl(key, pb) {
          var el = _pChordLineEls[key];
          if (el && el.isConnected) return { el: el, created: false };
          el = document.createElement('div');
          el.className = 'p-chord-line';
          el.setAttribute('data-chordline-key', key);
          el.style.cssText = 'position:absolute;width:2px;pointer-events:none;opacity:.5;z-index:4;visibility:hidden;';
          pb.appendChild(el);
          _pChordLineEls[key] = el;
          return { el: el, created: true };
        }

        function _pCleanupUnused(usedKeys) {
          Object.keys(_pChordEls).forEach(function(key) {
            if (usedKeys[key]) return;
            var el = _pChordEls[key];
            if (el && el.isConnected) el.remove();
            delete _pChordEls[key];
          });
          Object.keys(_pChordLineEls).forEach(function(key) {
            if (usedKeys[key]) return;
            var el = _pChordLineEls[key];
            if (el && el.isConnected) el.remove();
            delete _pChordLineEls[key];
          });
        }

        function _pRenderChords() {
          var pb = document.getElementById('popupBody');
          if (!pb) return;
          var signature = _pChordSignature();
          var structureChanged = _pLastStructureVersion !== _pStructureVersion;
          var contentChanged = _pLastRenderedSignature !== signature;
          if (!structureChanged && !contentChanged && _pRenderReason !== 'resize') return;

          var wrapRect = pb.getBoundingClientRect();
          var scrollTop = pb.scrollTop;
          var GAP = Math.max(10, _pCfg.cSize * 0.6);
          var MARGIN = 5;
          var usedKeys = Object.create(null);

          (_pChords || []).forEach(function(ch) {
            if (!ch || !ch._name) return;
            var a = _pAnchorRect(pb, ch);
            if (!a) return;
            var key = _pChordKey(ch);
            var ensured = _pEnsureChordEl(key, pb);
            var el = ensured.el;
            usedKeys[key] = true;
            if (el.textContent !== ch._name) el.textContent = ch._name;
            var nf = _pCfg.cSize + 'px', nc = _pCfg.cColor, nfa = '"' + _pCfg.cFont + '",monospace';
            if (el.style.fontSize !== nf) el.style.fontSize = nf;
            if (el.style.color !== nc) el.style.color = nc;
            if (el.style.fontFamily !== nfa) el.style.fontFamily = nfa;
            var elW = el.offsetWidth;
            var x;
            if (ch.anchorType === 'LineStart') { x = a.rect.right + MARGIN; }
            else if (ch.anchorType === 'LineEnd') { x = a.rect.left - MARGIN; }
            else { x = (a.rect.left + a.rect.right) / 2; }
            var xLocal = Math.round(x - wrapRect.left);
            var topValue = Math.round(
              a.rect.top - wrapRect.top + scrollTop - _pCfg.cSize - GAP
            );
            var nt = topValue + 'px';
            var nl = Math.round(xLocal - elW / 2) + 'px';
            if (el.style.top !== nt) el.style.top = nt;
            if (el.style.left !== nl) el.style.left = nl;
            if (ensured.created) el.style.visibility = 'visible';

            var lnEnsured = _pEnsureChordLineEl(key, pb);
            var ln = lnEnsured.el;
            var lnX = xLocal + 'px';
            var lnTop = Math.round(topValue + _pCfg.cSize) + 'px';
            var lnH = Math.max(4, GAP) + 'px';
            if (ln.style.left !== lnX) ln.style.left = lnX;
            if (ln.style.top !== lnTop) ln.style.top = lnTop;
            if (ln.style.height !== lnH) ln.style.height = lnH;
            if (ln.style.background !== _pCfg.cColor) ln.style.background = _pCfg.cColor;
            if (lnEnsured.created) ln.style.visibility = 'visible';
          });
          _pCleanupUnused(usedKeys);
          _pLastRenderedSignature = signature;
          _pLastStructureVersion = _pStructureVersion;
          _pRenderReason = 'idle';
        }

        function _pScheduleChordRender(reason) {
          _pRenderReason = reason || _pRenderReason || 'unknown';
          if (_pRenderPending) return;
          _pRenderPending = true;
          requestAnimationFrame(function() { _pRenderPending = false; _pRenderChords(); });
        }

        _pScheduleChordRender('init');
        window.addEventListener('resize', function() { _pScheduleChordRender('resize'); });
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(function() {
            _pScheduleChordRender('fonts');
          }).catch(function() {});
        }

        window._pCfg = _pCfg;
        window._pChords = _pChords;
        window._pRenderChords = _pRenderChords;
        window._pScheduleChordRender = _pScheduleChordRender;
        window._pChordEls = _pChordEls;
        window._pChordLineEls = _pChordLineEls;
      `;
    return script;
  }

  const service = Object.freeze({ createScript });
  globalScope.CorePlayerViewChordRendererService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
