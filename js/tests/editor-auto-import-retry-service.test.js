const assert = require('node:assert/strict');
const RetryService = require(
  '../editor/EditorAutoImportRetryService.js'
);

const calls = [];
const progress = [];
const state = {
  failedSongs: [
    { artist: 'Artist A', title: 'Recovered', url: 'recovered', error: 'old' },
    { artist: 'Artist A', title: 'Still failed', url: 'failed', error: 'old' },
    { artist: 'Artist B', title: 'Network failed', url: 'network', error: 'old' }
  ],
  results: [],
  stats: { total: 3, fetched: 0, archived: 0, dupes: 0, errors: 3 },
  getFailedSongs() {
    return this.failedSongs.slice();
  },
  setFailedSongs(songs) {
    this.failedSongs = songs.slice();
  },
  addFailedSongs(songs) {
    this.failedSongs.push(...songs);
  },
  addResults(songs) {
    this.results.push(...songs);
  },
  incrementStats(patch) {
    Object.entries(patch).forEach(([name, value]) => {
      this.stats[name] += value;
    });
  },
  getStats() {
    return { ...this.stats };
  }
};
const status = { textContent: '' };
const archive = [];

const service = RetryService.create({
  getState: () => state,
  getElement: id => id === 'autoImportStatus' ? status : null,
  getSource: () => 'akord',
  showProgress: () => calls.push('show-progress'),
  updateProgress: (...args) => progress.push(args),
  fetchArtistFromServer: async (artist, apiUrl, count, onProgress) => {
    assert.equal(apiUrl, '/api/akord/auto-import');
    onProgress(`fetch:${artist}`);
    if (artist === 'Artist B') {
      return { error: 'network', results: [] };
    }
    assert.equal(count, 2);
    return {
      results: [
        {
          artist,
          title: 'Recovered',
          url: 'recovered',
          rawText: 'C song'
        },
        {
          artist,
          title: 'Still failed',
          url: 'failed',
          error: 'still failed'
        }
      ]
    };
  },
  escapeHtml: value => value,
  buildProgressDetail: () => 'detail',
  saveSongToArchive: (song, songs) => {
    songs.unshift({ title: song.title });
    archive.push(song.title);
    return { saved: true, duplicate: false };
  },
  getAllSongs: () => [],
  setAllSongs: songs => calls.push(`songs:${songs.length}`),
  toast: message => calls.push(message)
});

(async () => {
  const result = await service.retryFailed();

  assert.equal(result.success, false);
  assert.equal(result.recovered, 1);
  assert.equal(result.stillFailed, 2);
  assert.equal(state.results.length, 1);
  assert.equal(state.stats.fetched, 1);
  assert.equal(state.stats.archived, 1);
  assert.deepEqual(
    state.failedSongs.map(song => song.url).sort(),
    ['failed', 'network']
  );
  assert.deepEqual(archive, ['Recovered']);
  assert.ok(calls.includes('show-progress'));
  assert.ok(calls.some(message =>
    typeof message === 'string' && message.includes('هنوز ناموفق')
  ));
  assert.equal(status.textContent.includes('باقی‌مانده ناموفق: 2'), true);
  assert.ok(progress.length >= 3);

  const emptyCalls = [];
  const empty = RetryService.create({
    getState: () => ({
      getFailedSongs: () => [],
      setFailedSongs() {},
      getStats: () => ({ total: 0, fetched: 0 })
    }),
    toast: message => emptyCalls.push(message)
  });
  const emptyResult = await empty.retryFailed();
  assert.deepEqual(emptyResult, { success: false, reason: 'empty' });
  assert.deepEqual(emptyCalls, ['مورد ناموفقی وجود ندارد']);

  console.log('EditorAutoImportRetryService tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
