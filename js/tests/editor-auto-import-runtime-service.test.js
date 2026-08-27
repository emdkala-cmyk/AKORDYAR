const assert = require('node:assert/strict');
const AutoImportRuntimeService = require(
  '../editor/EditorAutoImportRuntimeService.js'
);
const AutoImportStateService = require(
  '../editor/EditorAutoImportStateService.js'
);

const calls = [];
const toasts = [];
const elements = new Map();
const makeElement = (id, value = '') => {
  const element = {
    id,
    value,
    style: {},
    classList: {
      add: className => calls.push([id, 'add', className]),
      remove: className => calls.push([id, 'remove', className])
    },
    addEventListener: (eventName, handler) => {
      element.listeners ||= {};
      element.listeners[eventName] = handler;
    }
  };
  elements.set(id, element);
  return element;
};

makeElement('autoArtistName', 'Artist');
makeElement('autoArtistTags');
makeElement('autoSource', 'akord');
makeElement('autoCookieField');
makeElement('autoSessionCookie', 'cookie');
makeElement('autoImportFolderInput');
makeElement('autoSavePathInput');

const stateService = AutoImportStateService;
const uiService = {
  create() {
    return {
      updateProgress: (...args) => calls.push(['progress', ...args]),
      showProgress: () => calls.push('show-progress'),
      hideProgress: () => calls.push('hide-progress'),
      open: () => calls.push('open'),
      close: () => calls.push('close'),
      resetRequest: () => calls.push('reset-request')
    };
  }
};
const parserService = {
  create() {
    return {
      normalizeRawText: value => String(value || '').trim(),
      hasPersian: value => /[\u0600-\u06ff]/u.test(value),
      isChordOnlyLine: value => value === 'C',
      parseRawSong: song => ({
        title: song.title,
        artist: song.artist,
        lyrics: song.rawText,
        chords: []
      })
    };
  }
};

let workflowConfig;
const workflowService = {
  create(config) {
    workflowConfig = config;
    return {
      start: () => {
        calls.push('workflow-start');
        return { success: true };
      }
    };
  }
};

let retryConfig;
const retryService = {
  create(config) {
    retryConfig = config;
    return {
      retryFailed: () => {
        calls.push('retry');
        return { success: true };
      }
    };
  }
};

let fileSaveConfig;
const fileSaveService = {
  create(config) {
    fileSaveConfig = config;
    return {
      saveFiles: () => {
        calls.push('save-files');
        return { saved: 1 };
      }
    };
  }
};

let songs = [];
let setSongsCalls = 0;
const runtime = AutoImportRuntimeService.create({
  documentRef: {},
  getElement: id => elements.get(id) || null,
  fetchRef: async () => ({
    async json() {
      return { results: [] };
    }
  }),
  stateService,
  uiService,
  fileSaveService,
  workflowService,
  retryService,
  rawSongParserService: parserService,
  positionMapper: {},
  getAllSongs: () => songs,
  setAllSongs: value => {
    songs = value;
    setSongsCalls++;
  },
  artistKey: value => `key:${value}`,
  isValidNote: value => value === 'C',
  confirmRef: () => true,
  toast: message => toasts.push(message),
  wait: async () => {}
});

assert.ok(runtime);
assert.equal(typeof runtime.startAutoImport, 'function');
assert.equal(typeof runtime.autoRetryFailed, 'function');
assert.equal(runtime.escapeHtml('<Artist & song>'), '&lt;Artist &amp; song&gt;');
assert.deepEqual(runtime.parseArtistNames('A, B\nC'), ['A', 'B', 'C']);
assert.equal(runtime.normalizeRawText('  raw  '), 'raw');
assert.equal(runtime.hasPersian('سلام'), true);
assert.equal(runtime.isChordOnlyLine('C'), true);
assert.equal(workflowConfig.getState(), runtime.getState());
assert.equal(fileSaveConfig.getDirectoryHandle(), null);

runtime.openAutoImportModal();
assert.ok(elements.get('autoArtistName').listeners.input);
assert.ok(elements.get('autoSource').listeners.change);
assert.equal(calls.includes('open'), true);

const importedSong = {
  artist: 'Artist',
  title: 'Song',
  rawText: 'C\ntext',
  url: 'https://example.test/song',
  key: 'C'
};
const scratchArchive = [];
assert.deepEqual(runtime.saveSongToArchive(importedSong, scratchArchive), {
  saved: true,
  duplicate: false
});
assert.equal(scratchArchive.length, 1);

const archive = [];
assert.deepEqual(runtime.saveSongToArchive(importedSong, archive), {
  saved: true,
  duplicate: false
});
assert.deepEqual(runtime.saveSongToArchive(importedSong, archive), {
  saved: false,
  duplicate: true
});

runtime.getState().addResults([importedSong]);
runtime.autoImportSaveArchive();
assert.equal(setSongsCalls, 1);
assert.match(toasts.at(-1), /۱ ترانه ذخیره شد|1 ترانه ذخیره شد/);

assert.deepEqual(runtime.startAutoImport(), { success: true });
assert.deepEqual(runtime.autoRetryFailed(), { success: true });
assert.equal(retryConfig.getState(), runtime.getState());
assert.deepEqual(runtime.autoImportDoSave(), { saved: 1 });
assert.equal(calls.includes('workflow-start'), true);
assert.equal(calls.includes('retry'), true);
assert.equal(calls.includes('save-files'), true);

runtime.autoImportSaveConfirm();
assert.equal(elements.get('autoImportFolderInput').style.display, 'block');
assert.equal(elements.get('autoSavePathInput').disabled, false);

assert.equal(
  Object.prototype.hasOwnProperty.call(globalThis, 'openAudioDB'),
  false
);
assert.equal(
  Object.prototype.hasOwnProperty.call(globalThis, 'autoImportStateService'),
  false
);

console.log('EditorAutoImportRuntimeService tests passed');
