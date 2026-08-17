/**
 * TimelinePanelLayoutService
 *
 * Owns timeline docking, floating, moving, resizing and layout persistence.
 */
(function attachTimelinePanelLayoutService(globalScope) {
  'use strict';

  const STORAGE_KEY = 'akordyar.timelineLayout.v2';
  const DEFAULT_LAYOUT = Object.freeze({
    mode: 'docked',
    maximized: false,
    dockHeight: 320,
    headerWidth: 240,
    floating: Object.freeze({
      left: 80,
      top: 80,
      width: 960,
      height: 520
    })
  });

  function toFinite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function clampFloatingRect(rect = {}, viewport = {}) {
    const viewportWidth = Math.max(320, toFinite(viewport.width, 1280));
    const viewportHeight = Math.max(240, toFinite(viewport.height, 720));
    const minWidth = Math.min(620, viewportWidth);
    const minHeight = Math.min(260, viewportHeight);
    const width = clamp(toFinite(rect.width, 960), minWidth, viewportWidth);
    const height = clamp(toFinite(rect.height, 520), minHeight, viewportHeight);
    const left = clamp(toFinite(rect.left, 80), 0, Math.max(0, viewportWidth - width));
    const top = clamp(toFinite(rect.top, 80), 0, Math.max(0, viewportHeight - height));
    return { left, top, width, height };
  }

  function normalizeLayoutState(value = {}, viewport = {}) {
    const mode = value.mode === 'floating' ? 'floating' : 'docked';
    return {
      mode,
      maximized: mode === 'floating' && Boolean(value.maximized),
      dockHeight: clamp(toFinite(value.dockHeight, DEFAULT_LAYOUT.dockHeight), 120, 2000),
      headerWidth: clamp(toFinite(value.headerWidth, DEFAULT_LAYOUT.headerWidth), 140, 520),
      floating: clampFloatingRect(value.floating || DEFAULT_LAYOUT.floating, viewport)
    };
  }

  function create({
    documentRef = typeof document !== 'undefined' ? document : null,
    windowRef = typeof window !== 'undefined' ? window : null,
    storageRef = null,
    getDockHeight = () => DEFAULT_LAYOUT.dockHeight,
    setDockHeight = height => height,
    onViewportChange = () => {}
  } = {}) {
    let initialized = false;
    let state = null;
    let resizeObserver = null;
    let pointerSession = null;
    let persistFrame = 0;
    const listeners = [];
    const elements = {};

    function viewportSize() {
      return {
        width: Math.max(320, toFinite(windowRef?.innerWidth, 1280)),
        height: Math.max(240, toFinite(windowRef?.innerHeight, 720))
      };
    }

    function getStorage() {
      if (storageRef) return storageRef;
      try {
        return windowRef?.localStorage || null;
      } catch (_) {
        return null;
      }
    }

    function readState() {
      let stored = null;
      try {
        stored = JSON.parse(getStorage()?.getItem?.(STORAGE_KEY) || 'null');
      } catch (_) {
        stored = null;
      }
      const fallback = {
        ...DEFAULT_LAYOUT,
        dockHeight: toFinite(getDockHeight(), DEFAULT_LAYOUT.dockHeight)
      };
      return normalizeLayoutState(stored || fallback, viewportSize());
    }

    function writeState() {
      try {
        getStorage()?.setItem?.(STORAGE_KEY, JSON.stringify(state));
      } catch (_) {
        // Layout persistence is best effort.
      }
    }

    function schedulePersist() {
      if (persistFrame) return;
      const requestFrame = windowRef?.requestAnimationFrame?.bind(windowRef);
      if (!requestFrame) {
        writeState();
        return;
      }
      persistFrame = requestFrame(() => {
        persistFrame = 0;
        writeState();
      });
    }

    function resolveElements() {
      elements.app = documentRef?.querySelector?.('.app-container') || null;
      elements.panel = documentRef?.getElementById?.('timelinePanel') || null;
      elements.separator = documentRef?.getElementById?.('timelineSep') || null;
      elements.controls = documentRef?.getElementById?.('timelinePanelLayoutControls') || null;
      elements.dragHandle = documentRef?.getElementById?.('timelinePanelDragHandle') || null;
      elements.floatButton = documentRef?.getElementById?.('timelineFloatBtn') || null;
      elements.maximizeButton = documentRef?.getElementById?.('timelineMaximizeBtn') || null;
      elements.headerResize = documentRef?.getElementById?.('timelineHeaderResize') || null;
      elements.grid = documentRef?.querySelector?.('.timeline-workspace-grid') || null;
      return Boolean(elements.app && elements.panel);
    }

    function listen(target, eventName, handler, options) {
      if (!target?.addEventListener) return;
      target.addEventListener(eventName, handler, options);
      listeners.push({ target, eventName, handler, options });
    }

    function setHeaderWidth(width, { persist = true } = {}) {
      const next = clamp(toFinite(width, DEFAULT_LAYOUT.headerWidth), 140, 520);
      state.headerWidth = next;
      elements.grid?.style?.setProperty('--timeline-header-width', `${next}px`);
      documentRef?.documentElement?.style?.setProperty('--header-w', `${next}px`);
      if (persist) schedulePersist();
      onViewportChange();
      return next;
    }

    function clearFloatingStyles() {
      ['left', 'top', 'width', 'height'].forEach(property => {
        elements.panel.style.removeProperty(property);
      });
    }

    function updateControls() {
      const floating = state.mode === 'floating';
      elements.panel.dataset.timelineMode = state.mode;
      elements.floatButton?.classList?.toggle('active', floating);
      elements.maximizeButton?.classList?.toggle('active', floating && state.maximized);
      elements.floatButton?.setAttribute?.('aria-pressed', String(floating));
      elements.maximizeButton?.setAttribute?.('aria-pressed', String(floating && state.maximized));
      if (elements.floatButton) {
        elements.floatButton.title = floating
          ? 'اتصال دوبارهٔ تایم‌لاین به پایین برنامه'
          : 'جدا کردن تایم‌لاین و تبدیل به پنجرهٔ قابل‌جابه‌جایی';
      }
    }

    function applyDocked({ persist = true } = {}) {
      state.mode = 'docked';
      state.maximized = false;
      elements.app.classList.remove('timeline-is-floating');
      elements.panel.classList.remove('timeline-floating', 'timeline-maximized');
      clearFloatingStyles();
      const appliedHeight = toFinite(setDockHeight(state.dockHeight), state.dockHeight);
      state.dockHeight = appliedHeight;
      setHeaderWidth(state.headerWidth, { persist: false });
      updateControls();
      if (persist) schedulePersist();
      onViewportChange();
    }

    function applyFloating({ persist = true } = {}) {
      state.mode = 'floating';
      state.floating = clampFloatingRect(state.floating, viewportSize());
      elements.app.classList.add('timeline-is-floating');
      elements.panel.classList.add('timeline-floating');
      elements.panel.classList.toggle('timeline-maximized', state.maximized);

      if (state.maximized) {
        elements.panel.style.left = '8px';
        elements.panel.style.top = '8px';
        elements.panel.style.width = 'calc(100vw - 16px)';
        elements.panel.style.height = 'calc(100vh - 16px)';
      } else {
        const rect = state.floating;
        elements.panel.style.left = `${Math.round(rect.left)}px`;
        elements.panel.style.top = `${Math.round(rect.top)}px`;
        elements.panel.style.width = `${Math.round(rect.width)}px`;
        elements.panel.style.height = `${Math.round(rect.height)}px`;
      }

      setHeaderWidth(state.headerWidth, { persist: false });
      updateControls();
      if (persist) schedulePersist();
      onViewportChange();
    }

    function captureFloatingRect() {
      if (state.mode !== 'floating' || state.maximized) return;
      const rect = elements.panel.getBoundingClientRect();
      state.floating = clampFloatingRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }, viewportSize());
      schedulePersist();
    }

    function getDefaultFloatingRect(anchorEvent = null) {
      const viewport = viewportSize();
      const dockedRect = elements.panel.getBoundingClientRect();
      const width = Math.min(viewport.width - 24, Math.max(720, dockedRect.width * 0.82));
      const height = Math.min(viewport.height - 24, Math.max(320, dockedRect.height));
      const ratioX = dockedRect.width > 0 && anchorEvent
        ? clamp((anchorEvent.clientX - dockedRect.left) / dockedRect.width, 0, 1)
        : 0.5;
      return clampFloatingRect({
        left: anchorEvent ? anchorEvent.clientX - width * ratioX : (viewport.width - width) / 2,
        top: anchorEvent ? anchorEvent.clientY - 14 : (viewport.height - height) / 2,
        width,
        height
      }, viewport);
    }

    function floatPanel(anchorEvent = null) {
      if (state.mode !== 'floating') {
        state.floating = getDefaultFloatingRect(anchorEvent);
      }
      state.maximized = false;
      applyFloating();
    }

    function dockPanel() {
      captureFloatingRect();
      applyDocked();
    }

    function toggleFloating() {
      if (state.mode === 'floating') dockPanel();
      else floatPanel();
    }

    function toggleMaximized() {
      if (state.mode !== 'floating') {
        state.floating = getDefaultFloatingRect();
        state.mode = 'floating';
      } else {
        captureFloatingRect();
      }
      state.maximized = !state.maximized;
      applyFloating();
    }

    function resetLayout() {
      state = normalizeLayoutState({
        ...DEFAULT_LAYOUT,
        dockHeight: DEFAULT_LAYOUT.dockHeight,
        headerWidth: DEFAULT_LAYOUT.headerWidth
      }, viewportSize());
      applyDocked();
    }

    function cleanupPointerSession() {
      if (!pointerSession) return;
      const { pointerId, move, end, cancel, captureTarget } = pointerSession;
      windowRef.removeEventListener('pointermove', move, true);
      windowRef.removeEventListener('pointerup', end, true);
      windowRef.removeEventListener('pointercancel', cancel, true);
      try { captureTarget?.releasePointerCapture?.(pointerId); } catch (_) {}
      documentRef.body?.classList?.remove('timeline-layout-dragging');
      pointerSession = null;
    }

    function startPointerSession(event, captureTarget, onMove, onEnd = () => {}) {
      cleanupPointerSession();
      const pointerId = event.pointerId;
      const move = nextEvent => {
        if (nextEvent.pointerId !== pointerId) return;
        onMove(nextEvent);
        nextEvent.preventDefault();
      };
      const finish = nextEvent => {
        if (nextEvent.pointerId !== pointerId) return;
        cleanupPointerSession();
        onEnd(nextEvent);
      };
      const cancel = nextEvent => {
        if (nextEvent.pointerId !== pointerId) return;
        cleanupPointerSession();
      };
      pointerSession = { pointerId, move, end: finish, cancel, captureTarget };
      documentRef.body?.classList?.add('timeline-layout-dragging');
      try { captureTarget?.setPointerCapture?.(pointerId); } catch (_) {}
      windowRef.addEventListener('pointermove', move, { capture: true, passive: false });
      windowRef.addEventListener('pointerup', finish, { capture: true });
      windowRef.addEventListener('pointercancel', cancel, { capture: true });
    }

    function handlePanelDragStart(event) {
      if (event.button !== 0 || event.target.closest('button:not(#timelinePanelDragHandle)')) return;
      event.preventDefault();
      if (state.mode !== 'floating') floatPanel(event);
      if (state.maximized) {
        state.maximized = false;
        state.floating = getDefaultFloatingRect(event);
        applyFloating({ persist: false });
      }

      const rect = elements.panel.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      startPointerSession(event, elements.dragHandle, moveEvent => {
        state.floating = clampFloatingRect({
          ...state.floating,
          left: moveEvent.clientX - offsetX,
          top: moveEvent.clientY - offsetY,
          width: rect.width,
          height: rect.height
        }, viewportSize());
        applyFloating({ persist: false });
      }, () => {
        captureFloatingRect();
        writeState();
      });
    }

    function handleSeparatorDragStart(event) {
      if (event.button !== 0 || state.mode !== 'docked') return;
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      const startHeight = Math.max(120, elements.panel.getBoundingClientRect().height);
      const maximum = Math.max(120, toFinite(windowRef.innerHeight, 720) - 160);
      elements.separator.classList.add('resizing');

      startPointerSession(event, elements.separator, moveEvent => {
        const next = clamp(startHeight + startY - moveEvent.clientY, 120, maximum);
        state.dockHeight = toFinite(setDockHeight(next), next);
        onViewportChange();
      }, () => {
        elements.separator.classList.remove('resizing');
        writeState();
      });
    }

    function handleHeaderResizeStart(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = state.headerWidth;
      elements.headerResize.classList.add('resizing');

      startPointerSession(event, elements.headerResize, moveEvent => {
        setHeaderWidth(startWidth + moveEvent.clientX - startX, { persist: false });
      }, () => {
        elements.headerResize.classList.remove('resizing');
        writeState();
      });
    }

    function handleControlClick(event) {
      const control = event.target.closest('[data-timeline-layout-action]');
      if (!control || !elements.controls.contains(control)) return;
      const action = control.dataset.timelineLayoutAction;
      if (action === 'toggle-floating') toggleFloating();
      else if (action === 'toggle-maximize') toggleMaximized();
      else if (action === 'reset-layout') resetLayout();
    }

    function handleWindowResize() {
      if (state.mode === 'floating') {
        if (!state.maximized) {
          state.floating = clampFloatingRect(state.floating, viewportSize());
        }
        applyFloating({ persist: false });
      } else {
        state.dockHeight = toFinite(setDockHeight(state.dockHeight), state.dockHeight);
      }
      schedulePersist();
      onViewportChange();
    }

    function init() {
      if (initialized || !resolveElements()) return api;
      initialized = true;
      state = readState();

      listen(elements.controls, 'click', handleControlClick);
      listen(elements.dragHandle, 'pointerdown', handlePanelDragStart, { passive: false });
      listen(elements.dragHandle, 'dblclick', event => {
        event.preventDefault();
        toggleMaximized();
      });
      listen(elements.separator, 'pointerdown', handleSeparatorDragStart, { passive: false });
      listen(elements.headerResize, 'pointerdown', handleHeaderResizeStart, { passive: false });
      listen(windowRef, 'resize', handleWindowResize, { passive: true });

      if (typeof globalScope.ResizeObserver === 'function') {
        resizeObserver = new globalScope.ResizeObserver(() => {
          if (state.mode === 'floating' && !state.maximized && !pointerSession) {
            captureFloatingRect();
          }
          onViewportChange();
        });
        resizeObserver.observe(elements.panel);
      }

      if (state.mode === 'floating') applyFloating({ persist: false });
      else applyDocked({ persist: false });
      writeState();
      return api;
    }

    function destroy() {
      cleanupPointerSession();
      listeners.splice(0).forEach(({ target, eventName, handler, options }) => {
        target.removeEventListener(eventName, handler, options);
      });
      resizeObserver?.disconnect?.();
      resizeObserver = null;
      if (persistFrame && windowRef?.cancelAnimationFrame) {
        windowRef.cancelAnimationFrame(persistFrame);
      }
      persistFrame = 0;
      initialized = false;
    }

    const api = Object.freeze({
      init,
      destroy,
      dock: dockPanel,
      float: floatPanel,
      toggleFloating,
      toggleMaximized,
      reset: resetLayout,
      getState: () => ({
        ...state,
        floating: { ...state.floating }
      })
    });
    return api;
  }

  const service = Object.freeze({
    create,
    clampFloatingRect,
    normalizeLayoutState,
    DEFAULT_LAYOUT
  });
  globalScope.TimelinePanelLayoutService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
