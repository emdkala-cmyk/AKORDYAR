const assert = require('node:assert/strict');
const MidiConnectionService = require('../editor/EditorMidiConnectionService.js');

function input() {
  return { onmidimessage: null };
}

const first = input();
const second = input();
const access = {
  inputs: {
    forEach(callback) {
      callback(first);
      callback(second);
    }
  }
};
const elements = new Map([
  ['tab-midi-sync', {
    classList: {
      active: false,
      toggle(name, value) {
        if (name === 'active-pink') this.active = value;
      }
    }
  }],
  ['midiSyncLabel', { textContent: '' }]
]);
let midiAccess = null;
let syncActive = false;
let requested = 0;
let messages = 0;
const toasts = [];

const service = MidiConnectionService.create({
  navigatorRef: {
    requestMIDIAccess: async () => {
      requested += 1;
      return access;
    }
  },
  getElement: id => elements.get(id),
  getMidiAccess: () => midiAccess,
  setMidiAccess: value => { midiAccess = value; },
  getSyncActive: () => syncActive,
  setSyncActive: value => { syncActive = value; },
  onMessage: () => { messages += 1; },
  toast: message => toasts.push(message),
  logger: { error() {} }
});

(async () => {
  assert.equal(await service.connect(), true);
  assert.equal(requested, 1);
  assert.equal(midiAccess, access);
  assert.equal(first.onmidimessage instanceof Function, true);
  assert.equal(second.onmidimessage instanceof Function, true);
  first.onmidimessage({ data: [0x90, 60, 100] });
  assert.equal(messages, 1);
  assert.equal(syncActive, true);
  assert.equal(elements.get('tab-midi-sync').classList.active, true);
  assert.equal(elements.get('midiSyncLabel').textContent, 'ON');
  assert.equal(toasts.length, 2);

  assert.equal(service.disconnect(), true);
  assert.equal(first.onmidimessage, null);
  assert.equal(second.onmidimessage, null);
  assert.equal(syncActive, false);
  assert.equal(elements.get('tab-midi-sync').classList.active, false);
  assert.equal(elements.get('midiSyncLabel').textContent, 'OFF');
  assert.equal(toasts.at(-1), 'MIDI قطع شد');

  const unsupported = MidiConnectionService.create({
    navigatorRef: {},
    toast: message => toasts.push(message)
  });
  assert.equal(await unsupported.connect(), false);
  assert.equal(toasts.at(-1), 'MIDI پشتیبانی نمیشه (HTTPS لازمه)');

  console.log('EditorMidiConnectionService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
