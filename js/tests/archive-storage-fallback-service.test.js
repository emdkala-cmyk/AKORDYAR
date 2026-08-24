const assert = require('node:assert/strict');
const ArchiveStorageFallbackService = require('../archive/ArchiveStorageFallbackService.js');

const values = new Map([[
  ArchiveStorageFallbackService.FALLBACK_KEY,
  JSON.stringify([{ id: 'song-1' }])
]]);
const storage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
};

assert.deepEqual(
  ArchiveStorageFallbackService.read(storage),
  [{ id: 'song-1' }]
);

ArchiveStorageFallbackService.write(storage, [{ id: 'song-2' }]);
assert.deepEqual(
  ArchiveStorageFallbackService.read(storage),
  [{ id: 'song-2' }]
);

assert.deepEqual(
  ArchiveStorageFallbackService.read({
    getItem: () => '{broken json'
  }),
  []
);

let quotaMessage = '';
ArchiveStorageFallbackService.write({
  setItem: () => {
    const error = new Error('quota');
    error.name = 'QuotaExceededError';
    throw error;
  }
}, [], message => {
  quotaMessage = message;
});
assert.equal(quotaMessage, '❌ حافظه مرورگر پر است!');

console.log('ArchiveStorageFallbackService tests passed');
