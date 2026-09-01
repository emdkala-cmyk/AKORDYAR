const assert = require('node:assert/strict');
const ArchiveXmlExportService = require('../archive/ArchiveXmlExportService.js');

function FakeBlob(parts, options) {
  this.parts = parts;
  this.options = options;
}

const song = {
  title: 'عنوان & تست',
  artist: 'خواننده <اول>',
  key: 'C',
  keyMode: 'min',
  timeSignature: '4/4',
  tempo: 95,
  genre: 'پاپ',
  transpose: 1,
  chords: [{
    name: 'C&',
    lineIndex: 0,
    charIndex: 2,
    anchorType: 'word'
  }],
  lyrics: 'خط اول\nخط <دوم>',
  styles: {
    tSize: 24,
    tColor: '#123456',
    tFont: 'Vazirmatn',
    tBold: true,
    align: 'right',
    cSize: 22,
    cColor: '#abcdef',
    cFont: 'Mono'
  }
};

let syncCount = 0;
let pickerOptions = null;
let writtenBlob = null;
const pickerToasts = [];
const pickerService = ArchiveXmlExportService.create({
  getSong: () => song,
  syncMetadata: value => {
    assert.equal(value, song);
    syncCount++;
  },
  getShowSaveFilePicker: () => async options => {
    pickerOptions = options;
    return {
      createWritable: async () => ({
        write: async blob => {
          writtenBlob = blob;
        },
        close: async () => {}
      })
    };
  },
  BlobCtor: FakeBlob,
  toast: message => pickerToasts.push(message)
});

(async () => {
  await pickerService.exportXml();
  assert.equal(syncCount, 1);
  assert.equal(pickerOptions.suggestedName, 'عنوان & تست.xml');
  assert.equal(writtenBlob.options.type, 'application/xml');
  assert.match(writtenBlob.parts[0], /عنوان &amp; تست/);
  assert.match(writtenBlob.parts[0], /خواننده &lt;اول&gt;/);
  assert.match(writtenBlob.parts[0], /C&amp;/);
  assert.match(writtenBlob.parts[0], /<key>Cm<\/key>/);
  assert.match(writtenBlob.parts[0], /<line index="1">خط &lt;دوم&gt;<\/line>/);
  assert.deepEqual(pickerToasts, ['خروجی XML ذخیره شد']);

  let fallbackAnchor = null;
  let revokedUrl = null;
  const fallbackToasts = [];
  const fallbackService = ArchiveXmlExportService.create({
    getSong: () => song,
    BlobCtor: FakeBlob,
    getShowSaveFilePicker: () => null,
    URLRef: {
      createObjectURL: blob => {
        assert.equal(blob.options.type, 'application/xml');
        return 'blob:xml';
      },
      revokeObjectURL: url => {
        revokedUrl = url;
      }
    },
    documentRef: {
      createElement: tag => {
        assert.equal(tag, 'a');
        fallbackAnchor = { click: () => {} };
        return fallbackAnchor;
      }
    },
    toast: message => fallbackToasts.push(message)
  });
  await fallbackService.exportXml();
  assert.equal(fallbackAnchor.download, 'عنوان & تست.xml');
  assert.equal(fallbackAnchor.href, 'blob:xml');
  assert.equal(revokedUrl, 'blob:xml');
  assert.deepEqual(fallbackToasts, ['خروجی XML ذخیره شد']);

  let abortFallbackCalled = false;
  const abortToasts = [];
  const abortService = ArchiveXmlExportService.create({
    getSong: () => song,
    BlobCtor: FakeBlob,
    getShowSaveFilePicker: () => async () => {
      const error = new Error('cancelled');
      error.name = 'AbortError';
      throw error;
    },
    URLRef: {
      createObjectURL: () => {
        abortFallbackCalled = true;
        return 'blob:unused';
      },
      revokeObjectURL: () => {}
    },
    documentRef: {
      createElement: () => {
        abortFallbackCalled = true;
        return {};
      }
    },
    toast: message => abortToasts.push(message)
  });
  await abortService.exportXml();
  assert.equal(abortFallbackCalled, false);
  assert.deepEqual(abortToasts, []);

  const noSongToasts = [];
  const noSongService = ArchiveXmlExportService.create({
    getSong: () => null,
    toast: message => noSongToasts.push(message)
  });
  await noSongService.exportXml();
  assert.deepEqual(noSongToasts, ['ترانه‌ای باز نیست']);

  console.log('ArchiveXmlExportService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
