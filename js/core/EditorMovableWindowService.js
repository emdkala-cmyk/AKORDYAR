/**
 * EditorMovableWindowService
 *
 * Owns pointer-drag behavior for editor panels and modal windows. Runtime
 * pointer capture is injected through EditorRuntimeAdapter.
 */
(function attachEditorMovableWindowService(globalScope) {
  function create(context = {}) {
    const {
      documentRef = globalScope.document,
      windowRef = globalScope,
      startPointerDrag = () => {}
    } = context;

    function handlePointerDown(event) {
      if (event.button !== 0) return;
      const head = event.target.closest(
        'h3, h4, .mv-head, .shortcut-panel-header'
      );
      if (!head || head.closest('#arrangerModal')) return;

      const panel =
        head.closest('.mv-window') ||
        head.closest('.chord-editor') ||
        head.closest('.icon-picker-panel') ||
        head.closest('.arr-song-note-panel') ||
        head.closest('.shortcut-panel');
      if (!panel || event.target.closest('button, input, select, textarea')) {
        return;
      }

      event.preventDefault();
      const rect = panel.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      panel.style.position = 'fixed';
      panel.style.margin = '0';
      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const move = moveEvent => {
        let x = moveEvent.clientX - offsetX;
        let y = moveEvent.clientY - offsetY;
        x = Math.max(-width + 60, Math.min(x, windowRef.innerWidth - 40));
        y = Math.max(0, Math.min(y, windowRef.innerHeight - 30));
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
      };
      startPointerDrag(head, event, move);
    }

    function bind() {
      documentRef.addEventListener('pointerdown', handlePointerDown);
      return () => documentRef.removeEventListener('pointerdown', handlePointerDown);
    }

    return Object.freeze({ bind, handlePointerDown });
  }

  const service = Object.freeze({ create });
  globalScope.EditorMovableWindowService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
