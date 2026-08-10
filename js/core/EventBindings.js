/**
 * EventBindings — centralized event binding module.
 * 
 * Migrates inline onclick handlers from HTML to JS event listeners.
 * Uses event delegation where possible for better performance.
 * 
 * Load AFTER app.js so all global functions are available.
 */

const EventBindings = (() => {

  let _bound = false;

  /**
   * Initialize all event bindings.
   * Idempotent — safe to call multiple times.
   */
  function init() {
    if (_bound) return;
    _bound = true;

    bindTransportControls();
    bindNavItems();
    bindGlobalKeyboard();
  }

  // ── Transport Controls ──

  function bindTransportControls() {
    safeBind('play-btn', 'click', function(e) {
      if (typeof togglePlay === 'function') togglePlay();
    });

    // Use event delegation for transport buttons with data-action
    var transportBar = document.querySelector('.transport-bar');
    if (transportBar) {
      transportBar.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        switch (action) {
          case 'goStart':
            if (typeof transportToStart === 'function') transportToStart();
            break;
          case 'pause':
            if (typeof pauseTransport === 'function') pauseTransport();
            break;
          case 'play':
            if (typeof togglePlay === 'function') togglePlay();
            break;
          case 'stop':
            if (typeof stopTransport === 'function') stopTransport();
            break;
          case 'goEnd':
            if (typeof transportToEnd === 'function') transportToEnd();
            break;
          case 'returnToStart':
            if (typeof toggleReturnToStart === 'function') toggleReturnToStart();
            break;
          case 'singerView':
            if (typeof openLyricOnlyPopup === 'function') openLyricOnlyPopup();
            break;
          case 'playerView':
            if (typeof openPlayerView === 'function') openPlayerView();
            else if (typeof openLyricOnlyPopup === 'function') openLyricOnlyPopup();
            break;
        }
      });
    }
  }

  // ── Navigation Items ──

  function bindNavItems() {
    var nav = document.querySelector('.nav-bar');
    if (!nav) return;

    nav.addEventListener('click', function(e) {
      var item = e.target.closest('.nav-item');
      if (!item) return;
      var text = (item.textContent || '').trim();

      // Match by known button patterns
      if (item.querySelector('svg')) {
        // Use title attribute or position as fallback
        var title = (item.getAttribute('title') || '').toLowerCase();
        if (title.includes('archive') || title.includes('آرشیو')) {
          if (typeof edOpenArchive === 'function') edOpenArchive();
        }
      }
    });
  }

  // ── Global Keyboard Shortcuts ──

  function bindGlobalKeyboard() {
    document.addEventListener('keydown', function(e) {
      // Space: play/pause (only if not in input/textarea)
      if (e.code === 'Space' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !e.target.isContentEditable) {
          e.preventDefault();
          if (typeof togglePlay === 'function') togglePlay();
        }
      }
    });
  }

  // ── Helpers ──

  function safeBind(id, event, handler) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener(event, handler);
    }
  }

  return {
    init: init,
    safeBind: safeBind
  };

})();

if (typeof window !== 'undefined') {
  window.EventBindings = EventBindings;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { EventBindings.init(); });
  } else {
    EventBindings.init();
  }
}
