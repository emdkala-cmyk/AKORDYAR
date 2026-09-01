/**
 * EditorToolbarDockService
 *
 * Owns the editor toolbar drag, dock/snap and context-menu interactions.
 * DOM and viewport access are injected so the editor no longer carries this
 * imperative UI block or publishes a legacy global command.
 */
(function attachEditorToolbarDockService(globalScope) {
  'use strict';

  const DOCKED_ICON =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 11l-4 4h14l-4-4"/>' +
    '<path d="M12 3v8"/><path d="M3 11h18"/></svg>';
  const FLOATING_ICON =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
    '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

  const TOOLBAR_GROUPS = Object.freeze([
    { label: 'گام و حالت', selector: '#edKey, #edKeyMode' },
    {
      label: 'تنظیمات متن',
      selector: '#edTextSize, #edTextFont, #edTextBold, ' +
        '#edAlignRight, #edAlignCenter, #edAlignLeft'
    },
    {
      label: 'تنظیمات آکورد',
      selector: '#edChordSize, #edChordFont, #edToggleChords'
    },
    {
      label: 'ترتیبی',
      selector: '#edSeqToggle, #edSeqStart, #edSeqPrev, #edSeqNext, ' +
        '#edClStart, #edClUndo, #edClClear, #edClApply, #edSeqModeSeg'
    },
    {
      label: 'ترنسپوز',
      selector: '#edTransDown, #edTransVal, #edTransUp'
    },
    { label: 'Undo/Redo', selector: '#edUndoBtn, #edRedoBtn' },
    { label: 'قفل ویرایشگر', selector: '#edEditorLockBtn' },
    { label: 'حذف ستاره', selector: '#edRemoveAsterisks' },
    { label: 'برعکس آکورد', selector: '#edReverseChords' },
    { label: 'حذف ستاره + برعکس', selector: '#edDoBoth' }
  ]);

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    getElement = id => documentRef?.getElementById?.(id),
    schedule = (...args) => windowRef?.setTimeout?.(...args)
  } = {}) {
    let bound = false;
    let toolbarDragging = false;
    let toolbarOffX = 0;
    let toolbarOffY = 0;
    let toolbarPointerId = null;
    let headerCtrl = null;
    let dragHandle = null;
    let pinBtn = null;

    function element(id) {
      return typeof getElement === 'function' ? getElement(id) : null;
    }

    function setPinIcon(icon) {
      if (pinBtn) pinBtn.innerHTML = icon;
    }

    function isDocked() {
      return (
        headerCtrl?.classList?.contains('dock-left') ||
        headerCtrl?.classList?.contains('dock-right')
      );
    }

    function toggleToolbarDock() {
      if (!headerCtrl || !pinBtn) return false;

      const isFloating = headerCtrl.classList.contains('floating');
      const docked = isDocked();
      headerCtrl.classList.remove('floating', 'dock-left', 'dock-right');

      if (isFloating || docked) {
        headerCtrl.style.cssText = 'flex-wrap:wrap; gap:4px;';
        setPinIcon(DOCKED_ICON);
        return false;
      }

      headerCtrl.classList.add('floating');
      headerCtrl.style.left = '50%';
      headerCtrl.style.top = '80px';
      headerCtrl.style.transform = 'translateX(-50%)';
      setPinIcon(FLOATING_ICON);
      return true;
    }

    function showToolbarContextMenu(event) {
      event.preventDefault?.();
      documentRef.querySelector?.('.toolbar-context-menu')?.remove?.();

      const menu = documentRef.createElement?.('div');
      if (!menu) return;
      menu.className = 'toolbar-context-menu';

      const pinItem = documentRef.createElement('div');
      pinItem.className = 'ctx-item';
      const docked = headerCtrl.classList.contains('floating') || isDocked();
      pinItem.innerHTML =
        `<span class="ctx-check">${docked ? '🔗' : '📌'}</span>` +
        `${docked ? 'اتصال به صفحه' : 'جدا کردن'}`;
      pinItem.onclick = () => {
        toggleToolbarDock();
        menu.remove?.();
      };
      menu.appendChild(pinItem);

      const separator = documentRef.createElement('div');
      separator.style.cssText = 'height:1px;background:#2d3748;margin:4px 0;';
      menu.appendChild(separator);

      const showAllItem = documentRef.createElement('div');
      showAllItem.className = 'ctx-item';
      showAllItem.innerHTML = '<span class="ctx-check">👁‍🗨</span>نمایش همه';
      showAllItem.onclick = () => {
        headerCtrl.querySelectorAll?.(
          '.ed-grp, .ed-sep, .toolbar-drag-handle, .toolbar-pin-btn'
        ).forEach(item => {
          item.style.display = '';
        });
        menu.remove?.();
      };
      menu.appendChild(showAllItem);

      const separator2 = documentRef.createElement('div');
      separator2.style.cssText = 'height:1px;background:#2d3748;margin:4px 0;';
      menu.appendChild(separator2);

      TOOLBAR_GROUPS.forEach(group => {
        const item = documentRef.createElement('div');
        item.className = 'ctx-item';
        const checkSpan = documentRef.createElement('span');
        checkSpan.className = 'ctx-check';
        const getVisible = () => {
          const items = headerCtrl.querySelectorAll?.(group.selector) || [];
          return items.length > 0 && items[0].offsetParent !== null;
        };
        const updateIcon = () => {
          checkSpan.textContent = getVisible() ? '👁' : '−';
        };
        updateIcon();
        item.appendChild(checkSpan);
        item.appendChild(documentRef.createTextNode(group.label));
        item.onclick = () => {
          const items = headerCtrl.querySelectorAll?.(group.selector) || [];
          const currentlyVisible = getVisible();
          items.forEach(target => {
            const groupElement = target.closest?.('.ed-grp') || target;
            groupElement.style.display = currentlyVisible ? 'none' : '';
          });
          updateIcon();
        };
        menu.appendChild(item);
      });

      documentRef.body?.appendChild(menu);
      if (documentRef.documentElement?.dir === 'rtl') {
        menu.style.right = Math.min(
          windowRef.innerWidth - event.clientX,
          windowRef.innerWidth - 200
        ) + 'px';
        menu.style.left = 'auto';
      } else {
        menu.style.left = Math.min(
          event.clientX,
          windowRef.innerWidth - 200
        ) + 'px';
        menu.style.right = 'auto';
      }
      menu.style.top = Math.min(
        event.clientY,
        windowRef.innerHeight - 300
      ) + 'px';

      const closeHandler = clickEvent => {
        if (menu.contains?.(clickEvent.target)) return;
        menu.remove?.();
        documentRef.removeEventListener?.('click', closeHandler);
      };
      schedule?.(() => {
        documentRef.addEventListener?.('click', closeHandler);
      }, 0);
    }

    function beginDrag(event) {
      if (
        event.target?.closest?.('.toolbar-pin-btn') ||
        event.button !== 0
      ) {
        return;
      }

      if (isDocked()) {
        headerCtrl.classList.remove('dock-left', 'dock-right');
        headerCtrl.classList.add('floating');
        setPinIcon(FLOATING_ICON);
      }
      if (!headerCtrl.classList.contains('floating')) {
        headerCtrl.classList.add('floating');
        const rect = headerCtrl.getBoundingClientRect();
        headerCtrl.style.left = rect.left + 'px';
        headerCtrl.style.top = rect.top + 'px';
        headerCtrl.style.transform = 'none';
        setPinIcon(FLOATING_ICON);
      }

      toolbarDragging = true;
      toolbarPointerId = event.pointerId;
      const rect = headerCtrl.getBoundingClientRect();
      toolbarOffX = event.clientX - rect.left;
      toolbarOffY = event.clientY - rect.top;
      dragHandle.setPointerCapture?.(event.pointerId);
      event.preventDefault?.();
    }

    function moveDrag(event) {
      if (
        !toolbarDragging ||
        event.pointerId !== toolbarPointerId
      ) {
        return;
      }

      let x = event.clientX - toolbarOffX;
      let y = event.clientY - toolbarOffY;
      x = Math.max(0, Math.min(x, windowRef.innerWidth - 60));
      y = Math.max(0, Math.min(y, windowRef.innerHeight - 40));
      headerCtrl.style.left = x + 'px';
      headerCtrl.style.top = y + 'px';
      headerCtrl.style.transform = 'none';
    }

    function finishDrag(event) {
      if (
        !toolbarDragging ||
        event.pointerId !== toolbarPointerId
      ) {
        return;
      }

      dragHandle.releasePointerCapture?.(event.pointerId);
      toolbarDragging = false;
      toolbarPointerId = null;
      const rect = headerCtrl.getBoundingClientRect();
      const snapThreshold = 40;

      if (rect.left < snapThreshold) {
        headerCtrl.classList.remove('floating', 'dock-right');
        headerCtrl.classList.add('dock-left');
        headerCtrl.style.cssText = '';
        setPinIcon(FLOATING_ICON);
      } else if (rect.right > windowRef.innerWidth - snapThreshold) {
        headerCtrl.classList.remove('floating', 'dock-left');
        headerCtrl.classList.add('dock-right');
        headerCtrl.style.cssText = '';
        setPinIcon(FLOATING_ICON);
      }
    }

    function cancelDrag() {
      toolbarDragging = false;
      toolbarPointerId = null;
    }

    function bind() {
      if (bound) return true;

      headerCtrl = element('headerCenterControls');
      dragHandle = element('toolbarDragHandle');
      pinBtn = element('toolbarPinBtn');
      if (!headerCtrl || !dragHandle || !pinBtn) return false;

      bound = true;
      dragHandle.style.touchAction = 'none';
      dragHandle.addEventListener('contextmenu', showToolbarContextMenu);
      dragHandle.addEventListener('pointerdown', beginDrag);
      dragHandle.addEventListener('pointermove', moveDrag);
      dragHandle.addEventListener('pointerup', finishDrag);
      dragHandle.addEventListener('pointercancel', cancelDrag);
      return true;
    }

    return Object.freeze({
      bind,
      toggleToolbarDock,
      toggle: toggleToolbarDock,
      isBound: () => bound
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorToolbarDockService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
