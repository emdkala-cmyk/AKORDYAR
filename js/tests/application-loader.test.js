const assert = require('node:assert/strict');
const { createApplicationLoader } = require('../app.js');

function createDocument({ readyState = 'complete', failAt = -1 } = {}) {
  const appended = [];
  const writes = [];
  let appendCount = 0;
  const documentRef = {
    readyState,
    baseURI: 'https://example.test/Akordyar.html',
    scripts: [],
    head: {
      appendChild(script) {
        appended.push(script);
        appendCount++;
        if (appended.length - 1 === failAt) {
          script.onerror?.(new Error('loader test failure'));
        } else {
          script.onload?.();
        }
      }
    },
    documentElement: null,
    createElement() {
      return { dataset: {}, setAttribute() {} };
    },
    write(value) {
      writes.push(value);
    }
  };
  return { documentRef, appended, writes, get appendCount() { return appendCount; } };
}

async function run() {
  const modern = createDocument();
  const loader = createApplicationLoader({
    documentRef: modern.documentRef,
    currentScript: { src: 'https://example.test/js/app.js', dataset: {} },
    chunks: ['app/core.js', 'app/editor.js']
  });
  const first = loader.load();
  const second = loader.load();
  const loaded = await first;

  assert.equal(loaded.length, 2);
  assert.equal(modern.appendCount, 2);
  assert.equal(modern.writes.length, 0);
  assert.equal(await second, loaded);

  const failed = createDocument({ failAt: 1 });
  await assert.rejects(
    createApplicationLoader({
      documentRef: failed.documentRef,
      currentScript: { src: 'https://example.test/js/app.js', dataset: {} },
      chunks: ['app/core.js', 'app/editor.js']
    }).load(),
    /loader test failure/
  );

  const compatibility = createDocument({ readyState: 'loading' });
  const compatibilityLoader = createApplicationLoader({
    documentRef: compatibility.documentRef,
    currentScript: {
      src: 'https://example.test/js/app.js',
      dataset: { loaderMode: 'document-write' }
    },
    chunks: ['app/core.js', 'app/editor.js']
  });
  await compatibilityLoader.loadWithDocumentWrite();
  assert.equal(compatibility.appendCount, 0);
  assert.match(compatibility.writes[0], /app\/core\.js/);
  assert.match(compatibility.writes[0], /data-akordyar-chunk/);

  console.log('ApplicationLoader tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
