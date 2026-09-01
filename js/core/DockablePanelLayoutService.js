/**
 * DockablePanelLayoutService
 *
 * Shared floating/moving/resizing behavior for the Project and Song
 * Properties side panels.
 */
(function attachDockablePanelLayoutService(globalScope) {
  'use strict';

  const DEFAULT_LAYOUT = Object.freeze({
    mode: 'docked',
    maximized: false,
    closed: false,
    floating: Object.freeze({
      left: 80,
      top: 80,
      width: 360,
      height: 560
    })
  });

  function toFinite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function clampFloatingRect(rect = {}, viewport = {}, options = {}) {
    const viewportWidth = Math.max(320, toFinite(viewport.width, 1280));
    const viewportHeight = Math.max(240, toFinite(viewport.height, 720));
    const minWidth = Math.min(
      viewportWidth,
      Math.max(240, toFinite(options.minWidth, 280))
    );
    const minHeight = Math.min(
      viewportHeight,
      Math.max(200, toFinite(options.minHeight, 240))
    );
    const width = clamp(
      toFinite(rect.width, DEFAULT_LAYOUT.floating.width),
      minWidth,
      viewportWidth
    );
    const height = clamp(
      toFinite(rect.height, DEFAULT_LAYOUT.floating.height),
      minHeight,
      viewportHeight
    );
    const left = clamp(
      toFinite(rect.left, DEFAULT_LAYOUT.floating.left),
      0,
      Math.max(0, viewportWidth - width)
    );
    const top = clamp(
      toFinite(rect.top, DEFAULT_LAYOUT.floating.top),
      0,
      Math.max(0, viewportHeight - height)
    );
    return { left, top, width, height };
  }

  function normalizeLayoutState(value = {}, viewport = {}, options = {}) {
    const defaults = options.defaultFloating || DEFAULT_LAYOUT.floating;
    const mode = value.mode === 'floating' ? 'floating' : 'docked';
    return {
      mode,
      maximized: mode === 'floating' && Boolean(value.maximized),
      closed: Boolean(value.closed),
      floating: clampFloatingRect(
        value.floating || defaults,
        viewport,
        options
      )
    };
  }

  function create({
    documentRef = typeof document !== 'undefined' ? document : null,
    windowRef = typeof window !== 'undefined' ? window : null,
    storageRef = null,
    storageKey = 'akordyar.dockablePanelLayout.v1',
    panelId,
    controlsId,
    dragHandleId,
    floatButtonId,
    maximizeButtonId,
    resetButtonId,
    closeButtonId,
    restoreButtonId,
    side = 'left',
    minWidth = 280,
    minHeight = 240,
    defaultFloating = DEFAULT_LAYOUT.floating,
    onStateChange = () => {}
  } = {}) {
    let initialized = false;
    let state = null;
    let pointerSession = null;
    let resizeObserver = null;
    let persistFrame = 0;
    const listeners = [];
    const elements = {};

    function viewportSize() {
      return {
        width: Math.max(320, toFinite(windowRef?.innerWidth, 1280)),
        height: Math.max(240, toFinite(windowRef?.innerHeight, 720))
      };
    }

    function options() {
      return { minWidth, minHeight, defaultFloating };
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
        stored = JSON.parse(getStorage()?.getItem?.(storageKey) || 'null');
      } catch (_) {
        stored = null;
      }
      return normalizeLayoutState(
        stored || { ...DEFAULT_LAYOUT, floating: defaultFloating },
        viewportSize(),
        options()
      );
    }

    function writeState() {
      try {
        getStorage()?.setItem?.(storageKey, JSON.stringify(state));
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
      elements.panel = documentRef?.getElementById?.(panelId) || null;
      elements.controls = documentRef?.getElementById?.(controlsId) || null;
      elements.dragHandle = documentRef?.getElementById?.(dragHandleId) || null;
      elements.floatButton = documentRef?.getElementById?.(floatButtonId) || null;
      elements.maximizeButton =
        documentRef?.getElementById?.(maximizeButtonId) || null;
      elements.resetButton = documentRef?.getElementById?.(resetButtonId) || null;
      elements.closeButton = documentRef?.getElementById?.(closeButtonId) || null;
      elements.restoreButton =
        documentRef?.getElementById?.(restoreButtonId) || null;
      return Boolean(elements.panel && elements.controls && elements.dragHandle);
    }

    function listen(target, eventName, handler, optionsValue) {
      if (!target?.addEventListener) return;
      target.addEventListener(eventName, handler, optionsValue);
      listeners.push({
        target,
        eventName,
        handler,
        options: optionsValue
      });
    }

    function notify() {
      onStateChange({
        ...state,
        floating: { ...state.floating }
      });
    }

    function updateControls() {
      const floating = state.mode === 'floating';
      elements.panel.dataset.panelMode = state.mode;
      elements.floatButton?.classList?.toggle('active', floating);
      elements.maximizeButton?.classList?.toggle(
        'active',
        floating && state.maximized
      );
      elements.floatButton?.setAttribute?.('aria-pressed', String(floating));
      elements.maximizeButton?.setAttribute?.(
        'aria-pressed',
        String(floating && state.maximized)
      );
      elements.restoreButton?.toggleAttribute?.('hidden', !state.closed);
      elements.closeButton?.setAttribute?.(
        'aria-label',
        state.closed ? 'باز کردن پنل' : 'بستن پنل'
      );
      if (elements.floatButton) {
        elements.floatButton.title = floating
          ? 'اتصال دوباره پنل به کنار برنامه'
          : 'شناور کردن پنل';
      }
    }

    function clearFloatingStyles() {
      ['left', 'top', 'width', 'height'].forEach(property => {
        elements.panel.style.removeProperty(property);
      });
    }

    function applyDocked({ persist = true } = {}) {
      state.mode = 'docked';
      state.maximized = false;
      state.closed = false;
      elements.panel.classList.remove(
        'side-panel-floating',
        'side-panel-maximized',
        'side-panel-closed'
      );
      elements.panel.style.display = '';
      clearFloatingStyles();
      updateControls();
      if (persist) schedulePersist();
      notify();
    }

    function applyFloating({ persist = true } = {}) {
      state.mode = 'floating';
      state.closed = false;
      state.floating = clampFloatingRect(
        state.floating,
        viewportSize(),
        options()
      );
      elements.panel.classList.add('side-panel-floating');
      elements.panel.classList.remove('side-panel-closed');
      elements.panel.classList.toggle('side-panel-maximized', state.maximized);
      elements.panel.style.display = '';

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

      updateControls();
      if (persist) schedulePersist();
      notify();
    }

    function applyClosed({ persist = true } = {}) {
      state.closed = true;
      elements.panel.classList.add('side-panel-closed');
      elements.panel.style.display = 'none';
      updateControls();
      if (persist) schedulePersist();
      notify();
    }

    function captureFloatingRect() {
      if (state.mode !== 'floating' || state.maximized) return;
      const rect = elements.panel.getBoundingClientRect();
      state.floating = clampFloatingRect(
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        },
        viewportSize(),
        options()
      );
      schedulePersist();
      notify();
    }

    function getDefaultFloatingRect(anchorEvent = null) {
      const viewport = viewportSize();
      const dockedRect = elements.panel.getBoundingClientRect();
      const width = Math.min(
        viewport.width - 24,
        Math.max(minWidth, defaultFloating.width, dockedRect.width || 0)
      );
      const height = Math.min(
        viewport.height - 24,
        Math.max(minHeight, defaultFloating.height, dockedRect.height || 0)
      );
      const left = anchorEvent
        ? anchorEvent.clientX - width / 2
        : side === 'right'
          ? viewport.width - width - 24
          : 24;
      const top = anchorEvent
        ? anchorEvent.clientY - 20
        : Math.max(24, (viewport.height - height) / 2);
      return clampFloatingRect(
        { left, top, width, height },
        viewport,
        options()
      );
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
      if (state.closed) {
        openPanel();
        return;
      }
      if (state.mode === 'floating') dockPanel();
      else floatPanel();
    }

    function toggleMaximized() {
      if (state.mode !== 'floating') {
        state.floating = getDefaultFloatingRect();
        state.mode = 'floating';
      } else if (!state.maximized) {
        captureFloatingRect();
      }
      state.maximized = !state.maximized;
      applyFloating();
    }

    function resetLayout() {
      state = normalizeLayoutState(
        { ...DEFAULT_LAYOUT, floating: defaultFloating },
        viewportSize(),
        options()
      );
      applyDocked();
    }

    function closePanel() {
      applyClosed();
    }

    function openPanel() {
      if (!state?.closed) return;
      state.closed = false;
      if (state.mode === 'floating') applyFloating({ persist: false });
      else applyDocked({ persist: false });
      writeState();
    }

    function toggleClosed() {
      if (state.closed) openPanel();
      else closePanel();
    }

    function cleanupPointerSession() {
      if (!pointerSession) return;
      const { pointerId, move, end, cancel, captureTarget } = pointerSession;
      windowRef.removeEventListener('pointermove', move, true);
      windowRef.removeEventListener('pointerup', end, true);
      windowRef.removeEventListener('pointercancel', cancel, true);
      try {
        captureTarget?.releasePointerCapture?.(pointerId);
      } catch (_) {}
      documentRef.body?.classList?.remove('side-panel-layout-dragging');
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
      documentRef.body?.classList?.add('side-panel-layout-dragging');
      try {
        captureTarget?.setPointerCapture?.(pointerId);
      } catch (_) {}
      windowRef.addEventListener('pointermove', move, {
        capture: true,
        passive: false
      });
      windowRef.addEventListener('pointerup', finish, { capture: true });
      windowRef.addEventListener('pointercancel', cancel, { capture: true });
    }

    function handlePanelDragStart(event) {
      if (event.button !== 0) return;
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
        state.floating = clampFloatingRect(
          {
            ...state.floating,
            left: moveEvent.clientX - offsetX,
            top: moveEvent.clientY - offsetY,
            width: rect.width,
            height: rect.height
          },
          viewportSize(),
          options()
        );
        applyFloating({ persist: false });
      }, () => {
        captureFloatingRect();
        writeState();
      });
    }

    function handleControlClick(event) {
      const control = event.target.closest('[data-panel-layout-action]');
      if (!control || !elements.controls.contains(control)) return;
      const action = control.dataset.panelLayoutAction;
      if (action === 'toggle-floating') toggleFloating();
      else if (action === 'toggle-maximize') toggleMaximized();
      else if (action === 'reset-layout') resetLayout();
      else if (action === 'toggle-closed') toggleClosed();
    }

    function handleWindowResize() {
      if (state.mode === 'floating') applyFloating({ persist: false });
      else notify();
      schedulePersist();
    }

    function init() {
      if (initialized || !resolveElements()) return api;
      initialized = true;
      state = readState();

      listen(elements.controls, 'click', handleControlClick);
      listen(elements.dragHandle, 'pointerdown', handlePanelDragStart, {
        passive: false
      });
      listen(elements.dragHandle, 'dblclick', event => {
        event.preventDefault();
        toggleMaximized();
      });
      listen(elements.restoreButton, 'click', event => {
        event.preventDefault();
        openPanel();
      });
      listen(windowRef, 'resize', handleWindowResize, { passive: true });

      if (typeof globalScope.ResizeObserver === 'function') {
        resizeObserver = new globalScope.ResizeObserver(() => {
          if (state.mode === 'floating' && !state.maximized && !pointerSession) {
            captureFloatingRect();
          }
        });
        resizeObserver.observe(elements.panel);
      }

      if (state.closed) applyClosed({ persist: false });
      else if (state.mode === 'floating') applyFloating({ persist: false });
      else applyDocked({ persist: false });
      writeState();
      return api;
    }

    function destroy() {
      cleanupPointerSession();
      listeners.splice(0).forEach(({ target, eventName, handler, options: eventOptions }) => {
        target.removeEventListener(eventName, handler, eventOptions);
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
      close: closePanel,
      open: openPanel,
      toggleClosed,
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
  globalScope.DockablePanelLayoutService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
