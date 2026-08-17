/**
 * TimelineScrollbarsService
 *
 * Owns the Cubase-style proxy scrollbars around the timeline viewport.
 * The real viewport keeps its scroll state but exposes no native scrollbars.
 */
(function attachTimelineScrollbarsService(globalScope) {
  'use strict';

  function toFinite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function calculateProxyExtent({
    contentExtent = 0,
    viewportExtent = 0,
    proxyViewportExtent = 0
  } = {}) {
    const content = Math.max(0, toFinite(contentExtent));
    const viewport = Math.max(0, toFinite(viewportExtent));
    const proxyViewport = Math.max(0, toFinite(proxyViewportExtent));
    const compensation = Math.max(0, proxyViewport - viewport);
    return Math.max(proxyViewport, content + compensation);
  }

  function create({
    documentRef = typeof document !== 'undefined' ? document : null,
    windowRef = typeof window !== 'undefined' ? window : null
  } = {}) {
    let initialized = false;
    let syncing = false;
    let resizeObserver = null;
    let scheduledFrame = 0;
    const listeners = [];
    const elements = {};

    function byId(id) {
      return documentRef?.getElementById?.(id) || null;
    }

    function resolveElements() {
      elements.viewport = byId('tl-scroll');
      elements.inner = byId('tl-inner');
      elements.headers = byId('track-names-container');
      elements.horizontal = byId('timelineHorizontalScrollbar');
      elements.horizontalContent = byId('timelineHorizontalScrollbarContent');
      elements.vertical = byId('timelineVerticalScrollbar');
      elements.verticalContent = byId('timelineVerticalScrollbarContent');

      return Boolean(
        elements.viewport &&
        elements.horizontal &&
        elements.horizontalContent &&
        elements.vertical &&
        elements.verticalContent
      );
    }

    function listen(target, eventName, handler, options) {
      if (!target?.addEventListener) return;
      target.addEventListener(eventName, handler, options);
      listeners.push({ target, eventName, handler, options });
    }

    function setAxisScroll(target, axis, value) {
      if (!target) return;
      const property = axis === 'x' ? 'scrollLeft' : 'scrollTop';
      const next = Math.max(0, toFinite(value));
      if (Math.abs(toFinite(target[property]) - next) > 0.5) {
        target[property] = next;
      }
    }

    function updateAria() {
      const viewport = elements.viewport;
      if (!viewport) return;

      const horizontalMax = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const verticalMax = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      elements.horizontal?.setAttribute?.('aria-valuemin', '0');
      elements.horizontal?.setAttribute?.('aria-valuemax', String(Math.round(horizontalMax)));
      elements.horizontal?.setAttribute?.('aria-valuenow', String(Math.round(viewport.scrollLeft)));
      elements.vertical?.setAttribute?.('aria-valuemin', '0');
      elements.vertical?.setAttribute?.('aria-valuemax', String(Math.round(verticalMax)));
      elements.vertical?.setAttribute?.('aria-valuenow', String(Math.round(viewport.scrollTop)));
    }

    function syncFromViewport() {
      if (syncing || !elements.viewport) return;
      syncing = true;
      setAxisScroll(elements.horizontal, 'x', elements.viewport.scrollLeft);
      setAxisScroll(elements.vertical, 'y', elements.viewport.scrollTop);
      setAxisScroll(elements.headers, 'y', elements.viewport.scrollTop);
      syncing = false;
      updateAria();
    }

    function syncFromHorizontal() {
      if (syncing || !elements.viewport) return;
      syncing = true;
      setAxisScroll(elements.viewport, 'x', elements.horizontal.scrollLeft);
      syncing = false;
      updateAria();
    }

    function syncFromVertical() {
      if (syncing || !elements.viewport) return;
      syncing = true;
      setAxisScroll(elements.viewport, 'y', elements.vertical.scrollTop);
      setAxisScroll(elements.headers, 'y', elements.vertical.scrollTop);
      syncing = false;
      updateAria();
    }

    function syncFromHeaders() {
      if (syncing || !elements.viewport || !elements.headers) return;
      syncing = true;
      setAxisScroll(elements.viewport, 'y', elements.headers.scrollTop);
      setAxisScroll(elements.vertical, 'y', elements.headers.scrollTop);
      syncing = false;
      updateAria();
    }

    function syncGeometry() {
      const viewport = elements.viewport;
      if (!viewport) return;

      const horizontalExtent = calculateProxyExtent({
        contentExtent: viewport.scrollWidth,
        viewportExtent: viewport.clientWidth,
        proxyViewportExtent: elements.horizontal.clientWidth
      });
      const verticalExtent = calculateProxyExtent({
        contentExtent: viewport.scrollHeight,
        viewportExtent: viewport.clientHeight,
        proxyViewportExtent: elements.vertical.clientHeight
      });

      elements.horizontalContent.style.width = `${Math.ceil(horizontalExtent)}px`;
      elements.verticalContent.style.height = `${Math.ceil(verticalExtent)}px`;
      syncFromViewport();
    }

    function scheduleGeometrySync() {
      if (scheduledFrame) return;
      const requestFrame = windowRef?.requestAnimationFrame?.bind(windowRef);
      if (!requestFrame) {
        syncGeometry();
        return;
      }
      scheduledFrame = requestFrame(() => {
        scheduledFrame = 0;
        syncGeometry();
      });
    }

    function handleViewportWheel(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const viewport = elements.viewport;
      if (!viewport) return;

      const horizontalIntent =
        event.shiftKey ||
        Math.abs(toFinite(event.deltaX)) > Math.abs(toFinite(event.deltaY));
      if (horizontalIntent) {
        const delta = toFinite(event.deltaX) || toFinite(event.deltaY);
        setAxisScroll(viewport, 'x', viewport.scrollLeft + delta);
      } else {
        setAxisScroll(viewport, 'y', viewport.scrollTop + toFinite(event.deltaY));
      }
      syncFromViewport();
      event.preventDefault();
    }

    function handleHeadersWheel(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const viewport = elements.viewport;
      if (!viewport) return;
      setAxisScroll(viewport, 'y', viewport.scrollTop + toFinite(event.deltaY));
      syncFromViewport();
      event.preventDefault();
    }

    function init() {
      if (initialized || !resolveElements()) return api;
      initialized = true;

      listen(elements.viewport, 'scroll', syncFromViewport, { passive: true });
      listen(elements.horizontal, 'scroll', syncFromHorizontal, { passive: true });
      listen(elements.vertical, 'scroll', syncFromVertical, { passive: true });
      listen(elements.headers, 'scroll', syncFromHeaders, { passive: true });
      listen(elements.viewport, 'wheel', handleViewportWheel, { passive: false });
      listen(elements.headers, 'wheel', handleHeadersWheel, { passive: false });
      listen(windowRef, 'resize', scheduleGeometrySync, { passive: true });

      if (typeof globalScope.ResizeObserver === 'function') {
        resizeObserver = new globalScope.ResizeObserver(scheduleGeometrySync);
        [
          elements.viewport,
          elements.inner,
          elements.headers,
          elements.horizontal,
          elements.vertical
        ].filter(Boolean).forEach(element => resizeObserver.observe(element));
      }

      scheduleGeometrySync();
      return api;
    }

    function destroy() {
      listeners.splice(0).forEach(({ target, eventName, handler, options }) => {
        target.removeEventListener(eventName, handler, options);
      });
      resizeObserver?.disconnect?.();
      resizeObserver = null;
      if (scheduledFrame && windowRef?.cancelAnimationFrame) {
        windowRef.cancelAnimationFrame(scheduledFrame);
      }
      scheduledFrame = 0;
      initialized = false;
    }

    const api = Object.freeze({
      init,
      destroy,
      syncGeometry: scheduleGeometrySync,
      syncFromViewport
    });
    return api;
  }

  const service = Object.freeze({
    create,
    calculateProxyExtent
  });
  globalScope.TimelineScrollbarsService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
