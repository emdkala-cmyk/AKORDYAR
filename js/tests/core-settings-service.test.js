const assert = require('node:assert/strict');
const SettingsService = require('../app/CoreSettingsService.js');

const storageValues = new Map([
  [
    'ed_app_settings',
    JSON.stringify({
      theme: 'ocean',
      accent: '#abc123',
      returnToStart: false,
      metroSound: 'soft',
      sizeLock: true
    })
  ]
]);
const storage = {
  getItem: key => storageValues.get(key) || null,
  setItem: (key, value) => storageValues.set(key, value),
  removeItem: key => storageValues.delete(key)
};

const styleValues = {};
const style = {
  setProperty: (key, value) => {
    styleValues[key] = value;
  },
  removeProperty: key => {
    delete styleValues[key];
  }
};

const elements = new Map();
const settingsModal = {
  classList: {
    add: value => {
      settingsModal.open = value === 'show';
    },
    remove: value => {
      if (value === 'show') settingsModal.open = false;
    }
  },
  focus: () => {
    settingsModal.focused = true;
  }
};
const outputSelect = {
  options: [],
  appendChild: option => outputSelect.options.push(option),
  value: ''
};
const themeSelect = { value: '' };
const accentInput = { value: '' };
const metroSoundSelect = { value: '' };
const metronomeInput = { checked: false };
const returnToStartInput = { checked: false };
const sizeLockInput = { checked: false };
const metroButton = { textContent: '' };
elements.set('settingsModal', settingsModal);
elements.set('setOutDevice', outputSelect);
elements.set('setTheme', themeSelect);
elements.set('setAccent', accentInput);
elements.set('setMetroSound', metroSoundSelect);
elements.set('setMetronome', metronomeInput);
elements.set('setReturnToStart', returnToStartInput);
elements.set('setSizeLock', sizeLockInput);
elements.set('metroToggleBtn', metroButton);

const calls = [];
const transportState = {
  returnToStartOnPause: true,
  metroActive: true
};
const daw = { isPlaying: true };
let sizeLocked = true;
const service = SettingsService.create({
  documentRef: {
    documentElement: { style },
    getElementById: id => elements.get(id) || null,
    createElement: () => ({
      value: '',
      textContent: ''
    })
  },
  storage,
  getElement: id => elements.get(id) || null,
  getNavigator: () => ({
    mediaDevices: {
      enumerateDevices: async () => [
        { kind: 'audiooutput', deviceId: 'out-1', label: 'Studio' },
        { kind: 'audioinput', deviceId: 'in-1', label: 'Mic' }
      ]
    }
  }),
  getDAW: () => daw,
  getTransportState: () => transportState,
  ensureAudioCtx: () => ({
    destination: {
      setSinkId: async id => calls.push(['sink', id])
    }
  }),
  getAudioContextService: () => ({
    playClick: (accent, sound) => {
      calls.push(['click', accent, sound]);
      return true;
    }
  }),
  toggleMetronome: () => {
    calls.push('toggle-metro');
    transportState.metroActive = !transportState.metroActive;
  },
  stopMetronome: () => calls.push('stop-metro'),
  startMetronome: () => calls.push('start-metro'),
  updateReturnToStartButton: () => calls.push('return-ui'),
  getSizeLocked: () => sizeLocked,
  toggleSizeLock: () => {
    calls.push('toggle-size');
    sizeLocked = !sizeLocked;
  },
  toast: value => calls.push(['toast', value]),
  logger: { debug: () => {} }
});

(async () => {
service.initialize();
assert.equal(service.getSettings().theme, 'ocean');
assert.equal(transportState.returnToStartOnPause, false);
assert.equal(styleValues['--timeline-bg'], '#051420');
assert.equal(styleValues['--accent-teal'], '#abc123');

service.applyTheme('midnight');
service.applyAccent('#fedcba');
assert.equal(service.getSettings().theme, 'midnight');
assert.equal(styleValues['--dark-bg'], '#0a0c14');
assert.equal(styleValues['--accent-teal'], '#fedcba');

service.applyMetroSound('classic');
assert.equal(service.getSettings().metroSound, 'classic');
assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'click'));
assert.ok(calls.includes('stop-metro'));
assert.ok(calls.includes('start-metro'));

metronomeInput.checked = false;
returnToStartInput.checked = true;
sizeLockInput.checked = false;
service.applySettingsToggles();
assert.equal(transportState.metroActive, false);
assert.equal(transportState.returnToStartOnPause, true);
assert.equal(sizeLocked, false);
assert.equal(service.getSettings().sizeLock, false);

service.openSettings();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(settingsModal.open, true);
assert.equal(settingsModal.focused, true);
assert.equal(themeSelect.value, 'midnight');
assert.equal(accentInput.value, '#fedcba');
assert.equal(metroSoundSelect.value, 'classic');
assert.equal(outputSelect.value, 'default');
assert.equal(outputSelect.options.length, 1);

service.applyOutputDevice('out-1');
await new Promise(resolve => setTimeout(resolve, 0));
assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'sink' && call[1] === 'out-1'));
assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'toast' && call[1] === 'دستگاه خروجی تغییر کرد'));

sizeLocked = true;
transportState.metroActive = true;
service.resetSettings();
assert.equal(service.getSettings().theme, 'dark');
assert.equal(transportState.metroActive, false);
assert.equal(transportState.returnToStartOnPause, true);
assert.equal(sizeLocked, false);
assert.equal(metroButton.textContent, '🔇');

console.log('CoreSettingsService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
