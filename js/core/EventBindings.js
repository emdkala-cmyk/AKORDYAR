/**
 * Centralized DOM event registration for Akordyar.
 *
 * This file intentionally does not reach into app.js globals. All application
 * behavior is injected through the constructor.
 */
class EventBindings {
  constructor({
    documentRef = document,
    windowRef = window,
    actions = {},
    openArchive = null,
    onGlobalKeydownCapture = null,
    onGlobalKeydown = null
  } = {}) {
    this.document = documentRef;
    this.window = windowRef;
    this.actions = actions;
    this.openArchive = openArchive;
    this.onGlobalKeydownCapture = onGlobalKeydownCapture;
    this.onGlobalKeydown = onGlobalKeydown;

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
    this.bindNavigation();
    this.bindGlobalKeyboard();

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
    const transportBar = this.document.querySelector('.transport-bar');
    const playButton = this.document.getElementById('play-btn');

    if (transportBar) {
      this.listen(transportBar, 'click', (event) => {
        // Ctrl+Shift+Alt+click is reserved for button mapping in app.js.
        if (event.ctrlKey && event.shiftKey && event.altKey) return;

        const button = event.target.closest('[data-action]');
        if (!button || !transportBar.contains(button)) return;

        this.runAction(button.dataset.action, event, button);
      });
    }

    // Some layouts use #play-btn without a data-action attribute.
    const playHandledByDelegation =
      transportBar &&
      playButton &&
      transportBar.contains(playButton) &&
      playButton.hasAttribute('data-action');

    if (playButton && !playHandledByDelegation) {
      this.listen(playButton, 'click', (event) => {
        this.runAction('play', event, playButton);
      });
    }
  }

  bindNavigation() {
    if (typeof this.openArchive !== 'function') return;

    const nav = this.document.querySelector('.nav-bar');
    if (!nav) return;

    this.listen(nav, 'click', (event) => {
      const item = event.target.closest('.nav-item');
      if (!item || !nav.contains(item)) return;

      const title = (item.getAttribute('title') || '').toLowerCase();
      const text = (item.textContent || '').trim().toLowerCase();
      const isArchive =
        title.includes('archive') ||
        title.includes('آرشیو') ||
        text.includes('archive') ||
        text.includes('آرشیو');

      if (isArchive) this.openArchive(event, item);
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
