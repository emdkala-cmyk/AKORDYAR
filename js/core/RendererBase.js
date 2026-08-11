/**
 * RendererBase — shared renderer lifecycle utilities.
 * 
 * Standard pattern for all renderers:
 *   render*(doc, highlight, viewState, container) — full DOM rebuild
 *   update*Highlight() — frame-safe highlight-only update
 * 
 * Lifecycle:
 *   1. Subscribe to PerformanceStore
 *   2. On contentUpdated → full render*(doc, ...)
 *   3. On highlightChanged → update*Highlight()
 *   4. On destroy → unsubscribe + cleanup
 */

const RendererBase = (() => {

  /**
   * Track last scrolled line to avoid redundant scroll operations.
   * @returns {{ get: function(), set: function(id) }}
   */
  function createScrollTracker() {
    var _lastId = null;
    return {
      get: function() { return _lastId; },
      set: function(id) { _lastId = id; },
      reset: function() { _lastId = null; }
    };
  }

  /**
   * Apply container-level styles from viewState.
   * @param {HTMLElement} container
   * @param {object} viewState
   * @param {object} defaults - { fontFamily, fontSize, lineHeight, color }
   */
  function applyContainerStyles(container, viewState, defaults) {
    if (!container) return;
    var vs = viewState || {};
    var d = defaults || {};

    container.style.fontFamily = (vs.fontFamily || d.fontFamily || 'Vazirmatn') + ', sans-serif';
    container.style.fontSize   = (vs.fontSize || d.fontSize || 32) + 'px';
    container.style.lineHeight = String(vs.lineHeight || d.lineHeight || 2.2);
    container.style.color      = vs.textColor || d.color || '#E2E8F0';
    container.style.direction  = 'rtl';
    container.style.textAlign  = 'right';
  }

  /**
   * Safely scroll to a line element.
   * @param {HTMLElement} container
   * @param {HTMLElement} lineEl
   */
  function scrollToLine(container, lineEl) {
    if (!container || !lineEl) return;
    try {
      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {
      lineEl.scrollIntoView();
    }
  }

  /**
   * Create a standard subscription to PerformanceStore for a renderer.
   * @param {function} fullRenderFn — called on contentUpdated
   * @param {function} highlightFn — called on highlightChanged
   * @returns {function} unsubscribe function
   */
  function subscribe(store, fullRenderFn, highlightFn) {
    if (!store || typeof store.on !== 'function') return function() {};

    var unsubContent = store.on('contentUpdated', function() {
      if (typeof fullRenderFn === 'function') fullRenderFn();
    });

    var unsubHighlight = store.on('highlightChanged', function(hl) {
      if (typeof highlightFn === 'function') highlightFn(hl);
    });

    return function unsubscribe() {
      if (typeof unsubContent === 'function') unsubContent();
      if (typeof unsubHighlight === 'function') unsubHighlight();
    };
  }

  return {
    createScrollTracker: createScrollTracker,
    applyContainerStyles: applyContainerStyles,
    scrollToLine: scrollToLine,
    subscribe: subscribe
  };

})();

if (typeof window !== 'undefined') {
  window.RendererBase = RendererBase;
}
