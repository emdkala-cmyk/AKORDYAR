/**
 * Centralized DOM event registration for Akordyar.
 *
 * This file intentionally does not reach into app.js globals. All application
 * behavior is injected through the constructor.
 */
class EventBindings {
  constructor({
    documentRef = typeof document !== 'undefined' ? document : null,
    windowRef = typeof window !== 'undefined' ? window : null,
    actions = {},
    onGlobalKeydownCapture = null,
    onGlobalKeydown = null,
    onGlobalKeyup = null,
    onGlobalMousedownCapture = null
  } = {}) {
    this.document = documentRef;
    this.window = windowRef;
    this.actions = actions;
    this.onGlobalKeydownCapture = onGlobalKeydownCapture;
    this.onGlobalKeydown = onGlobalKeydown;
    this.onGlobalKeyup = onGlobalKeyup;
    this.onGlobalMousedownCapture = onGlobalMousedownCapture;

    this.initialized = false;
    this.listeners = [];
  }

  /**
   * Registers all listeners once.
   *
   * @returns {EventBindings}
   */
  init() {
    if (this.initialized) return this;

    this.initialized = true;
    this.bindTransportControls();
    this.bindNavItems();
    this.bindQuickSearchPanel();
    this.bindGlobalKeyboard();
    this.bindGlobalPointer();

    return this;
  }

  /**
   * Removes listeners registered by this instance.
   */
  destroy() {
    this.listeners.forEach(({ target, eventName, handler, options }) => {
      target.removeEventListener(eventName, handler, options);
    });

    this.listeners = [];
    this.initialized = false;
  }

  bindTransportControls() {
    const transportBar = this.document.querySelector(
      '[data-event-group="transport"]'
    );

    if (!transportBar) return;

    this.listen(transportBar, 'click', (event) => {
      // Ctrl+Shift+Alt+click is reserved for button mapping in app.js.
      if (event.ctrlKey && event.shiftKey && event.altKey) return;

      const button = event.target.closest('[data-action]');
      if (!button || !transportBar.contains(button)) return;

      this.runAction(button.dataset.action, event, button);
    });
  }

  bindNavItems() {
    const navigation = this.document.querySelector(
      '[data-event-group="navigation"]'
    );

    if (!navigation) return;

    this.listen(navigation, 'click', (event) => {
      const item = event.target.closest(
        '.nav-list .nav-item[data-command], .nav-grid .nav-item[data-command]'
      );

      if (!item || !navigation.contains(item)) return;

      this.runAction(item.dataset.command, event, item);
    });
  }

  bindQuickSearchPanel() {
    const panel = this.document.getElementById('quickSearchPanel');
    if (!panel) return;

    this.listen(panel, 'click', (event) => {
      const control = event.target.closest('button[data-command]');
      if (!control || !panel.contains(control)) return;

      this.runAction(control.dataset.command, event, control);
    });

    this.listen(panel, 'input', (event) => {
      const control = event.target.closest('input[data-command]');
      if (!control || !panel.contains(control)) return;

      this.runAction(control.dataset.command, event, control);
    });

    this.listen(panel, 'change', (event) => {
      const control = event.target.closest('select[data-command]');
      if (!control || !panel.contains(control)) return;

      this.runAction(control.dataset.command, event, control);
    });
  }

  bindGlobalKeyboard() {
    if (typeof this.onGlobalKeydownCapture === 'function') {
      this.listen(
        this.window,
        'keydown',
        this.onGlobalKeydownCapture,
        true
      );
    }

    if (typeof this.onGlobalKeydown === 'function') {
      this.listen(this.window, 'keydown', this.onGlobalKeydown);
    }

    if (typeof this.onGlobalKeyup === 'function') {
      this.listen(this.window, 'keyup', this.onGlobalKeyup);
    }
  }

  bindGlobalPointer() {
    if (typeof this.onGlobalMousedownCapture === 'function') {
      this.listen(
        this.document,
        'mousedown',
        this.onGlobalMousedownCapture,
        true
      );
    }
  }

  runAction(actionName, event, element) {
    const action = this.actions[actionName];
    if (typeof action === 'function') {
      action(event, element);
    }
  }

  listen(target, eventName, handler, options) {
    if (!target || typeof handler !== 'function') return;

    target.addEventListener(eventName, handler, options);
    this.listeners.push({ target, eventName, handler, options });
  }
}

if (typeof window !== 'undefined') {
  window.EventBindings = EventBindings;
  window.dispatchEvent(new CustomEvent('akordyar:event-bindings-ready'));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventBindings;
}
