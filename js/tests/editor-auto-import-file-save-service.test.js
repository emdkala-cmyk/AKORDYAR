const assert = require('node:assert/strict');
const FileSaveService = require(
  '../editor/EditorAutoImportFileSaveService.js'
);

function createElement(value = '') {
  return {
    style: {},
    textContent: '',
    value,
    disabled: false
  };
}

function createDocument(elements) {
  return {
    getElementById(id) {
      return elements.get(id) || null;
    }
  };
}

function createResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => data
  };
}

async function run() {
const sanitized = FileSaveService.create().sanitizeFilePart(
  '  Artist/Name: Song. ',
  'Fallback'
);
assert.equal(sanitized, 'Artist_Name_ Song');

const grouping = FileSaveService.create().groupSongsByArtist([
  { artist: 'A/B', title: 'One', rawText: '1' },
  { artist: 'A/B', title: 'Two', rawText: '2' },
  { artist: '', title: 'Three', rawText: '3' }
]);
assert.deepEqual(Object.keys(grouping), ['A_B', 'Unknown']);
assert.equal(grouping.A_B.length, 2);
assert.equal(grouping.Unknown.length, 1);

const report = FileSaveService.create().buildSaveReport({
  totalFiles: 2,
  perArtist: [{ artist: 'Artist', expected: 2, saved: 1, errors: 1 }],
  saved: 1,
  errors: 1,
  failed: [{ artist: 'Artist', title: 'Song', error: 'write failed' }]
});
assert.match(report, /Artist: 1 از 2 فایل/);
assert.match(report, /ناموفق: 1 فایل/);
assert.match(report, /write failed/);

const serverElements = new Map([
  ['autoImportStatus', createElement()],
  ['autoImportSummary', createElement()],
  ['autoImportFolderInput', createElement()],
  ['autoSavePathInput', createElement('D:\\Songs')]
]);
const serverSongs = [
  { artist: 'Artist', title: 'One', rawText: 'one' },
  { artist: 'Artist', title: 'Two', rawText: 'two' },
  { artist: 'Ignored', title: 'Bad', rawText: 'bad', error: 'failed' }
];
let serverRequest = null;
let serverFilesSaved = null;
let serverFailedFiles = null;
const serverToasts = [];
const serverService = FileSaveService.create({
  documentRef: createDocument(serverElements),
  getElement: id => serverElements.get(id),
  fetchRef: async (url, options) => {
    serverRequest = { url, options };
    return createResponse({
      saved: 2,
      errors: 0,
      skipped: 0,
      perArtist: [{ artist: 'Artist', expected: 2, saved: 2 }]
    });
  },
  getSongs: () => serverSongs,
  setFilesSaved: value => { serverFilesSaved = value; },
  setFailedFiles: value => { serverFailedFiles = value; },
  toast: message => serverToasts.push(message)
});

const serverResult = await serverService.saveFiles();
assert.equal(serverResult.method, 'server');
assert.equal(serverResult.saved, 2);
assert.equal(serverFilesSaved, 2);
assert.deepEqual(serverFailedFiles, []);
assert.equal(serverRequest.url, '/api/save-to-folder');
assert.equal(JSON.parse(serverRequest.options.body).savePath, 'D:\\Songs');
assert.equal(JSON.parse(serverRequest.options.body).songs.length, 2);
assert.match(serverElements.get('autoImportSummary').textContent, /مجموع/);
assert.equal(serverElements.get('autoImportFolderInput').style.display, 'none');
assert.equal(serverToasts.includes('در حال ذخیره...'), true);

const nativeElements = new Map([
  ['autoImportStatus', createElement()],
  ['autoImportSummary', createElement()],
  ['autoImportFolderInput', createElement()]
]);
const nativeFiles = [];
const nativeDirectories = [];
const nativeArtistDirectory = {
  async getFileHandle(filename) {
    return {
      async createWritable() {
        return {
          async write(contents) {
            nativeFiles.push({ filename, contents });
          },
          async close() {},
          async abort() {}
        };
      }
    };
  }
};
const nativeRootDirectory = {
  async getDirectoryHandle(name) {
    nativeDirectories.push(name);
    return nativeArtistDirectory;
  }
};
let nativeFilesSaved = null;
let nativeFailedFiles = null;
const nativeService = FileSaveService.create({
  documentRef: createDocument(nativeElements),
  getElement: id => nativeElements.get(id),
  getSongs: () => [
    { artist: 'Artist', title: 'Same', rawText: 'one' },
    { artist: 'Artist', title: 'Same', rawText: 'two' }
  ],
  getDirectoryHandle: () => nativeRootDirectory,
  setFilesSaved: value => { nativeFilesSaved = value; },
  setFailedFiles: value => { nativeFailedFiles = value; },
  toast: () => {}
});

const nativeResult = await nativeService.saveFiles();
assert.equal(nativeResult.method, 'native');
assert.equal(nativeResult.saved, 2);
assert.equal(nativeFilesSaved, 2);
assert.deepEqual(nativeFailedFiles, []);
assert.deepEqual(nativeDirectories, ['Artist']);
assert.deepEqual(
  nativeFiles.map(file => file.filename),
  ['Artist - Same.json', 'Artist - Same (2).json']
);
assert.equal(
  JSON.parse(nativeFiles[0].contents).title,
  'Same'
);

const failedElements = new Map([
  ['autoImportStatus', createElement()],
  ['autoImportSummary', createElement()],
  ['autoImportFolderInput', createElement()]
]);
let failedFiles = null;
const failedService = FileSaveService.create({
  documentRef: createDocument(failedElements),
  getElement: id => failedElements.get(id),
  getSongs: () => [{ artist: 'Broken', title: 'Song', rawText: 'text' }],
  getDirectoryHandle: () => ({
    async getDirectoryHandle() {
      throw new Error('permission denied');
    }
  }),
  setFilesSaved: () => {},
  setFailedFiles: value => { failedFiles = value; },
  toast: () => {}
});

const failedResult = await failedService.saveFiles();
assert.equal(failedResult.method, 'native');
assert.equal(failedResult.saved, 0);
assert.equal(failedResult.errors, 1);
assert.equal(failedFiles.length, 1);
assert.match(failedFiles[0].error, /permission denied/);

console.log('EditorAutoImportFileSaveService tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
