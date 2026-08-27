/*
 * CorePlayerViewSettingsService
 *
 * Owns persistent Player View settings, popup controls, wheel gestures and
 * direct lyric highlight synchronization.
 */
(function attachCorePlayerViewSettingsService(globalScope) {
  'use strict';

  const FONT_LIST = Object.freeze([
    'Vazirmatn',
    'Vazirmatn Thin',
    'Vazirmatn Bold',
    'Vazirmatn Black',
    'BArshia',
    'BFarnaz',
    'BJadid',
    'BZar',
    'BZar Bold',
    'Lalezar'
  ]);

  const DEFAULTS = Object.freeze({
    font: 'Vazirmatn',
    tColor: '#0fa966',
    cColor: '#e6aa28',
    hlColor: '#FF2E93',
    bgColor: '#0F131E',
    tSize: 53,
    cSize: 40,
    scaleLock: true,
    bold: true
  });

  function create({
    storage = globalScope.localStorage,
    storageKey = 'achord_player_view_settings',
    getPopup = () => null,
    isPopupOpen = popup => Boolean(popup && !popup.closed),
    popupDocument = popup => popup?.document || null,
    popupWindowBridge = null,
    windowRef = globalScope,
    getSongState = () => null,
    getDAW = () => null,
    getTransportPlayhead = () => 0,
    getHighlightState = () =>
      globalScope.RuntimeStateAdapter?.getPerformanceStore?.()
        ?.getState?.().highlightState || null,
    installPopupHighlightLoop = () => {},
    schedule = (...args) => globalScope.setTimeout?.(...args),
    EventCtor = globalScope.Event
  } = {}) {
    let settings = { ...DEFAULTS };
    let lastScrolledIndex = -999;
    try {
      const saved = JSON.parse(storage?.getItem?.(storageKey) || 'null');
      if (saved && typeof saved === 'object') settings = { ...settings, ...saved };
    } catch (_) {}

    function save() {
      try {
        storage?.setItem?.(storageKey, JSON.stringify(settings));
      } catch (_) {}
    }

    function fontFamily(font) {
      return `'${font}', sans-serif`;
    }

    function apply(doc) {
      if (!doc?.body) return;
      doc.body.style.background = settings.bgColor;
      doc.querySelectorAll?.('.eline').forEach(element => {
        element.style.color = settings.tColor;
        element.style.fontSize = settings.tSize + 'px';
        element.style.fontWeight = settings.bold ? 'bold' : 'normal';
        element.style.fontFamily = fontFamily(settings.font);
      });
      const popup = getPopup();
      const config = popupWindowBridge?.get?.(popup, '_pCfg');
      if (!config || typeof config !== 'object') {
        syncHighlight();
        return;
      }
      config.cSize = settings.cSize;
      config.cColor = settings.cColor;
      config.cFont = 'JetBrains Mono';
      popupWindowBridge?.set?.(popup, '_pCfg', config);
      const scheduled = popupWindowBridge?.call?.(
        popup,
        '_pScheduleChordRender',
        'style'
      );
      if (!scheduled) popupWindowBridge?.call?.(popup, '_pRenderChords');
      syncHighlight();
    }

    function setupWheelHandlers(doc) {
      const popup = getPopup();
      if (!isPopupOpen(popup) || !doc) return;
      const previous = popupWindowBridge?.get?.(popup, '_pvWheelHandler');
      if (previous) doc.removeEventListener?.('wheel', previous);
      const handler = event => {
        if (!isPopupOpen(getPopup())) return;
        const target = event.target;
        if (event.ctrlKey) {
          event.preventDefault();
          settings.tSize = Math.max(
            12,
            Math.min(55, settings.tSize + (event.deltaY < 0 ? 1 : -1))
          );
          if (settings.scaleLock) {
            settings.cSize = Math.max(
              8,
              Math.min(40, Math.round(settings.tSize * 0.7))
            );
          }
          save();
          apply(doc);
          return;
        }
        if (target?.classList?.contains?.('p-chord')) {
          event.preventDefault();
          settings.cSize = Math.max(
            8,
            Math.min(40, settings.cSize + (event.deltaY < 0 ? 1 : -1))
          );
          if (settings.scaleLock) {
            settings.tSize = Math.max(
              12,
              Math.min(55, Math.round(settings.cSize / 0.7))
            );
          }
          save();
          apply(doc);
          return;
        }
        if (target?.id !== 'pv-font') return;
        event.preventDefault();
        let index = FONT_LIST.indexOf(settings.font);
        index =
          event.deltaY < 0
            ? (index - 1 + FONT_LIST.length) % FONT_LIST.length
            : (index + 1) % FONT_LIST.length;
        settings.font = FONT_LIST[index];
        target.value = settings.font;
        save();
        apply(doc);
      };
      popupWindowBridge?.set?.(popup, '_pvWheelHandler', handler);
      doc.addEventListener?.('wheel', handler, { passive: false });
    }

    function syncHighlight() {
      const popup = getPopup();
      if (!isPopupOpen(popup)) return;
      const doc = popupDocument(popup);
      const body = doc?.getElementById?.('popupBody');
      if (!body) return;
      const times = getSongState()?.getSyncTimes?.() || [];
      const daw = getDAW() || {};
      const playhead = daw.isPlaying
        ? getTransportPlayhead()
        : Number.isFinite(daw.playhead)
          ? daw.playhead
          : 0;
      let activeIndex = -1;
      for (let i = 0; i < times.length; i++) {
        if (Number.isFinite(times[i]) && times[i] <= playhead) activeIndex = i;
        else if (Number.isFinite(times[i]) && times[i] > playhead) break;
      }
      const performanceHighlight = getHighlightState?.();
      const storeLineMatch = String(
        performanceHighlight?.activeLineId || ''
      ).match(/^ln(\d+)$/i);
      const storeActiveIndex = storeLineMatch
        ? Number(storeLineMatch[1])
        : -1;
      const storeDoneLines =
        performanceHighlight?.doneLines instanceof Set
          ? performanceHighlight.doneLines
          : Array.isArray(performanceHighlight?.doneLines)
            ? new Set(performanceHighlight.doneLines)
            : null;
      const hasStoreLine =
        Number.isInteger(storeActiveIndex) &&
        storeActiveIndex >= 0 &&
        [...(body.children || [])].some(
          element => Number(element.dataset?.li) === storeActiveIndex
        );
      if (hasStoreLine) {
        activeIndex = storeActiveIndex;
      }
      [...(body.children || [])].forEach(element => {
        if (!element.dataset?.li) return;
        const index = +element.dataset.li;
        const isActive = index === activeIndex;
        const isDone = storeDoneLines
          ? storeDoneLines.has(index) && !isActive
          : times[index] != null && times[index] < playhead && !isActive;
        element.classList.toggle('active', isActive);
        element.classList.toggle('done', isDone);
        // The popup builder uses inline styles for the user's base color.
        // Clear those properties on the active row so the effect stylesheet
        // can actually render the highlight above the inline declaration.
        element.style.color = isActive ? '' : settings.tColor;
        element.style.textShadow = '';
        element.style.opacity = '';
      });
      if (activeIndex < 0) {
        lastScrolledIndex = -999;
        return;
      }
      if (activeIndex === lastScrolledIndex) return;
      lastScrolledIndex = activeIndex;
      const active = body.querySelector?.('[data-li="' + activeIndex + '"]');
      if (active) {
        const top = Math.max(
          0,
          Math.round(
            active.offsetTop -
              body.clientHeight / 2 +
              active.offsetHeight / 2
          )
        );
        try {
          if (typeof body.scrollTo === 'function') {
            body.scrollTo({ top, behavior: 'auto' });
          } else {
            body.scrollTop = top;
          }
        } catch (_) {
          body.scrollTop = top;
        }
      }
    }

    function initialize() {
      const popup = getPopup();
      const doc = popupDocument(popup);
      if (!doc) return;
      const config = popupWindowBridge?.get?.(popup, '_pCfg');
      if (config && typeof config === 'object') {
        config.cSize = settings.cSize;
        config.cColor = settings.cColor;
        popupWindowBridge?.set?.(popup, '_pCfg', config);
      }
      const panel = doc.getElementById?.('pv-settings');
      const toggle = doc.getElementById?.('pv-settings-toggle');
      if (toggle && panel) {
        toggle.onclick = event => {
          event.stopPropagation();
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        };
        doc.body?.addEventListener?.('click', event => {
          if (!panel.contains?.(event.target) && event.target !== toggle) {
            panel.style.display = 'none';
          }
        });
      }
      const updateSizeLabels = () => {
        const textValue = doc.getElementById?.('pv-tSizeVal');
        const chordValue = doc.getElementById?.('pv-cSizeVal');
        if (textValue) textValue.textContent = settings.tSize;
        if (chordValue) chordValue.textContent = settings.cSize;
      };
      const bind = (id, eventName, handler) => {
        const element = doc.getElementById?.(id);
        if (!element) return;
        handler(element);
        element[eventName] = () => {
          handler(element, true);
          updateSizeLabels();
          save();
          apply(doc);
        };
      };
      bind('pv-font', 'onchange', (element, changed) => {
        if (changed) settings.font = element.value;
        else element.value = settings.font;
      });
      bind('pv-tColor', 'oninput', (element, changed) => {
        if (changed) settings.tColor = element.value;
        else element.value = settings.tColor;
      });
      bind('pv-cColor', 'oninput', (element, changed) => {
        if (changed) settings.cColor = element.value;
        else element.value = settings.cColor;
      });
      bind('pv-bgColor', 'oninput', (element, changed) => {
        if (changed) settings.bgColor = element.value;
        else element.value = settings.bgColor;
      });
      bind('pv-tSize', 'oninput', (element, changed) => {
        if (changed) {
          settings.tSize = +element.value;
          if (settings.scaleLock) settings.cSize = Math.round(settings.tSize * 0.7);
        } else element.value = settings.tSize;
      });
      bind('pv-cSize', 'oninput', (element, changed) => {
        if (changed) {
          settings.cSize = +element.value;
          if (settings.scaleLock) settings.tSize = Math.round(settings.cSize / 0.7);
        } else element.value = settings.cSize;
      });
      bind('pv-scaleLock', 'onchange', (element, changed) => {
        if (changed) settings.scaleLock = element.checked;
        else element.checked = settings.scaleLock;
      });
      bind('pv-bold', 'onchange', (element, changed) => {
        if (changed) settings.bold = element.checked;
        else element.checked = settings.bold;
      });
      apply(doc);
      updateSizeLabels();
      setupWheelHandlers(doc);
      popupWindowBridge?.set?.(popup, '_syncHighlight', syncHighlight);
      installPopupHighlightLoop(popup, doc);
      const handle = doc.getElementById?.('chordMirrorHandle');
      const wrapper = doc.getElementById?.('chordMirrorResize');
      const mirror = doc.getElementById?.('playerChordMirror');
      if (handle && wrapper && mirror) {
        let dragging = false;
        let startY = 0;
        let startHeight = 0;
        handle.addEventListener?.('mousedown', event => {
          event.preventDefault?.();
          dragging = true;
          startY = event.clientY;
          startHeight = wrapper.offsetHeight;
          if (doc.body) {
            doc.body.style.cursor = 'ns-resize';
            doc.body.style.userSelect = 'none';
          }
        });
        doc.addEventListener?.('mousemove', event => {
          if (!dragging) return;
          const height = Math.max(
            40,
            Math.min(300, startHeight + (startY - event.clientY))
          );
          wrapper.style.height = height + 'px';
          mirror.style.height = height - 4 + 'px';
        });
        doc.addEventListener?.('mouseup', () => {
          if (!dragging) return;
          dragging = false;
          if (doc.body) {
            doc.body.style.cursor = '';
            doc.body.style.userSelect = '';
          }
        });
      }
      [200, 500, 1000].forEach(delay => {
        schedule(() => {
          if (isPopupOpen(getPopup())) {
            popupWindowBridge?.call?.(getPopup(), '_pRenderChords');
          }
        }, delay);
      });
      try {
        const body = popupDocument(getPopup())?.getElementById?.('popupBody');
        if (body) void body.offsetHeight;
        if (EventCtor) popupWindowBridge?.dispatch?.(getPopup(), new EventCtor('resize'));
      } catch (_) {}
    }

    return Object.freeze({
      getSettings: () => ({ ...settings }),
      save,
      apply,
      setupWheelHandlers,
      syncHighlight,
      initialize,
      fontFamily
    });
  }

  const service = Object.freeze({ create });
  globalScope.CorePlayerViewSettingsService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
