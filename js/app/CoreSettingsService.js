/*
 * CoreSettingsService
 *
 * Owns persisted application preferences and the settings modal. Runtime
 * state changes are injected so transport and editor services keep their
 * existing ownership.
 */
(function attachCoreSettingsService(globalScope) {
  'use strict';

  const THEMES = Object.freeze({
    dark: {
      '--dark-bg': '#0F131E',
      '--panel-bg': '#161B26',
      '--workspace-bg': '#121622',
      '--timeline-bg': '#0D1017',
      '--accent-teal': '#3FB8AF',
      '--accent-cyan-glow': '#00F2FE',
      '--accent-neon-pink': '#FF2E93'
    },
    midnight: {
      '--dark-bg': '#0a0c14',
      '--panel-bg': '#12141f',
      '--workspace-bg': '#0d0f18',
      '--timeline-bg': '#090b11',
      '--accent-teal': '#818CF8',
      '--accent-cyan-glow': '#A5B4FC',
      '--accent-neon-pink': '#FF6BB5'
    },
    ocean: {
      '--dark-bg': '#04131c',
      '--panel-bg': '#0a2230',
      '--workspace-bg': '#071b27',
      '--timeline-bg': '#051420',
      '--accent-teal': '#21D4FD',
      '--accent-cyan-glow': '#4FB3E8',
      '--accent-neon-pink': '#FF7EB3'
    },
    sunset: {
      '--dark-bg': '#1a0f14',
      '--panel-bg': '#2a1a22',
      '--workspace-bg': '#221320',
      '--timeline-bg': '#1a1018',
      '--accent-teal': '#FF9E6D',
      '--accent-cyan-glow': '#FFB1A8',
      '--accent-neon-pink': '#FF4D8D'
    },
    forest: {
      '--dark-bg': '#08130d',
      '--panel-bg': '#101f16',
      '--workspace-bg': '#0c1811',
      '--timeline-bg': '#08140d',
      '--accent-teal': '#34D399',
      '--accent-cyan-glow': '#6EE7B7',
      '--accent-neon-pink': '#F472B6'
    }
  });

  function create({
    settingsKey = 'ed_app_settings',
    documentRef = globalScope.document,
    storage = globalScope.localStorage,
    getElement = id => documentRef?.getElementById?.(id),
    getNavigator = () => globalScope.navigator,
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    getTransportState = () => null,
    ensureAudioCtx = () => {},
    getAudioContextService = () =>
      globalScope.audioContextServiceBridge || null,
    toggleMetronome = () => {},
    stopMetronome = () => {},
    startMetronome = () => {},
    updateReturnToStartButton = () => {},
    getSizeLocked = () => false,
    toggleSizeLock = () => {},
    toast = () => {},
    logger = console
  } = {}) {
    let settings = {};

    function getSettings() {
      return settings;
    }

    function loadSettings() {
      try {
        settings = JSON.parse(storage?.getItem(settingsKey) || '{}') || {};
      } catch (_) {
        settings = {};
      }
      const transportState = getTransportState?.();
      if (transportState) {
        transportState.returnToStartOnPause =
          settings.returnToStart !== false;
      }
      updateReturnToStartButton();
      return settings;
    }

    function saveSettings() {
      try {
        storage?.setItem(settingsKey, JSON.stringify(settings));
      } catch (_) {}
    }

    function applyThemeVars(vars) {
      const style = documentRef?.documentElement?.style;
      if (!style || !vars) return;
      for (const key in vars) style.setProperty(key, vars[key]);
    }

    function applyAccentVars(color) {
      const style = documentRef?.documentElement?.style;
      if (!style || !color) return;
      style.setProperty('--accent-teal', color);
      style.setProperty('--accent-cyan-glow', color);
    }

    function applyTheme(name) {
      applyThemeVars(THEMES[name] || null);
      settings.theme = name || 'dark';
      saveSettings();
      applyAccentVars(settings.accent);
    }

    function applyAccent(color) {
      applyAccentVars(color);
      settings.accent = color;
      saveSettings();
    }

    async function loadOutputDevices() {
      const select = getElement('setOutDevice');
      if (!select) return;
      try {
        const navigatorRef = getNavigator?.();
        if (navigatorRef?.mediaDevices?.enumerateDevices) {
          const devices = await navigatorRef.mediaDevices.enumerateDevices();
          devices
            .filter(device => device.kind === 'audiooutput')
            .forEach(device => {
              const option = documentRef.createElement('option');
              option.value = device.deviceId;
              option.textContent =
                device.label || `خروجی ${select.options.length + 1}`;
              select.appendChild(option);
            });
        }
      } catch (error) {
        logger.debug?.('[Settings] output device enumeration skipped', error);
      }
      select.value = settings.outDevice || 'default';
    }

    function applyOutputDevice(id) {
      settings.outDevice = id;
      saveSettings();
      try {
        const context = ensureAudioCtx();
        if (
          context?.destination &&
          typeof context.destination.setSinkId === 'function'
        ) {
          context.destination
            .setSinkId(id)
            .then(() => toast('دستگاه خروجی تغییر کرد'))
            .catch(() => toast('تغییر دستگاه پشتیبانی نمی‌شود'));
        } else {
          toast('تغییر دستگاه خروجی پشتیبانی نمی‌شود');
        }
      } catch (_) {
        toast('تغییر دستگاه خروجی پشتیبانی نمی‌شود');
      }
    }

    function previewMetronomeSound(
      soundType = settings.metroSound || 'classic'
    ) {
      const audioService = getAudioContextService?.();
      if (!audioService) return false;
      const played = audioService.playClick(true, soundType);
      if (played) toast('صدای مترونوم آزمایش شد');
      return played;
    }

    function applyMetroSound(value) {
      settings.metroSound = value || 'classic';
      saveSettings();
      previewMetronomeSound(settings.metroSound);
      const transportState = getTransportState?.();
      const daw = getDAW?.();
      if (transportState?.metroActive && daw?.isPlaying) {
        stopMetronome();
        startMetronome();
      }
    }

    function applySettingsToggles() {
      const transportState = getTransportState?.();
      const metro = getElement('setMetronome').checked;
      if (metro !== transportState?.metroActive) toggleMetronome();
      settings.metronome = metro;
      if (transportState) {
        transportState.returnToStartOnPause =
          getElement('setReturnToStart')?.checked ?? true;
        settings.returnToStart = transportState.returnToStartOnPause;
      }
      updateReturnToStartButton();
      const wantLock = getElement('setSizeLock').checked;
      if (wantLock !== !!getSizeLocked()) toggleSizeLock();
      settings.sizeLock = wantLock;
      saveSettings();
    }

    function openSettings() {
      loadSettings();
      const theme = getElement('setTheme');
      if (theme) theme.value = settings.theme || 'dark';
      const accent = getElement('setAccent');
      if (settings.accent && accent) accent.value = settings.accent;
      const metroSound = getElement('setMetroSound');
      if (metroSound) metroSound.value = settings.metroSound || 'classic';
      const metronome = getElement('setMetronome');
      if (metronome) {
        metronome.checked = !!getTransportState?.()?.metroActive;
      }
      const returnToStart = getElement('setReturnToStart');
      if (returnToStart) {
        returnToStart.checked =
          !!getTransportState?.()?.returnToStartOnPause;
      }
      const sizeLock = getElement('setSizeLock');
      if (sizeLock) sizeLock.checked = !!getSizeLocked();
      const modal = getElement('settingsModal');
      modal?.classList.add('show');
      modal?.focus?.();
      loadOutputDevices();
    }

    function closeSettings() {
      getElement('settingsModal')?.classList.remove('show');
    }

    function resetSettings() {
      try {
        storage?.removeItem(settingsKey);
      } catch (_) {}
      settings = {};
      applyTheme('dark');
      const style = documentRef?.documentElement?.style;
      style?.removeProperty('--accent-teal');
      style?.removeProperty('--accent-cyan-glow');
      style?.removeProperty('--accent-neon-pink');
      const transportState = getTransportState?.();
      if (transportState) transportState.metroActive = false;
      const metroButton = getElement('metroToggleBtn');
      if (metroButton) metroButton.textContent = '🔇';
      if (transportState) transportState.returnToStartOnPause = true;
      updateReturnToStartButton();
      if (getSizeLocked()) toggleSizeLock();
      openSettings();
      toast('تنظیمات بازنشانی شد');
    }

    function initialize() {
      loadSettings();
      if (settings.theme) applyTheme(settings.theme);
      applyAccentVars(settings.accent);
    }

    return Object.freeze({
      getSettings,
      loadSettings,
      saveSettings,
      applyTheme,
      applyAccent,
      loadOutputDevices,
      applyOutputDevice,
      applyMetroSound,
      previewMetronomeSound,
      applySettingsToggles,
      openSettings,
      closeSettings,
      resetSettings,
      initialize
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreSettingsService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
