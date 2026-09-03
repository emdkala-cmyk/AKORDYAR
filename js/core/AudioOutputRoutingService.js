/**
 * AudioOutputRoutingService
 *
 * Builds the project's logical output buses on top of one shared
 * AudioContext:
 *
 *   backing -> main output
 *   click   -> isolated click output (when available)
 *   cue     -> isolated cue output (when available)
 *
 * The service intentionally accepts the existing DAW master gain as its
 * backing input. This keeps all current track connections compatible while
 * allowing the project to choose stereo, multi-channel or emergency
 * mono-split routing.
 */
(function attachAudioOutputRoutingService(globalScope) {
  'use strict';

  const BUS_NAMES = Object.freeze(['backing', 'click', 'cue']);

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function disconnect(node) {
    try {
      node?.disconnect?.();
    } catch (_) {
      // A test double or an already disconnected Web Audio node may throw.
    }
  }

  function connect(source, destination, output, input) {
    if (!source || !destination || typeof source.connect !== 'function') {
      return false;
    }
    try {
      if (output === undefined) source.connect(destination);
      else if (input === undefined) source.connect(destination, output);
      else source.connect(destination, output, input);
      return true;
    } catch (_) {
      try {
        source.connect(destination);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  function setGain(gainParam, value, context) {
    if (!gainParam) return;
    const numeric = Number.isFinite(Number(value)) ? Number(value) : 1;
    const now = Number.isFinite(Number(context?.currentTime))
      ? Number(context.currentTime)
      : 0;
    try {
      if (typeof gainParam.cancelScheduledValues === 'function') {
        gainParam.cancelScheduledValues(now);
      }
      if (typeof gainParam.setValueAtTime === 'function') {
        gainParam.setValueAtTime(numeric, now);
      } else {
        gainParam.value = numeric;
      }
    } catch (_) {
      try { gainParam.value = numeric; } catch (_) {}
    }
  }

  function create({
    settingsService = globalScope.ProjectPerformanceSettingsService,
    logger = globalScope.console
  } = {}) {
    const normalize = typeof settingsService?.normalize === 'function'
      ? settingsService.normalize
      : value => value || {};
    const defaultSettings = typeof settingsService?.defaultSettings === 'function'
      ? settingsService.defaultSettings
      : () => ({ audioRouting: { mode: 'stereo', fallbackMode: 'mono-split' } });
    const resolveAudioLayout =
      typeof settingsService?.resolveAudioLayout === 'function'
        ? settingsService.resolveAudioLayout
        : ({ availableChannels = 2 } = {}) => ({
            requestedMode: 'stereo',
            mode: 'stereo',
            availableChannels,
            degraded: false,
            buses: {
              backing: { channels: [0, 1], channelMode: 'stereo', isolated: false },
              click: { channels: [0, 1], channelMode: 'stereo', isolated: false },
              cue: { channels: [0, 1], channelMode: 'stereo', isolated: false }
            }
          });

    let context = null;
    let masterInput = null;
    let settings = normalize(defaultSettings());
    let layout = null;
    let graphFingerprint = '';
    let panicMuted = false;
    let nodes = {};

    function getAvailableChannels(audioContext, requested) {
      const explicit = Number(requested);
      if (Number.isFinite(explicit) && explicit > 0) {
        return Math.max(1, Math.round(explicit));
      }
      const destination = audioContext?.destination;
      const detected =
        Number(destination?.maxChannelCount) ||
        Number(destination?.channelCount) ||
        2;
      return Number.isFinite(detected) && detected > 0
        ? Math.max(1, Math.round(detected))
        : 2;
    }

    function currentAudioSettings() {
      const normalized = normalize(settings);
      return normalized?.audioRouting || {};
    }

    function createGainNode(name, gainValue = 1) {
      if (!context || typeof context.createGain !== 'function') return null;
      try {
        const gain = context.createGain();
        gain._akordyarBus = name;
        setGain(gain.gain, gainValue, context);
        return gain;
      } catch (error) {
        logger?.warn?.('[Audio Routing] Gain node creation failed:', error);
        return null;
      }
    }

    function resetGraph() {
      disconnect(masterInput);
      Object.keys(nodes).forEach(key => disconnect(nodes[key]));
      nodes = {};
      layout = null;
      graphFingerprint = '';
    }

    function canCreateIsolatedGraph(mode) {
      if (mode === 'stereo' || mode === 'muted') return true;
      return Boolean(
        typeof context?.createChannelMerger === 'function' &&
        typeof context?.createChannelSplitter === 'function'
      );
    }

    function buildGraph(availableChannels) {
      if (!context) return null;

      const audio = currentAudioSettings();
      let resolved = resolveAudioLayout({
        availableChannels,
        mode: audio.mode,
        fallbackMode: audio.fallbackMode,
        clickIsolation: audio.clickIsolation
      });

      // Older browsers and the small fake contexts used by tests may not
      // expose channel splitter/merger nodes. Keep the audio audible and
      // report the degraded effective layout instead of failing startup.
      if (!canCreateIsolatedGraph(resolved.mode)) {
        resolved = {
          ...resolved,
          mode: 'stereo',
          degraded: true,
          fallbackReason: 'channel-routing-not-supported',
          buses: {
            backing: { channels: [0, 1], channelMode: 'stereo', isolated: false },
            click: { channels: [0, 1], channelMode: 'stereo', isolated: false },
            cue: { channels: [0, 1], channelMode: 'stereo', isolated: false }
          }
        };
      }
      layout = resolved;

      const busSettings = audio.buses || {};
      nodes.outputMix = createGainNode('output-mix', panicMuted ? 0 : 1);
      nodes.backingBus = createGainNode(
        'backing',
        busSettings.backing?.enabled === false ? 0 : busSettings.backing?.gain
      );
      nodes.clickBus = createGainNode(
        'click',
        busSettings.click?.enabled === false ? 0 : busSettings.click?.gain
      );
      nodes.cueBus = createGainNode(
        'cue',
        busSettings.cue?.enabled === false ? 0 : busSettings.cue?.gain
      );

      if (!nodes.outputMix || !nodes.backingBus || !nodes.clickBus || !nodes.cueBus) {
        resetGraph();
        return null;
      }

      connect(nodes.outputMix, context.destination);
      connect(masterInput, nodes.backingBus);

      if (resolved.mode === 'multi-channel') {
        nodes.merger = context.createChannelMerger(4);
        nodes.backingSplitter = context.createChannelSplitter(2);
        connect(nodes.backingBus, nodes.backingSplitter);
        connect(nodes.backingSplitter, nodes.merger, 0, 0);
        connect(nodes.backingSplitter, nodes.merger, 1, 1);
        connect(nodes.clickBus, nodes.merger, 0, 2);
        connect(nodes.clickBus, nodes.merger, 0, 3);
        connect(nodes.cueBus, nodes.merger, 0, 2);
        connect(nodes.cueBus, nodes.merger, 0, 3);
        connect(nodes.merger, nodes.outputMix);
      } else if (resolved.mode === 'mono-split') {
        nodes.merger = context.createChannelMerger(2);
        nodes.backingSplitter = context.createChannelSplitter(2);
        nodes.backingLeftMix = createGainNode('backing-left-mix', 0.5);
        nodes.backingRightMix = createGainNode('backing-right-mix', 0.5);
        connect(nodes.backingBus, nodes.backingSplitter);
        connect(nodes.backingSplitter, nodes.backingLeftMix, 0);
        connect(nodes.backingSplitter, nodes.backingRightMix, 1);
        connect(nodes.backingLeftMix, nodes.merger, 0, 0);
        connect(nodes.backingRightMix, nodes.merger, 0, 0);
        connect(nodes.clickBus, nodes.merger, 0, 1);
        connect(nodes.cueBus, nodes.merger, 0, 1);
        connect(nodes.merger, nodes.outputMix);
      } else if (resolved.mode === 'muted') {
        // Keep the output graph alive so releasePanic/configuration remains
        // predictable; no buses are connected in the explicitly muted mode.
      } else {
        connect(nodes.backingBus, nodes.outputMix);
        connect(nodes.clickBus, nodes.outputMix);
        connect(nodes.cueBus, nodes.outputMix);
      }

      return layout;
    }

    function getFingerprint(availableChannels) {
      return JSON.stringify({
        availableChannels,
        audioRouting: currentAudioSettings()
      });
    }

    function attachContext(audioContext, {
      masterInput: nextMasterInput = null,
      settings: nextSettings = settings,
      availableChannels
    } = {}) {
      if (!audioContext) return getState();

      const contextChanged = context !== audioContext;
      const inputChanged = masterInput !== nextMasterInput;
      if (contextChanged || inputChanged) resetGraph();

      context = audioContext;
      masterInput = nextMasterInput || masterInput;
      settings = normalize(nextSettings);

      const available = getAvailableChannels(context, availableChannels);
      const fingerprint = getFingerprint(available);
      if (
        contextChanged ||
        inputChanged ||
        fingerprint !== graphFingerprint ||
        !nodes.outputMix
      ) {
        buildGraph(available);
        graphFingerprint = fingerprint;
      }
      return getState();
    }

    function configure(nextSettings, options = {}) {
      settings = normalize(nextSettings);
      if (context) {
        return attachContext(context, {
          masterInput,
          settings,
          availableChannels: options.availableChannels
        });
      }
      return getState();
    }

    function getBusDestination(name) {
      const key = String(name || '').toLowerCase();
      if (!BUS_NAMES.includes(key)) return null;
      return nodes[`${key}Bus`] || null;
    }

    function setOutputDevice(deviceId = 'default') {
      const destination = context?.destination;
      if (!destination || typeof destination.setSinkId !== 'function') {
        return Promise.resolve(false);
      }
      return Promise.resolve(destination.setSinkId(deviceId))
        .then(() => true)
        .catch(error => {
          logger?.warn?.('[Audio Routing] Output device change failed:', error);
          return false;
        });
    }

    function panic() {
      panicMuted = true;
      const now = context?.currentTime;
      setGain(nodes.outputMix?.gain, 0, context);
      return Boolean(context || nodes.outputMix || now === 0);
    }

    function releasePanic() {
      panicMuted = false;
      setGain(nodes.outputMix?.gain, 1, context);
      return true;
    }

    function getState() {
      return {
        hasContext: Boolean(context),
        hasMasterInput: Boolean(masterInput),
        panicMuted,
        layout: clone(layout),
        buses: {
          backing: Boolean(nodes.backingBus),
          click: Boolean(nodes.clickBus),
          cue: Boolean(nodes.cueBus)
        },
        outputDeviceId: currentAudioSettings().outputDeviceId || 'default'
      };
    }

    return Object.freeze({
      attachContext,
      configure,
      getBusDestination,
      setOutputDevice,
      panic,
      releasePanic,
      getState
    });
  }

  const service = Object.freeze({
    BUS_NAMES,
    create
  });
  globalScope.AudioOutputRoutingService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
