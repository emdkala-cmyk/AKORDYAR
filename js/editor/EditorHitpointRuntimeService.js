(function attachEditorHitpointRuntimeService(globalScope) {
  'use strict';

  const DEFAULT_SETTINGS = Object.freeze({
    threshold: 0.18,
    intensity: 0.05,
    minimumLength: 0.08
  });

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function numberOr(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function create({
    engine = globalScope.HitpointAnalysisEngine,
    FreeWarp = globalScope.FreeWarpEngine,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getSelectedClips = () => [],
    getClip = () => null,
    getBuffer = clip => {
      const daw = getDAW();
      return daw?.bufferCache?.get?.(clip?.bufferKey || clip?.id) || null;
    },
    restoreAudio = async () => ({ loaded: 0 }),
    decodeFileToBuffer = null,
    getWarpService = () =>
      globalScope.AkordyarCoreApi?.getFreeWarpService?.() || null,
    snapTime = value => value,
    saveState = () => {},
    saveSong = () => {},
    refreshClipWaveImage = () => {},
    renderClips = () => {},
    getElement = id => globalScope.document?.getElementById?.(id),
    toast = () => {},
    setWarpMode = () => {},
    syncWarpMode = () => {},
    logger = console
  } = {}) {
    let currentClipId = null;
    let running = false;

    function audioClips() {
      return (getDAW()?.clips || []).filter(
        clip => clip && clip.type === 'audio'
      );
    }

    function selectedAudioClips() {
      return (getSelectedClips?.() || []).filter(
        clip => clip?.type === 'audio'
      );
    }

    function resolveClip() {
      const current = currentClipId ? getClip(currentClipId) : null;
      if (current?.type === 'audio') return current;

      const selected = selectedAudioClips();
      const clip = selected[0] || audioClips()[0] || null;
      currentClipId = clip?.id || null;
      return clip;
    }

    function settingsFor(clip) {
      const stored = clip?.hitpointAnalysis?.settings ||
        clip?.hitpointSettings || {};
      return {
        threshold: clamp(
          numberOr(stored.threshold, DEFAULT_SETTINGS.threshold),
          0,
          1
        ),
        intensity: clamp(
          numberOr(stored.intensity, DEFAULT_SETTINGS.intensity),
          0,
          1
        ),
        minimumLength: Math.max(
          0,
          numberOr(stored.minimumLength, DEFAULT_SETTINGS.minimumLength)
        )
      };
    }

    function writeSettings(clip, settings) {
      if (!clip) return;
      clip.hitpointSettings = { ...settings };
      if (clip.hitpointAnalysis) {
        clip.hitpointAnalysis.settings = { ...settings };
      }
    }

    function panel() {
      return getElement('hitpointModal');
    }

    function setPanelOpen(open) {
      const element = panel();
      if (!element) return;
      element.classList.toggle('show', Boolean(open));
      element.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function setPanelStatus(message) {
      const status = getElement('hitpointStatus');
      if (status) {
        status.textContent = message || '';
        status.style.display = message ? 'block' : 'none';
      }
    }

    function setBusyState(message) {
      running = Boolean(message);
      panel()?.querySelectorAll?.('.hitpoint-run-control').forEach(element => {
        element.disabled = running;
      });
      setPanelStatus(message);
    }

    function renderPanel() {
      const clip = resolveClip();
      const settings = settingsFor(clip);
      const name = getElement('hitpointClipName');
      const count = getElement('hitpointCount');
      const summary = getElement('hitpointSummary');
      const threshold = getElement('hitpointThreshold');
      const intensity = getElement('hitpointIntensity');
      const minimumLength = getElement('hitpointMinimumLength');
      const thresholdValue = getElement('hitpointThresholdValue');
      const intensityValue = getElement('hitpointIntensityValue');
      const minimumLengthValue = getElement('hitpointMinimumLengthValue');
      const showInput = getElement('hitpointShowInput');

      if (name) {
        name.textContent = clip?.name || 'کلیپ صوتی انتخاب نشده';
      }
      const hitpoints = Array.isArray(clip?.hitpoints)
        ? clip.hitpoints.filter(hitpoint => hitpoint?.enabled !== false)
        : [];
      if (count) count.textContent = String(hitpoints.length);
      if (summary) {
        if (!clip) {
          summary.textContent = 'ابتدا یک کلیپ صوتی انتخاب کنید.';
        } else if (!clip.hitpointAnalysis?.rawHitpoints) {
          summary.textContent = 'هنوز Hitpoint محاسبه نشده است.';
        } else {
          const rawCount = clip.hitpointAnalysis.rawHitpoints.length;
          summary.textContent =
            `${hitpoints.length} از ${rawCount} ترنزینت فعال است.`;
        }
      }
      if (threshold) threshold.value = String(settings.threshold);
      if (intensity) intensity.value = String(settings.intensity);
      if (minimumLength) minimumLength.value = String(settings.minimumLength);
      if (thresholdValue) {
        thresholdValue.textContent = `${Math.round(settings.threshold * 100)}%`;
      }
      if (intensityValue) {
        intensityValue.textContent = `${Math.round(settings.intensity * 100)}%`;
      }
      if (minimumLengthValue) {
        minimumLengthValue.textContent =
          `${settings.minimumLength.toFixed(2)} ثانیه`;
      }
      if (showInput) {
        showInput.checked = clip?.hitpointsVisible !== false;
      }
    }

    async function resolveBuffer(clip) {
      if (!clip) return null;
      let buffer = getBuffer(clip);
      if (buffer) return buffer;

      if (clip._originalBlob && typeof decodeFileToBuffer === 'function') {
        try {
          const decoded = await decodeFileToBuffer(clip._originalBlob);
          buffer = decoded?.buffer || decoded;
          if (buffer) {
            getDAW()?.bufferCache?.set?.(clip.bufferKey || clip.id, buffer);
            return buffer;
          }
        } catch (error) {
          logger?.warn?.('[Hitpoints] embedded audio decode failed', error);
        }
      }

      const restored = await restoreAudio();
      if (restored?.loaded) {
        const refreshedClip = getClip(clip.id) || clip;
        return getBuffer(refreshedClip);
      }
      return null;
    }

    async function withBusyState(label, task) {
      if (running) {
        toast('محاسبه Hitpoint قبلی هنوز در حال اجراست.');
        return null;
      }
      setBusyState(label);
      try {
        return await task();
      } catch (error) {
        logger?.error?.('[Hitpoints] analysis failed', error);
        toast('محاسبه Hitpoint ناموفق بود.');
        return null;
      } finally {
        setBusyState('');
        renderPanel();
      }
    }

    function persistClip(clip, { refreshWave = true } = {}) {
      saveState();
      saveSong();
      if (refreshWave) refreshClipWaveImage(clip);
      renderClips({ preserveWaveforms: true });
      renderPanel();
    }

    async function openPanel({ calculate = false } = {}) {
      const clip = resolveClip();
      setPanelOpen(true);
      renderPanel();
      if (
        calculate &&
        clip &&
        !clip.hitpointAnalysis?.rawHitpoints
      ) {
        return calculateForSelection();
      }
      return clip;
    }

    function closePanel() {
      setPanelOpen(false);
      setPanelStatus('');
    }

    async function calculateForSelection() {
      const clip = resolveClip();
      if (!clip) {
        setPanelOpen(true);
        renderPanel();
        toast('ابتدا یک کلیپ صوتی انتخاب کنید.');
        return null;
      }
      currentClipId = clip.id;
      setPanelOpen(true);
      renderPanel();

      return withBusyState('در حال محاسبه Hitpoint…', async () => {
        if (!engine?.calculateHitpoints) {
          toast('موتور Hitpoint بارگذاری نشده است.');
          return null;
        }
        const buffer = await resolveBuffer(clip);
        if (!buffer) {
          toast('فایل صوتی برای تحلیل در دسترس نیست.');
          return null;
        }

        const settings = settingsFor(clip);
        const analysisOptions = {
          ...settings,
          startTime: Math.max(0, Number(clip.offset) || 0),
          endTime:
            Math.max(0, Number(clip.offset) || 0) +
            Math.max(0, Number(clip.duration) || 0)
        };
        const result = await new Promise(resolve => {
          if (typeof globalScope.setTimeout !== 'function') {
            resolve(engine.calculateHitpoints(buffer, analysisOptions));
            return;
          }
          globalScope.setTimeout(
            () => resolve(engine.calculateHitpoints(buffer, analysisOptions)),
            0
          );
        });

        if (!result?.ok) {
          toast('سیگنال صوتی برای تشخیص Hitpoint کافی نیست.');
          return result;
        }

        const target = getClip(clip.id) || clip;
        target.hitpointAnalysis = {
          sourceRate: result.sourceRate,
          analysisRate: result.analysisRate,
          analyzedStart: result.analyzedStart,
          analyzedEnd: result.analyzedEnd,
          frameSize: result.frameSize,
          hopSize: result.hopSize,
          rawHitpoints: result.rawHitpoints,
          settings: { ...settings }
        };
        target.hitpointSettings = { ...settings };
        target.hitpoints = result.hitpoints;
        target.hitpointsVisible = true;
        persistClip(target);
        toast(`تعداد ${result.hitpoints.length} Hitpoint شناسایی شد.`);
        return result;
      });
    }

    function setSetting(name, value) {
      const clip = resolveClip();
      if (!clip || !['threshold', 'intensity', 'minimumLength'].includes(name)) {
        return;
      }
      const settings = settingsFor(clip);
      if (name === 'minimumLength') {
        settings[name] = Math.max(0, numberOr(value, settings[name]));
      } else {
        settings[name] = clamp(numberOr(value, settings[name]), 0, 1);
      }
      writeSettings(clip, settings);

      const rawHitpoints = clip.hitpointAnalysis?.rawHitpoints;
      if (Array.isArray(rawHitpoints)) {
        clip.hitpoints = engine.filterHitpoints(rawHitpoints, {
          ...settings,
          sampleRate: clip.hitpointAnalysis.sourceRate
        });
      }
      persistClip(clip);
    }

    function setVisibility(visible) {
      const clip = resolveClip();
      if (!clip) return;
      clip.hitpointsVisible = Boolean(visible);
      persistClip(clip, { refreshWave: false });
    }

    function createWarpMarkersFromHitpoints({ snapToGrid = false } = {}) {
      const clip = resolveClip();
      const warpService = getWarpService?.();
      if (!clip || !warpService || !FreeWarp) {
        toast('برای ساخت Warp Marker یک کلیپ صوتی انتخاب کنید.');
        return 0;
      }
      const hitpoints = (clip.hitpoints || []).filter(
        hitpoint =>
          hitpoint?.enabled !== false &&
          Number.isFinite(Number(hitpoint.sourceTime))
      );
      if (!hitpoints.length) {
        toast('ابتدا Hitpointها را محاسبه کنید.');
        return 0;
      }

      warpService.ensureWarpMarkers(clip.id);
      let markers = FreeWarp.sortMarkers(clip.warpMarkers || []);
      if (markers.length < 2) return 0;

      markers = markers.filter(
        marker => !String(marker.id).startsWith('hpwm_')
      );
      const baseMarkers = FreeWarp.sortMarkers(markers);
      const sourceStart = baseMarkers[0].sourceTime;
      const sourceEnd = baseMarkers[baseMarkers.length - 1].sourceTime;
      const existingSourceTimes = markers.map(marker => marker.sourceTime);
      const existingTimelineTimes = markers.map(marker => marker.timelineTime);
      const clipStart = Number(clip.start) || 0;
      const clipEnd = clipStart + Math.max(0, Number(clip.duration) || 0);
      const minimumDistance = 0.01;
      let lastTimelineTime = clipStart;
      let inserted = 0;

      for (const hitpoint of hitpoints) {
        const sourceTime = Number(hitpoint.sourceTime);
        if (
          sourceTime <= sourceStart + minimumDistance ||
          sourceTime >= sourceEnd - minimumDistance
        ) {
          continue;
        }
        if (existingSourceTimes.some(
          value => Math.abs(value - sourceTime) < minimumDistance
        )) {
          continue;
        }

        let timelineTime = FreeWarp.sourceToTimeline(
          sourceTime,
          baseMarkers
        );
        if (!Number.isFinite(timelineTime)) continue;
        if (snapToGrid) timelineTime = snapTime(timelineTime);
        timelineTime = clamp(
          timelineTime,
          clipStart + minimumDistance,
          clipEnd - minimumDistance
        );
        if (
          timelineTime <= lastTimelineTime + minimumDistance ||
          existingTimelineTimes.some(
            value => Math.abs(value - timelineTime) < minimumDistance
          )
        ) {
          continue;
        }

        markers = FreeWarp.insertMarker(
          markers,
          `hpwm_${hitpoint.id || inserted + 1}`,
          sourceTime,
          timelineTime,
          false
        );
        existingSourceTimes.push(sourceTime);
        existingTimelineTimes.push(timelineTime);
        lastTimelineTime = timelineTime;
        inserted += 1;
      }

      clip.warpMarkers = FreeWarp.sortMarkers(markers);
      if (!inserted) {
        toast('Hitpoint جدیدی برای تبدیل به Warp Marker پیدا نشد.');
        return 0;
      }

      currentClipId = clip.id;
      setWarpMode(true);
      syncWarpMode(true);
      persistClip(clip);
      warpService.renderWarpAudio?.(clip.id, { reschedule: true });
      toast(`${inserted} Warp Marker از Hitpointها ساخته شد.`);
      return inserted;
    }

    function clearHitpoints() {
      const clip = resolveClip();
      if (!clip) return;
      delete clip.hitpoints;
      delete clip.hitpointAnalysis;
      delete clip.hitpointSettings;
      delete clip.hitpointsVisible;
      persistClip(clip);
      toast('Hitpointهای کلیپ پاک شد.');
    }

    return Object.freeze({
      openPanel,
      closePanel,
      calculateForSelection,
      setSetting,
      setVisibility,
      createWarpMarkersFromHitpoints,
      clearHitpoints,
      renderPanel,
      getCurrentClip: resolveClip
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorHitpointRuntimeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
