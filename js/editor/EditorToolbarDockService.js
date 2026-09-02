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
    { key: 'key', label: 'گام و حالت', selector: '#edOrigKeyLabel, #edKey, #edKeyMode' },
    {
      key: 'transpose',
      label: 'ترنسپوز و دیز/بمل',
      selector: '#edTransDown, #edTransVal, #edTransUp, #edToggleAccidental'
    },
    {
      key: 'text',
      label: 'تنظیمات متن',
      selector: '#edTextBold, ' +
        '#edAlignRight, #edAlignCenter, #edAlignLeft'
    },
    {
      key: 'fonts',
      label: 'Font and size',
      selector: '#edTextSize, #edTextFont, #edChordSize, #edChordFont'
    },
    {
      key: 'chord',
      label: 'تنظیمات آکورد',
      selector: '#edSizeLockBtn, #edToggleChords, #edRandomTextColor, ' +
        '#edRandomChordColor'
    },
    {
      key: 'sequence',
      label: 'آکوردگذاری ترتیبی',
      selector: '#edSeqToggle, #edSeqStart, #edSeqPrev, #edSeqNext, ' +
        '#edSeqModeSeg, #edSeqModeLyrics, #edSeqModeChord, ' +
        '#edClStart, #edClUndo, #edClClear, #edClApply'
    },
    { key: 'actions', label: 'قفل ویرایشگر', selector: '#edEditorLockBtn' },
    {
      key: 'cleanup',
      label: 'ابزارهای پاک‌سازی',
      selector: '#edRemoveAsterisks, #edReverseChords, #edDoBoth'
    },
    { key: 'sync', label: 'سینک کورد لاین', selector: '#edSyncChordLineBtn' }
  ]);

  const PRESET_STORAGE_KEY = 'akordyar.editor.toolbar.presets.v1';

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

    function getStorage() {
      try {
        return windowRef?.localStorage || globalScope.localStorage || null;
      } catch (_) {
        return null;
      }
    }

    function readPresets() {
      const storage = getStorage();
      if (!storage) return {};
      try {
        const parsed = JSON.parse(storage.getItem(PRESET_STORAGE_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (_) {
        return {};
      }
    }

    function writePresets(presets) {
      const storage = getStorage();
      if (!storage) return false;
      try {
        storage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
        return true;
      } catch (_) {
        return false;
      }
    }

    function isGroupVisible(group) {
      const items = headerCtrl?.querySelectorAll?.(group.selector) || [];
      return items.length > 0 && [...items].some(item => item.offsetParent !== null);
    }

    function setGroupVisible(group, visible) {
      const items = headerCtrl?.querySelectorAll?.(group.selector) || [];
      const containers = new Set();
      items.forEach(target => {
        const container =
          target.closest?.('.ed-font-tools') ||
          target.closest?.('.ed-grp') ||
          target;
        if (container) containers.add(container);
      });
      containers.forEach(container => {
        container.style.display = visible ? '' : 'none';
      });
      return containers.size > 0;
    }

    function captureVisibility() {
      return TOOLBAR_GROUPS.reduce((snapshot, group) => {
        snapshot[group.key] = isGroupVisible(group);
        return snapshot;
      }, {});
    }

    function saveCurrentPreset(name) {
      const normalized = String(name || '').trim();
      if (!normalized) return false;
      const presets = readPresets();
      presets[normalized] = {
        name: normalized,
        visibility: captureVisibility(),
        updatedAt: new Date().toISOString()
      };
      return writePresets(presets);
    }

    function applyPreset(preset) {
      if (!preset?.visibility) return false;
      TOOLBAR_GROUPS.forEach(group => {
        if (typeof preset.visibility[group.key] === 'boolean') {
          setGroupVisible(group, preset.visibility[group.key]);
        }
      });
      return true;
    }

    function deletePreset(name) {
      const presets = readPresets();
      if (!Object.prototype.hasOwnProperty.call(presets, name)) return false;
      delete presets[name];
      return writePresets(presets);
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
        TOOLBAR_GROUPS.forEach(group => setGroupVisible(group, true));
        headerCtrl.querySelectorAll?.(
          '.ed-sep, .ed-font-tools, .toolbar-drag-handle, .toolbar-pin-btn'
        ).forEach(item => { item.style.display = ''; });
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
        const getVisible = () => isGroupVisible(group);
        const updateIcon = () => {
          checkSpan.textContent = getVisible() ? '👁' : '−';
        };
        updateIcon();
        item.appendChild(checkSpan);
        item.appendChild(documentRef.createTextNode(group.label));
        item.onclick = () => {
          const currentlyVisible = getVisible();
          setGroupVisible(group, !currentlyVisible);
          updateIcon();
        };
        menu.appendChild(item);
      });

      const presetSeparator = documentRef.createElement('div');
      presetSeparator.style.cssText = 'height:1px;background:#2d3748;margin:4px 0;';
      menu.appendChild(presetSeparator);

      const presetHeading = documentRef.createElement('div');
      presetHeading.className = 'ctx-section-title';
      presetHeading.textContent = 'چیدمان‌های سفارشی';
      menu.appendChild(presetHeading);

      const savePresetItem = documentRef.createElement('div');
      savePresetItem.className = 'ctx-item ctx-preset-save';
      savePresetItem.innerHTML = '<span class="ctx-check">＋</span>ذخیره چیدمان فعلی';
      savePresetItem.onclick = () => {
        const prompt = windowRef?.prompt;
        const name = typeof prompt === 'function'
          ? prompt.call(windowRef, 'نام این چیدمان را وارد کنید:', '')
          : '';
        if (saveCurrentPreset(name)) {
          showToolbarContextMenu(event);
        } else {
          menu.remove?.();
        }
      };
      menu.appendChild(savePresetItem);

      Object.entries(readPresets()).forEach(([name, preset]) => {
        const row = documentRef.createElement('div');
        row.className = 'ctx-preset-row';

        const loadItem = documentRef.createElement('span');
        loadItem.className = 'ctx-preset-load';
        loadItem.textContent = name;
        loadItem.title = 'فراخوانی چیدمان';
        loadItem.onclick = () => {
          applyPreset(preset);
          menu.remove?.();
        };
        row.appendChild(loadItem);

        const deleteItem = documentRef.createElement('button');
        deleteItem.className = 'ctx-preset-delete';
        deleteItem.type = 'button';
        deleteItem.textContent = '×';
        deleteItem.title = 'حذف چیدمان';
        deleteItem.onclick = clickEvent => {
          clickEvent.stopPropagation?.();
          if (deletePreset(name)) row.remove?.();
        };
        row.appendChild(deleteItem);
        menu.appendChild(row);
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
