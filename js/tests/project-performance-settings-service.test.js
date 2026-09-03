const assert = require('node:assert/strict');
const ProjectPerformanceSettingsService = require(
  '../core/ProjectPerformanceSettingsService.js'
);

const defaults = ProjectPerformanceSettingsService.defaultSettings();
assert.equal(defaults.schemaVersion, 1);
assert.equal(defaults.audioRouting.mode, 'stereo');
assert.equal(defaults.audioRouting.fallbackMode, 'mono-split');
assert.equal(defaults.group.controllerRole, 'leader');

const normalized = ProjectPerformanceSettingsService.normalize({
  audioRouting: {
    mode: 'multi-channel',
    fallbackMode: 'mono-split',
    clickIsolation: true,
    buses: {
      backing: { gain: 4, channels: [0, 0, -1] },
      click: { enabled: false }
    }
  },
  group: {
    mode: 'live',
    controllerRole: 'drummer',
    countInBars: 99
  }
});

assert.equal(normalized.audioRouting.mode, 'multi-channel');
assert.equal(normalized.audioRouting.clickIsolation, true);
assert.equal(normalized.audioRouting.buses.backing.gain, 2);
assert.deepEqual(normalized.audioRouting.buses.backing.channels, [0]);
assert.equal(normalized.audioRouting.buses.click.enabled, false);
assert.equal(normalized.group.mode, 'live');
assert.equal(normalized.group.controllerRole, 'drummer');
assert.equal(normalized.group.countInBars, 16);
assert.equal(normalized.group.clickEnabled, true);

assert.deepEqual(
  ProjectPerformanceSettingsService.resolveAudioLayout({
    availableChannels: 4,
    mode: 'multi-channel',
    fallbackMode: 'mono-split'
  }).buses.click.channels,
  [2, 3]
);

const twoChannelFallback =
  ProjectPerformanceSettingsService.resolveAudioLayout({
    availableChannels: 2,
    mode: 'multi-channel',
    fallbackMode: 'mono-split'
  });
assert.equal(twoChannelFallback.mode, 'mono-split');
assert.equal(twoChannelFallback.degraded, true);
assert.deepEqual(twoChannelFallback.buses.backing.channels, [0]);
assert.deepEqual(twoChannelFallback.buses.click.channels, [1]);

const autoFallback =
  ProjectPerformanceSettingsService.resolveAudioLayout({
    availableChannels: 2,
    mode: 'auto',
    clickIsolation: true
  });
assert.equal(autoFallback.mode, 'mono-split');

const audioPreset = ProjectPerformanceSettingsService.createPreset(
  'audio',
  { mode: 'multi-channel', clickIsolation: true },
  { id: 'audio-1', name: 'Main + Click', now: () => '2026-09-03T00:00:00Z' }
);
const withPreset = ProjectPerformanceSettingsService.upsertPreset(
  defaults,
  audioPreset
);
assert.equal(withPreset.presets.active.audio, 'audio-1');
assert.equal(withPreset.presets.audio[0].settings.mode, 'multi-channel');

const withoutPreset = ProjectPerformanceSettingsService.removePreset(
  withPreset,
  'audio',
  'audio-1'
);
assert.equal(withoutPreset.presets.audio.length, 0);
assert.equal(withoutPreset.presets.active.audio, null);

console.log('Project performance settings service tests passed');
