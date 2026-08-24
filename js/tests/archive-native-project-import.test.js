const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const archive = fs.readFileSync(
  path.join(projectRoot, 'js', 'archive', 'ArchiveModule.js'),
  'utf8'
);
const routeService = fs.readFileSync(
  path.join(projectRoot, 'js', 'editor', 'EditorProjectImportRouteService.js'),
  'utf8'
);

const browserInputIndex = archive.lastIndexOf('input.click();');

assert.match(archive, /async function edImportProject\(\)/);
assert.match(archive, /getArchiveProjectImportRouteService\(\)\?\.openNative\?\.\(/);
assert.doesNotMatch(archive, /window\.electronAPI\.openFileDialog/);
assert.doesNotMatch(archive, /window\.electronAPI\.loadProjectFile/);
assert.match(routeService, /openFileDialog/);
assert.match(routeService, /loadProjectFile/);
assert.ok(browserInputIndex !== -1);
assert.match(
  routeService,
  /text:\s*async\s*\(\)\s*=>\s*JSON\.stringify\(data\)/
);

console.log('Archive native project import contract tests passed');
