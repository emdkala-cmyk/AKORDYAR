const assert = require('node:assert/strict');
const FacadeService = require(
  '../editor/EditorAudioStorageFacadeService.js'
);

let createCount = 0;
let capturedOptions = null;
const calls = [];
const storageInstance = {
  getAudioCompressionService: () => 'compression',
  openAudioDB: (...args) => calls.push(['openAudioDB', args]),
  saveFileHandle: (...args) => calls.push(['saveFileHandle', args]),
  refreshStorageInfo: (...args) => calls.push(['refreshStorageInfo', args])
};

const facade = FacadeService.create({
  storageService: {
    create: options => {
      createCount += 1;
      capturedOptions = options;
      return storageInstance;
    }
  }
});

assert.equal(facade.getEditorAudioStorageService(), storageInstance);
assert.equal(facade.getEditorAudioStorageService(), storageInstance);
assert.equal(createCount, 1);
assert.equal(typeof capturedOptions.getDAW, 'function');
assert.equal(typeof capturedOptions.getWavEncoder, 'function');

assert.equal(facade.getAudioCompressionService(), 'compression');
assert.equal(facade.openAudioDB('db'), 1);
assert.equal(facade.saveFileHandle('clip', 'handle'), 2);
assert.equal(facade.refreshStorageInfo('refresh'), 3);
assert.deepEqual(calls, [
  ['openAudioDB', ['db']],
  ['saveFileHandle', ['clip', 'handle']],
  ['refreshStorageInfo', ['refresh']]
]);

const unavailable = FacadeService.create({ storageService: {} });
assert.equal(unavailable.getEditorAudioStorageService(), null);
assert.equal(unavailable.openAudioDB(), undefined);

console.log('EditorAudioStorageFacadeService tests passed');
