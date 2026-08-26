const assert = require('node:assert/strict');
const StateService = require(
  '../editor/EditorAutoImportStateService.js'
);
const WorkflowService = require(
  '../editor/EditorAutoImportWorkflowService.js'
);

function element(value = '') {
  return {
    style: {},
    value,
    checked: false,
    disabled: false,
    textContent: '',
    innerHTML: ''
  };
}

async function run() {
  const elements = new Map([
    ['autoArtistName', element('Artist A, Artist B')],
    ['autoSongCount', element('2')],
    ['autoSaveArchive', element()],
    ['autoSource', element('akord')],
    ['autoImportStatus', element()],
    ['autoImportResults', element()],
    ['autoImportBtn', element()],
    ['autoImportSummary', element()],
    ['autoImportForm', element()],
    ['autoImportFooter', element()],
    ['autoImportDone', element()]
  ]);
  elements.get('autoSaveArchive').checked = true;

  const state = StateService.create();
  const probeRequests = [];
  const artistFetches = [];
  const progress = [];
  const toasts = [];
  const savedSongs = [];
  const existingSongs = [];
  const savedSongResults = [];

  const service = WorkflowService.create({
    getElement: id => elements.get(id),
    fetchRef: async (url, options) => {
      probeRequests.push({ url, options });
      const body = JSON.parse(options.body);
      if (body.artistName === 'Artist B') {
        return {
          async json() {
            return { error: 'artist not found', candidates: ['Artist B?'] };
          }
        };
      }
      return {
        async json() {
          return { totalSongs: 3 };
        }
      };
    },
    getState: () => state,
    parseArtistNames: raw => raw.split(',').map(value => value.trim()),
    escapeHtml: value => String(value).replace(/[<>&"']/g, '_'),
    updateProgress: (...args) => progress.push(args),
    showProgress: () => { elements.get('autoImportStatus').shown = true; },
    fetchArtistFromServer: async (...args) => {
      artistFetches.push(args);
      return {
        results: [
          {
            artist: 'Artist A',
            title: 'One',
            url: 'https://example.test/one',
            rawText: 'one',
            key: 'C'
          },
          {
            artist: 'Artist A',
            title: 'One duplicate',
            url: 'https://example.test/one',
            rawText: 'duplicate',
            key: 'C'
          },
          {
            artist: 'Artist A',
            title: 'Broken',
            url: 'https://example.test/broken',
            error: 'parse failed'
          }
        ]
      };
    },
    buildProgressDetail: () => '<span>progress</span>',
    saveSongToArchive: song => {
      savedSongs.push(song);
      savedSongResults.push({ saved: true, duplicate: false });
      return savedSongResults.at(-1);
    },
    getAllSongs: () => existingSongs,
    setAllSongs: songs => { existingSongs.splice(0, existingSongs.length, ...songs); },
    toast: message => toasts.push(message),
    wait: async () => {},
    logger: { log() {} }
  });

  const result = await service.start();
  assert.equal(result.success, true);
  assert.equal(result.stats.total, 2);
  assert.equal(result.stats.fetched, 2);
  assert.equal(result.stats.archived, 1);
  assert.equal(state.getResults().length, 2);
  assert.equal(savedSongs.length, 1);
  assert.equal(artistFetches.length, 1);
  assert.equal(artistFetches[0][0], 'Artist A');
  assert.equal(artistFetches[0][2], 2);
  assert.equal(probeRequests.length, 2);
  assert.equal(JSON.parse(probeRequests[0].options.body).count, 1);
  assert.match(elements.get('autoImportResults').innerHTML, /loadAutoImportSong/);
  assert.match(elements.get('autoImportStatus').textContent, /گزارش نهایی/);
  assert.equal(elements.get('autoImportForm').style.display, 'none');
  assert.equal(elements.get('autoImportFooter').style.display, 'none');
  assert.equal(elements.get('autoImportDone').style.display, 'block');
  assert.equal(progress.length > 0, true);
  assert.equal(toasts.length, 0);

  const missingElements = new Map([
    ['autoArtistName', element('')],
    ['autoSongCount', element('1')],
    ['autoSaveArchive', element()],
    ['autoSource', element('akord')]
  ]);
  const missingToasts = [];
  const missingService = WorkflowService.create({
    getElement: id => missingElements.get(id),
    getState: () => StateService.create(),
    parseArtistNames: raw => raw ? [raw] : [],
    toast: message => missingToasts.push(message)
  });
  const missingResult = await missingService.start();
  assert.equal(missingResult.reason, 'missing-artist');
  assert.deepEqual(missingToasts, ['نام خواننده را وارد کنید']);

  const failureElements = new Map([
    ['autoArtistName', element('Artist')],
    ['autoSongCount', element('1')],
    ['autoSaveArchive', element()],
    ['autoSource', element('akord')],
    ['autoImportStatus', element()],
    ['autoImportResults', element()],
    ['autoImportBtn', element()],
    ['autoImportDone', element()]
  ]);
  const failureService = WorkflowService.create({
    getElement: id => failureElements.get(id),
    getState: () => {
      const failureState = StateService.create();
      return failureState;
    },
    fetchRef: async () => ({
      async json() {
        return { totalSongs: 1 };
      }
    }),
    fetchArtistFromServer: async () => {
      throw new Error('Failed to fetch');
    },
    wait: async () => {},
    logger: { log() {} }
  });
  const failureResult = await failureService.start();
  assert.equal(failureResult.success, false);
  assert.equal(failureResult.error, 'Failed to fetch');
  assert.equal(failureElements.get('autoImportBtn').disabled, false);
  assert.equal(failureElements.get('autoImportBtn').textContent, '🔄 تلاش مجدد');
  assert.equal(failureElements.get('autoImportDone').style.display, 'block');

  console.log('EditorAutoImportWorkflowService tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
