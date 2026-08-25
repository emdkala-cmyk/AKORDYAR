const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const files = [
  'Akordyar.html',
  'js/archive/ArchiveModule.js',
  'js/app/core.js',
  'js/app/editor.js',
  'js/app/search.js',
  'js/projecthub.js'
];

for (const relativePath of files) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  assert.doesNotMatch(
    source,
    /\bon(?:click|change|input)\s*=\s*["']/i,
    `${relativePath} must not contain inline event attributes`
  );
}

const html = fs.readFileSync(path.join(projectRoot, 'Akordyar.html'), 'utf8');
assert.match(html, /data-inline-actions/);
assert.match(html, /data-view="archive"/);

const archiveModule = fs.readFileSync(
  path.join(projectRoot, 'js/archive/ArchiveModule.js'),
  'utf8'
);
const archiveRenderService = fs.readFileSync(
  path.join(projectRoot, 'js/archive/ArchiveRenderService.js'),
  'utf8'
);
const archiveReadOnlyService = fs.readFileSync(
  path.join(projectRoot, 'js/archive/ArchiveReadOnlyService.js'),
  'utf8'
);
assert.match(archiveRenderService, /data-action="archToggleSelect"/);
assert.match(archiveRenderService, /data-action="archSelectAll"/);
assert.match(archiveReadOnlyService, /const actions = \{\s*archExitReadOnly/);

const projectHub = fs.readFileSync(
  path.join(projectRoot, 'js/projecthub.js'),
  'utf8'
);
assert.match(projectHub, /function openArchive\(\)/);
assert.match(projectHub, /view === ['"]archive['"]\) openArchive\(\)/);

const search = fs.readFileSync(
  path.join(projectRoot, 'js/app/search.js'),
  'utf8'
);
assert.match(search, /data-command="quickSearchLoadSong"/);
assert.doesNotMatch(search, /onclick\s*=/i);

console.log('Inline handler contract tests passed');
