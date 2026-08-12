/**
 * EditorGlobalBindingsService
 *
 * listenerهای کوچک و تکرارشوندهٔ ادیتور را یک‌بار ثبت و در صورت نیاز حذف می‌کند.
 * command flow اصلی ادیتور همچنان از طریق callback تزریق می‌شود.
 */
(function attachEditorGlobalBindingsService(globalScope) {
  function create({
    windowRef = globalScope,
    documentRef = globalScope.document,
    getSong = () => null,
    renderChords = () => {},
    getEditorWrap = () => null,
    isDragging = () => false,
    onAltChange = () => {}
  } = {}) {
    let bound = false;
    let altDown = false;
    let raf = null;
    const listeners = [];

    function listen(target, eventName, handler, options) {
      if (!target?.addEventListener) return;
      target.addEventListener(eventName, handler, options);
      listeners.push({ target, eventName, handler, options });
    }

    function bind() {
      if (bound) return;
      bound = true;

      const onResize = () => {
        if (getSong()) renderChords();
      };
      const onKeyDown = event => {
        if (event.key !== 'Alt') return;
        altDown = true;
        onAltChange(true);
      };
      const onKeyUp = event => {
        if (event.key !== 'Alt') return;
        altDown = false;
        onAltChange(false);
      };
      const onBlur = () => {
        altDown = false;
        onAltChange(false);
      };
      const onScroll = () => {
        if (!getSong() || isDragging()) return;
        if (raf) globalScope.cancelAnimationFrame?.(raf);
        raf = globalScope.requestAnimationFrame?.(() => {
          raf = null;
          renderChords(true);
        });
      };

      listen(windowRef, 'resize', onResize);
      listen(windowRef, 'keydown', onKeyDown);
      listen(windowRef, 'keyup', onKeyUp);
      listen(windowRef, 'blur', onBlur);
      listen(getEditorWrap(), 'scroll', onScroll);
    }

    function destroy() {
      listeners.splice(0).forEach(({ target, eventName, handler, options }) => {
        target.removeEventListener(eventName, handler, options);
      });
      if (raf) globalScope.cancelAnimationFrame?.(raf);
      raf = null;
      bound = false;
      altDown = false;
      onAltChange(false);
    }

    return Object.freeze({
      bind,
      destroy,
      isAltDown: () => altDown
    });
  }

  globalScope.EditorGlobalBindingsService = Object.freeze({ create });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.EditorGlobalBindingsService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
