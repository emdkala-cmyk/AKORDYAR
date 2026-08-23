const assert = require('node:assert/strict');
const menuModule = require('../core/ElectronMenuCommandService.js');

const original = {};
[
  'edNewSong',
  'edImportProject',
  'edSaveSong',
  'edExportProjectFull',
  'getEditorDAW',
  'startTransport',
  'pauseTransport',
  'stopTransport',
  'transportToStart',
  'transportToEnd',
  'openArrangerModal',
  'edOpenArchive',
  'getMidiScoreController',
  'openSettings'
].forEach(name => {
  original[name] = globalThis[name];
});

const calls = [];
globalThis.edNewSong = () => calls.push('new');
globalThis.edImportProject = () => calls.push('open');
globalThis.edSaveSong = () => calls.push('save');
globalThis.edExportProjectFull = () => calls.push('export');
globalThis.getEditorDAW = () => ({ isPlaying: false });
globalThis.startTransport = () => calls.push('start');
globalThis.pauseTransport = () => calls.push('pause');
globalThis.stopTransport = () => calls.push('stop');
globalThis.transportToStart = () => calls.push('start-position');
globalThis.transportToEnd = () => calls.push('end-position');
globalThis.openArrangerModal = () => calls.push('arranger');
globalThis.edOpenArchive = () => calls.push('archive');
globalThis.getMidiScoreController = () => ({ open: () => calls.push('score') });
globalThis.openSettings = () => calls.push('settings');

const handlers = new Map();
const service = menuModule.create({
  electronApi: {
    onMenuCommand: (name, handler) => handlers.set(name, handler)
  },
  notify: () => {},
  logger: { error: () => {} }
});

assert.equal(service.bind(), true);
assert.equal(handlers.size, 14);
assert.deepEqual(
  service.commands(),
  [
    'menu-new-song',
    'menu-open-project',
    'menu-save',
    'menu-save-as',
    'menu-export',
    'menu-import',
    'menu-play-pause',
    'menu-stop',
    'menu-go-to-start',
    'menu-go-to-end',
    'menu-arranger',
    'menu-archive',
    'menu-midi-settings',
    'menu-preferences'
  ]
);

for (const name of handlers.keys()) handlers.get(name)();
setImmediate(() => {
  assert.deepEqual(calls, [
    'new',
    'open',
    'save',
    'export',
    'export',
    'open',
    'start',
    'stop',
    'start-position',
    'end-position',
    'arranger',
    'archive',
    'score',
    'settings'
  ]);

  for (const name of Object.keys(original)) {
    if (original[name] === undefined) delete globalThis[name];
    else globalThis[name] = original[name];
  }
  console.log('ElectronMenuCommandService tests passed');
});
