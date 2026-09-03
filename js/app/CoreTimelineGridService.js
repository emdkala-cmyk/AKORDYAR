/**
 * CoreTimelineGridService
 *
 * Owns the core-facing bridge to TimelineGrid and the timing-change refresh
 * sequence. Grid drawing itself remains in the pure TimelineGrid module.
 */
(function attachCoreTimelineGridService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    timelineGrid = globalScope.TimelineGrid,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || {},
    getTimingContext = () =>
      globalScope.requireEditorSongStateService?.()?.getTimingContext?.() ||
      {},
    tempoMap = globalScope.TempoMap,
    getProjectEnd = () => 0,
    timeToX = () => 0,
    getElement = id => documentRef?.getElementById?.(id),
    getTimeSignatureGridConfig = () => ({}),
    getActiveQuantizeGridStep = () => 0,
    getTransportState = () => globalScope.editorTransportState || {},
    renderTracks = () => {},
    renderClips = () => {},
    updatePlayheadUI = () => {},
    startMetronome = () => {},
    resyncPlayingTransport = () => false,
    refreshPopupTimeline = () => {},
    getTransportPlayhead = () => 0,
    setTempoMap = () => false,
    setSongBaseTiming = () => {},
    saveSong = () => {},
    saveState = () => {},
    toast = () => {},
    formatTime = value => String(value),
    formatTimeSignature = value => String(value || '4/4'),
    isPerforming = () => false
  } = {}) {
    function createTempoMap(timing, daw) {
      if (!tempoMap?.create) return null;
      const raw = timing?.tempoMap || daw?.tempoMap;
      if (raw?.getGridPoints && raw?.changeAt) return raw;
      return tempoMap.create({
        tempo: timing?.tempo,
        timeSignature: timing?.timeSignature,
        tempoMap: raw
      });
    }

    function getSharedTempoMap(timing, daw) {
      if (!tempoMap?.create) return null;
      if (daw?.tempoMap?.getGridPoints && daw?.tempoMap?.changeAt) {
        return daw.tempoMap;
      }
      const map = createTempoMap(timing, daw);
      if (!map) return null;
      if (daw) daw.tempoMap = map.toJSON();
      return map;
    }

    function getCurrentPlayheadTime(daw = getDAW() || {}) {
      const currentTime = daw?.isPlaying
        ? Number(getTransportPlayhead())
        : Number(daw?.playhead);
      return Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
    }

    function normalizeSignature(value, fallback = '4/4') {
      const resolved =
        globalScope.SongMetadata?.resolveTimeSignature?.(value);
      return (
        resolved?.timeSignature ||
        (value == null || value === '' ? fallback : String(value))
      );
    }

    function resolveSignaturePreset(value, fallback = '') {
      const resolved =
        globalScope.SongMetadata?.resolveTimeSignature?.(value);
      return (
        resolved?.timeSignaturePreset ||
        (value === '2/4-feel-6/8' || value === '2/4 (حس 6/8)'
          ? '2/4-feel-6/8'
          : fallback || '')
      );
    }

    function getTimingContextAt(time = 0) {
      const base = getTimingContext() || {};
      const daw = getDAW() || {};
      const safeTime = Math.max(0, Number(time) || 0);
      const map = getSharedTempoMap(base, daw);
      const effective = map?.getTimingAt?.(safeTime) || {};
      const baseTempo =
        Number(base.tempo) > 0 ? Number(base.tempo) : 120;
      const baseTimeSignature = base.timeSignature || '4/4';

      return {
        ...base,
        baseTempo,
        baseTimeSignature,
        baseTimeSignaturePreset: base.timeSignaturePreset || '',
        tempo:
          Number(effective.tempo) > 0
            ? Number(effective.tempo)
            : baseTempo,
        timeSignature:
          effective.timeSignature || baseTimeSignature,
        tempoMap: map?.toJSON?.() || base.tempoMap || daw.tempoMap,
        timelineTime: safeTime
      };
    }

    function getRequestedTiming(change, timing, currentTiming) {
      const nextTiming = change?.nextTiming || {};
      const tempoInput = getElement('edTempo');
      const signatureInput = getElement('edTimeSig');
      const inputTempo = Number(tempoInput?.value);
      const requestedTempo =
        Number(nextTiming.tempo) > 0
          ? Number(nextTiming.tempo)
          : change?.field === 'timeSignature'
            ? Number(currentTiming?.tempo) || Number(timing?.tempo) || 120
            : inputTempo > 0
              ? inputTempo
              : Number(timing?.tempo) || 120;
      const requestedSignature =
        nextTiming.timeSignature ||
        (change?.field === 'tempo'
          ? currentTiming?.timeSignature || timing?.timeSignature || '4/4'
          : normalizeSignature(
              signatureInput?.value,
              currentTiming?.timeSignature ||
              timing?.timeSignature ||
                '4/4'
            ));
      const requestedSignaturePreset =
        nextTiming.timeSignaturePreset ||
        (change?.field === 'tempo'
          ? currentTiming?.timeSignaturePreset ||
            timing?.timeSignaturePreset ||
            ''
          : resolveSignaturePreset(
              signatureInput?.value,
              currentTiming?.timeSignaturePreset ||
                timing?.timeSignaturePreset ||
                ''
            ));

      return {
        tempo: requestedTempo,
        timeSignature: requestedSignature,
        timeSignaturePreset: requestedSignaturePreset
      };
    }

    function syncTempoMapForTimingChange(change, timing, daw) {
      const map = createTempoMap(timing, daw);
      if (!map) return null;

      const timelineTime = getCurrentPlayheadTime(daw);
      const previousTiming = change?.previousTiming;
      const sourceMap =
        previousTiming?.tempoMap ||
        timing?.tempoMap ||
        daw?.tempoMap;
      const sourceTiming = previousTiming || timing || {};
      const source = sourceMap
        ? tempoMap.create({
            tempo:
              sourceTiming?.baseTempo ||
              sourceTiming?.tempo ||
              timing?.tempo,
            timeSignature:
              sourceTiming?.baseTimeSignature ||
              sourceTiming?.timeSignature ||
              timing?.timeSignature,
            tempoMap: sourceMap
          })
        : previousTiming
          ? tempoMap.create(previousTiming)
          : map;
      const currentTiming = source.getTimingAt?.(timelineTime) || {
        tempo: timing?.tempo,
        timeSignature: timing?.timeSignature
      };
      const requestedTiming = getRequestedTiming(
        change,
        timing,
        currentTiming
      );
      const changed = source.changeAt(timelineTime, {
        tempo: requestedTiming.tempo,
        timeSignature: requestedTiming.timeSignature
      });
      const serializable = changed.toJSON();
      if (daw) daw.tempoMap = serializable;
      setTempoMap(changed);
      setSongBaseTiming?.(changed.getTimingAt?.(0) || {}, {
        previousTiming,
        nextTiming: requestedTiming,
        timelineTime
      });
      saveSong();
      return changed;
    }

    function timingChangeMarkers(timing, daw) {
      const map = getSharedTempoMap(timing, daw);
      const epsilon = Number(map?.EPSILON) || 1e-9;
      const segments = map?.getSegments?.() || [];
      return segments
        .map((event, index) => {
          const previous = segments[index - 1];
          if (!previous) return null;
          return {
            ...event,
            segmentIndex: index,
            tempoChanged:
              event.tempoMarker === true ||
              Math.abs(
                Number(event.tempo) - Number(previous.tempo)
              ) > epsilon,
            signatureChanged:
              event.signatureMarker === true ||
              String(event.timeSignature || '') !==
                String(previous.timeSignature || '') ||
              String(event.timeSignaturePreset || '') !==
                String(previous.timeSignaturePreset || '')
          };
        })
        .filter(event =>
          event &&
          Number(event.time) > epsilon &&
          (event.tempoChanged || event.signatureChanged)
        )
        .sort((left, right) => Number(left.time) - Number(right.time));
    }

    function updateTimingMarkerActiveState(time, markers = null) {
      const safeTime = Math.max(0, Number(time) || 0);
      const source = markers || timingChangeMarkers(
        getTimingContext() || {},
        getDAW() || {}
      );
      let activeTime = null;
      source.forEach(marker => {
        if (Number(marker.time) <= safeTime + 1e-9) {
          activeTime = Number(marker.time);
        }
      });

      [
        getElement('tempo-markers-overlay'),
        getElement('tempo-markers-timeline-overlay')
      ].forEach(overlay => {
        overlay?.querySelectorAll?.(
          '.timing-marker, .timing-marker-line'
        )?.forEach(marker => {
          const markerTime = Number(marker.dataset?.time);
          marker.classList?.toggle(
            'is-active',
            activeTime != null &&
              Math.abs(markerTime - activeTime) <= 1e-9
          );
        });
      });
    }

    function syncTimingControlsAt(time, mapOverride = null) {
      const timing = getTimingContext() || {};
      const daw = getDAW() || {};
      const safeTime = Math.max(0, Number(time) || 0);
      const map = mapOverride || getSharedTempoMap(timing, daw);
      const effective = map?.getTimingAt?.(safeTime) || {
        tempo: timing.tempo || 120,
        timeSignature: timing.timeSignature || '4/4'
      };
      const tempoInput = getElement('edTempo');
      const tempo = Number(effective.tempo);
      if (
        tempoInput &&
        Number.isFinite(tempo) &&
        tempo > 0 &&
        String(tempoInput.value) !== String(Math.round(tempo))
      ) {
        tempoInput.value = Math.round(tempo);
      }

      const signatureInput = getElement('edTimeSig');
      const signature = formatTimeSignature(
        effective.timeSignature || timing.timeSignature || '4/4',
        {
          ...timing,
          ...effective,
          baseTimeSignature:
            timing.timeSignature || effective.timeSignature || '4/4'
        }
      );
      if (
        signatureInput &&
        signature &&
        String(signatureInput.value) !== String(signature)
      ) {
        signatureInput.value = signature;
      }

      updateTimingMarkerActiveState(safeTime);
      return effective;
    }

    function appendTimingMarkerEntry(
      container,
      { time, segmentIndex, field, label, text, className }
    ) {
      const entry = documentRef?.createElement?.('span');
      const badge = documentRef?.createElement?.('span');
      const remove = documentRef?.createElement?.('button');
      if (!entry || !badge || !remove) return false;

      entry.className = 'timing-marker-entry';
      badge.className = `timing-marker-badge ${className}`;
      badge.textContent = text;
      badge.title = label;

      remove.className = 'timing-marker-remove';
      remove.type = 'button';
      remove.textContent = '×';
      remove.dataset.time = String(time);
      remove.dataset.segmentIndex = String(segmentIndex);
      remove.dataset.field = field;
      remove.setAttribute('aria-label', `حذف ${label}`);
      remove.title = `حذف ${label}`;
      const stopMarkerPointer = event => {
        event.preventDefault();
        event.stopPropagation();
      };
      remove.addEventListener('pointerdown', stopMarkerPointer);
      remove.addEventListener('mousedown', stopMarkerPointer);
      remove.addEventListener('click', event => {
        stopMarkerPointer(event);
        event.stopImmediatePropagation?.();
        removeTempoMarker(time, segmentIndex, field);
      });

      entry.appendChild(badge);
      entry.appendChild(remove);
      container.appendChild(entry);
      return true;
    }

    function renderTempoMarkers() {
      const timing = getTimingContext() || {};
      const daw = getDAW() || {};
      const rulerOverlay = getElement('tempo-markers-overlay');
      const timelineOverlay = getElement(
        'tempo-markers-timeline-overlay'
      );
      if (!rulerOverlay && !timelineOverlay) return;

      [rulerOverlay, timelineOverlay].forEach(element => {
        if (element) element.innerHTML = '';
      });

      const markers = timingChangeMarkers(timing, daw);
      if (!markers.length) {
        if (rulerOverlay) rulerOverlay.style.display = 'none';
        if (timelineOverlay) timelineOverlay.style.display = 'none';
        return;
      }

      if (rulerOverlay) {
        rulerOverlay.style.display = 'block';
        markers.forEach(marker => {
          const item = documentRef?.createElement?.('div');
          const stemTempo = documentRef?.createElement?.('span');
          const stemSignature = documentRef?.createElement?.('span');
          const badges = documentRef?.createElement?.('div');
          if (
            !item ||
            !stemTempo ||
            !stemSignature ||
            !badges
          ) {
            return;
          }

          const time = Number(marker.time);
          const bpm = Math.round(Number(marker.tempo) || 0);
          const signature = formatTimeSignature(
            marker.timeSignature || '4/4',
            { ...timing, ...marker, marker }
          );
          const markerParts = [];
          item.className = 'timing-marker';
          if (marker.tempoChanged) {
            item.classList.add('has-tempo-change');
            markerParts.push(`${bpm} BPM`);
            stemTempo.className = 'timing-marker-stem tempo-marker-stem';
            item.appendChild(stemTempo);
          }
          if (marker.signatureChanged) {
            item.classList.add('has-signature-change');
            markerParts.push(`سیگنچر ${signature}`);
            stemSignature.className =
              'timing-marker-stem signature-marker-stem';
            item.appendChild(stemSignature);
          }
          item.style.left = `${timeToX(time)}px`;
          item.dataset.time = String(time);
          item.title =
            `تغییر ${markerParts.join(' و ')} در ${formatTime(time)}`;

          badges.className = 'timing-marker-badges';
          if (marker.tempoChanged) {
            appendTimingMarkerEntry(badges, {
              time,
              segmentIndex: marker.segmentIndex,
              field: 'tempo',
              label: `تمپو ${bpm} BPM`,
              text: `♩ ${bpm}`,
              className: 'tempo-marker-badge'
            });
          }
          if (marker.signatureChanged) {
            appendTimingMarkerEntry(badges, {
              time,
              segmentIndex: marker.segmentIndex,
              field: 'timeSignature',
              label: `سیگنچر ${signature}`,
              text: `𝄖 ${signature}`,
              className: 'signature-marker-badge'
            });
          }
          item.appendChild(badges);
          rulerOverlay.appendChild(item);
        });
      }

      if (timelineOverlay) {
        timelineOverlay.style.display = 'block';
        markers.forEach(marker => {
          const time = Number(marker.time);
          if (marker.tempoChanged) {
            const line = documentRef?.createElement?.('div');
            if (line) {
              line.className = 'timing-marker-line tempo-marker-line';
              line.style.left = `${timeToX(time)}px`;
              line.dataset.time = String(time);
              line.title = `${Math.round(Number(marker.tempo))} BPM`;
              timelineOverlay.appendChild(line);
            }
          }
          if (marker.signatureChanged) {
            const line = documentRef?.createElement?.('div');
            if (line) {
              line.className =
                'timing-marker-line signature-marker-line';
              line.style.left = `${timeToX(time)}px`;
              line.dataset.time = String(time);
              line.title = `سیگنچر ${marker.timeSignature}`;
              timelineOverlay.appendChild(line);
            }
          }
        });
      }

      updateTimingMarkerActiveState(
        getCurrentPlayheadTime(daw),
        markers
      );
    }

    function removeTempoMarker(
      time,
      segmentIndex = null,
      field = null
    ) {
      if (isPerforming()) {
        toast('تغییر مترونوم هنگام اجرا قابل حذف نیست');
        return false;
      }

      const timing = getTimingContext() || {};
      const daw = getDAW() || {};
      const effectiveTime = getCurrentPlayheadTime(daw);
      const previousTiming = getTimingContextAt(effectiveTime);
      const map = createTempoMap(timing, daw);
      const changed = field
        ? map?.removeFieldAtIndex?.(segmentIndex, field) ||
          map?.removeFieldAt?.(time, field)
        : map?.removeAtIndex?.(segmentIndex) ||
          map?.removeAt?.(time);
      if (!changed) return false;

      const serializable = changed.toJSON();
      daw.tempoMap = serializable;
      setTempoMap(changed);
      setSongBaseTiming?.(changed.getTimingAt?.(0) || {}, {
        previousTiming,
        nextTiming: changed.getTimingAt?.(effectiveTime) || {},
        timelineTime: effectiveTime
      });
      syncTimingControlsAt(effectiveTime, changed);

      saveState();
      saveSong();
      renderTracks();
      renderRuler();
      renderClips({ preserveWaveforms: true });
      updatePlayheadUI();
      refreshPopupTimeline();

      const transportState = getTransportState() || {};
      if (transportState.metroActive && daw.isPlaying) {
        resyncPlayingTransport({ preserveOrigin: true, timingChange: true });
        startMetronome();
      }

      renderTempoMarkers();
      toast(
        `${field === 'timeSignature' ? 'سیگنچر' : field === 'tempo' ? 'تمپو' : 'مارکر زمان‌بندی'} ` +
        `در ${formatTime(Number(time) || 0)} حذف شد`
      );
      return true;
    }

    function drawLaneGrid(canvas) {
      const options = arguments[1] || {};
      if (!canvas || typeof timelineGrid?.drawLaneGrid !== 'function') {
        return;
      }
      const timing = getTimingContext() || {};
      const daw = getDAW() || {};
      return timelineGrid.drawLaneGrid(canvas, {
        total: getProjectEnd(),
        timeToX,
        tempo: timing.tempo,
        timeSignature: timing.timeSignature,
        tempoMap: getSharedTempoMap(timing, daw),
        pxPerSec: daw.pxPerSecond,
        detail: options.detail !== false
      });
    }

    function renderRuler() {
      const options = arguments[0] || {};
      if (typeof timelineGrid?.renderRuler !== 'function') return;
      const timing = getTimingContext() || {};
      const daw = getDAW() || {};
      const total = getProjectEnd();
      const result = timelineGrid.renderRuler({
        total,
        timeToX,
        tempo: timing.tempo,
        timeSignature: timing.timeSignature,
        tempoMap: getSharedTempoMap(timing, daw),
        pxPerSec: daw.pxPerSecond,
        detail: options.detail !== false,
        rulerEl: getElement('timeline-ruler'),
        labelsEl: getElement('ruler-labels'),
        tlInnerEl: getElement('tl-inner'),
        lanesEl: getElement('lanes-container'),
        onDurationChange: value => {
          daw.timelineDuration = value;
        }
      });
      renderTempoMarkers();
      return result;
    }

    function handleTimingChange() {
      const change = arguments[0] || {};
      const timing = getTimingContext() || {};
      const daw = getDAW() || {};
      syncTempoMapForTimingChange(change, timing, daw);
      const activeTiming = getTimingContextAt(
        getCurrentPlayheadTime(daw)
      );
      const config = getTimeSignatureGridConfig(
        activeTiming.timeSignature,
        activeTiming.tempo
      );
      const transportState = getTransportState() || {};
      transportState.snapValue = getActiveQuantizeGridStep(config);
      renderTracks();
      renderRuler();
      renderClips({ preserveWaveforms: true });
      updatePlayheadUI();
      refreshPopupTimeline();
      if (transportState.metroActive && getDAW()?.isPlaying) {
        resyncPlayingTransport({ preserveOrigin: true, timingChange: true });
        startMetronome();
      }
      renderTempoMarkers();
    }

    return Object.freeze({
      drawLaneGrid,
      renderRuler,
      handleTimingChange,
      renderTempoMarkers,
      removeTempoMarker,
      getTimingContextAtPlayhead: () =>
        getTimingContextAt(
          getCurrentPlayheadTime(getDAW() || {})
        ),
      syncTimingControlsAt
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreTimelineGridService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
