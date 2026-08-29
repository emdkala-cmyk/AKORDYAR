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

  const AUTO_SCROLL_SAFE_ZONE = Object.freeze({
    top: 0.35,
    bottom: 0.65
  });
  const AUTO_SCROLL_DURATION_MS = 1200;
  // Start the visual emphasis slightly before the cue so the 1.2s CSS
  // transition reaches the beat without changing the stored sync point.
  const HIGHLIGHT_LEAD_SECONDS = 0.18;

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
    getTransportVisualPlayhead = getTransportPlayhead,
    getHighlightState = () =>
      globalScope.RuntimeStateAdapter?.getPerformanceStore?.()
        ?.getState?.().highlightState || null,
    installPopupHighlightLoop = () => {},
    schedule = (...args) => globalScope.setTimeout?.(...args),
    requestAnimationFrameRef =
      typeof windowRef?.requestAnimationFrame === 'function'
        ? callback => windowRef.requestAnimationFrame(callback)
        : null,
    cancelAnimationFrameRef =
      typeof windowRef?.cancelAnimationFrame === 'function'
        ? handle => windowRef.cancelAnimationFrame(handle)
        : null,
    nowRef = () => {
      const value = Number(windowRef?.performance?.now?.());
      return Number.isFinite(value) ? value : Date.now();
    },
    EventCtor = globalScope.Event
  } = {}) {
    let settings = { ...DEFAULTS };
    let lastScrolledIndex = -999;
    let lastHighlightKey = null;
    let initialLayoutPasses = 2;
    let scrollAnimationFrame = null;
    let scrollAnimationToken = 0;
    try {
      const saved = JSON.parse(storage?.getItem?.(storageKey) || 'null');
      if (saved && typeof saved === 'object') settings = { ...settings, ...saved };
    } catch (_) {}

    function save() {
      try {
        storage?.setItem?.(storageKey, JSON.stringify(settings));
      } catch (_) {}
    }

    function cancelScrollAnimation() {
      scrollAnimationToken++;
      if (scrollAnimationFrame !== null) {
        cancelAnimationFrameRef?.(scrollAnimationFrame);
        scrollAnimationFrame = null;
      }
    }

    function setScrollPosition(body, top, behavior = 'auto') {
      try {
        if (typeof body.scrollTo === 'function') {
          body.scrollTo({ top, behavior });
        } else {
          body.scrollTop = top;
        }
      } catch (_) {
        body.scrollTop = top;
      }
    }

    function getScrollTarget(body, active) {
      const bodyHeight = Number(body?.clientHeight) || 0;
      const elementTop = Number(active?.offsetTop);
      const elementHeight = Math.max(1, Number(active?.offsetHeight) || 0);
      if (!bodyHeight || !Number.isFinite(elementTop)) return null;

      const targetTop =
        elementTop - bodyHeight / 2 + elementHeight / 2;
      const scrollHeight = Number(body.scrollHeight);
      const maxScrollTop =
        Number.isFinite(scrollHeight) && scrollHeight > bodyHeight
          ? Math.max(0, scrollHeight - bodyHeight)
          : Number.POSITIVE_INFINITY;

      return Math.max(
        0,
        Math.min(maxScrollTop, Math.round(targetTop))
      );
    }

    function animateScroll(body, targetTop) {
      cancelScrollAnimation();
      const currentTop = Number(body.scrollTop) || 0;
      if (Math.abs(currentTop - targetTop) < 1) {
        body.scrollTop = targetTop;
        return;
      }

      // Player View lives in a separate window. Keep the transition under
      // our control when rAF is available and use the browser's smooth
      // scrolling as a safe fallback for lightweight hosts.
      if (typeof requestAnimationFrameRef !== 'function') {
        setScrollPosition(body, targetTop, 'smooth');
        return;
      }

      const token = ++scrollAnimationToken;
      const startedAt = nowRef();
      const step = timestamp => {
        if (token !== scrollAnimationToken) return;
        const currentTime = Number.isFinite(Number(timestamp))
          ? Number(timestamp)
          : nowRef();
        const progress = Math.min(
          1,
          Math.max(0, (currentTime - startedAt) / AUTO_SCROLL_DURATION_MS)
        );
        const eased =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        body.scrollTop = currentTop + (targetTop - currentTop) * eased;
        if (progress >= 1) {
          body.scrollTop = targetTop;
          scrollAnimationFrame = null;
          return;
        }
        scrollAnimationFrame = requestAnimationFrameRef(step);
      };
      scrollAnimationFrame = requestAnimationFrameRef(step);
    }

    function fontFamily(font) {
      return `'${font}', sans-serif`;
    }

    function apply(doc) {
      if (!doc?.body) return;
      lastScrolledIndex = -999;
      lastHighlightKey = null;
      initialLayoutPasses = 2;
      cancelScrollAnimation();
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
      const songState = getSongState?.();
      const times = songState?.getSyncTimes?.() || [];
      const lyricLines =
        typeof songState?.getLyrics === 'function'
          ? String(songState.getLyrics() || '').split('\n')
          : [];
      const daw = getDAW() || {};
      const visualTime = Number(getTransportVisualPlayhead?.());
      const rawTime = Number(getTransportPlayhead?.());
      const transportTime = daw.isPlaying
        ? Number.isFinite(visualTime)
          ? visualTime
          : (Number.isFinite(rawTime) ? rawTime : 0)
        : Number.isFinite(daw.playhead)
          ? daw.playhead
          : 0;
      const playhead = daw.isPlaying
        ? Math.max(0, transportTime + HIGHLIGHT_LEAD_SECONDS)
        : transportTime;
      const activeIndex =
        typeof globalScope.SharedEngine?.resolveActiveLineIndex ===
        'function'
          ? globalScope.SharedEngine.resolveActiveLineIndex(
              times,
              playhead,
              lyricLines
            )
          : (() => {
              let index = -1;
              let activeTime = Number.NEGATIVE_INFINITY;
              times.forEach((value, lineIndex) => {
                const cueTime = Number(value);
                const lyricLine = lyricLines[lineIndex];
                const visibleLine =
                  lyricLines.length === 0 ||
                  !lyricLines.some(line => line.trim().length > 0) ||
                  (
                    lineIndex < lyricLines.length &&
                    typeof lyricLine === 'string' &&
                    lyricLine.trim().length > 0
                  );
                if (
                  Number.isFinite(cueTime) &&
                  cueTime <= playhead &&
                  visibleLine &&
                  cueTime >= activeTime
                ) {
                  index = lineIndex;
                  activeTime = cueTime;
                }
              });
              if (index < 0 && times.some(time => Number.isFinite(time))) {
                index = lyricLines.findIndex(line => line.trim());
                if (index < 0) {
                  index = times.findIndex(time => Number.isFinite(time));
                }
              }
              return index;
            })();
      const highlightKey = `${activeIndex}:${daw.isPlaying ? 1 : 0}`;
      const highlightChanged = highlightKey !== lastHighlightKey;
      if (!highlightChanged && activeIndex === lastScrolledIndex) return;
      if (highlightChanged) {
        lastHighlightKey = highlightKey;
        [...(body.children || [])].forEach(element => {
          if (!element.dataset?.li) return;
          const index = +element.dataset.li;
          const isActive = index === activeIndex;
          const isDone =
            times[index] != null && times[index] < playhead && !isActive;
          element.classList.toggle('active', isActive);
          element.classList.toggle('done', isDone);
          // The popup builder uses inline styles for the user's base color.
          // Clear those properties on the active row so the effect stylesheet
          // can actually render the highlight above the inline declaration.
          element.style.color = isActive ? '' : settings.tColor;
          element.style.textShadow = '';
          element.style.opacity = '';
        });
      }
      if (activeIndex < 0) {
        lastScrolledIndex = -999;
        cancelScrollAnimation();
        return;
      }
      if (initialLayoutPasses > 0) {
        // The first popup call can run before Chromium/Electron paints the
        // document. Keep the classes now and defer geometry/scrolling to the
        // first asynchronous popup frame.
        initialLayoutPasses--;
        return;
      }
      if (activeIndex === lastScrolledIndex) return;
      const active = body.querySelector?.('[data-li="' + activeIndex + '"]');
      if (!active) return;
      const targetTop = getScrollTarget(body, active);
      if (targetTop === null) {
        cancelScrollAnimation();
        return;
      }
      // Electron may expose the popup DOM before its first layout pass.
      // Only mark the line as handled after its position is measurable.
      lastScrolledIndex = activeIndex;
      animateScroll(body, targetTop);
    }

    function initialize() {
      const popup = getPopup();
      const doc = popupDocument(popup);
      if (!doc) return;
      lastScrolledIndex = -999;
      lastHighlightKey = null;
      initialLayoutPasses = 2;
      cancelScrollAnimation();
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
