/**
 * ProjectPerformanceSettingsService
 *
 * Serializable project-level settings for group performance.  The service is
 * deliberately independent from Web Audio and the DOM so it can be used by
 * archive import/export, runtime hydration, presets and tests.
 */
(function attachProjectPerformanceSettingsService(globalScope) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const AUDIO_MODES = Object.freeze([
    'stereo',
    'multi-channel',
    'mono-split',
    'auto'
  ]);
  const FALLBACK_MODES = Object.freeze([
    'stereo',
    'mono-split',
    'muted'
  ]);
  const GROUP_MODES = Object.freeze([
    'rehearsal',
    'live',
    'recording'
  ]);
  const CONTROLLER_ROLES = Object.freeze([
    'leader',
    'drummer',
    'keyboardist',
    'sound-engineer'
  ]);
  const PRESET_KINDS = Object.freeze(['audio', 'group', 'song']);

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum, maximum, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(minimum, Math.min(maximum, numeric));
  }

  function positiveInteger(value, fallback) {
    const numeric = Math.round(Number(value));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }

  function normalizeChannels(value, fallback) {
    const source = Array.isArray(value) ? value : fallback;
    const result = [];
    source.forEach(channel => {
      const numeric = Math.round(Number(channel));
      if (
        Number.isFinite(numeric) &&
        numeric >= 0 &&
        !result.includes(numeric)
      ) {
        result.push(numeric);
      }
    });
    return result.length ? result : [...fallback];
  }

  function normalizeBus(value, fallback) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      enabled: source.enabled !== false,
      gain: clamp(source.gain, 0, 2, fallback.gain),
      channels: normalizeChannels(source.channels, fallback.channels)
    };
  }

  function defaultSettings() {
    return {
      schemaVersion: SCHEMA_VERSION,
      audioRouting: {
        mode: 'stereo',
        fallbackMode: 'mono-split',
        clickIsolation: false,
        outputDeviceId: 'default',
        buses: {
          backing: {
            enabled: true,
            gain: 1,
            channels: [0, 1]
          },
          click: {
            enabled: true,
            gain: 1,
            channels: [2, 3]
          },
          cue: {
            enabled: true,
            gain: 1,
            channels: [2, 3]
          }
        }
      },
      group: {
        mode: 'rehearsal',
        controllerRole: 'leader',
        clickRecipient: 'drummer',
        clickEnabled: true,
        cueEnabled: true,
        countInBars: 0,
        lockDuringPerformance: false
      },
      presets: {
        audio: [],
        group: [],
        song: [],
        active: {
          audio: null,
          group: null,
          song: null
        }
      }
    };
  }

  function normalizePresetKind(value) {
    const kind = String(value || '').trim().toLowerCase();
    return kind === 'band' ? 'group' : kind;
  }

  function normalizePreset(value, kind) {
    if (!value || typeof value !== 'object') return null;
    const normalizedKind = normalizePresetKind(kind || value.kind);
    if (!PRESET_KINDS.includes(normalizedKind)) return null;
    const createdAt = value.createdAt || null;
    const updatedAt = value.updatedAt || createdAt;
    return {
      id: String(value.id || ''),
      name: String(value.name || 'بدون نام'),
      kind: normalizedKind,
      schemaVersion: Number(value.schemaVersion) || SCHEMA_VERSION,
      createdAt,
      updatedAt,
      settings: clone(value.settings || {})
    };
  }

  function normalizePresets(value) {
    const source = value && typeof value === 'object' ? value : {};
    const result = {
      audio: [],
      group: [],
      song: [],
      active: {
        audio: null,
        group: null,
        song: null
      }
    };

    PRESET_KINDS.forEach(kind => {
      const list = Array.isArray(source[kind])
        ? source[kind]
        : kind === 'group' && Array.isArray(source.band)
          ? source.band
          : [];
      result[kind] = list
        .map(item => normalizePreset(item, kind))
        .filter(Boolean);
    });

    const active = source.active && typeof source.active === 'object'
      ? source.active
      : {};
    PRESET_KINDS.forEach(kind => {
      const activeId = active[kind] ?? (
        kind === 'group' ? active.band : null
      );
      result.active[kind] =
        activeId == null || activeId === ''
          ? null
          : String(activeId);
    });
    return result;
  }

  function normalize(value) {
    const defaults = defaultSettings();
    const source = value && typeof value === 'object' ? value : {};
    const audioSource =
      source.audioRouting || source.audio || source.routing || {};
    const busSource = audioSource.buses || {};
    const groupSource =
      source.group || source.band || source.performance || {};

    const audioRouting = {
      mode: AUDIO_MODES.includes(audioSource.mode)
        ? audioSource.mode
        : defaults.audioRouting.mode,
      fallbackMode: FALLBACK_MODES.includes(audioSource.fallbackMode)
        ? audioSource.fallbackMode
        : defaults.audioRouting.fallbackMode,
      clickIsolation: audioSource.clickIsolation === true,
      outputDeviceId: String(
        audioSource.outputDeviceId ||
        audioSource.outDevice ||
        defaults.audioRouting.outputDeviceId
      ),
      buses: {
        backing: normalizeBus(
          busSource.backing || audioSource.backing,
          defaults.audioRouting.buses.backing
        ),
        click: normalizeBus(
          busSource.click || audioSource.click,
          defaults.audioRouting.buses.click
        ),
        cue: normalizeBus(
          busSource.cue || audioSource.cue,
          defaults.audioRouting.buses.cue
        )
      }
    };

    const group = {
      mode: GROUP_MODES.includes(groupSource.mode)
        ? groupSource.mode
        : defaults.group.mode,
      controllerRole: CONTROLLER_ROLES.includes(groupSource.controllerRole)
        ? groupSource.controllerRole
        : defaults.group.controllerRole,
      clickRecipient: String(
        groupSource.clickRecipient || defaults.group.clickRecipient
      ),
      clickEnabled: groupSource.clickEnabled !== false,
      cueEnabled: groupSource.cueEnabled !== false,
      countInBars: Math.max(
        0,
        Math.min(16, Math.round(Number(groupSource.countInBars) || 0))
      ),
      lockDuringPerformance: groupSource.lockDuringPerformance === true
    };

    return {
      schemaVersion: SCHEMA_VERSION,
      audioRouting,
      group,
      presets: normalizePresets(source.presets)
    };
  }

  function migrate(value) {
    return normalize(value);
  }

  function normalizeEffectiveSources(sources) {
    const list = Array.isArray(sources) ? sources : [];
    const output = {};
    list.forEach(source => {
      if (!source || typeof source !== 'object') return;
      Object.assign(output, source);
    });
    return normalize(output);
  }

  function createPreset(kind, settings, {
    id = null,
    name = 'بدون نام',
    now = () => new Date().toISOString()
  } = {}) {
    const normalizedKind = normalizePresetKind(kind);
    if (!PRESET_KINDS.includes(normalizedKind)) {
      throw new TypeError(`Unsupported performance preset kind: ${kind}`);
    }

    const timestamp = now();
    let presetSettings = clone(settings || {});
    if (normalizedKind === 'audio') {
      presetSettings = normalize({ audioRouting: presetSettings }).audioRouting;
    } else if (normalizedKind === 'group') {
      presetSettings = normalize({ group: presetSettings }).group;
    }

    return {
      id: String(
        id ||
        `preset_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 8)}`
      ),
      name: String(name || 'بدون نام'),
      kind: normalizedKind,
      schemaVersion: SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
      settings: presetSettings
    };
  }

  function upsertPreset(value, preset) {
    const normalized = normalize(value);
    const nextPreset = normalizePreset(preset);
    if (!nextPreset) return normalized;
    const list = normalized.presets[nextPreset.kind];
    const index = list.findIndex(item => item.id === nextPreset.id);
    if (index >= 0) list[index] = nextPreset;
    else list.push(nextPreset);
    normalized.presets.active[nextPreset.kind] = nextPreset.id;
    return normalized;
  }

  function removePreset(value, kind, id) {
    const normalized = normalize(value);
    const normalizedKind = normalizePresetKind(kind);
    if (!PRESET_KINDS.includes(normalizedKind)) return normalized;
    normalized.presets[normalizedKind] =
      normalized.presets[normalizedKind].filter(
        preset => preset.id !== String(id)
      );
    if (normalized.presets.active[normalizedKind] === String(id)) {
      normalized.presets.active[normalizedKind] = null;
    }
    return normalized;
  }

  function resolveAudioLayout({
    availableChannels = 2,
    mode = 'stereo',
    fallbackMode = 'mono-split',
    clickIsolation = false
  } = {}) {
    const available = positiveInteger(availableChannels, 2);
    const requestedMode = AUDIO_MODES.includes(mode) ? mode : 'stereo';
    const requestedFallback = FALLBACK_MODES.includes(fallbackMode)
      ? fallbackMode
      : 'mono-split';

    let effectiveMode = requestedMode;
    if (
      requestedMode === 'auto' &&
      clickIsolation
    ) {
      effectiveMode = available >= 4 ? 'multi-channel' : requestedFallback;
    } else if (
      requestedMode === 'multi-channel' &&
      available < 4
    ) {
      effectiveMode = requestedFallback;
    }

    if (effectiveMode === 'mono-split' && available < 2) {
      effectiveMode = 'muted';
    }
    if (effectiveMode === 'muted') {
      return {
        requestedMode,
        mode: 'muted',
        availableChannels: available,
        degraded: true,
        buses: {
          backing: { channels: [], channelMode: 'muted', isolated: false },
          click: { channels: [], channelMode: 'muted', isolated: false },
          cue: { channels: [], channelMode: 'muted', isolated: false }
        }
      };
    }

    if (effectiveMode === 'multi-channel') {
      return {
        requestedMode,
        mode: 'multi-channel',
        availableChannels: available,
        degraded: false,
        buses: {
          backing: {
            channels: [0, 1],
            channelMode: 'stereo',
            isolated: true
          },
          click: {
            channels: [2, 3],
            channelMode: 'stereo',
            isolated: true
          },
          cue: {
            channels: [2, 3],
            channelMode: 'stereo',
            isolated: true
          }
        }
      };
    }

    if (effectiveMode === 'mono-split') {
      return {
        requestedMode,
        mode: 'mono-split',
        availableChannels: available,
        degraded: requestedMode !== 'mono-split' || available < 4,
        buses: {
          backing: {
            channels: [0],
            channelMode: 'mono',
            isolated: true
          },
          click: {
            channels: [1],
            channelMode: 'mono',
            isolated: true
          },
          cue: {
            channels: [1],
            channelMode: 'mono',
            isolated: true
          }
        }
      };
    }

    return {
      requestedMode,
      mode: 'stereo',
      availableChannels: available,
      degraded: requestedMode !== 'stereo',
      buses: {
        backing: {
          channels: [0, 1],
          channelMode: 'stereo',
          isolated: false
        },
        click: {
          channels: [0, 1],
          channelMode: 'stereo',
          isolated: false
        },
        cue: {
          channels: [0, 1],
          channelMode: 'stereo',
          isolated: false
        }
      }
    };
  }

  const service = Object.freeze({
    SCHEMA_VERSION,
    AUDIO_MODES,
    FALLBACK_MODES,
    GROUP_MODES,
    CONTROLLER_ROLES,
    PRESET_KINDS,
    clone,
    defaultSettings,
    normalize,
    migrate,
    normalizePreset,
    normalizePresetKind,
    createPreset,
    upsertPreset,
    removePreset,
    normalizeEffectiveSources,
    resolveAudioLayout
  });

  globalScope.ProjectPerformanceSettingsService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
