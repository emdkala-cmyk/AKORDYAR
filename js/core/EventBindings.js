/**
 * Centralized DOM event registration for Akordyar.
 *
 * This file intentionally does not reach into application globals. All
 * application behavior is injected through the constructor.
 */
class EventBindings {
  constructor({
    documentRef = typeof document !== 'undefined' ? document : null,
    windowRef = typeof window !== 'undefined' ? window : null,
    actions = {},
    onGlobalKeydownCapture = null,
    onGlobalKeydown = null,
    onGlobalKeyup = null,
    onGlobalDocumentKeydown = null,
    onGlobalMousedownCapture = null
  } = {}) {
    this.document = documentRef;
    this.window = windowRef;
    this.actions = actions;
    this.onGlobalKeydownCapture = onGlobalKeydownCapture;
    this.onGlobalKeydown = onGlobalKeydown;
    this.onGlobalKeyup = onGlobalKeyup;
    this.onGlobalDocumentKeydown = onGlobalDocumentKeydown;
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
    this.bindInlineActionGroups();
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
      // Ctrl+Shift+Alt+click is reserved for button mapping.
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
    const isTextEditingTarget = target => {
      let element = target;
      if (element?.nodeType === 3) {
        element = element.parentElement || element.parentNode;
      }

      const tagName = String(element?.tagName || '').toUpperCase();
      if (tagName === 'SELECT') return false;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return true;
      if (element?.isContentEditable === true) return true;

      const contentEditable = String(element?.contentEditable || '').toLowerCase();
      if (
        contentEditable === 'true' ||
        contentEditable === 'plaintext-only'
      ) {
        return true;
      }

      const ancestor = element?.closest?.('[contenteditable]');
      if (!ancestor) return false;
      const value = ancestor.getAttribute?.('contenteditable');
      if (value != null) return String(value).toLowerCase() !== 'false';
      return String(ancestor.contentEditable || '').toLowerCase() !== 'false';
    };

    const shouldBypassEditableSpace = event =>
      event?.code === 'Space' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      isTextEditingTarget(event.target);

    if (typeof this.onGlobalKeydownCapture === 'function') {
      const captureHandler = event => {
        if (shouldBypassEditableSpace(event)) {
          // Stop the event before any separately-bound legacy keydown
          // listener can interpret Space as a transport command.
          event.stopPropagation?.();
          return false;
        }
        return this.onGlobalKeydownCapture(event);
      };
      this.listen(
        this.window,
        'keydown',
        captureHandler,
        true
      );
    }

    if (typeof this.onGlobalKeydown === 'function') {
      const bubbleHandler = event => {
        if (shouldBypassEditableSpace(event)) return false;
        return this.onGlobalKeydown(event);
      };
      this.listen(this.window, 'keydown', bubbleHandler);
    }

    if (typeof this.onGlobalKeyup === 'function') {
      this.listen(this.window, 'keyup', this.onGlobalKeyup);
    }

    if (typeof this.onGlobalDocumentKeydown === 'function') {
      const documentHandler = event => {
        if (shouldBypassEditableSpace(event)) return false;
        return this.onGlobalDocumentKeydown(event);
      };
      this.listen(this.document, 'keydown', documentHandler);
    }
  }

  bindInlineActionGroups() {
    const groups = this.document.querySelectorAll('[data-inline-actions]');
    groups.forEach(group => {
      this.listen(group, 'click', event => {
        const control = event.target.closest('[data-action]');
        if (!control || !group.contains(control)) return;
        if (this.isFormControl(control)) return;
        this.runAction(this.resolveAction(control, 'click'), event, control);
      });

      this.listen(group, 'input', event => {
        const control = event.target.closest('[data-action]');
        if (!control || !group.contains(control)) return;
        this.runAction(this.resolveAction(control, 'input'), event, control);
      });

      this.listen(group, 'change', event => {
        const control = event.target.closest('[data-action]');
        if (!control || !group.contains(control)) return;
        this.runAction(this.resolveAction(control, 'change'), event, control);
      });
    });
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

  resolveAction(element, eventName) {
    if (!element?.dataset) return '';
    if (eventName === 'input' && element.dataset.inputAction) {
      return element.dataset.inputAction;
    }
    if (eventName === 'change' && element.dataset.changeAction) {
      return element.dataset.changeAction;
    }
    return element.dataset.action || '';
  }

  isFormControl(element) {
    return /^(INPUT|SELECT|TEXTAREA)$/i.test(element?.tagName || '');
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
