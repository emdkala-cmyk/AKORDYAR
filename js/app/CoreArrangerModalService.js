/*
 * CoreArrangerModalService
 *
 * Owns arranger modal visibility, focus/escape handling and drag wiring
 * without owning arranger state.
 */
(function attachCoreArrangerModalService(globalScope) {
  'use strict';

  function create({
    getElement = id => globalScope.document?.getElementById?.(id),
    getArrangers = () => [],
    getEditingArranger = () => null,
    setEditingArr = () => {},
    renderArrangerManager = () => {},
    openArrEditor = () => {},
    startPointerDrag = (...args) =>
      globalScope.EditorRuntimeAdapter?.startPointerDrag?.(...args)
  } = {}) {
    function close() {
      const modal = getElement?.('arrangerModal');
      modal?.classList?.remove?.('show');
      const editor = modal?.querySelector?.('.chord-editor');
      if (editor) {
        editor.style.left = '';
        editor.style.top = '';
      }
      setEditingArr(null);
    }

    function setupDrag() {
      const handle = getElement?.('arrModalDragHandle');
      const modal = getElement?.('arrangerModal');
      const editor = modal?.querySelector?.('.chord-editor');
      if (!handle || !editor || handle._dragSetup) return;
      handle._dragSetup = true;

      let dragging = false;
      let startX;
      let startY;
      let originX;
      let originY;

      const move = event => {
        if (!dragging) return;
        editor.style.left =
          originX + event.clientX - startX + 'px';
        editor.style.top =
          originY + event.clientY - startY + 'px';
      };

      handle.addEventListener?.('pointerdown', event => {
        if (event.button !== 0) return;
        if (event.target?.tagName === 'BUTTON') return;
        dragging = true;
        const rect = editor.getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        originX = rect.left;
        originY = rect.top;
        event.preventDefault?.();
        startPointerDrag(
          handle,
          event,
          move,
          () => {
            dragging = false;
          }
        );
      });
    }

    function open(preferredArranger = null) {
      const modal = getElement?.('arrangerModal');
      if (!modal) return;
      modal.classList?.add?.('show');
      renderArrangerManager?.();

      const arrangers = getArrangers?.() || [];
      if (arrangers.length > 0) {
        const currentArranger = preferredArranger || getEditingArranger?.();
        const selectedArranger =
          currentArranger && arrangers.includes(currentArranger)
            ? currentArranger
            : arrangers[0];
        setEditingArr(selectedArranger);
        openArrEditor?.();
      } else {
        const editor = getElement?.('arrEditor');
        if (editor?.style) editor.style.display = 'none';
      }

      setupDrag();
      modal.focus?.();
      if (!modal._escHandler) {
        modal._escHandler = event => {
          if (event.key !== 'Escape') return;
          event.preventDefault?.();
          close();
        };
        modal.addEventListener?.('keydown', modal._escHandler);
      }
    }

    return Object.freeze({ open, close, setupDrag });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerModalService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
