const assert = require('node:assert/strict');
const menuModule = require('../core/ElectronMenuCommandService.js');

const original = {};
[
  'edNewSong',
  'edImportProject',
  'edSaveSong',
  'edSaveProjectFile',
  'edExportProjectFull',
  'EditorRuntimeAdapter',
  'AkordyarCoreApi',
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
globalThis.edSaveProjectFile = () => calls.push('save-file');
globalThis.edExportProjectFull = () => calls.push('export');
globalThis.EditorRuntimeAdapter = {
  getDAW: () => ({ isPlaying: false })
};
globalThis.AkordyarCoreApi = {
  startTransport: () => calls.push('start'),
  pauseTransport: () => calls.push('pause'),
  stopTransport: () => calls.push('stop'),
  transportToStart: () => calls.push('start-position'),
  transportToEnd: () => calls.push('end-position'),
  openArrangerModal: () => calls.push('arranger'),
  openSettings: () => calls.push('settings')
};
globalThis.edOpenArchive = () => calls.push('archive');
globalThis.getMidiScoreController = () => ({ open: () => calls.push('score') });

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
    'save-file',
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
