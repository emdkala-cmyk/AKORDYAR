const assert = require('node:assert/strict');
const AudioStorageService = require('../editor/EditorAudioStorageService.js');

function createFakeIndexedDB() {
  const stores = new Map([
    ['audioBlobs', new Map()],
    ['fileHandles', new Map()]
  ]);
  let opened = false;
  const db = {
    objectStoreNames: {
      contains: name => stores.has(name)
    },
    createObjectStore(name) {
      stores.set(name, new Map());
    },
    transaction(name) {
      const store = stores.get(name);
      const transaction = {
        objectStore() {
          return {
            put(value, key) {
              store.set(key, value);
              queueMicrotask(() => transaction.oncomplete?.());
            },
            delete(key) {
              store.delete(key);
              queueMicrotask(() => transaction.oncomplete?.());
            },
            get(key) {
              const request = {};
              queueMicrotask(() => {
                request.result = store.get(key);
                request.onsuccess?.();
              });
              return request;
            },
            getAllKeys() {
              const request = {};
              queueMicrotask(() => {
                request.result = [...store.keys()];
                request.onsuccess?.();
              });
              return request;
            },
            getAll() {
              const request = {};
              queueMicrotask(() => {
                request.result = [...store.values()];
                request.onsuccess?.();
              });
              return request;
            }
          };
        }
      };
      return transaction;
    },
    stores
  };

  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        if (!opened) {
          opened = true;
          request.onupgradeneeded?.({ target: { result: db } });
        }
        request.onsuccess?.({ target: { result: db } });
      });
      return request;
    },
    db
  };
}

const indexedDBRef = createFakeIndexedDB();
const elements = new Map([
  ['storageInfoBar', { style: {} }],
  ['storageBarInner', { style: {} }],
  ['storageText', { innerHTML: '' }]
]);
const buffer = {
  duration: 2,
  sampleRate: 48000,
  numberOfChannels: 1,
  length: 4
};
const decoded = {
  duration: 2,
  sampleRate: 48000,
  numberOfChannels: 1
};
const daw = {
  clips: [{
    type: 'audio',
    bufferKey: 'clip-1',
    fileName: 'voice.mp3',
    _embedded: true,
    _originalBlob: new Blob(['audio'], { type: 'audio/mpeg' })
  }],
  bufferCache: new Map([['clip-1', buffer]]),
  audioCtx: {
    decodeAudioData: async () => decoded,
    createBuffer: () => decoded
  }
};
const toasts = [];
const service = AudioStorageService.create({
  indexedDBRef: indexedDBRef,
  BlobCtor: Blob,
  getDAW: () => daw,
  ensureAudioCtx: () => {},
  getWavEncoder: () => new Uint8Array([1, 2, 3]),
  getElement: id => elements.get(id),
  getStorageEstimate: async () => ({ usage: 50, quota: 100 }),
  compressionServiceFactory: () => ({
    compressBytes: async bytes => ({
      blob: new Blob([bytes], { type: 'audio/wav' }),
      format: 'wav'
    }),
    decompressBytes: async bytes => bytes
  }),
  toast: message => toasts.push(message),
  logger: { log() {}, warn() {} }
});

(async () => {
  assert.equal((await service.openAudioDB()).objectStoreNames.contains('audioBlobs'), true);

  const handle = { name: 'voice.mp3' };
  await service.saveFileHandle('clip-1', handle);
  assert.equal(await service.getFileHandle('clip-1'), handle);

  const blob = new Blob(['stored'], { type: 'audio/mpeg' });
  await service.saveAudioBlobToDB('clip-1', blob, 'voice.mp3');
  const stored = await service.getAudioBlobFromDB('clip-1');
  assert.equal(stored.fileName, 'voice.mp3');
  assert.equal(await stored.blob.text(), 'stored');

  await service.saveAudioBlobsForProject('project-1');
  const projectEntries = indexedDBRef.db.stores.get('audioBlobs').get('project-1');
  assert.equal(projectEntries.length, 1);
  assert.equal(projectEntries[0].format, 'blob');

  daw.bufferCache.clear();
  await service.loadAudioBlobsForProject('project-1');
  assert.equal(daw.bufferCache.get('clip-1'), decoded);

  assert.equal(service.formatBytes(0), '0 B');
  assert.equal(service.formatBytes(1024), '1 KB');
  assert.deepEqual([...service.base64ToUint8('AQID')], [1, 2, 3]);
  assert.deepEqual(
    [...service.resampleFloat32(new Float32Array([0, 1, 0]), 2, 4)],
    [0, 0.5, 1, 0.5, 0, 0]
  );

  await service.refreshStorageInfo();
  assert.equal(elements.get('storageInfoBar').style.display, 'block');
  assert.equal(elements.get('storageBarInner').style.width, '50.0%');
  assert.match(elements.get('storageText').innerHTML, /مجموع/);

  await service.deleteAudioBlobsForProject('project-1');
  assert.equal(indexedDBRef.db.stores.get('audioBlobs').has('project-1'), false);
  assert.equal(toasts.length, 0);

  console.log('EditorAudioStorageService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
