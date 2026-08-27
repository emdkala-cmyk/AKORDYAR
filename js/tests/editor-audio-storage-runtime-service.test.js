const assert = require('node:assert/strict');
const vm = require('node:vm');
const RuntimeService = require(
  '../editor/EditorAudioStorageRuntimeService.js'
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

const runtime = RuntimeService.create({
  storageService: {
    create: options => {
      createCount += 1;
      capturedOptions = options;
      return storageInstance;
    }
  }
});

assert.equal(runtime.getService(), storageInstance);
assert.equal(runtime.getService(), storageInstance);
assert.equal(createCount, 1);
assert.equal(typeof capturedOptions.getDAW, 'function');
assert.equal(typeof capturedOptions.getWavEncoder, 'function');

assert.equal(runtime.getAudioCompressionService(), 'compression');
assert.equal(runtime.openAudioDB('db'), 1);
assert.equal(runtime.saveFileHandle('clip', 'handle'), 2);
assert.equal(runtime.refreshStorageInfo('refresh'), 3);
assert.deepEqual(calls, [
  ['openAudioDB', ['db']],
  ['saveFileHandle', ['clip', 'handle']],
  ['refreshStorageInfo', ['refresh']]
]);

const unavailable = RuntimeService.create({ storageService: {} });
assert.equal(unavailable.getService(), null);
assert.equal(unavailable.openAudioDB(), undefined);

const source = require('node:fs').readFileSync(
  require('node:path').join(
    __dirname,
    '../editor/EditorAudioStorageRuntimeService.js'
  ),
  'utf8'
);
const browserWindow = {};
const browserContext = {
  window: browserWindow,
  console,
  Blob: class FakeBlob {},
  fetch: () => Promise.resolve(),
  URL: {},
  navigator: {},
  RuntimeStateAdapter: {},
  AudioCompressionService: {},
  EditorAudioStorageService: {
    create: () => storageInstance
  }
};
browserContext.window = browserContext;
vm.runInNewContext(source, browserContext);
assert.equal(typeof browserContext.EditorAudioStorageRuntimeService.create, 'function');
assert.equal(
  typeof browserContext.EditorAudioStorageRuntime.openAudioDB,
  'function'
);
assert.equal(browserContext.openAudioDB, undefined);
assert.equal(browserContext.saveAudioBlobToDB, undefined);

console.log('EditorAudioStorageRuntimeService tests passed');
