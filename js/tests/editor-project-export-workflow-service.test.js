const assert = require('node:assert/strict');
const WorkflowService = require(
  '../editor/EditorProjectExportWorkflowService.js'
);

const calls = [];
let bundleOptions = null;
let nativeOptions = null;
let browserOptions = null;
let refreshed = 0;

const service = WorkflowService.create({
  getSong: () => ({ id: 'song-1' }),
  getDAW: () => ({ id: 'daw-1' }),
  buildBundle: async options => {
    bundleOptions = options;
    options.onAudioProgress({ index: 1, total: 2 });
    return {
      data: '{"id":"song-1"}',
      defaultName: 'song (کامل).json',
      audioCount: 2,
      linkedCount: 1
    };
  },
  saveNative: async options => {
    nativeOptions = options;
    return { handled: false };
  },
  saveBrowser: async options => {
    browserOptions = options;
    return { handled: true, status: 'saved' };
  },
  refreshStorageInfo: () => {
    refreshed += 1;
  },
  toast: message => calls.push(message),
  BlobRef: Blob,
  logger: { error: (...args) => calls.push(['error', ...args]) }
});

(async () => {
  await service.exportProject({ targetPath: 'C:\\song.json' });

  assert.equal(bundleOptions.song.id, 'song-1');
  assert.equal(bundleOptions.daw.id, 'daw-1');
  assert.ok(calls.includes('رمزگذاری صدا 1/2...'));
  assert.equal(nativeOptions.defaultPath, 'song (کامل).json');
  assert.equal(nativeOptions.targetPath, 'C:\\song.json');
  assert.equal(browserOptions.defaultName, 'song (کامل).json');
  assert.equal(browserOptions.blob.type, 'application/json');
  assert.match(browserOptions.confirmMessage, /لینک‌شده: 1 فایل/);
  assert.ok(calls.some(message =>
    typeof message === 'string' && message.startsWith('خروجی ذخیره شد')
  ));
  assert.equal(refreshed, 1);

  const cancelledState = { nativeCalls: 0, browserCalls: 0 };
  const cancelled = WorkflowService.create({
    getSong: () => ({ id: 'song-2' }),
    buildBundle: async () => ({
      data: '{}',
      defaultName: 'song.json',
      audioCount: 0,
      linkedCount: 0
    }),
    saveNative: async () => {
      cancelledState.nativeCalls += 1;
      return { handled: true, cancelled: true };
    },
    saveBrowser: async () => {
      cancelledState.browserCalls += 1;
      return { handled: true, status: 'saved' };
    },
    toast: message => calls.push(message),
    BlobRef: Blob
  });
  await cancelled.exportProject();
  assert.equal(cancelledState.nativeCalls, 1);
  assert.equal(cancelledState.browserCalls, 0);
  assert.ok(calls.includes('لغو شد'));

  const empty = WorkflowService.create({
    getSong: () => null,
    toast: message => calls.push(message),
    BlobRef: Blob
  });
  await empty.exportProject();
  assert.ok(calls.includes('ترانه‌ای باز نیست'));

  console.log('EditorProjectExportWorkflowService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
