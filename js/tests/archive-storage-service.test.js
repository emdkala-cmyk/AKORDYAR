const assert = require('node:assert/strict');
const ArchiveStorageFallbackService = require(
  '../archive/ArchiveStorageFallbackService.js'
);
const ArchiveStorageService = require('../archive/ArchiveStorageService.js');

function createStorage(initial = []) {
  const values = new Map([['ed_songs_archive', JSON.stringify(initial)]]);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    read: () => JSON.parse(values.get('ed_songs_archive') || '[]')
  };
}

const fallbackStorage = createStorage([{ id: 'fallback-song' }]);
const fallback = ArchiveStorageService.create({
  globalScope: {},
  storage: fallbackStorage,
  fallback: ArchiveStorageFallbackService
});

assert.deepEqual(fallback.getAllSongs(), [{ id: 'fallback-song' }]);
const savedSongs = [{ id: 'saved-song' }];
assert.equal(fallback.setAllSongs(savedSongs), savedSongs);
assert.deepEqual(fallback.getAllSongs(), savedSongs);
assert.deepEqual(fallbackStorage.read(), savedSongs);

let quotaMessage = '';
const quotaStorage = {
  getItem: () => '[]',
  setItem: () => {
    const error = new Error('quota');
    error.name = 'QuotaExceededError';
    throw error;
  }
};
const quota = ArchiveStorageService.create({
  globalScope: {},
  storage: quotaStorage,
  fallback: ArchiveStorageFallbackService,
  toast: message => {
    quotaMessage = message;
  }
});
quota.setAllSongs([{ id: 'quota-song' }]);
assert.equal(quotaMessage, '❌ حافظه مرورگر پر است!');

function createIndexedDbFake() {
  const storeData = [];
  const database = {
    objectStoreNames: {
      contains: name => name === 'songs'
    },
    createObjectStore: () => {},
    transaction: () => ({
      objectStore: () => ({
        getAll: () => {
          const request = { result: storeData.slice() };
          setImmediate(() => request.onsuccess?.());
          return request;
        },
        clear: () => {
          storeData.length = 0;
        },
        put: song => {
          const index = storeData.findIndex(item => item.id === song.id);
          if (index >= 0) storeData[index] = song;
          else storeData.push(song);
        }
      }),
      oncomplete: null
    })
  };
  return {
    open: () => {
      const request = {};
      setImmediate(() => {
        request.onupgradeneeded?.({ target: { result: database } });
        request.onsuccess?.({ target: { result: database } });
      });
      return request;
    },
    database,
    storeData
  };
}

const indexedDBFake = createIndexedDbFake();
const indexed = ArchiveStorageService.create({
  globalScope: {},
  storage: createStorage([{ id: 'legacy-song' }]),
  indexedDB: indexedDBFake,
  fallback: ArchiveStorageFallbackService
});

assert.deepEqual(indexed.getAllSongs(), [{ id: 'legacy-song' }]);
assert.equal(indexed.getDatabase(), null);

setImmediate(() => {
  assert.equal(indexed.getDatabase(), indexedDBFake.database);
  const missingIdSong = { title: 'missing-id' };
  indexed.setAllSongs([missingIdSong]);
  assert.equal(typeof missingIdSong.id, 'string');
  assert.ok(missingIdSong.id.length > 0);
  indexed.setAllSongs([{ id: 'indexed-song' }]);
  assert.deepEqual(indexed.getAllSongs(), [{ id: 'indexed-song' }]);
  console.log('ArchiveStorageService tests passed');
});
