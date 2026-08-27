/**
 * EditorArrangerMarkerControllerService
 *
 * Coordinates the opt-in arranger A/B markers in the timeline. It receives
 * editor callbacks through dependency injection so marker behavior stays
 * independent from loop points and from the large app/core.js module.
 */
(function attachEditorArrangerMarkerControllerService(globalScope) {
  function create({
    getDAW,
    markerService = globalScope.ArrangerMarkerService,
    getProjectEnd,
    timeToX,
    xToTime,
    clamp,
    getElement = id => globalScope.document?.getElementById(id),
    documentRef = globalScope.document,
    isPerforming = () => false,
    startPointerDrag = (...args) =>
      globalScope.EditorRuntimeAdapter?.startPointerDrag?.(...args),
    saveState = () => {},
    saveSong = () => {},
    toast = () => {},
    formatTime = value => String(value)
  } = {}) {
    if (typeof getDAW !== 'function') {
      throw new TypeError(
        'EditorArrangerMarkerControllerService requires getDAW'
      );
    }
    if (typeof getProjectEnd !== 'function') {
      throw new TypeError(
        'EditorArrangerMarkerControllerService requires getProjectEnd'
      );
    }
    if (typeof timeToX !== 'function' || typeof xToTime !== 'function') {
      throw new TypeError(
        'EditorArrangerMarkerControllerService requires timeline converters'
      );
    }
    if (typeof clamp !== 'function') {
      throw new TypeError(
        'EditorArrangerMarkerControllerService requires clamp'
      );
    }

    function getArrangerMarkers() {
      const daw = getDAW();
      const normalize = markerService?.normalize;
      if (typeof normalize === 'function') {
        daw.arrangerMarkers = normalize(daw.arrangerMarkers);
      } else if (
        !daw.arrangerMarkers ||
        typeof daw.arrangerMarkers !== 'object'
      ) {
        daw.arrangerMarkers = {
          enabled: false,
          start: 0,
          end: 0
        };
      }
      return daw.arrangerMarkers;
    }

    function persistArrangerMarkers() {
      saveState();
      if (typeof saveSong === 'function') saveSong();
    }

    function setArrangerA() {
      if (isPerforming()) {
        toast('markerهای ارنجر هنگام اجرا قابل تغییر نیستند');
        return;
      }
      const markers = getArrangerMarkers();
      markers.enabled = true;
      const maxTime = getProjectEnd();
      const start = Math.min(
        clamp(getDAW().playhead, 0, maxTime),
        Math.max(0, maxTime - 0.5)
      );
      markers.start = start;
      if (!(markers.end > start)) {
        markers.end = Math.min(
          maxTime,
          Math.max(start + 0.5, start + 5)
        );
      }
      renderArrangerMarkers();
      persistArrangerMarkers();
      toast('شروع ارنجر A: ' + formatTime(markers.start));
    }

    function setArrangerB() {
      if (isPerforming()) {
        toast('markerهای ارنجر هنگام اجرا قابل تغییر نیستند');
        return;
      }
      const markers = getArrangerMarkers();
      markers.enabled = true;
      const end = Math.max(
        0.5,
        clamp(getDAW().playhead, 0, getProjectEnd())
      );
      markers.end = end;
      if (!(markers.end > markers.start)) {
        markers.start = Math.max(0, end - 5);
      }
      renderArrangerMarkers();
      persistArrangerMarkers();
      toast('تعویض ارنجر B: ' + formatTime(markers.end));
    }

    function clearArrangerMarkers() {
      if (isPerforming()) {
        toast('markerهای ارنجر هنگام اجرا قابل تغییر نیستند');
        return;
      }
      getDAW().arrangerMarkers = {
        enabled: false,
        start: 0,
        end: 0
      };
      renderArrangerMarkers();
      persistArrangerMarkers();
      toast('markerهای ارنجر پاک شد');
    }

    function toggleArrangerMarkers() {
      if (isPerforming()) {
        toast('markerهای ارنجر هنگام اجرا قابل تغییر نیستند');
        return;
      }
      const markers = getArrangerMarkers();
      markers.enabled = markers.enabled !== true;
      renderArrangerMarkers();
      persistArrangerMarkers();
      toast(
        markers.enabled
          ? 'A/B ارنجر فعال شد'
          : 'A/B ارنجر غیرفعال شد'
      );
    }

    function renderArrangerMarkers() {
      const markers = getArrangerMarkers();
      const enabled = markers.enabled === true;
      const start = Number(markers.start);
      const end = Number(markers.end);
      const hasRange =
        enabled &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end > start;
      const toggle = getElement('arranger-marker-toggle');
      const controls = getElement('arranger-marker-controls');
      const rulerOverlay = getElement('arranger-markers-overlay');
      const timelineOverlay = getElement(
        'arranger-markers-timeline-overlay'
      );
      const markerA = getElement('arranger-marker-a');
      const markerB = getElement('arranger-marker-b');
      const lineA = getElement('arranger-marker-line-a');
      const lineB = getElement('arranger-marker-line-b');

      if (toggle) {
        toggle.classList.toggle('arranger-marker-enabled', enabled);
        toggle.setAttribute('aria-pressed', String(enabled));
        toggle.title = enabled
          ? 'غیرفعال‌سازی A/B ارنجر'
          : 'فعال‌سازی A/B ارنجر';
      }
      if (controls) controls.style.display = enabled ? 'flex' : 'none';
      [rulerOverlay, timelineOverlay].forEach(element => {
        if (element) {
          element.style.display = hasRange ? 'block' : 'none';
        }
      });
      if (!hasRange) return;

      const xA = timeToX(start);
      const xB = timeToX(end);
      if (markerA) markerA.style.left = `${xA - 8}px`;
      if (markerB) markerB.style.left = `${xB - 8}px`;
      if (lineA) lineA.style.left = `${xA}px`;
      if (lineB) lineB.style.left = `${xB}px`;
    }

    let dragBound = false;
    function bindDrag() {
      if (dragBound || !documentRef) return;
      dragBound = true;
      let dragTarget = null;

      getElement('arranger-marker-a')?.addEventListener(
        'pointerdown',
        event => {
          if (event.button !== 0 || isPerforming()) return;
          event.stopPropagation();
          event.preventDefault();
          dragTarget = 'A';
          startPointerDrag(
            event.currentTarget,
            event,
            onDragMove,
            onDragUp
          );
        }
      );
      getElement('arranger-marker-b')?.addEventListener(
        'pointerdown',
        event => {
          if (event.button !== 0 || isPerforming()) return;
          event.stopPropagation();
          event.preventDefault();
          dragTarget = 'B';
          startPointerDrag(
            event.currentTarget,
            event,
            onDragMove,
            onDragUp
          );
        }
      );

      function onDragMove(event) {
        if (!dragTarget) return;
        const inner = getElement('tl-inner');
        if (!inner) return;
        const rect = inner.getBoundingClientRect();
        const markers = getArrangerMarkers();
        const time = clamp(
          xToTime(event.clientX - rect.left),
          0,
          getProjectEnd()
        );
        if (dragTarget === 'A') {
          markers.start = Math.max(
            0,
            Math.min(
              time,
              markers.end > 0 ? markers.end - 0.5 : time
            )
          );
        } else {
          markers.end = Math.max(time, markers.start + 0.5);
        }
        renderArrangerMarkers();
      }

      function onDragUp() {
        if (dragTarget) persistArrangerMarkers();
        dragTarget = null;
        documentRef.removeEventListener('mousemove', onDragMove);
        documentRef.removeEventListener('mouseup', onDragUp);
      }
    }

    return Object.freeze({
      getArrangerMarkers,
      persistArrangerMarkers,
      setArrangerA,
      setArrangerB,
      clearArrangerMarkers,
      toggleArrangerMarkers,
      renderArrangerMarkers,
      bindDrag
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorArrangerMarkerControllerService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
