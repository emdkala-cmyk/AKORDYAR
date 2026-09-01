const assert = require('node:assert/strict');
const ArchiveArtistImageService = require(
  '../archive/ArchiveArtistImageService.js'
);

function createStorage() {
  const values = new Map();
  return {
    values,
    getItem: key => values.get(key) || null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: key => { values.delete(key); }
  };
}

async function run() {
const artists = [
  {
    id: 'artist-a',
    normalizedName: 'artist-a',
    displayName: 'Artist A',
    aliases: ['A'],
    image: { type: 'bundled', src: './artist-a.jpg' }
  },
  {
    id: 'artist-c',
    normalizedName: 'artist-c',
    displayName: 'Artist C',
    aliases: []
  }
];
const storage = createStorage();
const toasts = [];
let refreshCount = 0;

class FakeReader {
  readAsDataURL() {
    this.onload?.({ target: { result: 'data:image/png;base64,source' } });
  }
}

class FakeImage {
  set src(value) {
    this.value = value;
    this.width = 800;
    this.height = 400;
    this.onload?.();
  }
}

const canvasContext = {
  calls: [],
  drawImage(...args) {
    this.calls.push(args);
  }
};
const input = {
  type: '',
  accept: '',
  onchange: null,
  click() {
    this.onchange?.({
      target: {
        files: [{ type: 'image/png', size: 100, name: 'artist.png' }]
      }
    });
  }
};
const documentRef = {
  createElement: tagName => {
    if (tagName === 'input') return input;
    return {
      width: 0,
      height: 0,
      getContext: () => canvasContext,
      toDataURL: () => 'data:image/jpeg;base64,processed'
    };
  }
};

const service = ArchiveArtistImageService.create({
  storage,
  documentRef,
  FileReaderCtor: FakeReader,
  ImageCtor: FakeImage,
  getDefaultArtists: () => artists,
  artistKey: value => String(value || '').trim().toLowerCase(),
  refreshArtists: () => { refreshCount++; },
  toast: message => toasts.push(message)
});

assert.equal(service.get('artist-a'), './artist-a.jpg');
storage.setItem('arch_artist_img_artist-a', 'user-image');
assert.equal(service.get('artist-a'), 'user-image');
service.remove('artist-a');
assert.equal(service.get('A'), './artist-a.jpg');

storage.setItem('arch_artist_img_Artist C', 'migrated-image');
assert.equal(service.get('artist-c'), 'migrated-image');
assert.equal(storage.getItem('arch_artist_img_artist-c'), 'migrated-image');
assert.equal(storage.getItem('arch_artist_img_Artist C'), null);

await assert.rejects(
  service.process({ type: 'image/gif', size: 10 }),
  /فرمت فایل مجاز نیست/
);
await assert.rejects(
  service.process({ type: 'image/png', size: 3 * 1024 * 1024 }),
  /حجم فایل بیش از 2 مگابایت است/
);
assert.equal(
  await service.process({ type: 'image/png', size: 100 }),
  'data:image/jpeg;base64,processed'
);
assert.equal(canvasContext.calls.length, 1);
assert.deepEqual(canvasContext.calls[0].slice(1, 5), [200, 0, 400, 400]);

service.pick('artist-c');
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(storage.getItem('arch_artist_img_artist-c'), 'data:image/jpeg;base64,processed');
assert.equal(refreshCount, 1);
assert.equal(input.accept, 'image/png,image/jpeg,image/webp');

const failingStorage = {
  setItem: () => { throw new Error('quota'); }
};
ArchiveArtistImageService.create({
  storage: failingStorage,
  toast: message => toasts.push(message)
}).set('artist-a', 'too-large');
assert.ok(toasts.some(message => message.includes('ذخیره تصویر')));

console.log('ArchiveArtistImageService tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
