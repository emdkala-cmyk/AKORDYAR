const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const ChordImportService = require(
  '../editor/EditorChordImportService.js'
);

void (async () => {
const dom = new JSDOM(`
  <div id="importChordModal"></div>
  <textarea id="importText"></textarea>
  <input id="importUrl">
  <input id="autoFixChords" type="checkbox">
  <input id="importAutoFix" type="checkbox">
  <pre id="importPreview"></pre>
`);
const { document } = dom.window;
const getElement = id => document.getElementById(id);
const calls = [];
const toasts = [];
const daw = {
  clips: [
    { id: 'audio-1', type: 'audio' },
    { id: 'chord-1', type: 'chord' }
  ]
};
let importedSong = { id: 'song-1' };
let importParsedResult = null;
let parsedSong = null;
let currentAutoResults = [];

const service = ChordImportService.create({
  documentRef: document,
  windowRef: dom.window,
  getElement,
  fetchRef: async () => ({
    ok: true,
    async text() {
      return '<h1>Generic song</h1><pre>C  G\\nhello world</pre>';
    }
  }),
  domParserRef: dom.window.DOMParser,
  urlRef: dom.window.URL,
  getAutoImportResults: () => currentAutoResults,
  songUniqueId: song => `${song.artist}:${song.title}`,
  normalizeRawText: value => String(value || '').trim(),
  hasPersian: value => /[\u0600-\u06ff]/.test(value),
  isChordOnlyLine: value => /^C(?:\\s+G)?$/.test(value),
  parseRawSong: parsed => {
    parsedSong = parsed;
    return {
      lyrics: parsed.rawText,
      chords: [{ name: 'C', lineIndex: 0, charIndex: 0 }],
      title: parsed.title,
      artist: parsed.artist,
      key: parsed.key,
      keyMode: parsed.keyMode,
      timeSignature: parsed.rhythm,
      warnings: []
    };
  },
  parseChordLyricText: rawText => ({
    allChords: new Set(rawText.includes('G') ? ['C', 'G'] : ['C']),
    sections: [
      { type: 'chord' },
      { type: 'lyric' }
    ]
  }),
  getEditorSongImportService: () => ({
    applyParsedResult(result) {
      importParsedResult = result;
      return {
        song: importedSong,
        chordCount: result.chords.length,
        title: result.title
      };
    }
  }),
  getDAW: () => daw,
  syncToolbar: () => calls.push('toolbar'),
  renderEditor: value => calls.push(['editor', value]),
  saveSong: () => calls.push('save'),
  renderAll: () => calls.push('render'),
  toast: message => toasts.push(message),
  logger: { warn() {}, error() {} }
});

service.openImportChordModal();
assert.equal(getElement('importChordModal').classList.contains('show'), true);
assert.equal(getElement('importText').value, '');
assert.equal(getElement('importUrl').value, '');
assert.equal(getElement('importPreview').style.display, 'none');
assert.equal(service.getImportParsed(), null);

getElement('importText').value =
  'آهنگ: باران\nخواننده: خواننده\nC  G\nمتن ترانه';
const imported = service.applyImportChords();
assert.equal(imported.title, 'باران');
assert.equal(parsedSong.title, 'باران');
assert.equal(parsedSong.artist, 'خواننده');
assert.equal(importParsedResult.title, 'باران');
assert.equal(daw.clips.length, 1);
assert.equal(daw.clips[0].type, 'audio');
assert.deepEqual(calls, [
  'toolbar',
  ['editor', true],
  'save',
  'render'
]);
assert.equal(
  getElement('importChordModal').classList.contains('show'),
  false
);
assert.match(toasts.at(-1), /۱ آکورد وارد شد|1 آکورد وارد شد/);

service.openImportChordModal();
service.fetchFromUrl();
assert.equal(toasts.at(-1), 'لینک را وارد کنید');

getElement('importUrl').value = 'https://example.com/song';
await service.fetchFromUrl();
assert.equal(service.getImportParsed().title, 'Generic song');
assert.equal(getElement('importPreview').style.display, 'block');
assert.match(getElement('importPreview').textContent, /Generic song/);
assert.equal(toasts.at(-1), 'متن استخراج شد!');

currentAutoResults = [{
  artist: 'Artist',
  title: 'Imported',
  key: 'C',
  rhythm: '4/4',
  rawText: 'C\\nline',
  url: 'https://example.com/imported'
}];
getElement('autoFixChords').checked = true;
service.loadAutoImportSong('Artist:Imported');
assert.equal(getElement('importAutoFix').checked, true);
assert.equal(getElement('importText').value, 'C\\nline');
assert.equal(getElement('importUrl').value, 'https://example.com/imported');
assert.equal(service.getImportParsed().title, 'Imported');
assert.match(getElement('importPreview').textContent, /Imported/);

const projectParsed = {
  title: 'Legacy project',
  artist: 'Artist',
  rawText: 'C',
  url: ''
};
getElement('importText').value = '';
const legacyParsed = service.applyImportChords(projectParsed);
assert.equal(legacyParsed.title, 'Legacy project');

const laminor = ChordImportService.create({
  documentRef: document,
  windowRef: dom.window,
  getElement,
  domParserRef: dom.window.DOMParser,
  urlRef: dom.window.URL,
  normalizeRawText: value => value.trim(),
  hasPersian: value => /[\u0600-\u06ff]/.test(value),
  isChordOnlyLine: value => value === 'C',
  parseChordLyricText: () => ({
    allChords: new Set(['C']),
    sections: []
  }),
  toast: message => toasts.push(message),
  logger: { warn() {}, error() {} }
});
const parsedLaminor = laminor.parseChordPage(
  '<h1>آکورد آهنگ باران - لامینور</h1>' +
  '<h6><a class="color-light-blue">خواننده</a></h6>' +
  '<a href="/rhythms/4-4">4/4</a>' +
  '<div>گام اصلی: F#m</div>' +
  '<pre id="main-chord">C\\nسلام دنیا</pre>',
  'https://laminor.org/song/baran'
);
assert.deepEqual(parsedLaminor, {
  title: 'باران',
  artist: 'خواننده',
  key: 'F#m',
  rhythm: '4/4',
  rawText: 'C\\nسلام دنیا',
  url: 'https://laminor.org/song/baran'
});

console.log('EditorChordImportService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
