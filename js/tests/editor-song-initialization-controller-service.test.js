const assert = require('node:assert/strict');
const Controller = require(
  '../editor/EditorSongInitializationControllerService.js'
);

let optionsSeen = null;
const runtime = { initialize() {} };
const service = {
  create(options) {
    optionsSeen = options;
    return runtime;
  }
};

const song = { id: 'song-1' };
const dependencies = {
  storage: { getItem() {} },
  getSong: () => song,
  setSong() {},
  blankSong: () => ({ id: 'blank' }),
  repairSong: value => value,
  hydrationService: { hydrateSong() {} },
  documentRef: {},
  daw: { clips: [] },
  updateNextIdFromClips() {},
  ensureAudioCtx() {},
  updateTrackMix() {},
  audioRecoveryService: { restoreSongAudio() {} },
  loadAudioBlobsForProject() {},
  getAudioBlobFromDB() {},
  decodeFileToBuffer() {},
  loadAudioFromHardDrive() {},
  getFileHandle() {},
  getDirHandle() {},
  setDirHandle() {},
  showDirectoryPicker() {},
  isElectron: true,
  electronAvailable: true,
  peaksFromBuffer() {},
  refreshClipWaveImage() {},
  syncToolbar() {},
  renderEditor() {},
  resetHistory() {},
  deactivateHistory() {},
  activateHistory() {},
  renderAll() {},
  saveState() {},
  initHighlightEffect() {},
  rebuildSongDocument() {},
  syncViewStyles() {},
  toast() {},
  logger: { log() {} }
};

const configured = Controller.create({
  ...dependencies,
  service
});

assert.equal(configured.runtime, runtime);
assert.equal(configured.options, optionsSeen);
assert.equal(optionsSeen.getSong(), song);
assert.equal(optionsSeen.storage, dependencies.storage);
assert.equal(
  optionsSeen.audioRecoveryService,
  dependencies.audioRecoveryService
);
assert.equal(optionsSeen.isElectron, true);
assert.equal(optionsSeen.electronAvailable, true);
assert.equal(typeof optionsSeen.renderAll, 'function');
assert.equal(typeof optionsSeen.logger.log, 'function');
assert.throws(
  () => Controller.create({ service: {} }),
  /EditorSongInitializationService must be loaded/
);

console.log('EditorSongInitializationControllerService tests passed');
