/*
 * CorePlayerViewPopupSyncService
 *
 * Updates an already-open Player View popup without rebuilding its document.
 */
(function attachCorePlayerViewPopupSyncService(globalScope) {
  'use strict';

  function create({
    popup,
    documentRef,
    popupWindowBridge,
    getSnapshot,
    transposeChord,
    getSettings,
    isPopupOpen = value => Boolean(value && !value.closed),
    schedule = (...args) => globalScope.setTimeout?.(...args),
    EventCtor = globalScope.Event
  } = {}) {
    function renderFallback(reason, delay) {
      schedule(() => {
        try {
          if (!isPopupOpen(popup)) return;
          const scheduled = popupWindowBridge?.call?.(
            popup,
            '_pScheduleChordRender',
            reason
          );
          if (!scheduled) popupWindowBridge?.call?.(popup, '_pRenderChords');
        } catch (_) {}
      }, delay);
    }

    function syncExistingPopup() {
      const popupDocument =
        typeof documentRef === 'function' ? documentRef() : documentRef;
      if (!popupDocument?.querySelector?.('script[data-pv="chord"]')) {
        return false;
      }
      const body = popupDocument.getElementById?.('popupBody');
      if (!body) return true;
      const snapshot = getSnapshot?.();
      if (!snapshot) return true;
      const lines = snapshot.lyrics.split('\n');
      const chords = snapshot.chords.map(ch => ({
        lineIndex: ch.lineIndex,
        charIndex: ch.charIndex,
        anchorType: ch.anchorType,
        _name: transposeChord(ch.name, snapshot.transpose)
      }));
      const { tSize, tColor, tFont, tBold, align } = snapshot.styles;
      const existingLines = Array.from(
        body.querySelectorAll('.popup-sync-line')
      );
      let structureChanged = existingLines.length !== lines.length;
      if (!structureChanged) {
        for (let i = 0; i < lines.length; i++) {
          if (
            !existingLines[i] ||
            existingLines[i].textContent !== (lines[i] || '\u200B')
          ) {
            structureChanged = true;
            break;
          }
        }
      }
      if (structureChanged) {
        body.innerHTML = lines
          .map(
            (line, index) =>
              `<div class="eline popup-sync-line" data-li="${index}">${line || '\u200B'}</div>`
          )
          .join('');
      }

      const lineElements = body.querySelectorAll('.popup-sync-line');
      lineElements.forEach((element, index) => {
        const nextText = lines[index] || '\u200B';
        if (element.textContent !== nextText) element.textContent = nextText;
        element.style.fontSize = tSize + 'px';
        element.style.color = tColor;
        element.style.fontFamily = `'${tFont}', sans-serif`;
        element.style.fontWeight = tBold;
        element.style.textAlign = align;
      });

      try {
        const previousVersion =
          Number(popupWindowBridge?.get?.(popup, '_pStructureVersion')) || 0;
        const nextVersion = previousVersion + (structureChanged ? 1 : 0);
        if (structureChanged) {
          popupWindowBridge?.clearManagedNodes?.(
            popup,
            ['_pChordEls', '_pChordLineEls']
          );
        }
        popupWindowBridge?.set?.(popup, '_pChords', chords);
        popupWindowBridge?.set?.(popup, '_pStructureVersion', nextVersion);
        const reason = structureChanged ? 'structure' : 'data';
        const scheduled = popupWindowBridge?.call?.(
          popup,
          '_pScheduleChordRender',
          reason
        );
        if (!scheduled) popupWindowBridge?.call?.(popup, '_pRenderChords');
        if (structureChanged) {
          [120, 300, 600].forEach(delay =>
            renderFallback('structure', delay)
          );
        }
      } catch (_) {
        renderFallback('data', 250);
      }

      try {
        const settings = getSettings?.() || {};
        lineElements.forEach(element => {
          element.style.fontSize = (settings.tSize || tSize) + 'px';
          element.style.color = settings.tColor || tColor;
          element.style.fontWeight = settings.bold ? 'bold' : tBold;
          element.style.fontFamily =
            "'" + (settings.font || tFont) + "', sans-serif";
        });
        if (settings.cSize || settings.cColor) {
          const config = popupWindowBridge?.get?.(popup, '_pCfg');
          if (config && typeof config === 'object') {
            config.cSize = settings.cSize || 38;
            config.cColor = settings.cColor || '#e6aa28';
            popupWindowBridge?.set?.(popup, '_pCfg', config);
            const scheduled = popupWindowBridge?.call?.(
              popup,
              '_pScheduleChordRender',
              'style'
            );
            if (!scheduled) popupWindowBridge?.call?.(popup, '_pRenderChords');
          }
        }
      } catch (_) {}

      try {
        void body.offsetHeight;
      } catch (_) {}
      popupWindowBridge?.dispatch?.(
        popup,
        EventCtor ? new EventCtor('resize') : { type: 'resize' }
      );
      return true;
    }

    return Object.freeze({ syncExistingPopup });
  }

  const service = Object.freeze({ create });
  globalScope.CorePlayerViewPopupSyncService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
