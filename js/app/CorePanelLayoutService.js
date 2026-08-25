/**
 * CorePanelLayoutService
 *
 * Keeps the editor shell's timeline height and dockable side-panel
 * orchestration outside app/core.js. The generic panel mechanics remain in
 * DockablePanelLayoutService; this service only wires the application shell.
 */
(function attachCorePanelLayoutService(globalScope) {
  'use strict';

  const TIMELINE_PANEL_HEIGHT_KEY = 'akordyar.timelinePanelHeight';
  const DEFAULT_TIMELINE_PANEL_HEIGHT = 320;
  const MIN_TIMELINE_PANEL_HEIGHT = 120;

  function create({
    documentRef = globalScope.document,
    windowRef = globalScope,
    getElement = id => documentRef?.getElementById?.(id),
    getFocusMode = () => false,
    getPanelLayout = name => globalScope[name],
    panelLayoutService = globalScope.DockablePanelLayoutService
  } = {}) {
    function getStorage() {
      try {
        return windowRef?.localStorage || null;
      } catch (_) {
        return null;
      }
    }

    function getTimelinePanelHeight() {
      try {
        const stored = Number.parseInt(
          getStorage()?.getItem?.(TIMELINE_PANEL_HEIGHT_KEY),
          10
        );
        if (Number.isFinite(stored)) {
          return Math.max(
            MIN_TIMELINE_PANEL_HEIGHT,
            Math.min(
              Math.max(
                MIN_TIMELINE_PANEL_HEIGHT,
                (windowRef?.innerHeight || 0) - 160
              ),
              stored
            )
          );
        }
      } catch (_) {
        // localStorage may be unavailable in a restricted renderer.
      }
      return DEFAULT_TIMELINE_PANEL_HEIGHT;
    }

    function setTimelinePanelHeight(
      height,
      { persist = true } = {}
    ) {
      const app = documentRef?.querySelector?.('.app-container');
      if (!app) return DEFAULT_TIMELINE_PANEL_HEIGHT;

      const maxHeight = Math.max(
        MIN_TIMELINE_PANEL_HEIGHT,
        (windowRef?.innerHeight || 0) - 160
      );
      const nextHeight = Math.round(
        Math.max(
          MIN_TIMELINE_PANEL_HEIGHT,
          Math.min(
            maxHeight,
            Number(height) || DEFAULT_TIMELINE_PANEL_HEIGHT
          )
        )
      );
      // Keep the workspace row flexible. Resolved pixel values would freeze
      // the workspace and move the scrollbar instead of the separator.
      app.style.gridTemplateRows =
        `auto minmax(0, 1fr) 4px ${nextHeight}px`;
      if (app.dataset) app.dataset.timelinePanelHeight = String(nextHeight);

      if (persist) {
        try {
          getStorage()?.setItem?.(
            TIMELINE_PANEL_HEIGHT_KEY,
            String(nextHeight)
          );
        } catch (_) {
          // Persistence is best-effort; the current session remains resized.
        }
      }
      return nextHeight;
    }

    function syncDockableSidePanelGrid() {
      const app = documentRef?.querySelector?.('.app-container');
      const projectPanel = getElement('projectPanel');
      const songPropertiesPanel = getElement('songPropertiesPanel');
      if (!app || !projectPanel || !songPropertiesPanel) return;

      const isDocked = panel => (
        panel.style?.display !== 'none' &&
        !panel.classList?.contains?.('side-panel-floating') &&
        !panel.classList?.contains?.('side-panel-closed')
      );
      app.style.gridTemplateColumns = [
        isDocked(projectPanel) ? '240px' : '0px',
        'minmax(0, 1fr)',
        isDocked(songPropertiesPanel) ? '300px' : '0px'
      ].join(' ');
    }

    function initDockableSidePanels() {
      if (!panelLayoutService?.create) return;
      if (
        getPanelLayout('projectPanelLayout') ||
        getPanelLayout('songPropertiesPanelLayout')
      ) {
        syncDockableSidePanelGrid();
        return;
      }

      const onStateChange = () => syncDockableSidePanelGrid();
      globalScope.projectPanelLayout = panelLayoutService.create({
        documentRef,
        windowRef,
        storageKey: 'akordyar.projectPanelLayout.v1',
        panelId: 'projectPanel',
        controlsId: 'projectPanelLayoutControls',
        dragHandleId: 'projectPanelDragHandle',
        floatButtonId: 'projectPanelFloatBtn',
        maximizeButtonId: 'projectPanelMaximizeBtn',
        resetButtonId: 'projectPanelResetBtn',
        closeButtonId: 'projectPanelCloseBtn',
        restoreButtonId: 'projectPanelRestoreBtn',
        side: 'left',
        minWidth: 280,
        minHeight: 300,
        defaultFloating: { left: 24, top: 80, width: 380, height: 620 },
        onStateChange
      });
      globalScope.songPropertiesPanelLayout = panelLayoutService.create({
        documentRef,
        windowRef,
        storageKey: 'akordyar.songPropertiesPanelLayout.v1',
        panelId: 'songPropertiesPanel',
        controlsId: 'songPropertiesPanelLayoutControls',
        dragHandleId: 'songPropertiesPanelDragHandle',
        floatButtonId: 'songPropertiesPanelFloatBtn',
        maximizeButtonId: 'songPropertiesPanelMaximizeBtn',
        resetButtonId: 'songPropertiesPanelResetBtn',
        closeButtonId: 'songPropertiesPanelCloseBtn',
        restoreButtonId: 'songPropertiesPanelRestoreBtn',
        side: 'right',
        minWidth: 280,
        minHeight: 300,
        defaultFloating: { left: 0, top: 80, width: 380, height: 620 },
        onStateChange
      });
      globalScope.projectPanelLayout?.init?.();
      globalScope.songPropertiesPanelLayout?.init?.();
      syncDockableSidePanelGrid();
    }

    function togglePanel(panel) {
      const layoutNames = {
        timeline: 'timelinePanelLayout',
        sidebar: 'projectPanelLayout',
        inspector: 'songPropertiesPanelLayout'
      };
      const layout = getPanelLayout(layoutNames[panel]);
      if (layout?.toggleClosed) {
        layout.toggleClosed();
        return;
      }

      const element = panel === 'sidebar'
        ? documentRef?.querySelector?.('.sidebar')
        : panel === 'inspector'
          ? documentRef?.querySelector?.('.inspector')
          : panel === 'timeline'
            ? documentRef?.querySelector?.('.timeline')
            : null;
      if (!element) return;

      const isHidden = element.style.display === 'none';
      element.style.display = isHidden ? '' : 'none';
      if (panel !== 'timeline') return;

      const app = documentRef?.querySelector?.('.app-container');
      const separator = getElement('timelineSep');
      if (separator) separator.style.display = element.style.display;
      if (app && !getFocusMode()) {
        if (isHidden) {
          setTimelinePanelHeight(getTimelinePanelHeight());
        } else {
          app.style.gridTemplateRows = 'auto 1fr 0px 0px';
        }
      }
    }

    return Object.freeze({
      getTimelinePanelHeight,
      setTimelinePanelHeight,
      syncDockableSidePanelGrid,
      initDockableSidePanels,
      togglePanel
    });
  }

  const service = Object.freeze({ create });
  globalScope.CorePanelLayoutService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
