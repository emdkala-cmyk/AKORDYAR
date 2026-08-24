const assert = require('node:assert/strict');
const lifecycle = require('../editor/EditorLifecycleService.js');

const logs = [];
const ready = lifecycle.initialize({
  initDAW: () => { throw new Error('daw failure'); },
  initSong: () => { throw new Error('song failure'); },
  initAccidentalSelector: () => { throw new Error('accidental failure'); },
  applyI18n: () => { throw new Error('i18n failure'); },
  initHighlightEffect: () => { throw new Error('highlight failure'); },
  refreshStorageInfo: () => { throw new Error('storage failure'); },
  schedule: () => { throw new Error('schedule failure'); },
  logger: {
    warn: (...args) => logs.push(['warn', args]),
    error: (...args) => logs.push(['error', args])
  }
});

assert.equal(typeof ready?.then, 'function');

ready.then(() => {
  assert.ok(logs.some(([level]) => level === 'warn'));
  assert.ok(logs.some(([level]) => level === 'error'));
  console.log('Editor lifecycle contract tests passed');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
