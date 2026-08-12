/**
 * KeyboardMappingService
 *
 * Owns the temporary listeners used while a toolbar action is learning a
 * keyboard shortcut. The service never mutates the shortcut store directly;
 * persistence and labels are injected by the editor runtime.
 */
(function attachKeyboardMappingService(globalScope) {
  function create({
    documentRef = globalScope.document,
    getLabel = id => id,
    saveShortcut = () => {},
    formatKeyName = code => code,
    onMouseDown = () => {},
    toast = () => {}
  } = {}) {
    let targetId = null;
    let targetElement = null;
    let toastElement = null;

    function ensureToastElement() {
      if (toastElement || !documentRef?.createElement) return toastElement;
      toastElement = documentRef.querySelector?.('.mapping-toast') || null;
      if (!toastElement && documentRef.body) {
        toastElement = documentRef.createElement('div');
        toastElement.className = 'mapping-toast';
        documentRef.body.appendChild(toastElement);
      }
      return toastElement;
    }

    function setToast(text, visible = true) {
      const element = ensureToastElement();
      if (!element) {
        if (visible) toast(text);
        return;
      }
      element.textContent = text;
      element.style.display = visible ? 'block' : 'none';
    }

    function removeListeners() {
      documentRef?.removeEventListener?.('keydown', handleKeydown, true);
      documentRef?.removeEventListener?.('mousedown', handleMouseDown, true);
    }

    function clearTarget() {
      targetId = null;
      targetElement = null;
    }

    function cancel() {
      targetElement?.classList?.remove?.('mapping-active');
      removeListeners();
      clearTarget();
      setToast('', false);
    }

    function finish(info) {
      targetElement?.classList?.remove?.('mapping-active');
      removeListeners();
      setToast(`✅ ذخیره شد: ${info}`);
      globalScope.setTimeout?.(() => setToast('', false), 1500);
      clearTarget();
    }

    function handleKeydown(event) {
      if (!targetId) return;
      event.preventDefault?.();
      event.stopPropagation?.();

      if (event.key === 'Escape') {
        cancel();
        return;
      }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;

      const id = targetId;
      const code = event.code;
      const ctrl = Boolean(event.ctrlKey || event.metaKey);
      const shift = Boolean(event.shiftKey);
      saveShortcut(id, { code, ctrl, shift });
      finish(
        `کلید: ${formatKeyName(code)}` +
        (ctrl ? '+Ctrl' : '') +
        (shift ? '+Shift' : '')
      );
    }

    function handleMouseDown(event) {
      if (!targetId) return;
      const actionElement = event.target?.closest?.('[data-action]');
      if (actionElement === targetElement) return;
      onMouseDown(event, { targetId, targetElement });
    }

    function start(actionId, element) {
      if (!actionId || !element) return false;
      cancel();
      targetId = actionId;
      targetElement = element;
      targetElement.classList?.add?.('mapping-active');

      const label = getLabel(actionId);
      setToast(`🎹 «${label}» — کلید یا نت MIDI را بزنید...`);
      documentRef?.addEventListener?.('keydown', handleKeydown, true);
      documentRef?.addEventListener?.('mousedown', handleMouseDown, true);
      return true;
    }

    return Object.freeze({
      start,
      cancel,
      finish,
      isActive: () => Boolean(targetId),
      getTarget: () => targetId,
      handleKeydown,
      handleMouseDown,
      destroy: cancel
    });
  }

  const service = Object.freeze({ create });
  globalScope.KeyboardMappingService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
